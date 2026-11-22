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
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { TextAreaField, TextField } from "@/components/auth/fields";
import { ImageField } from "@/components/media/image-fields";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconPicker } from "@/components/ui/icon-picker";
import { useToast } from "@/components/ui/toast";
import { useCan } from "@/components/access/access-provider";
import { useLanguageLabel } from "@/i18n/use-language-label";
import { useMsg } from "@/i18n/use-msg";
import { formatLocale } from "@/config/locale";
import type { MenuSales } from "@/lib/stats/page-schemas";
import { CATEGORY_ICONS, tagName, type MenuTagRow } from "@/lib/menu/tags";
import { TagDialog } from "./tag-dialog";
import { isRtlLanguage } from "@/lib/i18n/languages";
import { mediaUrl } from "@/lib/media/config";
import {
  MENU_LIMITS,
  currencyDigits,
  formatPrice,
  itemStatus,
  type Menu,
  type MenuCategory,
  type MenuItem,
} from "@/lib/menu/schema";
import {
  applyTemplateAction,
  deleteCategoryAction,
  deleteItemAction,
  reorderCategoriesAction,
  reorderItemsAction,
  saveCategoryAction,
  saveItemAction,
  saveTagAction,
  setAvailableAction,
  type MenuResult,
} from "./actions";
import {
  OptionsEditor,
  OptionsTranslation,
  fromOptionGroups,
  toOptionGroups,
  type EditGroup,
} from "./options-editor";

type Props = {
  slug: string;
  cafeId: string;
  currency: string;
  menu: Menu;
  /** Menu language and the other languages the café offers (translation tabs). */
  languages: { main: string; others: string[] };
  /** Sales of the chosen period (statistics strip above). */
  sales?: MenuSales;
};
type I18nState = Record<string, Record<string, string>>;
type Confirm = { kind: "item"; item: MenuItem } | { kind: "category"; category: MenuCategory };

const ALL = "all";

const STATUS = {
  available: { label: "statusAvailable", className: "bg-success-container text-success" },
  sold_out: { label: "statusSoldOut", className: "bg-inverse-surface text-inverse-on-surface" },
  hidden: { label: "statusHidden", className: "bg-surface-container-high text-on-surface-variant" },
  no_price: { label: "statusNoPrice", className: "bg-warning-container text-on-warning-container" },
} as const satisfies Record<ReturnType<typeof itemStatus>, { label: string; className: string }>;

