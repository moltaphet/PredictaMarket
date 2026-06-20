/** Typed views of the PredictaMarket contract surface, after defensive decoding. */

export type MarketStatus = "ACTIVE" | "PENDING_RESOLUTION" | "RESOLVED";
export type MarketOutcome = "UNRESOLVED" | "YES" | "NO" | "INVALID";
export type Category = "CRYPTO" | "SPORTS" | "TECH" | "POLITICS";
export type Side = "YES" | "NO";

export const CATEGORIES: Category[] = ["CRYPTO", "SPORTS", "TECH", "POLITICS"];

/** A summary row from `get_markets`. */
export interface Market {
  id: number;
  creator: string;
  question: string;
  category: Category;
  status: MarketStatus;
  outcome: MarketOutcome;
  endDate: string;
  createdAt: string;
  yesPoolAtto: bigint;
  noPoolAtto: bigint;
  volumeAtto: bigint;
  yesPriceBps: number;
  noPriceBps: number;
}

/** Extra fields present only on `get_market`. */
export interface MarketDetail extends Market {
  description: string;
  resolvedAt: string;
  verificationUrls: string[];
  evidenceLog: Evidence[];
}

export interface Evidence {
  timestamp: string;
  sourceUrl: string;
  summary: string;
  quotedText: string;
  signal: MarketOutcome;
}

/** `get_stats`. */
export interface ProtocolStats {
  tvlAtto: bigint;
  totalMarkets: number;
  active: number;
  pending: number;
  resolved: number;
}

/** A single position row inside `get_user_portfolio`. */
export interface PortfolioPosition {
  marketId: number;
  question: string;
  status: MarketStatus;
  outcome: MarketOutcome;
  yesSharesAtto: bigint;
  noSharesAtto: bigint;
  claimed: boolean;
}

/** `get_user_portfolio`. */
export interface Portfolio {
  user: string;
  lockedAtto: bigint;
  positionCount: number;
  positions: PortfolioPosition[];
}

/** `quote_bet`. */
export interface BetQuote {
  stakeAtto: bigint;
  estPayoutAtto: bigint;
  estProfitAtto: bigint;
  roiBps: number;
  multiplierBps: number;
}
