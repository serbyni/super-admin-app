"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { TextField } from "@/components/auth/fields";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { useLanguageLabel } from "@/i18n/use-language-label";
import { useMsg } from "@/i18n/use-msg";
import { isRtlLanguage } from "@/lib/i18n/languages";
import { TAG_ICONS, isDefaultName, type MenuTagRow, type TagIcon } from "@/lib/menu/tags";

export type TagInput = {
  name: string;
  icon: TagIcon;
  isVisible: boolean;
  i18n: Record<string, { name: string }>;
};

/**
 * New / edit tag: name in the menu language (+ translations), an icon from the curated list,
 * shown on the menu or not. A built-in with an empty name keeps its default (translated) name.
 */
export function TagDialog({
  form,
  languages,
  pending,
  errors,
  onClose,
  onSubmit,
}: {
  form: MenuTagRow | "new" | null;
  languages: { main: string; others: string[] };
  pending: boolean;
  errors: Record<string, string>;
  onClose: () => void;
  onSubmit: (input: TagInput) => void;
}) {
  const t = useTranslations("menu");
  return (
    <Dialog
      open={form !== null}
      onClose={onClose}
      title={form === "new" ? t("tagNew") : t("tagEdit")}
      icon="sell"
    >
      {form !== null ? (
        <TagForm
          key={form === "new" ? "new" : form.id}
          tag={form === "new" ? null : form}
          languages={languages}
          pending={pending}
          errors={errors}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  );
}

function TagForm({
  tag,
  languages,
  pending,
  errors,
  onClose,
  onSubmit,
}: {
  tag: MenuTagRow | null;
  languages: { main: string; others: string[] };
  pending: boolean;
  errors: Record<string, string>;
  onClose: () => void;
  onSubmit: (input: TagInput) => void;
}) {
  const t = useTranslations("menu");
  const tt = useTranslations("tags");
  const tc = useTranslations("common");
  const m = useMsg();
  const languageLabel = useLanguageLabel();
  const builtinName = tag?.key ? tt(tag.key) : "";
  const [name, setName] = useState(tag?.name ?? "");
  const [icon, setIcon] = useState<TagIcon>((tag?.icon as TagIcon) ?? "star");
  const [visible, setVisible] = useState(tag?.isVisible ?? true);
  const [i18n, setI18n] = useState<Record<string, string>>(() =>
    Object.fromEntries(languages.others.map((l) => [l, tag?.i18n[l]?.name ?? ""])),
  );
  const shown = name.trim() || builtinName || t("tagNamePlaceholder");

  return (
    <form
      noValidate
      className="flex flex-col gap-md"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: name.trim(),
          icon,
          isVisible: visible,
          i18n: Object.fromEntries(Object.entries(i18n).map(([l, v]) => [l, { name: v.trim() }])),
        });
      }}
    >
      <TextField
        id="tag-name"
        label={`${t("name")} · ${languageLabel(languages.main)}`}
        required={!tag?.key}
        maxLength={40}
        placeholder={builtinName || t("tagNamePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name ? m(errors.name) : undefined}
      />
      {tag?.key ? (
        <p className="-mt-sm flex flex-wrap items-center gap-xs text-caption text-on-surface-variant">
          {t("tagBuiltinHint", { name: builtinName })}
          {!isDefaultName({ key: tag.key, name: name.trim() || null }) ? (
            <button
              type="button"
              onClick={() => setName("")}
              className="font-semibold text-primary underline underline-offset-2"
            >
              {t("tagResetName")}
            </button>
          ) : null}
        </p>
      ) : null}
      {name.trim()
        ? languages.others.map((l) => (
            <TextField
              key={l}
              id={`tag-name-${l}`}
              label={t("nameInOptional", { language: languageLabel(l) })}
              maxLength={40}
              dir={isRtlLanguage(l) ? "rtl" : "ltr"}
              value={i18n[l] ?? ""}
              onChange={(e) => setI18n((x) => ({ ...x, [l]: e.target.value }))}
            />
          ))
        : null}

      <IconPicker
        icons={TAG_ICONS}
        value={icon}
        onChange={(i) => setIcon(i as TagIcon)}
        label={t("tagIcon")}
        error={errors.icon ? m(errors.icon) : undefined}
      />

      <label className="flex items-center gap-sm text-body-sm text-on-surface">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        {t("tagVisible")}
      </label>

      <div className="flex items-center gap-sm rounded-lg bg-surface-container-low p-sm text-body-sm">
        <span className="text-on-surface-variant">{t("tagPreview")}</span>
        <span className="inline-flex items-center gap-xs rounded-full border border-outline-variant px-sm py-xs text-on-surface">
          <Icon name={icon} className="text-icon-md" /> {shown}
        </span>
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
          disabled={pending || (!tag?.key && !name.trim())}
          className="inline-flex items-center justify-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
        >
          {pending ? <Icon name="progress_activity" className="animate-spin text-icon-lg" /> : null}
          {tag ? t("save") : t("tagAdd")}
        </button>
      </div>
    </form>
  );
}
