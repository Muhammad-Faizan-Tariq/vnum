"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import { apiRequest } from "@/lib/api-client";

export type NumberFormValues = {
  e164: string;
  countryCode: string;
  countryName: string;
  region: string;
  price: string;
  serviceSlugs: string[];
  smsInbound: boolean;
  voice: boolean;
  status: "AVAILABLE" | "DISABLED" | "RESERVED" | "SOLD";
};

export function NumberForm({
  mode,
  numberId,
  initial,
  services,
  identityLocked,
  statusLocked,
}: {
  mode: "create" | "edit";
  numberId?: string;
  initial: NumberFormValues;
  services: { slug: string; name: string }[];
  identityLocked: boolean;
  statusLocked: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const set = <K extends keyof NumberFormValues>(k: K, val: NumberFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});
    const dollars = Number(v.price);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setFields({ priceCents: "Enter a price greater than 0" });
      return;
    }
    setBusy(true);
    const payload = {
      e164: v.e164.trim(),
      countryCode: v.countryCode.trim().toUpperCase(),
      countryName: v.countryName.trim(),
      region: v.region.trim(),
      priceCents: Math.round(dollars * 100),
      serviceSlugs: v.serviceSlugs,
      smsInbound: v.smsInbound,
      voice: v.voice,
      status: v.status,
    };
    const res =
      mode === "create"
        ? await apiRequest<{ id: string }>("/api/admin/numbers", "POST", payload)
        : await apiRequest(`/api/admin/numbers/${numberId}`, "PATCH", payload);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      if (res.error.fields) setFields(res.error.fields);
      return;
    }
    toast.success(mode === "create" ? "Number created" : "Number updated");
    if (mode === "create") router.push(`/admin/numbers/${(res.data as { id: string }).id}`);
    else router.refresh();
  }

  const statusOptions =
    v.status === "RESERVED" || v.status === "SOLD"
      ? [v.status]
      : (["AVAILABLE", "DISABLED"] as const);

  return (
    <form onSubmit={submit} className="space-y-5" noValidate data-testid="number-form">
      {error && (
        <Notice tone="danger" title="Not saved">
          {error}
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Number (E.164)" htmlFor="e164" error={fields.e164} hint={identityLocked ? "Locked: this number has orders." : "e.g. +14155550123"}>
          <Input id="e164" value={v.e164} onChange={(e) => set("e164", e.target.value)} disabled={identityLocked} className="font-mono" aria-invalid={!!fields.e164} required />
        </Field>
        <Field label="Price (USD)" htmlFor="price" error={fields.priceCents} hint="Existing orders keep the price they were placed at.">
          <Input id="price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} aria-invalid={!!fields.priceCents} required />
        </Field>
        <Field label="Country code" htmlFor="countryCode" error={fields.countryCode} hint={identityLocked ? "Locked: this number has orders." : "ISO 3166-1 alpha-2"}>
          <Input id="countryCode" value={v.countryCode} onChange={(e) => set("countryCode", e.target.value.toUpperCase())} maxLength={2} disabled={identityLocked} className="font-mono uppercase" aria-invalid={!!fields.countryCode} required />
        </Field>
        <Field label="Country name" htmlFor="countryName" error={fields.countryName}>
          <Input id="countryName" value={v.countryName} onChange={(e) => set("countryName", e.target.value)} disabled={identityLocked} aria-invalid={!!fields.countryName} required />
        </Field>
        <Field label="Region (optional)" htmlFor="region" error={fields.region}>
          <Input id="region" value={v.region} onChange={(e) => set("region", e.target.value)} />
        </Field>
        <Field label="Availability" htmlFor="status" hint={statusLocked ? "Managed by the order flow while reserved, sold or on an active order." : "Reserved and Sold are set automatically by orders."}>
          <Select id="status" value={v.status} onChange={(e) => set("status", e.target.value as NumberFormValues["status"])} disabled={statusLocked}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Supported services</legend>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
            const on = v.serviceSlugs.includes(s.slug);
            return (
              <label
                key={s.slug}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[13px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--accent)]"
                  checked={on}
                  onChange={() => set("serviceSlugs", on ? v.serviceSlugs.filter((x) => x !== s.slug) : [...v.serviceSlugs, s.slug])}
                />
                {s.name}
              </label>
            );
          })}
        </div>
        {fields.serviceSlugs && <p className="mt-1 text-[13px] text-danger">{fields.serviceSlugs}</p>}
      </fieldset>

      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={v.smsInbound} onChange={(e) => set("smsInbound", e.target.checked)} />
          Receives SMS
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={v.voice} onChange={(e) => set("voice", e.target.checked)} />
          Voice capable (label only)
        </label>
      </div>

      <div className="flex gap-2 border-t border-border pt-4">
        <Button type="submit" loading={busy}>
          {mode === "create" ? "Create number" : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/admin/numbers")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
