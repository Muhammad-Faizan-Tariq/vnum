import Link from "next/link";
import { ArrowLeft, FlaskConical, MessageSquareText, ReceiptText } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";

const POINTS = [
  { icon: FlaskConical, title: "Test inventory only", body: "Every number is seeded demo data. Nothing is registered with a carrier." },
  { icon: ReceiptText, title: "Sandbox checkout", body: "Crypto options are simulated: no funds move and no addresses are real." },
  { icon: MessageSquareText, title: "Simulated SMPP", body: "Incoming messages come from an in-app simulator. VNum cannot send SMS." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:grid-cols-[minmax(0,1fr)_32rem]">
      <div className="flex flex-col px-5 py-5 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <footer className="text-[13px] text-muted-foreground">
          <Link href="/" className="inline-flex items-center gap-1.5 hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden /> Back to home
          </Link>
        </footer>
      </div>
      <aside className="hidden border-l border-border bg-surface-muted/60 px-10 py-16 lg:flex lg:flex-col lg:justify-center" aria-label="About this sandbox">
        <p className="eyebrow">Assessment sandbox</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">A realistic workflow, with nothing real behind it.</h2>
        <ul className="mt-8 space-y-6">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <p.icon className="mt-0.5 size-[18px] shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
