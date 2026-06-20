"use client";

import { Github } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWallet, formatAddress } from "@/lib/genlayer/WalletProvider";

export type TabKey = "markets" | "portfolio" | "protocol";

const TABS: { key: TabKey; label: string }[] = [
  { key: "markets", label: "Markets" },
  { key: "portfolio", label: "Portfolio" },
  { key: "protocol", label: "How it works" },
];

export function Navbar({ tab, onTab }: { tab: TabKey; onTab: (t: TabKey) => void }) {
  const { address, connecting, connect, disconnect, hasProvider } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06080b]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* brand */}
        <button onClick={() => onTab("markets")} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-sky-500 shadow-lg shadow-emerald-500/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#06080b]" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M4 15l5-5 4 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">Predicta</span>
        </button>

        {/* center nav */}
        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-white/10 text-white" : "text-white/55 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* social + wallet */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <a
            href="https://github.com/moltaphet/PredictaMarket"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
            className="p-2 text-zinc-400 transition-colors hover:text-white"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="https://x.com/0xehs4hn"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            title="X (Twitter)"
            className="p-2 text-zinc-400 transition-colors hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
          </a>

          {address ? (
            <button
              onClick={disconnect}
              className="group ml-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1.5 pl-2.5 pr-3 text-sm transition-colors hover:border-white/20"
              title="Disconnect"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
              <span className="font-mono text-white/80">{formatAddress(address)}</span>
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="ml-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#06080b] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {connecting ? "Connecting…" : hasProvider ? "Connect Wallet" : "Install Wallet"}
            </button>
          )}
        </div>
      </div>

      {/* mobile tabs */}
      <nav className="flex items-center gap-1 border-t border-white/5 px-3 py-2 md:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.key ? "bg-white/10 text-white" : "text-white/55"
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
