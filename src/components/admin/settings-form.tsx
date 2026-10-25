"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import { apiRequest } from "@/lib/api-client";
import type { AppSettings } from "@/server/settings";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [s, setS] = useState({
    paymentWindowMinutes: String(initial.paymentWindowMinutes),
    autoFulfil: initial.autoFulfil,
    registrationOpen: initial.registrationOpen,
    smppMode: initial.smpp.mode,
    label: initial.weatherFallback.label,
    latitude: String(initial.weatherFallback.latitude),
    longitude: String(initial.weatherFallback.longitude),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const res = await apiRequest("/api/admin/settings", "PUT", {
      paymentWindowMinutes: Number(s.paymentWindowMinutes),
      autoFulfil: s.autoFulfil,
      registrationOpen: s.registrationOpen,
      smpp: { mode: s.smppMode },
      weatherFallback: { label: s.label, latitude: Number(s.latitude), longitude: Number(s.longitude) },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      setFields(res.error.fields ?? {});
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  const check = "size-4 accent-[var(--accent)]";
  return (
    <form onSubmit={submit} className="space-y-8" noValidate data-testid="settings-form">
      {error && <Notice tone="danger" title="Not saved">{error}</Notice>}

      <section aria-labelledby="s-orders" className="space-y-4">
        <h2 id="s-orders" className="text-sm font-semibold">Orders and checkout</h2>
        <Field label="Payment window (minutes)" htmlFor="paymentWindowMinutes" error={fields.paymentWindowMinutes} hint="Unpaid orders expire after this long and the number returns to inventory.">
          <Input id="paymentWindowMinutes" inputMode="numeric" className="max-w-40" value={s.paymentWindowMinutes} onChange={(e) => set("paymentWindowMinutes", e.target.value)} aria-invalid={!!fields.paymentWindowMinutes} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className={`${check} mt-0.5`} checked={s.autoFulfil} onChange={(e) => set("autoFulfil", e.target.checked)} />
          <span>
            <span className="font-medium">Provision automatically after payment</span>
            <span className="block text-[13px] text-muted-foreground">When off, paid orders wait for an administrator to move them to Processing and Completed.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" className={`${check} mt-0.5`} checked={s.registrationOpen} onChange={(e) => set("registrationOpen", e.target.checked)} />
          <span>
            <span className="font-medium">Allow new registrations</span>
            <span className="block text-[13px] text-muted-foreground">Existing users can always sign in.</span>
          </span>
        </label>
      </section>

      <section aria-labelledby="s-smpp" className="space-y-4 border-t border-border pt-6">
        <h2 id="s-smpp" className="text-sm font-semibold">SMPP simulator</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link state" htmlFor="smppMode" hint="Simulate an outage or throttling to exercise error handling.">
            <Select id="smppMode" value={s.smppMode} onChange={(e) => set("smppMode", e.target.value as typeof s.smppMode)}>
              <option value="online">Online (bound)</option>
              <option value="offline">Offline (bind failure)</option>
              <option value="throttled">Throttled</option>
            </Select>
          </Field>
        </div>
      </section>

      <section aria-labelledby="s-weather" className="space-y-4 border-t border-border pt-6">
        <h2 id="s-weather" className="text-sm font-semibold">Default weather location</h2>
        <p className="-mt-2 text-[13px] text-muted-foreground">Used by the greeting card until a user shares their own location. Weather comes from Open-Meteo.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Place name" htmlFor="label" error={fields["weatherFallback.label"]}>
            <Input id="label" value={s.label} onChange={(e) => set("label", e.target.value)} />
          </Field>
          <Field label="Latitude" htmlFor="latitude" error={fields["weatherFallback.latitude"]}>
            <Input id="latitude" inputMode="decimal" value={s.latitude} onChange={(e) => set("latitude", e.target.value)} />
          </Field>
          <Field label="Longitude" htmlFor="longitude" error={fields["weatherFallback.longitude"]}>
            <Input id="longitude" inputMode="decimal" value={s.longitude} onChange={(e) => set("longitude", e.target.value)} />
          </Field>
        </div>
      </section>

      <div className="border-t border-border pt-4">
        <Button type="submit" loading={busy}>Save settings</Button>
      </div>
    </form>
  );
}
