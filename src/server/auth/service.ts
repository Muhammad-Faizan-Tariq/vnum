import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/auth/password";
import { getSettings } from "@/server/settings";
import { logActivity } from "@/server/activity";

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/\d/, "Include at least one number"),
});

export async function authenticate(input: z.infer<typeof signInSchema>) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError("INVALID_CREDENTIALS", "Incorrect email or password", 401);
  if (user.status !== "ACTIVE") {
    throw new AppError("ACCOUNT_SUSPENDED", "This account is suspended. Contact support.", 403);
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function registerUser(input: z.infer<typeof signUpSchema>) {
  const settings = await getSettings();
  if (!settings.registrationOpen) {
    throw new AppError("REGISTRATION_CLOSED", "New registrations are currently closed", 403);
  }
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("EMAIL_TAKEN", "An account with this email already exists", 409);
  const user = await db.user.create({
    data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password), role: "USER" },
  });
  await logActivity({ actorId: user.id, action: "user.registered", entityType: "User", entityId: user.id });
  return user;
}
