"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { TextAreaField, TextField } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { GalleryField, ImageField } from "@/components/media/image-fields";
import { useLanguageLabel } from "@/i18n/use-language-label";
import { useMsg } from "@/i18n/use-msg";
import { msg, type MsgKey } from "@/i18n/msg";
import { isRtlLanguage } from "@/lib/i18n/languages";
import { WebsitePreview, type FeaturedItem } from "@/components/website/website-preview";
import type { CafePalette } from "@/lib/cafes/theme";
import {
  HIGHLIGHT_ICONS,
  LIMITS,
  SPECIALTIES_MAX,
  type OpeningDay,
  translatableFields,
  translateWebsite,
  websiteErrors,
  websiteSchema,
  type Website,
  type WebsiteSection,
} from "@/lib/website/schema";
import {
  discardWebsiteAction,
  publishWebsiteAction,
  saveWebsiteAction,
  type WebsiteResult,
} from "./actions";

const SECTION_ICON: Record<WebsiteSection["type"], string> = {
  how_it_works: "qr_code_2",
  story: "auto_stories",
  gallery: "photo_library",
  specialties: "stars",
};

/**
 * Website schema messages are English (the schema is shared with cafe-app): known ones are
 * shown translated, anything else as a generic "check this value".
 */
const SCHEMA_MESSAGES: Record<string, MsgKey> = {
  "Use HH:MM": "useHHMM",
  "Upload the photo again": "menuPhoto",
  "Closing time must differ from opening time": "closingDiffers",
  "Tell your story (10+ characters) or hide this section": "storyRequired",
  "Add at least one photo or hide this section": "galleryRequired",
};
const localErrors = (errors: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(errors).map(([k, v]) => [
      k,
      v.startsWith("§") ? v : msg(SCHEMA_MESSAGES[v] ?? "checkValue"),
    ]),
  );

