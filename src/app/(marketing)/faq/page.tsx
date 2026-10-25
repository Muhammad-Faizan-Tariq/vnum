import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Honest answers about what VNum simulates and what it does not.",
};

const GROUPS: { title: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    title: "The sandbox",
    items: [
      { q: "What is VNum?", a: "A working model of a virtual number platform for testing and evaluation. You can browse inventory, place orders, run a checkout and test messaging, with everything behind those steps simulated." },
      { q: "Are the phone numbers real?", a: "No. Every number is test data from a demo catalogue. They are not active on any telecom network and cannot receive real calls or texts. Several use ranges reserved for fictional use." },
      { q: "Can I use a VNum number to register with an online service?", a: "No. Service names on a number are labels in the demo catalogue. Nothing is registered with those services and real verification codes will never arrive." },
      { q: "Who is it for?", a: "People assessing the product, its design and its engineering: customer and admin workflows, access control, order and payment handling." },
    ],
  },
  {
    title: "Payments",
    items: [
      { q: "Does the crypto checkout move real money?", a: "No. BTC and USDT options are simulations. Deposit addresses are clearly fake, amounts use a fixed rate, and confirmations are produced by a mock provider. No funds are requested or sent." },
      { q: "What happens if I do not pay?", a: "The number is held for a limited window. If the window closes, the payment expires, the order is cancelled and the number returns to inventory." },
      { q: "Can I test failures?", a: "Yes. The sandbox checkout can simulate a confirmation, an underpayment, a failure and an expiry so you can see each state." },
    ],
  },
  {
    title: "Messaging",
    items: [
      { q: "How does message testing work?", a: "VNum is receive-only. An SMPP simulator pretends to be the SMSC and delivers simulated incoming SMS to numbers you own, which you read in your inbox. There is no way to send messages, and no connection to a real SMSC is made." },
      { q: "Do messages come from real phones?", a: "No. Incoming messages are generated inside the application and labelled as simulated." },
      { q: "Does VNum send email?", a: "No. Email and SMTP are out of scope. Notifications happen inside the application only." },
    ],
  },
  {
    title: "Accounts and data",
    items: [
      { q: "Do I need an account?", a: "Browsing this site does not. Using the inventory, orders and messaging does. Sign up is free and asks only for a name, email and password." },
      { q: "Is my data safe?", a: "Passwords are stored hashed and access is checked on the server. Even so, this is a demo: please do not enter anything sensitive. See the draft privacy notice." },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="eyebrow">FAQ</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        What is simulated, what is not, and how to get the most out of the sandbox.
      </p>

      <div className="mt-10 space-y-10">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`faq-${g.title.replace(/\W/g, "")}`}>
            <h2 id={`faq-${g.title.replace(/\W/g, "")}`} className="text-sm font-semibold">{g.title}</h2>
            <div className="mt-3 divide-y divide-border border-y border-border">
              {g.items.map((item) => (
                <details key={item.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-3 text-[15px] font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="max-w-2xl pb-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Still unsure? See the <Link href="/contact" className="font-medium text-accent hover:underline">contact page</Link> or{" "}
        <Link href="/sign-up" className="font-medium text-accent hover:underline">try the sandbox</Link>.
      </p>
    </div>
  );
}
