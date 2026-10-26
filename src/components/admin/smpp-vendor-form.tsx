"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import { apiRequest } from "@/lib/api-client";

type Initial = {
  id?: string;
  name: string;
  host: string;
  port: number;
  systemId: string;
  systemType: string;
  notes: string | null;
  enabled: boolean;
};

const EMPTY: Initial = { name: "", host: "", port: 2775, systemId: "", systemType: "", notes: "", enabled: true };

export function SmppVendorForm({ initial = EMPTY }: { initial?: Initial }) {
  const router = useRouter();
  const editing = !!initial.id;
  const [s, setS] = useState({ ...initial, port: String(initial.port), notes: initial.notes ?? "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));
  const err = (k: string) => fields[k];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const body = {
      name: s.name,
      host: s.host,
      port: Number(s.port),
      systemId: s.systemId,
      systemType: s.systemType,
      notes: s.notes,
      enabled: s.enabled,
      ...(s.password ? { password: s.password } : editing ? {} : { password: "" }),
    };
    const res = editing
      ? await apiRequest(`/api/admin/smpp-vendors/${initial.id}`, "PATCH", body)
      : await apiRequest("/api/admin/smpp-vendors", "POST", body);
    setBusy(false);
    if (!res.ok) {
      setFields(res.error.fields ?? {});
      setError(res.error.fields ? "Fix the highlighted fields." : res.error.message);
      return;
    }
    toast.success(editing ? "Vendor updated. The worker will reconnect." : "Vendor created. The worker will connect shortly.");
    router.push("/admin/smpp");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate data-testid="smpp-vendor-form">
      {error && <Notice tone="danger">{error}</Notice>}
      <Field label="Vendor name" htmlFor="name" error={err("name")}>
        <Input id="name" value={s.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Telenor SMPP Gateway" aria-invalid={!!err("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="SMPP host / IP" htmlFor="host" error={err("host")} hint="Hostname or IP only. Use 127.0.0.1 for the local simulator.">
          <Input id="host" value={s.host} onChange={(e) => set("host", e.target.value)} placeholder="smpp.vendor.com" autoCapitalize="none" aria-invalid={!!err("host")} />
        </Field>
        <Field label="Port" htmlFor="port" error={err("port")}>
          <Input id="port" inputMode="numeric" value={s.port} onChange={(e) => set("port", e.target.value)} aria-invalid={!!err("port")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="System ID / username" htmlFor="systemId" error={err("systemId")}>
          <Input id="systemId" value={s.systemId} onChange={(e) => set("systemId", e.target.value)} autoComplete="off" aria-invalid={!!err("systemId")} />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={err("password")}
          hint={editing ? "Leave blank to keep the saved password. It is stored encrypted and never shown." : "Stored encrypted; never shown again."}
        >
          <Input id="password" type="password" value={s.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" aria-invalid={!!err("password")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bind type" htmlFor="bind" hint="VNum only receives messages, so the bind is always a receiver.">
          <Select id="bind" value="receiver" disabled>
            <option value="receiver">Receiver (receive-only)</option>
          </Select>
        </Field>
        <Field label="System type (optional)" htmlFor="systemType" error={err("systemType")}>
          <Input id="systemType" value={s.systemType} onChange={(e) => set("systemType", e.target.value)} aria-invalid={!!err("systemType")} />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="notes" error={err("notes")}>
        <Textarea id="notes" rows={3} value={s.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={s.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 accent-[var(--accent)]" />
        Enabled (the worker keeps this vendor bound)
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {editing ? "Save changes" : "Create vendor"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/admin/smpp")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
