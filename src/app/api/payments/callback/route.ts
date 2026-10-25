import { NextResponse } from "next/server";
import { apiHandler } from "@/server/auth/api";
import { AppError } from "@/server/errors";
import { paymentEventSchema, paymentProvider } from "@/server/payments/provider";
import { handlePaymentEvent } from "@/server/payments/service";

/** Provider-style webhook for the simulated payment adapter. Authenticated by HMAC, not by session. */
export const POST = apiHandler(async (req: Request) => {
  const raw = await req.text();
  if (!paymentProvider.verifyCallback(raw, req.headers.get("x-vnum-signature"))) {
    throw new AppError("BAD_SIGNATURE", "Invalid callback signature", 401);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AppError("INVALID_JSON", "Body must be valid JSON", 400);
  }
  const event = paymentEventSchema.parse(json);
  const result = await handlePaymentEvent(event, "callback");
  return NextResponse.json(result);
});
