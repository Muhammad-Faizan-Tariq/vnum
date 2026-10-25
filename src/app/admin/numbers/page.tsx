import type { Metadata } from "next";
import Link from "next/link";
import { Hash, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/primitives";
import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ADMIN_PAGE_SIZE, one, oneOf, pageOf } from "@/server/admin/params";
import { formatE164, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Numbers · Admin" };

const STATUSES = ["AVAILABLE", "RESERVED", "SOLD", "DISABLED"] as const;
const SORTS = {
  newest: [{ createdAt: "desc" }],
  price_asc: [{ priceCents: "asc" }],
  price_desc: [{ priceCents: "desc" }],
  country: [{ countryName: "asc" }, { e164: "asc" }],
} as const satisfies Record<string, Prisma.VirtualNumberOrderByWithRelationInput[]>;

export default async function AdminNumbersPage({ searchParams }: PageProps<"/admin/numbers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = one(sp, "q");
  const country = one(sp, "country");
  const service = one(sp, "service");
  const status = oneOf(sp, "status", STATUSES);
  const sort = oneOf(sp, "sort", Object.keys(SORTS) as (keyof typeof SORTS)[]) ?? "newest";
  const page = pageOf(sp);

  const digits = q?.replace(/[^\d]/g, "");
  const where: Prisma.VirtualNumberWhereInput = {
    ...(status ? { status } : {}),
    ...(country ? { countryCode: country } : {}),
    ...(service ? { services: { some: { service: { slug: service } } } } : {}),
    ...(q
      ? {
          OR: [
            ...(digits && digits.length >= 2 ? [{ e164: { contains: digits } }] : []),
            { countryName: { contains: q, mode: "insensitive" as const } },
            { region: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows, countries, services] = await Promise.all([
    db.virtualNumber.count({ where }),
    db.virtualNumber.findMany({
      where,
      orderBy: [...SORTS[sort]],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { services: { include: { service: true } }, _count: { select: { orders: true } } },
    }),
    db.virtualNumber.groupBy({ by: ["countryCode", "countryName"], orderBy: { countryName: "asc" } }),
    db.service.findMany({ orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Numbers"
        description="Demo inventory. Numbers with orders are partially locked to keep order history accurate."
        actions={
          <Link href="/admin/numbers/new" className={buttonVariants()}>
            <Plus className="size-4" aria-hidden /> Add number
          </Link>
        }
      />
      <FilterBar action="/admin/numbers">
        <SearchField value={q} label="Search" placeholder="Number, country or region" />
        <SelectField name="country" label="Country" value={country} options={countries.map((c) => ({ value: c.countryCode, label: c.countryName }))} />
        <SelectField name="service" label="Service" value={service} options={services.map((s) => ({ value: s.slug, label: s.name }))} />
        <SelectField name="status" label="Status" value={status} options={STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
        <SelectField
          name="sort" label="Sort" value={sort} allLabel="Newest"
          options={[
            { value: "price_asc", label: "Price, low to high" },
            { value: "price_desc", label: "Price, high to low" },
            { value: "country", label: "Country" },
          ]}
        />
      </FilterBar>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Hash} title="No numbers match" description="Try clearing a filter, or add a new demo number." action={<Link href="/admin/numbers" className={buttonVariants({ variant: "secondary" })}>Clear filters</Link>} />
        ) : (
          <Table data-testid="numbers-table">
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Country</Th>
                <Th>Status</Th>
                <Th className="text-right">Price</Th>
                <Th>Services</Th>
                <Th className="text-right">Orders</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} className="hover:bg-surface-muted/40">
                  <Td>
                    <Link href={`/admin/numbers/${n.id}`} className="font-mono text-[13px] font-medium hover:underline">{formatE164(n.e164)}</Link>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {n.countryName}
                    {n.region && <span className="text-muted-foreground"> · {n.region}</span>}
                  </Td>
                  <Td><StatusBadge status={n.status} /></Td>
                  <Td className="text-right font-mono tabular">{formatMoney(n.priceCents)}</Td>
                  <Td>
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {n.services.slice(0, 3).map((s) => <Badge key={s.serviceId}>{s.service.name}</Badge>)}
                      {n.services.length > 3 && <span className="text-xs text-muted-foreground">+{n.services.length - 3}</span>}
                    </div>
                  </Td>
                  <Td className="text-right tabular">{n._count.orders}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {rows.length > 0 && (
        <Pagination page={page} pages={pages} total={total} pageSize={ADMIN_PAGE_SIZE} basePath="/admin/numbers" params={{ q, country, service, status, sort: sort === "newest" ? undefined : sort }} />
      )}
    </>
  );
}
