import { NextResponse } from "next/server";
import { apiHandler, authorizeApi, parseJson } from "@/server/auth/api";
import { getSettings, saveSettings, settingsSchema } from "@/server/settings";
import { logActivity } from "@/server/activity";

export const PUT = apiHandler(async (req: Request) => {
  const admin = await authorizeApi(req, { admin: true });
  const next = await parseJson(req, settingsSchema);
  const before = await getSettings();
  const saved = await saveSettings(next);
  await logActivity({
    actorId: admin.id,
    action: "settings.updated",
    entityType: "AppSetting",
    entityId: "app",
    metadata: { before, after: saved },
  });
  return NextResponse.json(saved);
});
