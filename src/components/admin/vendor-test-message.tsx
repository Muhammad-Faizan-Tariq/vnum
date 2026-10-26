"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";
import { apiRequest } from "@/lib/api-client";

/** One-click test for non-technical users: the simulator delivers a message through the real SMPP path. */
export function VendorTestMessage({ vendorId, defaultTo }: { vendorId: string; defaultTo: string }) {
  const router = useRouter();
  const [to, setTo] = useState(defaultTo);
  const [text, setText] = useState("Your VNum test code is 123456");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const res = await apiRequest(`/api/admin/smpp-vendors/${vendorId}/test-message`, "POST", { to, text });
    setBusy(false);
    if (!res.ok) {
      setFields(res.error.fields ?? {});
      if (!res.error.fields) setError(res.error.message);
      return;
    }
    toast.success("Delivered through SMPP. It appears under Recent traffic and in the owner's inbox.");
    // The worker stores it a moment after the simulator pushes it.
    setTimeout(() => router.refresh(), 1200);
  }

  return (
    <form onSubmit={send} className="space-y-3.5" data-testid="vendor-test-message" noValidate>
      <Field label="Destination number" htmlFor="tm-to" error={fields.to} hint="A number a customer has bought, or any number to see it arrive as “not routed”.">
        <Input id="tm-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+12065550153" aria-invalid={!!fields.to} />
      </Field>
      <Field label="Message" htmlFor="tm-text" error={fields.text}>
        <Input id="tm-text" value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!fields.text} />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" loading={busy} data-testid="send-test-sms">
        Deliver test SMS
      </Button>
    </form>
  );
}
