import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

type Client = Pick<typeof db, "activityLog">;

export function logActivity(
  entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Prisma.InputJsonValue;
  },
  client: Client = db,
) {
  return client.activityLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
    },
  });
}
