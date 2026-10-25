import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-surface shadow-sm", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const noticeTones = {
  info: { cls: "border-info/30 bg-info-soft text-foreground", icon: Info, iconCls: "text-info" },
  success: { cls: "border-success/30 bg-success-soft text-foreground", icon: CheckCircle2, iconCls: "text-success" },
  warning: { cls: "border-warning/35 bg-warning-soft text-foreground", icon: TriangleAlert, iconCls: "text-warning" },
  danger: { cls: "border-danger/30 bg-danger-soft text-foreground", icon: AlertCircle, iconCls: "text-danger" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: keyof typeof noticeTones;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const t = noticeTones[tone];
  const Icon = t.icon;
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : undefined)}
      className={cn("flex gap-3 rounded-md border px-3.5 py-3 text-sm", t.cls, className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.iconCls)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-[13px] leading-relaxed text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-border bg-surface-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-muted", className)} aria-hidden />;
}

export function SimulatedTag({ className, label = "Simulated" }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-dashed border-border-strong px-1.5 py-px font-mono text-[10px] leading-4 font-semibold tracking-wider text-muted-foreground uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Server-rendered pagination that keeps every other query parameter. */
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  basePath,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4 text-[13px] text-muted-foreground">
      <p className="tabular">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
        <span className="tabular px-1">
          Page {page} of {pages}
        </span>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pages}
          tabIndex={page >= pages ? -1 : undefined}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn("border-b border-border bg-surface-muted/60 px-4 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground", className)}
      {...props}
    />
  );
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border px-4 py-2.5 align-middle", className)} {...props} />;
}
