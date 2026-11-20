import { describe, expect, it } from "vitest";
import { newOrderPush, orderUpdatePush } from "./texts";

const cafe = { name: "Lune Bleue" };
const base = { number: 12, kind: "table", tableLabel: "T4", customerName: "", reason: "" };

describe("push texts", () => {
  it("tells the owner about a new order in their language", () => {
    const p = newOrderPush(
      {
        number: 12,
        kind: "table",
        tableLabel: "T4",
        customerName: "",
        subtotal: 14.5,
        currency: "TND",
      },
      cafe,
      "fr",
      "https://x/orders",
    );
    expect(p.title).toBe("Nouvelle commande n°12");
    expect(p.body).toBe("Table T4 · 14.500 TND");
    expect(p.requireInteraction).toBe(true);
  });

  it("tells the customer every step, with the reason when declined", () => {
    expect(orderUpdatePush({ ...base, status: "new" }, cafe, "en", "u")).toBeNull();
    expect(orderUpdatePush({ ...base, status: "ready" }, cafe, "en", "u")?.body).toBe(
      "Your order is ready — it's coming to table T4.",
    );
    const d = orderUpdatePush(
      { ...base, status: "declined", reason: "Plus de croissants" },
      cafe,
      "ar",
      "u",
    );
    expect(d?.title).toBe("Lune Bleue — الطلب رقم 12");
    expect(d?.body).toBe("رفض المقهى طلبك. السبب: Plus de croissants");
  });

  it("falls back to English for other languages", () => {
    expect(orderUpdatePush({ ...base, status: "accepted" }, cafe, "it", "u")?.body).toBe(
      "The café accepted your order.",
    );
  });
});
