"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { SortableTable, type SortableColumn } from "@/components/ui/sortable-table";
import { useToast } from "@/components/ui/toast";
import { useLanguageLabel } from "@/i18n/use-language-label";
import { useMsg } from "@/i18n/use-msg";
import type { MenuCategory } from "@/lib/menu/schema";
import { isDefaultName, tagName, type MenuTagRow } from "@/lib/menu/tags";
import {
  deleteCategoryAction,
  deleteTagAction,
  reorderCategoriesAction,
  reorderTagsAction,
  saveCategoryAction,
  saveTagAction,
  type MenuResult,
} from "./actions";
import { CategoryDialog } from "./manager";
import { TagDialog } from "./tag-dialog";

type Languages = { main: string; others: string[] };

/** Shared: run an action, toast its message, keep field errors for the open dialog. */
function useRun() {
  const m = useMsg();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = (
    fn: () => Promise<MenuResult>,
    after?: (r: Extract<MenuResult, { ok: true }>) => void,
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
  const reorder = async (fn: () => Promise<MenuResult>) => {
    const r = await fn();
    if (!r.ok) toast.show({ variant: "error", title: m(r.message) });
    return r.ok;
  };
  return { pending, errors, setErrors, run, reorder };
}

/** "FR ✓ · AR —": which of the café's other languages have a translation. */
function Translations({ languages, has }: { languages: Languages; has: (l: string) => boolean }) {
  const languageLabel = useLanguageLabel();
  if (!languages.others.length) return <span className="text-on-surface-variant">—</span>;
  return (
    <span className="flex flex-wrap gap-xs">
      {languages.others.map((l) => (
        <span
          key={l}
          title={languageLabel(l)}
          className={`inline-flex items-center gap-xs rounded-full px-sm text-caption font-semibold uppercase ${
            has(l)
              ? "bg-success-container text-success"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {l}
          <Icon name={has(l) ? "check" : "remove"} className="text-icon-sm" />
        </span>
      ))}
    </span>
  );
}

function StatusButton({
  visible,
  label,
  disabled,
  onClick,
}: {
  visible: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("menu");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={visible}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-xs rounded-full px-sm py-xs font-label-sm text-label-sm uppercase disabled:opacity-60 ${
        visible
          ? "bg-success-container text-success"
          : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      <Icon name={visible ? "visibility" : "visibility_off"} className="text-icon-sm" />
      {visible ? t("statusShown") : t("statusHiddenShort")}
    </button>
  );
}

function RowActions({
  editLabel,
  deleteLabel,
  deleteDisabledReason,
  onEdit,
  onDelete,
}: {
  editLabel: string;
  deleteLabel: string;
  deleteDisabledReason?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tc = useTranslations("common");
  return (
    <div className="flex items-start justify-end gap-xs">
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-info hover:bg-info-container"
      >
        <Icon name="edit" className="text-icon-md" />
        {tc("edit")}
      </button>
      <span title={deleteDisabledReason}>
        <button
          type="button"
          onClick={onDelete}
          disabled={!!deleteDisabledReason}
          aria-label={deleteLabel}
          className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-error hover:bg-error-container disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Icon name="delete" className="text-icon-md" />
          {tc("delete")}
        </button>
      </span>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-xs self-end rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container"
    >
      <Icon name="add" className="text-icon-lg" />
      {label}
    </button>
  );
}

/* ── Categories ─────────────────────────────────────────────────────────── */

export function CategoriesTab({
  slug,
  categories,
  languages,
  salesShare,
}: {
  slug: string;
  categories: MenuCategory[];
  languages: Languages;
  /** Category id → share of the period's sales (0–1), from the statistics. */
  salesShare: Record<string, number>;
}) {
  const t = useTranslations("menu");
  const { pending, errors, setErrors, run, reorder } = useRun();
  const [form, setForm] = useState<MenuCategory | "new" | null>(null);
  const [confirm, setConfirm] = useState<MenuCategory | null>(null);
  const pct = (x: number) => `${Math.round(x * 100)} %`;

  const columns: SortableColumn<MenuCategory>[] = [
    {
      key: "name",
      header: t("colName"),
      cell: (c) => <span className="font-semibold text-on-surface">{c.name}</span>,
    },
    {
      key: "tr",
      header: t("colTranslations"),
      cell: (c) => <Translations languages={languages} has={(l) => !!c.i18n[l]?.name} />,
    },
    {
      key: "items",
      header: t("colItems"),
      end: true,
      cell: (c) => <span className="tabular-nums">{c.itemCount}</span>,
    },
    {
      key: "sales",
      header: t("colSales"),
      end: true,
      cell: (c) => (
        <span className="text-on-surface-variant tabular-nums">
          {salesShare[c.id] ? pct(salesShare[c.id]) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: t("colStatus"),
      cell: (c) => (
        <StatusButton
          visible={c.isVisible}
          label={t("toggleVisible", { name: c.name })}
          disabled={pending}
          onClick={() =>
            run(() =>
              saveCategoryAction(
                slug,
                c.id,
                c.name,
                !c.isVisible,
                c.i18n as Record<string, Record<string, string>>,
              ),
            )
          }
        />
      ),
    },
    {
      key: "actions",
      header: t("colActions"),
      end: true,
      cell: (c) => (
        <RowActions
          editLabel={t("editName", { name: c.name })}
          deleteLabel={t("deleteName", { name: c.name })}
          deleteDisabledReason={
            c.itemCount ? t("categoryHasItems", { count: c.itemCount }) : undefined
          }
          onEdit={() => {
            setErrors({});
            setForm(c);
          }}
          onDelete={() => setConfirm(c)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <AddButton
        label={t("newCategory")}
        onClick={() => {
          setErrors({});
          setForm("new");
        }}
      />
      {categories.length ? (
        <SortableTable
          rows={categories}
          columns={columns}
          hint={t("dragCategories")}
          reorderLabel={t("reorderColumn")}
          handleLabel={(c) => t("reorder", { name: c.name })}
          isMuted={(c) => !c.isVisible}
          onReorder={(ids) => reorder(() => reorderCategoriesAction(slug, ids))}
        />
      ) : (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-center text-on-surface-variant shadow-sm">
          {t("noCategories")}
        </p>
      )}
      <CategoryDialog
        form={form}
        errors={errors}
        pending={pending}
        languages={languages}
        onClose={() => setForm(null)}
        onSubmit={(name, i18n) => {
          const c = form !== "new" ? form : null;
          run(
            () => saveCategoryAction(slug, c?.id ?? null, name, c?.isVisible ?? true, i18n),
            () => setForm(null),
          );
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        pending={pending}
        tone="danger"
        icon="delete"
        title={confirm ? t("deleteCategoryTitle", { name: confirm.name }) : ""}
        confirmLabel={t("deleteConfirm")}
        onConfirm={() => {
          const c = confirm;
          if (c)
            run(
              () => deleteCategoryAction(slug, c.id),
              () => setConfirm(null),
            );
        }}
      >
        {t("deleteCategoryBody")}
      </ConfirmDialog>
    </div>
  );
}

/* ── Tags ───────────────────────────────────────────────────────────────── */

export function TagsTab({
  slug,
  tags,
  languages,
}: {
  slug: string;
  tags: MenuTagRow[];
  languages: Languages;
}) {
  const t = useTranslations("menu");
  const tt = useTranslations("tags");
  const { pending, errors, setErrors, run, reorder } = useRun();
  const [form, setForm] = useState<MenuTagRow | "new" | null>(null);
  const [confirm, setConfirm] = useState<MenuTagRow | null>(null);
  const name = (tag: MenuTagRow) => tagName(tag, languages.main, (k) => tt(k));

  const columns: SortableColumn<MenuTagRow>[] = [
    {
      key: "name",
      header: t("colTag"),
      cell: (tag) => (
        <span className="flex items-center gap-sm font-semibold text-on-surface">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-container text-primary">
            <Icon name={tag.icon} className="text-icon-md" />
          </span>
          {name(tag)}
          {isDefaultName(tag) ? (
            <span className="rounded-full bg-surface-container px-sm text-caption font-normal text-on-surface-variant">
              {t("tagBuiltin")}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "tr",
      header: t("colTranslations"),
      cell: (tag) => (
        <Translations
          languages={languages}
          // Default built-in names come translated with the app.
          has={(l) => isDefaultName(tag) || !!tag.i18n[l]?.name}
        />
      ),
    },
    {
      key: "items",
      header: t("colItems"),
      end: true,
      cell: (tag) => <span className="tabular-nums">{tag.itemCount}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      cell: (tag) => (
        <StatusButton
          visible={tag.isVisible}
          label={t("toggleVisible", { name: name(tag) })}
          disabled={pending}
          onClick={() =>
            run(() =>
              saveTagAction(slug, tag.id, {
                name: tag.name ?? "",
                icon: tag.icon,
                isVisible: !tag.isVisible,
                i18n: tag.i18n,
              }),
            )
          }
        />
      ),
    },
    {
      key: "actions",
      header: t("colActions"),
      end: true,
      cell: (tag) => (
        <RowActions
          editLabel={t("editName", { name: name(tag) })}
          deleteLabel={t("deleteName", { name: name(tag) })}
          onEdit={() => {
            setErrors({});
            setForm(tag);
          }}
          onDelete={() => setConfirm(tag)}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-md">
      <AddButton
        label={t("tagNew")}
        onClick={() => {
          setErrors({});
          setForm("new");
        }}
      />
      {tags.length ? (
        <SortableTable
          rows={tags}
          columns={columns}
          hint={t("dragTags")}
          reorderLabel={t("reorderColumn")}
          handleLabel={(tag) => t("reorder", { name: name(tag) })}
          isMuted={(tag) => !tag.isVisible}
          onReorder={(ids) => reorder(() => reorderTagsAction(slug, ids))}
        />
      ) : (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-center text-on-surface-variant shadow-sm">
          {t("noTags")}
        </p>
      )}
      <TagDialog
        form={form}
        languages={languages}
        pending={pending}
        errors={errors}
        onClose={() => setForm(null)}
        onSubmit={(input) => {
          const tag = form !== "new" ? form : null;
          run(
            () => saveTagAction(slug, tag?.id ?? null, input),
            () => setForm(null),
          );
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        pending={pending}
        tone="danger"
        icon="delete"
        title={confirm ? t("deleteTagTitle", { name: name(confirm) }) : ""}
        confirmLabel={t("deleteConfirm")}
        onConfirm={() => {
          const tag = confirm;
          if (tag)
            run(
              () => deleteTagAction(slug, tag.id),
              () => setConfirm(null),
            );
        }}
      >
        {confirm ? t("deleteTagBody", { count: confirm.itemCount }) : ""}
      </ConfirmDialog>
    </div>
  );
}