type Props = {
  slug: string;
  cafeId: string;
  cafeName: string;
  palette: CafePalette;
  contact: { address: string | null; phone: string | null; hours: OpeningDay[] | null };
  initial: Website;
  /** Website as customers see it now (null = never published). */
  published: Website | null;
  publishedAt: string | null;
  /** Featured, visible, priced menu items (the "Signature specialties"), max 4. */
  featured: FeaturedItem[];
  /** Owner's Menu page (to mark items as Featured). */
  menuHref: string;
  /** Settings → Opening hours (hours moved there). */
  hoursHref: string;
  /** Main language and the other offered languages (translation mode). */
  languages: { main: string; others: string[] };
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function WebsiteEditor({
  slug,
  cafeId,
  cafeName,
  palette,
  contact,
  initial,
  published,
  publishedAt,
  featured,
  menuHref,
  hoursHref,
  languages,
}: Props) {
  const t = useTranslations("website");
  const tc = useTranslations("common");
  const m = useMsg();
  const format = useFormatter();
  const languageLabel = useLanguageLabel();
  const when = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : "";
  const sectionLabel = (type: WebsiteSection["type"]) => t(`sections.${type}`);
  /** Label of a translatable text, from its stable key ("sections.story.points.1.text"). */
  const fieldLabel = (key: string): string => {
    const parts = key.split(".");
    if (parts[0] === "hero") {
      if (parts[1] === "badge") return t("fieldLabels.badge");
      if (parts[1] === "title") return t("fieldLabels.headline");
      if (parts[1] === "subtitle") return t("fieldLabels.introduction");
      return t("fieldLabels.highlight", { n: Number(parts[2]) + 1 });
    }
    const section = sectionLabel(parts[1] as WebsiteSection["type"]);
    if (parts[2] === "points")
      return parts[4] === "text"
        ? t("fieldLabels.pointDetail", { section, n: Number(parts[3]) + 1 })
        : t("fieldLabels.point", { section, n: Number(parts[3]) + 1 });
    if (parts[2] === "title") return t("fieldLabels.sectionTitle", { section });
    if (parts[2] === "quote") return t("fieldLabels.quote", { section });
    if (parts[2] === "quoteAuthor") return t("fieldLabels.quoteAuthor", { section });
    return parts[1] === "story"
      ? t("fieldLabels.sectionText", { section })
      : t("fieldLabels.sectionIntro", { section });
  };
  const days = t("days").split("|");
  const toast = useToast();
  const [lang, setLang] = useState(languages.main);
  const [doc, setDoc] = useState<Website>(initial);
  const [saved, setSaved] = useState<Website>(initial);
  const [live, setLive] = useState({ doc: published, at: publishedAt });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const unsaved = !same(doc, saved);
  const unpublished = !same(doc, live.doc);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const update = (fn: (d: Website) => Website) => setDoc((d) => fn(structuredClone(d)));
  const err = (key: string) => errors[key];
  const setLocalErrors = (e: Record<string, string>) => setErrors(localErrors(e));

  const run = (kind: "save" | "publish") => {
    const check = websiteSchema.safeParse(doc);
    if (!check.success) {
      setLocalErrors(websiteErrors(check.error));
      toast.show({ variant: "error", title: t("fixErrors") });
      return;
    }
    start(async () => {
      const r: WebsiteResult =
        kind === "save"
          ? await saveWebsiteAction(slug, doc)
          : await publishWebsiteAction(slug, doc);
      if (!r.ok) {
        setLocalErrors(r.errors ?? {});
        toast.show({ variant: "error", title: m(r.message) });
        return;
      }
      setErrors({});
      setSaved(doc);
      if (kind === "publish") {
        setLive({ doc, at: r.publishedAt ?? null });
        toast.show({
          variant: "success",
          title: t("published"),
          description: t("publishedBody"),
        });
      } else {
        toast.show({ variant: "success", title: t("draftSaved") });
      }
    });
  };

  const discard = () =>
    start(async () => {
      const r = await discardWebsiteAction(slug);
      setConfirmDiscard(false);
      if (!r.ok) {
        toast.show({ variant: "error", title: m(r.message) });
        return;
      }
      const next = r.draft ?? live.doc ?? initial;
      setDoc(next);
      setSaved(next);
      setErrors({});
      toast.show({ variant: "success", title: t("discarded") });
    });

  const status = useMemo(() => {
    if (!live.doc)
      return {
        tone: "bg-secondary-container text-on-secondary-container",
        text: t("statusNever"),
      };
    if (unpublished)
      return {
        tone: "bg-warning-container text-on-warning-container",
        text: t("statusUnpublished", { date: when(live.at) }),
      };
    return {
      tone: "bg-success-container text-on-success-container",
      text: t("statusPublished", { date: when(live.at) }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/when follow the page language
  }, [live, unpublished]);

  return (
    <div className="flex flex-col gap-lg">
      {/* Status + actions */}
      <div className="sticky top-0 z-30 -mx-gutter flex flex-col gap-sm bg-background/90 px-gutter py-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <p className={`w-fit rounded-full px-md py-xs text-body-sm font-semibold ${status.tone}`}>
          {status.text}
        </p>
        <div className="flex flex-wrap gap-sm">
          {unpublished && live.doc ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmDiscard(true)}
              className="rounded-xl px-md py-sm text-body-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-60"
            >
              {t("discard")}
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending || !unsaved}
            onClick={() => run("save")}
            className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container disabled:opacity-60"
          >
            <Icon name="save" className="text-icon-md" />{" "}
            {unsaved ? t("saveDraft") : t("draftSavedButton")}
          </button>
          <button
            type="button"
            disabled={pending || !unpublished}
            onClick={() => run("publish")}
            className="inline-flex items-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
          >
            <Icon
              name={pending ? "progress_activity" : "publish"}
              className={`text-icon-md ${pending ? "animate-spin" : ""}`}
            />
            {t("publish")}
          </button>
        </div>
      </div>

      {languages.others.length ? (
        <div
          role="tablist"
          aria-label={t("language")}
          className="flex flex-wrap items-center gap-xs"
        >
          <span className="me-xs flex items-center gap-xs text-body-sm text-on-surface-variant">
            <Icon name="translate" className="text-icon-md" /> {t("editing")}
          </span>
          {[languages.main, ...languages.others].map((l) => {
            const fields = translatableFields(doc);
            const done = fields.filter((f) => doc.i18n?.[l]?.[f.key]?.trim()).length;
            return (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={`inline-flex items-center gap-xs rounded-full px-md py-xs text-body-sm font-semibold ${
                  lang === l
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {languageLabel(l)}
                <span className="opacity-75">
                  {l === languages.main ? t("main") : `${done}/${fields.length}`}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-lg xl:grid-cols-5">
        <div className="flex flex-col gap-lg xl:col-span-3">
          {lang !== languages.main ? (
            <Card
              icon="translate"
              title={t("translationTitle", { language: languageLabel(lang) })}
              hint={t("translationHint", {
                language: languageLabel(lang),
                main: languageLabel(languages.main),
              })}
            >
              <div className="flex flex-col gap-md" lang={lang}>
                {translatableFields(doc).map((f) => {
                  const value = doc.i18n?.[lang]?.[f.key] ?? "";
                  const onChange = (v: string) =>
                    update((d) => {
                      d.i18n = {
                        ...(d.i18n ?? {}),
                        [lang]: { ...(d.i18n?.[lang] ?? {}), [f.key]: v },
                      };
                      return d;
                    });
                  const common = {
                    id: `tr-${lang}-${f.key}`,
                    label: fieldLabel(f.key),
                    maxLength: f.max,
                    value,
                    dir: isRtlLanguage(lang) ? "rtl" : "ltr",
                    hint: t("original", { text: f.value }),
                  } as const;
                  return f.multiline ? (
                    <TextAreaField
                      key={f.key}
                      {...common}
                      rows={3}
                      onChange={(e) => onChange(e.target.value)}
                    />
                  ) : (
                    <TextField key={f.key} {...common} onChange={(e) => onChange(e.target.value)} />
                  );
                })}
              </div>
            </Card>
          ) : null}
          <div className="flex flex-col gap-lg" hidden={lang !== languages.main}>
            {/* Hero */}
            <Card icon="wallpaper" title={t("heroTitle")} hint={t("heroHint")}>
              <div className="flex flex-col gap-md">
                <TextField
                  id="hero-title"
                  label={t("headline")}
                  required
                  maxLength={80}
                  value={doc.hero.title}
                  error={err("hero.title")}
                  onChange={(e) => {
                    const v = e.target.value;
                    update((d) => {
                      d.hero.title = v;
                      return d;
                    });
                  }}
                />
                <TextAreaField
                  id="hero-subtitle"
                  label={t("shortIntro")}
                  rows={3}
                  maxLength={240}
                  value={doc.hero.subtitle}
                  error={err("hero.subtitle")}
                  onChange={(e) => {
                    const v = e.target.value;
                    update((d) => {
                      d.hero.subtitle = v;
                      return d;
                    });
                  }}
                />
                <TextField
                  id="hero-badge"
                  label={t("badgeLabel")}
                  maxLength={40}
                  placeholder={t("badgePlaceholder")}
                  value={doc.hero.badge}
                  error={err("hero.badge")}
                  onChange={(e) => {
                    const v = e.target.value;
                    update((d) => {
                      d.hero.badge = v;
                      return d;
                    });
                  }}
                />
                <ImageField
                  cafeId={cafeId}
                  label={t("coverPhoto")}
                  value={doc.hero.image}
                  error={err("hero.image.path")}
                  onChange={(img) =>
                    update((d) => {
                      d.hero.image = img;
                      return d;
                    })
                  }
                />
                <div className="flex flex-col gap-sm">
                  <p className="text-body-sm font-semibold text-on-surface">
                    {t("highlightsUpTo", { max: LIMITS.highlights })}
                  </p>
                  {doc.hero.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-sm">
                      <select
                        aria-label={t("icon")}
                        value={h.icon}
                        onChange={(e) => {
                          const v = e.target.value;
                          update((d) => {
                            d.hero.highlights[i].icon = v;
                            return d;
                          });
                        }}
                        className="rounded-lg border border-outline-variant bg-transparent px-sm py-3.5 text-body-sm"
                      >
                        {HIGHLIGHT_ICONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {t(`icons.${o.value}`)}
                          </option>
                        ))}
                      </select>
                      <div className="flex-1">
                        <TextField
                          id={`hero-hl-${i}`}
                          label={t("label")}
                          required
                          maxLength={30}
                          value={h.label}
                          error={err(`hero.highlights.${i}.label`)}
                          onChange={(e) => {
                            const v = e.target.value;
                            update((d) => {
                              d.hero.highlights[i].label = v;
                              return d;
                            });
                          }}
                        />
                      </div>
                      <IconButton
                        icon="close"
                        label={t("removeHighlight")}
                        onClick={() =>
                          update((d) => {
                            d.hero.highlights.splice(i, 1);
                            return d;
                          })
                        }
                      />
                    </div>
                  ))}
                  {doc.hero.highlights.length < LIMITS.highlights ? (
                    <AddButton
                      label={t("addHighlight")}
                      onClick={() =>
                        update((d) => {
                          d.hero.highlights.push({ icon: "local_cafe", label: "" });
                          return d;
                        })
                      }
                    />
                  ) : null}
                </div>
              </div>
            </Card>

            {/* Sections */}
            {doc.sections.map((s, i) => {
              const label = sectionLabel(s.type);
              const set = (fn: (x: WebsiteSection) => void) =>
                update((d) => {
                  fn(d.sections[i]);
                  return d;
                });
              const k = (f: string) => `sections.${i}.${f}`;
              return (
                <Card
                  key={s.type}
                  icon={SECTION_ICON[s.type]}
                  title={label}
                  hint={t(`hints.${s.type}`, {
                    max: s.type === "gallery" ? LIMITS.galleryImages : SPECIALTIES_MAX,
                  })}
                  muted={!s.enabled}
                  actions={
                    <>
                      <IconButton
                        icon="arrow_upward"
                        label={t("moveUp")}
                        disabled={i === 0}
                        onClick={() =>
                          update((d) => {
                            [d.sections[i - 1], d.sections[i]] = [d.sections[i], d.sections[i - 1]];
                            return d;
                          })
                        }
                      />
                      <IconButton
                        icon="arrow_downward"
                        label={t("moveDown")}
                        disabled={i === doc.sections.length - 1}
                        onClick={() =>
                          update((d) => {
                            [d.sections[i + 1], d.sections[i]] = [d.sections[i], d.sections[i + 1]];
                            return d;
                          })
                        }
                      />
                      <Switch
                        checked={s.enabled}
                        label={t("showSection", { section: label })}
                        onChange={(on) =>
                          set((x) => {
                            x.enabled = on;
                          })
                        }
                      />
                    </>
                  }
                >
                  {s.enabled ? (
                    <div className="flex flex-col gap-md">
                      <TextField
                        id={`s-${s.type}-title`}
                        label={t("fieldTitle")}
                        required
                        maxLength={80}
                        value={s.title}
                        error={err(k("title"))}
                        onChange={(e) => {
                          const v = e.target.value;
                          set((x) => {
                            x.title = v;
                          });
                        }}
                      />
                      {s.type === "how_it_works" ? (
                        <TextAreaField
                          id="s-how-text"
                          label={t("fieldIntro")}
                          rows={3}
                          maxLength={300}
                          value={s.text}
                          error={err(k("text"))}
                          onChange={(e) => {
                            const v = e.target.value;
                            set((x) => {
                              if (x.type === "how_it_works") x.text = v;
                            });
                          }}
                        />
                      ) : null}
                      {s.type === "story" ? (
                        <>
                          <TextAreaField
                            id="s-story-text"
                            label={t("yourStory")}
                            rows={6}
                            maxLength={1200}
                            value={s.text}
                            error={err(k("text"))}
                            onChange={(e) => {
                              const v = e.target.value;
                              set((x) => {
                                if (x.type === "story") x.text = v;
                              });
                            }}
                          />
                          <ImageField
                            cafeId={cafeId}
                            label={t("photo")}
                            value={s.image}
                            error={err(k("image.path"))}
                            onChange={(img) =>
                              set((x) => {
                                if (x.type === "story") x.image = img;
                              })
                            }
                          />
                          <div className="flex flex-col gap-sm">
                            <p className="text-body-sm font-semibold text-on-surface">
                              {t("highlightsUpTo", { max: LIMITS.points })}
                            </p>
                            {s.points.map((p, j) => (
                              <div key={j} className="flex items-start gap-sm">
                                <div className="grid flex-1 grid-cols-1 gap-sm sm:grid-cols-2">
                                  <TextField
                                    id={`s-pt-${j}-t`}
                                    label={t("fieldTitle")}
                                    required
                                    maxLength={50}
                                    value={p.title}
                                    error={err(k(`points.${j}.title`))}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      set((x) => {
                                        if (x.type === "story") x.points[j].title = v;
                                      });
                                    }}
                                  />
                                  <TextField
                                    id={`s-pt-${j}-x`}
                                    label={t("detail")}
                                    maxLength={140}
                                    value={p.text}
                                    error={err(k(`points.${j}.text`))}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      set((x) => {
                                        if (x.type === "story") x.points[j].text = v;
                                      });
                                    }}
                                  />
                                </div>
                                <IconButton
                                  icon="close"
                                  label={t("removeHighlight")}
                                  onClick={() =>
                                    set((x) => {
                                      if (x.type === "story") x.points.splice(j, 1);
                                    })
                                  }
                                />
                              </div>
                            ))}
                            {s.points.length < LIMITS.points ? (
                              <AddButton
                                label={t("addHighlight")}
                                onClick={() =>
                                  set((x) => {
                                    if (x.type === "story") x.points.push({ title: "", text: "" });
                                  })
                                }
                              />
                            ) : null}
                          </div>
                          <TextAreaField
                            id="s-story-quote"
                            label={t("quote")}
                            rows={2}
                            maxLength={280}
                            value={s.quote}
                            error={err(k("quote"))}
                            onChange={(e) => {
                              const v = e.target.value;
                              set((x) => {
                                if (x.type === "story") x.quote = v;
                              });
                            }}
                          />
                          <TextField
                            id="s-story-author"
                            label={t("quoteAuthor")}
                            maxLength={60}
                            value={s.quoteAuthor}
                            error={err(k("quoteAuthor"))}
                            onChange={(e) => {
                              const v = e.target.value;
                              set((x) => {
                                if (x.type === "story") x.quoteAuthor = v;
                              });
                            }}
                          />
                        </>
                      ) : null}
                      {s.type === "specialties" ? (
                        <>
                          <TextAreaField
                            id="s-spec-text"
                            label={t("introOptional")}
                            rows={2}
                            maxLength={300}
                            value={s.text}
                            error={err(k("text"))}
                            onChange={(e) => {
                              const v = e.target.value;
                              set((x) => {
                                if (x.type === "specialties") x.text = v;
                              });
                            }}
                          />
                          <div className="rounded-lg bg-surface-container-low p-md text-body-sm">
                            {featured.length ? (
                              <>
                                <p className="font-semibold text-on-surface">
                                  {t("shown", { items: featured.map((f) => f.name).join(", ") })}
                                </p>
                                <p className="mt-xs text-on-surface-variant">
                                  {t.rich("featuredNote", { b: (c) => <strong>{c}</strong> })}
                                </p>
                              </>
                            ) : (
                              <p className="text-on-surface-variant">
                                {t.rich("noFeatured", { b: (c) => <strong>{c}</strong> })}
                              </p>
                            )}
                            <a
                              href={menuHref}
                              className="mt-xs inline-flex items-center gap-xs font-semibold text-primary hover:underline"
                            >
                              <Icon name="restaurant_menu" className="text-icon-md" />{" "}
                              {t("openMenu")}
                            </a>
                          </div>
                        </>
                      ) : null}
                      {s.type === "gallery" ? (
                        <GalleryField
                          cafeId={cafeId}
                          max={LIMITS.galleryImages}
                          value={s.images}
                          error={err(k("images"))}
                          onChange={(imgs) =>
                            set((x) => {
                              if (x.type === "gallery") x.images = imgs;
                            })
                          }
                        />
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-body-sm text-on-surface-variant">{t("hiddenSection")}</p>
                  )}
                </Card>
              );
            })}

            {/* Opening hours now live in Settings */}
            <Card icon="schedule" title={t("hoursTitle")} hint={t("hoursMoved")}>
              <Link
                href={hoursHref}
                className="inline-flex w-fit items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container"
              >
                <Icon name="settings" className="text-icon-md" />
                {t("hoursMovedLink")}
                <Icon name="arrow_forward" className="text-icon-md" flipRtl />
              </Link>
            </Card>
          </div>
        </div>

        {/* Preview */}
        <aside className="xl:col-span-2">
          <div className="xl:sticky xl:top-20">
            <p className="mb-sm flex items-center gap-xs text-body-sm font-semibold text-on-surface-variant">
              <Icon name="smartphone" className="text-icon-md" />{" "}
              {t("preview", {
                language: lang !== languages.main ? ` · ${languageLabel(lang)}` : "",
              })}
            </p>
            <WebsitePreview
              website={translateWebsite(doc, lang === languages.main ? null : lang)}
              palette={palette}
              cafeName={cafeName}
              contact={contact}
              featured={featured}
              labels={{
                headline: t("previewHeadline"),
                viewMenu: t("previewViewMenu"),
                steps: t("previewSteps").split("|"),
                days,
                closed: t("closed"),
                hours: t("hoursTitle"),
              }}
            />
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title={t("discardTitle")}
        tone="danger"
        confirmLabel={t("discardConfirm")}
        cancelLabel={tc("cancel")}
        pending={pending}
        onConfirm={discard}
        onClose={() => setConfirmDiscard(false)}
      >
        {t("discardBody")}
      </ConfirmDialog>
    </div>
  );
}

function Card({
  icon,
  title,
  hint,
  actions,
  muted,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  actions?: ReactNode;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl bg-surface-container-lowest p-lg shadow-sm ${muted ? "opacity-80" : ""}`}
    >
      <div className="mb-md flex items-start justify-between gap-sm">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-sm text-headline-md text-on-surface">
            <Icon name={icon} className="text-icon-xl text-primary" />
            {title}
          </h2>
          {hint ? <p className="mt-xs text-body-sm text-on-surface-variant">{hint}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-xs">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container disabled:opacity-40"
    >
      <Icon name={icon} className="text-icon-lg" />
    </button>
  );
}

function AddButton({
  label,
  onClick,
  icon = "add",
}: {
  label: string;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
    >
      <Icon name={icon} className="text-icon-md" /> {label}
    </button>
  );
}

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative ms-xs inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-surface-container-highest"}`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1"}`}
      />
    </button>
  );
}
