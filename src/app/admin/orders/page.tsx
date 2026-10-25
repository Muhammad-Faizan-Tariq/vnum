import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/primitives";
import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { expireStaleOrders } from "@/server/orders/service";
import { ADMIN_PAGE_SIZE, one, oneOf, pageOf } from "@/server/admin/params";
import { formatDateTime, formatE164, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders · Admin" };

const STATUSES = ["PENDING_PAYMENT", "PAID_SANDBOX", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"] as const;
const LABEL: Record<string, string> = { PENDING_PAYMENT: "Pending payment", PAID_SANDBOX: "Paid (sandbox)", PROCESSING: "Processing", COMPLETED: "Completed", CANCELLED: "Cancelled", FAILED: "Failed" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  await expireStaleOrders();
  const sp = await searchParams;
  const q = one(sp, "q");
  const status = oneOf(sp, "status", STATUSES);
  const page = pageOf(sp);
  const digits = q?.replace(/[^\d]/g, "");

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            ...(digits && digits.length >= 3 ? [{ number: { e164: { contains: digits } } }] : []),
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { user: { select: { name: true, email: true } }, number: { select: { e164: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <>
      <PageHeader title="Orders" description="All customer orders. Status changes follow the order state machine and are validated on the server." />
      <FilterBar action="/admin/orders">
        <SearchField value={q} label="Search" placeholder="Reference, customer or number" />
        <SelectField name="status" label="Status" value={status} options={STATUSES.map((s) => ({ value: s, label: LABEL[s] }))} />
      </FilterBar>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="No orders match" description="Adjust the search or status filter." action={<Link href="/admin/orders" className={buttonVariants({ variant: "secondary" })}>Clear filters</Link>} />
        ) : (
          <Table data-testid="orders-table">
            <thead>
              <tr><Th>Reference</Th><Th>Customer</Th><Th>Number</Th><Th>Status</Th><Th className="text-right">Amount</Th><Th>Created</Th></tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-surface-muted/40">
                  <Td><Link href={`/admin/orders/${o.id}`} className="font-mono text-[13px] font-medium hover:underline">{o.reference}</Link></Td>
                  <Td>
                    <div className="whitespace-nowrap">{o.user.name}</div>
                    <div className="text-xs text-muted-foreground">{o.user.email}</div>
                  </Td>
                  <Td className="font-mono text-[13px] whitespace-nowrap">{formatE164(o.number.e164)}</Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td className="text-right font-mono tabular">{formatMoney(o.amountCents)}</Td>
                  <Td className="text-[13px] whitespace-nowrap text-muted-foreground">{formatDateTime(o.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {rows.length > 0 && <Pagination page={page} pages={pages} total={total} pageSize={ADMIN_PAGE_SIZE} basePath="/admin/orders" params={{ q, status }} />}
    </>
  );
}
