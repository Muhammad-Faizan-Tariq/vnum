import { NextResponse } from "next/server";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { numberInputSchema, updateNumber } from "@/server/admin/numbers";

export const PATCH = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/numbers/[id]">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  const input = await parseJson(req, numberInputSchema);
  const number = await updateNumber(admin.id, id, input);
  return NextResponse.json({ id: number.id, e164: number.e164, status: number.status });
});
