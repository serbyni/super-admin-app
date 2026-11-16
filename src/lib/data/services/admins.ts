import "server-only";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

export class AdminsService {
  constructor(private readonly db: LazyDb) {}

  /** True when the signed-in user is a platform super admin. */
  async isPlatformAdmin(): Promise<boolean> {
    return unwrap("is_platform_admin", await (await this.db()).rpc("is_platform_admin")) === true;
  }
}
