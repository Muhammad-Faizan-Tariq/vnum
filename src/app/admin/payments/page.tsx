import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, EmptyState, Notice, PageHeader, Pagination, SimulatedTag, Table, Td, Th } from "@/components/ui/primitives";
import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ADMIN_PAGE_SIZE, one, oneOf, pageOf } from "@/server/admin/params";
import { PAYMENT_METHODS, PAYMENT_METHOD_LIST } from "@/lib/payment-methods";
import { formatDateTime, formatMoney, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments · Admin" };

const STATUSES = ["PENDING", "CONFIRMED", "EXPIRED", "FAILED", "CANCELLED"] as const;
const METHODS = ["BTC_SIM", "USDT_TRC20_SIM", "USDT_ERC20_SIM"] as const;

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp, "q");
  const status = oneOf(sp, "status", STATUSES);
  const method = oneOf(sp, "method", METHODS);
  const page = pageOf(sp);

  const where: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { order: { reference: { contains: q, mode: "insensitive" } } },
            { order: { user: { email: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { order: { select: { id: true, reference: true, user: { select: { email: true } } } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <>
      <PageHeader title="Payments" description="Simulated crypto payment attempts for sandbox orders." />
      <Notice tone="info" className="mb-4" title="Every record here is simulated">
        The sandbox payment adapter generates amounts, addresses and confirmations. No funds move and nothing touches a blockchain.
      </Notice>
      <FilterBar action="/admin/payments">
        <SearchField value={q} label="Search" placeholder="Payment, order or customer email" />
        <SelectField name="status" label="Status" value={status} options={STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} />
        <SelectField name="method" label="Method" value={method} options={PAYMENT_METHOD_LIST.map((m) => ({ value: m.id, label: `${m.symbol} · ${m.network}` }))} />
      </FilterBar>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments match" description="Adjust the search or filters." action={<Link href="/admin/payments" className={buttonVariants({ variant: "secondary" })}>Clear filters</Link>} />
        ) : (
          <Table data-testid="payments-table">
            <thead>
              <tr><Th>Payment</Th><Th>Order</Th><Th>Method</Th><Th>Status</Th><Th className="text-right">Amount</Th><Th>Created</Th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/40">
                  <Td className="whitespace-nowrap">
                    <Link href={`/admin/payments/${p.id}`} className="font-mono text-[13px] font-medium hover:underline">{p.reference}</Link> <SimulatedTag />
                  </Td>
                  <Td>
                    <Link href={`/admin/orders/${p.order.id}`} className="font-mono text-[13px] hover:underline">{p.order.reference}</Link>
                    <div className="text-xs text-muted-foreground">{p.order.user.email}</div>
                  </Td>
                  <Td className="whitespace-nowrap">{PAYMENT_METHODS[p.method].symbol} <span className="text-xs text-muted-foreground">{PAYMENT_METHODS[p.method].network}</span></Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="font-mono tabular">{formatMoney(p.amountCents)}</div>
                    <div className="font-mono text-xs text-muted-foreground tabular">{p.cryptoAmount} {p.cryptoSymbol}</div>
                  </Td>
                  <Td className="text-[13px] whitespace-nowrap text-muted-foreground">{formatDateTime(p.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {rows.length > 0 && <Pagination page={page} pages={pages} total={total} pageSize={ADMIN_PAGE_SIZE} basePath="/admin/payments" params={{ q, status, method }} />}
    </>
  );
}
