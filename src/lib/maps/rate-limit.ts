import "server-only";

type Bucket = { tokens: number; updated: number };
const buckets = new Map<string, Bucket>();

/**
 * Small in-memory token bucket per key (e.g. "autocomplete:<ip>").
 * Good for a single server instance; move to a shared store (e.g. Redis) when scaling out.
 */
export function rateLimit(key: string, perMinute: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, updated: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.updated) / 60_000) * perMinute);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 10_000) buckets.clear(); // crude memory bound
  return true;
}
