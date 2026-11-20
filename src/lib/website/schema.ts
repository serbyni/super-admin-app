import { z } from "zod";
import { MEDIA_PATH } from "@/lib/media/config";

/*
 * Café website document (draft + published, table cafe_websites). Full validation lives here;
 * the database re-checks structure, size and image ownership (platform.check_website).
 * cafe-app keeps a copy of this file to render the published document — keep them in sync.
 */

export const WEBSITE_VERSION = 1;

/** Icons offered for hero highlights (Material Symbols names). */
export const HIGHLIGHT_ICONS = [
  { value: "qr_code_scanner", label: "QR ordering" },
  { value: "local_cafe", label: "Coffee" },
  { value: "bakery_dining", label: "Bakery" },
  { value: "eco", label: "Organic / eco" },
  { value: "handshake", label: "Direct trade" },
  { value: "wifi", label: "Wi-Fi" },
  { value: "deck", label: "Terrace" },
  { value: "pets", label: "Pet friendly" },
  { value: "star", label: "Rating" },
  { value: "schedule", label: "Open late" },
] as const;
const ICON_VALUES = HIGHLIGHT_ICONS.map((i) => i.value) as [string, ...string[]];

export const SECTION_TYPES = ["how_it_works", "story", "gallery", "specialties"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/** Monday first. */
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const LIMITS = { highlights: 4, points: 3, galleryImages: 8 } as const;

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
const required = (min: number, max: number, what: string) =>
  z.string().trim().min(min, `Enter ${what}`).max(max, `At most ${max} characters`);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const imageSchema = z.object({
  path: z.string().regex(MEDIA_PATH, "Upload the photo again"),
  alt: text(150),
});

const heroSchema = z.object({
  badge: text(40),
  title: required(2, 80, "a headline"),
  subtitle: text(240),
  image: imageSchema.nullable(),
  highlights: z
    .array(z.object({ icon: z.enum(ICON_VALUES), label: required(1, 30, "a label") }))
    .max(LIMITS.highlights),
});

const howItWorksSchema = z.object({
  type: z.literal("how_it_works"),
  enabled: z.boolean(),
  title: required(2, 80, "a title"),
  text: text(300),
});

const storySchema = z.object({
  type: z.literal("story"),
  enabled: z.boolean(),
  title: required(2, 80, "a title"),
  text: text(1200),
  image: imageSchema.nullable(),
  points: z
    .array(z.object({ title: required(1, 50, "a title"), text: text(140) }))
    .max(LIMITS.points),
  quote: text(280),
  quoteAuthor: text(60),
});

const gallerySchema = z.object({
  type: z.literal("gallery"),
  enabled: z.boolean(),
  title: required(2, 80, "a title"),
  images: z.array(imageSchema).max(LIMITS.galleryImages),
});

/** Signature specialties: the café's FEATURED menu items (read live from the menu, up to 4). */
const specialtiesSchema = z.object({
  type: z.literal("specialties"),
  enabled: z.boolean(),
  title: required(2, 80, "a title"),
  text: text(300),
});

export const SPECIALTIES_MAX = 4;

const sectionSchema = z.discriminatedUnion("type", [
  howItWorksSchema,
  storySchema,
  gallerySchema,
  specialtiesSchema,
]);

const daySchema = z
  .object({ closed: z.boolean(), open: time, close: time })
  .refine((d) => d.closed || d.open !== d.close, {
    path: ["close"],
    message: "Closing time must differ from opening time",
  });

export const websiteSchema = z
  .object({
    version: z.literal(WEBSITE_VERSION),
    hero: heroSchema,
    sections: z.array(sectionSchema).max(SECTION_TYPES.length),
    footer: z.object({ hours: z.array(daySchema).length(7) }),
    /** Translations: { "en": { "hero.title": "…", "sections.story.text": "…" } } (see translatableFields). */
    i18n: z
      .record(
        z.string().regex(/^[a-z]{2}$/),
        z.record(z.string().max(80), z.string().trim().max(1200)),
      )
      .optional(),
  })
  .superRefine((w, ctx) => {
    const seen = new Set<string>();
    w.sections.forEach((s, i) => {
      if (seen.has(s.type))
        ctx.addIssue({ code: "custom", path: ["sections", i], message: "Duplicate section" });
      seen.add(s.type);
      // A section that is shown must have content.
      if (!s.enabled) return;
      if (s.type === "story" && s.text.length < 10)
        ctx.addIssue({
          code: "custom",
          path: ["sections", i, "text"],
          message: "Tell your story (10+ characters) or hide this section",
        });
      if (s.type === "gallery" && s.images.length === 0)
        ctx.addIssue({
          code: "custom",
          path: ["sections", i, "images"],
          message: "Add at least one photo or hide this section",
        });
    });
  });

export type Website = z.infer<typeof websiteSchema>;
export type WebsiteSection = Website["sections"][number];
export type WebsiteImage = z.infer<typeof imageSchema>;
export type OpeningDay = Website["footer"]["hours"][number];

/** Zod issues → { "hero.title": "…", "sections.1.text": "…" } (first message per field). */
export function websiteErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[i.path.join(".") || "website"] ??= i.message;
  return out;
}

