import { getRequestConfig } from "next-intl/server";
import { PLATFORM_TIME_ZONE } from "@/config/locale";
import { DEFAULT_UI_LOCALE, isUiLocale } from "./config";

/**
 * next-intl request config. The language is not in the URL: owner pages compute it
 * (applyOwnerLocale) and pass it with setRequestLocale(); everything else (admin) is English.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isUiLocale(requested) ? requested : DEFAULT_UI_LOCALE;
  return {
    locale,
    timeZone: PLATFORM_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
