"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { msg } from "@/i18n/msg";
import { withImplied } from "@/lib/access/permissions";
import { roleFormSchema, shiftFormSchema } from "@/lib/access/schema";
import { ensureCan } from "@/lib/access/server";
import { tenantDashboard } from "@/lib/auth/routes";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";

/*
 * Settings → Roles & permissions: the café's roles and shifts. Owner only (staff.manage), checked
 * here and again in SQL.
 */

export type RolesResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const isId = (v: unknown) => z.uuid().safeParse(v).success;
const refresh = (slug: string) => revalidatePath(tenantDashboard(slug), "layout");

function failure(e: unknown, nameTaken: string): RolesResult {
  if (isDataError(e, "name_taken"))
    return { ok: false, message: nameTaken, errors: { name: nameTaken } };
  if (isDataError(e, "in_use")) return { ok: false, message: msg("roleInUse") };
  if (isDataError(e, "invalid_state")) return { ok: false, message: msg("roleLocked") };
  if (isDataError(e, "stale_list")) return { ok: false, message: msg("changedMeanwhile") };
  if (isDataError(e, "invalid_input") && inputField(e) === "limit")
    return { ok: false, message: msg("limitReached") };
  if (isDataError(e)) return { ok: false, message: msg("somethingWrong") };
  throw e;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? "form")] ??= msg("checkValue");
  return out;
}

export async function saveRoleAction(
  slug: string,
  id: string | null,
  input: unknown,
): Promise<RolesResult> {
  const gate = await ensureCan(slug, "staff.manage");
  if (!gate.ok) return { ok: false, message: gate.message };
  if (id !== null && !isId(id)) return { ok: false, message: msg("checkForm") };
  const parsed = roleFormSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: msg("fieldsNeedAttention"), errors: fieldErrors(parsed.error) };
  try {
    const rid = await serverApi().access.saveRole(slug, id, {
      ...parsed.data,
      permissions: withImplied(parsed.data.permissions),
    });
    refresh(slug);
    return { ok: true, id: rid, message: msg("rolesSaved") };
  } catch (e) {
    return failure(e, msg("nameTakenRole"));
  }
}

export async function deleteRoleAction(slug: string, id: string): Promise<RolesResult> {
  const gate = await ensureCan(slug, "staff.manage");
  if (!gate.ok) return { ok: false, message: gate.message };
  if (!isId(id)) return { ok: false, message: msg("checkForm") };
  try {
    await serverApi().access.deleteRole(slug, id);
    refresh(slug);
    return { ok: true, message: msg("roleDeleted") };
  } catch (e) {
    return failure(e, msg("nameTakenRole"));
  }
}

export async function reorderRolesAction(slug: string, ids: unknown): Promise<RolesResult> {
  const gate = await ensureCan(slug, "staff.manage");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.array(z.uuid()).max(50).safeParse(ids);
  if (!parsed.success) return { ok: false, message: msg("orderFailed") };
  try {
    await serverApi().access.reorderRoles(slug, parsed.data);
    refresh(slug);
    return { ok: true };
  } catch (e) {
    return failure(e, msg("nameTakenRole"));
  }
}

export async function saveShiftAction(
  slug: string,
  id: string | null,
  input: unknown,
): Promise<RolesResult> {
  const gate = await ensureCan(slug, "staff.manage");
  if (!gate.ok) return { ok: false, message: gate.message };
  if (id !== null && !isId(id)) return { ok: false, message: msg("checkForm") };
  const parsed = shiftFormSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: msg("fieldsNeedAttention"), errors: fieldErrors(parsed.error) };
  try {
    const sid = await serverApi().access.saveShift(slug, id, parsed.data);
    refresh(slug);
    return { ok: true, id: sid, message: msg("shiftSaved") };
  } catch (e) {
    return failure(e, msg("nameTakenShift"));
  }
}

export async function deleteShiftAction(slug: string, id: string): Promise<RolesResult> {
  const gate = await ensureCan(slug, "staff.manage");
  if (!gate.ok) return { ok: false, message: gate.message };
  if (!isId(id)) return { ok: false, message: msg("checkForm") };
  try {
    await serverApi().access.deleteShift(slug, id);
    refresh(slug);
    return { ok: true, message: msg("shiftDeleted") };
  } catch (e) {
    return failure(e, msg("nameTakenShift"));
  }
}

export async function reorderShiftsAction(slug: string, ids: unknown): Promise<RolesResult> {
  const gate = await ensureCan(slug, "staff.manage");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = z.array(z.uuid()).max(50).safeParse(ids);
  if (!parsed.success) return { ok: false, message: msg("orderFailed") };
  try {
    await serverApi().access.reorderShifts(slug, parsed.data);
    refresh(slug);
    return { ok: true };
  } catch (e) {
    return failure(e, msg("nameTakenShift"));
  }
}
