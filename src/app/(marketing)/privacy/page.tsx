import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy notice (draft)" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      intro="A draft description of what the VNum sandbox stores and why."
      sections={[
        { heading: "What is stored", body: "Your name, email address, a hashed password, your orders, simulated payments and simulated messages, and an activity log of actions you take in the app." },
        { heading: "Why", body: "To operate the sandbox: sign you in, show your order history and let administrators review test activity." },
        { heading: "Weather and location", body: "The dashboard greeting asks a public weather service (Open-Meteo) for conditions. By default it uses a configured location. Your device location is requested only if you click the button, is rounded, and is kept in your browser only." },
        { heading: "Cookies and storage", body: "A session cookie keeps you signed in. Your theme choice and optional weather location are saved in local browser storage. There is no advertising or analytics tracking." },
        { heading: "Sharing", body: "Data is not sold or shared. Weather requests go directly from your browser to Open-Meteo." },
        { heading: "Retention and deletion", body: "Sandbox data may be reset at any time. A production service would define retention periods and deletion requests." },
      ]}
    />
  );
}
