"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureCan } from "@/lib/access/server";
import { tenantDashboard } from "@/lib/auth/routes";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { msg } from "@/i18n/msg";
import { zodErrors } from "@/lib/settings/schema";
import { areaSchema, tableSchema } from "@/lib/tables/schema";

/** Result of every Tables & QR action. */
export type TablesResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

const values = (f: FormData) => Object.fromEntries(f) as Record<string, string>;
const refresh = (slug: string) => revalidatePath(`${tenantDashboard(slug)}/tables`);

function failure(e: unknown, fallback: string, labels: Record<string, string> = {}): TablesResult {
  const field = inputField(e);
  if (field === "limit") return { ok: false, message: msg("limitReached") };
  if (field)
    return {
      ok: false,
      message: msg("checkForm"),
      errors: { [field]: labels[field] ?? msg("checkValue") },
    };
  if (isDataError(e, "conflict"))
    return {
      ok: false,
      message: fallback,
      errors: labels.conflict ? { [labels.conflictField ?? "name"]: labels.conflict } : undefined,
    };
  if (isDataError(e, "in_use")) return { ok: false, message: msg("areaNotEmpty") };
  if (isDataError(e)) return { ok: false, message: msg("somethingWrong") };
  throw e;
}

export async function saveAreaAction(
  slug: string,
  id: string | null,
  form: FormData,
): Promise<TablesResult> {
  const gate = await ensureCan(slug, "tables.edit");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = areaSchema.safeParse(values(form));
  if (!parsed.success)
    return { ok: false, message: msg("checkForm"), errors: zodErrors(parsed.error) };
  try {
    const areaId = await serverApi().tables.saveArea(slug, id, {
      name: parsed.data.name,
      widthM: parsed.data.width_m,
      depthM: parsed.data.depth_m,
    });
    refresh(slug);
    return { ok: true, id: areaId, message: id ? msg("areaSaved") : msg("areaAdded") };
  } catch (e) {
    return failure(e, msg("nameTaken"), {
      conflict: msg("areaNameTaken"),
      conflictField: "name",
    });
  }
}

export async function deleteAreaAction(slug: string, id: string): Promise<TablesResult> {
  const gate = await ensureCan(slug, "tables.edit");
  if (!gate.ok) return { ok: false, message: gate.message };
  try {
    await serverApi().tables.deleteArea(slug, id);
    refresh(slug);
    return { ok: true, message: msg("areaDeleted") };
  } catch (e) {
    return failure(e, msg("areaDeleteFailed"));
  }
}

export async function saveTableAction(
  slug: string,
  id: string | null,
  form: FormData,
): Promise<TablesResult> {
  const gate = await ensureCan(slug, "tables.edit");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = tableSchema.safeParse(values(form));
  if (!parsed.success)
    return { ok: false, message: msg("checkForm"), errors: zodErrors(parsed.error) };
  const d = parsed.data;
  try {
    const tableId = await serverApi().tables.saveTable(slug, id, {
      areaId: d.area_id,
      label: d.label,
      seats: d.seats,
      shape: d.shape,
      isActive: d.is_active,
    });
    refresh(slug);
    return {
      ok: true,
      id: tableId,
      message: id ? msg("tableSaved") : msg("tableAdded", { label: d.label }),
    };
  } catch (e) {
    return failure(e, msg("tableNameTakenForm"), {
      conflict: msg("tableNameTaken"),
      conflictField: "label",
    });
  }
}

export async function deleteTableAction(slug: string, id: string): Promise<TablesResult> {
  const gate = await ensureCan(slug, "tables.edit");
  if (!gate.ok) return { ok: false, message: gate.message };
  try {
    await serverApi().tables.deleteTable(slug, id);
    refresh(slug);
    return { ok: true, message: msg("tableDeleted") };
  } catch (e) {
    return failure(e, msg("tableDeleteFailed"));
  }
}

/** New QR code for a table (or the café menu when tableId is null); the old code is retired. */
export async function regenerateCodeAction(
  slug: string,
  tableId: string | null,
): Promise<TablesResult> {
  const gate = await ensureCan(slug, "tables.qr");
  if (!gate.ok) return { ok: false, message: gate.message };
  try {
    await serverApi().tables.regenerateCode(slug, tableId);
    refresh(slug);
    return { ok: true, message: msg("codeCreated") };
  } catch (e) {
    return failure(e, msg("codeFailed"));
  }
}

const layoutSchema = z
  .array(
    z.object({
      id: z.uuid(),
      x: z.number().finite().min(0).max(60),
      y: z.number().finite().min(0).max(60),
      rotation: z.number().finite(),
    }),
  )
  .max(200);

/** Saves table positions from the floor editor (clamped to each table's area in SQL). */
export async function saveLayoutAction(slug: string, layout: unknown): Promise<TablesResult> {
  const gate = await ensureCan(slug, "tables.edit");
  if (!gate.ok) return { ok: false, message: gate.message };
  const parsed = layoutSchema.safeParse(layout);
  if (!parsed.success) return { ok: false, message: msg("layoutReload") };
  try {
    await serverApi().tables.saveLayout(slug, parsed.data);
    refresh(slug);
    return { ok: true, message: msg("layoutSaved") };
  } catch (e) {
    return failure(e, msg("layoutFailed"));
  }
}
