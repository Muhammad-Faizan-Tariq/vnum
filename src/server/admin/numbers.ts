import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { logActivity } from "@/server/activity";
import { LIVE_ORDER_STATUSES } from "@/server/orders/state";

export const numberInputSchema = z.object({
  e164: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Use E.164 format, e.g. +14155550123"),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/, "Use a 2-letter uppercase ISO code"),
  countryName: z.string().trim().min(2, "Enter a country name").max(60),
  region: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v : null)),
  priceCents: z.number().int("Price must be whole cents").min(1, "Price must be at least $0.01").max(1_000_000),
  serviceSlugs: z.array(z.string().min(1)).max(20),
  smsInbound: z.boolean(),
  voice: z.boolean(),
  /** RESERVED/SOLD are system-managed: accepted only to echo an unchanged value on edit. */
  status: z.enum(["AVAILABLE", "DISABLED", "RESERVED", "SOLD"]),
});
export type NumberInput = z.infer<typeof numberInputSchema>;

async function resolveServices(slugs: string[]) {
  const unique = [...new Set(slugs)];
  const services = await db.service.findMany({ where: { slug: { in: unique } } });
  if (services.length !== unique.length) {
    const known = new Set(services.map((s) => s.slug));
    throw new AppError("UNKNOWN_SERVICE", `Unknown service: ${unique.filter((s) => !known.has(s)).join(", ")}`, 422);
  }
  return services;
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createNumber(actorId: string, input: NumberInput) {
  if (input.status !== "AVAILABLE" && input.status !== "DISABLED") {
    throw new AppError("INVALID_STATUS", "New numbers can only be Available or Disabled", 422);
  }
  const services = await resolveServices(input.serviceSlugs);
  try {
    const created = await db.$transaction(async (tx) => {
      const n = await tx.virtualNumber.create({
        data: {
          e164: input.e164,
          countryCode: input.countryCode,
          countryName: input.countryName,
          region: input.region,
          priceCents: input.priceCents,
          status: input.status,
          smsInbound: input.smsInbound,
          voice: input.voice,
          provider: "demo",
          services: { create: services.map((s) => ({ serviceId: s.id })) },
        },
      });
      await logActivity(
        { actorId, action: "number.created", entityType: "VirtualNumber", entityId: n.id, metadata: { e164: n.e164 } },
        tx,
      );
      return n;
    });
    return created;
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("DUPLICATE_NUMBER", "A number with this E.164 value already exists", 409);
    throw e;
  }
}

export async function updateNumber(actorId: string, id: string, input: NumberInput) {
  const services = await resolveServices(input.serviceSlugs);
  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.virtualNumber.findUnique({ where: { id } });
      if (!current) throw new AppError("NOT_FOUND", "Number not found", 404);
      const orderCount = await tx.order.count({ where: { numberId: id } });
      const liveCount = await tx.order.count({ where: { numberId: id, status: { in: [...LIVE_ORDER_STATUSES, "COMPLETED"] } } });

      if (orderCount > 0) {
        const identityChanged =
          input.e164 !== current.e164 ||
          input.countryCode !== current.countryCode ||
          input.countryName !== current.countryName;
        if (identityChanged) {
          throw new AppError(
            "NUMBER_LOCKED",
            "This number has orders, so its E.164 value and country can no longer be changed.",
            409,
          );
        }
      }
      if (input.status !== current.status && (input.status === "RESERVED" || input.status === "SOLD")) {
        throw new AppError("INVALID_STATUS", "Reserved and Sold are set by the order flow, not manually.", 422);
      }
      const statusLocked = liveCount > 0 || current.status === "RESERVED" || current.status === "SOLD";
      const statusChanged = input.status !== current.status;
      if (statusLocked && statusChanged) {
        throw new AppError(
          "STATUS_LOCKED",
          "This number is reserved, sold or attached to an active order, so its availability is managed by the order flow.",
          409,
        );
      }
      const updated = await tx.virtualNumber.update({
        where: { id },
        data: {
          e164: input.e164,
          countryCode: input.countryCode,
          countryName: input.countryName,
          region: input.region,
          priceCents: input.priceCents,
          smsInbound: input.smsInbound,
          voice: input.voice,
          ...(statusLocked ? {} : { status: input.status }),
        },
      });
      await tx.numberService.deleteMany({ where: { numberId: id } });
      await tx.numberService.createMany({ data: services.map((s) => ({ numberId: id, serviceId: s.id })) });
      await logActivity(
        {
          actorId,
          action: "number.updated",
          entityType: "VirtualNumber",
          entityId: id,
          metadata: { priceCents: [current.priceCents, updated.priceCents], status: [current.status, updated.status] },
        },
        tx,
      );
      return updated;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("DUPLICATE_NUMBER", "A number with this E.164 value already exists", 409);
    throw e;
  }
}
