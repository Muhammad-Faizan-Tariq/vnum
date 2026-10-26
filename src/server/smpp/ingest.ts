import { db } from "@/server/db";
import { logActivity } from "@/server/activity";

export type IncomingSms = {
  vendorId: string;
  source: string;
  destination: string;
  text: string;
  messageId?: string;
};

/** SMPP addresses often arrive without the "+": normalise numeric destinations to E.164. */
export function normaliseAddress(addr: string) {
  const a = addr.trim();
  return /^\+?\d{6,15}$/.test(a) ? (a.startsWith("+") ? a : `+${a}`) : a;
}

/**
 * Routes a deliver_sm from a vendor to the customer who owns the destination number.
 * Messages for numbers nobody owns are not stored; they are recorded in the activity log only.
 */
export async function ingestIncomingSms(sms: IncomingSms) {
  const destination = normaliseAddress(sms.destination);
  const order = await db.order.findFirst({
    where: { status: "COMPLETED", number: { e164: destination } },
    orderBy: { completedAt: "desc" },
  });
  if (!order) {
    await logActivity({
      action: "smpp.unrouted",
      entityType: "SmppVendor",
      entityId: sms.vendorId,
      metadata: { destination, source: sms.source, text: sms.text.slice(0, 160) },
    });
    return { routed: false as const };
  }
  const message = await db.message.create({
    data: {
      userId: order.userId,
      numberId: order.numberId,
      orderId: order.id,
      vendorId: sms.vendorId,
      direction: "INBOUND",
      fromAddress: normaliseAddress(sms.source),
      toAddress: destination,
      body: sms.text.slice(0, 1000),
      status: "DELIVERED",
      deliveredAt: new Date(),
      commandStatus: "DELIVER_SM",
      smppMessageId: sms.messageId ?? null,
    },
  });
  await db.smppVendor.updateMany({
    where: { id: sms.vendorId },
    data: { lastMessageAt: new Date(), receivedCount: { increment: 1 } },
  });
  return { routed: true as const, messageId: message.id };
}
