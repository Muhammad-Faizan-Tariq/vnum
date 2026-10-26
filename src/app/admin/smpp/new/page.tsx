import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/primitives";
import { SmppVendorForm } from "@/components/admin/smpp-vendor-form";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "New SMPP vendor · Admin" };

export default async function NewSmppVendorPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="New SMPP vendor" description="Connection details for a receive-only SMPP bind." />
      <Card className="max-w-2xl p-5">
        <SmppVendorForm />
      </Card>
    </>
  );
}
