import { NextResponse } from "next/server";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { deleteVendor, updateVendor, updateVendorSchema } from "@/server/smpp/vendors";

export const PATCH = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/smpp-vendors/[id]">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  const input = await parseJson(req, updateVendorSchema);
  return NextResponse.json(await updateVendor(admin.id, id, input));
});

export const DELETE = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/smpp-vendors/[id]">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  await deleteVendor(admin.id, id);
  return NextResponse.json({ ok: true });
});
