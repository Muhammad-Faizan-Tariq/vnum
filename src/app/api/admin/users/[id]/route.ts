import { NextResponse } from "next/server";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { updateUserAccount, userPatchSchema } from "@/server/admin/users";

export const PATCH = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  const patch = await parseJson(req, userPatchSchema);
  const user = await updateUserAccount(admin.id, id, patch);
  return NextResponse.json({ id: user.id, role: user.role, status: user.status });
});
