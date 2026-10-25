import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Hash, MessageSquare, ShoppingBag } from "lucide-react";
import { GreetingCard } from "@/components/greeting-card";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, Notice, Table, Td, Th } from "@/components/ui/primitives";
import { Countdown } from "@/components/customer/forms";
import { requireUser } from "@/server/auth/session";
import { getOverview } from "@/server/customer/queries";
import { getSettings } from "@/server/settings";
import { formatDateTime, formatE164, formatMoney, timeAgo, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

const ACTIVITY_LABEL: Record<string, string> = {
  "order.created": "Order placed",
  "order.pending_payment": "Order placed",
  "order.paid_sandbox": "Sandbox payment received",
  "order.processing": "Number being provisioned",
  "order.completed": "Order completed",
  "order.cancelled": "Order cancelled",
  "order.failed": "Order failed",
  "payment.started": "Payment started",
  "payment.confirmed": "Payment confirmed (simulated)",
  "payment.failed": "Payment attempt failed",
  "payment.expired": "Payment expired",
  "message.submitted": "Test message submitted",
  "message.rejected": "Test message rejected",
  "message.inbound_simulated": "Inbound SMS simulated",
  "user.registered": "Account created",
  "user.profile_updated": "Profile updated",
  "user.password_changed": "Password changed",
};

export default async function OverviewPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const sp = await searchParams;
  const [data, settings] = await Promise.all([getOverview(user.id), getSettings()]);
  const stats = [
    { label: "Test numbers available", value: data.availableNumbers, href: "/dashboard/numbers", hint: "In demo inventory" },
    { label: "Active orders", value: data.activeOrders, href: "/dashboard/orders?view=active", hint: "Awaiting payment or provisioning" },
    { label: "Completed orders", value: data.completedOrders, href: "/dashboard/orders?view=completed", hint: "Numbers you own" },
  ];

  return (
    <div className="space-y-6">
      {sp.notice === "admin-only" && (
        <Notice tone="warning" title="Administrators only" role="status">
          Your account doesn&apos;t have access to the admin console.
        </Notice>
      )}
      <GreetingCard name={user.name} fallback={settings.weatherFallback} context="Customer overview" />

      {data.pendingOrder && (
        <Notice tone="warning" title="You have an order waiting for payment" role="status">
          {formatE164(data.pendingOrder.number.e164)} is reserved for you for another{" "}
          <Countdown to={data.pendingOrder.expiresAt.toISOString()} />.{" "}
          <Link href={`/dashboard/checkout/${data.pendingOrder.id}`} className="font-medium text-accent underline">
            Continue to payment
          </Link>
        </Notice>
      )}

      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group bg-surface p-4 transition-colors hover:bg-surface-muted">
            <dt className="text-[13px] text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight tabular" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
              {s.value}
            </dd>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
          </Link>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader
            title="Recent orders"
            action={
              <Link href="/dashboard/orders" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {data.recentOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No orders yet"
              description="Pick a demo number from the inventory to run through the sandbox checkout."
              action={
                <Link href="/dashboard/numbers" className={buttonVariants({ size: "sm" })}>
                  Browse numbers
                </Link>
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th className="hidden sm:table-cell">Reference</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-muted/50">
                    <Td>
                      <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-[13px] font-medium hover:text-accent hover:underline">
                        {formatE164(o.number.e164)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{o.number.countryName}</p>
                    </Td>
                    <Td className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{o.reference}</Td>
                    <Td>
                      <StatusBadge status={o.status} />
                    </Td>
                    <Td className="text-right tabular">{formatMoney(o.amountCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid gap-px bg-border">
              {[
                { href: "/dashboard/numbers", icon: Hash, title: "Browse numbers", body: "Search the demo inventory" },
                { href: "/dashboard/orders", icon: ShoppingBag, title: "View orders", body: "Track status and payments" },
                { href: "/dashboard/messages", icon: MessageSquare, title: "Test messaging", body: "Send via the SMPP simulator" },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="flex items-center gap-3 bg-surface px-4 py-3 transition-colors first:rounded-t-none hover:bg-surface-muted">
                  <a.icon className="size-[18px] text-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="block text-xs text-muted-foreground">{a.body}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent activity" />
            {data.activity.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing yet. Activity appears here as you use VNum.</p>
            ) : (
              <ol className="divide-y divide-border">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <span>{ACTIVITY_LABEL[a.action] ?? titleCase(a.action.replace(".", "_"))}</span>
                    <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)} className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(a.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
