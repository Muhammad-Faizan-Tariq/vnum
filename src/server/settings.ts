import { z } from "zod";
import { db } from "@/server/db";

export const settingsSchema = z.object({
  /** Minutes a customer has to pay before the order expires and the number is released. */
  paymentWindowMinutes: z.number().int().min(1).max(240),
  /** When on, a confirmed sandbox payment provisions the number immediately. When off, an admin completes orders. */
  autoFulfil: z.boolean(),
  registrationOpen: z.boolean(),
  smpp: z.object({
    mode: z.enum(["online", "offline", "throttled"]),
  }),
  weatherFallback: z.object({
    label: z.string().trim().min(1).max(60),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  paymentWindowMinutes: 15,
  autoFulfil: true,
  registrationOpen: true,
  smpp: { mode: "online" },
  weatherFallback: { label: "London", latitude: 51.5072, longitude: -0.1276 },
};

const KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  const parsed = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(row?.value as object | undefined) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(next: AppSettings) {
  await db.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next },
    update: { value: next },
  });
  return next;
}
