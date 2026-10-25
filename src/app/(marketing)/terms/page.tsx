import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms of use (draft)" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro="Draft terms describing how the VNum sandbox is meant to be used during evaluation."
      sections={[
        { heading: "Sandbox purpose", body: "VNum is provided for testing and assessment. The service, its inventory, its payment flow and its messaging are simulations." },
        { heading: "No real numbers or funds", body: "Numbers are test data and are not active on any telecom network. No cryptocurrency or other funds are requested, held or transferred." },
        { heading: "Acceptable use", body: "Do not attempt to disrupt the service, access other users' data, or use the sandbox for unlawful activity or to impersonate others." },
        { heading: "Accounts", body: "You are responsible for keeping your credentials private. Accounts may be suspended or removed at any time without notice." },
        { heading: "No warranty", body: "The sandbox is provided as is, may be reset, and carries no availability commitment." },
        { heading: "Changes", body: "These draft terms may change. A production service would publish final terms reviewed by qualified counsel." },
      ]}
    />
  );
}
