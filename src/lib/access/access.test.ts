import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { can, defineAbility } from "./ability";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  implied,
  requiredBy,
  sectionHref,
  togglePermission,
  visibleSections,
  withImplied,
} from "./permissions";
import { daysLabel, shiftFormSchema } from "./schema";

describe("permission catalogue", () => {
  it("is the same list as platform.permission_keys() in SQL", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261122183728_access_control.sql"),
      "utf8",
    );
    const body = sql.slice(sql.indexOf("platform.permission_keys()"), sql.indexOf("$$;"));
    const keys = [...body.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1]);
    expect(keys).toEqual([...PERMISSIONS]);
  });

  it("groups every grantable permission once (staff.manage is owner only)", () => {
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.permissions);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped).not.toContain("staff.manage");
    expect(grouped.length).toBe(PERMISSIONS.length - 1);
  });
});

describe("implied permissions", () => {
  it("edit-like actions need their section's read; publish needs edit", () => {
    expect(implied("menu.edit")).toEqual(["menu.read"]);
    expect(implied("menu.read")).toEqual([]);
    expect(implied("settings.hours")).toEqual([]); // Settings has no read
    expect(implied("website.publish").sort()).toEqual(["website.edit", "website.read"]);
  });

  it("withImplied adds needs, drops unknown keys and never grants staff.manage", () => {
    expect(withImplied(["orders.handle", "nope", "staff.manage"])).toEqual([
      "orders.read",
      "orders.handle",
    ]);
    expect(withImplied(["website.publish"])).toEqual([
      "website.read",
      "website.edit",
      "website.publish",
    ]);
  });

  it("toggling off a need also removes what needs it", () => {
    const all = withImplied(["website.publish", "menu.edit"]);
    expect(togglePermission(all, "website.read", false)).toEqual(["menu.read", "menu.edit"]);
    expect(togglePermission(all, "website.edit", false)).toEqual([
      "menu.read",
      "menu.edit",
      "website.read",
    ]);
    expect(togglePermission([], "tables.qr", true)).toEqual(["tables.read", "tables.qr"]);
  });

  it("knows which permissions are locked on by another", () => {
    const list = withImplied(["menu.availability"]);
    expect(requiredBy(list, "menu.read")).toBe(true);
    expect(requiredBy(list, "menu.availability")).toBe(false);
  });
});

describe("ability (CASL)", () => {
  it("allows exactly the listed permissions; arrays mean any of", () => {
    const a = defineAbility(["orders.read", "orders.handle", "menu.availability", "junk.key"]);
    expect(can(a, "orders.handle")).toBe(true);
    expect(can(a, "menu.edit")).toBe(false);
    expect(can(a, ["menu.availability", "menu.edit"])).toBe(true);
    expect(can(a, "settings.cafe")).toBe(false);
    expect(can(defineAbility([]), "dashboard.read")).toBe(false);
  });
});

describe("sections", () => {
  it("shows sections the role can read; Settings (profile) always", () => {
    expect(visibleSections(["orders.read", "menu.read"])).toEqual(["menu", "orders", "settings"]);
    expect(visibleSections([...PERMISSIONS])).toEqual([
      "dashboard",
      "website",
      "menu",
      "tables",
      "orders",
      "staff",
      "settings",
    ]);
    expect(visibleSections([])).toEqual(["settings"]);
  });

  it("links sections under the dashboard", () => {
    expect(sectionHref("/cafe/dashboard", "dashboard")).toBe("/cafe/dashboard");
    expect(sectionHref("/cafe/dashboard/", "orders")).toBe("/cafe/dashboard/orders");
  });
});

describe("shifts", () => {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  it("labels days as ranges", () => {
    expect(daysLabel([0, 1, 2, 3, 4, 5], names, "Every day")).toBe("Mon–Sat");
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6], names, "Every day")).toBe("Every day");
    expect(daysLabel([4, 0, 5], names, "Every day")).toBe("Mon, Fri, Sat");
    expect(daysLabel([0, 2, 3, 4], names, "Every day")).toBe("Mon, Wed–Fri");
  });

  it("validates the form (overnight allowed, start ≠ end)", () => {
    const ok = { name: "Soir", days: [4, 5], starts: "18:00", ends: "02:00" };
    expect(shiftFormSchema.safeParse(ok).success).toBe(true);
    expect(shiftFormSchema.safeParse({ ...ok, ends: "18:00" }).success).toBe(false);
    expect(shiftFormSchema.safeParse({ ...ok, days: [] }).success).toBe(false);
    expect(shiftFormSchema.safeParse({ ...ok, starts: "24:00" }).success).toBe(false);
  });
});
