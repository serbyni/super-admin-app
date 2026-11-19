import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Domain error codes raised by our SQL functions (`raise exception '<code>'`) or mapped from
 * Postgres codes. Callers switch on `code` instead of parsing messages.
 */
export const DATA_ERROR_CODES = [
  "not_authenticated",
  "forbidden",
  "conflict", // unique violation (23505)
  "in_use",
  "stale_list",
  "profile_already_completed",
  "invalid_location",
  "invalid_status", // e.g. approving an application that is no longer pending
  "invalid_reason",
  "invalid_input", // bad field value — the field name is in the Postgres DETAIL (inputField())
  "unknown",
] as const;

export type DataErrorCode = (typeof DATA_ERROR_CODES)[number];

export class DataError extends Error {
  constructor(
    readonly code: DataErrorCode,
    readonly operation: string,
    options?: { cause?: unknown },
  ) {
    super(`${operation}: ${code}`, options);
    this.name = "DataError";
  }
}

export function isDataError(e: unknown, code?: DataErrorCode): e is DataError {
  return e instanceof DataError && (code === undefined || e.code === code);
}

/** Map a PostgREST error onto a domain code. */
export function toDataErrorCode(error: Pick<PostgrestError, "code" | "message">): DataErrorCode {
  if (error.code === "23505") return "conflict";
  const known = DATA_ERROR_CODES.find((c) => c !== "unknown" && error.message?.includes(c));
  return known ?? "unknown";
}

/**
 * Return `data`, or throw a DataError (logged once, here, with the operation name).
 * PostgREST types `data` as `T | null`; it is only null together with an error (or for
 * functions returning void), so the success value is returned as `T`.
 */
export function unwrap<T>(
  operation: string,
  result: { data: T | null; error: PostgrestError | null },
): T {
  if (result.error) {
    const code = toDataErrorCode(result.error);
    if (code === "unknown") {
      console.error(`[data] ${operation} failed`, {
        code: result.error.code,
        message: result.error.message,
      });
    }
    throw new DataError(code, operation, { cause: result.error });
  }
  return result.data as T;
}

/** Field rejected by the database for a DataError("invalid_input") (Postgres DETAIL), or null. */
export function inputField(e: unknown): string | null {
  if (!isDataError(e, "invalid_input")) return null;
  const details = (e.cause as { details?: unknown } | undefined)?.details;
  return typeof details === "string" && /^[a-z_]{1,40}$/.test(details) ? details : null;
}
