"use server";

import { revalidatePath } from "next/cache";
import { msg } from "@/i18n/msg";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/schema";

export type OrderResult = { ok: true; message?: string } | { ok: false; message: string };

const refresh = (slug: string) => revalidatePath(tenantDashboard(slug), "layout");
const isId = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v);

function failure(e: unknown): OrderResult {
  if (isDataError(e, "invalid_status")) return { ok: false, message: msg("orderMoveRefused") };
  if (isDataError(e)) return { ok: false, message: msg("orderUpdateFailed") };
  throw e;
}

/** Board buttons: accept / decline / preparing / ready / served / cancel (rules in SQL). */
export async function setOrderStatusAction(
  slug: string,
  id: string,
  status: OrderStatus,
  reason = "",
): Promise<OrderResult> {
  await requireTenantOwner(slug);
  if (!isId(id) || !ORDER_STATUSES.includes(status) || reason.length > 200)
    return { ok: false, message: msg("checkForm") };
  try {
    await serverApi().orders.setStatus(slug, id, status, reason.trim());
  } catch (e) {
    refresh(slug);
    return failure(e);
  }
  refresh(slug);
  return { ok: true };
}

export async function setOrderPaidAction(
  slug: string,
  id: string,
  paid: boolean,
): Promise<OrderResult> {
  await requireTenantOwner(slug);
  if (!isId(id)) return { ok: false, message: msg("checkForm") };
  try {
    await serverApi().orders.setPaid(slug, id, paid);
  } catch (e) {
    return failure(e);
  }
  refresh(slug);
  return { ok: true };
}

/** "Accepting orders" switch. */
export async function setAcceptingOrdersAction(slug: string, on: boolean): Promise<OrderResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().orders.setAccepting(slug, on);
  } catch (e) {
    return failure(e);
  }
  refresh(slug);
  return { ok: true, message: on ? msg("orderingOn") : msg("orderingOff") };
}
