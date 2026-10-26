/**
 * Local SMPP server for development and tests. It plays the part of a vendor's SMSC:
 * it accepts bind_receiver sessions (and rejects every other bind type) and pushes deliver_sm
 * PDUs to bound receivers on request. No real network is involved.
 *
 *   npm run smpp:sim                      # listens on 2775 (SMPP) and 2776 (control; set SMPP_SIM_HOST=0.0.0.0 inside Docker)
 *   npm run smpp:push -- +14155550123 "Your code is 123456" [FROM]
 *
 * Default credentials: system_id "vnumtest", password "testpass". Override with
 * SMPP_SIM_SYSTEM_ID / SMPP_SIM_PASSWORD / SMPP_SIM_PORT / SMPP_SIM_CONTROL_PORT.
 */
import http from "node:http";
import smpp, { type Session } from "smpp";

const SMPP_PORT = Number(process.env.SMPP_SIM_PORT ?? 2775);
const CONTROL_PORT = Number(process.env.SMPP_SIM_CONTROL_PORT ?? 2776);
const HOST = process.env.SMPP_SIM_HOST ?? "127.0.0.1";
const SYSTEM_ID = process.env.SMPP_SIM_SYSTEM_ID ?? "vnumtest";
const PASSWORD = process.env.SMPP_SIM_PASSWORD ?? "testpass";

const bound = new Set<Session>();
const log = (...a: unknown[]) => console.log(new Date().toISOString(), "[smpp-sim]", ...a);

const server = smpp.createServer({}, (session) => {
  session.on("error", () => bound.delete(session));
  session.on("close", () => bound.delete(session));

  const reject = (pdu: { response(o?: Record<string, unknown>): never }, status: number) => {
    session.send(pdu.response({ command_status: status }) as never);
    setTimeout(() => session.close(), 50);
  };

  session.on("bind_receiver", (pdu) => {
    if (pdu.system_id !== SYSTEM_ID) return reject(pdu as never, smpp.errors.ESME_RINVSYSID);
    if (pdu.password !== PASSWORD) return reject(pdu as never, smpp.errors.ESME_RINVPASWD);
    session.send(pdu.response());
    bound.add(session);
    log(`receiver bound: ${pdu.system_id}`);
  });
  // VNum is receive-only, so this server refuses transmitter/transceiver binds.
  for (const kind of ["bind_transmitter", "bind_transceiver"]) {
    session.on(kind, (pdu) => reject(pdu as never, smpp.errors.ESME_RBINDFAIL));
  }
  session.on("enquire_link", (pdu) => session.send(pdu.response()));
  session.on("unbind", (pdu) => {
    session.send(pdu.response());
    session.close();
  });
});

server.listen(SMPP_PORT, HOST, () => log(`SMPP server on ${HOST}:${SMPP_PORT} (system_id=${SYSTEM_ID})`));

// Tiny control API so tests and humans can make the "SMSC" deliver a message.
http
  .createServer((req, res) => {
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/status") return json(200, { bound: bound.size });
    if (req.method === "POST" && req.url === "/deliver") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        try {
          const { from = "VNUM-DEMO", to, text } = JSON.parse(raw) as { from?: string; to?: string; text?: string };
          if (!to || !text) return json(422, { error: "to and text are required" });
          if (bound.size === 0) return json(409, { error: "no receiver is bound", delivered: 0 });
          for (const s of bound) {
            s.deliver_sm({ source_addr: from, destination_addr: to, short_message: { message: text } }, () => {});
          }
          log(`deliver_sm ${from} -> ${to} to ${bound.size} receiver(s)`);
          json(200, { delivered: bound.size });
        } catch {
          json(400, { error: "invalid JSON" });
        }
      });
      return;
    }
    json(404, { error: "not found" });
  })
  .listen(CONTROL_PORT, HOST, () => log(`control API on ${HOST}:${CONTROL_PORT}`));
