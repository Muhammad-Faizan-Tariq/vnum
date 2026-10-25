import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { adminTransitionOrder } from "@/server/orders/service";

const schema = z.object({
  to: z.enum(["PENDING_PAYMENT", "PAID_SANDBOX", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"]),
  reason: z.string().trim().max(200).optional(),
});

export const POST = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/orders/[id]/transition">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  const { to, reason } = await parseJson(req, schema);
  const order = await adminTransitionOrder(admin.id, id, to, reason);
  return NextResponse.json({ id: order.id, status: order.status });
});
