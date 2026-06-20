/**
 * Defensive decoding for values returned by `genlayer-js` `readContract`.
 *
 * GenLayer calldata decodes Python `dict` -> JS `Map`, `list` -> `Array`, and leaves
 * scalars as primitives. The PredictaMarket contract deliberately returns atto-scale
 * money as decimal *strings* (to survive JSON/bigint round-trips), and counts/bps as
 * ints. Every value below is coerced strictly so a malformed or missing field can never
 * crash a view — it degrades to a safe default instead.
 */

/** Recursively turn nested `Map`s into plain objects; arrays/scalars pass through. */
export function deepDecode(value: unknown): unknown {
  if (value instanceof Map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) obj[String(k)] = deepDecode(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(deepDecode);
  return value;
}

/** Decode a contract value that is expected to be a record (`dict`). */
export function asRecord(value: unknown): Record<string, unknown> {
  const decoded = deepDecode(value);
  if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
    return decoded as Record<string, unknown>;
  }
  return {};
}

/** Decode a contract value that is expected to be a list of records. */
export function asRecordList(value: unknown): Record<string, unknown>[] {
  const decoded = deepDecode(value);
  if (!Array.isArray(decoded)) return [];
  return decoded.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
  );
}

export function asString(v: unknown, fallback = ""): string {
  if (v === null || v === undefined) return fallback;
  return typeof v === "string" ? v : String(v);
}

/** Strict atto-scale cast. Accepts string | number | bigint; never throws. */
export function asBigInt(v: unknown, fallback = 0n): bigint {
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return Number.isFinite(v) ? BigInt(Math.trunc(v)) : fallback;
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return fallback;
      // Tolerate a stray decimal point on a value that should be integer atto.
      return BigInt(t.includes(".") ? t.slice(0, t.indexOf(".")) : t);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function asInt(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : fallback;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }
  return fallback;
}

export function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === 1n;
}
