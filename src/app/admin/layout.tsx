import { AppShell, type NavItem } from "@/components/app-shell";
import { requireAdmin } from "@/server/auth/session";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/numbers", label: "Numbers", icon: "inventory" },
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/payments", label: "Payments", icon: "payments" },
  { href: "/admin/smpp", label: "SMPP vendors", icon: "smpp" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <AppShell area="admin" items={NAV} user={user}>
      {children}
    </AppShell>
  );
}
