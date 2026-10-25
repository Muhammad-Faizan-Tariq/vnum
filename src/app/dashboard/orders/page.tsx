import type { Metadata } from "next";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Card, EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { listOrders, ORDERS_PAGE_SIZE, parseOrderFilters } from "@/server/customer/queries";
import { cn, formatDateTime, formatE164, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "My orders" };

const VIEWS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Cancelled / failed" },
] as const;

export default async function OrdersPage({ searchParams }: PageProps<"/dashboard/orders">) {
  const user = await requireUser("/dashboard/orders");
  const f = parseOrderFilters(await searchParams);
  const { items, total, pages, tabs } = await listOrders(user.id, f);
  const page = Math.min(f.page, pages);
  const tabHref = (view: string) => {
    const sp = new URLSearchParams();
    if (view !== "all") sp.set("view", view);
    if (f.q) sp.set("q", f.q);
    const s = sp.toString();
    return s ? `/dashboard/orders?${s}` : "/dashboard/orders";
  };

  return (
    <div>
      <PageHeader
        title="My orders"
        description="Every sandbox order with its payment and provisioning status."
        actions={
          <Link href="/dashboard/numbers" className={buttonVariants({ size: "sm" })}>
            Browse numbers
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Order views" className="flex gap-1 overflow-x-auto rounded-md border border-border bg-surface p-0.5">
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              href={tabHref(v.id)}
              aria-current={f.view === v.id ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-medium whitespace-nowrap",
                f.view === v.id ? "bg-accent-soft text-accent-soft-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
              <span className="tabular text-xs opacity-70">{tabs[v.id]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" role="search" className="flex items-center gap-2">
          {f.view !== "all" && <input type="hidden" name="view" value={f.view} />}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" type="search" defaultValue={f.q} placeholder="Reference or number" aria-label="Search orders" className="h-8 w-52 pl-8 text-[13px]" />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
      </div>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={f.q || f.view !== "all" ? "No orders match" : "You haven't ordered a number yet"}
            description={
              f.q || f.view !== "all"
                ? "Try another view or search term."
                : "Choose a demo number and run through the sandbox checkout. It takes under a minute."
            }
            action={
              f.q || f.view !== "all" ? (
                <Link href="/dashboard/orders" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Show all orders
                </Link>
              ) : (
                <Link href="/dashboard/numbers" className={buttonVariants({ size: "sm" })}>
                  Browse numbers
                </Link>
              )
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">Your orders</caption>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th className="hidden sm:table-cell">Reference</Th>
                <Th className="hidden md:table-cell">Placed</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="hover:bg-surface-muted/50" data-testid="order-row">
                  <Td>
                    <Link href={`/dashboard/orders/${o.id}`} className="font-mono text-[13px] font-medium hover:text-accent hover:underline">
                      {formatE164(o.number.e164)}
                    </Link>
                    <p className="text-xs text-muted-foreground">{o.number.countryName}</p>
                  </Td>
                  <Td className="hidden font-mono text-xs text-muted-foreground sm:table-cell">{o.reference}</Td>
                  <Td className="hidden text-[13px] text-muted-foreground md:table-cell">{formatDateTime(o.createdAt)}</Td>
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
      {total > 0 && (
        <Pagination page={page} pages={pages} total={total} pageSize={ORDERS_PAGE_SIZE} basePath="/dashboard/orders" params={{ view: f.view === "all" ? undefined : f.view, q: f.q }} />
      )}
    </div>
  );
}
