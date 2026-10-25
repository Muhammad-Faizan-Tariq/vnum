"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bitcoin, CircleDollarSign, Copy, Check, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice, SimulatedTag } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LIST } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";
import {
  changePasswordAction,
  createOrderAction,
  simulateInboundAction,
  simulatePaymentAction,
  startPaymentAction,
  updateProfileAction,
  type ActionState,
} from "@/app/dashboard/actions";

const none: ActionState = {};

/** Fire a toast whenever a server action reports success. */
function useSuccessToast(state: ActionState) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
}

export function CreateOrderForm({ numberId, idempotencyKey, price }: { numberId: string; idempotencyKey: string; price: string }) {
  const [state, action, pending] = useActionState(createOrderAction, none);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="numberId" value={numberId} />
      <input type="hidden" name="key" value={idempotencyKey} />
      {state.error && (
        <Notice tone="danger" title={state.code === "NUMBER_UNAVAILABLE" ? "Number no longer available" : "Couldn't create the order"}>
          {state.error}
        </Notice>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending} data-testid="confirm-order">
        {pending ? "Reserving number…" : `Confirm order · ${price}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        The number is held for you while you pay. No real charge is made.
      </p>
    </form>
  );
}

const METHOD_ICON: Record<string, LucideIcon> = { BTC: Bitcoin, USDT: CircleDollarSign };

export function PaymentMethodForm({
  orderId,
  amountCents,
  current,
}: {
  orderId: string;
  amountCents: number;
  current?: string;
}) {
  const [state, action, pending] = useActionState(startPaymentAction, none);
  const [selected, setSelected] = useState(current ?? "");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Payment method</legend>
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border-strong" role="radiogroup">
          {PAYMENT_METHOD_LIST.map((m) => {
            const Icon = METHOD_ICON[m.symbol] ?? CircleDollarSign;
            const amount = (amountCents / 100 / m.rateUsd).toFixed(m.decimals);
            return (
              <label
                key={m.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ring",
                  selected === m.id ? "bg-accent-soft" : "bg-surface hover:bg-surface-muted",
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.id}
                  checked={selected === m.id}
                  onChange={() => setSelected(m.id)}
                  className="size-4 accent-[var(--accent)]"
                />
                <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {m.label} <span className="font-normal text-muted-foreground">({m.symbol})</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{m.network}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-sm tabular">
                    {amount} {m.symbol}
                  </span>
                  <SimulatedTag />
                </span>
              </label>
            );
          })}
        </div>
        {state.fields?.method && (
          <p role="alert" className="mt-1.5 text-[13px] text-danger">
            {state.error}
          </p>
        )}
      </fieldset>
      {state.error && !state.fields && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" size="lg" variant={current ? "secondary" : "primary"} className="w-full" loading={pending} data-testid="start-payment">
        {current ? "Switch payment method" : "Continue to payment"}
      </Button>
    </form>
  );
}

const SCENARIOS = [
  { id: "confirm", label: "Confirm payment", hint: "Network delivers the full amount", variant: "primary" as const },
  { id: "underpay", label: "Send half the amount", hint: "Underpayment is detected and rejected", variant: "secondary" as const },
  { id: "fail", label: "Network failure", hint: "Provider reports a failed attempt", variant: "secondary" as const },
  { id: "expire", label: "Let it expire", hint: "Window closes, order is cancelled", variant: "secondary" as const },
];

export function PaymentSimulator({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(simulatePaymentAction, none);
  const [last, setLast] = useState<string>("");
  return (
    <div className="rounded-md border border-dashed border-border-strong p-4" data-testid="payment-simulator">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Sandbox controls</h3>
        <SimulatedTag label="Demo only" />
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        There is no blockchain here. These buttons stand in for the payment network by sending a signed event to the
        server, which verifies it exactly as it would a real callback.
      </p>
      {state.error && (
        <Notice tone="danger" className="mt-3" title={state.code === "FAILED" ? "Payment attempt failed" : "Couldn't apply that"}>
          {state.error}
        </Notice>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SCENARIOS.map((s) => (
          <form action={action} key={s.id}>
            <input type="hidden" name="paymentId" value={paymentId} />
            <input type="hidden" name="scenario" value={s.id} />
            <Button
              type="submit"
              variant={s.variant}
              className="h-auto w-full flex-col items-start gap-0 py-2 text-left"
              disabled={pending}
              onClick={() => setLast(s.id)}
              data-testid={`simulate-${s.id}`}
            >
              <span className="flex items-center gap-2">
                {pending && last === s.id && <RefreshCw className="size-3.5 animate-spin" aria-hidden />}
                {s.label}
              </span>
              <span className={cn("text-xs font-normal", s.variant === "primary" ? "text-accent-foreground/80" : "text-muted-foreground")}>
                {s.hint}
              </span>
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}

export function InboxSimulateForm({ numberId }: { numberId: string }) {
  const [state, action, pending] = useActionState(simulateInboundAction, none);
  const ref = useRef<HTMLFormElement>(null);
  useSuccessToast(state);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3.5">
      <input type="hidden" name="numberId" value={numberId} />
      <Field label="Sender" htmlFor="inbox-from" hint="Name or number the message appears to come from." error={state.fields?.from}>
        <Input id="inbox-from" name="from" defaultValue="VNUM-DEMO" maxLength={30} />
      </Field>
      <Field label="Message" htmlFor="inbox-body" hint="Leave empty to generate a verification-code SMS.">
        <Textarea id="inbox-body" name="body" rows={3} maxLength={320} placeholder="Your code is 123456" />
      </Field>
      {state.error && (
        <Notice tone="danger" title={state.code ? `Delivery failed · ${state.code}` : undefined}>
          {state.error}
        </Notice>
      )}
      <Button type="submit" loading={pending} data-testid="inbox-simulate">
        Deliver simulated SMS
      </Button>
    </form>
  );
}

export function AutoRefresh({ active, intervalMs = 1500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}

export function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        setSpinning(true);
        router.refresh();
        setTimeout(() => setSpinning(false), 600);
      }}
    >
      <RefreshCw className={cn("size-3.5", spinning && "animate-spin")} aria-hidden /> Refresh
    </Button>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, none);
  useSuccessToast(state);
  return (
    <form action={action} className="max-w-md space-y-4">
      <Field label="Display name" htmlFor="name" error={state.fields?.name}>
        <Input id="name" name="name" defaultValue={name} aria-invalid={!!state.fields?.name} aria-describedby={state.fields?.name ? "name-error" : undefined} />
      </Field>
      <Field label="Email" htmlFor="email" hint="Email changes aren't available in the sandbox.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <Button type="submit" loading={pending}>Save changes</Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, none);
  const ref = useRef<HTMLFormElement>(null);
  useSuccessToast(state);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="max-w-md space-y-4">
      <Field label="Current password" htmlFor="current" error={state.fields?.current}>
        <Input id="current" name="current" type="password" autoComplete="current-password" aria-invalid={!!state.fields?.current} aria-describedby={state.fields?.current ? "current-error" : undefined} />
      </Field>
      <Field label="New password" htmlFor="next" error={state.fields?.next} hint="At least 10 characters, with a letter and a number.">
        <Input id="next" name="next" type="password" autoComplete="new-password" aria-invalid={!!state.fields?.next} aria-describedby={state.fields?.next ? "next-error" : "next-hint"} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>Update password</Button>
    </form>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted/60 px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs" aria-label={label}>
        {value}
      </code>
      <button
        type="button"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-surface hover:text-foreground"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error("Couldn't copy. Select the text manually.");
          }
        }}
      >
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

export function Countdown({ to }: { to: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const router = useRouter();
  useEffect(() => {
    const end = new Date(to).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to]);
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);
  if (left === null) return <span className="font-mono tabular">--:--</span>;
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return (
    <span className={cn("font-mono tabular", left < 60 && "text-danger")} data-testid="countdown">
      {m}:{s}
    </span>
  );
}
