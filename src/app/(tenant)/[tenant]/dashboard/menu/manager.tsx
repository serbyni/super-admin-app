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
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { TextAreaField, TextField } from "@/components/auth/fields";
import { ImageField } from "@/components/media/image-fields";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { isRtlLanguage, languageLabel } from "@/lib/i18n/languages";
import { mediaUrl } from "@/lib/media/config";
import {
  MENU_LIMITS,
  MENU_TAGS,
  currencyDigits,
  formatPrice,
  itemStatus,
  type Menu,
  type MenuCategory,
  type MenuItem,
  type MenuTag,
} from "@/lib/menu/schema";
import {
  applyTemplateAction,
  deleteCategoryAction,
  deleteItemAction,
  reorderCategoriesAction,
  reorderItemsAction,
  saveCategoryAction,
  saveItemAction,
  setAvailableAction,
  type MenuResult,
} from "./actions";

type Props = {
  slug: string;
  cafeId: string;
  currency: string;
  menu: Menu;
  /** Menu language and the other languages the café offers (translation tabs). */
  languages: { main: string; others: string[] };
};
type I18nState = Record<string, Record<string, string>>;
type Confirm = { kind: "item"; item: MenuItem } | { kind: "category"; category: MenuCategory };

const ALL = "all";

const STATUS: Record<ReturnType<typeof itemStatus>, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-success-container text-success" },
  sold_out: { label: "Sold out", className: "bg-inverse-surface text-inverse-on-surface" },
  hidden: { label: "Hidden", className: "bg-surface-container-high text-on-surface-variant" },
  no_price: { label: "No price", className: "bg-warning-container text-on-warning-container" },
};

