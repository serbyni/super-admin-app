"use client";

import { useId, useState, useTransition } from "react";
import { TextAreaField } from "@/components/auth/fields";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { decideLanguageRequestAction } from "./actions";

/** Approve / Decline a language request, with an optional note for the owner. */
export function DecideButtons({ id, label }: { id: string; label: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [note, setNote] = useState("");
  const noteId = useId();
  const decide = () =>
    start(async () => {
      const r = await decideLanguageRequestAction(id, mode === "approve", note);
      toast.show({ variant: r.ok ? "success" : "error", title: r.message });
      if (r.ok) setMode(null);
    });
  return (
    <>
      <div className="flex flex-wrap gap-xs">
        <button
          type="button"
          onClick={() => setMode("approve")}
          className="inline-flex items-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary hover:bg-primary-container"
        >
          <Icon name="check" className="text-icon-md" /> Approve
        </button>
        <button
          type="button"
          onClick={() => setMode("decline")}
          className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold text-error hover:bg-error-container"
        >
          <Icon name="close" className="text-icon-md" /> Decline
        </button>
      </div>
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        dismissible={!pending}
        tone={mode === "decline" ? "danger" : "primary"}
        icon={mode === "decline" ? "do_not_disturb_on" : "translate"}
        title={mode === "approve" ? `Approve ${label}?` : `Decline ${label}?`}
        description={
          mode === "approve"
            ? "The language is added to the café and switched on. The owner is notified and can add translations."
            : "The owner is notified. You can explain why in the note."
        }
        actions={
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode(null)}
              className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={decide}
              className={`inline-flex items-center gap-xs rounded-xl px-lg py-sm font-semibold disabled:opacity-60 ${mode === "decline" ? "bg-error text-on-error" : "bg-primary text-on-primary"}`}
            >
              {pending ? (
                <Icon name="progress_activity" className="animate-spin text-icon-lg" />
              ) : null}
              {mode === "approve" ? "Approve" : "Decline"}
            </button>
          </>
        }
      >
        <TextAreaField
          id={noteId}
          label="Note for the owner (optional)"
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Dialog>
    </>
  );
}
