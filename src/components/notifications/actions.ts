"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serverApi } from "@/lib/data/server-api";

/** Mark one notification read and open its target (same-site paths only). */
export async function openNotification(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  const href = String(formData.get("href") ?? "");
  if (id.success) await serverApi().notifications.markRead([id.data]);
  redirect(href.startsWith("/") && !href.startsWith("//") ? href : "/admin/notifications");
}

export async function markAllNotificationsRead(formData: FormData) {
  await serverApi().notifications.markRead();
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/admin/notifications");
}