export function MenuManager({ slug, cafeId, currency, menu, languages, sales }: Props) {
  const t = useTranslations("menu");
  const tc = useTranslations("common");
  const m = useMsg();
  const languageLabel = useLanguageLabel();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [categoryId, setCategoryId] = useState<string>(menu.categories[0]?.id ?? ALL);
  const [query, setQuery] = useState("");
  const [itemForm, setItemForm] = useState<MenuItem | "new" | null>(null);
  const [categoryForm, setCategoryForm] = useState<MenuCategory | "new" | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Role: "menu.edit" changes the menu; "menu.availability" only marks items sold out / back.
  const can = useCan();
  const edit = can("menu.edit");
  const availability = can(["menu.availability", "menu.edit"]);
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
  const canReorderItems = edit && categoryId !== ALL && !q;
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
        toast.show({ variant: "error", title: m(r.message) });
        return;
      }
      setErrors({});
      if (r.message && !quiet) toast.show({ variant: "success", title: m(r.message) });
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
          <h2 className="text-headline-md text-on-surface">{t("emptyTitle")}</h2>
          <p className="max-w-card-md text-body-md text-on-surface-variant">{t("emptyBody")}</p>
          {edit ? (
            <div className="flex flex-wrap justify-center gap-sm">
              <PrimaryButton
                icon="auto_awesome"
                disabled={pending}
                onClick={() => run(() => applyTemplateAction(slug))}
              >
                {t("startTemplate")}
              </PrimaryButton>
              <OutlineButton icon="add" onClick={() => setCategoryForm("new")}>
                {t("startEmpty")}
              </OutlineButton>
            </div>
          ) : null}
        </section>
        <CategoryDialog
          form={categoryForm}
          errors={errors}
          pending={pending}
          onClose={() => setCategoryForm(null)}
          languages={languages}
          onSubmit={(name, i18n, icon) =>
            run(
              () => saveCategoryAction(slug, null, name, true, i18n, icon),
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
          {t("notPriced", { count: notPriced })}
        </p>
      ) : null}

      {languages.others.length && menu.items.length ? (
        <div className="flex flex-wrap items-center gap-xs text-body-sm">
          <span className="flex items-center gap-xs text-on-surface-variant">
            <Icon name="translate" className="text-icon-md" /> {t("translated")}
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
            placeholder={t("search")}
            aria-label={t("searchLabel")}
            className="min-w-0 flex-1 bg-transparent text-body-md text-on-surface placeholder:text-outline focus:outline-none"
          />
        </label>
        {edit && menu.items.length < MENU_LIMITS.items ? (
          <PrimaryButton icon="add" onClick={() => setItemForm("new")}>
            {t("addItem")}
          </PrimaryButton>
        ) : null}
      </div>

      {/* Categories (drag to reorder) */}
      <div
        className="flex flex-wrap items-center gap-xs"
        role="tablist"
        aria-label={t("categories")}
      >
        <Chip
          active={categoryId === ALL}
          onClick={() => setCategoryId(ALL)}
          count={menu.items.length}
        >
          {t("allItems")}
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
                share={sales?.categoryShare[c.id]}
                draggable={edit}
                onClick={() => setCategoryId(c.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {edit && menu.categories.length < MENU_LIMITS.categories ? (
          <button
            type="button"
            onClick={() => setCategoryForm("new")}
            className="inline-flex items-center gap-xs rounded-full border border-dashed border-outline-variant px-md py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
          >
            <Icon name="add" className="text-icon-md" /> {t("categoryButton")}
          </button>
        ) : null}
      </div>

      {category ? (
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <p className="text-body-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">{category.name}</span>
            {category.isVisible ? "" : t("hiddenFromCustomers")}
            {canReorderItems && itemsOf(category.id).length > 1 ? t("dragToReorder") : ""}
          </p>
          {edit ? (
            <div className="flex flex-wrap gap-xs">
              <OutlineButton icon="edit" onClick={() => setCategoryForm(category)}>
                {tc("rename")}
              </OutlineButton>
              <OutlineButton
                icon={category.isVisible ? "visibility_off" : "visibility"}
                onClick={() =>
                  run(() =>
                    saveCategoryAction(slug, category.id, category.name, !category.isVisible),
                  )
                }
              >
                {category.isVisible ? tc("hide") : tc("show")}
              </OutlineButton>
              <OutlineButton
                icon="delete"
                tone="danger"
                onClick={() => setConfirm({ kind: "category", category })}
              >
                {tc("delete")}
              </OutlineButton>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Items */}
      {visibleItems.length === 0 && q ? (
        <p className="rounded-xl bg-surface-container-lowest p-lg text-center text-on-surface-variant">
          {t("noMatch", { query })}
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
                  sales={sales ? (sales.items[i.id] ?? null) : undefined}
                  tagList={menu.tags}
                  mainLanguage={languages.main}
                  pending={pending}
                  canEdit={edit}
                  canAvailability={availability}
                  onEdit={() => setItemForm(i)}
                  onDelete={() => setConfirm({ kind: "item", item: i })}
                  onToggleSoldOut={() => run(() => setAvailableAction(slug, i.id, !i.isAvailable))}
                />
              ))}
              {edit && menu.items.length < MENU_LIMITS.items && !q ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setItemForm("new")}
                    className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-xs rounded-xl border-2 border-dashed border-outline-variant p-lg text-on-surface-variant hover:border-primary hover:text-primary"
                  >
                    <Icon name="add_circle" className="text-icon-2xl" />
                    <span className="font-semibold">
                      {category ? t("addTo", { category: category.name }) : t("addAnItem")}
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
        onSubmit={(name, i18n, icon) => {
          const c = categoryForm !== "new" ? categoryForm : null;
          run(
            () => saveCategoryAction(slug, c?.id ?? null, name, c?.isVisible ?? true, i18n, icon),
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
        title={
          itemForm === "new"
            ? t("addAnItem")
            : itemForm
              ? t("editName", { name: itemForm.name })
              : ""
        }
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
            slug={slug}
            tagList={menu.tags}
            optionShares={itemForm !== "new" && sales ? sales.options[itemForm.id] : undefined}
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
            ? t("deleteQuestion", { name: confirm.item.name })
            : confirm
              ? t("deleteQuestion", { name: confirm.category.name })
              : ""
        }
        description={confirm?.kind === "category" ? t("deleteCategoryBody") : t("deleteItemBody")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
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
  sales,
  tagList,
  mainLanguage,
  pending,
  canEdit,
  canAvailability,
  onEdit,
  onDelete,
  onToggleSoldOut,
}: {
  item: MenuItem;
  canEdit: boolean;
  canAvailability: boolean;
  /** The café's tags (menu_tags). */
  tagList: MenuTagRow[];
  mainLanguage: string;
  currency: string;
  categoryName: string | null;
  sortable: boolean;
  /** Period sales: null = sold nothing; undefined = no statistics shown. */
  sales?: MenuSales["items"][string] | null;
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
  const t = useTranslations("menu");
  const tt = useTranslations("tags");
  const status = itemStatus(item);
  const s = STATUS[status];
  const tags = tagList.filter((tag) => item.tagIds.includes(tag.id));
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
          {t(s.label)}
        </span>
        {item.isFeatured ? (
          <span className="absolute start-sm top-sm flex items-center gap-xs rounded-full bg-surface-container-lowest px-sm py-xs text-caption font-semibold text-primary shadow-sm">
            <Icon name="star" filled className="text-icon-sm" /> {t("featured")}
          </span>
        ) : null}
        {sortable ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("reorder", { name: item.name })}
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
        {item.options.length ? (
          <p className="flex items-center gap-xs text-caption text-on-surface-variant">
            <Icon name="tune" className="text-icon-sm" />
            {t("optionsCount", { count: item.options.length })}
          </p>
        ) : null}
        {sales !== undefined ? (
          <ItemSales sales={sales} currency={currency} status={status} />
        ) : null}
        {tags.length ? (
          <ul className="flex flex-wrap gap-xs">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className={`inline-flex items-center gap-xs rounded-full bg-surface-container px-sm text-caption text-on-surface-variant ${tag.isVisible ? "" : "opacity-60"}`}
              >
                <Icon name={tag.icon} className="text-icon-sm" />{" "}
                {tagName(tag, mainLanguage, (k) => tt(k))}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-xs border-t border-surface-container-high pt-sm">
          <div className="flex gap-xs">
            {canEdit ? (
              <>
                <IconButton
                  icon="edit"
                  label={t("editName", { name: item.name })}
                  onClick={onEdit}
                />
                <IconButton
                  icon="delete"
                  label={t("deleteName", { name: item.name })}
                  onClick={onDelete}
                  tone="danger"
                />
              </>
            ) : null}
          </div>
          {canAvailability ? (
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
              {item.isAvailable ? t("markSoldOut") : t("backOnMenu")}
            </button>
          ) : null}
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
  slug,
  tagList,
  optionShares,
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
  slug: string;
  tagList: MenuTagRow[];
  optionShares?: Record<string, number>;
  errors: Record<string, string>;
  pending: boolean;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("menu");
  const tt = useTranslations("tags");
  const languageLabel = useLanguageLabel();
  const m = useMsg();
  const digits = currencyDigits(currency);
  const [tab, setTab] = useState(languages.main);
  const [options, setOptions] = useState<EditGroup[]>(() =>
    fromOptionGroups(item?.options ?? [], digits),
  );
  const [i18n, setI18n] = useState<I18nState>(() => structuredClone(item?.i18n ?? {}) as I18nState);
  // Main texts (shown as reference in the translation tabs).
  const [mainName, setMainName] = useState(item?.name ?? "");
  const [mainDesc, setMainDesc] = useState(item?.description ?? "");
  const tr = (l: string, f: string) => i18n[l]?.[f] ?? "";
  const setTr = (l: string, f: string, v: string) =>
    setI18n((x) => ({ ...x, [l]: { ...(x[l] ?? {}), [f]: v } }));
  const [image, setImage] = useState(item?.image ?? null);
  const [tags, setTags] = useState<string[]>(item?.tagIds ?? []);
  const [tagForm, setTagForm] = useState<"new" | null>(null);
  const [tagPending, startTag] = useTransition();
  const [tagErrors, setTagErrors] = useState<Record<string, string>>({});
  const toast = useToast();
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
      tag_ids: tags,
      is_available: f.get("is_available") === "on",
      is_visible: f.get("is_visible") === "on",
      is_featured: f.get("is_featured") === "on",
      i18n,
      options: toOptionGroups(options),
    });
  };
  return (
    <>
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
                {t("translationNote", {
                  language: languageLabel(l),
                  main: languageLabel(languages.main),
                })}
              </p>
              <TextField
                id={`name-${l}`}
                label={t("nameIn", { language: languageLabel(l) })}
                maxLength={80}
                dir={isRtlLanguage(l) ? "rtl" : "ltr"}
                value={tr(l, "name")}
                onChange={(e) => setTr(l, "name", e.target.value)}
                hint={mainName ? t("original", { text: mainName }) : undefined}
                error={errors.i18n}
              />
              <TextAreaField
                id={`description-${l}`}
                label={t("descriptionIn", { language: languageLabel(l) })}
                rows={3}
                maxLength={500}
                dir={isRtlLanguage(l) ? "rtl" : "ltr"}
                value={tr(l, "description")}
                onChange={(e) => setTr(l, "description", e.target.value)}
                hint={mainDesc ? t("original", { text: mainDesc }) : undefined}
              />
              <OptionsTranslation value={options} onChange={setOptions} lang={l} />
            </div>
          ) : null,
        )}
        {/* Main language: always mounted (its inputs are part of the form), hidden on other tabs. */}
        <div className="flex flex-col gap-md" hidden={tab !== languages.main}>
          <TextField
            id="name"
            label={t("name")}
            required
            maxLength={80}
            defaultValue={item?.name ?? ""}
            onChange={(e) => setMainName(e.target.value)}
            error={errors.name}
          />
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <TextField
              id="price"
              label={t("price", { currency })}
              inputMode="decimal"
              placeholder={(4.5).toFixed(digits)}
              defaultValue={
                item?.price === null || item?.price === undefined ? "" : item.price.toFixed(digits)
              }
              error={errors.price}
              hint={t("priceHint")}
            />
            <label className="flex flex-col gap-xs text-body-sm font-semibold text-on-surface">
              {t("category")}
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
            label={t("description")}
            rows={3}
            maxLength={500}
            defaultValue={item?.description ?? ""}
            error={errors.description}
            onChange={(e) => setMainDesc(e.target.value)}
          />
          <ImageField
            cafeId={cafeId}
            label={t("photo")}
            value={image}
            onChange={setImage}
            error={errors.image ?? errors.image_path}
          />
          <fieldset>
            <legend className="mb-xs text-body-sm font-semibold text-on-surface">
              {t("tags")}
            </legend>
            <div className="flex flex-wrap gap-xs">
              {tagList.map((tag) => {
                const on = tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setTags((x) => (on ? x.filter((v) => v !== tag.id) : [...x, tag.id]))
                    }
                    className={`inline-flex items-center gap-xs rounded-full border px-sm py-xs text-body-sm ${
                      on
                        ? "border-primary bg-secondary-container text-primary"
                        : "border-outline-variant text-on-surface-variant"
                    } ${tag.isVisible ? "" : "opacity-60"}`}
                  >
                    <Icon name={tag.icon} className="text-icon-md" />{" "}
                    {tagName(tag, languages.main, (k) => tt(k))}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setTagErrors({});
                  setTagForm("new");
                }}
                className="inline-flex items-center gap-xs rounded-full border border-dashed border-outline-variant px-sm py-xs text-body-sm font-semibold text-primary hover:bg-secondary-container"
              >
                <Icon name="add" className="text-icon-md" /> {t("tagNew")}
              </button>
            </div>
          </fieldset>
          <OptionsEditor
            shares={optionShares}
            value={options}
            onChange={setOptions}
            currency={currency}
            error={errors.options ? m(errors.options) : undefined}
          />
          <div className="flex flex-col gap-sm rounded-lg bg-surface-container-low p-md text-body-sm text-on-surface">
            <Check name="is_available" defaultChecked={item?.isAvailable ?? true}>
              {t("availableCheck")}
            </Check>
            <Check name="is_visible" defaultChecked={item?.isVisible ?? true}>
              {t("visibleCheck")}
            </Check>
            <Check name="is_featured" defaultChecked={item?.isFeatured ?? false}>
              {t("featuredCheck")}
            </Check>
          </div>
        </div>
        <FormButtons
          pending={pending}
          onCancel={onCancel}
          label={item ? t("save") : t("addItem")}
        />
      </form>
      <TagDialog
        form={tagForm}
        languages={languages}
        pending={tagPending}
        errors={tagErrors}
        onClose={() => setTagForm(null)}
        onSubmit={(input) =>
          startTag(async () => {
            const r = await saveTagAction(slug, null, input);
            if (!r.ok) {
              setTagErrors(r.errors ?? {});
              toast.show({ variant: "error", title: m(r.message) });
              return;
            }
            if (r.message) toast.show({ variant: "success", title: m(r.message) });
            // The new tag is selected on this item at once.
            if (r.id) setTags((x) => [...x, r.id!]);
            setTagForm(null);
          })
        }
      />
    </>
  );
}

/* ── Categories ─────────────────────────────────────────────────────────── */

/** "42 sold · 273.000 TND ▲12%", "No sale in this period" or "Sold out — 18 sold". */
function ItemSales({
  sales,
  currency,
  status,
}: {
  sales: MenuSales["items"][string] | null;
  currency: string;
  status: ReturnType<typeof itemStatus>;
}) {
  const t = useTranslations("stats.menu");
  if (!sales) {
    return status === "available" ? (
      <p className="flex items-center gap-xs text-caption text-on-surface-variant">
        <Icon name="trending_flat" className="text-icon-sm" />
        {t("noSale")}
      </p>
    ) : null;
  }
  if (status === "sold_out") {
    return (
      <p className="flex items-center gap-xs text-caption font-semibold text-on-surface">
        <Icon name="info" className="text-icon-sm" />
        {t("soldOutHint", { count: sales.sold })}
      </p>
    );
  }
  const change = sales.change === null ? null : Math.round(sales.change);
  return (
    <p className="flex flex-wrap items-center gap-x-xs text-caption text-on-surface">
      <Icon name="shopping_bag" className="text-icon-sm text-primary" />
      <span className="font-semibold">{t("sold", { count: sales.sold })}</span>
      <span className="text-on-surface-variant">·</span>
      <span dir="ltr">{formatPrice(sales.revenue, currency)}</span>
      {change !== null ? (
        <span dir="ltr" className={`font-semibold ${change >= 0 ? "text-success" : "text-error"}`}>
          {change > 0 ? "▲" : change < 0 ? "▼" : ""}
          {Math.abs(change)}%
        </span>
      ) : null}
    </p>
  );
}

function SortableChip({
  category,
  active,
  count,
  share,
  draggable,
  onClick,
}: {
  category: MenuCategory;
  active: boolean;
  count: number;
  share?: number;
  draggable: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled: !draggable,
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
        share={share}
        muted={!category.isVisible}
        dragProps={draggable ? { ...attributes, ...listeners } : undefined}
        label={category.name}
      >
        {category.icon ? <Icon name={category.icon} className="me-xs text-icon-sm" /> : null}
        {category.name}
      </Chip>
    </span>
  );
}

function Chip({
  active,
  onClick,
  count,
  share,
  muted,
  children,
  dragProps,
  label,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  /** Share of the period's sales (0–1). */
  share?: number;
  muted?: boolean;
  children: ReactNode;
  dragProps?: object;
  label?: string;
}) {
  const t = useTranslations("menu");
  const ts = useTranslations("stats.menu");
  const locale = useLocale();
  const pct = (x: number) =>
    new Intl.NumberFormat(formatLocale(locale), {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(x);
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
          aria-label={t("reorder", { name: label ?? "" })}
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
        {share ? (
          <span className="ms-xs opacity-75" title={ts("categoryShare", { share: pct(share) })}>
            · {pct(share)}
          </span>
        ) : null}
      </button>
    </span>
  );
}

export function CategoryDialog({
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
  onSubmit: (name: string, i18n: I18nState, icon: string) => void;
  languages: { main: string; others: string[] };
}) {
  const t = useTranslations("menu");
  const languageLabel = useLanguageLabel();
  const [icon, setIcon] = useState("");
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Reset the picker when the dialog opens for another category.
  const key = form === null ? null : form === "new" ? "new" : form.id;
  if (key !== shownFor) {
    setShownFor(key);
    setIcon(form && form !== "new" ? (form.icon ?? "") : "");
  }
  return (
    <Dialog
      open={form !== null}
      onClose={onClose}
      title={form === "new" ? t("addCategoryTitle") : t("renameCategory")}
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
            onSubmit(String(f.get("name") ?? ""), i18n, icon);
          }}
        >
          <TextField
            id="name"
            label={t("name")}
            required
            maxLength={60}
            placeholder={t("categoryPlaceholder")}
            defaultValue={form === "new" ? "" : form.name}
            error={errors.name}
          />
          {languages.others.map((l) => (
            <TextField
              key={l}
              id={`name-${l}`}
              label={t("nameInOptional", { language: languageLabel(l) })}
              maxLength={60}
              dir={isRtlLanguage(l) ? "rtl" : "ltr"}
              defaultValue={form === "new" ? "" : (form.i18n[l]?.name ?? "")}
            />
          ))}
          <IconPicker
            icons={CATEGORY_ICONS}
            value={icon}
            onChange={setIcon}
            label={t("categoryIcon")}
            noneLabel={t("noIcon")}
            error={errors.icon}
          />
          <FormButtons
            pending={pending}
            onCancel={onClose}
            label={form === "new" ? t("addCategory") : t("save")}
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
  const t = useTranslations("menu");
  const languageLabel = useLanguageLabel();
  return (
    <div
      role="tablist"
      aria-label={t("language")}
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
            <span className="opacity-75">{t("main")}</span>
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
  const tc = useTranslations("common");
  return (
    <div className="mt-xs flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-xl px-lg py-sm font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
      >
        {tc("cancel")}
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
