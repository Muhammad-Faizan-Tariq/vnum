"use client";

import { ApiActionButton } from "@/components/admin/api-action-button";

/** Role/status actions for one user row. Each change is confirmed and re-validated on the server. */
export function UserControls({
  userId,
  name,
  role,
  status,
  isSelf,
}: {
  userId: string;
  name: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  isSelf: boolean;
}) {
  if (isSelf) return <span className="text-[13px] text-muted-foreground">This is you</span>;
  const url = `/api/admin/users/${userId}`;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {role === "USER" ? (
        <ApiActionButton
          url={url} method="PATCH" body={{ role: "ADMIN" }} label="Make admin"
          successMessage={`${name} is now an administrator`}
          confirm={{ title: `Make ${name} an administrator?`, description: "They will be able to manage numbers, orders, users and settings.", confirmLabel: "Make admin" }}
        />
      ) : (
        <ApiActionButton
          url={url} method="PATCH" body={{ role: "USER" }} label="Remove admin"
          successMessage={`${name} is now a regular user`}
          confirm={{ title: `Remove admin access from ${name}?`, description: "They will lose access to the admin console immediately.", confirmLabel: "Remove admin" }}
        />
      )}
      {status === "ACTIVE" ? (
        <ApiActionButton
          url={url} method="PATCH" body={{ status: "SUSPENDED" }} label="Suspend" variant="dangerOutline"
          successMessage={`${name} was suspended`}
          confirm={{ title: `Suspend ${name}?`, description: "Their sessions end now and they cannot sign in until reactivated.", confirmLabel: "Suspend" }}
        />
      ) : (
        <ApiActionButton url={url} method="PATCH" body={{ status: "ACTIVE" }} label="Reactivate" successMessage={`${name} was reactivated`} />
      )}
    </div>
  );
}
