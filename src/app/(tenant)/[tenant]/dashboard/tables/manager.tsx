"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { TextField } from "@/components/auth/fields";
import { FloorEditor } from "@/components/floor/floor-editor";
import { QrDownloadMenu, type QrDownloadKind } from "@/components/qr/download-menu";
import { downloadPng, downloadSvg, fileName } from "@/components/qr/qr-download";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { TableFigures } from "@/components/stats/table-figures";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useMsg } from "@/i18n/use-msg";
import { formatPrice } from "@/lib/menu/schema";
import type { TablesSales } from "@/lib/stats/page-schemas";
import type { QrCardText } from "@/lib/qr/card-text";
import {
  CARD,
  STICKER,
  qrCardSvg,
  qrStickerSvg,
  svgDataUrl,
  type QrCardInput,
} from "@/lib/qr/card";
import {
  LIMITS,
  TABLE_SHAPES,
  nextTableLabel,
  type Area,
  type CafeTable,
  type Floor,
} from "@/lib/tables/schema";
import {
  deleteAreaAction,
  deleteTableAction,
  regenerateCodeAction,
  saveAreaAction,
  saveLayoutAction,
  saveTableAction,
  type TablesResult,
} from "./actions";

/** three.js is loaded only when the 3D view is opened (and never on the server). */
const Floor3D = dynamic(() => import("@/components/floor/floor-3d"), {
  ssr: false,
  loading: () => <Loading3D />,
});

function Loading3D() {
  const t = useTranslations("tables");
  return (
    <div className="flex h-full items-center justify-center gap-xs text-body-sm text-on-surface-variant">
      <Icon name="progress_activity" className="animate-spin text-icon-lg" /> {t("loading3d")}
    </div>
  );
}

type Props = {
  slug: string;
  cafeName: string;
  floor: Floor;
  /** Printed card texts, in the café's menu language. */
  cardText: QrCardText;
  /** Base of the printed links, e.g. https://serbi.me/q/ */
  qrBase: string;
  colors: QrCardInput["colors"];
  initialArea: string | null;
  printHref: string;
  /** Statistics of the chosen period (strip above); without it the 30-day scan counts show. */
  stats?: { sales: TablesSales; currency: string };
};

type Confirm =
  | { kind: "delete-table"; table: CafeTable }
  | { kind: "delete-area"; area: Area }
  | { kind: "new-code"; table: CafeTable | null };

