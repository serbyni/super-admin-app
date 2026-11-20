import "server-only";
import { boardSchema, type Board, type OrderStatus } from "@/lib/orders/schema";
import { unwrap } from "../errors";
import type { LazyDb } from "../types";

/**
 * Orders of the owner's café (every SQL function checks membership). Errors: DataError
 * "forbidden" | "invalid_status" (move not allowed, e.g. already served) | "invalid_input".
 */
export class OrdersService {
  constructor(private readonly db: LazyDb) {}

  /** Open orders ('active') or every order of one day ('day', yyyy-mm-dd, café time). */
  async board(slug: string, scope: "active" | "day", day?: string): Promise<Board> {
    const raw = unwrap(
      "get_my_orders",
      await (
        await this.db()
      ).rpc("get_my_orders", { p_slug: slug, p_scope: scope, p_day: day ?? null }),
    );
    return boardSchema.parse(raw);
  }

  async setStatus(slug: string, id: string, status: OrderStatus, reason = ""): Promise<void> {
    unwrap(
      "set_my_order_status",
      await (
        await this.db()
      ).rpc("set_my_order_status", { p_slug: slug, p_id: id, p_status: status, p_reason: reason }),
    );
  }

  async setPaid(slug: string, id: string, paid: boolean): Promise<void> {
    unwrap(
      "set_my_order_paid",
      await (await this.db()).rpc("set_my_order_paid", { p_slug: slug, p_id: id, p_paid: paid }),
    );
  }

  async setAccepting(slug: string, on: boolean): Promise<void> {
    unwrap(
      "set_my_accepting_orders",
      await (await this.db()).rpc("set_my_accepting_orders", { p_slug: slug, p_on: on }),
    );
  }
}
