import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Pricing",
  description: "VNum sandbox plans. All plans are free; checkout amounts are simulated.",
};

const PLANS = [
  {
    id: "explorer",
    name: "Explorer",
    summary: "Look around the catalogue without an account.",
    cta: { href: "/#features", label: "See features", primary: false },
  },
  {
    id: "buyer",
    name: "Sandbox buyer",
    summary: "Create an account, place orders and test messaging.",
    cta: { href: "/sign-up", label: "Create account", primary: true },
  },
  {
    id: "admin",
    name: "Evaluation admin",
    summary: "Manage inventory, orders and payments. Use the demo admin login.",
    cta: { href: "/sign-in", label: "Sign in as admin", primary: false },
  },
];

type Cell = boolean | string;
const FEATURES: { label: string; values: [Cell, Cell, Cell] }[] = [
  { label: "Marketing site and documentation", values: [true, true, true] },
  { label: "Browse and filter test inventory", values: [false, true, true] },
  { label: "Place orders and sandbox checkout", values: [false, true, true] },
  { label: "Simulated crypto payment scenarios", values: [false, true, true] },
  { label: "Order history and payment status", values: [false, true, true] },
  { label: "Simulated SMPP message testing", values: [false, true, true] },
  { label: "Create and edit demo numbers", values: [false, false, true] },
  { label: "Apply order status transitions", values: [false, false, true] },
  { label: "Manage users and settings", values: [false, false, true] },
  { label: "Real cost", values: ["$0", "$0", "$0"] },
];

const BANDS = [
  { country: "United States", range: "$1.50 – $4.50" },
  { country: "Canada", range: "$1.80 – $4.20" },
  { country: "United Kingdom", range: "$2.20 – $6.20" },
  { country: "Germany", range: "$2.60 – $7.20" },
  { country: "France", range: "$2.50 – $6.60" },
];

function CellView({ v }: { v: Cell }) {
  if (typeof v === "string") return <span className="font-mono text-[13px] tabular">{v}</span>;
  return v ? (
    <>
      <Check className="mx-auto size-4 text-success" aria-hidden />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <Minus className="mx-auto size-4 text-muted-foreground/60" aria-hidden />
      <span className="sr-only">Not included</span>
    </>
  );
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Pricing</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Three sandbox plans. None of them cost anything.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          VNum is an assessment environment. The plans below describe what each kind of user can do. The amounts
          shown at checkout are simulated so the flow feels realistic; no payment method is ever charged.
        </p>
      </div>

      <div className="relative mt-10 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Comparison of VNum sandbox plans</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[40%] border-b border-border p-4 align-bottom">
                <span className="eyebrow">What you can do</span>
              </th>
              {PLANS.map((p) => (
                <th key={p.id} scope="col" className="border-b border-l border-border p-4 align-top font-normal" data-testid={`plan-${p.id}`}>
                  <p className="text-base font-semibold">{p.name}</p>
                  <p className="mt-0.5 mb-3 text-[13px] leading-snug text-muted-foreground">{p.summary}</p>
                  <Link href={p.cta.href} className={buttonVariants({ variant: p.cta.primary ? "primary" : "secondary", size: "sm" })}>
                    {p.cta.label}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.label}>
                <th scope="row" className="border-b border-border px-4 py-2.5 text-[13px] font-normal">
                  {f.label}
                </th>
                {f.values.map((v, i) => (
                  <td key={i} className="border-b border-l border-border px-4 py-2.5 text-center">
                    <CellView v={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Simulated per-number prices</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Each number in the test inventory has a one-time price. These bands describe the seeded catalogue and are
            illustrative only. Pay with simulated BTC or USDT; the conversion uses a fixed rate, not a market price.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Simulated price band per country</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-border bg-surface-muted/60 px-4 py-2 text-left text-xs font-medium text-muted-foreground">Country</th>
                <th scope="col" className="border-b border-border bg-surface-muted/60 px-4 py-2 text-right text-xs font-medium text-muted-foreground">One-time price (simulated)</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map((b) => (
                <tr key={b.country} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">{b.country}</th>
                  <td className="px-4 py-2.5 text-right font-mono text-[13px] tabular">{b.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Notice tone="info" title="No real transactions" className="mt-10">
        Nothing on this page represents a commercial offer. If VNum became a real service, plans, prices and terms would be published separately.
      </Notice>
    </div>
  );
}