export function TablesManager({
  slug,
  cafeName,
  floor,
  cardText,
  qrBase,
  colors,
  initialArea,
  printHref,
  stats,
}: Props) {
  const t = useTranslations("tables");
  const ts = useTranslations("stats.tables");
  const tc = useTranslations("common");
  const tq = useTranslations("qrDownload");
  const m = useMsg();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [areaId, setAreaId] = useState<string | null>(
    floor.areas.find((a) => a.id === initialArea)?.id ?? floor.areas[0]?.id ?? null,
  );
  const [areaForm, setAreaForm] = useState<Area | "new" | null>(null);
  const [tableForm, setTableForm] = useState<CafeTable | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [view, setView] = useState<"list" | "plan" | "3d">("list");
  const [picked, setPicked] = useState<string | null>(null);

  const area = floor.areas.find((a) => a.id === areaId) ?? null;
  const tables = useMemo(
    () => floor.tables.filter((x) => x.areaId === areaId),
    [floor.tables, areaId],
  );

  const tableTitle = (label: string) => cardText.table.replace("{label}", label);
  const card = (title: string, subtitle: string, code: string) =>
    qrCardSvg({
      url: `${qrBase}${code}`,
      cafeName,
      title,
      subtitle,
      code,
      colors,
      footer: cardText.poweredBy,
    });
  const menuSvg = card(cardText.menu, cardText.menuSubtitle, floor.menu.code);
  const tableSvg = (x: CafeTable) =>
    x.code ? card(tableTitle(x.label), cardText.tableSubtitle, x.code) : null;

  const selectArea = (id: string) => setAreaId(id);

  /** Runs an action and shows its toast (the action's revalidatePath refreshes the page data). */
  const run = (
    fn: () => Promise<TablesResult>,
    after?: (r: Extract<TablesResult, { ok: true }>) => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setErrors(r.errors ?? {});
        toast.show({ variant: "error", title: m(r.message) });
        return;
      }
      setErrors({});
      if (r.message) toast.show({ variant: "success", title: m(r.message) });
      after?.(r);
    });

  const submitArea = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const id = areaForm && areaForm !== "new" ? areaForm.id : null;
    const data = new FormData(e.currentTarget);
    run(
      () => saveAreaAction(slug, id, data),
      (r) => {
        setAreaForm(null);
        if (!id && r.id) selectArea(r.id);
      },
    );
  };

  const submitTable = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const id = tableForm && tableForm !== "new" ? tableForm.id : null;
    const data = new FormData(e.currentTarget);
    run(
      () => saveTableAction(slug, id, data),
      () => setTableForm(null),
    );
  };

  /** Downloads a QR code as the big card or the small table sticker, PNG or SVG. */
  const download = async (
    kind: QrDownloadKind,
    q: { title: string; subtitle: string; label: string; code: string; file: string },
  ) => {
    const url = `${qrBase}${q.code}`;
    const sticker = kind.startsWith("sticker");
    const svg = sticker
      ? qrStickerSvg({ url, label: q.label, code: q.code, colors })
      : qrCardSvg({
          url,
          cafeName,
          title: q.title,
          subtitle: q.subtitle,
          code: q.code,
          colors,
          footer: cardText.poweredBy,
        });
    const name = `${q.file}${sticker ? "-sticker" : ""}`;
    try {
      if (kind.endsWith("svg")) downloadSvg(svg, name);
      else await downloadPng(svg, name, sticker ? STICKER : CARD);
    } catch {
      toast.show({ variant: "error", title: tq("failed") });
    }
  };
  const menuQr = {
    title: cardText.menu,
    subtitle: cardText.menuSubtitle,
    label: cardText.menu,
    code: floor.menu.code,
    file: fileName(cafeName, "menu-qr"),
  };
  const tableQr = (x: CafeTable) => ({
    title: tableTitle(x.label),
    subtitle: cardText.tableSubtitle,
    label: x.label,
    code: x.code ?? "",
    file: fileName(cafeName, x.label),
  });

  return (
    <div className="flex flex-col gap-lg">
      {/* Café menu QR */}
      <section className="grid grid-cols-1 gap-lg rounded-xl bg-surface-container-lowest p-lg shadow-sm md:grid-cols-3">
        <QrImage svg={menuSvg} alt={t("menuQrAlt")} />
        <div className="flex flex-col gap-sm md:col-span-2">
          <h2 className="flex items-center gap-sm text-headline-md text-on-surface">
            <Icon name="qr_code_2" className="text-icon-xl text-primary" />
            {t("menuQrTitle")}
          </h2>
          <p className="text-body-sm text-on-surface-variant">{t("menuQrBody")}</p>
          {stats ? (
            <p className="flex flex-wrap items-center gap-x-sm text-body-sm text-on-surface">
              <span className="font-semibold">
                {ts("scansCount", { count: stats.sales.menu.scans })}
              </span>
              <span className="text-on-surface-variant">
                {ts("menuCode", {
                  orders: ts("orders", { count: stats.sales.menu.takeawayOrders }),
                  revenue: formatPrice(stats.sales.menu.takeawayRevenue, stats.currency),
                })}
              </span>
              <span className="font-mono font-semibold">{floor.menu.code}</span>
            </p>
          ) : (
            <p className="text-body-sm text-on-surface">
              {t.rich("menuQrStats", {
                scans: floor.menu.scans30d,
                code: floor.menu.code,
                b: (c) => <span className="font-semibold">{c}</span>,
                mono: (c) => <span className="font-mono font-semibold">{c}</span>,
              })}
            </p>
          )}
          <div className="mt-xs flex flex-wrap gap-sm">
            <QrDownloadMenu onPick={(k) => download(k, menuQr)} />
            <ActionButton
              icon="autorenew"
              onClick={() => setConfirm({ kind: "new-code", table: null })}
            >
              {t("newCode")}
            </ActionButton>
          </div>
        </div>
      </section>

      {/* Areas */}
      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div role="tablist" aria-label={t("areas")} className="flex flex-wrap gap-xs">
            {floor.areas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={a.id === areaId}
                onClick={() => selectArea(a.id)}
                className={`rounded-full px-md py-xs text-body-sm font-semibold transition-colors ${
                  a.id === areaId
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {a.name}
                <span className="ms-xs opacity-75">
                  {floor.tables.filter((x) => x.areaId === a.id).length}
                </span>
              </button>
            ))}
            {floor.areas.length < LIMITS.areas ? (
              <button
                type="button"
                onClick={() => setAreaForm("new")}
                className="inline-flex items-center gap-xs rounded-full border border-dashed border-outline-variant px-md py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
              >
                <Icon name="add" className="text-icon-md" /> {t("area")}
              </button>
            ) : null}
          </div>
          {floor.tables.length ? (
            <a
              href={printHref}
              className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container"
            >
              <Icon name="print" className="text-icon-md" /> {t("print")}
            </a>
          ) : null}
        </div>

        {!area ? (
          <EmptyState
            icon="floor"
            title={t("startTitle")}
            body={t("startBody")}
            action={
              <PrimaryButton icon="add" onClick={() => setAreaForm("new")}>
                {t("firstArea")}
              </PrimaryButton>
            }
          />
        ) : (
          <div className="flex flex-col gap-md rounded-xl bg-surface-container-lowest p-lg shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <div>
                <h2 className="text-headline-md text-on-surface">{area.name}</h2>
                <p className="text-body-sm text-on-surface-variant">
                  {t("areaSummary", {
                    width: area.widthM,
                    depth: area.depthM,
                    tables: tables.length,
                    seats: tables.reduce((n, x) => n + x.seats, 0),
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-xs">
                <ActionButton icon="edit" onClick={() => setAreaForm(area)}>
                  {t("editArea")}
                </ActionButton>
                <ActionButton
                  icon="delete"
                  tone="danger"
                  onClick={() => setConfirm({ kind: "delete-area", area })}
                >
                  {tc("delete")}
                </ActionButton>
                {floor.tables.length < LIMITS.tables ? (
                  <PrimaryButton icon="add" onClick={() => setTableForm("new")}>
                    {t("addTable")}
                  </PrimaryButton>
                ) : null}
              </div>
            </div>

            <div
              role="tablist"
              aria-label={t("view")}
              className="flex w-fit rounded-xl bg-surface-container p-xs"
            >
              {(
                [
                  ["list", "view_list", t("list")],
                  ["plan", "floor", t("plan")],
                  ["3d", "view_in_ar", t("threeD")],
                ] as const
              ).map(([v, icon, label]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`inline-flex items-center gap-xs rounded-lg px-md py-xs text-body-sm font-semibold ${
                    view === v
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant"
                  }`}
                >
                  <Icon name={icon} className="text-icon-md" /> {label}
                </button>
              ))}
            </div>

            {view === "3d" && tables.length > 0 ? (
              <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
                <div className="flex flex-col gap-xs lg:col-span-2">
                  <div className="aspect-video overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
                    <Floor3D
                      area={area}
                      tables={tables}
                      selectedId={picked}
                      onSelect={(t) => setPicked(t?.id ?? null)}
                      colors={{ primary: colors.primary, container: colors.container }}
                    />
                  </div>
                  <p className="text-caption text-on-surface-variant">{t("help3d")}</p>
                  {/* Same choice without the canvas (keyboard, screen readers). */}
                  <div className="flex flex-wrap gap-xs" aria-label={t("tablesLabel")}>
                    {tables.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        aria-pressed={picked === x.id}
                        onClick={() => setPicked(x.id)}
                        className={`rounded-full px-sm py-xs text-caption font-semibold ${
                          picked === x.id
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {x.label}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const tb = tables.find((x) => x.id === picked);
                  const svg = tb ? tableSvg(tb) : null;
                  if (!tb)
                    return (
                      <EmptyState icon="touch_app" title={t("pickTitle")} body={t("pickBody")} />
                    );
                  return (
                    <div className="flex flex-col gap-sm rounded-xl border border-surface-container-high p-md">
                      {svg ? (
                        <QrImage svg={svg} alt={t("tableQrAlt", { label: tb.label })} />
                      ) : null}
                      <p className="text-body-lg font-bold text-on-surface">
                        {tb.label}{" "}
                        {!tb.isActive ? (
                          <span className="text-caption font-semibold text-on-surface-variant">
                            {t("offParen")}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {t(`shapes.${tb.shape}`)} · {t("seats", { count: tb.seats })}
                        {stats ? "" : ` · ${t("scans30d", { count: tb.scans30d })}`}
                      </p>
                      {stats ? (
                        <TableFigures
                          figures={stats.sales.tables[tb.id]}
                          currency={stats.currency}
                          active={tb.isActive}
                        />
                      ) : null}
                      <div className="flex flex-wrap gap-xs">
                        <ActionButton icon="edit" onClick={() => setTableForm(tb)}>
                          {tc("edit")}
                        </ActionButton>
                        {tb.code ? (
                          <QrDownloadMenu onPick={(k) => download(k, tableQr(tb))} />
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : view === "plan" && tables.length > 0 ? (
              <FloorEditor
                key={`${area.id}:${area.widthM}x${area.depthM}:${tables.map((t) => `${t.id}@${t.x},${t.y},${t.rotation},${t.shape},${t.seats}`).join("|")}`}
                area={area}
                tables={tables}
                saving={pending}
                onOpen={(t) => setTableForm(t)}
                onSave={(layout) => run(() => saveLayoutAction(slug, layout))}
              />
            ) : tables.length === 0 ? (
              <EmptyState
                icon="table_restaurant"
                title={t("noTablesTitle")}
                body={t("noTablesBody")}
              />
            ) : (
              <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3">
                {tables.map((tb) => {
                  const svg = tableSvg(tb);
                  const shape = TABLE_SHAPES.find((s) => s.value === tb.shape);
                  return (
                    <li
                      key={tb.id}
                      className={`flex gap-md rounded-xl border border-surface-container-high p-md ${tb.isActive ? "" : "opacity-70"}`}
                    >
                      <div className="w-24 shrink-0">
                        {svg ? (
                          <QrImage svg={svg} alt={t("tableQrAlt", { label: tb.label })} />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-xs">
                        <div className="flex items-center gap-xs">
                          <p className="truncate text-body-lg font-bold text-on-surface">
                            {tb.label}
                          </p>
                          {!tb.isActive ? (
                            <span className="rounded-full bg-surface-container-high px-sm text-caption font-semibold text-on-surface-variant">
                              {t("off")}
                            </span>
                          ) : null}
                        </div>
                        <p className="flex items-center gap-xs text-body-sm text-on-surface-variant">
                          <Icon name={shape?.icon ?? "table_restaurant"} className="text-icon-md" />
                          {t(`shapes.${tb.shape}`)} · {t("seats", { count: tb.seats })}
                        </p>
                        {stats ? (
                          <TableFigures
                            figures={stats.sales.tables[tb.id]}
                            currency={stats.currency}
                            active={tb.isActive}
                          />
                        ) : (
                          <p className="text-caption text-on-surface-variant">
                            {t("scansShort", { count: tb.scans30d })}
                            {tb.code ? ` · ${tb.code}` : ""}
                          </p>
                        )}
                        <div className="mt-auto flex flex-wrap gap-xs pt-xs">
                          <IconButton
                            icon="edit"
                            label={t("editName", { name: tb.label })}
                            onClick={() => setTableForm(tb)}
                          />
                          {tb.code ? (
                            <QrDownloadMenu
                              iconOnly
                              name={tb.label}
                              onPick={(k) => download(k, tableQr(tb))}
                            />
                          ) : null}
                          <IconButton
                            icon="autorenew"
                            label={t("newQrFor", { name: tb.label })}
                            onClick={() => setConfirm({ kind: "new-code", table: tb })}
                          />
                          <IconButton
                            icon="delete"
                            label={t("deleteName", { name: tb.label })}
                            tone="danger"
                            onClick={() => setConfirm({ kind: "delete-table", table: tb })}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Area form */}
      <Dialog
        open={areaForm !== null}
        onClose={() => {
          setAreaForm(null);
          setErrors({});
        }}
        title={areaForm === "new" ? t("addAreaTitle") : t("editAreaTitle")}
        icon="floor"
      >
        {areaForm !== null ? (
          <form id="area-form" onSubmit={submitArea} noValidate className="flex flex-col gap-md">
            <TextField
              id="name"
              label={t("name")}
              required
              maxLength={40}
              placeholder={t("areaPlaceholder")}
              defaultValue={
                areaForm === "new" ? (floor.areas.length ? "" : t("defaultArea")) : areaForm.name
              }
              error={errors.name}
            />
            <div className="grid grid-cols-2 gap-sm">
              <TextField
                id="width_m"
                label={t("width")}
                required
                type="number"
                inputMode="decimal"
                min={3}
                max={60}
                step={0.5}
                defaultValue={areaForm === "new" ? 12 : areaForm.widthM}
                error={errors.width_m}
              />
              <TextField
                id="depth_m"
                label={t("depth")}
                required
                type="number"
                inputMode="decimal"
                min={3}
                max={60}
                step={0.5}
                defaultValue={areaForm === "new" ? 8 : areaForm.depthM}
                error={errors.depth_m}
              />
            </div>
            <p className="text-caption text-on-surface-variant">{t("sizeHint")}</p>
            <FormButtons
              pending={pending}
              onCancel={() => setAreaForm(null)}
              label={areaForm === "new" ? t("addArea") : t("save")}
            />
          </form>
        ) : null}
      </Dialog>

      {/* Table form */}
      <Dialog
        open={tableForm !== null}
        onClose={() => {
          setTableForm(null);
          setErrors({});
        }}
        title={
          tableForm === "new"
            ? t("addTableTitle")
            : tableForm
              ? t("editName", { name: tableForm.label })
              : t("editTable")
        }
        icon="table_restaurant"
      >
        {tableForm !== null && area ? (
          <TableFields
            key={tableForm === "new" ? "new" : tableForm.id}
            table={tableForm === "new" ? null : tableForm}
            areas={floor.areas}
            areaId={area.id}
            suggestedLabel={nextTableLabel(floor.tables)}
            errors={errors}
            pending={pending}
            onSubmit={submitTable}
            onCancel={() => setTableForm(null)}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        pending={pending}
        tone={confirm?.kind === "new-code" ? "primary" : "danger"}
        icon={confirm?.kind === "new-code" ? "autorenew" : "delete"}
        title={
          confirm?.kind === "delete-table"
            ? t("deleteTableQ", { label: confirm.table.label })
            : confirm?.kind === "delete-area"
              ? t("deleteAreaQ", { name: confirm.area.name })
              : confirm?.kind === "new-code"
                ? confirm.table
                  ? t("newCodeForQ", { label: confirm.table.label })
                  : t("newMenuCodeQ")
                : ""
        }
        description={
          confirm?.kind === "delete-table"
            ? t("deleteTableBody")
            : confirm?.kind === "delete-area"
              ? t("deleteAreaBody")
              : t("newCodeBody")
        }
        confirmLabel={confirm?.kind === "new-code" ? t("createCode") : tc("delete")}
        onConfirm={() => {
          if (!confirm) return;
          const c = confirm;
          run(
            () =>
              c.kind === "delete-table"
                ? deleteTableAction(slug, c.table.id)
                : c.kind === "delete-area"
                  ? deleteAreaAction(slug, c.area.id)
                  : regenerateCodeAction(slug, c.table?.id ?? null),
            () => {
              setConfirm(null);
              if (c.kind === "delete-area")
                setAreaId(floor.areas.find((a) => a.id !== c.area.id)?.id ?? null);
            },
          );
        }}
      />
    </div>
  );
}

function TableFields({
  table,
  areas,
  areaId,
  suggestedLabel,
  errors,
  pending,
  onSubmit,
  onCancel,
}: {
  table: CafeTable | null;
  areas: Area[];
  areaId: string;
  suggestedLabel: string;
  errors: Record<string, string>;
  pending: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("tables");
  const m = useMsg();
  const [shape, setShape] = useState(table?.shape ?? "square");
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
      <div className="grid grid-cols-2 gap-sm">
        <TextField
          id="label"
          label={t("tableName")}
          required
          maxLength={20}
          defaultValue={table?.label ?? suggestedLabel}
          error={errors.label}
        />
        <TextField
          id="seats"
          label={t("seatsLabel")}
          required
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          defaultValue={table?.seats ?? (shape === "bar" ? 1 : 2)}
          error={errors.seats}
        />
      </div>
      <fieldset>
        <legend className="mb-xs text-body-sm font-semibold text-on-surface">{t("shape")}</legend>
        <div className="grid grid-cols-2 gap-xs sm:grid-cols-4">
          {TABLE_SHAPES.map((s) => (
            <label
              key={s.value}
              className={`flex cursor-pointer flex-col items-center gap-xs rounded-lg border p-sm text-body-sm ${
                shape === s.value
                  ? "border-primary bg-secondary-container text-primary"
                  : "border-outline-variant text-on-surface-variant"
              }`}
            >
              <input
                type="radio"
                name="shape"
                value={s.value}
                checked={shape === s.value}
                onChange={() => setShape(s.value)}
                className="sr-only"
              />
              <Icon name={s.icon} className="text-icon-xl" />
              {t(`shapes.${s.value}`)}
            </label>
          ))}
        </div>
        {errors.shape ? <p className="mt-xs text-body-xs text-error">{m(errors.shape)}</p> : null}
      </fieldset>
      <label className="flex flex-col gap-xs text-body-sm font-semibold text-on-surface">
        {t("area")}
        <select
          name="area_id"
          defaultValue={table?.areaId ?? areaId}
          className="rounded-lg border border-outline-variant bg-transparent px-sm py-sm font-normal"
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-sm text-body-sm text-on-surface">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={table?.isActive ?? true}
          className="h-4 w-4 accent-primary"
        />
        {t("inUse")}
      </label>
      <FormButtons
        pending={pending}
        onCancel={onCancel}
        label={table ? t("save") : t("addTable")}
      />
    </form>
  );
}

function QrImage({ svg, alt }: { svg: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- generated SVG card (data URL)
    <img src={svgDataUrl(svg)} alt={alt} className="h-auto w-full max-w-card-sm rounded-lg" />
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-sm rounded-xl border border-dashed border-outline-variant p-xl text-center">
      <Icon name={icon} className="text-icon-2xl text-outline" />
      <p className="text-body-lg font-semibold text-on-surface">{title}</p>
      <p className="max-w-card-sm text-body-sm text-on-surface-variant">{body}</p>
      {action}
    </div>
  );
}

function PrimaryButton({
  icon,
  onClick,
  children,
}: {
  icon: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container"
    >
      <Icon name={icon} className="text-icon-md" /> {children}
    </button>
  );
}

function ActionButton({
  icon,
  onClick,
  children,
  tone,
}: {
  icon: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold hover:bg-secondary-container ${tone === "danger" ? "text-error" : "text-primary"}`}
    >
      <Icon name={icon} className="text-icon-md" /> {children}
    </button>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-container ${tone === "danger" ? "text-error" : "text-on-surface-variant"}`}
    >
      <Icon name={icon} className="text-icon-lg" />
    </button>
  );
}

function FormButtons({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  const tc = useTranslations("common");
  return (
    <div className="mt-xs flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
      >
        {tc("cancel")}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
      >
        {pending ? <Icon name="progress_activity" className="animate-spin text-icon-lg" /> : null}
        {label}
      </button>
    </div>
  );
}
