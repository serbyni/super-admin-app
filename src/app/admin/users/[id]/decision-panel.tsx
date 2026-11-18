"use client";

import { useActionState, useRef, useState } from "react";
import { TextAreaField } from "@/components/auth/fields";
import { FormAlert } from "@/components/auth/form-alert";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { approveOwner, declineOwner, type DecisionState } from "../actions";

/** Approve / Decline (with a reason that is emailed to the owner). */
export function DecisionPanel({ userId, businessName }: { userId: string; businessName: string }) {
  const [approveState, approve, approving] = useActionState<DecisionState, FormData>(
    approveOwner,
    {},
  );
  const [declineState, decline, declining] = useActionState<DecisionState, FormData>(
    declineOwner,
    {},
  );
  const [mode, setMode] = useState<"choose" | "decline">(declineState.error ? "decline" : "choose");
  const busy = approving || declining;
  const approveForm = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Close the dialog when the approve request finishes (on error the message shows on the page).
  const [wasApproving, setWasApproving] = useState(false);
  if (approving !== wasApproving) {
    setWasApproving(approving);
    if (!approving) setConfirmOpen(false);
  }

  return (
    <section className="rounded-xl bg-surface-container-lowest p-lg shadow-sm">
      <h2 className="mb-xs text-headline-md text-on-surface">Decision</h2>
      <p className="mb-md text-body-sm text-on-surface-variant">
        The owner is emailed automatically. Approving also shows a notification when they sign in.
      </p>
      <FormAlert message={approveState.error} />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => approveForm.current?.requestSubmit()}
        pending={approving}
        tone="success"
        icon="verified"
        title={`Approve “${businessName}”?`}
        description="The owner gets the approval email and a notification when they sign in. This cannot be undone from here."
        confirmLabel="Approve"
      />

      {mode === "choose" ? (
        <div className="flex flex-col gap-sm sm:flex-row">
          <form ref={approveForm} action={approve} className="flex-1">
            <input type="hidden" name="userId" value={userId} />
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
              className="flex w-full items-center justify-center gap-xs rounded-xl bg-success px-lg py-sm font-semibold text-on-primary shadow-sm transition-all hover:scale-101 disabled:opacity-60"
            >
              <Icon
                name={approving ? "progress_activity" : "check_circle"}
                className={`text-icon-lg ${approving ? "animate-spin" : ""}`}
              />
              Approve
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMode("decline")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-xs rounded-xl border border-error px-lg py-sm font-semibold text-error transition-colors hover:bg-error-container disabled:opacity-60"
          >
            <Icon name="block" className="text-icon-lg" />
            Decline…
          </button>
        </div>
      ) : (
        <form action={decline} noValidate className="flex flex-col gap-md">
          <input type="hidden" name="userId" value={userId} />
          <TextAreaField
            id="reason"
            label="Reason (sent to the owner)"
            required
            rows={4}
            maxLength={1000}
            defaultValue={declineState.reason}
            placeholder="e.g. We could not verify the business address. Please reply with a photo of your storefront."
            error={declineState.error}
            hint="Be clear and polite — the owner reads this in the email."
          />
          <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setMode("choose")}
              disabled={busy}
              className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-xs rounded-xl bg-error px-lg py-sm font-semibold text-on-error shadow-sm transition-all hover:scale-101 disabled:opacity-60"
            >
              <Icon
                name={declining ? "progress_activity" : "send"}
                className={`text-icon-lg ${declining ? "animate-spin" : ""}`}
              />
              Decline and email owner
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
