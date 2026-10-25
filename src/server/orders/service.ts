import { randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/server/db";
import { AppError } from "@/server/errors";
import { logActivity } from "@/server/activity";
import { getSettings } from "@/server/settings";
import { getNumberProvider } from "@/server/numbers/provider";
import { canTransition, LIVE_ORDER_STATUSES, RELEASING_STATUSES } from "@/server/orders/state";

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newReference(prefix: string) {
  let s = "";
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `${prefix}-${s}`;
}

type Ctx = { actorId?: string | null; reason?: string };

/** The only place order status changes. Validates the transition and keeps inventory in step. */
export async function transitionOrder(tx: Tx, orderId: string, to: OrderStatus, ctx: Ctx = {}) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
  if (!canTransition(order.status, to)) {
    throw new AppError("INVALID_TRANSITION", `An order that is ${order.status} cannot move to ${to}`, 409);
  }
  const res = await tx.order.updateMany({
    where: { id: orderId, status: order.status },
    data: { status: to, completedAt: to === "COMPLETED" ? new Date() : undefined },
  });
  if (res.count === 0) throw new AppError("CONFLICT", "The order was changed by someone else. Refresh and retry.", 409);

  if (to === "PAID_SANDBOX") {
    await tx.virtualNumber.updateMany({ where: { id: order.numberId, status: "RESERVED" }, data: { status: "SOLD" } });
  }
  if (RELEASING_STATUSES.includes(to)) {
    await tx.virtualNumber.updateMany({
      where: { id: order.numberId, status: { in: ["RESERVED", "SOLD"] } },
      data: { status: "AVAILABLE" },
    });
  }
  await logActivity(
    {
      actorId: ctx.actorId,
      action: `order.${to.toLowerCase()}`,
      entityType: "Order",
      entityId: orderId,
      metadata: { from: order.status, to, reason: ctx.reason ?? null },
    },
    tx,
  );
  return { ...order, status: to };
}

export async function createOrder(userId: string, numberId: string, idempotencyKey: string) {
  await expireStaleOrders();
  const settings = await getSettings();

  const existingByKey = () => db.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
  const replay = await existingByKey();
  if (replay) return { order: replay, replayed: true };

  const sameNumber = await db.order.findFirst({
    where: { userId, numberId, status: { in: [...LIVE_ORDER_STATUSES] } },
  });
  if (sameNumber) return { order: sameNumber, replayed: true };

  try {
    const order = await db.$transaction(async (tx) => {
      const claimed = await tx.virtualNumber.updateMany({
        where: { id: numberId, status: "AVAILABLE" },
        data: { status: "RESERVED" },
      });
      if (claimed.count === 0) {
        const exists = await tx.virtualNumber.findUnique({ where: { id: numberId }, select: { id: true } });
        if (!exists) throw new AppError("NOT_FOUND", "That number no longer exists", 404);
        throw new AppError("NUMBER_UNAVAILABLE", "Someone else just took this number. Pick another one.", 409);
      }
      const number = await tx.virtualNumber.findUniqueOrThrow({ where: { id: numberId } });
      const created = await tx.order.create({
        data: {
          reference: newReference("VN"),
          userId,
          numberId,
          amountCents: number.priceCents,
          idempotencyKey,
          expiresAt: new Date(Date.now() + settings.paymentWindowMinutes * 60_000),
        },
      });
      await logActivity(
        { actorId: userId, action: "order.created", entityType: "Order", entityId: created.id, metadata: { number: number.e164 } },
        tx,
      );
      return created;
    });
    return { order, replayed: false };
  } catch (e) {
    // A concurrent submit with the same key may have won; return its order instead of an error.
    const raced = await existingByKey();
    if (raced) return { order: raced, replayed: true };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("NUMBER_UNAVAILABLE", "Someone else just took this number. Pick another one.", 409);
    }
    throw e;
  }
}

export async function cancelOrderAsOwner(userId: string, orderId: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
    await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
    return transitionOrder(tx, orderId, "CANCELLED", { actorId: userId, reason: "Cancelled by customer" });
  });
}

/** Lazily expires unpaid orders whose payment window has closed and releases their numbers. */
export async function expireStaleOrders() {
  const stale = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  for (const { id } of stale) {
    try {
      await db.$transaction(async (tx) => {
        await tx.payment.updateMany({ where: { orderId: id, status: "PENDING" }, data: { status: "EXPIRED" } });
        await transitionOrder(tx, id, "CANCELLED", { reason: "Payment window expired" });
      });
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
    }
  }
}

/** PAID_SANDBOX -> PROCESSING -> COMPLETED via the number provider. */
export async function fulfilOrder(orderId: string, actorId?: string | null) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { number: true } });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
  await db.$transaction((tx) => transitionOrder(tx, orderId, "PROCESSING", { actorId }));
  try {
    await getNumberProvider(order.number.provider).activate(order.number, order.reference);
  } catch (e) {
    await db.$transaction((tx) =>
      transitionOrder(tx, orderId, "FAILED", { actorId, reason: e instanceof Error ? e.message : "Provisioning failed" }),
    );
    throw new AppError("PROVISIONING_FAILED", "The provider could not activate this number", 502);
  }
  await db.$transaction((tx) => transitionOrder(tx, orderId, "COMPLETED", { actorId }));
}

/** Admin-initiated status change; COMPLETED goes through the provider like automatic fulfilment. */
export async function adminTransitionOrder(actorId: string, orderId: string, to: OrderStatus, reason?: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { number: true } });
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
  if (!canTransition(order.status, to)) {
    throw new AppError("INVALID_TRANSITION", `An order that is ${order.status} cannot move to ${to}`, 409);
  }
  if (to === "COMPLETED") {
    await getNumberProvider(order.number.provider).activate(order.number, order.reference);
  }
  return db.$transaction(async (tx) => {
    if (to === "CANCELLED" || to === "FAILED") {
      await tx.payment.updateMany({ where: { orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
    }
    return transitionOrder(tx, orderId, to, { actorId, reason: reason ?? "Changed by administrator" });
  });
}
