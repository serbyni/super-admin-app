import { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { DataError, isDataError, toDataErrorCode, unwrap } from "./errors";

const pgError = (code: string, message: string) =>
  new PostgrestError({ code, message, details: "", hint: "" });

describe("data errors", () => {
  it("maps unique violations to conflict", () => {
    expect(toDataErrorCode({ code: "23505", message: "duplicate key" })).toBe("conflict");
  });

  it("maps codes raised by our SQL functions", () => {
    expect(toDataErrorCode({ code: "P0001", message: "in_use" })).toBe("in_use");
    expect(toDataErrorCode({ code: "P0001", message: "stale_list" })).toBe("stale_list");
    expect(toDataErrorCode({ code: "42501", message: "forbidden" })).toBe("forbidden");
    expect(toDataErrorCode({ code: "XX000", message: "boom" })).toBe("unknown");
  });

  it("unwrap returns data on success", () => {
    expect(unwrap("op", { data: [1, 2], error: null })).toEqual([1, 2]);
  });

  it("unwrap throws a DataError with the operation and code", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      unwrap("admin_delete_business_type", { data: null, error: pgError("P0001", "in_use") });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DataError);
      expect(isDataError(e, "in_use")).toBe(true);
      expect((e as DataError).operation).toBe("admin_delete_business_type");
    }
  });

  it("logs only unknown failures", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => unwrap("x", { data: null, error: pgError("P0001", "forbidden") })).toThrow();
    expect(log).not.toHaveBeenCalled();
    expect(() => unwrap("x", { data: null, error: pgError("XX000", "boom") })).toThrow();
    expect(log).toHaveBeenCalledOnce();
  });
});
