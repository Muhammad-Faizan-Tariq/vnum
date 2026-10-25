import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-5 py-5 sm:px-10">
      <Logo />
      <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be out of date, or the number or order you were looking for may have been removed.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/" className={buttonVariants()}>Back to home</Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>Open dashboard</Link>
        </div>
      </main>
    </div>
  );
}
