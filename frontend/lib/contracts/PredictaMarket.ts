import { createGenLayerClient, type GenLayerClient } from "../genlayer/client";
import {
  asRecord,
  asRecordList,
  asString,
  asBigInt,
  asInt,
  asBool,
} from "../genlayer/decode";
import type {
  Market,
  MarketDetail,
  ProtocolStats,
  Portfolio,
  PortfolioPosition,
  Evidence,
  BetQuote,
  Category,
  MarketStatus,
  MarketOutcome,
  Side,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Adapters: raw decoded records -> strict typed view models                  */
/* -------------------------------------------------------------------------- */

function toMarket(raw: Record<string, unknown>): Market {
  return {
    id: asInt(raw.id),
    creator: asString(raw.creator),
    question: asString(raw.question),
    category: asString(raw.category, "CRYPTO") as Category,
    status: asString(raw.status, "ACTIVE") as MarketStatus,
    outcome: asString(raw.outcome, "UNRESOLVED") as MarketOutcome,
    endDate: asString(raw.end_date),
    createdAt: asString(raw.created_at),
    yesPoolAtto: asBigInt(raw.yes_pool_atto),
    noPoolAtto: asBigInt(raw.no_pool_atto),
    volumeAtto: asBigInt(raw.volume_atto),
    yesPriceBps: asInt(raw.yes_price_bps),
    noPriceBps: asInt(raw.no_price_bps),
  };
}

function toEvidence(raw: Record<string, unknown>): Evidence {
  return {
    timestamp: asString(raw.timestamp),
    sourceUrl: asString(raw.source_url),
    summary: asString(raw.summary),
    quotedText: asString(raw.quoted_text),
    signal: asString(raw.signal, "UNRESOLVED") as MarketOutcome,
  };
}

function toMarketDetail(raw: Record<string, unknown>): MarketDetail {
  const urls = Array.isArray(raw.verification_urls)
    ? (raw.verification_urls as unknown[]).map((u) => asString(u))
    : [];
  return {
    ...toMarket(raw),
    description: asString(raw.description),
    resolvedAt: asString(raw.resolved_at),
    verificationUrls: urls,
    evidenceLog: asRecordList(raw.evidence_log).map(toEvidence),
  };
}

function toStats(raw: Record<string, unknown>): ProtocolStats {
  return {
    tvlAtto: asBigInt(raw.tvl_atto),
    totalMarkets: asInt(raw.total_markets),
    active: asInt(raw.active),
    pending: asInt(raw.pending),
    resolved: asInt(raw.resolved),
  };
}

function toPosition(raw: Record<string, unknown>): PortfolioPosition {
  return {
    marketId: asInt(raw.market_id),
    question: asString(raw.question),
    status: asString(raw.status, "ACTIVE") as MarketStatus,
    outcome: asString(raw.outcome, "UNRESOLVED") as MarketOutcome,
    yesSharesAtto: asBigInt(raw.yes_shares_atto),
    noSharesAtto: asBigInt(raw.no_shares_atto),
    claimed: asBool(raw.claimed),
  };
}

function toPortfolio(raw: Record<string, unknown>): Portfolio {
  return {
    user: asString(raw.user),
    lockedAtto: asBigInt(raw.locked_atto),
    positionCount: asInt(raw.position_count),
    positions: asRecordList(raw.positions).map(toPosition),
  };
}

function toQuote(raw: Record<string, unknown>): BetQuote {
  return {
    stakeAtto: asBigInt(raw.stake_atto),
    estPayoutAtto: asBigInt(raw.est_payout_atto),
    estProfitAtto: asBigInt(raw.est_profit_atto),
    roiBps: asInt(raw.roi_bps),
    multiplierBps: asInt(raw.multiplier_bps),
  };
}

/** The exact args type the SDK's read/write methods accept (CalldataEncodable[]). */
type CallArgs = Parameters<GenLayerClient["readContract"]>[0]["args"];

/* -------------------------------------------------------------------------- */
/* Contract client                                                            */
/* -------------------------------------------------------------------------- */

export class PredictaMarketContract {
  private address: `0x${string}`;
  private account: string | null;
  private client: GenLayerClient;

  constructor(address: `0x${string}`, account?: string | null) {
    this.address = address;
    this.account = account ?? null;
    this.client = createGenLayerClient(account);
  }

  /**
   * Read a view. Public views return native GenLayer values — `dict` decodes to a JS
   * `Map`, `list` to an `Array` — which the `deepDecode` adapters normalize downstream.
   */
  private read(functionName: string, args: CallArgs = []): Promise<unknown> {
    return this.client.readContract({
      address: this.address,
      functionName,
      args,
    }) as Promise<unknown>;
  }

  private async write(functionName: string, args: CallArgs, valueAtto: bigint): Promise<unknown> {
    if (!this.account) throw new Error("Connect a wallet to sign this transaction.");
    const hash = await this.client.writeContract({
      address: this.address,
      functionName,
      args,
      value: valueAtto,
    });
    return this.client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED" as never,
      retries: 30,
      interval: 4000,
    });
  }

  /* ---- reads ---- */

  async getMarkets(): Promise<Market[]> {
    // get_markets returns a dict keyed by market id; take the values as the market list.
    const byId = asRecord(await this.read("get_markets"));
    return Object.values(byId)
      .map((entry) => toMarket(asRecord(entry)))
      .sort((a, b) => a.id - b.id);
  }

  async getMarket(marketId: number): Promise<MarketDetail> {
    return toMarketDetail(asRecord(await this.read("get_market", [marketId])));
  }

  async getStats(): Promise<ProtocolStats> {
    return toStats(asRecord(await this.read("get_stats")));
  }

  async getUserPortfolio(user: string): Promise<Portfolio> {
    return toPortfolio(asRecord(await this.read("get_user_portfolio", [user])));
  }

  async quoteBet(marketId: number, side: Side, amountAtto: bigint): Promise<BetQuote> {
    return toQuote(asRecord(await this.read("quote_bet", [marketId, side, amountAtto.toString()])));
  }

  /* ---- writes ---- */

  placeBet(marketId: number, side: Side, stakeAtto: bigint) {
    return this.write("place_bet", [marketId, side], stakeAtto);
  }

  createMarket(
    question: string,
    description: string,
    category: Category,
    endDate: string,
    verificationUrls: string[],
    liquidityAtto: bigint
  ) {
    return this.write(
      "create_market",
      [question, description, category, endDate, verificationUrls],
      liquidityAtto
    );
  }

  resolveMarket(marketId: number) {
    return this.write("resolve_market", [marketId], 0n);
  }

  claimWinnings(marketId: number) {
    return this.write("claim_winnings", [marketId], 0n);
  }
}
