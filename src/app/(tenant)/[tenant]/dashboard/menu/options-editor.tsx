"use client";

import { useTranslations } from "next-intl";
import { TextField } from "@/components/auth/fields";
import { Icon } from "@/components/ui/icon";
import { useLanguageLabel } from "@/i18n/use-language-label";
import { isRtlLanguage } from "@/lib/i18n/languages";
import { OPTION_LIMITS, parsePrice, type OptionGroup } from "@/lib/menu/schema";

/*
 * Item options editor (size, milk, extras…): groups of choices, each choice can add a price.
 * Prices are kept as typed text while editing and converted on save (toOptionGroups).
 */

export type EditChoice = {
  id: string;
  name: string;
  i18n: Record<string, { name?: string }>;
  priceText: string;
  isAvailable: boolean;
};
export type EditGroup = Omit<OptionGroup, "choices" | "i18n"> & {
  i18n: Record<string, { name?: string }>;
  choices: EditChoice[];
};

const newId = (p: string) => `${p}${crypto.randomUUID().slice(0, 8)}`;

export function fromOptionGroups(groups: OptionGroup[], digits: number): EditGroup[] {
  return groups.map((g) => ({
    ...g,
    i18n: { ...g.i18n },
    choices: g.choices.map((c) => ({
      id: c.id,
      name: c.name,
      i18n: { ...c.i18n },
      priceText: c.price ? c.price.toFixed(digits) : "",
      isAvailable: c.isAvailable,
    })),
  }));
}

/** Editor state → saved shape (an unreadable price becomes -1 and is refused by the schema). */
export function toOptionGroups(groups: EditGroup[]): OptionGroup[] {
  return groups.map((g) => ({
    id: g.id,
    name: g.name.trim(),
    i18n: g.i18n as OptionGroup["i18n"],
    min: g.min,
    max: Math.min(g.max, Math.max(1, g.choices.length)),
    choices: g.choices.map((c) => {
      const p = parsePrice(c.priceText);
      return {
        id: c.id,
        name: c.name.trim(),
        i18n: c.i18n as OptionGroup["i18n"],
        price: p === null ? 0 : Number.isNaN(p) ? -1 : p,
        isAvailable: c.isAvailable,
      };
    }),
  }));
}

const box =
  "rounded-lg border border-outline-variant bg-transparent px-sm py-xs text-body-sm text-on-surface focus:border-primary focus:outline-none";

