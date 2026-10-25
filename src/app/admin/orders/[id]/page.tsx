import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, SimulatedTag, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/badge";
import { ApiActionButton } from "@/components/admin/api-action-button";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { expireStaleOrders } from "@/server/orders/service";
import { ORDER_TRANSITIONS } from "@/server/orders/state";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { formatDateTime, formatE164, formatMoney, titleCase } from "@/lib/utils";
import type { OrderStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Order · Admin" };

const ACTION: Record<OrderStatus, { label: string; destructive: boolean; description: string }> = {
  PENDING_PAYMENT: { label: "Reopen", destructive: false, description: "" },
  PAID_SANDBOX: { label: "Mark paid", destructive: false, description: "" },
  PROCESSING: { label: "Start processing", destructive: false, description: "Moves the order into provisioning." },
  COMPLETED: { label: "Complete order", destructive: false, description: "Activates the number through the provider adapter and completes the order." },
  CANCELLED: { label: "Cancel order", destructive: true, description: "The order is closed and the number returns to inventory. This cannot be undone." },
  FAILED: { label: "Mark failed", destructive: true, description: "The order is marked failed and the number returns to inventory. This cannot be undone." },
};

export default async function AdminOrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  await expireStaleOrders();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { user: true, number: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) notFound();
  const activity = await db.activityLog.findMany({
    where: { entityType: "Order", entityId: id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
  const next = ORDER_TRANSITIONS[order.status];

  return (
    <>
      <PageHeader
        title={order.reference}
        description={`Placed ${formatDateTime(order.createdAt)} · ${formatMoney(order.amountCents)}`}
        actions={<StatusBadge status={order.status} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Customer</dt><dd><Link href={`/admin/users?q=${encodeURIComponent(order.user.email)}`} className="hover:underline">{order.user.name}</Link><div className="text-[13px] text-muted-foreground">{order.user.email}</div></dd></div>
              <div><dt className="text-xs text-muted-foreground">Number</dt><dd><Link href={`/admin/numbers/${order.numberId}`} className="font-mono text-[13px] hover:underline">{formatE164(order.number.e164)}</Link><div className="text-[13px] text-muted-foreground">{order.number.countryName} · demo inventory</div></dd></div>
              <div><dt className="text-xs text-muted-foreground">Payment window ends</dt><dd className="tabular">{formatDateTime(order.expiresAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Completed</dt><dd className="tabular">{order.completedAt ? formatDateTime(order.completedAt) : "—"}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Payments" description="Simulated attempts. No real funds are involved." />
            {order.payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">The customer has not chosen a payment method yet.</p>
            ) : (
              <Table>
                <thead><tr><Th>Reference</Th><Th>Method</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {order.payments.map((p) => (
                    <tr key={p.id}>
                      <Td><Link href={`/admin/payments/${p.id}`} className="font-mono text-[13px] hover:underline">{p.reference}</Link> <SimulatedTag /></Td>
                      <Td className="whitespace-nowrap">{PAYMENT_METHODS[p.method].symbol} · {PAYMENT_METHODS[p.method].network}</Td>
                      <Td><StatusBadge status={p.status} /></Td>
                      <Td className="text-right font-mono text-[13px] tabular whitespace-nowrap">{p.cryptoAmount} {p.cryptoSymbol}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <ol className="divide-y divide-border" data-testid="order-timeline">
              {activity.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No recorded activity.</li>}
              {activity.map((a) => {
                const meta = (a.metadata ?? {}) as { reason?: string | null };
                return (
                  <li key={a.id} className="flex flex-wrap justify-between gap-x-4 px-4 py-2.5 text-sm">
                    <span><span className="font-mono text-[13px]">{a.action}</span><span className="text-muted-foreground"> · {a.actor?.name ?? "System"}{meta.reason ? ` · ${meta.reason}` : ""}</span></span>
                    <time className="text-xs text-muted-foreground tabular">{formatDateTime(a.createdAt)}</time>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Change status" description={`Currently ${titleCase(order.status)}`} />
          <div className="space-y-2 p-4" data-testid="transition-actions">
            {next.length === 0 ? (
              <Notice tone="info">This order is in a final state. No further changes are allowed.</Notice>
            ) : (
              next.map((to) => {
                const a = ACTION[to];
                return (
                  <ApiActionButton
                    key={to}
                    url={`/api/admin/orders/${order.id}/transition`}
                    body={{ to }}
                    label={a.label}
                    size="md"
                    className="w-full"
                    testId={`transition-${to}`}
                    variant={a.destructive ? "dangerOutline" : "secondary"}
                    successMessage={`Order is now ${titleCase(to)}`}
                    confirm={a.destructive || a.description ? { title: `${a.label}?`, description: a.description, confirmLabel: a.label } : undefined}
                  />
                );
              })
            )}
            <p className="pt-1 text-xs text-muted-foreground">Only transitions allowed by the state machine are offered; the server rejects anything else.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