export function MenuManager({ slug, cafeId, currency, menu, languages }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [categoryId, setCategoryId] = useState<string>(menu.categories[0]?.id ?? ALL);
  const [query, setQuery] = useState("");
  const [itemForm, setItemForm] = useState<MenuItem | "new" | null>(null);
  const [categoryForm, setCategoryForm] = useState<MenuCategory | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Optimistic orders (server data stays the source of truth on the next render).
  const [catOrder, setCatOrder] = useState<string[] | null>(null);
  const [itemOrder, setItemOrder] = useState<Record<string, string[]>>({});

  const categories = useMemo(() => {
    if (!catOrder) return menu.categories;
    const byId = new Map(menu.categories.map((c) => [c.id, c]));
    const ordered = catOrder.map((id) => byId.get(id)).filter((c): c is MenuCategory => !!c);
    return ordered.length === menu.categories.length ? ordered : menu.categories;
  }, [menu.categories, catOrder]);
  const catName = (id: string) => menu.categories.find((c) => c.id === id)?.name ?? "";
  const category = categories.find((c) => c.id === categoryId) ?? null;

  const itemsOf = (cid: string) => {
    const list = menu.items.filter((i) => i.categoryId === cid);
    const order = itemOrder[cid];
    if (!order) return list;
    const byId = new Map(list.map((i) => [i.id, i]));
    const ordered = order.map((id) => byId.get(id)).filter((i): i is MenuItem => !!i);
    return ordered.length === list.length ? ordered : list;
  };
  const q = query.trim().toLowerCase();
  const visibleItems = (
    categoryId === ALL ? categories.flatMap((c) => itemsOf(c.id)) : itemsOf(categoryId)
  ).filter(
    (i) => !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
  );
  const canReorderItems = categoryId !== ALL && !q;
  const notPriced = menu.items.filter((i) => i.price === null).length;

  // Stable ids: dnd-kit's own counters differ between server and browser (hydration mismatch).
  const catDndId = useId();
  const itemDndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const run = (
    fn: () => Promise<MenuResult>,
    after?: (r: Extract<MenuResult, { ok: true }>) => void,
    quiet = false,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setErrors(r.errors ?? {});
        setConfirm(null); // a refused delete is explained by the toast; keep forms open to fix fields
        toast.show({ variant: "error", title: r.message });
        return;
      }
      setErrors({});
      if (r.message && !quiet) toast.show({ variant: "success", title: r.message });
      after?.(r);
    });

  const onCategoryDrag = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = categories.map((c) => c.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setCatOrder(next);
    run(() => reorderCategoriesAction(slug, next), undefined, true);
  };
  const onItemDrag = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || categoryId === ALL) return;
    const ids = itemsOf(categoryId).map((i) => i.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setItemOrder((o) => ({ ...o, [categoryId]: next }));
    run(() => reorderItemsAction(slug, categoryId, next), undefined, true);
  };

  // ── Empty menu ──
  if (menu.categories.length === 0) {
    return (
      <>
        <section className="flex flex-col items-center gap-md rounded-xl bg-surface-container-lowest p-xl text-center shadow-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-primary">
            <Icon name="restaurant_menu" className="text-icon-2xl" />
          </span>
          <h2 className="text-headline-md text-on-surface">Your menu is empty</h2>
          <p className="max-w-card-md text-body-md text-on-surface-variant">
            Start from a ready-made café menu (Coffee, Tea, Pastries, Cold drinks — in your menu
            language) and edit it, or start empty. Items show to customers once they have a price.
          </p>
          <div className="flex flex-wrap justify-center gap-sm">
            <PrimaryButton
              icon="auto_awesome"
              disabled={pending}
              onClick={() => run(() => applyTemplateAction(slug))}
            >
              Start from a template
            </PrimaryButton>
            <OutlineButton icon="add" onClick={() => setCategoryForm("new")}>
              Start empty
            </OutlineButton>
          </div>
        </section>
        <CategoryDialog
          form={categoryForm}
          errors={errors}
          pending={pending}
          onClose={() => setCategoryForm(null)}
          languages={languages}
          onSubmit={(name, i18n) =>
            run(
              () => saveCategoryAction(slug, null, name, true, i18n),
              (r) => {
                setCategoryForm(null);
                if (r.id) setCategoryId(r.id);
              },
            )
          }
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-lg">
      {notPriced ? (
        <p className="bg-warning-container text-on-warning-container flex items-center gap-sm rounded-xl px-md py-sm text-body-sm">
          <Icon name="sell" className="text-icon-lg" />
          {notPriced} item{notPriced === 1 ? " has" : "s have"} no price yet — customers don&apos;t
          see {notPriced === 1 ? "it" : "them"} until you set one.
        </p>
      ) : null}

      {languages.others.length && menu.items.length ? (
        <div className="flex flex-wrap items-center gap-xs text-body-sm">
          <span className="flex items-center gap-xs text-on-surface-variant">
            <Icon name="translate" className="text-icon-md" /> Translated:
          </span>
          {languages.others.map((l) => {
            const done = menu.items.filter((i) => i.i18n[l]?.name).length;
            const all = done === menu.items.length;
            return (
              <span
                key={l}
                className={`rounded-full px-sm py-xs font-semibold ${all ? "bg-success-container text-success" : "bg-surface-container text-on-surface-variant"}`}
              >
                {languageLabel(l)} {done}/{menu.items.length}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Search + add */}
      <div className="flex flex-wrap items-center gap-sm">
        <label className="flex min-w-0 flex-1 items-center gap-sm rounded-xl bg-surface-container-low px-md py-sm">
          <Icon name="search" className="text-icon-lg text-on-surface-variant" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu items…"
            aria-label="Search menu items"
            className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none"
          />
        </label>
        {menu.items.length < MENU_LIMITS.items ? (
          <PrimaryButton icon="add" onClick={() => setItemForm("new")}>
            Add item
          </PrimaryButton>
        ) : null}
      </div>

      {/* Categories (drag to reorder) */}
      <div className="flex flex-wrap items-center gap-xs" role="tablist" aria-label="Categories">
        <Chip
          active={categoryId === ALL}
          onClick={() => setCategoryId(ALL)}
          count={menu.items.length}
        >
          All items
        </Chip>
        <DndContext
          id={catDndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onCategoryDrag}
        >
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {categories.map((c) => (
              <SortableChip
                key={c.id}
                category={c}
                active={c.id === categoryId}
                count={itemsOf(c.id).length}
                onClick={() => setCategoryId(c.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {menu.categories.length < MENU_LIMITS.categories ? (
          <button
            type="button"
            onClick={() => setCategoryForm("new")}
            className="inline-flex items-center gap-xs rounded-full border border-dashed border-outline-variant px-md py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
          >
            <Icon name="add" className="text-icon-md" /> Category
          </button>
        ) : null}
      </div>

      {category ? (
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <p className="text-body-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">{category.name}</span>
            {category.isVisible ? "" : " · hidden from customers"}
            {canReorderItems && itemsOf(category.id).length > 1 ? " · drag items to reorder" : ""}
          </p>
          <div className="flex flex-wrap gap-xs">
            <OutlineButton icon="edit" onClick={() => setCategoryForm(category)}>
              Rename
            </OutlineButton>
            <OutlineButton
              icon={category.isVisible ? "visibility_off" : "visibility"}
              onClick={() =>
                run(() => saveCategoryAction(slug, category.id, category.name, !category.isVisible))
              }
            >
              {category.isVisible ? "Hide" : "Show"}
            </OutlineButton>
            <OutlineButton
              icon="delete"
              tone="danger"
              onClick={() => setConfirm({ kind: "category", category })}
            >
              Delete
            </OutlineButton>
          </div>
        </div>
      ) : null}

      {/* Items */}
      {visibleItems.length === 0 && q ? (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-center text-on-surface-variant">
          No item matches “{query}”.
        </p>
      ) : (
        <DndContext
          id={itemDndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onItemDrag}
        >
          <SortableContext items={visibleItems.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleItems.map((i) => (
                <ItemCard
                  key={i.id}
                  item={i}
                  currency={currency}
                  categoryName={categoryId === ALL ? catName(i.categoryId) : null}
                  sortable={canReorderItems}
                  pending={pending}
                  onEdit={() => setItemForm(i)}
                  onDelete={() => setConfirm({ kind: "item", item: i })}
                  onToggleSoldOut={() => run(() => setAvailableAction(slug, i.id, !i.isAvailable))}
                />
              ))}
              {menu.items.length < MENU_LIMITS.items && !q ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setItemForm("new")}
                    className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-xs rounded-xl border-2 border-dashed border-outline-variant p-lg text-on-surface-variant hover:border-primary hover:text-primary"
                  >
                    <Icon name="add_circle" className="text-icon-2xl" />
                    <span className="font-semibold">
                      Add {category ? `to ${category.name}` : "an item"}
                    </span>
                  </button>
                </li>
              ) : null}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <CategoryDialog
        form={categoryForm}
        errors={errors}
        pending={pending}
        onClose={() => {
          setCategoryForm(null);
          setErrors({});
        }}
        languages={languages}
        onSubmit={(name, i18n) => {
          const c = categoryForm !== "new" ? categoryForm : null;
          run(
            () => saveCategoryAction(slug, c?.id ?? null, name, c?.isVisible ?? true, i18n),
            (r) => {
              setCategoryForm(null);
              if (!c && r.id) setCategoryId(r.id);
            },
          );
        }}
      />

      <Dialog
        open={itemForm !== null}
        onClose={() => {
          setItemForm(null);
          setErrors({});
        }}
        title={itemForm === "new" ? "Add an item" : itemForm ? `Edit ${itemForm.name}` : ""}
        icon="restaurant_menu"
        size="md"
      >
        {itemForm !== null ? (
          <ItemFields
            key={itemForm === "new" ? `new-${categoryId}` : itemForm.id}
            item={itemForm === "new" ? null : itemForm}
            categories={categories}
            defaultCategory={category?.id ?? categories[0].id}
            cafeId={cafeId}
            currency={currency}
            languages={languages}
            errors={errors}
            pending={pending}
            onCancel={() => setItemForm(null)}
            onSubmit={(input) =>
              run(
                () => saveItemAction(slug, itemForm === "new" ? null : itemForm.id, input),
                () => setItemForm(null),
              )
            }
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        pending={pending}
        tone="danger"
        icon="delete"
        title={
          confirm?.kind === "item"
            ? `Delete ${confirm.item.name}?`
            : confirm
              ? `Delete ${confirm.category.name}?`
              : ""
        }
        description={
          confirm?.kind === "category"
            ? "Only empty categories can be deleted. Move or delete its items first."
            : "It disappears from your menu. This can't be undone."
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (!confirm) return;
          const c = confirm;
          run(
            () =>
              c.kind === "item"
                ? deleteItemAction(slug, c.item.id)
                : deleteCategoryAction(slug, c.category.id),
            () => {
              setConfirm(null);
              if (c.kind === "category")
                setCategoryId(categories.find((x) => x.id !== c.category.id)?.id ?? ALL);
            },
          );
        }}
      />
    </div>
  );
}

/* ── Items ──────────────────────────────────────────────────────────────── */

function ItemCard({
  item,
  currency,
  categoryName,
  sortable,
  pending,
  onEdit,
  onDelete,
  onToggleSoldOut,
}: {
  item: MenuItem;
  currency: string;
  categoryName: string | null;
  sortable: boolean;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSoldOut: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !sortable,
  });
  const status = itemStatus(item);
  const s = STATUS[status];
  const tags = MENU_TAGS.filter((t) => item.tags.includes(t.value));
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm ${isDragging ? "relative z-10 shadow-card-warm" : ""}`}
    >
      <div className="relative aspect-video overflow-hidden bg-surface-container">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo from the café media bucket
          <img
            src={mediaUrl(item.image.path)}
            alt={item.image.alt}
            className={`absolute inset-0 h-full w-full object-cover ${status === "sold_out" ? "grayscale" : ""}`}
            loading="lazy"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-outline">
            <Icon name="image" className="text-icon-3xl" />
          </span>
        )}
        <span
          className={`absolute end-sm top-sm rounded-full px-sm py-xs text-caption font-bold uppercase ${s.className}`}
        >
          {s.label}
        </span>
        {item.isFeatured ? (
          <span className="absolute start-sm top-sm flex items-center gap-xs rounded-full bg-surface-container-lowest px-sm py-xs text-caption font-semibold text-primary shadow-sm">
            <Icon name="star" filled className="text-icon-sm" /> Featured
          </span>
        ) : null}
        {sortable ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${item.name}`}
            className="absolute start-sm bottom-sm flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-lg bg-surface-container-lowest/90 text-on-surface-variant shadow-sm active:cursor-grabbing"
          >
            <Icon name="drag_indicator" className="text-icon-lg" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-xs p-md">
        <div className="flex items-start justify-between gap-sm">
          <p className="min-w-0 font-semibold text-on-surface">{item.name}</p>
          <p className="shrink-0 font-bold text-primary tabular-nums">
            {item.price === null ? "—" : formatPrice(item.price, currency)}
          </p>
        </div>
        <p className="line-clamp-2 text-body-sm text-on-surface-variant">
          {[categoryName, item.description].filter(Boolean).join(" · ") || " "}
        </p>
        {tags.length ? (
          <ul className="flex flex-wrap gap-xs">
            {tags.map((t) => (
              <li
                key={t.value}
                className="inline-flex items-center gap-xs rounded-full bg-surface-container px-sm text-caption text-on-surface-variant"
              >
                <Icon name={t.icon} className="text-icon-sm" /> {t.label}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-xs border-t border-surface-container-high pt-sm">
          <div className="flex gap-xs">
            <IconButton icon="edit" label={`Edit ${item.name}`} onClick={onEdit} />
            <IconButton
              icon="delete"
              label={`Delete ${item.name}`}
              onClick={onDelete}
              tone="danger"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onToggleSoldOut}
            aria-pressed={!item.isAvailable}
            className={`inline-flex items-center gap-xs rounded-lg px-sm py-xs text-body-sm font-semibold disabled:opacity-60 ${
              item.isAvailable
                ? "text-primary hover:bg-secondary-container"
                : "bg-inverse-surface text-inverse-on-surface"
            }`}
          >
            <Icon
              name={item.isAvailable ? "remove_shopping_cart" : "check_circle"}
              className="text-icon-md"
            />
            {item.isAvailable ? "Mark sold out" : "Back on menu"}
          </button>
        </div>
      </div>
    </li>
  );
}

function ItemFields({
  item,
  categories,
  defaultCategory,
  cafeId,
  currency,
  languages,
  errors,
  pending,
  onSubmit,
  onCancel,
}: {
  item: MenuItem | null;
  categories: MenuCategory[];
  defaultCategory: string;
  cafeId: string;
  currency: string;
  languages: { main: string; others: string[] };
  errors: Record<string, string>;
  pending: boolean;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const digits = currencyDigits(currency);
  const [tab, setTab] = useState(languages.main);
  const [i18n, setI18n] = useState<I18nState>(() => structuredClone(item?.i18n ?? {}) as I18nState);
  // Main texts (shown as reference in the translation tabs).
  const [mainName, setMainName] = useState(item?.name ?? "");
  const [mainDesc, setMainDesc] = useState(item?.description ?? "");
  const tr = (l: string, f: string) => i18n[l]?.[f] ?? "";
  const setTr = (l: string, f: string, v: string) =>
    setI18n((x) => ({ ...x, [l]: { ...(x[l] ?? {}), [f]: v } }));
  const [image, setImage] = useState(item?.image ?? null);
  const [tags, setTags] = useState<MenuTag[]>(item?.tags ?? []);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit({
      category_id: f.get("category_id"),
      name: f.get("name"),
      description: f.get("description") ?? "",
      price: f.get("price") ?? "",
      image_path: image?.path ?? "",
      image_alt: image?.alt ?? "",
      tags,
      is_available: f.get("is_available") === "on",
      is_visible: f.get("is_visible") === "on",
      is_featured: f.get("is_featured") === "on",
      i18n,
    });
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-md">
      {languages.others.length ? (
        <LanguageTabs
          main={languages.main}
          others={languages.others}
          active={tab}
          onChange={setTab}
          done={(l) => !!tr(l, "name")}
        />
      ) : null}
      {languages.others.map((l) =>
        tab === l ? (
          <div key={l} className="flex flex-col gap-md" lang={l}>
            <p className="text-body-sm text-on-surface-variant">
              {languageLabel(l)} translation. Empty fields show the {languageLabel(languages.main)}{" "}
              text.
            </p>
            <TextField
              id={`name-${l}`}
              label={`Name in ${languageLabel(l)}`}
              maxLength={80}
              dir={isRtlLanguage(l) ? "rtl" : "ltr"}
              value={tr(l, "name")}
              onChange={(e) => setTr(l, "name", e.target.value)}
              hint={mainName ? `Original: ${mainName}` : undefined}
              error={errors.i18n}
            />
            <TextAreaField
              id={`description-${l}`}
              label={`Description in ${languageLabel(l)}`}
              rows={3}
              maxLength={500}
              dir={isRtlLanguage(l) ? "rtl" : "ltr"}
              value={tr(l, "description")}
              onChange={(e) => setTr(l, "description", e.target.value)}
              hint={mainDesc ? `Original: ${mainDesc}` : undefined}
            />
          </div>
        ) : null,
      )}
      {/* Main language: always mounted (its inputs are part of the form), hidden on other tabs. */}
      <div className="flex flex-col gap-md" hidden={tab !== languages.main}>
        <TextField
          id="name"
          label="Name"
          required
          maxLength={80}
          defaultValue={item?.name ?? ""}
          onChange={(e) => setMainName(e.target.value)}
          error={errors.name}
        />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <TextField
            id="price"
            label={`Price (${currency})`}
            inputMode="decimal"
            placeholder={(4.5).toFixed(digits)}
            defaultValue={
              item?.price === null || item?.price === undefined ? "" : item.price.toFixed(digits)
            }
            error={errors.price}
            hint="Leave empty to keep it hidden for now"
          />
          <label className="flex flex-col gap-xs text-body-sm font-semibold text-on-surface">
            Category
            <select
              name="category_id"
              defaultValue={item?.categoryId ?? defaultCategory}
              className="rounded-lg border border-outline-variant bg-transparent px-sm py-3.5 font-normal"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TextAreaField
          id="description"
          label="Description (optional)"
          rows={3}
          maxLength={500}
          defaultValue={item?.description ?? ""}
          error={errors.description}
          onChange={(e) => setMainDesc(e.target.value)}
        />
        <ImageField
          cafeId={cafeId}
          label="Photo"
          value={image}
          onChange={setImage}
          error={errors.image ?? errors.image_path}
        />
        <fieldset>
          <legend className="mb-xs text-body-sm font-semibold text-on-surface">Tags</legend>
          <div className="flex flex-wrap gap-xs">
            {MENU_TAGS.map((t) => {
              const on = tags.includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setTags((x) => (on ? x.filter((v) => v !== t.value) : [...x, t.value]))
                  }
                  className={`inline-flex items-center gap-xs rounded-full border px-sm py-xs text-body-sm ${
                    on
                      ? "border-primary bg-secondary-container text-primary"
                      : "border-outline-variant text-on-surface-variant"
                  }`}
                >
                  <Icon name={t.icon} className="text-icon-md" /> {t.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-col gap-sm rounded-lg bg-surface-container-low p-md text-body-sm text-on-surface">
          <Check name="is_available" defaultChecked={item?.isAvailable ?? true}>
            Available — uncheck when it&apos;s sold out
          </Check>
          <Check name="is_visible" defaultChecked={item?.isVisible ?? true}>
            Show on the menu
          </Check>
          <Check name="is_featured" defaultChecked={item?.isFeatured ?? false}>
            Featured — shown on your website&apos;s &quot;Signature specialties&quot;
          </Check>
        </div>
      </div>
      <FormButtons pending={pending} onCancel={onCancel} label={item ? "Save" : "Add item"} />
    </form>
  );
}

/* ── Categories ─────────────────────────────────────────────────────────── */

function SortableChip({
  category,
  active,
  count,
  onClick,
}: {
  category: MenuCategory;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  return (
    <span
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10" : ""}
    >
      <Chip
        active={active}
        onClick={onClick}
        count={count}
        muted={!category.isVisible}
        dragProps={{ ...attributes, ...listeners }}
        label={category.name}
      >
        {category.name}
      </Chip>
    </span>
  );
}

function Chip({
  active,
  onClick,
  count,
  muted,
  children,
  dragProps,
  label,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  muted?: boolean;
  children: ReactNode;
  dragProps?: object;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full text-body-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
      } ${muted ? "opacity-60" : ""}`}
    >
      {dragProps ? (
        <button
          type="button"
          {...dragProps}
          aria-label={`Reorder ${label}`}
          className="flex cursor-grab touch-none items-center ps-sm active:cursor-grabbing"
        >
          <Icon name="drag_indicator" className="text-icon-md opacity-70" />
        </button>
      ) : null}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onClick}
        className={`py-xs pe-md ${dragProps ? "ps-xs" : "ps-md"}`}
      >
        {children}
        {muted ? <Icon name="visibility_off" className="ms-xs text-icon-sm" /> : null}
        <span className="ms-xs opacity-75">{count}</span>
      </button>
    </span>
  );
}

function CategoryDialog({
  form,
  errors,
  pending,
  onClose,
  onSubmit,
  languages,
}: {
  form: MenuCategory | "new" | null;
  errors: Record<string, string>;
  pending: boolean;
  onClose: () => void;
  onSubmit: (name: string, i18n: I18nState) => void;
  languages: { main: string; others: string[] };
}) {
  return (
    <Dialog
      open={form !== null}
      onClose={onClose}
      title={form === "new" ? "Add a category" : "Rename category"}
      icon="category"
    >
      {form !== null ? (
        <form
          key={form === "new" ? "new" : form.id}
          noValidate
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const i18n: I18nState = Object.fromEntries(
              languages.others.map((l) => [l, { name: String(f.get(`name-${l}`) ?? "") }]),
            );
            onSubmit(String(f.get("name") ?? ""), i18n);
          }}
        >
          <TextField
            id="name"
            label="Name"
            required
            maxLength={60}
            placeholder="e.g. Coffee, Brunch"
            defaultValue={form === "new" ? "" : form.name}
            error={errors.name}
          />
          {languages.others.map((l) => (
            <TextField
              key={l}
              id={`name-${l}`}
              label={`Name in ${languageLabel(l)} (optional)`}
              maxLength={60}
              dir={isRtlLanguage(l) ? "rtl" : "ltr"}
              defaultValue={form === "new" ? "" : (form.i18n[l]?.name ?? "")}
            />
          ))}
          <FormButtons
            pending={pending}
            onCancel={onClose}
            label={form === "new" ? "Add category" : "Save"}
          />
        </form>
      ) : null}
    </Dialog>
  );
}

/* ── Small UI pieces ────────────────────────────────────────────────────── */

/** "French (main) | English ✓ | Arabic" tabs of a form with translations. */
function LanguageTabs({
  main,
  others,
  active,
  onChange,
  done,
}: {
  main: string;
  others: string[];
  active: string;
  onChange: (l: string) => void;
  done: (l: string) => boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Language"
      className="flex flex-wrap gap-xs border-b border-surface-container-high pb-xs"
    >
      {[main, ...others].map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={active === l}
          onClick={() => onChange(l)}
          className={`inline-flex items-center gap-xs rounded-full px-md py-xs text-body-sm font-semibold ${
            active === l
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          {languageLabel(l)}
          {l === main ? (
            <span className="opacity-75">· main</span>
          ) : done(l) ? (
            <Icon name="check" className="text-icon-sm" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function Check({
  name,
  defaultChecked,
  children,
}: {
  name: string;
  defaultChecked: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-primary"
      />
      {children}
    </label>
  );
}

function PrimaryButton({
  icon,
  onClick,
  children,
  disabled,
}: {
  icon: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-xs rounded-xl bg-primary px-md py-sm text-body-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
    >
      <Icon name={icon} className="text-icon-md" /> {children}
    </button>
  );
}

function OutlineButton({
  icon,
  onClick,
  children,
  tone,
}: {
  icon: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm text-body-sm font-semibold hover:bg-secondary-container ${tone === "danger" ? "text-error" : "text-primary"}`}
    >
      <Icon name={icon} className="text-icon-md" /> {children}
    </button>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-container ${tone === "danger" ? "text-error" : "text-on-surface-variant"}`}
    >
      <Icon name={icon} className="text-icon-lg" />
    </button>
  );
}

function FormButtons({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="mt-xs flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-xs rounded-xl bg-primary px-lg py-sm font-semibold text-on-primary shadow-button-warm hover:bg-primary-container disabled:opacity-60"
      >
        {pending ? <Icon name="progress_activity" className="animate-spin text-icon-lg" /> : null}
        {label}
      </button>
    </div>
  );
}
