"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { TextField } from "@/components/auth/fields";
import { FloorEditor } from "@/components/floor/floor-editor";
import { downloadPng, downloadSvg, fileName } from "@/components/qr/qr-download";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { qrCardSvg, svgDataUrl, type QrCardInput } from "@/lib/qr/card";
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
  loading: () => (
    <div className="flex h-full items-center justify-center gap-xs text-body-sm text-on-surface-variant">
      <Icon name="progress_activity" className="animate-spin text-icon-lg" /> Loading 3D view…
    </div>
  ),
});

type Props = {
  slug: string;
  cafeName: string;
  floor: Floor;
  /** Base of the printed links, e.g. https://serbi.me/q/ */
  qrBase: string;
  colors: QrCardInput["colors"];
  initialArea: string | null;
  printHref: string;
};

type Confirm =
  | { kind: "delete-table"; table: CafeTable }
  | { kind: "delete-area"; area: Area }
  | { kind: "new-code"; table: CafeTable | null };

export function TablesManager({
  slug,
  cafeName,
  floor,
  qrBase,
  colors,
  initialArea,
  printHref,
}: Props) {
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
    () => floor.tables.filter((t) => t.areaId === areaId),
    [floor.tables, areaId],
  );

  const card = (title: string, subtitle: string, code: string) =>
    qrCardSvg({ url: `${qrBase}${code}`, cafeName, title, subtitle, code, colors });
  const menuSvg = card("Menu", "Scan to see our menu", floor.menu.code);
  const tableSvg = (t: CafeTable) =>
    t.code ? card(`Table ${t.label}`, "Scan to order", t.code) : null;

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
        toast.show({ variant: "error", title: r.message });
        return;
      }
      setErrors({});
      if (r.message) toast.show({ variant: "success", title: r.message });
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

  const download = async (svg: string, name: string, kind: "svg" | "png") => {
    try {
      if (kind === "svg") downloadSvg(svg, name);
      else await downloadPng(svg, name);
    } catch {
      toast.show({ variant: "error", title: "Download failed. Please try again." });
    }
  };

  return (
    <div className="flex flex-col gap-lg">
      {/* Café menu QR */}
      <section className="grid grid-cols-1 gap-lg rounded-xl bg-surface-container-lowest p-lg shadow-sm md:grid-cols-3">
        <QrImage svg={menuSvg} alt="Menu QR code" />
        <div className="flex flex-col gap-sm md:col-span-2">
          <h2 className="flex items-center gap-sm text-headline-md text-on-surface">
            <Icon name="qr_code_2" className="text-icon-xl text-primary" />
            Menu QR code
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            For your counter, window, flyers or takeaway bags. It opens your menu without a table.
            Each table below has its own code, so orders know where to go.
          </p>
          <p className="text-body-sm text-on-surface">
            <span className="font-semibold">{floor.menu.scans30d}</span> scans in the last 30 days ·
            code <span className="font-mono font-semibold">{floor.menu.code}</span>
          </p>
          <div className="mt-xs flex flex-wrap gap-sm">
            <ActionButton
              icon="download"
              onClick={() => download(menuSvg, fileName(cafeName, "menu-qr"), "png")}
            >
              PNG
            </ActionButton>
            <ActionButton
              icon="download"
              onClick={() => download(menuSvg, fileName(cafeName, "menu-qr"), "svg")}
            >
              SVG
            </ActionButton>
            <ActionButton
              icon="autorenew"
              onClick={() => setConfirm({ kind: "new-code", table: null })}
            >
              New code
            </ActionButton>
          </div>
        </div>
      </section>

      {/* Areas */}
      <section className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div role="tablist" aria-label="Areas" className="flex flex-wrap gap-xs">
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
                  {floor.tables.filter((t) => t.areaId === a.id).length}
                </span>
              </button>
            ))}
            {floor.areas.length < LIMITS.areas ? (
              <button
                type="button"
                onClick={() => setAreaForm("new")}
                className="inline-flex items-center gap-xs rounded-full border border-dashed border-outline-variant px-md py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
              >
                <Icon name="add" className="text-icon-md" /> Area
              </button>
            ) : null}
          </div>
          {floor.tables.length ? (
            <a
              href={printHref}
              className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container"
            >
              <Icon name="print" className="text-icon-md" /> Print QR codes
            </a>
          ) : null}
        </div>

        {!area ? (
          <EmptyState
            icon="floor"
            title="Start with an area"
            body="An area is a room or zone of your café — e.g. Inside or Terrace. Then add its tables."
            action={
              <PrimaryButton icon="add" onClick={() => setAreaForm("new")}>
                Add your first area
              </PrimaryButton>
            }
          />
        ) : (
          <div className="flex flex-col gap-md rounded-xl bg-surface-container-lowest p-lg shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <div>
                <h2 className="text-headline-md text-on-surface">{area.name}</h2>
                <p className="text-body-sm text-on-surface-variant">
                  {area.widthM} × {area.depthM} m · {tables.length} table
                  {tables.length === 1 ? "" : "s"} · {tables.reduce((n, t) => n + t.seats, 0)} seats
                </p>
              </div>
              <div className="flex flex-wrap gap-xs">
                <ActionButton icon="edit" onClick={() => setAreaForm(area)}>
                  Edit area
                </ActionButton>
                <ActionButton
                  icon="delete"
                  tone="danger"
                  onClick={() => setConfirm({ kind: "delete-area", area })}
                >
                  Delete
                </ActionButton>
                {floor.tables.length < LIMITS.tables ? (
                  <PrimaryButton icon="add" onClick={() => setTableForm("new")}>
                    Add table
                  </PrimaryButton>
                ) : null}
              </div>
            </div>

            <div
              role="tablist"
              aria-label="View"
              className="flex w-fit rounded-xl bg-surface-container p-xs"
            >
              {(
                [
                  ["list", "view_list", "List"],
                  ["plan", "floor", "Floor plan"],
                  ["3d", "view_in_ar", "3D"],
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
                  <p className="text-caption text-on-surface-variant">
                    Drag to turn around · scroll or pinch to zoom · click a table for its QR code.
                    Arrange tables in the Floor plan.
                  </p>
                  {/* Same choice without the canvas (keyboard, screen readers). */}
                  <div className="flex flex-wrap gap-xs" aria-label="Tables">
                    {tables.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={picked === t.id}
                        onClick={() => setPicked(t.id)}
                        className={`rounded-full px-sm py-xs text-caption font-semibold ${
                          picked === t.id
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const t = tables.find((x) => x.id === picked);
                  const svg = t ? tableSvg(t) : null;
                  if (!t)
                    return (
                      <EmptyState
                        icon="touch_app"
                        title="Pick a table"
                        body="Click a table in the 3D view to see its QR code."
                      />
                    );
                  const shape = TABLE_SHAPES.find((s) => s.value === t.shape);
                  return (
                    <div className="flex flex-col gap-sm rounded-xl border border-surface-container-high p-md">
                      {svg ? <QrImage svg={svg} alt={`QR code of table ${t.label}`} /> : null}
                      <p className="text-body-lg font-bold text-on-surface">
                        {t.label}{" "}
                        {!t.isActive ? (
                          <span className="text-caption font-semibold text-on-surface-variant">
                            (off)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {shape?.label} · {t.seats} seat{t.seats === 1 ? "" : "s"} · {t.scans30d}{" "}
                        scans in 30 days
                      </p>
                      <div className="flex flex-wrap gap-xs">
                        <ActionButton icon="edit" onClick={() => setTableForm(t)}>
                          Edit
                        </ActionButton>
                        {svg ? (
                          <ActionButton
                            icon="download"
                            onClick={() => download(svg, fileName(cafeName, t.label), "png")}
                          >
                            PNG
                          </ActionButton>
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
                title="No tables yet"
                body="Add the tables of this area. Each gets its own QR code to print."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3">
                {tables.map((t) => {
                  const svg = tableSvg(t);
                  const shape = TABLE_SHAPES.find((s) => s.value === t.shape);
                  return (
                    <li
                      key={t.id}
                      className={`flex gap-md rounded-xl border border-surface-container-high p-md ${t.isActive ? "" : "opacity-70"}`}
                    >
                      <div className="w-24 shrink-0">
                        {svg ? <QrImage svg={svg} alt={`QR code of table ${t.label}`} /> : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-xs">
                        <div className="flex items-center gap-xs">
                          <p className="truncate text-body-lg font-bold text-on-surface">
                            {t.label}
                          </p>
                          {!t.isActive ? (
                            <span className="rounded-full bg-surface-container-high px-sm text-caption font-semibold text-on-surface-variant">
                              Off
                            </span>
                          ) : null}
                        </div>
                        <p className="flex items-center gap-xs text-body-sm text-on-surface-variant">
                          <Icon name={shape?.icon ?? "table_restaurant"} className="text-icon-md" />
                          {shape?.label} · {t.seats} seat{t.seats === 1 ? "" : "s"}
                        </p>
                        <p className="text-caption text-on-surface-variant">
                          {t.scans30d} scans · 30 days{t.code ? ` · ${t.code}` : ""}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-xs pt-xs">
                          <IconButton
                            icon="edit"
                            label={`Edit ${t.label}`}
                            onClick={() => setTableForm(t)}
                          />
                          {svg ? (
                            <>
                              <IconButton
                                icon="image"
                                label={`Download PNG of ${t.label}`}
                                onClick={() => download(svg, fileName(cafeName, t.label), "png")}
                              />
                              <IconButton
                                icon="draw"
                                label={`Download SVG of ${t.label}`}
                                onClick={() => download(svg, fileName(cafeName, t.label), "svg")}
                              />
                            </>
                          ) : null}
                          <IconButton
                            icon="autorenew"
                            label={`New QR code for ${t.label}`}
                            onClick={() => setConfirm({ kind: "new-code", table: t })}
                          />
                          <IconButton
                            icon="delete"
                            label={`Delete ${t.label}`}
                            tone="danger"
                            onClick={() => setConfirm({ kind: "delete-table", table: t })}
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
        title={areaForm === "new" ? "Add an area" : "Edit area"}
        icon="floor"
      >
        {areaForm !== null ? (
          <form id="area-form" onSubmit={submitArea} noValidate className="flex flex-col gap-md">
            <TextField
              id="name"
              label="Name"
              required
              maxLength={40}
              placeholder="e.g. Inside, Terrace"
              defaultValue={
                areaForm === "new" ? (floor.areas.length ? "" : "Inside") : areaForm.name
              }
              error={errors.name}
            />
            <div className="grid grid-cols-2 gap-sm">
              <TextField
                id="width_m"
                label="Width (m)"
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
                label="Depth (m)"
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
            <p className="text-caption text-on-surface-variant">
              Approximate size — used for the floor plan.
            </p>
            <FormButtons
              pending={pending}
              onCancel={() => setAreaForm(null)}
              label={areaForm === "new" ? "Add area" : "Save"}
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
          tableForm === "new" ? "Add a table" : tableForm ? `Edit ${tableForm.label}` : "Edit table"
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
            ? `Delete table ${confirm.table.label}?`
            : confirm?.kind === "delete-area"
              ? `Delete ${confirm.area.name}?`
              : confirm?.kind === "new-code"
                ? confirm.table
                  ? `New QR code for ${confirm.table.label}?`
                  : "New menu QR code?"
                : ""
        }
        description={
          confirm?.kind === "delete-table"
            ? "Its printed QR code will stop working. This can't be undone."
            : confirm?.kind === "delete-area"
              ? "Only empty areas can be deleted."
              : "Use this if a QR sticker was copied or damaged. The old code will still open your menu, but no longer identifies the table — print and replace it."
        }
        confirmLabel={confirm?.kind === "new-code" ? "Create new code" : "Delete"}
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
  const [shape, setShape] = useState(table?.shape ?? "square");
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
      <div className="grid grid-cols-2 gap-sm">
        <TextField
          id="label"
          label="Table name"
          required
          maxLength={20}
          defaultValue={table?.label ?? suggestedLabel}
          error={errors.label}
        />
        <TextField
          id="seats"
          label="Seats"
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
        <legend className="mb-xs text-body-sm font-semibold text-on-surface">Shape</legend>
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
              {s.label}
            </label>
          ))}
        </div>
        {errors.shape ? <p className="mt-xs text-body-xs text-error">{errors.shape}</p> : null}
      </fieldset>
      <label className="flex flex-col gap-xs text-body-sm font-semibold text-on-surface">
        Area
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
        In use — its QR code opens the menu with this table
      </label>
      <FormButtons pending={pending} onCancel={onCancel} label={table ? "Save" : "Add table"} />
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
  return (
    <div className="mt-xs flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
      >
        Cancel
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
