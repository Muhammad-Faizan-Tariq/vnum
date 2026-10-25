import type { Metadata } from "next";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings · Admin" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  // Presence only: values (and anything secret) are never rendered.
  const health = [
    { label: "Database connection string", ok: !!process.env.DATABASE_URL },
    { label: "Payment callback secret", ok: (process.env.PAYMENT_WEBHOOK_SECRET?.length ?? 0) >= 16 },
    { label: "Demo mode", ok: process.env.DEMO_MODE !== "false", text: process.env.DEMO_MODE === "false" ? "off" : "on" },
  ];
  return (
    <>
      <PageHeader title="Settings" description="Safe, application-level behaviour for the demo. Secrets are configured through environment variables and never shown here." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card className="p-5">
          <SettingsForm initial={settings} />
        </Card>
        <Card className="self-start">
          <CardHeader title="Environment" description="Configured or not. Values are hidden." />
          <ul className="divide-y divide-border text-sm" data-testid="env-health">
            {health.map((h) => (
              <li key={h.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>{h.label}</span>
                <span className={`inline-flex items-center gap-1.5 text-[13px] ${h.ok ? "text-success" : "text-danger"}`}>
                  {h.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
                  {h.text ?? (h.ok ? "Configured" : "Missing")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
