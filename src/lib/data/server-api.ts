import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminsService } from "./services/admins";
import { AuthService } from "./services/auth";
import { BusinessTypesService } from "./services/business-types";
import { NotificationsService } from "./services/notifications";
import { OwnersService } from "./services/owners";
import { UsersService } from "./services/users";
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
  }
}

/**
 * The ServerApi of the CURRENT request. React `cache` memoizes it per request, so every call in
 * one render/action shares one client — and two users never share one. Never store the result
 * in a module-level variable.
 */
export const serverApi = cache((): ServerApi => new ServerApi(createClient));
