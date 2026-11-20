import { z } from "zod";
import { msg } from "@/i18n/msg";

/* Tables & QR codes: shapes, form rules and the floor data returned by get_my_floor. */

export const TABLE_SHAPES = [
  { value: "square", label: "Square", icon: "crop_square" },
  { value: "round", label: "Round", icon: "circle" },
  { value: "rect", label: "Long", icon: "rectangle" },
  { value: "bar", label: "Bar / high", icon: "table_bar" },
] as const;
export type TableShape = (typeof TABLE_SHAPES)[number]["value"];
const SHAPES = TABLE_SHAPES.map((s) => s.value) as [TableShape, ...TableShape[]];

export const LIMITS = { areas: 20, tables: 200 } as const;

/** Area form (sizes in metres). */
export const areaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, msg("enterName"))
    .max(40, msg("maxChars", { max: 40 })),
  width_m: z.coerce
    .number({ error: msg("enterNumber") })
    .min(3, msg("minMetres", { min: 3 }))
    .max(60, msg("maxMetres", { max: 60 })),
  depth_m: z.coerce
    .number({ error: msg("enterNumber") })
    .min(3, msg("minMetres", { min: 3 }))
    .max(60, msg("maxMetres", { max: 60 })),
});

/** Table form. */
export const tableSchema = z.object({
  area_id: z.uuid(msg("chooseArea")),
  label: z
    .string()
    .trim()
    .min(1, msg("enterTableName"))
    .max(20, msg("maxChars", { max: 20 })),
  seats: z.coerce
    .number({ error: msg("enterNumber") })
    .int()
    .min(1, msg("minNumber", { min: 1 }))
    .max(20, msg("maxNumber", { max: 20 })),
  shape: z.enum(SHAPES, { error: msg("chooseShape") }),
  is_active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

const num = z.coerce.number();
export const floorSchema = z.object({
  menu: z.object({ code: z.string(), scans30d: num }),
  areas: z.array(
    z.object({ id: z.string(), name: z.string(), sortOrder: num, widthM: num, depthM: num }),
  ),
  tables: z.array(
    z.object({
      id: z.string(),
      areaId: z.string(),
      label: z.string(),
      seats: num,
      shape: z.enum(SHAPES),
      x: num,
      y: num,
      rotation: num,
      isActive: z.boolean(),
      code: z.string().nullable(),
      scans30d: num,
    }),
  ),
});
export type Floor = z.infer<typeof floorSchema>;
export type Area = Floor["areas"][number];
export type CafeTable = Floor["tables"][number];

/** Short QR code: 6 chars without look-alikes (same rule as the database). */
export const QR_CODE = /^[A-HJKMNP-Z2-9]{6}$/;

/** Next free label "T<n>" for a new table. */
export function nextTableLabel(tables: Pick<CafeTable, "label">[]): string {
  const used = new Set(tables.map((t) => t.label.toUpperCase()));
  for (let n = tables.length + 1; ; n++) if (!used.has(`T${n}`)) return `T${n}`;
}
