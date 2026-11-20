import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { applyOwnerLocale } from "@/i18n/owner-locale";
import { qrCardText, tableTitle } from "@/lib/qr/card-text";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";
import { siteUrl } from "@/lib/env";
import { qrCardSvg, qrStickerSvg } from "@/lib/qr/card";
import { PrintButton } from "./print-button";

export async function generateMetadata(): Promise<Metadata> {
  await applyOwnerLocale();
  return { title: (await getTranslations("tables.printPage"))("metaTitle") };
}

/**
 * A4 sheet printed from the browser — large cards (4 per page) or small table stickers
 * (?size=small, 20 per page): the café menu card first, then
 * every active table of the chosen area (or of all areas). The SVGs are generated here from our
 * own data with all café text escaped (qrCardSvg).
 */
async function PrintSheet({
  params,
  searchParams,
}: {
  params: PageProps<"/[tenant]/dashboard/tables/print">["params"];
  searchParams: PageProps<"/[tenant]/dashboard/tables/print">["searchParams"];
}) {
  const { tenant } = await params;
  const { area, menu, size } = await searchParams;
  const small = size === "small";
  await requireTenantOwner(tenant);
  await applyOwnerLocale();
  const t = await getTranslations("tables.printPage");
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const [floor, text] = await Promise.all([api.tables.floor(tenant), qrCardText(cafe.locale)]);
  const p = cafePalette(cafe.seed);
  const colors = {
    primary: p.primary,
    onPrimary: p.onPrimary,
    container: p.container,
    onContainer: p.onContainer,
  };
  const url = (code: string) => siteUrl(`/q/${code}`);

  const areaFilter =
    typeof area === "string" && floor.areas.some((a) => a.id === area) ? area : null;
  const areaName = (id: string) => floor.areas.find((a) => a.id === id)?.name ?? "";
  const tables = floor.tables
    .filter((t) => t.isActive && t.code && (!areaFilter || t.areaId === areaFilter))
    .sort(
      (a, b) =>
        areaName(a.areaId).localeCompare(areaName(b.areaId)) ||
        a.label.localeCompare(b.label, undefined, { numeric: true }),
    );

  const cards = [
    ...(menu === "0"
      ? []
      : [
          {
            key: "menu",
            svg: small
              ? qrStickerSvg({
                  url: url(floor.menu.code),
                  label: text.menu,
                  code: floor.menu.code,
                  colors,
                })
              : qrCardSvg({
                  url: url(floor.menu.code),
                  cafeName: cafe.name,
                  title: text.menu,
                  subtitle: text.menuSubtitle,
                  footer: text.poweredBy,
                  code: floor.menu.code,
                  colors,
                }),
          },
        ]),
    ...tables.map((t) => ({
      key: t.id,
      svg: small
        ? qrStickerSvg({ url: url(t.code!), label: t.label, code: t.code!, colors })
        : qrCardSvg({
            url: url(t.code!),
            cafeName: cafe.name,
            title: tableTitle(text, t.label),
            subtitle: text.tableSubtitle,
            footer: text.poweredBy,
            code: t.code!,
            colors,
          }),
    })),
  ];
  const back = `${tenantDashboard(cafe.slug).replace(/\/$/, "")}/tables`;
  const filterLink = (q: Record<string, string>) =>
    `?${new URLSearchParams({ ...q, ...(small ? { size: "small" } : {}) }).toString()}`;
  const sizeLink = (smallOn: boolean) =>
    `?${new URLSearchParams({
      ...(areaFilter ? { area: areaFilter, menu: "0" } : {}),
      ...(smallOn ? { size: "small" } : {}),
    }).toString()}`;

  return (
    <div className="min-h-screen bg-background print:bg-surface-container-lowest">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-sm border-b border-surface-container-high bg-surface-container-lowest px-gutter py-sm print:hidden">
        <Link
          href={back}
          className="inline-flex items-center gap-xs text-body-sm font-semibold text-primary"
        >
          <Icon name="arrow_back" className="text-icon-md" flipRtl /> {t("back")}
        </Link>
        <nav aria-label={t("which")} className="flex flex-wrap gap-xs text-body-sm">
          <Link
            href={filterLink({})}
            className={`rounded-full px-md py-xs ${!areaFilter ? "bg-primary text-on-primary" : "bg-surface-container"}`}
          >
            {t("allAreas")}
          </Link>
          {floor.areas.map((a) => (
            <Link
              key={a.id}
              href={filterLink({ area: a.id, menu: "0" })}
              className={`rounded-full px-md py-xs ${areaFilter === a.id ? "bg-primary text-on-primary" : "bg-surface-container"}`}
            >
              {a.name}
            </Link>
          ))}
        </nav>
        <nav
          aria-label={t("size")}
          className="flex rounded-xl bg-surface-container p-xs text-body-sm"
        >
          <Link
            href={sizeLink(false)}
            aria-current={!small ? "page" : undefined}
            className={`rounded-lg px-md py-xs font-semibold ${!small ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
          >
            {t("cards")}
          </Link>
          <Link
            href={sizeLink(true)}
            aria-current={small ? "page" : undefined}
            className={`rounded-lg px-md py-xs font-semibold ${small ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant"}`}
          >
            {t("stickers")}
          </Link>
        </nav>
        <PrintButton
          label={
            small
              ? t("printStickers", { count: cards.length })
              : t("printCards", { count: cards.length })
          }
          disabled={cards.length === 0}
        />
      </div>
      <p className="px-gutter pt-sm text-caption text-on-surface-variant print:hidden">
        {small ? t("smallNote") : t("cardsNote")} {t("note")}
      </p>
      <div
        className={`mx-auto grid max-w-4xl p-lg print:max-w-none print:p-0 ${small ? "grid-cols-4 gap-md print:gap-sm" : "grid-cols-2 gap-lg print:gap-md"}`}
      >
        {cards.map((c) => (
          <div
            key={c.key}
            className="break-inside-avoid"
            // Our own SVG markup (qrCardSvg escapes every café-provided text).
            dangerouslySetInnerHTML={{
              __html: c.svg.replace("<svg ", '<svg style="width:100%;height:auto" '),
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function PrintPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/dashboard/tables/print">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <PrintSheet params={params} searchParams={searchParams} />
    </Suspense>
  );
}
