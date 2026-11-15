"use client";

import { useActionState } from "react";
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
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete “${name}”? This cannot be undone.`)) e.preventDefault();
      }}
      className="flex flex-col items-end gap-xs"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending || inUse}
        title={inUse ? "In use by café owners — deactivate instead" : "Delete"}
        className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-error transition-colors hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="delete" className="text-icon-md" />
        Delete
      </button>
      {state.error ? <p className="text-caption text-error">{state.error}</p> : null}
    </form>
  );
}
