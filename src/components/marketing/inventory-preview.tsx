import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SimulatedTag } from "@/components/ui/primitives";

// Static illustrative rows. These are NOT read from the database and are not purchasable.
const ROWS = [
  { number: "+1 202 555 0143", country: "US", region: "Washington", services: ["Generic OTP", "Telegram"], price: "$2.10", status: "AVAILABLE" },
  { number: "+1 415 555 0178", country: "US", region: "San Francisco", services: ["Google", "Discord", "Signal"], price: "$3.40", status: "AVAILABLE" },
  { number: "+44 7700 900412", country: "GB", region: "Mobile", services: ["WhatsApp", "Generic OTP"], price: "$4.25", status: "RESERVED" },
  { number: "+49 30 23125 077", country: "DE", region: "Berlin", services: ["Microsoft", "Amazon"], price: "$5.80", status: "AVAILABLE" },
  { number: "+33 6 39 98 4521", country: "FR", region: "Mobile", services: ["Telegram", "Uber"], price: "$4.60", status: "AVAILABLE" },
] as const;

export function InventoryPreview() {
  return (
    <figure className="m-0" aria-label="Sample number inventory">
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-md">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted/60 px-3 py-2">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
            <span className="size-2.5 rounded-full bg-border-strong" />
          </div>
          <SimulatedTag label="Sample data" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 text-[13px] text-muted-foreground">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Search country, number or service</span>
          </div>
          <div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-[13px] text-muted-foreground">
            <SlidersHorizontal className="size-3.5" aria-hidden /> Filters
          </div>
        </div>
        <ul className="divide-y divide-border">
          {ROWS.map((r) => (
            <li key={r.number} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[1.25fr_1fr_auto_auto]">
              <div className="min-w-0">
                <p className="font-mono text-[13px] font-medium tabular">{r.number}</p>
                <p className="text-xs text-muted-foreground">
                  {r.country} · {r.region}
                </p>
              </div>
              <p className="order-3 col-span-2 truncate text-xs text-muted-foreground sm:order-none sm:col-span-1">{r.services.join(", ")}</p>
              <span className="font-mono text-[13px] tabular sm:text-right">{r.price}</span>
              <span className="hidden sm:block">
                <Badge tone={r.status === "AVAILABLE" ? "success" : "warning"} dot>
                  {r.status === "AVAILABLE" ? "Available" : "Reserved"}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border bg-surface-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Illustrative rows only. Real sandbox inventory appears after you sign in.
        </div>
      </div>
    </figure>
  );
}
