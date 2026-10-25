import { Notice } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";

export function LegalPage({
  title,
  intro,
  sections,
  children,
}: {
  title: string;
  intro: string;
  sections?: { heading: string; body: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge tone="warning" className="mb-3">Draft</Badge>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>
      <Notice tone="warning" title="Draft demo content" className="mt-6">
        This page is placeholder text for an assessment sandbox. It is not legal advice and no real business entity stands behind it.
      </Notice>
      <div className="mt-10 space-y-8">
        {sections?.map((s, i) => (
          <section key={s.heading}>
            <h2 className="text-base font-semibold">
              <span className="mr-2 font-mono text-sm text-muted-foreground tabular">{i + 1}.</span>
              {s.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
        {children}
      </div>
    </div>
  );
}
