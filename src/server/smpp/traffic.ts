import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { logActivity } from "@/server/activity";
import { z } from "zod";

export type TrafficRow = {
  id: string;
  at: Date;
  source: string;
  destination: string;
  text: string;
  routed: boolean;
};

/** Everything a vendor delivered recently: stored messages plus ones for numbers nobody owns. */
export async function recentVendorTraffic(vendorId: string, take = 20): Promise<TrafficRow[]> {
  const [messages, unrouted] = await Promise.all([
    db.message.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, take }),
    db.activityLog.findMany({ where: { action: "smpp.unrouted", entityType: "SmppVendor", entityId: vendorId }, orderBy: { createdAt: "desc" }, take }),
  ]);
  const rows: TrafficRow[] = [
    ...messages.map((m) => ({ id: m.id, at: m.createdAt, source: m.fromAddress, destination: m.toAddress, text: m.body, routed: true })),
    ...unrouted.map((a) => {
      const meta = (a.metadata ?? {}) as { source?: string; destination?: string; text?: string };
      return { id: a.id, at: a.createdAt, source: meta.source ?? "?", destination: meta.destination ?? "?", text: meta.text ?? "", routed: false };
    }),
  ];
  return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

export const testMessageSchema = z.object({
  to: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Use E.164 format, e.g. +12065550153"),
  text: z.string().trim().min(1, "Write a message").max(160, "Keep it under 160 characters"),
  from: z.string().trim().min(1).max(20).default("VNUM-TEST"),
});

/**
 * Asks the built-in SMPP simulator (not a real vendor) to deliver a message. It travels the real
 * protocol: simulator -> deliver_sm -> worker -> inbox. Only available when SMPP_SIM_CONTROL_URL is set.
 */
export async function sendSimulatorTestMessage(actorId: string, vendorId: string, input: z.infer<typeof testMessageSchema>) {
  const base = process.env.SMPP_SIM_CONTROL_URL;
  if (!base) throw new AppError("SIMULATOR_NOT_CONFIGURED", "The SMPP simulator is not configured on this deployment", 409);
  const vendor = await db.smppVendor.findUnique({ where: { id: vendorId }, select: { id: true, enabled: true, linkState: true, name: true } });
  if (!vendor) throw new AppError("NOT_FOUND", "Vendor not found", 404);
  if (!vendor.enabled || vendor.linkState !== "BOUND") {
    throw new AppError("VENDOR_NOT_BOUND", "This vendor is not bound yet. Check its link status first.", 409);
  }
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/deliver`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new AppError("SIMULATOR_UNREACHABLE", "Could not reach the SMPP simulator", 502);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AppError("SIMULATOR_REJECTED", body.error ?? "The simulator did not deliver the message", 502);
  }
  await logActivity({ actorId, action: "smpp_vendor.test_message", entityType: "SmppVendor", entityId: vendorId, metadata: { to: input.to } });
}
