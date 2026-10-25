import { randomUUID } from "node:crypto";
import type { AppSettings } from "@/server/settings";

export type SmppErrorStatus = "ESME_RBINDFAIL" | "ESME_RTHROTTLED";

export type SmppLinkStatus = {
  adapter: string;
  simulated: true;
  state: "BOUND_RX" | "UNBOUND" | "THROTTLED";
  detail: string;
};

export type SmppDeliverResult =
  | { ok: true; messageId: string; commandStatus: "SIMULATED_DELIVER_SM" }
  | { ok: false; commandStatus: SmppErrorStatus; detail: string };

/**
 * Receive-only messaging transport. The shipped implementation is an in-process SMPP *simulator*
 * that models the bind state and incoming deliver_sm PDUs; it never opens a socket and never
 * reaches a carrier. VNum has no send path. A real SMPP receiver (bind_receiver, enquire_link,
 * deliver_sm) would implement this same interface.
 */
export interface SmppTransport {
  readonly id: string;
  link(settings: AppSettings["smpp"]): SmppLinkStatus;
  /** Simulates the SMSC pushing one incoming message, or fails if the link is not usable. */
  deliver(settings: AppSettings["smpp"]): SmppDeliverResult;
}

class SmppSimulator implements SmppTransport {
  readonly id = "smpp-simulator";

  link(settings: AppSettings["smpp"]): SmppLinkStatus {
    if (settings.mode === "offline") {
      return { adapter: this.id, simulated: true, state: "UNBOUND", detail: "Simulated outage: receiver is not bound" };
    }
    if (settings.mode === "throttled") {
      return { adapter: this.id, simulated: true, state: "THROTTLED", detail: "Simulated SMSC is throttling deliveries" };
    }
    return { adapter: this.id, simulated: true, state: "BOUND_RX", detail: "Simulated receiver bound (no network connection)" };
  }

  deliver(settings: AppSettings["smpp"]): SmppDeliverResult {
    if (settings.mode === "offline") {
      return { ok: false, commandStatus: "ESME_RBINDFAIL", detail: "Receiver is not bound (simulated outage). The message was not delivered." };
    }
    if (settings.mode === "throttled") {
      return { ok: false, commandStatus: "ESME_RTHROTTLED", detail: "SMSC throttling limit reached (simulated). Try again shortly." };
    }
    return { ok: true, messageId: `sim-${randomUUID().slice(0, 12)}`, commandStatus: "SIMULATED_DELIVER_SM" };
  }
}

export const smppTransport: SmppTransport = new SmppSimulator();
