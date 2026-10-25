"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/primitives";

const initial: AuthFormState = {};

export function SignInForm({ next, demo }: { next?: string; demo?: { admin: string; customer: string; adminPassword: string; customerPassword: string } }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <Notice tone="danger" title="Couldn't sign you in">
          {state.error}
        </Notice>
      )}
      <Field label="Email" htmlFor="email" error={state.fields?.email}>
        <Input
          id="email" name="email" type="email" autoComplete="email" required
          defaultValue={state.values?.email}
          aria-invalid={!!state.fields?.email}
          aria-describedby={state.fields?.email ? "email-error" : undefined}
        />
      </Field>
      <Field label="Password" htmlFor="password" error={state.fields?.password}>
        <Input
          id="password" name="password" type="password" autoComplete="current-password" required
          aria-invalid={!!state.fields?.password}
          aria-describedby={state.fields?.password ? "password-error" : undefined}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {demo && (
        <div className="rounded-md border border-dashed border-border-strong p-3 text-[13px]" data-testid="demo-credentials">
          <p className="font-medium">Demo accounts</p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
            <dt>Customer</dt>
            <dd className="font-mono text-xs break-all">{demo.customer} / {demo.customerPassword}</dd>
            <dt>Admin</dt>
            <dd className="font-mono text-xs break-all">{demo.admin} / {demo.adminPassword}</dd>
          </dl>
        </div>
      )}
      <p className="text-center text-sm text-muted-foreground">
        New to VNum?{" "}
        <Link href="/sign-up" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const f = state.fields ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && (
        <Notice tone="danger" title="Couldn't create the account">
          {state.error}
        </Notice>
      )}
      <Field label="Full name" htmlFor="name" error={f.name}>
        <Input id="name" name="name" autoComplete="name" required defaultValue={state.values?.name} aria-invalid={!!f.name} aria-describedby={f.name ? "name-error" : undefined} />
      </Field>
      <Field label="Email" htmlFor="email" error={f.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} aria-invalid={!!f.email} aria-describedby={f.email ? "email-error" : undefined} />
      </Field>
      <Field label="Password" htmlFor="password" error={f.password} hint="At least 10 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!f.password} aria-describedby={f.password ? "password-error" : "password-hint"} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-[13px] text-muted-foreground">
        By continuing you agree this is a sandbox. See the <Link href="/terms" className="underline">draft terms</Link> and <Link href="/privacy" className="underline">privacy notice</Link>.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
