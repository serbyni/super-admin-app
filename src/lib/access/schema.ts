import { z } from "zod";

const num = z.coerce.number();

/** get_my_access: the signed-in member's role, shift state and permissions in a café. */
export const accessSchema = z.object({
  roleId: z.string().nullable(),
  roleKey: z.string().nullable(),
  roleName: z.string().nullable(),
  isOwner: z.boolean(),
  access: z.enum(["always", "shifts"]).catch("always"),
  onShift: z.boolean(),
  nextShift: z
    .object({ name: z.string(), inDays: num, day: num, starts: z.string() })
    .nullable()
    .catch(null),
  permissions: z.array(z.string()),
});
export type Access = z.infer<typeof accessSchema>;

export const roleSchema = z.object({
  id: z.string(),
  key: z.enum(["owner", "manager", "waiter"]).nullable().catch(null),
  name: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  isLocked: z.boolean(),
  sortOrder: num,
  memberCount: num,
});
export type Role = z.infer<typeof roleSchema>;

export const shiftSchema = z.object({
  id: z.string(),
  name: z.string(),
  days: z.array(num),
  starts: z.string(),
  ends: z.string(),
  sortOrder: num,
  memberCount: num,
});
export type Shift = z.infer<typeof shiftSchema>;

/** Role editor form (checked again in SQL). */
export const roleFormSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200),
  permissions: z.array(z.string()).max(40),
});

/** Shift editor form. */
export const shiftFormSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    starts: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    ends: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine((s) => s.starts !== s.ends, { path: ["ends"], message: "Start and end must differ" });

/** "Mon–Sat" style label from day numbers (0 = Monday) and day names. */
export function daysLabel(
  days: readonly number[],
  names: readonly string[],
  every: string,
): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 7) return every;
  const runs: number[][] = [];
  for (const x of d) {
    const last = runs.at(-1);
    if (last && x === last[last.length - 1] + 1) last.push(x);
    else runs.push([x]);
  }
  return runs
    .map((r) =>
      r.length >= 3
        ? `${names[r[0]]}–${names[r[r.length - 1]]}`
        : r.map((x) => names[x]).join(", "),
    )
    .join(", ");
}
