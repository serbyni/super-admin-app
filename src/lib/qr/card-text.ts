import "server-only";
import { getTranslations } from "next-intl/server";
import { isUiLocale } from "@/i18n/config";

/** Texts printed on QR cards — in the café's menu language (customers read them), not the owner's. */
export type QrCardText = {
  menu: string;
  menuSubtitle: string;
  /** "Table {label}" */
  table: string;
  tableSubtitle: string;
  poweredBy: string;
};

export async function qrCardText(cafeLocale: string): Promise<QrCardText> {
  const t = await getTranslations({
    locale: isUiLocale(cafeLocale) ? cafeLocale : "en",
    namespace: "qrCard",
  });
  return {
    menu: t("menu"),
    menuSubtitle: t("menuSubtitle"),
    table: t.raw("table") as string,
    tableSubtitle: t("tableSubtitle"),
    poweredBy: t("poweredBy"),
  };
}

/** "Table {label}" → "Table T7". */
export const tableTitle = (text: QrCardText, label: string) => text.table.replace("{label}", label);
