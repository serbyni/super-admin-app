import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { HtmlLang } from "@/components/ui/html-lang";
import { PLATFORM_TIME_ZONE } from "@/config/locale";
import { isRtl } from "./config";
import { applyOwnerLocale } from "./owner-locale";

/**
 * Owner-side wrapper: owner's language for client components, <html lang/dir>, and a
 * lang/dir container so the layout is right-to-left in Arabic from the first paint.
 */
export async function OwnerIntl({ children }: { children: ReactNode }) {
  const locale = await applyOwnerLocale();
  const dir = isRtl(locale) ? "rtl" : "ltr";
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={await getMessages()}
      timeZone={PLATFORM_TIME_ZONE}
    >
      <HtmlLang lang={locale} dir={dir} />
      <div lang={locale} dir={dir} className="flex min-h-full flex-1 flex-col">
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
