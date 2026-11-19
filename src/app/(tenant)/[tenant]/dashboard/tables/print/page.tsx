import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { requireTenantOwner } from "@/lib/auth/guards";
import { tenantDashboard } from "@/lib/auth/routes";
import { cafePalette } from "@/lib/cafes/theme";
import { serverApi } from "@/lib/data/server-api";
import { siteUrl } from "@/lib/env";
import { qrCardSvg } from "@/lib/qr/card";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Print QR codes" };

/**
 * A4 sheet of QR cards (4 per page) printed from the browser: the café menu card first, then
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
  const { area, menu } = await searchParams;
  await requireTenantOwner(tenant);
  const api = serverApi();
  const cafe = await api.cafes.mine(tenant);
  if (!cafe) notFound();
  const floor = await api.tables.floor(tenant);
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
            svg: qrCardSvg({
              url: url(floor.menu.code),
              cafeName: cafe.name,
              title: "Menu",
              subtitle: "Scan to see our menu",
              code: floor.menu.code,
              colors,
            }),
          },
        ]),
    ...tables.map((t) => ({
      key: t.id,
      svg: qrCardSvg({
        url: url(t.code!),
        cafeName: cafe.name,
        title: `Table ${t.label}`,
        subtitle: "Scan to order",
        code: t.code!,
        colors,
      }),
    })),
  ];
  const back = `${tenantDashboard(cafe.slug).replace(/\/$/, "")}/tables`;
  const filterLink = (q: Record<string, string>) => `?${new URLSearchParams(q).toString()}`;

  return (
    <div className="min-h-screen bg-background print:bg-surface-container-lowest">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-sm border-b border-surface-container-high bg-surface-container-lowest px-gutter py-sm print:hidden">
        <Link
          href={back}
          className="inline-flex items-center gap-xs text-body-sm font-semibold text-primary"
        >
          <Icon name="arrow_back" className="text-icon-md" flipRtl /> Tables & QR
        </Link>
        <nav aria-label="Which cards" className="flex flex-wrap gap-xs text-body-sm">
          <Link
            href={filterLink({})}
            className={`rounded-full px-md py-xs ${!areaFilter ? "bg-primary text-on-primary" : "bg-surface-container"}`}
          >
            All areas
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
        <PrintButton count={cards.length} />
      </div>
      <p className="px-gutter pt-sm text-caption text-on-surface-variant print:hidden">
        A4, 4 cards per page. Switched-off tables are not printed. Cut along the card edges.
      </p>
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-lg p-lg print:max-w-none print:gap-md print:p-0">
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
