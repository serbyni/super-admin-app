"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { TextAreaField } from "@/components/auth/fields";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useMsg } from "@/i18n/use-msg";
import { tenantSettings } from "@/lib/auth/routes";
import { browserApi } from "@/lib/data/browser-api";
import { formatPrice } from "@/lib/menu/schema";
import {
  ORDER_RADII,
  columnOf,
  nextStatus,
  type Board,
  type Opening,
  type Order,
  type OrderStatus,
} from "@/lib/orders/schema";
import { KpiTile, StatStrip } from "@/components/stats/charts";
import { liveFigures, type LiveFigures } from "@/lib/orders/live";
import {
  moveOrderTableAction,
  setAcceptingOrdersAction,
  setOrderPaidAction,
  setOrderRadiusAction,
  setOrderStatusAction,
  type OrderResult,
} from "./actions";

const SOUND_KEY = "serbi_orders_sound";
const COLUMNS = ["new", "progress", "ready"] as const;
const NEXT_LABEL: Partial<Record<OrderStatus, "toPreparing" | "toReady" | "toServed">> = {
  accepted: "toPreparing",
  preparing: "toReady",
  ready: "toServed",
};

/** Short two-tone "ding" (Web Audio; needs one click on the page first — browser rule). */
function ding(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.3, now + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(now + i * 0.18);
    o.stop(now + i * 0.18 + 0.4);
  });
}

