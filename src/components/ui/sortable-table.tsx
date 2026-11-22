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
import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export type SortableColumn<T> = {
  key: string;
  header: string;
  /** Right-aligned (numbers, actions). */
  end?: boolean;
  cell: (row: T) => ReactNode;
};

function Row<T extends { id: string }>({
  row,
  columns,
  handleLabel,
  muted,
}: {
  row: T;
  columns: SortableColumn<T>[];
  handleLabel: string;
  muted: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`border-s-4 bg-surface-container-lowest ${
        isDragging
          ? "relative z-10 border-primary shadow-card-warm"
          : "border-transparent hover:border-outline-variant hover:bg-surface-container-low/60"
      } ${muted ? "opacity-70" : ""}`}
    >
      <td className="w-0 py-sm ps-sm">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={handleLabel}
          className="flex h-9 w-7 cursor-grab touch-none items-center justify-center rounded-md text-outline transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:cursor-grabbing"
        >
          <Icon name="drag_indicator" className="text-icon-lg" />
        </button>
      </td>
      {columns.map((c) => (
        <td key={c.key} className={`px-md py-sm ${c.end ? "text-end" : ""}`}>
          {c.cell(row)}
        </td>
      ))}
    </tr>
  );
}

/**
 * Table whose rows are reordered by dragging the handle (or keyboard: Space, arrows, Space).
 * `onReorder` gets the new id order; the rows move at once and go back if it resolves false.
 */
export function SortableTable<T extends { id: string }>({
  rows,
  columns,
  handleLabel,
  hint,
  reorderLabel,
  isMuted = () => false,
  onReorder,
}: {
  rows: T[];
  columns: SortableColumn<T>[];
  handleLabel: (row: T) => string;
  hint: string;
  reorderLabel: string;
  isMuted?: (row: T) => boolean;
  onReorder: (ids: string[]) => Promise<boolean>;
}) {
  const [order, setOrder] = useState<string[] | null>(null);
  const dndId = useId(); // stable across server/browser (dnd-kit ids)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Optimistic order while the server saves; the server's rows win once they match.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered =
    order && order.length === rows.length && order.every((id) => byId.has(id))
      ? order.map((id) => byId.get(id)!)
      : rows;

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = ordered.map((r) => r.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrder(next);
    if (!(await onReorder(next))) setOrder(null);
  };

  return (
    <div className="flex flex-col gap-sm">
      <p className="flex items-center gap-xs text-body-sm text-on-surface-variant">
        <Icon name="drag_indicator" className="text-icon-md" />
        {hint}
      </p>
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
                  <span className="sr-only">{reorderLabel}</span>
                </th>
                {columns.map((c) => (
                  <th key={c.key} className={`px-md py-sm ${c.end ? "text-end" : "text-start"}`}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <SortableContext
              items={ordered.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className="divide-y divide-surface-container-high">
                {ordered.map((r) => (
                  <Row
                    key={r.id}
                    row={r}
                    columns={columns}
                    handleLabel={handleLabel(r)}
                    muted={isMuted(r)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
