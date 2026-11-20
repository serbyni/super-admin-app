"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { localizedName, type AdminBusinessType } from "@/lib/business-types/schema";
import { reorderBusinessTypes } from "./actions";
import { DeleteBusinessTypeButton } from "./delete-button";

function Row({ t }: { t: AdminBusinessType }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: t.id });
  const name = localizedName(t.name);

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`border-s-4 bg-surface-container-lowest ${
        isDragging
          ? "relative z-10 border-primary shadow-card-warm"
          : "border-transparent hover:border-outline-variant hover:bg-surface-container-low/60"
      }`}
    >
      <td className="w-0 py-sm ps-sm">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${name}`}
          className="flex h-9 w-7 cursor-grab touch-none items-center justify-center rounded-md text-outline transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:cursor-grabbing"
        >
          <Icon name="drag_indicator" className="text-icon-lg" />
        </button>
      </td>
      <td className="px-md py-sm">
        <span className="flex items-center gap-sm font-semibold text-on-surface">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-container text-primary">
            <Icon name={t.icon} className="text-icon-md" />
          </span>
          {name}
        </span>
      </td>
      <td className="px-md py-sm font-mono text-on-surface-variant">{t.slug}</td>
      <td className="px-md py-sm text-on-surface-variant">
        {t.name.fr ?? "—"} · <span dir="rtl">{t.name.ar ?? "—"}</span>
      </td>
      <td className="px-md py-sm text-end tabular-nums">{t.owners_count}</td>
      <td className="px-md py-sm">
        <span
          className={`rounded-full px-sm py-xs font-label-sm text-label-sm uppercase ${
            t.is_active
              ? "bg-success-container text-success"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {t.is_active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-md py-sm">
        <div className="flex items-start justify-end gap-xs">
          <Link
            href={`/admin/business/${t.id}`}
            className="inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold text-info transition-colors hover:bg-info-container"
          >
            <Icon name="edit" className="text-icon-md" />
            Edit
          </Link>
          <DeleteBusinessTypeButton id={t.id} name={name} inUse={t.owners_count > 0} />
        </div>
      </td>
    </tr>
  );
}

/** Business types table; drag rows by the handle (or keyboard: Space, arrows, Space) to reorder. */
export function SortableBusinessTypes({ initial }: { initial: AdminBusinessType[] }) {
  const [items, setItems] = useState(initial);
  const [status, setStatus] = useState<{ kind: "saving" | "saved" | "error"; text: string } | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const dndId = useId(); // stable across server/browser (dnd-kit ids)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = items;
    const next = arrayMove(
      items,
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    );
    setItems(next);
    setStatus({ kind: "saving", text: "Saving order…" });
    startTransition(async () => {
      const result = await reorderBusinessTypes(next.map((i) => i.id));
      if (result.ok) {
        setStatus({ kind: "saved", text: "Order saved — the register form uses it now." });
      } else {
        setItems(previous);
        setStatus({ kind: "error", text: result.error });
      }
    });
  }

  return (
    <div>
      <div className="mb-sm flex min-h-6 items-center justify-between gap-sm">
        <p className="flex items-center gap-xs text-body-sm text-on-surface-variant">
          <Icon name="drag_indicator" className="text-icon-md" />
          Drag rows by the handle to change the order shown at registration.
        </p>
        {status ? (
          <p
            role="status"
            className={`text-body-sm font-semibold ${
              status.kind === "error"
                ? "text-error"
                : status.kind === "saved"
                  ? "text-success"
                  : "text-on-surface-variant"
            }`}
          >
            {status.text}
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-sm">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <table className="w-full min-w-max text-start text-body-sm">
            <thead className="bg-surface-container-low font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
              <tr>
                <th className="w-0 py-sm ps-sm">
                  <span className="sr-only">Reorder</span>
                </th>
                <th className="px-md py-sm text-start">Type</th>
                <th className="px-md py-sm text-start">Code</th>
                <th className="px-md py-sm text-start">FR / AR</th>
                <th className="px-md py-sm text-end">Owners</th>
                <th className="px-md py-sm text-start">Status</th>
                <th className="px-md py-sm text-end">Actions</th>
              </tr>
            </thead>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-surface-container-high">
                {items.map((t) => (
                  <Row key={t.id} t={t} />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
