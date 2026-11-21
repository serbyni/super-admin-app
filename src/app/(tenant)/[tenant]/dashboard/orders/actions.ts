"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { after } from "next/server";
import { msg } from "@/i18n/msg";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { isDataError } from "@/lib/data/errors";
import { serverApi } from "@/lib/data/server-api";
import { ORDER_RADII, ORDER_STATUSES, type OrderStatus } from "@/lib/orders/schema";
import { notifyOrderMoved, notifyOrderUpdate, requestReceipt } from "@/lib/data/push-dispatcher";

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
  // Customer's phones (push) + e-mail receipt when accepted — after the response.
  after(async () => {
    const o = await notifyOrderUpdate(id);
    if (o && status === "accepted") await requestReceipt(o.slug, o.token);
  });
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

/** Board: move an open table order to another table; the customer's phones are told. */
export async function moveOrderTableAction(
  slug: string,
  id: string,
  tableId: string,
): Promise<OrderResult> {
  await requireTenantOwner(slug);
  if (!isId(id) || !isId(tableId)) return { ok: false, message: msg("checkForm") };
  try {
    await serverApi().orders.moveTable(slug, id, tableId);
  } catch (e) {
    refresh(slug);
    return failure(e);
  }
  after(() => notifyOrderMoved(id));
  refresh(slug);
  return { ok: true, message: msg("orderMovedTable") };
}

/** Maximum distance from the café for table orders. */
export async function setOrderRadiusAction(slug: string, metres: number): Promise<OrderResult> {
  await requireTenantOwner(slug);
  if (!ORDER_RADII.includes(metres as (typeof ORDER_RADII)[number]))
    return { ok: false, message: msg("checkForm") };
  try {
    await serverApi().orders.setRadius(slug, metres);
  } catch (e) {
    return failure(e);
  }
  refresh(slug);
  return { ok: true, message: msg("orderRadiusSaved", { metres }) };
}

const pushKeys = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  p256dh: z.string().min(20).max(200),
  auth: z.string().min(10).max(100),
});

/** Turns new-order notifications on for this device. */
export async function savePushAction(slug: string, keys: unknown): Promise<OrderResult> {
  await requireTenantOwner(slug);
  const parsed = pushKeys.safeParse(keys);
  if (!parsed.success) return { ok: false, message: msg("checkForm") };
  try {
    await serverApi().orders.savePush(slug, parsed.data);
  } catch (e) {
    return failure(e);
  }
  return { ok: true, message: msg("pushOn") };
}

export async function deletePushAction(slug: string, endpoint: string): Promise<OrderResult> {
  await requireTenantOwner(slug);
  try {
    await serverApi().orders.deletePush(endpoint);
  } catch (e) {
    return failure(e);
  }
  return { ok: true, message: msg("pushOff") };
}
