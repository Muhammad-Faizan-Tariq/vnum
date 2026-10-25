import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { PasswordForm, ProfileForm } from "@/components/customer/forms";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  return (
    <div>
      <PageHeader title="Settings" description="Your sandbox account." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Profile" action={<Badge tone={user.role === "ADMIN" ? "accent" : "neutral"}>{user.role === "ADMIN" ? "Administrator" : "Customer"}</Badge>} />
          <div className="p-4">
            <ProfileForm name={user.name} email={user.email} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Password" description="Passwords are stored as bcrypt hashes." />
          <div className="p-4">
            <PasswordForm />
          </div>
        </Card>
        <Card>
          <CardHeader title="Preferences" />
          <ul className="divide-y divide-border text-sm">
            <li className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-medium">Theme</span>
                <span className="block text-[13px] text-muted-foreground">Use the toggle in the header. Your choice is remembered on this device.</span>
              </span>
            </li>
            <li className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-medium">Weather location</span>
                <span className="block text-[13px] text-muted-foreground">
                  The overview greeting uses a default location. If you choose &ldquo;Use my location&rdquo; there, a rounded
                  coordinate pair is kept in this browser only and never sent to VNum.
                </span>
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
