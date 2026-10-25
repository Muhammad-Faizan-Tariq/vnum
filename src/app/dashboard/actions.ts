"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { requireUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { cancelOrderAsOwner, createOrder } from "@/server/orders/service";
import { runPaymentScenario, startPayment, type Scenario } from "@/server/payments/service";
import { inboundSchema, simulateInbound } from "@/server/messaging/service";
import { signUpSchema } from "@/server/auth/service";
import { logActivity } from "@/server/activity";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import type { PaymentMethod } from "@/generated/prisma/enums";

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fields?: Record<string, string>;
  /** SMPP-style status code for messaging diagnostics. */
  code?: string;
};

function fieldErrors(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}

export async function createOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/numbers");
  const parsed = z
    .object({ numberId: z.string().min(1), key: z.string().min(8).max(80) })
    .safeParse({ numberId: formData.get("numberId"), key: formData.get("key") });
  if (!parsed.success) return { error: "That request was not valid. Reload the page and try again." };
  let orderId: string;
  try {
    ({ order: { id: orderId } } = await createOrder(user.id, parsed.data.numberId, parsed.data.key));
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, code: e.code };
    throw e;
  }
  redirect(`/dashboard/checkout/${orderId}`);
}

export async function startPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/orders");
  const orderId = String(formData.get("orderId") ?? "");
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  if (!(method in PAYMENT_METHODS)) return { error: "Choose a payment method to continue.", fields: { method: "Required" } };
  try {
    await startPayment(user.id, orderId, method);
  } catch (e) {
    if (e instanceof AppError) {
      if (e.code === "ORDER_NOT_PAYABLE" || e.code === "NOT_FOUND") redirect(`/dashboard/orders/${orderId}`);
      return { error: e.message };
    }
    throw e;
  }
  revalidatePath(`/dashboard/checkout/${orderId}`);
  return { ok: true };
}

export async function simulatePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/orders");
  const paymentId = String(formData.get("paymentId") ?? "");
  const scenario = String(formData.get("scenario") ?? "") as Scenario;
  if (!["confirm", "underpay", "fail", "expire"].includes(scenario)) return { error: "Unknown scenario" };
  // Ownership check: customers may only drive their own payments.
  const payment = await db.payment.findFirst({ where: { id: paymentId, order: { userId: user.id } } });
  if (!payment) return { error: "Payment not found" };
  const orderId = payment.orderId;
  try {
    const r = await runPaymentScenario(paymentId, scenario, `customer:${user.id}`);
    if (r.result === "ignored") return { error: r.detail };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/dashboard/checkout/${orderId}`);
  const fresh = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (fresh.status === "CONFIRMED" || fresh.status === "EXPIRED") redirect(`/dashboard/orders/${orderId}?from=checkout`);
  return { ok: false, error: fresh.failureReason ?? "The payment attempt failed.", code: fresh.status };
}

export async function cancelOrderAction(formData: FormData) {
  const user = await requireUser("/dashboard/orders");
  const orderId = String(formData.get("orderId") ?? "");
  try {
    await cancelOrderAsOwner(user.id, orderId);
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
  }
  redirect(`/dashboard/orders/${orderId}`);
}

export async function simulateInboundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/messages");
  const parsed = inboundSchema.safeParse({ numberId: formData.get("numberId"), from: formData.get("from") || undefined, body: formData.get("body") || undefined });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  try {
    await simulateInbound(user.id, parsed.data);
    revalidatePath("/dashboard/messages");
    return { ok: true, message: "Simulated inbound message delivered to your number." };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, code: e.code };
    throw e;
  }
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/settings");
  const parsed = signUpSchema.shape.name.safeParse(formData.get("name"));
  if (!parsed.success) return { fields: { name: parsed.error.issues[0].message } };
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data } });
  await logActivity({ actorId: user.id, action: "user.profile_updated", entityType: "User", entityId: user.id });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/settings");
  const current = String(formData.get("current") ?? "");
  const next = signUpSchema.shape.password.safeParse(formData.get("next"));
  if (!next.success) return { fields: { next: next.error.issues[0].message } };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) return { fields: { current: "Current password is incorrect" } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next.data) } });
  await logActivity({ actorId: user.id, action: "user.password_changed", entityType: "User", entityId: user.id });
  return { ok: true, message: "Password changed." };
}
