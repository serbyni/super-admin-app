import en from "../../messages/en.json";
import { parseMsg } from "./msg";

/** English text of a message key (tests and plain-text fallbacks): "§passwordMin{"min":10}" → "Use at least 10 characters". */
export function enText(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  const m = parseMsg(s);
  if (!m) return s;
  const text: string = en.msg[m.key] ?? s;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(m.values?.[k] ?? `{${k}}`));
}
