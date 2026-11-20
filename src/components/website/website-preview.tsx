import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/icon";
import type { CafePalette } from "@/lib/cafes/theme";
import { mediaUrl } from "@/lib/media/config";
import { WEEKDAYS, groupHours, type Website, type WebsiteImage } from "@/lib/website/schema";

/*
 * Phone-sized preview of the café website in the café's colours. A close sketch of what cafe-app
 * renders (cafe-app has the real page); colours come from the palette as inline styles because
 * they are per-café runtime values, not design tokens.
 */

function Photo({ image, className }: { image: WebsiteImage; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- user photo from Supabase Storage
    <img src={mediaUrl(image.path)} alt={image.alt} className={`object-cover ${className}`} />
  );
}

/** A featured menu item as the website shows it (price already formatted). */
export type FeaturedItem = { id: string; name: string; price: string; image: WebsiteImage | null };

export type PreviewLabels = {
  headline: string;
  viewMenu: string;
  /** The 3 "How ordering works" steps. */
  steps: string[];
  /** Monday first. */
  days: string[];
  closed: string;
  hours?: string;
};
const PREVIEW_EN: PreviewLabels = {
  headline: "Your headline",
  viewMenu: "View menu",
  steps: ["Scan the table QR code", "Choose from the menu", "We bring your order"],
  days: [...WEEKDAYS],
  closed: "Closed",
};

export function WebsitePreview({
  website,
  palette,
  cafeName,
  contact,
  featured = [],
  labels = PREVIEW_EN,
}: {
  website: Website;
  palette: CafePalette;
  cafeName: string;
  contact: { address: string | null; phone: string | null };
  featured?: FeaturedItem[];
  /** Fixed texts of the page (the editor passes them in the owner's language). */
  labels?: PreviewLabels;
}) {
  const primary: CSSProperties = { color: palette.primary };
  const soft: CSSProperties = { backgroundColor: palette.container, color: palette.onContainer };
  const { hero } = website;
  return (
    <div
      className="mx-auto w-full max-w-card-sm overflow-hidden rounded-2xl border border-surface-container-high shadow-card-warm"
      style={{ backgroundColor: palette.surface, color: palette.onSurface }}
    >
      <div className="flex items-center gap-xs px-md py-sm text-body-md font-bold" style={primary}>
        <Icon name="local_cafe" className="text-icon-lg" />
        <span className="truncate">{cafeName}</span>
      </div>

      <section className="flex flex-col gap-sm px-md pb-lg">
        {hero.badge ? (
          <span
            className="w-fit rounded-full px-sm py-xs text-caption font-semibold uppercase"
            style={soft}
          >
            {hero.badge}
          </span>
        ) : null}
        <h1 className="text-headline-md font-bold" style={primary}>
          {hero.title || labels.headline}
        </h1>
        {hero.subtitle ? <p className="text-body-sm opacity-80">{hero.subtitle}</p> : null}
        <span
          className="flex w-full items-center justify-center gap-xs rounded-full py-sm text-body-sm font-semibold"
          style={{ backgroundColor: palette.primary, color: palette.onPrimary }}
        >
          <Icon name="menu_book" className="text-icon-md" /> {labels.viewMenu}
        </span>
        {hero.highlights.length ? (
          <div className="flex flex-wrap gap-xs">
            {hero.highlights.map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-xs rounded-full px-sm py-xs text-caption"
                style={{ backgroundColor: palette.variant, color: palette.onVariant }}
              >
                <span style={primary} className="flex">
                  <Icon name={h.icon} className="text-icon-sm" />
                </span>
                {h.label || "…"}
              </span>
            ))}
          </div>
        ) : null}
        {hero.image ? (
          <Photo image={hero.image} className="aspect-video w-full rounded-xl" />
        ) : null}
      </section>

      {website.sections
        // Specialties without featured items are not shown (same rule as the café site).
        .filter((s) => s.enabled && (s.type !== "specialties" || featured.length > 0))
        .map((s) => (
          <section
            key={s.type}
            className="flex flex-col gap-sm border-t border-surface-container-high px-md py-lg"
          >
            <h2 className="text-body-lg font-bold" style={primary}>
              {s.title}
            </h2>
            {s.type === "how_it_works" ? (
              <>
                {s.text ? <p className="text-body-sm opacity-80">{s.text}</p> : null}
                <ol className="flex flex-col gap-xs">
                  {[
                    ["qr_code_scanner", labels.steps[0]],
                    ["restaurant_menu", labels.steps[1]],
                    ["notifications_active", labels.steps[2]],
                  ].map(([icon, label]) => (
                    <li
                      key={icon}
                      className="flex items-center gap-sm rounded-lg px-sm py-xs text-body-sm"
                      style={soft}
                    >
                      <Icon name={icon} className="text-icon-md" /> {label}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
            {s.type === "story" ? (
              <>
                {s.image ? (
                  <Photo image={s.image} className="aspect-video w-full rounded-xl" />
                ) : null}
                {s.text ? (
                  <p className="text-body-sm whitespace-pre-line opacity-80">{s.text}</p>
                ) : null}
                {s.points.map((p, i) => (
                  <div key={i} className="rounded-lg px-sm py-xs" style={soft}>
                    <p className="text-body-sm font-semibold">{p.title}</p>
                    {p.text ? <p className="text-caption">{p.text}</p> : null}
                  </div>
                ))}
                {s.quote ? (
                  <blockquote
                    className="border-s-4 ps-sm text-body-sm italic"
                    style={{ borderColor: palette.primary }}
                  >
                    “{s.quote}”
                    {s.quoteAuthor ? (
                      <span className="mt-xs block font-semibold not-italic">{s.quoteAuthor}</span>
                    ) : null}
                  </blockquote>
                ) : null}
              </>
            ) : null}
            {s.type === "specialties" ? (
              <>
                {s.text ? <p className="text-body-sm opacity-80">{s.text}</p> : null}
                <div className="flex flex-col gap-xs">
                  {featured.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-sm rounded-lg bg-surface-container-lowest p-xs shadow-sm"
                    >
                      {f.image ? (
                        <Photo image={f.image} className="h-12 w-12 shrink-0 rounded-md" />
                      ) : (
                        <span className="h-12 w-12 shrink-0 rounded-md" style={soft} />
                      )}
                      <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">
                        {f.name}
                      </span>
                      <span className="shrink-0 text-body-sm font-bold" style={primary}>
                        {f.price}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {s.type === "gallery" ? (
              <div className="grid grid-cols-2 gap-xs">
                {s.images.map((img) => (
                  <Photo key={img.path} image={img} className="aspect-square w-full rounded-lg" />
                ))}
              </div>
            ) : null}
          </section>
        ))}

      <footer
        className="flex flex-col gap-xs px-md py-lg text-body-sm"
        style={{ backgroundColor: palette.variant, color: palette.onVariant }}
      >
        <p className="flex items-center gap-xs font-semibold uppercase" style={primary}>
          <Icon name="schedule" className="text-icon-md" /> {labels.hours ?? "Opening hours"}
        </p>
        {groupHours(website.footer.hours, { days: labels.days, closed: labels.closed }).map((g) => (
          <p key={g.days} className="flex justify-between gap-sm">
            <span>{g.days}</span>
            <span>{g.hours}</span>
          </p>
        ))}
        {contact.address ? <p className="pt-xs">{contact.address}</p> : null}
        {contact.phone ? <p>{contact.phone}</p> : null}
      </footer>
    </div>
  );
}
