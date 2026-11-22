import { describe, expect, it } from "vitest";
import { currencyDigits, formatPrice, itemSchema, itemStatus, parsePrice } from "./schema";

const form = (price: string) => ({
  category_id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
  name: "Latte",
  description: "",
  price,
  image_path: "",
  image_alt: "",
  tag_ids: [],
  is_available: true,
  is_visible: true,
  is_featured: false,
});

describe("menu prices", () => {
  it("knows currency decimals and formats deterministically", () => {
    expect(currencyDigits("TND")).toBe(3);
    expect(currencyDigits("eur")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(formatPrice(4.5, "TND")).toBe("4.500 TND");
    expect(formatPrice(3.2, "EUR")).toBe("3.20 EUR");
  });

  it("parses typed prices", () => {
    expect(parsePrice(" 4,5 ")).toBe(4.5);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNaN();
    expect(parsePrice("-1")).toBeNaN();
  });

  it("checks decimals against the café currency", () => {
    expect(itemSchema("TND").safeParse(form("4.500")).success).toBe(true);
    expect(itemSchema("EUR").safeParse(form("4.505")).success).toBe(false);
    expect(itemSchema("JPY").safeParse(form("450")).success).toBe(true);
    expect(itemSchema("JPY").safeParse(form("4.5")).success).toBe(false);
    expect(itemSchema("EUR").parse(form("")).price).toBeNull();
  });

  it("tells what customers see", () => {
    expect(itemStatus({ isVisible: false, price: 3, isAvailable: true })).toBe("hidden");
    expect(itemStatus({ isVisible: true, price: null, isAvailable: true })).toBe("no_price");
    expect(itemStatus({ isVisible: true, price: 3, isAvailable: false })).toBe("sold_out");
    expect(itemStatus({ isVisible: true, price: 3, isAvailable: true })).toBe("available");
  });
});
