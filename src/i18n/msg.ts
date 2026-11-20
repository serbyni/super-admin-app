import type en from "../../messages/en.json";

/*
 * Translatable messages from server actions and validation schemas. They run before the
 * page knows (or without) the reader's language, so they return a marked key instead of text:
 * msg("saveFailed") → "§saveFailed", msg("emailLinkSent", { email }) → '§emailLinkSent{"email":…}'.
 * The components that show messages (field errors, form alerts, toasts) translate them with
 * useMsg() (namespace "msg"); unmarked text is shown as it is.
 */

export type MsgKey = keyof typeof en.msg;
export type MsgValues = Record<string, string | number>;

const MARK = "§";

export function msg(key: MsgKey, values?: MsgValues): string {
  return MARK + key + (values ? JSON.stringify(values) : "");
}

export function parseMsg(s: string): { key: MsgKey; values?: MsgValues } | null {
  if (!s.startsWith(MARK)) return null;
  const brace = s.indexOf("{");
  const key = (brace === -1 ? s.slice(1) : s.slice(1, brace)) as MsgKey;
  if (brace === -1) return { key };
  try {
    return { key, values: JSON.parse(s.slice(brace)) as MsgValues };
  } catch {
    return { key };
  }
}
