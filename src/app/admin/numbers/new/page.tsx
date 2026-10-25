import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/primitives";
import { NumberForm } from "@/components/admin/number-form";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Add number · Admin" };

export default async function NewNumberPage() {
  await requireAdmin();
  const services = await db.service.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } });
  return (
    <>
      <PageHeader title="Add a demo number" description="Creates test inventory. The number is not provisioned on any real network." />
      <Card className="max-w-3xl p-5">
        <NumberForm
          mode="create"
          services={services}
          identityLocked={false}
          statusLocked={false}
          initial={{ e164: "", countryCode: "", countryName: "", region: "", price: "", serviceSlugs: ["generic-otp"], smsInbound: true, voice: false, status: "AVAILABLE" }}
        />
      </Card>
    </>
  );
}
