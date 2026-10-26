/**
 * SMPP receiver worker (receive-only).
 *
 * Keeps one bind_receiver session open per enabled SmppVendor, acknowledges every deliver_sm and
 * stores it in the inbox of the customer who owns the destination number. It never submits a
 * message. Run it anywhere that can hold a TCP connection open (a VPS, Railway, Fly.io, your
 * laptop); Vercel serverless functions cannot. It shares the web app's DATABASE_URL.
 *
 *   npm run smpp:worker
 */
import "dotenv/config";
import smpp, { type Session } from "smpp";
import { db } from "../src/server/db";
import { decryptSecret } from "../src/server/smpp/crypto";
import { ingestIncomingSms } from "../src/server/smpp/ingest";

const POLL_MS = Number(process.env.SMPP_WORKER_POLL_MS ?? 3000);
const ENQUIRE_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;

type Vendor = Awaited<ReturnType<typeof db.smppVendor.findMany>>[number];
type Live = { session: Session; fingerprint: string; vendorId: string };

const live = new Map<string, Live>();
const retry = new Map<string, { at: number; backoff: number }>();

const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[smpp-worker]", ...a);
const statusName = (code: number) => Object.entries(smpp.errors).find(([, v]) => v === code)?.[0] ?? `status ${code}`;
const text = (m: unknown) => (typeof m === "string" ? m : ((m as { message?: string } | undefined)?.message ?? ""));

const setState = (id: string, data: Parameters<typeof db.smppVendor.updateMany>[0]["data"]) =>
  db.smppVendor.updateMany({ where: { id }, data }).catch((e) => log("db update failed:", e.message));

function scheduleRetry(vendorId: string) {
  const prev = retry.get(vendorId)?.backoff ?? 2000;
  const backoff = Math.min(prev * 2, MAX_BACKOFF_MS);
  retry.set(vendorId, { at: Date.now() + prev, backoff });
}

function drop(vendorId: string) {
  const l = live.get(vendorId);
  if (!l) return;
  live.delete(vendorId);
  try {
    l.session.destroy();
  } catch {
    /* already closed */
  }
}

function connect(v: Vendor, fingerprint: string) {
  let password: string;
  try {
    password = decryptSecret(v.passwordEnc);
  } catch (e) {
    void setState(v.id, { linkState: "FAILED", lastError: `Cannot decrypt stored password: ${(e as Error).message}` });
    scheduleRetry(v.id);
    return;
  }
  log(`connecting to ${v.name} (${v.host}:${v.port}) as ${v.systemId}`);
  void setState(v.id, { linkState: "CONNECTING", lastError: null });
  const session = smpp.connect({
    url: `smpp://${v.host}:${v.port}`,
    auto_enquire_link_period: ENQUIRE_MS,
    connectTimeout: 10_000,
  });
  const entry: Live = { session, fingerprint, vendorId: v.id };
  live.set(v.id, entry);
  const current = () => live.get(v.id) === entry;

  session.on("connect", () => {
    session.bind_receiver({ system_id: v.systemId, password, system_type: v.systemType }, (pdu) => {
      if (!current()) return;
      if (pdu.command_status === 0) {
        retry.delete(v.id);
        log(`bound as receiver to ${v.name}`);
        void setState(v.id, { linkState: "BOUND", lastError: null, lastBoundAt: new Date(), lastSeenAt: new Date() });
      } else {
        const reason = `Bind rejected by vendor: ${statusName(pdu.command_status)}`;
        log(`${v.name}: ${reason}`);
        void setState(v.id, { linkState: "FAILED", lastError: reason });
        drop(v.id);
        scheduleRetry(v.id);
      }
    });
  });

  session.on("deliver_sm", (pdu) => {
    // Always acknowledge first so the vendor does not redeliver while we write to the database.
    session.send(pdu.response());
    const body = text(pdu.short_message) || text(pdu.message_payload);
    if (!pdu.destination_addr) return;
    ingestIncomingSms({
      vendorId: v.id,
      source: pdu.source_addr ?? "unknown",
      destination: pdu.destination_addr,
      text: body,
      messageId: pdu.receipted_message_id,
    })
      .then((r) => log(`${v.name}: deliver_sm to ${pdu.destination_addr} ${r.routed ? "stored" : "not routed (number not owned)"}`))
      .catch((e) => log(`${v.name}: failed to store message:`, e.message));
  });

  session.on("error", (e: Error) => {
    if (!current()) return;
    log(`${v.name}: ${e.message}`);
    void setState(v.id, { linkState: "FAILED", lastError: e.message });
    drop(v.id);
    scheduleRetry(v.id);
  });
  session.on("close", () => {
    if (!current()) return;
    log(`${v.name}: connection closed`);
    void setState(v.id, { linkState: "FAILED", lastError: "Connection closed by vendor" });
    drop(v.id);
    scheduleRetry(v.id);
  });
}

async function tick() {
  const vendors = await db.smppVendor.findMany();
  const ids = new Set(vendors.map((v) => v.id));
  for (const id of live.keys()) if (!ids.has(id)) drop(id);

  for (const v of vendors) {
    const fingerprint = [v.host, v.port, v.systemId, v.systemType, v.passwordEnc, v.reconnectRequestedAt?.getTime() ?? 0].join("|");
    const l = live.get(v.id);
    if (!v.enabled) {
      if (l) drop(v.id);
      if (v.linkState !== "DISABLED") await setState(v.id, { linkState: "DISABLED" });
      continue;
    }
    if (l && l.fingerprint !== fingerprint) {
      log(`${v.name}: settings changed, reconnecting`);
      drop(v.id);
      retry.delete(v.id);
    }
    if (live.has(v.id)) {
      if (v.linkState === "BOUND") await setState(v.id, { lastSeenAt: new Date() });
      continue;
    }
    if ((retry.get(v.id)?.at ?? 0) <= Date.now()) connect(v, fingerprint);
  }
}

async function main() {
  log(`started, polling every ${POLL_MS}ms (receive-only; this process never sends SMS)`);
  const timer = setInterval(() => tick().catch((e) => log("tick failed:", e.message)), POLL_MS);
  await tick();

  const shutdown = async () => {
    clearInterval(timer);
    for (const id of [...live.keys()]) {
      await setState(id, { linkState: "FAILED", lastError: "Worker stopped" });
      drop(id);
    }
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
