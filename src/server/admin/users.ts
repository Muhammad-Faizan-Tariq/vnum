import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { logActivity } from "@/server/activity";

export const userPatchSchema = z
  .object({ role: z.enum(["USER", "ADMIN"]).optional(), status: z.enum(["ACTIVE", "SUSPENDED"]).optional() })
  .refine((v) => v.role !== undefined || v.status !== undefined, "Provide a role or status");

export async function updateUserAccount(actorId: string, userId: string, patch: z.infer<typeof userPatchSchema>) {
  if (actorId === userId) {
    throw new AppError("SELF_CHANGE", "You cannot change your own role or status.", 409);
  }
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("NOT_FOUND", "User not found", 404);

    const losesAdmin =
      user.role === "ADMIN" &&
      user.status === "ACTIVE" &&
      ((patch.role && patch.role !== "ADMIN") || (patch.status && patch.status !== "ACTIVE"));
    if (losesAdmin) {
      const others = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE", id: { not: userId } } });
      if (others === 0) throw new AppError("LAST_ADMIN", "At least one active administrator must remain.", 409);
    }
    const updated = await tx.user.update({ where: { id: userId }, data: { role: patch.role, status: patch.status } });
    if (patch.status === "SUSPENDED") await tx.session.deleteMany({ where: { userId } });
    await logActivity(
      {
        actorId,
        action: "user.updated",
        entityType: "User",
        entityId: userId,
        metadata: { role: [user.role, updated.role], status: [user.status, updated.status] },
      },
      tx,
    );
    return updated;
  });
}