export function OrdersBoard({
  slug,
  cafeId,
  currency,
  board,
  today,
  tables,
  menuOnly = false,
}: {
  slug: string;
  cafeId: string;
  currency: string;
  board: Board;
  /** Every order of today (café time), for the live figures. */
  today: Order[];
  /** Active tables of the café (move dialog). */
  tables: { id: string; label: string; area: string }[];
  /** Menu-only café: no "Accepting orders" card (the page shows a notice instead). */
  menuOnly?: boolean;
}) {
  const t = useTranslations("orders");
  const ts = useTranslations("stats.orders");
  const m = useMsg();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const [sound, setSound] = useState(false);
  const [dialog, setDialog] = useState<{ order: Order; kind: "declined" | "cancelled" } | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [moving, setMoving] = useState<Order | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(false);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  // Sound remembered from a previous visit: browsers allow audio after the first click.
  useEffect(() => {
    if (!sound) return;
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [sound]);

  // Relative times are computed in the browser only (no server/browser text mismatch).
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // Sound preference (per device).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (localStorage.getItem(SOUND_KEY) === "on") setSound(true);
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Live updates + a slow refresh as a safety net.
  useEffect(() => {
    const off = browserApi().subscribeToOrders(cafeId, (e) => {
      if (e.isNew) {
        if (soundRef.current && audio.current) ding(audio.current);
        toast.show({
          id: `order-${e.id}`,
          variant: "info",
          icon: "receipt_long",
          title: t("newOrderToast", { number: e.number }),
        });
      }
      router.refresh();
    });
    const poll = setInterval(() => router.refresh(), 20_000);
    return () => {
      off();
      clearInterval(poll);
    };
  }, [cafeId, router, toast, t]);

  // "(2) Orders" in the tab title while orders wait.
  const waiting = board.orders.filter((o) => o.status === "new").length;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = waiting ? `(${waiting}) ${base}` : base;
  }, [waiting]);

  const run = (fn: () => Promise<OrderResult>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.show({ variant: "error", title: m(r.message) });
      else if (r.message) toast.show({ variant: "success", title: m(r.message) });
    });

  const toggleSound = () => {
    const on = !sound;
    if (on) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      ding(audio.current);
    }
    setSound(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      /* storage unavailable */
    }
  };

  const ago = (iso: string) => {
    if (now === null) return "";
    const min = Math.floor((now - new Date(iso).getTime()) / 60_000);
    return min < 1 ? t("justNow") : t("minutes", { count: min });
  };

  return (
    <div className="flex flex-col gap-lg">
      {menuOnly ? null : (
        <section className="flex flex-col gap-sm rounded-xl bg-surface-container-lowest p-md shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-md">
            <button
              type="button"
              role="switch"
              aria-checked={board.acceptingOrders}
              aria-label={t("accepting")}
              disabled={pending}
              onClick={() => run(() => setAcceptingOrdersAction(slug, !board.acceptingOrders))}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${board.acceptingOrders ? "bg-primary" : "bg-surface-container-highest"}`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${board.acceptingOrders ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1"}`}
              />
            </button>
            <div>
              <p className="font-semibold text-on-surface">{t("accepting")}</p>
              <p className="text-caption text-on-surface-variant">
                <OpeningText opening={board.ordering} /> ·{" "}
                <Link
                  href={`${tenantSettings(slug)}?tab=hours`}
                  className="underline underline-offset-2"
                >
                  {t("hoursHint")}
                </Link>
              </p>
            </div>
          </div>
          <label className="flex w-full flex-col gap-xs text-caption text-on-surface-variant md:w-80">
            <span className="font-semibold text-on-surface">{t("radiusLabel")}</span>
            <select
              value={board.orderRadiusM}
              disabled={pending}
              onChange={(e) => run(() => setOrderRadiusAction(slug, Number(e.target.value)))}
              aria-describedby="radius-hint"
              className="w-fit rounded-lg border border-outline-variant bg-transparent px-sm py-xs text-body-sm text-on-surface"
            >
              {ORDER_RADII.map((r) => (
                <option key={r} value={r}>
                  {t("radiusOption", { metres: r })}
                </option>
              ))}
            </select>
            <span id="radius-hint">{t("radiusHint")}</span>
          </label>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            className={`inline-flex w-fit items-center gap-xs rounded-xl border px-md py-sm text-body-sm font-semibold ${sound ? "border-primary bg-secondary-container text-primary" : "border-outline-variant text-on-surface-variant"}`}
          >
            <Icon name={sound ? "volume_up" : "volume_off"} className="text-icon-md" />
            {sound ? t("soundOn") : t("soundOff")}
          </button>
        </section>
      )}

      <LiveStrip figures={liveFigures(board.orders, today, now ?? 0)} ready={now !== null} t={ts} />

      {board.orders.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest p-xl text-center text-on-surface-variant shadow-sm">
          {t("noOrdersYet")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = board.orders
              .filter((o) => columnOf(o.status) === col)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
            return (
              <section
                key={col}
                aria-label={t(
                  col === "new" ? "colNew" : col === "progress" ? "colProgress" : "colReady",
                )}
                className="flex flex-col gap-sm"
              >
                <h2 className="flex items-center gap-xs text-body-lg font-bold text-on-surface">
                  {t(col === "new" ? "colNew" : col === "progress" ? "colProgress" : "colReady")}
                  <span className="rounded-full bg-surface-container px-sm text-caption">
                    {list.length}
                  </span>
                </h2>
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-outline-variant p-md text-center text-body-sm text-on-surface-variant">
                    {t("empty")}
                  </p>
                ) : (
                  list.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      currency={currency}
                      ago={ago(o.createdAt)}
                      pending={pending}
                      onStatus={(s) => run(() => setOrderStatusAction(slug, o.id!, s))}
                      onAsk={(kind) => {
                        setReason("");
                        setDialog({ order: o, kind });
                      }}
                      onPaid={(paid) => run(() => setOrderPaidAction(slug, o.id!, paid))}
                      onMove={
                        o.kind === "table" && tables.length > 1 ? () => setMoving(o) : undefined
                      }
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      <Dialog
        open={moving !== null}
        onClose={() => setMoving(null)}
        icon="table_restaurant"
        title={moving ? t("moveTableTitle", { number: moving.number }) : ""}
        description={t("moveTableHint")}
      >
        <ul className="grid grid-cols-2 gap-xs sm:grid-cols-3">
          {tables.map((tb) => {
            const current = moving?.tableLabel === tb.label;
            const busy = board.orders.some(
              (o) => o.kind === "table" && o.tableLabel === tb.label && o.id !== moving?.id,
            );
            return (
              <li key={tb.id}>
                <button
                  type="button"
                  disabled={pending || current}
                  onClick={() => {
                    const o = moving;
                    if (!o) return;
                    run(() => moveOrderTableAction(slug, o.id!, tb.id));
                    setMoving(null);
                  }}
                  className={`flex w-full flex-col items-start rounded-xl border px-md py-sm text-start disabled:opacity-60 ${
                    current
                      ? "border-primary bg-secondary-container"
                      : "border-outline-variant hover:bg-surface-container"
                  }`}
                >
                  <span className="font-semibold text-on-surface">{tb.label}</span>
                  <span className="text-caption text-on-surface-variant">
                    {current ? t("current") : busy ? `${tb.area} · ${t("busy")}` : tb.area}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>

      <ConfirmDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        pending={pending}
        tone="danger"
        icon={dialog?.kind === "declined" ? "do_not_disturb_on" : "cancel"}
        title={
          dialog
            ? t(dialog.kind === "declined" ? "declineTitle" : "cancelTitle", {
                number: dialog.order.number,
              })
            : ""
        }
        description={dialog?.kind === "declined" ? t("declineBody") : t("cancelBody")}
        confirmLabel={dialog?.kind === "declined" ? t("confirmDecline") : t("confirmCancel")}
        cancelLabel={t("keep")}
        onConfirm={() => {
          if (!dialog) return;
          const d = dialog;
          start(async () => {
            const r = await setOrderStatusAction(slug, d.order.id!, d.kind, reason);
            setDialog(null);
            if (!r.ok) toast.show({ variant: "error", title: m(r.message) });
          });
        }}
      >
        <TextAreaField
          id="order-reason"
          label={t("reason")}
          rows={2}
          maxLength={200}
          placeholder={t("reasonPlaceholder")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}

function OrderCard({
  order: o,
  currency,
  ago,
  pending,
  onStatus,
  onAsk,
  onPaid,
  onMove,
}: {
  order: Order;
  currency: string;
  ago: string;
  pending: boolean;
  onStatus: (s: OrderStatus) => void;
  onAsk: (kind: "declined" | "cancelled") => void;
  onPaid: (paid: boolean) => void;
  /** Table orders: move to another table. */
  onMove?: () => void;
}) {
  const t = useTranslations("orders");
  const next = nextStatus(o.status);
  const isNew = o.status === "new";
  return (
    <article
      className={`flex flex-col gap-sm rounded-xl bg-surface-container-lowest p-md shadow-sm ${isNew ? "ring-2 ring-primary" : ""}`}
    >
      <header className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="text-headline-md font-bold text-primary">#{o.number}</p>
          <p className="truncate text-body-sm font-semibold text-on-surface">
            {o.kind === "table"
              ? t("table", { label: o.tableLabel ?? "" })
              : t("takeaway", { name: o.customerName })}
          </p>
          {o.movedFromLabel ? (
            <p className="flex items-center gap-xs text-caption text-on-surface-variant">
              <Icon name="swap_horiz" className="text-icon-sm" />
              {t("movedFrom", { label: o.movedFromLabel })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-xs text-caption">
          <span className="text-on-surface-variant" suppressHydrationWarning>
            {ago}
          </span>
          <span className="rounded-full bg-surface-container px-sm font-semibold text-on-surface-variant">
            {t(`status.${o.status}`)}
          </span>
        </div>
      </header>
      <ul className="flex flex-col gap-xs text-body-sm">
        {o.items.map((li, i) => (
          <li key={i} className="flex justify-between gap-sm">
            <span className="min-w-0">
              <span className="font-semibold text-on-surface" dir="auto">
                {li.quantity} × {li.name}
              </span>
              {li.options.length ? (
                <span className="block text-caption text-on-surface-variant" dir="auto">
                  {li.options.map((op) => op.choice).join(", ")}
                </span>
              ) : null}
              {li.note ? (
                <span className="block text-caption text-on-surface-variant italic" dir="auto">
                  “{li.note}”
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-on-surface-variant tabular-nums" dir="ltr">
              {formatPrice(li.lineTotal, currency)}
            </span>
          </li>
        ))}
      </ul>
      {o.note ? (
        <p
          className="rounded-lg bg-surface-container-low p-xs text-caption text-on-surface"
          dir="auto"
        >
          {t("orderNote", { note: o.note })}
        </p>
      ) : null}
      <div className="flex items-center justify-between border-t border-surface-container-high pt-xs">
        <span className="text-body-sm font-bold text-on-surface tabular-nums" dir="ltr">
          {formatPrice(o.subtotal, currency)}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => onPaid(!o.isPaid)}
          aria-pressed={o.isPaid}
          className={`inline-flex items-center gap-xs rounded-full px-sm py-xs text-caption font-semibold disabled:opacity-60 ${o.isPaid ? "bg-success-container text-success" : "bg-warning-container text-on-warning-container"}`}
        >
          <Icon name={o.isPaid ? "check_circle" : "payments"} className="text-icon-sm" />
          {o.isPaid ? t("paid") : t("markPaid")}
        </button>
      </div>
      <div className="flex flex-wrap gap-xs">
        {isNew ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => onStatus("accepted")}
              className="inline-flex flex-1 items-center justify-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary disabled:opacity-60"
            >
              <Icon name="check" className="text-icon-md" /> {t("accept")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onAsk("declined")}
              className="inline-flex items-center justify-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-error disabled:opacity-60"
            >
              {t("decline")}
            </button>
          </>
        ) : next ? (
          <>
            {o.status === "accepted" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => onStatus("ready")}
                className="inline-flex items-center justify-center rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary disabled:opacity-60"
              >
                {t("toReady")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => onStatus(next)}
              className="inline-flex flex-1 items-center justify-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary disabled:opacity-60"
            >
              {t(NEXT_LABEL[o.status] ?? "toServed")}
              <Icon name="arrow_forward" className="text-icon-md" flipRtl />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onAsk("cancelled")}
              aria-label={t("cancel")}
              title={t("cancel")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-error hover:bg-error-container disabled:opacity-60"
            >
              <Icon name="close" className="text-icon-md" />
            </button>
          </>
        ) : null}
        {onMove ? (
          <button
            type="button"
            disabled={pending}
            onClick={onMove}
            aria-label={t("moveTable")}
            title={t("moveTable")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-primary hover:bg-secondary-container disabled:opacity-60"
          >
            <Icon name="swap_horiz" className="text-icon-md" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

/** "Open now · until 20:00" / "Closed now · opens Monday at 08:00". */
export function OpeningText({ opening }: { opening: Opening }) {
  const t = useTranslations("orders");
  if (opening.openNow)
    return <>{opening.closesAt ? t("openUntil", { time: opening.closesAt }) : t("openNow")}</>;
  if (opening.opensAt === undefined || opening.opensDay === undefined) return <>{t("closed")}</>;
  const days = t("weekdays").split("|");
  const today = (new Date().getDay() + 6) % 7;
  return (
    <span suppressHydrationWarning>
      {opening.opensDay === today
        ? t("closedToday", { time: opening.opensAt })
        : t("closedOpens", { day: days[opening.opensDay], time: opening.opensAt })}
    </span>
  );
}

/** Right now: waiting / in progress / ready, oldest waiting order, average time to accept today. */
function LiveStrip({
  figures: f,
  ready,
  t,
}: {
  figures: LiveFigures;
  /** Minutes are computed in the browser only (no server/browser mismatch). */
  ready: boolean;
  t: ReturnType<typeof useTranslations<"stats.orders">>;
}) {
  const min = (n: number | null) =>
    !ready || n === null ? t("none") : t("minutes", { n: Math.round(n) });
  const late = ready && f.oldestNewMin !== null && f.oldestNewMin >= 5;
  return (
    <section aria-label={t("label")}>
      <StatStrip>
        <KpiTile
          label={t("waiting")}
          value={String(f.open.new)}
          alert={late}
          sub={ready && f.oldestNewMin !== null ? t("oldest", { n: f.oldestNewMin }) : undefined}
        />
        <KpiTile label={t("inProgress")} value={String(f.open.accepted + f.open.preparing)} />
        <KpiTile label={t("ready")} value={String(f.open.ready)} />
        <KpiTile label={t("avgAccept")} value={min(f.avgAcceptMin)} />
      </StatStrip>
    </section>
  );
}