export function OptionsEditor({
  value,
  onChange,
  currency,
  error,
}: {
  value: EditGroup[];
  onChange: (v: EditGroup[]) => void;
  currency: string;
  error?: string;
}) {
  const t = useTranslations("menu.options");
  const set = (fn: (gs: EditGroup[]) => void) => {
    const next = structuredClone(value);
    fn(next);
    onChange(next);
  };
  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="mb-xs text-body-sm font-semibold text-on-surface">{t("title")}</legend>
      <p className="-mt-xs text-caption text-on-surface-variant">{t("hint")}</p>
      {value.map((g, gi) => (
        <div
          key={g.id}
          className="flex flex-col gap-sm rounded-lg border border-surface-container-high p-sm"
        >
          <div className="flex items-start gap-xs">
            <div className="flex-1">
              <TextField
                id={`opt-${g.id}`}
                label={t("groupName")}
                maxLength={40}
                value={g.name}
                onChange={(e) => {
                  const v = e.target.value;
                  set((gs) => {
                    gs[gi].name = v;
                  });
                }}
              />
            </div>
            <Small
              icon="arrow_upward"
              label={t("moveUp")}
              disabled={gi === 0}
              onClick={() =>
                set((gs) => {
                  [gs[gi - 1], gs[gi]] = [gs[gi], gs[gi - 1]];
                })
              }
            />
            <Small
              icon="arrow_downward"
              label={t("moveDown")}
              disabled={gi === value.length - 1}
              onClick={() =>
                set((gs) => {
                  [gs[gi + 1], gs[gi]] = [gs[gi], gs[gi + 1]];
                })
              }
            />
            <Small
              icon="delete"
              label={t("removeGroup")}
              danger
              onClick={() =>
                set((gs) => {
                  gs.splice(gi, 1);
                })
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-md text-body-sm text-on-surface">
            <label className="flex items-center gap-xs">
              <input
                type="checkbox"
                checked={g.min === 1}
                onChange={(e) => {
                  const on = e.target.checked;
                  set((gs) => {
                    gs[gi].min = on ? 1 : 0;
                  });
                }}
                className="h-4 w-4 accent-primary"
              />
              {t("required")}
            </label>
            <label className="flex items-center gap-xs">
              {t("choose")}
              <select
                value={Math.min(g.max, g.choices.length)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set((gs) => {
                    gs[gi].max = n;
                  });
                }}
                className={box}
              >
                {g.choices.map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i === 0 ? t("one") : t("upTo", { count: i + 1 })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="flex flex-col gap-xs">
            {g.choices.map((c, ci) => (
              <li key={c.id} className="flex flex-wrap items-center gap-xs">
                <input
                  aria-label={t("choiceName")}
                  placeholder={t("choiceName")}
                  maxLength={40}
                  value={c.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    set((gs) => {
                      gs[gi].choices[ci].name = v;
                    });
                  }}
                  className={`${box} min-w-0 flex-1`}
                />
                <input
                  aria-label={t("choicePrice", { currency })}
                  placeholder={t("choicePricePlaceholder", { currency })}
                  inputMode="decimal"
                  value={c.priceText}
                  onChange={(e) => {
                    const v = e.target.value;
                    set((gs) => {
                      gs[gi].choices[ci].priceText = v;
                    });
                  }}
                  className={`${box} w-28`}
                  dir="ltr"
                />
                <label className="flex items-center gap-xs text-caption text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={c.isAvailable}
                    onChange={(e) => {
                      const on = e.target.checked;
                      set((gs) => {
                        gs[gi].choices[ci].isAvailable = on;
                      });
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  {t("available")}
                </label>
                <Small
                  icon="close"
                  label={t("removeChoice")}
                  disabled={g.choices.length === 1}
                  onClick={() =>
                    set((gs) => {
                      gs[gi].choices.splice(ci, 1);
                      gs[gi].max = Math.min(gs[gi].max, gs[gi].choices.length);
                    })
                  }
                />
              </li>
            ))}
          </ul>
          {g.choices.length < OPTION_LIMITS.choices ? (
            <button
              type="button"
              onClick={() =>
                set((gs) => {
                  gs[gi].choices.push({
                    id: newId("c"),
                    name: "",
                    i18n: {},
                    priceText: "",
                    isAvailable: true,
                  });
                })
              }
              className="inline-flex w-fit items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
            >
              <Icon name="add" className="text-icon-md" /> {t("addChoice")}
            </button>
          ) : null}
        </div>
      ))}
      {value.length < OPTION_LIMITS.groups ? (
        <button
          type="button"
          onClick={() =>
            onChange([
              ...value,
              {
                id: newId("g"),
                name: "",
                i18n: {},
                min: 1,
                max: 1,
                choices: [
                  { id: newId("c"), name: "", i18n: {}, priceText: "", isAvailable: true },
                  { id: newId("c"), name: "", i18n: {}, priceText: "", isAvailable: true },
                ],
              },
            ])
          }
          className="inline-flex w-fit items-center gap-xs rounded-lg border border-dashed border-outline-variant px-md py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
        >
          <Icon name="add" className="text-icon-md" /> {t("addGroup")}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-xs text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Translation tab: option and choice names in another language (original as placeholder). */
export function OptionsTranslation({
  value,
  onChange,
  lang,
}: {
  value: EditGroup[];
  onChange: (v: EditGroup[]) => void;
  lang: string;
}) {
  const t = useTranslations("menu.options");
  const languageLabel = useLanguageLabel();
  if (!value.length) return null;
  const set = (fn: (gs: EditGroup[]) => void) => {
    const next = structuredClone(value);
    fn(next);
    onChange(next);
  };
  const dir = isRtlLanguage(lang) ? "rtl" : "ltr";
  return (
    <fieldset className="flex flex-col gap-xs">
      <legend className="mb-xs text-body-sm font-semibold text-on-surface">
        {t("translationTitle", { language: languageLabel(lang) })}
      </legend>
      {value.map((g, gi) => (
        <div key={g.id} className="flex flex-col gap-xs rounded-lg bg-surface-container-low p-sm">
          <input
            aria-label={t("translationOf", { name: g.name })}
            placeholder={g.name}
            dir={dir}
            maxLength={40}
            value={g.i18n[lang]?.name ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set((gs) => {
                gs[gi].i18n[lang] = { name: v };
              });
            }}
            className={`${box} font-semibold`}
          />
          {g.choices.map((c, ci) => (
            <input
              key={c.id}
              aria-label={t("translationOf", { name: c.name })}
              placeholder={c.name}
              dir={dir}
              maxLength={40}
              value={c.i18n[lang]?.name ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                set((gs) => {
                  gs[gi].choices[ci].i18n[lang] = { name: v };
                });
              }}
              className={`${box} ms-md`}
            />
          ))}
        </div>
      ))}
    </fieldset>
  );
}

function Small({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-surface-container disabled:opacity-40 ${danger ? "text-error" : "text-on-surface-variant"}`}
    >
      <Icon name={icon} className="text-icon-md" />
    </button>
  );
}
