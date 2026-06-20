"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatGen, parseGenToAtto, bpsToPercent, TOKEN_SYMBOL } from "@/lib/format";
import { quoteBetLocal } from "@/lib/parimutuel";
import { usePlaceBet } from "@/lib/hooks/usePredicta";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import type { Market, Side } from "@/lib/contracts/types";

const PRESETS = ["1", "5", "25", "100"];

export function BetModal({
  market,
  initialSide,
  onClose,
}: {
  market: Market;
  initialSide: Side;
  onClose: () => void;
}) {
  const { address, connect } = useWallet();
  const placeBet = usePlaceBet();
  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState("10");

  const stakeAtto = useMemo(() => parseGenToAtto(amount), [amount]);

  const quote = useMemo(() => {
    if (!stakeAtto) return null;
    const sidePool = side === "YES" ? market.yesPoolAtto : market.noPoolAtto;
    const otherPool = side === "YES" ? market.noPoolAtto : market.yesPoolAtto;
    return quoteBetLocal(sidePool, otherPool, stakeAtto);
  }, [stakeAtto, side, market]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const succeeded = placeBet.isSuccess;

  async function submit() {
    if (!stakeAtto || !address) return;
    placeBet.mutate({ marketId: market.id, side, stakeAtto });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-up overflow-hidden rounded-t-3xl border border-white/10 bg-[#0c0f14] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
              Trade · Market #{market.id}
            </p>
            <h3 className="mt-1 text-[15px] font-semibold leading-snug text-white">
              {market.question}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {succeeded ? (
          <div className="p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/30">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12.5l4 4 10-10.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h4 className="mt-4 text-lg font-semibold text-white">Position confirmed</h4>
            <p className="mt-1 text-sm text-white/50">
              Your {side} stake is in the pool and your portfolio is updating.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#06080b]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="p-5">
            {/* side toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/[0.03] p-1">
              {(["YES", "NO"] as Side[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={cn(
                    "rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    side === s && s === "YES" && "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
                    side === s && s === "NO" && "bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30",
                    side !== s && "text-white/45 hover:text-white"
                  )}
                >
                  {s} · {bpsToPercent(s === "YES" ? market.yesPriceBps : market.noPriceBps)}
                </button>
              ))}
            </div>

            {/* amount */}
            <div className="mt-4">
              <label className="text-[12px] font-medium text-white/45">Amount ({TOKEN_SYMBOL})</label>
              <div className="mt-1.5 flex items-center rounded-xl border border-white/10 bg-white/[0.02] px-3 focus-within:border-white/25">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-transparent py-3 text-lg font-semibold text-white outline-none placeholder:text-white/20"
                />
                <span className="text-sm font-medium text-white/40">{TOKEN_SYMBOL}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(p)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] py-1.5 text-[12px] font-medium text-white/55 transition-colors hover:text-white"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* live return calculator */}
            <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
              <Row label="Est. payout if won">
                <span className={cn("font-semibold", side === "YES" ? "text-emerald-300" : "text-rose-300")}>
                  {quote ? formatGen(quote.payoutAtto) : `— ${TOKEN_SYMBOL}`}
                </span>
              </Row>
              <Row label="Est. profit">
                <span className="font-medium text-white/80">
                  {quote ? `+${formatGen(quote.profitAtto)}` : `— ${TOKEN_SYMBOL}`}
                </span>
              </Row>
              <Row label="Return multiple">
                <span className="font-mono text-white/70">
                  {quote ? `${(quote.multiplierBps / 10000).toFixed(2)}×` : "—"}
                </span>
              </Row>
              <p className="border-t border-white/5 pt-2 text-[11px] leading-relaxed text-white/35">
                Parimutuel payout from the unified pool. Final settlement is computed on-chain
                at resolution from the pool totals at that time.
              </p>
            </div>

            {placeBet.isError && (
              <p className="mt-3 rounded-lg bg-rose-400/10 px-3 py-2 text-[12px] text-rose-300">
                {(placeBet.error as Error)?.message || "Transaction failed."}
              </p>
            )}

            {/* action */}
            {address ? (
              <button
                onClick={submit}
                disabled={!stakeAtto || placeBet.isPending}
                className={cn(
                  "mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-opacity disabled:opacity-50",
                  side === "YES" ? "bg-emerald-400 text-[#06080b]" : "bg-rose-400 text-[#06080b]"
                )}
              >
                {placeBet.isPending
                  ? "Confirming…"
                  : !stakeAtto
                  ? "Enter an amount"
                  : `Buy ${side} · ${amount} ${TOKEN_SYMBOL}`}
              </button>
            ) : (
              <button
                onClick={connect}
                className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#06080b]"
              >
                Connect wallet to trade
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/45">{label}</span>
      {children}
    </div>
  );
}
