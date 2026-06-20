"use client";

import { useStats } from "@/lib/hooks/usePredicta";
import { formatGenCompact } from "@/lib/format";

function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent}`} />
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-white/10" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white">{value}</p>
      )}
    </div>
  );
}

export function StatsBar() {
  const { data, isLoading } = useStats();
  const stats = data ?? { tvlAtto: 0n, totalMarkets: 0, active: 0, pending: 0, resolved: 0 };

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="Total Value Locked"
        value={formatGenCompact(stats.tvlAtto)}
        accent="from-emerald-400/70 to-emerald-400/0"
        loading={isLoading}
      />
      <StatCard
        label="Total Markets"
        value={String(stats.totalMarkets)}
        accent="from-sky-400/70 to-sky-400/0"
        loading={isLoading}
      />
      <StatCard
        label="Active"
        value={String(stats.active)}
        accent="from-violet-400/70 to-violet-400/0"
        loading={isLoading}
      />
      <StatCard
        label="Resolved"
        value={String(stats.resolved)}
        accent="from-amber-400/70 to-amber-400/0"
        loading={isLoading}
      />
    </div>
  );
}
