import { AppShell, type NavItem } from "@/components/app-shell";
import { requireUser } from "@/server/auth/session";

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "overview", exact: true },
  { href: "/dashboard/numbers", label: "Browse numbers", icon: "numbers" },
  { href: "/dashboard/orders", label: "My orders", icon: "orders" },
  { href: "/dashboard/messages", label: "Inbox (SMPP)", icon: "inbox" },
  { href: "/dashboard/payments", label: "Payments", icon: "payments" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export default async function CustomerLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  return (
    <AppShell area="app" items={NAV} user={user}>
      {children}
    </AppShell>
  );
}
