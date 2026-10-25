import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, EmptyState, Notice, PageHeader, Pagination, SimulatedTag, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { listPayments, PAYMENTS_PAGE_SIZE } from "@/server/customer/queries";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { cn, formatDateTime, formatE164, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const FILTERS = [
  { id: "", label: "All" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PENDING", label: "Pending" },
  { id: "FAILED", label: "Failed" },
  { id: "EXPIRED", label: "Expired" },
] as const;

export default async function PaymentsPage({ searchParams }: PageProps<"/dashboard/payments">) {
  const user = await requireUser("/dashboard/payments");
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const { items, total, pages } = await listPayments(user.id, status || undefined, page);

  return (
    <div>
      <PageHeader title="Payments" description="Payment attempts for your orders. There is no wallet balance: each order is paid separately." />
      <Notice tone="info" title="Every payment here is simulated" className="mb-5">
        VNum&apos;s sandbox uses a mock crypto adapter. No funds move, no real transactions exist, and deposit addresses are placeholders.
      </Notice>

      <nav aria-label="Payment status" className="mb-4 flex w-fit gap-1 overflow-x-auto rounded-md border border-border bg-surface p-0.5">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id ? `/dashboard/payments?status=${f.id}` : "/dashboard/payments"}
            aria-current={status === f.id ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded px-3 text-[13px] font-medium whitespace-nowrap",
              status === f.id ? "bg-accent-soft text-accent-soft-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments yet"
            description="Payments appear here once you start checkout on an order."
            action={
              <Link href="/dashboard/numbers" className={buttonVariants({ size: "sm" })}>
                Browse numbers
              </Link>
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">Payment history</caption>
            <thead>
              <tr>
                <Th>Payment</Th>
                <Th className="hidden md:table-cell">Order</Th>
                <Th className="hidden sm:table-cell">Method</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/50" data-testid="payment-history-row">
                  <Td>
                    <span className="font-mono text-xs">{p.reference}</span>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {formatDateTime(p.createdAt)} <SimulatedTag />
                    </p>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <Link href={`/dashboard/orders/${p.orderId}`} className="font-mono text-xs hover:text-accent hover:underline">
                      {p.order.reference}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{formatE164(p.order.number.e164)}</p>
                  </Td>
                  <Td className="hidden text-[13px] sm:table-cell">
                    {PAYMENT_METHODS[p.method].label} ({p.cryptoSymbol})
                  </Td>
                  <Td>
                    <StatusBadge status={p.status} />
                    {p.failureReason && <p className="mt-1 max-w-52 text-xs text-muted-foreground">{p.failureReason}</p>}
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
      {total > 0 && <Pagination page={Math.min(page, pages)} pages={pages} total={total} pageSize={PAYMENTS_PAGE_SIZE} basePath="/dashboard/payments" params={{ status: status || undefined }} />}
    </div>
  );
}
