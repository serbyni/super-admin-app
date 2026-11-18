"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { isDataError } from "@/lib/data/errors";
import { kickEmailDispatch } from "@/lib/data/kick-email";
import { serverApi } from "@/lib/data/server-api";

export type DecisionState = { error?: string; reason?: string };

const userId = z.uuid();
const reasonSchema = z
  .string()
  .trim()
  .min(10, "Explain the reason in at least 10 characters — the owner receives it by email.")
  .max(1000, "Keep the reason under 1000 characters.");

function decisionError(e: unknown): string {
  if (!isDataError(e)) throw e;
  switch (e.code) {
    case "invalid_status":
      return "This application was already decided. Reload the page.";
    case "invalid_reason":
      return "Explain the reason in 10–1000 characters.";
    case "forbidden":
      return "You are not allowed to do this.";
    default:
      return "Could not save the decision. Please try again.";
  }
}

export async function approveOwner(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  await requireAdmin();
  const id = userId.safeParse(formData.get("userId"));
  if (!id.success) return { error: "Invalid application." };
  try {
    await serverApi().users.approve(id.data);
  } catch (e) {
    return { error: decisionError(e) };
  }
  kickEmailDispatch(); // admin_approve_user
  redirect(`/admin/users/${id.data}?decided=approved`);
}

export async function declineOwner(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  await requireAdmin();
  const id = userId.safeParse(formData.get("userId"));
  if (!id.success) return { error: "Invalid application." };
  const raw = String(formData.get("reason") ?? "");
  const reason = reasonSchema.safeParse(raw);
  if (!reason.success) return { error: reason.error.issues[0]?.message, reason: raw };
  try {
    await serverApi().users.decline(id.data, reason.data);
  } catch (e) {
    return { error: decisionError(e), reason: raw };
  }
  kickEmailDispatch(); // admin_declined_user
  redirect(`/admin/users/${id.data}?decided=declined`);
}
