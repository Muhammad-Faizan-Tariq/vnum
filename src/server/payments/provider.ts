import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

export const paymentEventSchema = z.object({
  /** Unique per provider event. Replays with the same id are ignored. */
  eventId: z.string().min(8).max(100),
  paymentReference: z.string().min(1).max(40),
  type: z.enum(["payment.confirmed", "payment.failed", "payment.expired"]),
  /** Crypto amount the provider says it received (decimal string). */
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/).optional(),
  reason: z.string().max(200).optional(),
});
export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export type Charge = { cryptoAmount: string; cryptoSymbol: string; depositAddress: string };

/**
 * Payments are isolated behind this interface. Only the mock adapter ships. A real sandbox
 * provider (e.g. a crypto processor's test mode) would implement createCharge and verifyCallback
 * against its API and signature scheme, and the rest of the app would not change.
 */
export interface PaymentProvider {
  readonly id: string;
  readonly simulated: boolean;
  createCharge(input: { amountCents: number; method: PaymentMethod; reference: string }): Charge;
  /** Returns true only when `signature` authenticates the raw callback body. */
  verifyCallback(rawBody: string, signature: string | null): boolean;
  sign(rawBody: string): string;
}

function secret() {
  const s = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!s || s.length < 16) throw new Error("PAYMENT_WEBHOOK_SECRET is not configured");
  return s;
}

class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock-crypto";
  readonly simulated = true;

  createCharge({ amountCents, method, reference }: { amountCents: number; method: PaymentMethod; reference: string }): Charge {
    const info = PAYMENT_METHODS[method];
    const amount = (amountCents / 100 / info.rateUsd).toFixed(info.decimals);
    const digest = createHash("sha256").update(`${reference}:${method}`).digest("hex");
    // The SIM- prefix keeps this obviously unusable on any real network.
    return { cryptoAmount: amount, cryptoSymbol: info.symbol, depositAddress: `SIM-${digest.slice(0, 32)}` };
  }

  sign(rawBody: string) {
    return createHmac("sha256", secret()).update(rawBody).digest("hex");
  }

  verifyCallback(rawBody: string, signature: string | null) {
    if (!signature) return false;
    const expected = Buffer.from(this.sign(rawBody), "hex");
    let given: Buffer;
    try {
      given = Buffer.from(signature, "hex");
    } catch {
      return false;
    }
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
