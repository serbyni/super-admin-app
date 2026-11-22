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
  const owner = (status: string, cafe_slug: string | null = null) =>
    auth({
      is_platform_admin: { data: false, error: null },
      get_my_owner: { data: [{ status, cafe_slug }], error: null },
    });

  it("sends super admins to /admin, or to the requested admin page", async () => {
    const a = auth({ is_platform_admin: { data: true, error: null } });
    expect(await a.homePath()).toBe("/admin");
    expect(await a.homePath("/admin/business")).toBe("/admin/business");
    // next outside the admin area (or unsafe) is ignored
    expect(await a.homePath("/kafe/dashboard")).toBe("/admin");
    expect(await a.homePath("//evil.example")).toBe("/admin");
  });

  it("sends owners to the page for their status", async () => {
    expect(await owner("profile_incomplete").homePath()).toBe("/register/complete");
    expect(await owner("email_unverified").homePath()).toBe("/register/check-email");
    expect(await owner("pending_approval").homePath()).toBe("/pending");
    expect(await owner("rejected").homePath()).toBe("/pending");
    expect(await owner("approved").homePath()).toBe("/onboarding");
    expect(await owner("onboarding").homePath()).toBe("/onboarding");
    expect(await owner("active").homePath()).toBe("/onboarding"); // no café slug yet
  });

  it("sends active owners to their café dashboard (and only their café)", async () => {
    const o = owner("active", "artisan-brew");
    expect(await o.homePath()).toBe("/artisan-brew/dashboard");
    expect(await o.homePath("/artisan-brew/dashboard/menu")).toBe("/artisan-brew/dashboard/menu");
    expect(await o.homePath("/other-cafe/dashboard")).toBe("/artisan-brew/dashboard");
    expect(await o.homePath("/admin")).toBe("/artisan-brew/dashboard");
  });

  it("sends a signed-in user without owner account to complete the profile", async () => {
    const a = auth({
      is_platform_admin: { data: false, error: null },
      get_my_owner: { data: [], error: null },
      get_my_cafe_slugs: { data: [], error: null },
    });
    expect(await a.homePath()).toBe("/register/complete");
  });

  it("sends staff (member, no owner account) to their café", async () => {
    const a = auth({
      is_platform_admin: { data: false, error: null },
      get_my_owner: { data: [], error: null },
      get_my_cafe_slugs: { data: ["artisan-brew"], error: null },
    });
    expect(await a.homePath()).toBe("/artisan-brew/dashboard");
    expect(await a.homePath("/artisan-brew/dashboard/orders")).toBe(
      "/artisan-brew/dashboard/orders",
    );
    expect(await a.homePath("/other/dashboard")).toBe("/artisan-brew/dashboard");
  });
});

describe("AuthService.isUnregisteredOAuthUser", () => {
  const user = (provider: string, identities: string[]) =>
    ({ app_metadata: { provider }, identities: identities.map((p) => ({ provider: p })) }) as never;
  function auth(isAdmin: boolean, owner: { status: string } | null) {
    const { lazy } = fakeDb({
      is_platform_admin: { data: isAdmin, error: null },
      get_my_owner: { data: owner ? [{ ...owner, cafe_slug: null }] : [], error: null },
    });
    return new AuthService(lazy, new AdminsService(lazy), new OwnersService(lazy));
  }

  it("refuses a fresh Google/Facebook account without registration", async () => {
    expect(await auth(false, null).isUnregisteredOAuthUser(user("google", ["google"]))).toBe(true);
    expect(
      await auth(false, { status: "profile_incomplete" }).isUnregisteredOAuthUser(
        user("facebook", ["facebook"]),
      ),
    ).toBe(true);
  });

  it("lets registered owners, linked email accounts and admins sign in with a provider", async () => {
    expect(
      await auth(false, { status: "pending_approval" }).isUnregisteredOAuthUser(
        user("google", ["google"]),
      ),
    ).toBe(false);
    expect(
      await auth(false, null).isUnregisteredOAuthUser(user("email", ["email", "google"])),
    ).toBe(false);
    expect(await auth(true, null).isUnregisteredOAuthUser(user("google", ["google"]))).toBe(false);
  });
});
