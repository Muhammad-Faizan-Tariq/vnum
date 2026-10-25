import { NextResponse } from "next/server";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { createNumber, numberInputSchema } from "@/server/admin/numbers";

export const POST = apiHandler(async (req: Request) => {
  const admin = await authorizeApi(req, { admin: true });
  const input = await parseJson(req, numberInputSchema);
  const number = await createNumber(admin.id, input);
  return NextResponse.json({ id: number.id, e164: number.e164 }, { status: 201 });
});
