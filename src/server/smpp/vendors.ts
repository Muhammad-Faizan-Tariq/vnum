import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { logActivity } from "@/server/activity";
import { encryptSecret } from "@/server/smpp/crypto";

const base = {
  name: z.string().trim().min(2, "Enter a name").max(60),
  host: z
    .string()
    .trim()
    .min(1, "Enter a host")
    .max(253)
    .regex(/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/, "Use a hostname or IP address, without a scheme or port"),
  port: z.coerce.number().int().min(1, "Port must be 1-65535").max(65535, "Port must be 1-65535"),
  systemId: z.string().trim().min(1, "Enter the system ID").max(16, "SMPP system IDs are at most 16 characters"),
  systemType: z.string().trim().max(13, "At most 13 characters").default(""),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
  enabled: z.boolean().default(true),
};

export const createVendorSchema = z.object({
  ...base,
  password: z.string().min(1, "Enter the password").max(32, "Password is too long"),
});

/** On update the password is optional: omitted means keep the stored one. */
export const updateVendorSchema = z.object({
  ...base,
  password: z.string().max(32, "Password is too long").optional().transform((v) => v || undefined),
});

/** Safe projection: the encrypted password never leaves the server. */
const select = {
  id: true, name: true, host: true, port: true, systemId: true, systemType: true, notes: true, enabled: true,
  linkState: true, lastError: true, lastBoundAt: true, lastSeenAt: true, lastMessageAt: true, receivedCount: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.SmppVendorSelect;

export type VendorView = Prisma.SmppVendorGetPayload<{ select: typeof select }>;

export const listVendors = () => db.smppVendor.findMany({ select, orderBy: { name: "asc" } });
export const getVendor = (id: string) => db.smppVendor.findUnique({ where: { id }, select });

function mapUnique(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new AppError("DUPLICATE_VENDOR", "A vendor with this name already exists", 409);
  }
  throw e;
}

export async function createVendor(actorId: string, input: z.infer<typeof createVendorSchema>) {
  const { password, ...rest } = input;
  try {
    const v = await db.smppVendor.create({
      data: { ...rest, passwordEnc: encryptSecret(password), linkState: rest.enabled ? "CONNECTING" : "DISABLED" },
      select,
    });
    await logActivity({ actorId, action: "smpp_vendor.created", entityType: "SmppVendor", entityId: v.id, metadata: { name: v.name, host: v.host } });
    return v;
  } catch (e) {
    return mapUnique(e);
  }
}

export async function updateVendor(actorId: string, id: string, input: z.infer<typeof updateVendorSchema>) {
  const existing = await db.smppVendor.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError("NOT_FOUND", "Vendor not found", 404);
  const { password, ...rest } = input;
  try {
    const v = await db.smppVendor.update({
      where: { id },
      data: {
        ...rest,
        ...(password ? { passwordEnc: encryptSecret(password) } : {}),
        // Any change to connection details (or enabling) makes the worker re-establish the session.
        reconnectRequestedAt: new Date(),
        ...(rest.enabled ? {} : { linkState: "DISABLED" as const }),
      },
      select,
    });
    await logActivity({ actorId, action: "smpp_vendor.updated", entityType: "SmppVendor", entityId: id, metadata: { passwordChanged: !!password } });
    return v;
  } catch (e) {
    return mapUnique(e);
  }
}

export async function deleteVendor(actorId: string, id: string) {
  const v = await db.smppVendor.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!v) throw new AppError("NOT_FOUND", "Vendor not found", 404);
  await db.smppVendor.delete({ where: { id } });
  await logActivity({ actorId, action: "smpp_vendor.deleted", entityType: "SmppVendor", entityId: id, metadata: { name: v.name } });
}

export async function requestReconnect(actorId: string, id: string) {
  const v = await db.smppVendor.findUnique({ where: { id }, select: { enabled: true } });
  if (!v) throw new AppError("NOT_FOUND", "Vendor not found", 404);
  if (!v.enabled) throw new AppError("VENDOR_DISABLED", "Enable the vendor before testing the connection", 409);
  await db.smppVendor.update({ where: { id }, data: { reconnectRequestedAt: new Date(), linkState: "CONNECTING", lastError: null } });
  await logActivity({ actorId, action: "smpp_vendor.reconnect_requested", entityType: "SmppVendor", entityId: id });
}
