import { PostgrestError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag, cacheTag: vi.fn(), cacheLife: vi.fn() }));

const { BusinessTypesService, BUSINESS_TYPES_TAG } = await import("./business-types");
const { AdminsService } = await import("./admins");
const { OwnersService } = await import("./owners");
const { AuthService } = await import("./auth");
const { isDataError } = await import("../errors");

type RpcResult = { data: unknown; error: PostgrestError | null };

/** Minimal fake of the typed Supabase client: records rpc calls, returns queued results. */
function fakeDb(results: Record<string, RpcResult>) {
  const rpc = vi.fn(async (fn: string) => results[fn] ?? { data: null, error: null });
  const db = { rpc } as never;
  const lazy = vi.fn(async () => db);
  return { rpc, lazy };
}

const pgError = (message: string, code = "P0001") =>
  new PostgrestError({ code, message, details: "", hint: "" });

beforeEach(() => updateTag.mockClear());

describe("BusinessTypesService", () => {
  it("maps adminSave input to the SQL arguments and refreshes the cache", async () => {
    const { rpc, lazy } = fakeDb({ admin_save_business_type: { data: "id-1", error: null } });
    const id = await new BusinessTypesService(lazy).adminSave({
      id: null,
      slug: "food_truck",
      name: { en: "Food truck", fr: "Food truck" },
      icon: "local_shipping",
      isActive: true,
    });
    expect(id).toBe("id-1");
    expect(rpc).toHaveBeenCalledWith("admin_save_business_type", {
      p_id: null,
      p_slug: "food_truck",
      p_name: { en: "Food truck", fr: "Food truck" },
      p_icon: "local_shipping",
      p_is_active: true,
    });
    expect(updateTag).toHaveBeenCalledWith(BUSINESS_TYPES_TAG);
  });

  it("turns SQL errors into DataError codes and does not refresh the cache", async () => {
    const { lazy } = fakeDb({
      admin_delete_business_type: { data: null, error: pgError("in_use") },
    });
    const err = await new BusinessTypesService(lazy).adminDelete("x").catch((e) => e);
    expect(isDataError(err, "in_use")).toBe(true);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("creates the client lazily, only when a query needs it", async () => {
    const { lazy } = fakeDb({});
    const svc = new BusinessTypesService(lazy);
    expect(lazy).not.toHaveBeenCalled();
    await svc.adminReorder(["a", "b"]);
    expect(lazy).toHaveBeenCalledOnce();
  });
});

describe("AuthService.homePath", () => {
  function auth(results: Record<string, RpcResult>) {
    const { lazy } = fakeDb(results);
    return new AuthService(lazy, new AdminsService(lazy), new OwnersService(lazy));
  }

  it("sends super admins to the admin path (or the requested next)", async () => {
    const a = auth({ is_platform_admin: { data: true, error: null } });
    expect(await a.homePath()).toBe("/admin");
    expect(await a.homePath("/admin/business")).toBe("/admin/business");
  });

  it("sends owners by status", async () => {
    const owner = (status: string) =>
      auth({
        is_platform_admin: { data: false, error: null },
        get_my_owner_status: { data: status, error: null },
      });
    expect(await owner("profile_incomplete").homePath()).toBe("/register/complete");
    expect(await owner("email_unverified").homePath()).toBe("/register/check-email");
    expect(await owner("pending_approval").homePath()).toBe("/pending");
    expect(await owner("something_else").homePath()).toBe("/login");
  });
});
