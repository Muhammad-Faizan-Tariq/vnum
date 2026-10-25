import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Select number", "Review order", "Payment", "Confirmation"] as const;

/** `current` is 1-based. Rendered as an ordered list so assistive tech announces progress. */
export function CheckoutSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" aria-label="Purchase progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const here = n === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={here ? "step" : undefined}>
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-success bg-success-soft text-success",
                here && "border-accent bg-accent text-accent-foreground",
                !done && !here && "border-border-strong text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3" aria-hidden /> : n}
            </span>
            <span className={cn(here ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
            {n < STEPS.length && <span className="mx-1 hidden h-px w-6 bg-border-strong sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
