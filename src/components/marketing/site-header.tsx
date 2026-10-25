"use client";

import Link from "next/link";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { buttonVariants } from "@/components/ui/button";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" data-testid="marketing-nav" className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <ThemeToggle />
          <Link href="/sign-in" className={buttonVariants({ variant: "ghost" }, "hidden md:inline-flex")}>
            Sign in
          </Link>
          <Link href="/sign-up" className={buttonVariants({ size: "md" }, "hidden sm:inline-flex")}>
            Get started
          </Link>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted md:hidden"
              aria-label="Open menu"
              data-testid="marketing-menu-trigger"
            >
              <Menu className="size-5" aria-hidden />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 md:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-x-0 top-0 z-50 flex max-h-dvh flex-col border-b border-border bg-surface shadow-md md:hidden"
              >
                <Dialog.Title className="sr-only">Site menu</Dialog.Title>
                <div className="flex h-14 items-center justify-between px-4">
                  <Logo />
                  <Dialog.Close
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted"
                    aria-label="Close menu"
                  >
                    <X className="size-5" aria-hidden />
                  </Dialog.Close>
                </div>
                <nav aria-label="Mobile" className="overflow-y-auto px-4 pb-2">
                  <ul className="divide-y divide-border border-y border-border">
                    {LINKS.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between py-3.5 text-base font-medium"
                        >
                          {l.label}
                          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="grid grid-cols-2 gap-2 p-4">
                  <Link href="/sign-in" onClick={() => setOpen(false)} className={buttonVariants({ variant: "secondary", size: "lg" })}>
                    Sign in
                  </Link>
                  <Link href="/sign-up" onClick={() => setOpen(false)} className={buttonVariants({ size: "lg" })}>
                    Get started
                  </Link>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