/** Starting point for a café that never edited its website. */
/** Starting texts of a new website, in the café's menu language (EN fallback). */
const DEFAULT_TEXTS = {
  en: {
    title: (name: string) => `Welcome to ${name}`,
    subtitle: "Browse our menu and order right from your table — no app needed.",
    highlight: "Order from your table",
    howTitle: "Order from your table",
    howText:
      "Scan the QR code on your table, choose from the menu and send your order. Pay at the counter.",
    story: "Our story",
    gallery: "Gallery",
    specialties: "Signature specialties",
    specialtiesText: "Our favourites, prepared fresh every day.",
  },
  fr: {
    title: (name: string) => `Bienvenue chez ${name}`,
    subtitle: "Parcourez notre menu et commandez depuis votre table — sans application.",
    highlight: "Commandez depuis votre table",
    howTitle: "Commandez depuis votre table",
    howText:
      "Scannez le QR code de votre table, choisissez dans le menu et envoyez votre commande. Réglez au comptoir.",
    story: "Notre histoire",
    gallery: "Galerie",
    specialties: "Nos spécialités",
    specialtiesText: "Nos coups de cœur, préparés chaque jour.",
  },
  ar: {
    title: (name: string) => `مرحبًا بكم في ${name}`,
    subtitle: "تصفّح قائمتنا واطلب من طاولتك مباشرة — دون الحاجة إلى تطبيق.",
    highlight: "اطلب من طاولتك",
    howTitle: "اطلب من طاولتك",
    howText: "امسح رمز QR الموجود على طاولتك، واختر من القائمة وأرسل طلبك. الدفع عند الصندوق.",
    story: "قصتنا",
    gallery: "معرض الصور",
    specialties: "أطباقنا المميزة",
    specialtiesText: "أطباقنا المفضلة، تُحضَّر طازجة كل يوم.",
  },
} as const;

/** Starting point for a café that never edited its website (texts in its menu language). */
export function defaultWebsite(cafe: { name: string; locale?: string }): Website {
  const t = DEFAULT_TEXTS[(cafe.locale ?? "en") as keyof typeof DEFAULT_TEXTS] ?? DEFAULT_TEXTS.en;
  return {
    version: WEBSITE_VERSION,
    hero: {
      badge: "",
      title: t.title(cafe.name).slice(0, 80),
      subtitle: t.subtitle,
      image: null,
      highlights: [{ icon: "qr_code_scanner", label: t.highlight }],
    },
    sections: [
      { type: "how_it_works", enabled: true, title: t.howTitle, text: t.howText },
      {
        type: "story",
        enabled: false,
        title: t.story,
        text: "",
        image: null,
        points: [],
        quote: "",
        quoteAuthor: "",
      },
      { type: "gallery", enabled: false, title: t.gallery, images: [] },
      { type: "specialties", enabled: false, title: t.specialties, text: t.specialtiesText },
    ],
    footer: {
      hours: WEEKDAYS.map((_, i) => ({
        closed: false,
        open: i < 5 ? "08:00" : "09:00",
        close: "20:00",
      })),
    },
  };
}

/** Stored JSON → Website; anything unreadable falls back to null (caller shows defaults). */
/**
 * Adds sections that did not exist when the website was saved (new section types), switched off,
 * at the end — so the editor always lists every section.
 */
export function withAllSections(w: Website): Website {
  const have = new Set(w.sections.map((s) => s.type));
  const missing = defaultWebsite({ name: "" }).sections.filter((s) => !have.has(s.type));
  return missing.length ? { ...w, sections: [...w.sections, ...missing] } : w;
}

