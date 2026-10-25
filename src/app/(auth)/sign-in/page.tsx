import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth-forms";
import { Notice } from "@/components/ui/primitives";
import { getCurrentUser } from "@/server/auth/session";
import { getEnv } from "@/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : undefined;
  const demo = getEnv().DEMO_MODE
    ? {
        customer: "demo@vnum.test",
        customerPassword: process.env.SEED_DEMO_PASSWORD || "Demo#Pass2025",
        admin: "admin@vnum.test",
        adminPassword: process.env.SEED_ADMIN_PASSWORD || "Admin#Demo2025",
      }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">Use your VNum sandbox account.</p>
      {sp.signedOut && (
        <Notice tone="success" className="mb-4" role="status">
          You have been signed out.
        </Notice>
      )}
      <SignInForm next={next} demo={demo} />
    </div>
  );
}
