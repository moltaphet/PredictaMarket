"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useWallet, formatAddress } from "@/lib/genlayer/WalletProvider";

/** Deterministic gradient avatar derived from the address. */
function Identicon({ address, size = "h-5 w-5" }: { address: string; size?: string }) {
  const seed = parseInt(address.slice(2, 10), 16) || 0;
  const h1 = seed % 360;
  const h2 = (h1 + 96) % 360;
  return (
    <span
      className={cn("shrink-0 rounded-full ring-1 ring-white/20", size)}
      style={{ background: `linear-gradient(135deg, hsl(${h1} 80% 55%), hsl(${h2} 78% 46%))` }}
      aria-hidden="true"
    />
  );
}

export function WalletButton() {
  const { address, connecting, connect, disconnect, hasProvider } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset the "Copied" feedback whenever the menu closes.
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard not available (e.g. insecure context) — fail silently.
    }
  }

  // Disconnected state — single action button.
  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="ml-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#06080b] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : hasProvider ? "Connect Wallet" : "Install Wallet"}
      </button>
    );
  }

  // Connected state — identicon + short address + dropdown menu.
  return (
    <div className="relative ml-1" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-white/[0.03] py-1.5 pl-2 pr-2.5 text-sm transition-colors",
          open ? "border-white/25" : "border-white/10 hover:border-white/20"
        )}
      >
        <Identicon address={address} />
        <span className="font-mono text-white/85">{formatAddress(address, 6, 5)}</span>
        <svg
          viewBox="0 0 24 24"
          className={cn("h-3.5 w-3.5 text-white/40 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 animate-fade-up overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f14] p-1.5 shadow-2xl"
        >
          {/* connected account header */}
          <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
            <Identicon address={address} size="h-8 w-8" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">
                Connected
              </p>
              <p className="truncate font-mono text-[13px] text-white/85">
                {formatAddress(address, 10, 8)}
              </p>
            </div>
          </div>

          <div className="my-1 h-px bg-white/10" />

          {/* copy address */}
          <button
            role="menuitem"
            onClick={copyAddress}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white"
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12.5l4 4 10-10.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/45" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
                </svg>
                <span>Copy Address</span>
              </>
            )}
          </button>

          {/* disconnect */}
          <button
            role="menuitem"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-rose-300 transition-colors hover:bg-rose-400/10"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 12H3m0 0l4-4m-4 4l4 4M21 4v16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
