import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, MessageSquare } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, Notice, SimulatedTag, Table, Td, Th } from "@/components/ui/primitives";
import { CheckoutSteps } from "@/components/customer/steps";
import { requireUser } from "@/server/auth/session";
import { getOrderDetail } from "@/server/customer/queries";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { formatDateTime, formatE164, formatMoney, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Order details" };

const EVENT_LABEL: Record<string, string> = {
  "order.created": "Order placed, number reserved",
  "order.paid_sandbox": "Sandbox payment confirmed",
  "order.processing": "Provisioning started",
  "order.completed": "Number activated (simulated)",
  "order.cancelled": "Order cancelled, number released",
  "order.failed": "Order failed, number released",
  "payment.started": "Payment started",
  "payment.confirmed": "Payment verified by server",
  "payment.failed": "Payment attempt failed",
  "payment.expired": "Payment window expired",
};

export default async function OrderDetailPage({ params }: PageProps<"/dashboard/orders/[id]">) {
  const user = await requireUser("/dashboard/orders");
  const { id } = await params;
  const detail = await getOrderDetail(user.id, id);
  if (!detail) notFound();
  const { order, timeline } = detail;
  const n = order.number;
  const expired = order.status === "CANCELLED" && order.payments.some((p) => p.status === "EXPIRED");
  const step = order.status === "PENDING_PAYMENT" ? 3 : 4;

  return (
    <div>
      <Link href="/dashboard/orders" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> My orders
      </Link>
      <CheckoutSteps current={step} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Order {order.reference}</p>
          <h1 className="mt-1 font-mono text-2xl font-semibold tracking-tight">{formatE164(n.e164)}</h1>
        </div>
        <div data-testid="order-status">
          <StatusBadge status={order.status} className="px-2.5 py-1 text-[13px]" />
        </div>
      </div>

      <div className="mb-6" data-testid="order-banner">
        {order.status === "COMPLETED" && (
          <Notice tone="success" title="Order confirmed. This number is yours." role="status">
            Paid in sandbox mode and provisioned by the demo provider. It is test inventory and is not active on any real network.
          </Notice>
        )}
        {(order.status === "PAID_SANDBOX" || order.status === "PROCESSING") && (
          <Notice tone="info" title="Payment received, provisioning in progress" role="status">
            An administrator completes provisioning in this environment. Refresh to see the latest status.
          </Notice>
        )}
        {order.status === "PENDING_PAYMENT" && (
          <Notice tone="warning" title="Waiting for payment" role="status">
            <Link href={`/dashboard/checkout/${order.id}`} className="font-medium text-accent underline">
              Continue to payment
            </Link>
          </Notice>
        )}
        {expired && (
          <Notice tone="warning" title="Payment window expired" role="status">
            The order was cancelled and the number went back to inventory.
          </Notice>
        )}
        {order.status === "CANCELLED" && !expired && (
          <Notice tone="info" title="Order cancelled" role="status">
            The number was released back to inventory.
          </Notice>
        )}
        {order.status === "FAILED" && (
          <Notice tone="danger" title="Order failed" role="status">
            {order.payments[0]?.failureReason ?? "Provisioning could not be completed."} Nothing was charged. You can pick another number.
          </Notice>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Payments" description="Attempts made for this order." action={<SimulatedTag />} />
            {order.payments.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">No payment has been started for this order.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {order.payments.map((p) => (
                    <tr key={p.id} data-testid="payment-row">
                      <Td className="font-mono text-xs">{p.reference}</Td>
                      <Td>
                        <span className="text-[13px]">{PAYMENT_METHODS[p.method].label} ({p.cryptoSymbol})</span>
                        <p className="text-xs text-muted-foreground">{PAYMENT_METHODS[p.method].network}</p>
                      </Td>
                      <Td>
                        <StatusBadge status={p.status} />
                        {p.failureReason && <p className="mt-1 max-w-56 text-xs text-muted-foreground">{p.failureReason}</p>}
                      </Td>
                      <Td className="text-right">
                        <span className="tabular">{formatMoney(p.amountCents)}</span>
                        <p className="font-mono text-xs text-muted-foreground tabular">{p.cryptoAmount} {p.cryptoSymbol}</p>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="History" />
            <ol className="divide-y divide-border">
              {timeline.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    {EVENT_LABEL[e.action] ?? titleCase(e.action.replace(".", "_"))}
                    {typeof (e.metadata as { reason?: unknown } | null)?.reason === "string" && (
                      <span className="block text-xs text-muted-foreground">{(e.metadata as { reason: string }).reason}</span>
                    )}
                  </span>
                  <time dateTime={e.createdAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(e.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-4" aria-label="Order summary">
          <Card>
            <CardHeader title="Summary" />
            <dl className="space-y-2.5 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Country</dt>
                <dd>{n.countryName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Placed</dt>
                <dd className="text-[13px]">{formatDateTime(order.createdAt)}</dd>
              </div>
              {order.completedAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Completed</dt>
                  <dd className="text-[13px]">{formatDateTime(order.completedAt)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Services</dt>
                <dd className="flex max-w-40 flex-wrap justify-end gap-1">
                  {n.services.map((s) => (
                    <Badge key={s.serviceId}>{s.service.name}</Badge>
                  ))}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular">{formatMoney(order.amountCents)}</dd>
              </div>
            </dl>
          </Card>
          <div className="flex flex-col gap-2">
            {order.status === "COMPLETED" && (
              <Link href="/dashboard/messages" className={buttonVariants()}>
                <MessageSquare className="size-4" aria-hidden /> Open inbox
              </Link>
            )}
            <Link href="/dashboard/numbers" className={buttonVariants({ variant: "secondary" })}>
              Browse more numbers
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
