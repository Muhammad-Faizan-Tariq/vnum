import { cn, titleCase } from "@/lib/utils";

const tones = {
  neutral: "bg-surface-muted text-muted-foreground ring-border",
  accent: "bg-accent-soft text-accent-soft-foreground ring-accent/25",
  success: "bg-success-soft text-success ring-success/25",
  warning: "bg-warning-soft text-warning ring-warning/30",
  danger: "bg-danger-soft text-danger ring-danger/25",
  info: "bg-info-soft text-info ring-info/25",
} as const;

export type Tone = keyof typeof tones;

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  // orders
  PENDING_PAYMENT: "warning",
  PAID_SANDBOX: "info",
  PROCESSING: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  FAILED: "danger",
  // payments
  PENDING: "warning",
  CONFIRMED: "success",
  EXPIRED: "neutral",
  // numbers
  AVAILABLE: "success",
  RESERVED: "warning",
  SOLD: "neutral",
  DISABLED: "danger",
  // messages
  QUEUED: "neutral",
  SUBMITTED: "info",
  DELIVERED: "success",
  UNDELIVERABLE: "danger",
  REJECTED: "danger",
  // users
  ACTIVE: "success",
  SUSPENDED: "danger",
  ADMIN: "accent",
  USER: "neutral",
};

const LABELS: Record<string, string> = {
  PAID_SANDBOX: "Paid (sandbox)",
  PENDING_PAYMENT: "Pending payment",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} dot className={className}>
      {LABELS[status] ?? titleCase(status)}
    </Badge>
  );
}
