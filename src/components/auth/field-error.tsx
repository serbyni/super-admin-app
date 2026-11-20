"use client";

import { useMsg } from "@/i18n/use-msg";

/** Error under a field (validation messages may be translatable keys, see i18n/msg.ts). */
export function FieldError({ id, message }: { id: string; message?: string }) {
  const m = useMsg();
  if (!message) return null;
  return (
    <p id={`${id}-error`} role="alert" className="mt-1 ps-3 text-body-xs text-error">
      {m(message)}
    </p>
  );
}
