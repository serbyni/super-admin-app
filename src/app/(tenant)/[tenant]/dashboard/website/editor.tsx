"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { TextAreaField, TextField } from "@/components/auth/fields";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { GalleryField, ImageField } from "@/components/website/image-fields";
import { WebsitePreview } from "@/components/website/website-preview";
import type { CafePalette } from "@/lib/cafes/theme";
import {
  HIGHLIGHT_ICONS,
  LIMITS,
  WEEKDAYS,
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

const SECTION_META: Record<WebsiteSection["type"], { label: string; icon: string; hint: string }> =
  {
    how_it_works: {
      label: "How ordering works",
      icon: "qr_code_2",
      hint: "Explains QR ordering in 3 steps. The steps are standard; you choose the title and intro.",
    },
    story: {
      label: "Our story",
      icon: "auto_stories",
      hint: "Who you are, a photo, up to 3 highlights and a quote.",
    },
    gallery: {
      label: "Gallery",
      icon: "photo_library",
      hint: `Up to ${LIMITS.galleryImages} photos of your place and products.`,
    },
  };

type Props = {
  slug: string;
  cafeId: string;
  cafeName: string;
  palette: CafePalette;
  contact: { address: string | null; phone: string | null };
  initial: Website;
  /** Website as customers see it now (null = never published). */
  published: Website | null;
  publishedAt: string | null;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

export function WebsiteEditor({
  slug,
  cafeId,
  cafeName,
  palette,
  contact,
  initial,
  published,
  publishedAt,
}: Props) {
  const toast = useToast();
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

  const run = (kind: "save" | "publish") => {
    const check = websiteSchema.safeParse(doc);
    if (!check.success) {
      setErrors(websiteErrors(check.error));
      toast.show({ variant: "error", title: "Some fields need your attention." });
      return;
    }
    start(async () => {
      const r: WebsiteResult =
        kind === "save"
          ? await saveWebsiteAction(slug, doc)
          : await publishWebsiteAction(slug, doc);
      if (!r.ok) {
        setErrors(r.errors ?? {});
        toast.show({ variant: "error", title: r.message });
        return;
      }
      setErrors({});
      setSaved(doc);
      if (kind === "publish") {
        setLive({ doc, at: r.publishedAt ?? null });
        toast.show({
          variant: "success",
          title: "Website published",
          description: "Customers see the new version within a few minutes.",
        });
      } else {
        toast.show({ variant: "success", title: "Draft saved" });
      }
    });
  };

  const discard = () =>
    start(async () => {
      const r = await discardWebsiteAction(slug);
      setConfirmDiscard(false);
      if (!r.ok) {
        toast.show({ variant: "error", title: r.message });
        return;
      }
      const next = r.draft ?? live.doc ?? initial;
      setDoc(next);
      setSaved(next);
      setErrors({});
      toast.show({ variant: "success", title: "Changes discarded" });
    });

  const status = useMemo(() => {
    if (!live.doc)
      return {
        tone: "bg-secondary-container text-on-secondary-container",
        text: "Not published yet — customers see a simple default page.",
      };
    if (unpublished)
      return {
        tone: "bg-warning-container text-on-warning-container",
        text: `Unpublished changes · live version from ${when(live.at)}`,
      };
    return {
      tone: "bg-success-container text-on-success-container",
      text: `Published ${when(live.at)}`,
    };
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
              Discard changes
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending || !unsaved}
            onClick={() => run("save")}
            className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-primary hover:bg-secondary-container disabled:opacity-60"
          >
            <Icon name="save" className="text-icon-md" /> {unsaved ? "Save draft" : "Draft saved"}
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
            Publish
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-lg xl:grid-cols-5">
        <div className="flex flex-col gap-lg xl:col-span-3">
          {/* Hero */}
          <Card
            icon="wallpaper"
            title="Top of the page"
            hint="The first thing customers see. Always shown."
          >
            <div className="flex flex-col gap-md">
              <TextField
                id="hero-title"
                label="Headline"
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
                label="Short introduction"
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
                label="Small badge above the headline (optional)"
                maxLength={40}
                placeholder="e.g. Specialty coffee since 2015"
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
                label="Cover photo"
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
                  Highlights (up to {LIMITS.highlights})
                </p>
                {doc.hero.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-sm">
                    <select
                      aria-label="Icon"
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
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex-1">
                      <TextField
                        id={`hero-hl-${i}`}
                        label="Label"
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
                      label="Remove highlight"
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
                    label="Add highlight"
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
            const meta = SECTION_META[s.type];
            const set = (fn: (x: WebsiteSection) => void) =>
              update((d) => {
                fn(d.sections[i]);
                return d;
              });
            const k = (f: string) => `sections.${i}.${f}`;
            return (
              <Card
                key={s.type}
                icon={meta.icon}
                title={meta.label}
                hint={meta.hint}
                muted={!s.enabled}
                actions={
                  <>
                    <IconButton
                      icon="arrow_upward"
                      label="Move up"
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
                      label="Move down"
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
                      label={`Show ${meta.label}`}
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
                      label="Title"
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
                        label="Introduction"
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
                          label="Your story"
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
                          label="Photo"
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
                            Highlights (up to {LIMITS.points})
                          </p>
                          {s.points.map((p, j) => (
                            <div key={j} className="flex items-start gap-sm">
                              <div className="grid flex-1 grid-cols-1 gap-sm sm:grid-cols-2">
                                <TextField
                                  id={`s-pt-${j}-t`}
                                  label="Title"
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
                                  label="Detail"
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
                                label="Remove highlight"
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
                              label="Add highlight"
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
                          label="Quote (optional)"
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
                          label="Quote author (optional)"
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
                  <p className="text-body-sm text-on-surface-variant">
                    Hidden from your website. Switch it on to edit and show it.
                  </p>
                )}
              </Card>
            );
          })}

          {/* Hours */}
          <Card
            icon="schedule"
            title="Opening hours"
            hint="Shown at the bottom of your website, with your address and phone from Settings."
          >
            <div className="flex flex-col gap-sm">
              {doc.footer.hours.map((d, i) => (
                <div key={i} className="grid grid-cols-2 items-center gap-sm sm:grid-cols-4">
                  <span className="text-body-sm font-semibold text-on-surface">{WEEKDAYS[i]}</span>
                  <label className="flex items-center gap-xs text-body-sm text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={!d.closed}
                      onChange={(e) => {
                        const open = e.target.checked;
                        update((x) => {
                          x.footer.hours[i].closed = !open;
                          return x;
                        });
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                    Open
                  </label>
                  {d.closed ? (
                    <span className="text-body-sm text-on-surface-variant sm:col-span-2">
                      Closed
                    </span>
                  ) : (
                    <div className="col-span-2 flex items-center gap-xs">
                      <input
                        type="time"
                        aria-label={`${WEEKDAYS[i]} opens`}
                        value={d.open}
                        onChange={(e) => {
                          const v = e.target.value;
                          update((x) => {
                            x.footer.hours[i].open = v;
                            return x;
                          });
                        }}
                        className="rounded-lg border border-outline-variant bg-transparent px-sm py-xs text-body-sm"
                      />
                      <span aria-hidden="true">–</span>
                      <input
                        type="time"
                        aria-label={`${WEEKDAYS[i]} closes`}
                        value={d.close}
                        onChange={(e) => {
                          const v = e.target.value;
                          update((x) => {
                            x.footer.hours[i].close = v;
                            return x;
                          });
                        }}
                        className="rounded-lg border border-outline-variant bg-transparent px-sm py-xs text-body-sm"
                      />
                    </div>
                  )}
                  {err(`footer.hours.${i}.close`) ? (
                    <p className="col-span-full text-body-xs text-error">
                      {err(`footer.hours.${i}.close`)}
                    </p>
                  ) : null}
                </div>
              ))}
              <div>
                <AddButton
                  icon="content_copy"
                  label="Copy Monday to every day"
                  onClick={() =>
                    update((x) => {
                      x.footer.hours = x.footer.hours.map(() => ({ ...x.footer.hours[0] }));
                      return x;
                    })
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Preview */}
        <aside className="xl:col-span-2">
          <div className="xl:sticky xl:top-20">
            <p className="mb-sm flex items-center gap-xs text-body-sm font-semibold text-on-surface-variant">
              <Icon name="smartphone" className="text-icon-md" /> Preview (draft)
            </p>
            <WebsitePreview website={doc} palette={palette} cafeName={cafeName} contact={contact} />
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        tone="danger"
        confirmLabel="Discard"
        pending={pending}
        onConfirm={discard}
        onClose={() => setConfirmDiscard(false)}
      >
        Your website goes back to the version customers see now. This can&apos;t be undone.
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
