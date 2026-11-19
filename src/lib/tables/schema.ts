import { z } from "zod";

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
  name: z.string().trim().min(1, "Enter a name").max(40, "At most 40 characters"),
  width_m: z.coerce
    .number({ error: "Enter a number" })
    .min(3, "At least 3 m")
    .max(60, "At most 60 m"),
  depth_m: z.coerce
    .number({ error: "Enter a number" })
    .min(3, "At least 3 m")
    .max(60, "At most 60 m"),
});

/** Table form. */
export const tableSchema = z.object({
  area_id: z.uuid("Choose an area"),
  label: z.string().trim().min(1, "Enter a name, e.g. T1").max(20, "At most 20 characters"),
  seats: z.coerce
    .number({ error: "Enter a number" })
    .int()
    .min(1, "At least 1")
    .max(20, "At most 20"),
  shape: z.enum(SHAPES, { error: "Choose a shape" }),
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
