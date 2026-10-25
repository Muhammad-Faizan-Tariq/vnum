import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Contact (placeholder)" };

const ROWS = [
  { label: "Support email", value: "support@example.invalid" },
  { label: "Business name", value: "[Placeholder — no registered entity]" },
  { label: "Postal address", value: "[Placeholder — not provided]" },
  { label: "Response time", value: "[Placeholder — no support commitment]" },
];

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      intro="VNum is a sandbox without a staffed support desk. The details below are placeholders to show where real contact information would go."
    >
      <dl className="divide-y divide-border border-y border-border">
        {ROWS.map((r) => (
          <div key={r.label} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm font-medium">{r.label}</dt>
            <dd className="font-mono text-[13px] text-muted-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        For questions about how the sandbox behaves, start with the <Link href="/faq" className="font-medium text-accent hover:underline">FAQ</Link>.
        The address above is not monitored.
      </p>
    </LegalPage>
  );
}
