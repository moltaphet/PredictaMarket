"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { parseGenToAtto, formatGen, TOKEN_SYMBOL } from "@/lib/format";
import { useCreateMarket } from "@/lib/hooks/usePredicta";
import { useWallet } from "@/lib/genlayer/WalletProvider";
import { CATEGORIES, type Category } from "@/lib/contracts/types";

const CATEGORY_ACCENT: Record<Category, string> = {
  CRYPTO: "bg-amber-400/15 text-amber-200 ring-amber-400/40",
  SPORTS: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/40",
  TECH: "bg-sky-400/15 text-sky-200 ring-sky-400/40",
  POLITICS: "bg-violet-400/15 text-violet-200 ring-violet-400/40",
};

const LIQUIDITY_PRESETS = ["10", "50", "100"];

/** Convert a `datetime-local` value (local time) to an ISO-8601 UTC string with a `Z`. */
function toIsoUtc(localValue: string): string {
  if (!localValue) return "";
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-[12px] font-medium text-white/55">{label}</label>
        {hint && <span className="text-[11px] text-white/30">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/25";

export function MarketCreate({ onClose }: { onClose: () => void }) {
  const { address, connect } = useWallet();
  const createMarket = useCreateMarket();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("CRYPTO");
  const [endDate, setEndDate] = useState("");
  const [urls, setUrls] = useState<string[]>([""]);
  const [liquidity, setLiquidity] = useState("50");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const liquidityAtto = useMemo(() => parseGenToAtto(liquidity), [liquidity]);
  const cleanUrls = useMemo(() => urls.map((u) => u.trim()).filter(Boolean), [urls]);
  const isoEnd = useMemo(() => toIsoUtc(endDate), [endDate]);

  const endIsFuture = useMemo(() => {
    if (!isoEnd) return false;
    return new Date(isoEnd).getTime() > Date.now();
  }, [isoEnd]);

  const error = useMemo(() => {
    if (!question.trim()) return "Add a yes/no question.";
    if (!endDate) return "Set an expiration date.";
    if (!endIsFuture) return "Expiration must be in the future.";
    if (cleanUrls.length === 0) return "Add at least one verification URL.";
    if (!liquidityAtto) return "Enter initial liquidity greater than zero.";
    return null;
  }, [question, endDate, endIsFuture, cleanUrls, liquidityAtto]);

  const succeeded = createMarket.isSuccess;

  function updateUrl(index: number, value: string) {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  }
  function addUrl() {
    setUrls((prev) => [...prev, ""]);
  }
  function removeUrl(index: number) {
    setUrls((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function submit() {
    if (error || !liquidityAtto || !address) return;
    createMarket.mutate({
      question: question.trim(),
      description: description.trim(),
      category,
      endDate: isoEnd,
      verificationUrls: cleanUrls,
      liquidityAtto,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0c0f14] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0c0f14]/95 p-5 backdrop-blur">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
              Create market
            </p>
            <h3 className="mt-1 text-[15px] font-semibold text-white">
              Pose a question the AI will resolve
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
            <h4 className="mt-4 text-lg font-semibold text-white">Market created</h4>
            <p className="mt-1 text-sm text-white/50">
              Your market is live with {formatGen(liquidityAtto ?? 0n)} of seeded liquidity.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#06080b]"
            >
              View markets
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <Field label="Question">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Will BTC close above $100k on 2026-12-31?"
                className={inputClass}
              />
            </Field>

            <Field label="Description" hint="optional context">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="How the outcome should be judged from the source page."
                className={cn(inputClass, "resize-none")}
              />
            </Field>

            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wider ring-1 transition-colors",
                      category === c
                        ? CATEGORY_ACCENT[c]
                        : "bg-white/[0.02] text-white/45 ring-white/10 hover:text-white"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Expiration date" hint="resolves after this time (UTC)">
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(inputClass, "[color-scheme:dark]")}
              />
            </Field>

            <Field label="Verification URLs" hint="the AI reads these to resolve">
              <div className="space-y-2">
                {urls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={url}
                      onChange={(e) => updateUrl(i, e.target.value)}
                      placeholder="https://example.com/official-result"
                      className={inputClass}
                    />
                    <button
                      onClick={() => removeUrl(i)}
                      disabled={urls.length === 1}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/40 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30"
                      aria-label="Remove URL"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addUrl}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-300 transition-colors hover:text-emerald-200"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Add another source
                </button>
              </div>
            </Field>

            <Field label={`Initial liquidity (${TOKEN_SYMBOL})`} hint="seeds both YES and NO pools">
              <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.02] px-3 focus-within:border-white/25">
                <input
                  inputMode="decimal"
                  value={liquidity}
                  onChange={(e) => setLiquidity(e.target.value)}
                  placeholder="0.0"
                  className="w-full bg-transparent py-2.5 text-sm font-semibold text-white outline-none placeholder:text-white/20"
                />
                <span className="text-sm font-medium text-white/40">{TOKEN_SYMBOL}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {LIQUIDITY_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setLiquidity(p)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] py-1.5 text-[12px] font-medium text-white/55 transition-colors hover:text-white"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>

            {createMarket.isError && (
              <p className="rounded-lg bg-rose-400/10 px-3 py-2 text-[12px] text-rose-300">
                {(createMarket.error as Error)?.message || "Transaction failed."}
              </p>
            )}

            {/* action */}
            {address ? (
              <button
                onClick={submit}
                disabled={!!error || createMarket.isPending}
                className="w-full rounded-xl bg-emerald-400 py-3 text-sm font-semibold text-[#06080b] transition-opacity disabled:opacity-50"
              >
                {createMarket.isPending
                  ? "Creating…"
                  : error
                  ? error
                  : `Create market · ${liquidity} ${TOKEN_SYMBOL}`}
              </button>
            ) : (
              <button
                onClick={connect}
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#06080b]"
              >
                Connect wallet to create
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
