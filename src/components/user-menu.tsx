"use client";

import Link from "next/link";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

const item =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-surface-muted";

export function UserMenu({ name, email, isAdmin, area }: { name: string; email: string; isAdmin: boolean; area: "app" | "admin" }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <Menu.Root>
      <Menu.Trigger
        data-testid="user-menu"
        className="flex h-9 items-center gap-2 rounded-md pr-1.5 pl-1 text-sm hover:bg-surface-muted data-[state=open]:bg-surface-muted"
        aria-label={`Account menu for ${name}`}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-foreground">
          {initials}
        </span>
        <span className="hidden max-w-32 truncate font-medium sm:block">{name}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-60 rounded-lg border border-border bg-surface p-1 shadow-md"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-[13px] text-muted-foreground">{email}</p>
          </div>
          <Menu.Separator className="my-1 h-px bg-border" />
          {area === "admin" ? (
            <Menu.Item asChild>
              <Link href="/dashboard" className={item}>
                <LayoutDashboard className="size-4 text-muted-foreground" aria-hidden /> Customer app
              </Link>
            </Menu.Item>
          ) : (
            <>
              <Menu.Item asChild>
                <Link href="/dashboard/settings" className={item}>
                  <Settings className="size-4 text-muted-foreground" aria-hidden /> Settings
                </Link>
              </Menu.Item>
              {isAdmin && (
                <Menu.Item asChild>
                  <Link href="/admin" className={item}>
                    <ShieldCheck className="size-4 text-muted-foreground" aria-hidden /> Admin console
                  </Link>
                </Menu.Item>
              )}
            </>
          )}
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item className={`${item} w-full`} data-testid="sign-out" onSelect={() => void signOutAction()}>
            <LogOut className="size-4 text-muted-foreground" aria-hidden /> Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
