import { NextResponse } from "next/server";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { sendSimulatorTestMessage, testMessageSchema } from "@/server/smpp/traffic";

/** Simulator-only: makes the built-in SMSC deliver a test SMS over real SMPP. VNum itself never sends. */
export const POST = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/smpp-vendors/[id]/test-message">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  const input = await parseJson(req, testMessageSchema);
  await sendSimulatorTestMessage(admin.id, id, input);
  return NextResponse.json({ ok: true });
});
