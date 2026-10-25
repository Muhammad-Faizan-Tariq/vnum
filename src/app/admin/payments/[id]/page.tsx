import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, Notice, PageHeader, SimulatedTag, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/badge";
import { ApiActionButton } from "@/components/admin/api-action-button";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { formatDateTime, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment · Admin" };

const SCENARIOS = [
  { scenario: "confirm", label: "Simulate confirmation", note: "Network reports the full amount." },
  { scenario: "underpay", label: "Simulate underpayment", note: "Network reports half the amount." },
  { scenario: "fail", label: "Simulate failure", note: "Network reports a failure." },
  { scenario: "expire", label: "Simulate expiry", note: "Payment window closes; the order is cancelled." },
] as const;

export default async function AdminPaymentDetailPage({ params }: PageProps<"/admin/payments/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const payment = await db.payment.findUnique({
    where: { id },
    include: { order: { include: { user: true, number: true } }, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!payment) notFound();
  const m = PAYMENT_METHODS[payment.method];

  return (
    <>
      <PageHeader
        title={payment.reference}
        description={`${m.label} on ${m.network}`}
        actions={
          <>
            <SimulatedTag label="Simulated payment" />
            <StatusBadge status={payment.status} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Order</dt><dd><Link href={`/admin/orders/${payment.order.id}`} className="font-mono text-[13px] hover:underline">{payment.order.reference}</Link> <StatusBadge status={payment.order.status} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Customer</dt><dd>{payment.order.user.name}<div className="text-[13px] text-muted-foreground">{payment.order.user.email}</div></dd></div>
              <div><dt className="text-xs text-muted-foreground">Order amount</dt><dd className="font-mono tabular">{formatMoney(payment.amountCents)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Simulated crypto amount</dt><dd className="font-mono tabular">{payment.cryptoAmount} {payment.cryptoSymbol}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Placeholder deposit address (not a real address)</dt><dd className="font-mono text-[13px] break-all">{payment.depositAddress}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Expires</dt><dd className="tabular">{formatDateTime(payment.expiresAt)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Confirmed</dt><dd className="tabular">{payment.confirmedAt ? formatDateTime(payment.confirmedAt) : "—"}</dd></div>
              {payment.failureReason && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Failure reason</dt><dd>{payment.failureReason}</dd></div>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Provider events" description="Callbacks received by the server. Each event id is processed once." />
            {payment.events.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No events recorded for this payment.</p>
            ) : (
              <Table data-testid="events-table">
                <thead><tr><Th>Event</Th><Th>Type</Th><Th>Outcome</Th><Th>Received</Th></tr></thead>
                <tbody>
                  {payment.events.map((e) => (
                    <tr key={e.id}>
                      <Td className="font-mono text-xs break-all">{e.eventId}</Td>
                      <Td className="font-mono text-[13px] whitespace-nowrap">{e.type}</Td>
                      <Td className="text-[13px]">{e.outcome}</Td>
                      <Td className="text-[13px] whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Demo scenarios" description="Demo only. Plays the part of the payment network." />
          <div className="space-y-3 p-4">
            {payment.status !== "PENDING" ? (
              <Notice tone="info">Scenarios are only available while a payment is pending. This one is {payment.status.toLowerCase()}.</Notice>
            ) : (
              SCENARIOS.map((s) => (
                <div key={s.scenario}>
                  <ApiActionButton
                    url={`/api/admin/payments/${payment.id}/scenario`}
                    body={{ scenario: s.scenario }}
                    label={s.label}
                    size="md"
                    className="w-full"
                    testId={`scenario-${s.scenario}`}
                    variant={s.scenario === "confirm" ? "primary" : "secondary"}
                    successMessage={`${s.label}: applied`}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
