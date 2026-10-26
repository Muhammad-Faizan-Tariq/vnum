import { NextResponse } from "next/server";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { createVendor, createVendorSchema } from "@/server/smpp/vendors";

export const POST = apiHandler(async (req: Request) => {
  const admin = await authorizeApi(req, { admin: true });
  const input = await parseJson(req, createVendorSchema);
  return NextResponse.json(await createVendor(admin.id, input), { status: 201 });
});
