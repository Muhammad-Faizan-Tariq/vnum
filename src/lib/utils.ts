import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Formats an E.164 number for display, e.g. +12025550143 -> +1 202 555 0143 (best effort). */
export function formatE164(e164: string) {
  const d = e164.replace(/[^\d]/g, "");
  if (e164.startsWith("+1") && d.length === 11) {
    return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  if (e164.startsWith("+44") && d.length === 12) {
    return `+44 ${d.slice(2, 6)} ${d.slice(6)}`;
  }
  if (e164.startsWith("+33") && d.length === 11) {
    return `+33 ${d[2]} ${d.slice(3).match(/.{2}/g)!.join(" ")}`;
  }
  if (e164.startsWith("+4930") && d.length === 12) {
    return `+49 30 ${d.slice(4, 9)} ${d.slice(9)}`;
  }
  return e164.replace(/^(\+\d{1,3})(\d+)$/, (_, cc: string, rest: string) => {
    const groups = rest.match(/.{1,3}/g) ?? [];
    return `${cc} ${groups.join(" ")}`;
  });
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

/** Deterministic (UTC) formatting so server and client output match. */
export function formatDate(d: Date | string) {
  return dateFmt.format(new Date(d));
}
export function formatDateTime(d: Date | string) {
  return `${dateTimeFmt.format(new Date(d))} UTC`;
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function timeAgo(d: Date | string, now = new Date()) {
  const s = Math.max(0, Math.round((now.getTime() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
