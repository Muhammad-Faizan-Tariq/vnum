import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="6" className="fill-accent" />
      <path
        d="M6.5 7.5 12 17l5.5-9.5"
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7.2" r="1.35" fill="var(--accent-foreground)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)} aria-label="VNum home">
      <LogoMark />
      <span className="text-[17px]">VNum</span>
    </Link>
  );
}
