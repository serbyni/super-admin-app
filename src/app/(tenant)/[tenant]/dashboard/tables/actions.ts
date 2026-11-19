"use server";

import { revalidatePath } from "next/cache";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { inputField, isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
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
  if (field === "limit") return { ok: false, message: "You reached the limit for this café." };
  if (field)
    return {
      ok: false,
      message: "Please check the form.",
      errors: { [field]: labels[field] ?? "Please check this value." },
    };
  if (isDataError(e, "conflict"))
    return {
      ok: false,
      message: fallback,
      errors: labels.conflict ? { [labels.conflictField ?? "name"]: labels.conflict } : undefined,
    };
  if (isDataError(e, "in_use"))
    return { ok: false, message: "Move or delete the tables of this area first." };
  if (isDataError(e)) return { ok: false, message: "Something went wrong. Please try again." };
  throw e;
}

export async function saveAreaAction(
  slug: string,
  id: string | null,
  form: FormData,
): Promise<TablesResult> {
  await requireTenantOwner(slug);
  const parsed = areaSchema.safeParse(values(form));
  if (!parsed.success)
    return { ok: false, message: "Please check the form.", errors: zodErrors(parsed.error) };
  try {
    const areaId = await serverApi().tables.saveArea(slug, id, {
      name: parsed.data.name,
      widthM: parsed.data.width_m,
      depthM: parsed.data.depth_m,
    });
    refresh(slug);
    return { ok: true, id: areaId, message: id ? "Area saved" : "Area added" };
  } catch (e) {
    return failure(e, "This name is already used.", {
      conflict: "Another area has this name",
      conflictField: "name",
    });
  }
}

export async function deleteAreaAction(slug: string, id: string): Promise<TablesResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().tables.deleteArea(slug, id);
    refresh(slug);
    return { ok: true, message: "Area deleted" };
  } catch (e) {
    return failure(e, "Could not delete the area.");
  }
}

export async function saveTableAction(
  slug: string,
  id: string | null,
  form: FormData,
): Promise<TablesResult> {
  await requireTenantOwner(slug);
  const parsed = tableSchema.safeParse(values(form));
  if (!parsed.success)
    return { ok: false, message: "Please check the form.", errors: zodErrors(parsed.error) };
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
    return { ok: true, id: tableId, message: id ? "Table saved" : `Table ${d.label} added` };
  } catch (e) {
    return failure(e, "This table name is already used.", {
      conflict: "Another table has this name",
      conflictField: "label",
    });
  }
}

export async function deleteTableAction(slug: string, id: string): Promise<TablesResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().tables.deleteTable(slug, id);
    refresh(slug);
    return { ok: true, message: "Table deleted" };
  } catch (e) {
    return failure(e, "Could not delete the table.");
  }
}

/** New QR code for a table (or the café menu when tableId is null); the old code is retired. */
export async function regenerateCodeAction(
  slug: string,
  tableId: string | null,
): Promise<TablesResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().tables.regenerateCode(slug, tableId);
    refresh(slug);
    return { ok: true, message: "New QR code created — print and replace the old one" };
  } catch (e) {
    return failure(e, "Could not create a new code.");
  }
}
