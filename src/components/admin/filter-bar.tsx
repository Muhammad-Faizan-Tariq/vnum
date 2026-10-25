import Link from "next/link";
import { Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

/** Plain GET form: filters live in the URL, so results are shareable and need no client JS. */
export function FilterBar({ action, children }: { action: string; children: React.ReactNode }) {
  return (
    <form method="get" action={action} role="search" className="mb-4 flex flex-wrap items-end gap-2">
      {children}
      <Button type="submit" variant="secondary">Apply</Button>
      <Link href={action} className={buttonVariants({ variant: "ghost" })}>
        Reset
      </Link>
    </form>
  );
}

export function SearchField({ name = "q", value, label, placeholder }: { name?: string; value?: string; label: string; placeholder: string }) {
  return (
    <div className="min-w-48 flex-1 sm:max-w-xs">
      <label htmlFor={`f-${name}`} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id={`f-${name}`} name={name} defaultValue={value} placeholder={placeholder} className="pl-8" />
      </div>
    </div>
  );
}

export function SelectField({
  name,
  label,
  value,
  options,
  allLabel = "All",
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <div className="min-w-36">
      <label htmlFor={`f-${name}`} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Select id={`f-${name}`} name={name} defaultValue={value ?? ""}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </div>
  );
}
