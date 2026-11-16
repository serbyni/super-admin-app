import "server-only";
import { after } from "next/server";
import { dispatchDueEmails } from "./email-dispatcher";

/**
 * Send pending emails right after the current response (does not slow the user down).
 * Call it after anything that creates an event: email confirmation, profile completion,
 * approve/decline. Missed kicks are picked up by the next kick or the scheduled sweep.
 */
export function kickEmailDispatch(): void {
  after(async () => {
    try {
      const r = await dispatchDueEmails();
      if (r.status === "not_configured") {
        console.warn(
          `[email] not configured (missing ${r.missing.join(", ")}); emails stay queued`,
        );
      }
    } catch (e) {
      console.error("[email] dispatch failed", e);
    }
  });
}
