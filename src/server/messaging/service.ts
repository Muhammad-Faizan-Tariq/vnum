import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { logActivity } from "@/server/activity";
import { smppTransport } from "@/server/messaging/smpp";

export const inboundSchema = z.object({
  numberId: z.string().min(1, "Choose one of your numbers"),
  from: z.string().trim().min(1, "Enter a sender").max(30).default("VNUM-DEMO"),
  body: z.string().trim().min(1).max(320).optional(),
});

export async function ownedNumbers(userId: string) {
  const orders = await db.order.findMany({
    where: { userId, status: "COMPLETED" },
    include: { number: true },
    orderBy: { completedAt: "desc" },
  });
  return orders.map((o) => o.number);
}

const SAMPLE_BODIES = [
  (code: string) => `Your VNum demo verification code is ${code}. This is a simulated message.`,
  (code: string) => `${code} is your sandbox login code. Simulated inbound SMS.`,
];

/** Simulates the SMSC delivering one incoming SMS to a number the user owns. Receive-only. */
export async function simulateInbound(userId: string, input: z.infer<typeof inboundSchema>) {
  const order = await db.order.findFirst({
    where: { userId, numberId: input.numberId, status: "COMPLETED" },
    include: { number: true },
  });
  if (!order) throw new AppError("NOT_OWNER", "You can only receive on numbers you own", 403);

  const settings = await getSettings();
  const result = smppTransport.deliver(settings.smpp);
  if (!result.ok) {
    await logActivity({
      actorId: userId,
      action: "message.delivery_failed",
      entityType: "Number",
      entityId: order.numberId,
      metadata: { commandStatus: result.commandStatus },
    });
    throw new AppError(result.commandStatus, result.detail, 503);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const body = input.body ?? SAMPLE_BODIES[Math.floor(Math.random() * SAMPLE_BODIES.length)](code);
  const message = await db.message.create({
    data: {
      userId, numberId: order.numberId, orderId: order.id, direction: "INBOUND",
      fromAddress: input.from, toAddress: order.number.e164, body,
      status: "DELIVERED", deliveredAt: new Date(), commandStatus: result.commandStatus, smppMessageId: result.messageId,
    },
  });
  await logActivity({ actorId: userId, action: "message.inbound_simulated", entityType: "Message", entityId: message.id });
  return message;
}
