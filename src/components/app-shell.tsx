"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CreditCard,
  Hash,
  Inbox,
  Plug,
  LayoutDashboard,
  MessageSquare,
  Menu as MenuIcon,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  Users,
  X,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  numbers: Hash,
  orders: ShoppingBag,
  messages: MessageSquare,
  payments: CreditCard,
  settings: Settings,
  users: Users,
  inventory: Package,
  receipt: Receipt,
  inbox: Inbox,
  smpp: Plug,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Overview",
  numbers: "Numbers",
  orders: "Orders",
  messages: "Messages",
  inbox: "Inbox",
  smpp: "SMPP vendors",
  payments: "Payments",
  settings: "Settings",
  users: "Users",
  checkout: "Checkout",
  admin: "Admin",
  new: "New",
};

function Breadcrumbs({ root }: { root: string }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const rootParts = root.split("/").filter(Boolean);
  const crumbs = parts.slice(rootParts.length - 1).map((seg, i) => {
    const href = "/" + parts.slice(0, rootParts.length + i).join("/");
    const label = SEGMENT_LABELS[seg] ?? (i === 0 ? seg : "Details");
    return { href, label };
  });
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-[13px] text-muted-foreground">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="truncate font-medium text-foreground">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="truncate hover:text-foreground">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent-soft-foreground"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({
  area,
  items,
  user,
  children,
}: {
  area: "app" | "admin";
  items: NavItem[];
  user: { name: string; email: string; role: "USER" | "ADMIN" };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = area === "admin" ? "/admin" : "/dashboard";

  const brand = (
    <div className="flex h-14 items-center gap-2 px-4">
      <Logo href={root} />
      {area === "admin" && <Badge tone="accent">Admin</Badge>}
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex" aria-label="Primary">
        {brand}
        <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={area === "admin" ? "Admin navigation" : "Main navigation"}>
          <NavList items={items} />
        </nav>
        <div className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Sandbox environment. Numbers, payments and messages are simulated.
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:px-6">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted lg:hidden"
              aria-label="Open navigation"
              data-testid="mobile-nav-trigger"
            >
              <MenuIcon className="size-5" aria-hidden />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-md lg:hidden"
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <div className="flex items-center justify-between pr-2">
                  {brand}
                  <Dialog.Close className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted" aria-label="Close navigation">
                    <X className="size-5" aria-hidden />
                  </Dialog.Close>
                </div>
                <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Mobile navigation">
                  <NavList items={items} onNavigate={() => setOpen(false)} />
                </nav>
                <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                  Sandbox environment. Everything here is simulated.
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <div className="min-w-0 flex-1 px-1">
            <Breadcrumbs root={root} />
          </div>
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} isAdmin={user.role === "ADMIN"} area={area} />
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
