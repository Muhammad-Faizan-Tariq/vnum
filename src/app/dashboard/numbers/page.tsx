import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX, SlidersHorizontal } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Card, EmptyState, PageHeader, Pagination, SimulatedTag, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/session";
import { expireStaleOrders } from "@/server/orders/service";
import { filterOptions, PAGE_SIZE, parseNumberFilters, searchNumbers } from "@/server/numbers/queries";
import { formatE164, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Browse numbers" };

export default async function BrowseNumbersPage({ searchParams }: PageProps<"/dashboard/numbers">) {
  await requireUser("/dashboard/numbers");
  const filters = parseNumberFilters(await searchParams);
  await expireStaleOrders();
  const [{ items, total, pages }, options] = await Promise.all([searchNumbers(filters), filterOptions()]);
  const page = Math.min(filters.page, pages);

  const active = [filters.q, filters.country, filters.service, filters.status, filters.minPrice, filters.maxPrice].filter(
    (v) => v !== undefined && v !== "",
  ).length;

  const keep = {
    q: filters.q,
    country: filters.country,
    service: filters.service,
    status: filters.status,
    minPrice: filters.minPrice?.toString(),
    maxPrice: filters.maxPrice?.toString(),
    sort: filters.sort === "price_asc" ? undefined : filters.sort,
  };

  return (
    <div>
      <PageHeader
        title="Browse numbers"
        description="Demo inventory for testing. Every number here is simulated: none is live on a telecom network."
      />

      <form method="get" className="mb-5 space-y-3 rounded-lg border border-border bg-surface p-3.5 shadow-sm" role="search" aria-label="Filter numbers">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Search by number, country or service"
            aria-label="Search numbers"
            className="pl-9"
            type="search"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-[1.2fr_1.2fr_1fr_6.5rem_6.5rem_1.1fr]">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Country
            <Select name="country" defaultValue={filters.country ?? ""} aria-label="Country" className="text-foreground">
              <option value="">All countries</option>
              {options.countries.map((c) => (
                <option key={c.countryCode} value={c.countryCode}>
                  {c.countryName}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Service
            <Select name="service" defaultValue={filters.service ?? ""} aria-label="Service" className="text-foreground">
              <option value="">Any service</option>
              {options.services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Status
            <Select name="status" defaultValue={filters.status ?? ""} aria-label="Status" className="text-foreground">
              <option value="">Any status</option>
              <option value="AVAILABLE">Available</option>
              <option value="RESERVED">Reserved</option>
            </Select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Min price (USD)
            <Input name="minPrice" type="number" min={0} step="0.5" inputMode="decimal" defaultValue={filters.minPrice} aria-label="Minimum price" className="text-foreground" />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Max price (USD)
            <Input name="maxPrice" type="number" min={0} step="0.5" inputMode="decimal" defaultValue={filters.maxPrice} aria-label="Maximum price" className="text-foreground" />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Sort by
            <Select name="sort" defaultValue={filters.sort} aria-label="Sort by" className="text-foreground">
              <option value="price_asc">Cheapest first</option>
              <option value="price_desc">Priciest first</option>
              <option value="newest">Newest</option>
              <option value="country">Country A–Z</option>
            </Select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            <SlidersHorizontal className="size-3.5" aria-hidden /> Apply filters
          </Button>
          {active > 0 && (
            <Link href="/dashboard/numbers" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Clear {active} {active === 1 ? "filter" : "filters"}
            </Link>
          )}
          <p className="ml-auto text-[13px] text-muted-foreground tabular" data-testid="result-count" aria-live="polite">
            {total} {total === 1 ? "number" : "numbers"}
          </p>
        </div>
      </form>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No numbers match these filters"
            description="Try a different country or service, widen the price range, or clear the filters."
            action={
              <Link href="/dashboard/numbers" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">Available virtual numbers</caption>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th className="hidden md:table-cell">Supported services</Th>
                <Th className="hidden lg:table-cell">Capabilities</Th>
                <Th>Status</Th>
                <Th className="text-right">Price</Th>
                <Th>
                  <span className="sr-only">Action</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} className="hover:bg-surface-muted/50" data-testid="number-row">
                  <Td>
                    <Link href={`/dashboard/numbers/${n.id}`} className="font-mono text-[13px] font-medium hover:text-accent hover:underline">
                      {formatE164(n.e164)}
                    </Link>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="rounded bg-surface-muted px-1 font-mono text-[10px] font-semibold">{n.countryCode}</span>
                      {n.countryName}
                      {n.region ? ` · ${n.region}` : ""}
                    </p>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {n.services.slice(0, 3).map((s) => (
                        <Badge key={s.serviceId}>{s.service.name}</Badge>
                      ))}
                      {n.services.length > 3 && <Badge>+{n.services.length - 3}</Badge>}
                    </div>
                  </Td>
                  <Td className="hidden text-[13px] text-muted-foreground lg:table-cell">
                    SMS in{n.voice ? " · Voice" : ""}
                  </Td>
                  <Td>
                    <StatusBadge status={n.status} />
                  </Td>
                  <Td className="text-right font-medium tabular">{formatMoney(n.priceCents)}</Td>
                  <Td className="text-right">
                    <Link href={`/dashboard/numbers/${n.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })} aria-label={`View ${formatE164(n.e164)}`}>
                      View
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {total > 0 && <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} basePath="/dashboard/numbers" params={keep} />}
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <SimulatedTag /> Service labels describe the demo catalogue. Nothing is registered with any of these services.
      </p>
    </div>
  );
}
