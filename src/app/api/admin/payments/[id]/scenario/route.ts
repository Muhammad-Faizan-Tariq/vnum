import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { runPaymentScenario } from "@/server/payments/service";

const schema = z.object({ scenario: z.enum(["confirm", "underpay", "fail", "expire"]) });

export const POST = apiHandler(async (req: Request, ctx: RouteContext<"/api/admin/payments/[id]/scenario">) => {
  const admin = await authorizeApi(req, { admin: true });
  const { id } = await ctx.params;
  const { scenario } = await parseJson(req, schema);
  const payment = await db.payment.findUnique({ where: { id }, select: { status: true } });
  if (!payment) throw new AppError("NOT_FOUND", "Payment not found", 404);
  if (payment.status !== "PENDING") {
    throw new AppError("NOT_PENDING", `Only pending payments can be driven; this one is ${payment.status}.`, 409);
  }
  const result = await runPaymentScenario(id, scenario, `admin:${admin.id}`);
  return NextResponse.json(result);
});
