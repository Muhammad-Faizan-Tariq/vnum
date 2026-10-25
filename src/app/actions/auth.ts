"use server";

import { redirect } from "next/navigation";
import { AppError } from "@/server/errors";
import { createSession, destroySession } from "@/server/auth/session";
import { authenticate, registerUser, signInSchema, signUpSchema } from "@/server/auth/service";

function firstIssues(e: import("zod").ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export type AuthFormState = {
  error?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
};

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : null;
}

export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fields: firstIssues(parsed.error),
      values: { email: raw.email },
    };
  }
  let destination = safeNext(formData.get("next"));
  try {
    const user = await authenticate(parsed.data);
    await createSession(user.id);
    destination ??= user.role === "ADMIN" ? "/admin" : "/dashboard";
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, values: { email: raw.email } };
    throw e;
  }
  redirect(destination);
}

export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fields: firstIssues(parsed.error),
      values: { name: raw.name, email: raw.email },
    };
  }
  try {
    const user = await registerUser(parsed.data);
    await createSession(user.id);
  } catch (e) {
    if (e instanceof AppError) {
      return {
        ...(e.code === "EMAIL_TAKEN" ? { fields: { email: e.message } } : { error: e.message }),
        values: { name: raw.name, email: raw.email },
      };
    }
    throw e;
  }
  redirect("/dashboard");
}

export async function signOutAction() {
  await destroySession();
  redirect("/sign-in?signedOut=1");
}
