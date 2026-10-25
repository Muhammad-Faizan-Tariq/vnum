import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/badge";
import { NumberForm } from "@/components/admin/number-form";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { LIVE_ORDER_STATUSES } from "@/server/orders/state";
import { formatDateTime, formatE164, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit number · Admin" };

export default async function AdminNumberDetailPage({ params }: PageProps<"/admin/numbers/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const number = await db.virtualNumber.findUnique({
    where: { id },
    include: {
      services: { include: { service: true } },
      orders: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!number) notFound();
  const services = await db.service.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });

  const identityLocked = number.orders.length > 0;
  const hasLive = number.orders.some((o) => o.status === "COMPLETED" || (LIVE_ORDER_STATUSES as readonly string[]).includes(o.status));
  const statusLocked = hasLive || number.status === "RESERVED" || number.status === "SOLD";

  return (
    <>
      <PageHeader
        title={formatE164(number.e164)}
        description={`${number.countryName}${number.region ? ` · ${number.region}` : ""} · ${formatMoney(number.priceCents)}`}
        actions={<StatusBadge status={number.status} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          {(identityLocked || statusLocked) && (
            <Notice tone="info" title="Some fields are locked">
              <span className="inline-flex items-start gap-1.5">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {identityLocked && "Number and country cannot change once an order exists. "}
                  {statusLocked && "Availability is managed by the order flow while this number is reserved, sold or on an active order. "}
                  Price, region, services and capabilities stay editable.
                </span>
              </span>
            </Notice>
          )}
          <Card className="p-5">
            <NumberForm
              mode="edit"
              numberId={number.id}
              services={services}
              identityLocked={identityLocked}
              statusLocked={statusLocked}
              initial={{
                e164: number.e164,
                countryCode: number.countryCode,
                countryName: number.countryName,
                region: number.region ?? "",
                price: (number.priceCents / 100).toFixed(2),
                serviceSlugs: number.services.map((s) => s.service.slug),
                smsInbound: number.smsInbound,
                voice: number.voice,
                status: number.status,
              }}
            />
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Related orders" description={`${number.orders.length} total`} />
          {number.orders.length === 0 ? (
            <EmptyState icon={Lock} title="No orders yet" description="This number is free to edit and can be disabled at any time." />
          ) : (
            <Table>
              <thead>
                <tr><Th>Order</Th><Th>Status</Th></tr>
              </thead>
              <tbody>
                {number.orders.map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-[13px] hover:underline">{o.reference}</Link>
                      <div className="text-xs text-muted-foreground">{o.user.name} · {formatDateTime(o.createdAt)}</div>
                    </Td>
                    <Td><StatusBadge status={o.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
