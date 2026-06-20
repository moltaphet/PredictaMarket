"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { useMarkets } from "@/lib/hooks/usePredicta";
import { CATEGORIES, type Category, type Market, type MarketStatus, type Side } from "@/lib/contracts/types";
import { MarketCard } from "./MarketCard";
import { BetModal } from "./BetModal";
import { MarketCreate } from "./MarketCreate";

type StatusFilter = "ALL" | MarketStatus;
type CategoryFilter = "ALL" | Category;

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
  return (
    <div className="h-[230px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
  );
}

export function MarketExplorer() {
  const { data: markets, isLoading, isError } = useMarkets();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [trade, setTrade] = useState<{ market: Market; side: Side } | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const list = markets ?? [];
    return list.filter(
      (m) =>
        (status === "ALL" || m.status === status) &&
        (category === "ALL" || m.category === category)
    );
  }, [markets, status, category]);

  return (
    <section>
      {/* filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          filtered.map((m) => (
            <MarketCard key={m.id} market={m} onTrade={(market, side) => setTrade({ market, side })} />
          ))
        )}
      </div>

      {trade && (
        <BetModal
          market={trade.market}
          initialSide={trade.side}
          onClose={() => setTrade(null)}
        />
      )}

      {creating && <MarketCreate onClose={() => setCreating(false)} />}
    </section>
  );
}
