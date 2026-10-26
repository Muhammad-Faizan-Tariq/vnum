import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader, SimulatedTag, Table, Td, Th } from "@/components/ui/primitives";
import { Radio } from "lucide-react";
import { db } from "@/server/db";
import { VendorTestMessage } from "@/components/admin/vendor-test-message";
import { recentVendorTraffic } from "@/server/smpp/traffic";
import { ApiActionButton } from "@/components/admin/api-action-button";
import { SmppVendorForm } from "@/components/admin/smpp-vendor-form";
import { requireAdmin } from "@/server/auth/session";
import { getVendor } from "@/server/smpp/vendors";
import { vendorState, VENDOR_STATE_VIEW } from "@/server/smpp/state";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "SMPP vendor · Admin" };

export default async function EditSmppVendorPage({ params }: PageProps<"/admin/smpp/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const v = await getVendor(id);
  if (!v) notFound();
  const traffic = await recentVendorTraffic(v.id);
  const simulatorAvailable = !!process.env.SMPP_SIM_CONTROL_URL;
  const sold = await db.virtualNumber.findFirst({ where: { status: "SOLD" }, select: { e164: true }, orderBy: { updatedAt: "desc" } });
  const state = vendorState(v);
  const view = VENDOR_STATE_VIEW[state];
  return (
    <>
      <PageHeader title={v.name} description={`${v.host}:${v.port} as ${v.systemId}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="p-5">
          <SmppVendorForm initial={v} />
        </Card>
        <div className="order-last space-y-6 lg:col-span-2">
          {simulatorAvailable && (
            <Card>
              <CardHeader
                title="Send a test SMS"
                description="Makes the built-in simulator deliver a message over real SMPP to this vendor's link. Works when this vendor points at the simulator."
                action={<SimulatedTag />}
              />
              <div className="max-w-xl p-4">
                <VendorTestMessage vendorId={v.id} defaultTo={sold?.e164 ?? ""} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Recent traffic" description="What this vendor delivered, newest first. Messages for numbers nobody owns are shown as not routed." />
            {traffic.length === 0 ? (
              <EmptyState icon={Radio} title="Nothing received yet" description="When the vendor delivers an SMS to one of your numbers it appears here within seconds." />
            ) : (
              <Table>
                <caption className="sr-only">Recent messages from this vendor</caption>
                <thead>
                  <tr>
                    <Th>Time</Th>
                    <Th>From → to</Th>
                    <Th>Message</Th>
                    <Th>Result</Th>
                  </tr>
                </thead>
                <tbody data-testid="vendor-traffic">
                  {traffic.map((t) => (
                    <tr key={t.id} data-testid="traffic-row" data-routed={t.routed}>
                      <Td className="text-[13px] whitespace-nowrap text-muted-foreground">{formatDateTime(t.at)}</Td>
                      <Td className="font-mono text-xs">
                        {t.source} → {t.destination}
                      </Td>
                      <Td className="max-w-xs truncate text-[13px]">{t.text}</Td>
                      <Td className="text-[13px]">{t.routed ? "Stored in inbox" : "Not routed (number not owned)"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Link status" />
            <dl className="space-y-2.5 p-4 text-sm" data-testid="vendor-status">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">State</dt>
                <dd>
                  <Badge tone={view.tone} dot>
                    {view.label}
                  </Badge>
                </dd>
              </div>
              {v.lastError && state !== "BOUND" && (
                <div>
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="mt-0.5 text-[13px]">{v.lastError}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last bound</dt>
                <dd className="text-[13px]">{v.lastBoundAt ? formatDateTime(v.lastBoundAt) : "Never"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last message</dt>
                <dd className="text-[13px]">{v.lastMessageAt ? formatDateTime(v.lastMessageAt) : "None yet"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Received</dt>
                <dd className="tabular">{v.receivedCount}</dd>
              </div>
            </dl>
            {v.enabled && (
              <div className="border-t border-border p-4">
                <ApiActionButton
                  url={`/api/admin/smpp-vendors/${v.id}/test`}
                  label="Test connection"
                  successMessage="Reconnect requested. Refresh in a few seconds to see the result."
                  testId="test-connection"
                />
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Delete vendor" description="Stops the connection. Messages already received are kept." />
            <div className="p-4">
              <ApiActionButton
                url={`/api/admin/smpp-vendors/${v.id}`}
                method="DELETE"
                label="Delete vendor"
                variant="dangerOutline"
                successMessage="Vendor deleted."
                testId="delete-vendor"
                confirm={{ title: `Delete ${v.name}?`, description: "The worker will drop this connection. Received messages stay in customers' inboxes.", confirmLabel: "Delete" }}
              />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
