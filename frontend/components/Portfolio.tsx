"use client";

import { cn } from "@/lib/cn";
import { formatGen } from "@/lib/format";
import { useUserPortfolio, useClaimWinnings } from "@/lib/hooks/usePredicta";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import type { PortfolioPosition } from "@/lib/contracts/types";
import { OutcomeBadge, StatusBadge } from "./ui/Badges";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function PositionRow({ position }: { position: PortfolioPosition }) {
  const claim = useClaimWinnings();
  const resolved = position.status === "RESOLVED";
  const claimable = resolved && !position.claimed;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {resolved ? <OutcomeBadge outcome={position.outcome} /> : <StatusBadge status={position.status} />}
          <span className="font-mono text-[11px] text-white/30">#{position.marketId}</span>
        </div>
        <p className="mt-1.5 line-clamp-1 text-sm font-medium text-white">{position.question}</p>
        <div className="mt-1 flex gap-4 text-[12px]">
          {position.yesSharesAtto > 0n && (
            <span className="text-emerald-300">YES {formatGen(position.yesSharesAtto)}</span>
          )}
          {position.noSharesAtto > 0n && (
            <span className="text-rose-300">NO {formatGen(position.noSharesAtto)}</span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        {claimable ? (
          <button
            onClick={() => claim.mutate(position.marketId)}
            disabled={claim.isPending}
            className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-[#06080b] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {claim.isPending ? "Claiming…" : "Claim"}
          </button>
        ) : (
          <span
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-medium",
              position.claimed ? "bg-white/5 text-white/40" : "bg-white/5 text-white/35"
            )}
          >
            {position.claimed ? "Claimed" : "Open"}
          </span>
        )}
      </div>
    </div>
  );
}

export function Portfolio() {
  const { address, connect } = useWallet();
  const { data: portfolio, isLoading } = useUserPortfolio();

  if (!address) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-16 text-center">
        <p className="text-sm text-white/50">Connect your wallet to view your portfolio.</p>
        <button
          onClick={connect}
          className="mt-4 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#06080b]"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  const positions = portfolio?.positions ?? [];

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <SummaryCard label="Value Locked" value={formatGen(portfolio?.lockedAtto ?? 0n)} />
        <SummaryCard label="Open Positions" value={String(portfolio?.positionCount ?? 0)} />
      </div>

      <h3 className="mt-8 text-sm font-medium uppercase tracking-wider text-white/40">Positions</h3>
      <div className="mt-3 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          ))
        ) : positions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-12 text-center text-sm text-white/40">
            No positions yet. Head to Markets to place your first bet.
          </div>
        ) : (
          positions.map((p) => <PositionRow key={p.marketId} position={p} />)
        )}
      </div>
    </section>
  );
}
