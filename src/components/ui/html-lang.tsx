"use client";

import { useEffect } from "react";

/**
 * Sets <html lang/dir>. The root <html> is part of the static shell (rendered before the
 * language is known), so owner layouts apply it here; their content also carries lang/dir.
 */
export function HtmlLang({ lang, dir }: { lang: string; dir: "ltr" | "rtl" }) {
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dir;
    return () => {
      html.lang = "en";
      html.dir = "ltr";
    };
  }, [lang, dir]);
  return null;
}
