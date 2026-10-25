import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is not set" })
    .min(1, "DATABASE_URL is empty")
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL must be a PostgreSQL connection string"),
  PAYMENT_WEBHOOK_SECRET: z
    .string({ error: "PAYMENT_WEBHOOK_SECRET is not set" })
    .min(16, "PAYMENT_WEBHOOK_SECRET must be at least 16 characters"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validates server-side configuration once and fails loudly with an actionable message. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`);
    throw new Error(
      `Invalid VNum configuration:\n${lines.join("\n")}\nCopy .env.example to .env and fill in the values (see README).`,
    );
  }
  cached = parsed.data;
  return cached;
}
