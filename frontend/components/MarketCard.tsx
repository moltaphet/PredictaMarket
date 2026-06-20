"use client";

import { cn } from "@/lib/cn";
import { formatGenCompact, bpsToPercent } from "@/lib/format";
import type { Market, Side } from "@/lib/contracts/types";
import { CategoryTag, StatusBadge, OutcomeBadge } from "./ui/Badges";

export function MarketCard({
  market,
  onTrade,
}: {
  market: Market;
  onTrade: (market: Market, side: Side) => void;
}) {
  const resolved = market.status === "RESOLVED";
  const yesPct = Math.max(0, Math.min(100, market.yesPriceBps / 100));

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.035]">
      <div className="flex items-center justify-between">
        <CategoryTag category={market.category} />
        {resolved ? <OutcomeBadge outcome={market.outcome} /> : <StatusBadge status={market.status} />}
      </div>

      <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug text-white">
        {market.question}
      </h3>

      {/* implied-probability meter */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium">
          <span className="text-emerald-300">YES {bpsToPercent(market.yesPriceBps)}</span>
          <span className="text-rose-300">NO {bpsToPercent(market.noPriceBps)}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${yesPct}%` }}
          />
          <div className="h-full flex-1 bg-gradient-to-r from-rose-400 to-rose-500" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[12px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" strokeLinecap="round" />
          </svg>
          {formatGenCompact(market.volumeAtto)} Vol
        </span>
        <span className="font-mono text-white/30">#{market.id}</span>
      </div>

      {/* trade actions */}
      {resolved ? (
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] py-2 text-center text-[13px] font-medium text-white/40">
          Market settled
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onTrade(market, "YES")}
            className={cn(
              "rounded-xl py-2 text-sm font-semibold transition-colors",
              "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20 hover:bg-emerald-400/20"
            )}
          >
            Buy YES
          </button>
          <button
            onClick={() => onTrade(market, "NO")}
            className={cn(
              "rounded-xl py-2 text-sm font-semibold transition-colors",
              "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20 hover:bg-rose-400/20"
            )}
          >
            Buy NO
          </button>
        </div>
      )}
    </article>
  );
}
