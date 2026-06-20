/**
 * Client-side mirror of the contract's `quote_bet` parimutuel math (integer bigint, so it
 * matches on-chain settlement exactly). Used for instant feedback in the bet panel without
 * a round-trip per keystroke; the contract remains the source of truth at execution time.
 */
export interface LocalQuote {
  payoutAtto: bigint;
  profitAtto: bigint;
  roiBps: number;
  multiplierBps: number;
}

export function quoteBetLocal(
  sidePoolAtto: bigint,
  otherPoolAtto: bigint,
  amountAtto: bigint
): LocalQuote {
  if (amountAtto <= 0n) {
    return { payoutAtto: 0n, profitAtto: 0n, roiBps: 0, multiplierBps: 0 };
  }
  const total = sidePoolAtto + otherPoolAtto;
  const newSide = sidePoolAtto + amountAtto;
  const newTotal = total + amountAtto;
  const payout = newSide > 0n ? (amountAtto * newTotal) / newSide : 0n;
  const profit = payout - amountAtto;
  return {
    payoutAtto: payout,
    profitAtto: profit,
    roiBps: Number((profit * 10000n) / amountAtto),
    multiplierBps: Number((payout * 10000n) / amountAtto),
  };
}
