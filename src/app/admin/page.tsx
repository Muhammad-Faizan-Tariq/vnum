import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Hash, Receipt, Users, CreditCard, Settings } from "lucide-react";
import { GreetingCard } from "@/components/greeting-card";
import { Card, CardHeader, EmptyState, Notice } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { expireStaleOrders } from "@/server/orders/service";
import { NumberStatus, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { cn, formatDateTime, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin overview" };

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

function countMap<T extends string>(rows: { status: T; _count: { _all: number } }[]) {
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<Record<T, number>>;
}

function Stat({ label, value, href, testId }: { label: string; value: number | string; href: string; testId: string }) {
  return (
    <Link href={href} className="group flex items-baseline justify-between gap-2 px-4 py-2.5 text-sm hover:bg-surface-muted/60">
      <span className="text-muted-foreground group-hover:text-foreground">{label}</span>
      <span className="font-mono font-medium tabular" data-testid={testId}>{value}</span>
    </Link>
  );
}

const ORDER_COLORS: Record<string, string> = {
  PENDING_PAYMENT: "bg-warning",
  PAID_SANDBOX: "bg-info",
  PROCESSING: "bg-info/60",
  COMPLETED: "bg-success",
  CANCELLED: "bg-border-strong",
  FAILED: "bg-danger",
};

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  await expireStaleOrders();
  const settings = await getSettings();
  const weekAgo = daysAgo(7);

  const [numbers, orders, payments, users, suspended, badPayments, recent] = await Promise.all([
    db.virtualNumber.groupBy({ by: ["status"], _count: { _all: true } }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    db.user.count(),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.payment.findMany({
      where: { status: { in: ["FAILED", "EXPIRED"] }, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { order: { select: { reference: true } } },
    }),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true, email: true } } } }),
  ]);
  const n = countMap(numbers);
  const o = countMap(orders);
  const p = countMap(payments);
  const totalOrders = Object.values(o).reduce((a, b) => a + (b ?? 0), 0);
  const totalNumbers = Object.values(n).reduce((a, b) => a + (b ?? 0), 0);
  const waiting = (o.PAID_SANDBOX ?? 0) + (o.PROCESSING ?? 0);

  const warnings: { key: string; title: string; body: string; href: string }[] = [];
  if (badPayments.length > 0) {
    warnings.push({
      key: "payments",
      title: `${badPayments.length === 5 ? "5+" : badPayments.length} failed or expired payments in the last 7 days`,
      body: "Includes underpaid and simulated-failure attempts. Review them to confirm the error handling behaved as expected.",
      href: "/admin/payments?status=FAILED",
    });
  }
  if (waiting > 0 && !settings.autoFulfil) {
    warnings.push({
      key: "fulfil",
      title: `${waiting} paid order${waiting === 1 ? "" : "s"} waiting for an administrator`,
      body: "Automatic provisioning is off, so these will not complete until you move them forward.",
      href: "/admin/orders?status=PAID_SANDBOX",
    });
  }
  if (settings.smpp.mode !== "online") {
    warnings.push({
      key: "smpp",
      title: `SMPP simulator is ${settings.smpp.mode}`,
      body: "Customer test messages will be rejected until the link state is set back to online.",
      href: "/admin/settings",
    });
  }
  if (!settings.registrationOpen) {
    warnings.push({ key: "reg", title: "Registrations are closed", body: "New visitors cannot create accounts.", href: "/admin/settings" });
  }

  return (
    <div className="space-y-6">
      <GreetingCard name={admin.name} fallback={settings.weatherFallback} context="Admin console" />

      {warnings.length > 0 && (
        <section aria-label="Operational warnings" className="space-y-2" data-testid="warnings">
          {warnings.map((w) => (
            <Notice key={w.key} tone="warning" title={w.title}>
              {w.body}{" "}
              <Link href={w.href} className="font-medium text-foreground underline underline-offset-2">Review</Link>
            </Notice>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader title="Inventory" description={`${totalNumbers} numbers`} />
          <div className="divide-y divide-border">
            {Object.values(NumberStatus).map((s) => (
              <Stat key={s} label={titleCase(s)} value={n[s] ?? 0} href={`/admin/numbers?status=${s}`} testId={`stat-number-${s}`} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Orders" description={`${totalOrders} total`} />
          <div className="divide-y divide-border">
            {Object.values(OrderStatus).map((s) => (
              <Stat key={s} label={s === "PAID_SANDBOX" ? "Paid (sandbox)" : titleCase(s)} value={o[s] ?? 0} href={`/admin/orders?status=${s}`} testId={`stat-order-${s}`} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payments" description="Simulated attempts" />
          <div className="divide-y divide-border">
            {Object.values(PaymentStatus).map((s) => (
              <Stat key={s} label={titleCase(s)} value={p[s] ?? 0} href={`/admin/payments?status=${s}`} testId={`stat-payment-${s}`} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Users" />
          <div className="divide-y divide-border">
            <Stat label="Accounts" value={users} href="/admin/users" testId="stat-users" />
            <Stat label="Suspended" value={suspended} href="/admin/users?status=SUSPENDED" testId="stat-users-suspended" />
          </div>
          <div className="border-t border-border px-4 py-3">
            <p className="mb-1.5 text-xs text-muted-foreground">Order status mix</p>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label="Order status mix">
              {Object.values(OrderStatus).map((s) =>
                o[s] ? <div key={s} className={cn(ORDER_COLORS[s])} style={{ width: `${((o[s] ?? 0) / totalOrders) * 100}%` }} title={`${titleCase(s)}: ${o[s]}`} /> : null,
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_16rem]">
        <Card>
          <CardHeader title="Recent activity" description="Latest recorded actions across the platform" />
          {recent.length === 0 ? (
            <EmptyState icon={Receipt} title="No activity yet" description="Actions by customers and administrators will be listed here." />
          ) : (
            <ul className="divide-y divide-border" data-testid="activity-list">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono text-[13px]">{a.action}</span>
                    <span className="text-muted-foreground"> · {a.actor?.name ?? "System"}</span>
                  </span>
                  <time className="text-xs text-muted-foreground tabular" dateTime={a.createdAt.toISOString()}>{formatDateTime(a.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="Tasks" />
          <ul className="p-1.5 text-sm">
            {[
              { href: "/admin/numbers/new", label: "Add a demo number", icon: Hash },
              { href: "/admin/orders", label: "Review orders", icon: Receipt },
              { href: "/admin/users", label: "Manage users", icon: Users },
              { href: "/admin/payments", label: "Inspect payments", icon: CreditCard },
              { href: "/admin/settings", label: "Demo settings", icon: Settings },
            ].map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-surface-muted">
                  <t.icon className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{t.label}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {badPayments.length > 0 && (
        <Card>
          <CardHeader title="Failed or expired payments" description="Last 7 days, newest first" />
          <ul className="divide-y divide-border">
            {badPayments.map((pay) => (
              <li key={pay.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <Link href={`/admin/payments/${pay.id}`} className="font-mono text-[13px] hover:underline">{pay.reference}</Link>
                <span className="text-xs text-muted-foreground">{pay.order.reference}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{pay.failureReason ?? ""}</span>
                <StatusBadge status={pay.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
