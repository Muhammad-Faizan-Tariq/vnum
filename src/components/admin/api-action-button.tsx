"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";

type Props = {
  url: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  label: string;
  successMessage?: string;
  /** When set, the action asks for confirmation in a dialog first. */
  confirm?: { title: string; description: string; confirmLabel?: string };
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  testId?: string;
  className?: string;
};

/** Button that performs one authorized admin API call, then refreshes server data. */
export function ApiActionButton({
  url,
  method = "POST",
  body,
  label,
  successMessage,
  confirm,
  variant = "secondary",
  size = "sm",
  testId,
  className,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function run() {
    setBusy(true);
    const res = await apiRequest(url, method, body);
    setBusy(false);
    setOpen(false);
    if (res.ok) {
      toast.success(successMessage ?? `${label}: done`);
      router.refresh();
    } else {
      toast.error(res.error.message);
    }
  }

  if (!confirm) {
    return (
      <Button variant={variant} size={size} onClick={run} loading={busy} data-testid={testId} className={className}>
        {label}
      </Button>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={variant} size={size} data-testid={testId} className={className}>
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-md">
          <Dialog.Title className="text-base font-semibold">{confirm.title}</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">{confirm.description}</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button variant={variant === "dangerOutline" ? "danger" : "primary"} onClick={run} loading={busy} data-testid="confirm-action">
              {confirm.confirmLabel ?? label}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
