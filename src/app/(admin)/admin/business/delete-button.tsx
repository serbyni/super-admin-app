"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { deleteBusinessType, type DeleteState } from "./actions";

export function DeleteBusinessTypeButton({
  id,
  name,
  inUse,
}: {
  id: string;
  name: string;
  inUse: boolean;
}) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteBusinessType, {});
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  // Close the dialog when the request finishes (errors show next to the button).
  const [wasPending, setWasPending] = useState(false);
  if (pending !== wasPending) {
    setWasPending(pending);
    if (!pending) setOpen(false);
  }

  return (
    <form ref={form} action={action} className="flex flex-col items-end gap-xs">
      <input type="hidden" name="id" value={id} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending || inUse}
        title={inUse ? "In use by café owners — deactivate instead" : "Delete"}
        className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-error transition-colors hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="delete" className="text-icon-md" />
        Delete
      </button>
      {state.error ? <p className="text-caption text-error">{state.error}</p> : null}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => form.current?.requestSubmit()}
        pending={pending}
        tone="danger"
        icon="delete_forever"
        title={`Delete “${name}”?`}
        description="This business type is removed permanently. This cannot be undone."
        confirmLabel="Delete"
      />
    </form>
  );
}
