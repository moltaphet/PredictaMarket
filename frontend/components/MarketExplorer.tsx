"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useMarkets, useUserPortfolio } from "@/lib/hooks/usePredicta";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { formatGen } from "@/lib/format";
import {
  CATEGORIES,
  type Category,
  type Market,
  type MarketStatus,
  type Side,
  type PortfolioPosition,
} from "@/lib/contracts/types";
import { MarketCard } from "./MarketCard";
import { BetModal } from "./BetModal";
import { MarketCreate } from "./MarketCreate";
import { StatusBadge, OutcomeBadge } from "./ui/Badges";

type StatusFilter = "ALL" | MarketStatus;
type CategoryFilter = "ALL" | Category;
type View = "all" | "mine";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PENDING_RESOLUTION", label: "Pending" },
  { key: "RESOLVED", label: "Resolved" },
];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-white text-[#06080b]"
          : "border border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title="Refresh"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-white/60 transition-colors hover:text-white disabled:opacity-60"
    >
      <svg
        viewBox="0 0 24 24"
        className={cn("h-3.5 w-3.5", busy && "animate-spin")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Refresh
    </button>
  );
}

function EmptyState({ message, onCreate }: { message: string; onCreate?: () => void }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-16 text-center">
      <p className="text-sm text-white/40">{message}</p>
      {onCreate && (
        <button
          onClick={onCreate}
          className="mt-4 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#06080b] transition-opacity hover:opacity-90"
        >
          Create the first market
        </button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-[230px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />;
}

function ActivityBetRow({ position }: { position: PortfolioPosition }) {
  const resolved = position.status === "RESOLVED";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {resolved ? <OutcomeBadge outcome={position.outcome} /> : <StatusBadge status={position.status} />}
          <span className="font-mono text-[11px] text-white/30">#{position.marketId}</span>
        </div>
        <p className="mt-1 line-clamp-1 text-sm text-white">{position.question}</p>
      </div>
      <div className="shrink-0 space-y-0.5 text-right text-[12px]">
        {position.yesSharesAtto > 0n && (
          <div className="text-emerald-300">YES {formatGen(position.yesSharesAtto)}</div>
        )}
        {position.noSharesAtto > 0n && (
          <div className="text-rose-300">NO {formatGen(position.noSharesAtto)}</div>
        )}
        {position.claimed && <div className="text-white/35">claimed</div>}
      </div>
    </div>
  );
}

export function MarketExplorer() {
  const { data: markets, isLoading, isError, refetch, isFetching } = useMarkets();
  const {
    data: portfolio,
    isLoading: portfolioLoading,
    refetch: refetchPortfolio,
    isFetching: portfolioFetching,
  } = useUserPortfolio();
  const { address, connect } = useWallet();

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [trade, setTrade] = useState<{ market: Market; side: Side } | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<View>("all");

  const filtered = useMemo(() => {
    const list = markets ?? [];
    return list.filter(
      (m) =>
        (status === "ALL" || m.status === status) && (category === "ALL" || m.category === category)
    );
  }, [markets, status, category]);

  const myMarkets = useMemo(() => {
    if (!address) return [];
    const me = address.toLowerCase();
    return (markets ?? []).filter((m) => m.creator.toLowerCase() === me);
  }, [markets, address]);

  const myBets = portfolio?.positions ?? [];

  // Switching to "My Activity" pulls fresh data so the history is never stale.
  function selectView(next: View) {
    setView(next);
    refetch();
    if (next === "mine" && address) refetchPortfolio();
  }

  const onTrade = (market: Market, side: Side) => setTrade({ market, side });

  return (
    <section>
      {/* primary view toggle + create */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button
            onClick={() => selectView("all")}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              view === "all" ? "bg-white text-[#06080b]" : "text-white/55 hover:text-white"
            )}
          >
            All Markets
          </button>
          <button
            onClick={() => selectView("mine")}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              view === "mine" ? "bg-white text-[#06080b]" : "text-white/55 hover:text-white"
            )}
          >
            My Activity
          </button>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3.5 py-1.5 text-[13px] font-semibold text-[#06080b] transition-opacity hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          New market
        </button>
      </div>

      {view === "all" ? (
        <>
          {/* status / category filters + refresh */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <FilterChip key={f.key} active={status === f.key} onClick={() => setStatus(f.key)}>
                  {f.label}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip active={category === "ALL"} onClick={() => setCategory("ALL")}>
                All categories
              </FilterChip>
              {CATEGORIES.map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </FilterChip>
              ))}
              <RefreshButton onClick={() => refetch()} busy={isFetching} />
            </div>
          </div>

          {/* grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            ) : isError ? (
              <EmptyState message="Could not load markets. Check the contract address and network." />
            ) : filtered.length === 0 ? (
              <EmptyState
                message={
                  (markets?.length ?? 0) === 0
                    ? "No markets yet. Be the first to open one."
                    : "No markets match these filters yet."
                }
                onCreate={(markets?.length ?? 0) === 0 ? () => setCreating(true) : undefined}
              />
            ) : (
              filtered.map((m) => <MarketCard key={m.id} market={m} onTrade={onTrade} />)
            )}
          </div>
        </>
      ) : !address ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-16 text-center">
          <p className="text-sm text-white/50">
            Connect your wallet to see the markets you created and the bets you placed.
          </p>
          <button
            onClick={connect}
            className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#06080b]"
          >
            Connect wallet
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {/* markets the user created */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wider text-white/40">
                Markets you created
              </h3>
              <RefreshButton
                onClick={() => {
                  refetch();
                  refetchPortfolio();
                }}
                busy={isFetching || portfolioFetching}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              ) : myMarkets.length === 0 ? (
                <EmptyState
                  message="You haven't created any markets yet."
                  onCreate={() => setCreating(true)}
                />
              ) : (
                myMarkets.map((m) => <MarketCard key={m.id} market={m} onTrade={onTrade} />)
              )}
            </div>
          </div>

          {/* bets the user placed */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider text-white/40">
              Your bets ({myBets.length})
            </h3>
            <div className="mt-3 space-y-2">
              {portfolioLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[68px] animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
                  />
                ))
              ) : myBets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-10 text-center text-sm text-white/40">
                  No bets yet — pick a market and place YES or NO.
                </div>
              ) : (
                myBets.map((p) => <ActivityBetRow key={p.marketId} position={p} />)
              )}
            </div>
          </div>
        </div>
      )}

      {trade && (
        <BetModal market={trade.market} initialSide={trade.side} onClose={() => setTrade(null)} />
      )}

      {creating && (
        <MarketCreate
          onClose={() => setCreating(false)}
          onCreated={() => {
            refetch();
            if (address) refetchPortfolio();
          }}
        />
      )}
    </section>
  );
}
