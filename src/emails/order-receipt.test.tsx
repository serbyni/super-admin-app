import { describe, expect, it } from "vitest";
import { renderReceipt, type ReceiptData } from "./order-receipt";

const data: ReceiptData = {
  number: 12,
  kind: "table",
  tableLabel: "T4",
  customerName: "",
  subtotal: 14.5,
  currency: "TND",
  isPaid: false,
  locale: "fr",
  createdAt: "2026-11-20T15:30:00Z",
  items: [
    {
      name: "Latte",
      quantity: 2,
      lineTotal: 12,
      note: "bien chaud",
      options: [{ choice: "Grand" }, { choice: "Crème" }],
    },
    { name: "Croissant <b>", quantity: 1, lineTotal: 2.5, note: "", options: [] },
  ],
  cafe: { name: "Lune Bleue", timezone: "Africa/Tunis" },
  orderUrl: "https://lune.dev.serbi.me/order/abc",
  siteUrl: "https://dev.serbi.me",
};

describe("order receipt e-mail", () => {
  it("renders the lines, total and link in the customer's language", async () => {
    const r = await renderReceipt(data);
    expect(r.subject).toBe("Votre reçu — Lune Bleue n°12");
    expect(r.text).toContain("2 × Latte");
    expect(r.text).toContain("Grand, Crème");
    expect(r.text).toContain("14.500 TND");
    expect(r.text).toContain("À régler au comptoir.");
    expect(r.html).toContain("https://lune.dev.serbi.me/order/abc");
    expect(r.html).not.toContain("<b>"); // customer/menu text escaped
  });

  it("is right-to-left in Arabic, English for other languages", async () => {
    expect((await renderReceipt({ ...data, locale: "ar" })).html).toContain('dir="rtl"');
    expect((await renderReceipt({ ...data, locale: "it" })).subject).toBe(
      "Your receipt — Lune Bleue #12",
    );
  });
});
