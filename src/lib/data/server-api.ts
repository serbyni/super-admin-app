import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminsService } from "./services/admins";
import { AuthService } from "./services/auth";
import { BusinessTypesService } from "./services/business-types";
import { CafesService } from "./services/cafes";
import { NotificationsService } from "./services/notifications";
import { OnboardingService } from "./services/onboarding";
import { OwnersService } from "./services/owners";
import { UsersService } from "./services/users";
import { WebsiteService } from "./services/website";
import type { Db, LazyDb } from "./types";

/** All server-side data services, sharing one Supabase client (one user session). */
export class ServerApi {
  readonly admins: AdminsService;
  readonly owners: OwnersService;
  readonly businessTypes: BusinessTypesService;
  readonly auth: AuthService;
  /** Super-admin user management (applications). */
  readonly users: UsersService;
  readonly notifications: NotificationsService;
  readonly onboarding: OnboardingService;
  /** Cafés (tenants): own café via RLS; super-admin list/detail. */
  readonly cafes: CafesService;
  /** Café website (draft/publish), owner only. */
  readonly website: WebsiteService;

  constructor(createDb: () => Promise<Db>) {
    // One client per ServerApi, created on first use: pages that only need cached public data
    // (e.g. businessTypes.listActive) never read cookies and stay prerenderable.
    let client: Promise<Db> | undefined;
    const db: LazyDb = () => (client ??= createDb());
    this.admins = new AdminsService(db);
    this.owners = new OwnersService(db);
    this.businessTypes = new BusinessTypesService(db);
    this.auth = new AuthService(db, this.admins, this.owners);
    this.users = new UsersService(db);
    this.notifications = new NotificationsService(db);
    this.onboarding = new OnboardingService(db);
    this.cafes = new CafesService(db);
    this.website = new WebsiteService(db);
  }
}

/**
 * The ServerApi of the CURRENT request. React `cache` memoizes it per request, so every call in
 * one render/action shares one client — and two users never share one. Never store the result
 * in a module-level variable.
 */
export const serverApi = cache((): ServerApi => new ServerApi(createClient));
