import type en from "../../messages/en.json";

// Type-checked translation keys: t("…") must exist in messages/en.json (same keys in fr/ar: tested).
declare module "next-intl" {
  interface AppConfig {
    Locale: "en" | "fr" | "ar";
    Messages: typeof en;
  }
}
