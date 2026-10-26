import { NextResponse } from "next/server";
import { apiHandler, authorizeApi } from "@/server/auth/api";
import { requestReconnect } from "@/server/smpp/vendors";

/** Asks the worker to drop and re-establish this vendor's bind; the outcome shows up in the vendor's status. */
export const POST = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/smpp-vendors/[id]/test">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  await requestReconnect(admin.id, id);
  return NextResponse.json({ ok: true });
});