export function parseWebsite(raw: unknown): Website | null {
  const r = websiteSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Consecutive days with the same hours, e.g. [{ days: "Monday – Friday", hours: "08:00 – 20:00" }].
 * `labels` translates the day names and "Closed" (default English).
 */
export function groupHours(
  hours: OpeningDay[],
  labels: { days: readonly string[]; closed: string } = { days: WEEKDAYS, closed: "Closed" },
): { days: string; hours: string }[] {
  const label = (d: OpeningDay) => (d.closed ? labels.closed : `${d.open} – ${d.close}`);
  const out: { from: number; to: number; hours: string }[] = [];
  hours.forEach((d, i) => {
    const last = out.at(-1);
    if (last && last.hours === label(d)) last.to = i;
    else out.push({ from: i, to: i, hours: label(d) });
  });
  return out.map((g) => ({
    days: g.from === g.to ? labels.days[g.from] : `${labels.days[g.from]} – ${labels.days[g.to]}`,
    hours: g.hours,
  }));
}

/* ── Translations ─────────────────────────────────────────────────────────── */

export type TranslatableField = {
  /** Stable key, independent of the section order: "hero.title", "sections.story.points.1.text". */
  key: string;
  label: string;
  value: string;
  max: number;
  multiline?: boolean;
};

/** Every visitor-facing text of the website (non-empty), in page order. */
export function translatableFields(w: Website): TranslatableField[] {
  const out: TranslatableField[] = [];
  const add = (key: string, label: string, value: string, max: number, multiline = false) => {
    if (value.trim()) out.push({ key, label, value, max, multiline });
  };
  add("hero.badge", "Badge", w.hero.badge, 40);
  add("hero.title", "Headline", w.hero.title, 80);
  add("hero.subtitle", "Introduction", w.hero.subtitle, 240, true);
  w.hero.highlights.forEach((h, i) =>
    add(`hero.highlights.${i}.label`, `Highlight ${i + 1}`, h.label, 30),
  );
  for (const s of w.sections) {
    const k = `sections.${s.type}`;
    switch (s.type) {
      case "how_it_works":
        add(`${k}.title`, "How ordering works · title", s.title, 80);
        add(`${k}.text`, "How ordering works · introduction", s.text, 300, true);
        break;
      case "story":
        add(`${k}.title`, "Our story · title", s.title, 80);
        add(`${k}.text`, "Our story · text", s.text, 1200, true);
        s.points.forEach((pt, i) => {
          add(`${k}.points.${i}.title`, `Our story · highlight ${i + 1}`, pt.title, 50);
          add(`${k}.points.${i}.text`, `Our story · highlight ${i + 1} detail`, pt.text, 140);
        });
        add(`${k}.quote`, "Our story · quote", s.quote, 280, true);
        add(`${k}.quoteAuthor`, "Our story · quote author", s.quoteAuthor, 60);
        break;
      case "gallery":
        add(`${k}.title`, "Gallery · title", s.title, 80);
        break;
      case "specialties":
        add(`${k}.title`, "Signature specialties · title", s.title, 80);
        add(`${k}.text`, "Signature specialties · introduction", s.text, 300, true);
        break;
    }
  }
  return out;
}

/** The website in a language: translated texts where available, the main texts elsewhere. */
export function translateWebsite(w: Website, lang: string | null | undefined): Website {
  const tr = lang ? w.i18n?.[lang] : undefined;
  if (!tr || !Object.keys(tr).length) return w;
  const t = (key: string, fallback: string) => (tr[key]?.trim() ? tr[key] : fallback);
  return {
    ...w,
    hero: {
      ...w.hero,
      badge: t("hero.badge", w.hero.badge),
      title: t("hero.title", w.hero.title),
      subtitle: t("hero.subtitle", w.hero.subtitle),
      highlights: w.hero.highlights.map((h, i) => ({
        ...h,
        label: t(`hero.highlights.${i}.label`, h.label),
      })),
    },
    sections: w.sections.map((s) => {
      const k = `sections.${s.type}`;
      switch (s.type) {
        case "how_it_works":
        case "specialties":
          return { ...s, title: t(`${k}.title`, s.title), text: t(`${k}.text`, s.text) };
        case "gallery":
          return { ...s, title: t(`${k}.title`, s.title) };
        case "story":
          return {
            ...s,
            title: t(`${k}.title`, s.title),
            text: t(`${k}.text`, s.text),
            points: s.points.map((pt, i) => ({
              title: t(`${k}.points.${i}.title`, pt.title),
              text: t(`${k}.points.${i}.text`, pt.text),
            })),
            quote: t(`${k}.quote`, s.quote),
            quoteAuthor: t(`${k}.quoteAuthor`, s.quoteAuthor),
          };
      }
    }),
  };
}
