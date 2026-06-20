/** Atto-scale (10^18) money helpers. All display goes through these so rounding is uniform. */

const ATTO = 10n ** 18n;
const SYMBOL = process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN";

/** Format atto bigint as a fixed-decimal GEN string (no symbol). */
export function formatAtto(atto: bigint, decimals = 2): string {
  const negative = atto < 0n;
  const abs = negative ? -atto : atto;
  const whole = abs / ATTO;
  const sign = negative ? "-" : "";
  if (decimals <= 0) return `${sign}${whole.toString()}`;
  const scale = 10n ** BigInt(decimals);
  const frac = ((abs % ATTO) * scale) / ATTO;
  return `${sign}${whole.toString()}.${frac.toString().padStart(decimals, "0")}`;
}

/** Format atto bigint with the token symbol, e.g. "12.50 GEN". */
export function formatGen(atto: bigint, decimals = 2): string {
  return `${formatAtto(atto, decimals)} ${SYMBOL}`;
}

/** Compact display for large volumes, e.g. "1.2K GEN", "3.4M GEN". */
export function formatGenCompact(atto: bigint): string {
  const whole = atto / ATTO;
  const n = Number(whole);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${SYMBOL}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K ${SYMBOL}`;
  return `${formatAtto(atto, 2)} ${SYMBOL}`;
}

/**
 * Parse a user-entered GEN amount (decimal string) into atto bigint, without float error.
 * Returns null for invalid / non-positive input.
 */
export function parseGenToAtto(input: string): bigint | null {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  const [wholePart, fracPart = ""] = trimmed.split(".");
  const fracPadded = (fracPart + "0".repeat(18)).slice(0, 18);
  try {
    const atto = BigInt(wholePart || "0") * ATTO + BigInt(fracPadded || "0");
    return atto > 0n ? atto : null;
  } catch {
    return null;
  }
}

/** Basis points (0..10000) -> percent string, e.g. 6234 -> "62.3%". */
export function bpsToPercent(bps: number, decimals = 1): string {
  return `${(bps / 100).toFixed(decimals)}%`;
}

export const TOKEN_SYMBOL = SYMBOL;
