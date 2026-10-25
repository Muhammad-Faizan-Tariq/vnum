import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { logActivity } from "@/server/activity";
import { getSettings } from "@/server/settings";
import { expireStaleOrders, fulfilOrder, newReference, transitionOrder } from "@/server/orders/service";
import { paymentProvider, type PaymentEvent } from "@/server/payments/provider";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

/** Starts (or switches) the payment attempt for an unpaid order. */
export async function startPayment(userId: string, orderId: string, method: PaymentMethod) {
  await expireStaleOrders();
  if (!(method in PAYMENT_METHODS)) throw new AppError("INVALID_METHOD", "Unknown payment method", 422);
  try {
    return await db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, userId } });
      if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
      if (order.status !== "PENDING_PAYMENT") {
        throw new AppError("ORDER_NOT_PAYABLE", "This order can no longer be paid", 409);
      }
      const current = await tx.payment.findFirst({ where: { orderId, status: "PENDING" } });
      if (current?.method === method) return current;
      if (current) await tx.payment.update({ where: { id: current.id }, data: { status: "CANCELLED" } });

      const reference = newReference("PAY");
      const charge = paymentProvider.createCharge({ amountCents: order.amountCents, method, reference });
      const payment = await tx.payment.create({
        data: {
          reference,
          orderId,
          method,
          amountCents: order.amountCents,
          cryptoAmount: charge.cryptoAmount,
          cryptoSymbol: charge.cryptoSymbol,
          depositAddress: charge.depositAddress,
          expiresAt: order.expiresAt,
        },
      });
      await logActivity(
        { actorId: userId, action: "payment.started", entityType: "Payment", entityId: payment.id, metadata: { method } },
        tx,
      );
      return payment;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("PAYMENT_IN_PROGRESS", "A payment is already being set up. Refresh and try again.", 409);
    }
    throw e;
  }
}

const SCALE = 8;
function toUnits(v: string) {
  const [i, f = ""] = v.split(".");
  return BigInt(i + f.padEnd(SCALE, "0").slice(0, SCALE));
}

export type PaymentEventResult = {
  result: "applied" | "duplicate" | "ignored";
  paymentStatus: string;
  detail: string;
};

/**
 * Server-side verification for a (simulated) provider callback. Safe to call repeatedly:
 * the event id is unique, the payment row is locked, and only PENDING payments can change.
 */
export async function handlePaymentEvent(event: PaymentEvent, source: string): Promise<PaymentEventResult> {
  const payment = await db.payment.findUnique({ where: { reference: event.paymentReference } });
  if (!payment) throw new AppError("PAYMENT_NOT_FOUND", "Unknown payment reference", 404);

  const outcome = await db.$transaction(async (tx) => {
    // ON CONFLICT DO NOTHING: a replayed event id inserts zero rows without aborting the transaction.
    const inserted = await tx.paymentEvent.createMany({
      data: [{ eventId: event.eventId, paymentId: payment.id, type: event.type, payload: { ...event, source }, outcome: "received" }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) {
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      return { result: "duplicate", paymentStatus: current.status, detail: "Event already processed", fulfil: false } as const;
    }

    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const finish = async (
      result: PaymentEventResult["result"],
      detail: string,
      fulfil = false,
    ) => {
      await tx.paymentEvent.update({ where: { eventId: event.eventId }, data: { outcome: `${result}: ${detail}` } });
      return { result, paymentStatus: (await tx.payment.findUniqueOrThrow({ where: { id: p.id } })).status, detail, fulfil } as const;
    };

    if (p.status !== "PENDING") return finish("ignored", `Payment is already ${p.status}`);

    const closeOrder = async (status: "EXPIRED" | "FAILED", reason: string, cancelOrder: boolean) => {
      await tx.payment.update({ where: { id: p.id }, data: { status, failureReason: reason } });
      if (cancelOrder) await transitionOrder(tx, p.orderId, "CANCELLED", { reason });
      await logActivity(
        { action: `payment.${status.toLowerCase()}`, entityType: "Payment", entityId: p.id, metadata: { reason, source } },
        tx,
      );
    };

    if (event.type === "payment.expired" || p.expiresAt < new Date()) {
      await closeOrder("EXPIRED", "Payment window expired", true);
      return finish("applied", "Payment expired and order cancelled");
    }
    if (event.type === "payment.failed") {
      await closeOrder("FAILED", event.reason ?? "Provider reported a failure", false);
      return finish("applied", "Payment marked failed; the order is still open for another attempt");
    }

    // payment.confirmed: verify the amount before trusting it.
    const received = event.amount ? toUnits(event.amount) : toUnits(p.cryptoAmount);
    if (received < toUnits(p.cryptoAmount)) {
      await closeOrder("FAILED", `Underpaid: received ${event.amount} ${p.cryptoSymbol}, expected ${p.cryptoAmount}`, false);
      return finish("applied", "Underpayment detected; payment marked failed");
    }
    await tx.payment.update({ where: { id: p.id }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    await transitionOrder(tx, p.orderId, "PAID_SANDBOX", { reason: `Sandbox payment ${p.reference} confirmed` });
    await logActivity(
      { action: "payment.confirmed", entityType: "Payment", entityId: p.id, metadata: { source } },
      tx,
    );
    return finish("applied", "Payment confirmed (simulated)", true);
  });

  if (outcome.fulfil) {
    const settings = await getSettings();
    if (settings.autoFulfil) await fulfilOrder(payment.orderId);
  }
  return { result: outcome.result, paymentStatus: outcome.paymentStatus, detail: outcome.detail };
}

export type Scenario = "confirm" | "underpay" | "fail" | "expire";

/** Demo-only: plays the part of the payment network by emitting a provider event. */
export async function runPaymentScenario(paymentId: string, scenario: Scenario, source: string) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
  const base = { eventId: `evt_${randomUUID()}`, paymentReference: payment.reference };
  const info = PAYMENT_METHODS[payment.method];
  const half = (Number(payment.cryptoAmount) / 2).toFixed(info.decimals);
  const event: PaymentEvent =
    scenario === "confirm"
      ? { ...base, type: "payment.confirmed", amount: payment.cryptoAmount }
      : scenario === "underpay"
        ? { ...base, type: "payment.confirmed", amount: half }
        : scenario === "fail"
          ? { ...base, type: "payment.failed", reason: "Simulated network failure" }
          : { ...base, type: "payment.expired" };
  return handlePaymentEvent(event, source);
}
