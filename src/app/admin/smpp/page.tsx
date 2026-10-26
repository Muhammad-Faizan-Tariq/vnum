import type { Metadata } from "next";
import Link from "next/link";
import { Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, Notice, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { ApiActionButton } from "@/components/admin/api-action-button";
import { requireAdmin } from "@/server/auth/session";
import { listVendors } from "@/server/smpp/vendors";
import { vendorState, VENDOR_STATE_VIEW } from "@/server/smpp/state";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "SMPP vendors · Admin" };

export default async function SmppVendorsPage() {
  await requireAdmin();
  const vendors = await listVendors();
  const now = new Date();
  return (
    <>
      <PageHeader
        title="SMPP vendors"
        description="Receive-only SMPP connections. A worker process binds to each enabled vendor as a receiver and stores incoming SMS in the owner's inbox. VNum never sends messages."
        actions={
          <Link href="/admin/smpp/new" className={buttonVariants({ size: "sm" })} data-testid="new-vendor">
            Add vendor
          </Link>
        }
      />

      <Card>
        {vendors.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No SMPP vendors yet"
            description="Add a vendor's host, port and credentials. For a local test, start the built-in simulator (npm run smpp:sim) and use host 127.0.0.1, port 2775, system ID vnumtest, password testpass."
            action={
              <Link href="/admin/smpp/new" className={buttonVariants({ size: "sm" })}>
                Add vendor
              </Link>
            }
          />
        ) : (
          <Table>
            <caption className="sr-only">SMPP vendors</caption>
            <thead>
              <tr>
                <Th>Vendor</Th>
                <Th className="hidden md:table-cell">System ID</Th>
                <Th>Link</Th>
                <Th className="hidden lg:table-cell">Last bound</Th>
                <Th className="hidden text-right sm:table-cell">Received</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const state = vendorState(v, now);
                const view = VENDOR_STATE_VIEW[state];
                return (
                  <tr key={v.id} data-testid="vendor-row" data-state={state}>
                    <Td>
                      <Link href={`/admin/smpp/${v.id}`} className="font-medium hover:text-accent hover:underline">
                        {v.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">
                        {v.host}:{v.port}
                      </p>
                    </Td>
                    <Td className="hidden font-mono text-[13px] md:table-cell">{v.systemId}</Td>
                    <Td>
                      <Badge tone={view.tone} dot>
                        {view.label}
                      </Badge>
                      {v.lastError && state !== "BOUND" && <p className="mt-1 max-w-64 text-xs text-muted-foreground">{v.lastError}</p>}
                    </Td>
                    <Td className="hidden text-[13px] text-muted-foreground lg:table-cell">{v.lastBoundAt ? formatDateTime(v.lastBoundAt) : "Never"}</Td>
                    <Td className="hidden text-right tabular sm:table-cell">{v.receivedCount}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {v.enabled && (
                        <ApiActionButton
                          url={`/api/admin/smpp-vendors/${v.id}/test`}
                          label="Test connection"
                          successMessage="Reconnect requested. The status updates when the worker responds."
                          testId={`test-${v.id}`}
                        />
                      )}{" "}
                      <Link href={`/admin/smpp/${v.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        Edit
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="How connections run" />
        <div className="space-y-3 p-4 text-[13px] text-muted-foreground">
          <p>
            Connections are held by a separate worker (<code className="font-mono">npm run smpp:worker</code>) because SMPP needs a
            long-lived TCP session, which serverless hosting can&apos;t keep open. The worker reads these settings from the shared database,
            binds as a receiver, and updates the link status above. If the worker isn&apos;t running, vendors show &ldquo;Worker offline&rdquo;.
          </p>
          <Notice tone="info" title="Passwords">
            Saved passwords are encrypted with <code className="font-mono">SMPP_ENCRYPTION_KEY</code> and are never displayed.
          </Notice>
        </div>
      </Card>
    </>
  );
}
