"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { Section } from "@/components/settings/form-kit";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useMsg } from "@/i18n/use-msg";
import type { MenuDisplay, MenuMode } from "@/lib/data/services/cafes";
import { setMenuDisplayAction } from "./actions";

/** A selectable card (radio) with a small drawing. */
function Choice({
  name,
  checked,
  disabled,
  onChange,
  title,
  body,
  art,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  body: string;
  art: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-sm rounded-xl border-2 p-md ${
        checked ? "border-primary bg-secondary-container/40" : "border-outline-variant"
      } ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-primary/60"}`}
    >
      <span className="flex items-start gap-sm">
        <input
          type="radio"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="mt-xs h-4 w-4 accent-primary"
        />
        <span className="flex flex-col gap-xs">
          <span className="font-semibold text-on-surface">{title}</span>
          <span className="text-body-sm text-on-surface-variant">{body}</span>
        </span>
      </span>
      <span
        aria-hidden="true"
        className="flex h-24 items-center justify-center rounded-lg bg-surface-container-low"
      >
        {art}
      </span>
    </label>
  );
}

/** Drawings (CSS only): an open book, a list, a cart, a menu card. */
const BookArt = () => (
  <span className="flex perspective-near">
    <span className="h-16 w-12 origin-right rotate-y-12 rounded-s-md border border-outline-variant bg-surface-container-lowest shadow-sm" />
    <span className="h-16 w-1 bg-primary" />
    <span className="h-16 w-12 origin-left -rotate-y-12 rounded-e-md border border-outline-variant bg-surface-container-lowest shadow-sm" />
  </span>
);
const ListArt = () => (
  <span className="flex w-28 flex-col gap-xs">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="flex items-center gap-xs rounded-md bg-surface-container-lowest p-xs shadow-sm"
      >
        <span className="h-3 w-3 rounded-sm bg-primary/30" />
        <span className="h-1.5 flex-1 rounded-full bg-outline-variant" />
      </span>
    ))}
  </span>
);
const IconArt = ({ name }: { name: string }) => (
  <Icon name={name} className="text-icon-3xl text-primary" />
);

/**
 * Settings → Menu display: online ordering or menu only; in menu-only mode, list or 3D book.
 */
export function MenuDisplayTab({
  slug,
  mode,
  display,
  menuUrl,
}: {
  slug: string;
  mode: MenuMode;
  display: MenuDisplay;
  menuUrl: string;
}) {
  const t = useTranslations("menuDisplay");
  const m = useMsg();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [m1, setMode] = useState<MenuMode>(mode);
  const [d1, setDisplay] = useState<MenuDisplay>(display);
  const dirty = m1 !== mode || d1 !== display;
  const save = () =>
    start(async () => {
      const r = await setMenuDisplayAction(slug, m1, d1);
      toast.show({ variant: r.ok ? "success" : "error", title: m(r.message) });
    });

  return (
    <div className="flex flex-col gap-lg">
      <Section title={t("modeTitle")} icon="storefront" description={t("modeBody")}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <Choice
            name="mode"
            checked={m1 === "order"}
            onChange={() => setMode("order")}
            title={t("order")}
            body={t("orderBody")}
            art={<IconArt name="shopping_bag" />}
          />
          <Choice
            name="mode"
            checked={m1 === "menu_only"}
            onChange={() => setMode("menu_only")}
            title={t("menuOnly")}
            body={t("menuOnlyBody")}
            art={<IconArt name="menu_book" />}
          />
        </div>
      </Section>
      <Section title={t("displayTitle")} icon="auto_stories" description={t("displayBody")}>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <Choice
            name="display"
            checked={m1 !== "menu_only" || d1 === "list"}
            onChange={() => setDisplay("list")}
            disabled={m1 !== "menu_only"}
            title={t("list")}
            body={t("listBody")}
            art={<ListArt />}
          />
          <Choice
            name="display"
            checked={m1 === "menu_only" && d1 === "book"}
            onChange={() => setDisplay("book")}
            disabled={m1 !== "menu_only"}
            title={t("book")}
            body={t("bookBody")}
            art={<BookArt />}
          />
        </div>
        {m1 !== "menu_only" ? (
          <p className="mt-sm flex items-center gap-xs text-caption text-on-surface-variant">
            <Icon name="info" className="text-icon-sm" />
            {t("bookNeedsMenuOnly")}
          </p>
        ) : null}
      </Section>
      <div className="flex flex-wrap items-center justify-end gap-sm">
        <a
          href={menuUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container"
        >
          <Icon name="open_in_new" className="text-icon-md" />
          {t("seeIt")}
        </a>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex items-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
        >
          {pending ? <Icon name="progress_activity" className="animate-spin text-icon-md" /> : null}
          {t("save")}
        </button>
      </div>
    </div>
  );
}
