import type { Tone } from "@/components/ui/badge";

type V = { enabled: boolean; linkState: "DISABLED" | "CONNECTING" | "BOUND" | "FAILED"; lastSeenAt: Date | null; updatedAt: Date };

export type VendorDisplayState = "DISABLED" | "CONNECTING" | "BOUND" | "FAILED" | "WORKER_OFFLINE";

const STALE_MS = 30_000;

/** The worker heartbeats while bound; a silent worker must not leave a stale green badge. */
export function vendorState(v: V, now = new Date()): VendorDisplayState {
  if (!v.enabled) return "DISABLED";
  if (v.linkState === "BOUND") {
    return v.lastSeenAt && now.getTime() - v.lastSeenAt.getTime() < STALE_MS ? "BOUND" : "WORKER_OFFLINE";
  }
  if (v.linkState === "CONNECTING" && now.getTime() - v.updatedAt.getTime() > STALE_MS) return "WORKER_OFFLINE";
  return v.linkState;
}

export const VENDOR_STATE_VIEW: Record<VendorDisplayState, { label: string; tone: Tone }> = {
  BOUND: { label: "Bound (receiver)", tone: "success" },
  CONNECTING: { label: "Connecting", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
  DISABLED: { label: "Disabled", tone: "neutral" },
  WORKER_OFFLINE: { label: "Worker offline", tone: "warning" },
};
