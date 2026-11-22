"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { TextField } from "@/components/auth/fields";
import { Section } from "@/components/settings/form-kit";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { SortableTable, type SortableColumn } from "@/components/ui/sortable-table";
import { useToast } from "@/components/ui/toast";
import { useMsg } from "@/i18n/use-msg";
import {
  PERMISSION_GROUPS,
  requiredBy,
  togglePermission,
  visibleSections,
  withImplied,
  type Permission,
} from "@/lib/access/permissions";
import { daysLabel, roleLabel, type Role, type Shift } from "@/lib/access/schema";
import { AddButton, RowActions } from "../menu/tables";
import {
  deleteRoleAction,
  deleteShiftAction,
  reorderRolesAction,
  reorderShiftsAction,
  saveRoleAction,
  saveShiftAction,
  type RolesResult,
} from "./roles-actions";

/** Run an action, toast its message, keep field errors for the open dialog. */
function useRun() {
  const m = useMsg();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<RolesResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setErrors(r.errors ?? {});
        toast.show({ variant: "error", title: m(r.message) });
        return;
      }
      setErrors({});
      if (r.message) toast.show({ variant: "success", title: m(r.message) });
      after?.();
    });
  const reorder = async (fn: () => Promise<RolesResult>) => {
    const r = await fn();
    if (!r.ok) toast.show({ variant: "error", title: m(r.message) });
    return r.ok;
  };
  return { pending, errors, setErrors, run, reorder };
}

/** Settings → Roles & permissions (owner): the café's roles, then its shifts. */
export function RolesTab({
  slug,
  roles,
  shifts,
}: {
  slug: string;
  roles: Role[];
  shifts: Shift[];
}) {
  const t = useTranslations("roles");
  return (
    <div className="flex flex-col gap-lg">
      <Section title={t("rolesTitle")} icon="badge" description={t("rolesBody")}>
        <Roles slug={slug} roles={roles} />
      </Section>
      <Section title={t("shiftsTitle")} icon="schedule" description={t("shiftsBody")}>
        <Shifts slug={slug} shifts={shifts} />
      </Section>
      <p className="flex items-center gap-xs text-body-sm text-on-surface-variant">
        <Icon name="info" className="text-icon-md" />
        {t("staffSoon")}
      </p>
    </div>
  );
}

/* ── Roles ──────────────────────────────────────────────────────────────── */

type RoleForm = { id: string | null; name: string; description: string; permissions: Permission[] };

