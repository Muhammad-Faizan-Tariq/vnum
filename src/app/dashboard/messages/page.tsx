import type { Metadata } from "next";
import Link from "next/link";
import { Inbox as InboxIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, Notice, PageHeader, SimulatedTag } from "@/components/ui/primitives";
import { InboxSimulateForm, RefreshButton } from "@/components/customer/forms";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { ownedNumbers } from "@/server/messaging/service";
import { smppTransport } from "@/server/messaging/smpp";
import { cn, formatDateTime, formatE164 } from "@/lib/utils";

export const metadata: Metadata = { title: "Inbox (SMPP testing)" };

const LINK_TONE = { BOUND_RX: "success", UNBOUND: "danger", THROTTLED: "warning" } as const;

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const user = await requireUser("/dashboard/messages");
  const sp = await searchParams;
  const [settings, numbers] = await Promise.all([getSettings(), ownedNumbers(user.id)]);
  const link = smppTransport.link(settings.smpp);

  const header = (
    <>
      <PageHeader
        title="Inbox · SMPP testing"
        description="Receive-only. A simulator delivers incoming SMS to your numbers; VNum cannot send messages."
        actions={numbers.length > 0 ? <RefreshButton /> : undefined}
      />
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-sm" data-testid="smpp-status">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Link</span>
          <Badge tone={LINK_TONE[link.state]} dot>
            {link.state}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Adapter</span>
          <code className="font-mono text-xs">{link.adapter}</code>
          <SimulatedTag />
        </div>
        <p className="text-[13px] text-muted-foreground">{link.detail}</p>
      </div>
      {link.state !== "BOUND_RX" && (
        <Notice tone="warning" title="The simulated SMPP link is degraded" className="mb-6">
          Simulated deliveries fail with a diagnostic code until an administrator sets the link back to online.
        </Notice>
      )}
    </>
  );

  if (numbers.length === 0) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            icon={InboxIcon}
            title="No numbers to receive on yet"
            description="Buy a demo number and its inbox appears here. Incoming messages are simulated."
            action={
              <Link href="/dashboard/numbers" className={buttonVariants({ size: "sm" })}>
                Browse numbers
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const requested = typeof sp.number === "string" ? sp.number : undefined;
  const selected = numbers.find((n) => n.id === requested) ?? numbers[0];
  const messages = await db.message.findMany({
    where: { userId: user.id, numberId: selected.id, direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      {header}
      <nav aria-label="Your numbers" className="mb-5 flex gap-1 overflow-x-auto rounded-md border border-border bg-surface p-0.5">
        {numbers.map((n) => (
          <Link
            key={n.id}
            href={`/dashboard/messages?number=${n.id}`}
            aria-current={n.id === selected.id ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded px-3 font-mono text-[13px] font-medium whitespace-nowrap",
              n.id === selected.id ? "bg-accent-soft text-accent-soft-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {formatE164(n.e164)}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader
            title={`Messages to ${formatE164(selected.e164)}`}
            description={`${messages.length} received`}
            action={<SimulatedTag label="Simulated inbound" />}
          />
          {messages.length === 0 ? (
            <EmptyState icon={InboxIcon} title="Nothing received yet" description="Deliver a simulated SMS with the form to see how an incoming message looks." />
          ) : (
            <ul className="divide-y divide-border" data-testid="inbox-list">
              {messages.map((m) => (
                <li key={m.id} className="px-4 py-3" data-testid="inbox-message">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-[13px] font-medium">{m.fromAddress}</p>
                    <time dateTime={m.createdAt.toISOString()} className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm break-words">{m.body}</p>
                  {m.smppMessageId && <p className="mt-1 font-mono text-[11px] text-muted-foreground">deliver_sm {m.smppMessageId}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Simulate an incoming SMS" description="Stands in for a carrier delivering a message." />
            <div className="p-4">
              <InboxSimulateForm numberId={selected.id} />
            </div>
          </Card>
          <Notice tone="info">
            Messages here are generated by the in-app simulator and never come from a real network. SMTP and email are out of scope.
          </Notice>
        </div>
      </div>
    </div>
  );
}