function Roles({ slug, roles }: { slug: string; roles: Role[] }) {
  const t = useTranslations("roles");
  const tn = useTranslations("nav");
  const { pending, errors, setErrors, run, reorder } = useRun();
  const [form, setForm] = useState<RoleForm | null>(null);
  const [confirm, setConfirm] = useState<Role | null>(null);
  const label = (r: Role) => roleLabel(r, (k) => t(`builtin.${k}`));
  const open = (f: RoleForm) => {
    setErrors({});
    setForm(f);
  };

  const columns: SortableColumn<Role>[] = [
    {
      key: "name",
      header: t("colRole"),
      cell: (r) => (
        <span className="flex flex-col">
          <span className="flex items-center gap-sm font-semibold text-on-surface">
            {r.isLocked ? <Icon name="lock" className="text-icon-md text-outline" /> : null}
            {label(r)}
          </span>
          {r.description ? (
            <span className="text-caption text-on-surface-variant">{r.description}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "access",
      header: t("colPermissions"),
      cell: (r) =>
        r.isLocked ? (
          <span className="rounded-full bg-primary-container px-sm py-xs text-caption font-semibold text-on-primary-container">
            {t("allRights")}
          </span>
        ) : (
          <span className="flex max-w-cell flex-wrap gap-xs whitespace-normal">
            {visibleSections(r.permissions)
              .filter(
                (s) => s !== "settings" || r.permissions.some((p) => p.startsWith("settings.")),
              )
              .map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-surface-container px-sm text-caption text-on-surface-variant"
                >
                  {tn(s)}
                </span>
              ))}
            <span className="text-caption text-outline">
              {t("permCount", { count: r.permissions.length })}
            </span>
          </span>
        ),
    },
    {
      key: "members",
      header: t("colMembers"),
      end: true,
      cell: (r) => <span className="tabular-nums">{r.memberCount}</span>,
    },
    {
      key: "actions",
      header: t("colActions"),
      end: true,
      cell: (r) =>
        r.isLocked ? (
          <span className="text-caption text-outline">{t("locked")}</span>
        ) : (
          <div className="flex items-center justify-end gap-xs">
            <IconAction
              icon="content_copy"
              label={`${t("roleDuplicate")} ${label(r)}`}
              onClick={() =>
                open({
                  id: null,
                  name: t("roleCopy", { name: label(r) }).slice(0, 40),
                  description: r.description,
                  permissions: withImplied(r.permissions),
                })
              }
            />
            <IconAction
              icon="edit"
              label={t("editName", { name: label(r) })}
              tone="info"
              onClick={() =>
                open({
                  id: r.id,
                  name: label(r),
                  description: r.description,
                  permissions: withImplied(r.permissions),
                })
              }
            />
            <IconAction
              icon="delete"
              label={r.memberCount > 0 ? t("inUse") : t("deleteName", { name: label(r) })}
              tone="danger"
              disabled={r.memberCount > 0}
              onClick={() => setConfirm(r)}
            />
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <AddButton
        label={t("roleNew")}
        onClick={() => open({ id: null, name: "", description: "", permissions: [] })}
      />
      <SortableTable
        rows={roles}
        columns={columns}
        hint={t("drag")}
        reorderLabel={t("reorderColumn")}
        handleLabel={(r) => t("reorder", { name: label(r) })}
        onReorder={(ids) => reorder(() => reorderRolesAction(slug, ids))}
      />
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? t("roleEdit") : t("roleNew")}
        icon="badge"
      >
        {form ? (
          <RoleEditor
            key={form.id ?? `new-${form.name}`}
            initial={form}
            pending={pending}
            errors={errors}
            onClose={() => setForm(null)}
            onSubmit={(f) =>
              run(
                () => saveRoleAction(slug, f.id, f),
                () => setForm(null),
              )
            }
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        pending={pending}
        tone="danger"
        icon="delete"
        title={confirm ? t("deleteRoleTitle", { name: label(confirm) }) : ""}
        confirmLabel={t("deleteConfirm")}
        onConfirm={() => {
          const r = confirm;
          if (r)
            run(
              () => deleteRoleAction(slug, r.id),
              () => setConfirm(null),
            );
        }}
      >
        {t("deleteRoleBody")}
      </ConfirmDialog>
    </div>
  );
}

/** Name, description and the permission matrix (by section) with a "what this role sees" line. */
function RoleEditor({
  initial,
  pending,
  errors,
  onClose,
  onSubmit,
}: {
  initial: RoleForm;
  pending: boolean;
  errors: Record<string, string>;
  onClose: () => void;
  onSubmit: (f: RoleForm) => void;
}) {
  const t = useTranslations("roles");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const m = useMsg();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [perms, setPerms] = useState<Permission[]>(initial.permissions);
  const sees = visibleSections(perms).filter(
    (s) => s !== "settings" || perms.some((p) => p.startsWith("settings.")),
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-md"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: initial.id,
          name: name.trim(),
          description: description.trim(),
          permissions: perms,
        });
      }}
    >
      <TextField
        id="role-name"
        label={t("name")}
        required
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name ? m(errors.name) : undefined}
      />
      <TextField
        id="role-description"
        label={t("description")}
        maxLength={200}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description ? m(errors.description) : undefined}
      />

      <fieldset className="flex flex-col gap-sm">
        <legend className="mb-xs text-body-sm font-semibold text-on-surface">{t("matrix")}</legend>
        {PERMISSION_GROUPS.map((g) => (
          <div key={g.section} className="rounded-lg border border-surface-container-high p-sm">
            <p className="mb-xs text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">
              {tn(g.section)}
            </p>
            <ul className="flex flex-col gap-xs">
              {g.permissions.map((p) => {
                const on = perms.includes(p);
                // Stays on while another permission needs it (edit ⇒ read, publish ⇒ edit).
                const required = requiredBy(perms, p);
                return (
                  <li key={p}>
                    <label className="flex cursor-pointer items-start gap-sm rounded-md p-xs hover:bg-surface-container-low">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={on}
                        disabled={required}
                        onChange={(e) => setPerms((x) => togglePermission(x, p, e.target.checked))}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-body-sm font-semibold text-on-surface">
                          {t(`perm.${p}.label`)}
                        </span>
                        <span className="block text-caption text-on-surface-variant">
                          {required ? t("needsRead") : t(`perm.${p}.help`)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-xs rounded-lg bg-surface-container-low p-sm text-body-sm">
        <span className="text-on-surface-variant">{t("sees")}:</span>
        {sees.length ? (
          sees.map((s) => (
            <span
              key={s}
              className="rounded-full border border-outline-variant px-sm text-caption text-on-surface"
            >
              {tn(s)}
            </span>
          ))
        ) : (
          <span className="text-on-surface">{t("seesNone")}</span>
        )}
      </div>

      <div className="mt-xs flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
        >
          {tc("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex items-center justify-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
        >
          {pending ? <Icon name="progress_activity" className="animate-spin text-icon-lg" /> : null}
          {initial.id ? t("save") : t("add")}
        </button>
      </div>
    </form>
  );
}

/* ── Shifts ─────────────────────────────────────────────────────────────── */

type ShiftForm = { id: string | null; name: string; days: number[]; starts: string; ends: string };

function Shifts({ slug, shifts }: { slug: string; shifts: Shift[] }) {
  const t = useTranslations("roles");
  const { pending, errors, setErrors, run, reorder } = useRun();
  const [form, setForm] = useState<ShiftForm | null>(null);
  const [confirm, setConfirm] = useState<Shift | null>(null);
  const dayNames = t("dayNames").split("|");
  const open = (f: ShiftForm) => {
    setErrors({});
    setForm(f);
  };

  const columns: SortableColumn<Shift>[] = [
    {
      key: "name",
      header: t("colShift"),
      cell: (s) => <span className="font-semibold text-on-surface">{s.name}</span>,
    },
    {
      key: "days",
      header: t("colDays"),
      cell: (s) => daysLabel(s.days, dayNames, t("everyDay")),
    },
    {
      key: "hours",
      header: t("colHours"),
      cell: (s) => <Hours starts={s.starts} ends={s.ends} />,
    },
    {
      key: "members",
      header: t("colMembers"),
      end: true,
      cell: (s) => <span className="tabular-nums">{s.memberCount}</span>,
    },
    {
      key: "actions",
      header: t("colActions"),
      end: true,
      cell: (s) => (
        <RowActions
          editLabel={t("editName", { name: s.name })}
          deleteLabel={t("deleteName", { name: s.name })}
          onEdit={() =>
            open({ id: s.id, name: s.name, days: s.days, starts: s.starts, ends: s.ends })
          }
          onDelete={() => setConfirm(s)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <AddButton
        label={t("shiftNew")}
        onClick={() =>
          open({ id: null, name: "", days: [0, 1, 2, 3, 4, 5], starts: "07:00", ends: "15:00" })
        }
      />
      {shifts.length ? (
        <SortableTable
          rows={shifts}
          columns={columns}
          hint={t("dragShifts")}
          reorderLabel={t("reorderColumn")}
          handleLabel={(s) => t("reorder", { name: s.name })}
          onReorder={(ids) => reorder(() => reorderShiftsAction(slug, ids))}
        />
      ) : (
        <p className="rounded-xl bg-surface-container-low p-lg text-center text-on-surface-variant">
          {t("noShifts")}
        </p>
      )}
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? t("shiftEdit") : t("shiftNew")}
        icon="schedule"
      >
        {form ? (
          <ShiftEditor
            key={form.id ?? "new"}
            initial={form}
            dayNames={dayNames}
            pending={pending}
            errors={errors}
            onClose={() => setForm(null)}
            onSubmit={(f) =>
              run(
                () => saveShiftAction(slug, f.id, f),
                () => setForm(null),
              )
            }
          />
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        pending={pending}
        tone="danger"
        icon="delete"
        title={confirm ? t("deleteShiftTitle", { name: confirm.name }) : ""}
        confirmLabel={t("deleteConfirm")}
        onConfirm={() => {
          const s = confirm;
          if (s)
            run(
              () => deleteShiftAction(slug, s.id),
              () => setConfirm(null),
            );
        }}
      >
        {confirm ? t("deleteShiftBody", { count: confirm.memberCount }) : ""}
      </ConfirmDialog>
    </div>
  );
}

/** "15:00 – 23:30", with an "overnight" badge when the shift ends after midnight. */
function Hours({ starts, ends }: { starts: string; ends: string }) {
  const t = useTranslations("roles");
  return (
    <span className="inline-flex flex-wrap items-center gap-xs tabular-nums" dir="ltr">
      {starts} – {ends}
      {ends < starts ? (
        <span className="inline-flex items-center gap-xs rounded-full bg-tertiary-container px-sm text-caption text-on-tertiary-container">
          <Icon name="dark_mode" className="text-icon-sm" />
          {t("overnight")}
        </span>
      ) : null}
    </span>
  );
}

function ShiftEditor({
  initial,
  dayNames,
  pending,
  errors,
  onClose,
  onSubmit,
}: {
  initial: ShiftForm;
  dayNames: string[];
  pending: boolean;
  errors: Record<string, string>;
  onClose: () => void;
  onSubmit: (f: ShiftForm) => void;
}) {
  const t = useTranslations("roles");
  const tc = useTranslations("common");
  const m = useMsg();
  const [name, setName] = useState(initial.name);
  const [days, setDays] = useState<number[]>(initial.days);
  const [starts, setStarts] = useState(initial.starts);
  const [ends, setEnds] = useState(initial.ends);
  const all = days.length === 7;
  const valid = name.trim() && days.length > 0 && starts && ends && starts !== ends;

  return (
    <form
      noValidate
      className="flex flex-col gap-md"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          id: initial.id,
          name: name.trim(),
          days: [...days].sort((a, b) => a - b),
          starts,
          ends,
        });
      }}
    >
      <TextField
        id="shift-name"
        label={t("name")}
        required
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name ? m(errors.name) : undefined}
      />
      <fieldset>
        <legend className="mb-xs text-body-sm font-semibold text-on-surface">{t("days")}</legend>
        <div className="flex flex-wrap gap-xs">
          {dayNames.map((d, i) => {
            const on = days.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays((x) => (on ? x.filter((y) => y !== i) : [...x, i]))}
                className={`rounded-full px-md py-xs text-body-sm font-semibold transition-colors ${
                  on
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {d}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={all}
            onClick={() => setDays(all ? [] : [0, 1, 2, 3, 4, 5, 6])}
            className="rounded-full border border-outline-variant px-md py-xs text-body-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            {t("everyDay")}
          </button>
        </div>
        {errors.days ? <p className="mt-xs text-caption text-error">{m(errors.days)}</p> : null}
      </fieldset>
      <div className="grid grid-cols-2 gap-sm">
        <TextField
          id="shift-starts"
          type="time"
          label={t("starts")}
          required
          value={starts}
          onChange={(e) => setStarts(e.target.value)}
          error={errors.starts ? m(errors.starts) : undefined}
        />
        <TextField
          id="shift-ends"
          type="time"
          label={t("ends")}
          required
          value={ends}
          onChange={(e) => setEnds(e.target.value)}
          error={errors.ends ? m(errors.ends) : undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-sm rounded-lg bg-surface-container-low p-sm text-body-sm text-on-surface">
        <Icon name="schedule" className="text-icon-md text-primary" />
        <span className="font-semibold">{name.trim() || t("shiftNew")}</span>
        <span className="text-on-surface-variant">
          · {days.length ? daysLabel(days, dayNames, t("everyDay")) : "—"} ·
        </span>
        {starts && ends ? <Hours starts={starts} ends={ends} /> : null}
      </div>
      <div className="mt-xs flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
        >
          {tc("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || !valid}
          className="inline-flex items-center justify-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
        >
          {pending ? <Icon name="progress_activity" className="animate-spin text-icon-lg" /> : null}
          {initial.id ? t("save") : t("shiftAdd")}
        </button>
      </div>
    </form>
  );
}

/** Compact icon button for table rows (label as tooltip and for screen readers). */
function IconAction({
  icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  tone?: "info" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  const color =
    tone === "danger"
      ? "text-error hover:bg-error-container"
      : tone === "info"
        ? "text-info hover:bg-info-container"
        : "text-on-surface-variant hover:bg-surface-container";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40 disabled:hover:bg-transparent ${color}`}
    >
      <Icon name={icon} className="text-icon-md" />
    </button>
  );
}
