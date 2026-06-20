"use client";

import { useState } from "react";
import { Navbar, type TabKey } from "@/components/Navbar";
import { ConfigBanner } from "@/components/ConfigBanner";
import { StatsBar } from "@/components/StatsBar";
import { MarketExplorer } from "@/components/MarketExplorer";
import { Portfolio } from "@/components/Portfolio";
import ProtocolArchitecture from "@/components/ProtocolArchitecture";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("markets");

  return (
    <div className="relative min-h-screen">
      {/* ambient backdrop */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-grid" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(50% 60% at 50% -10%, rgba(52,211,153,0.10), transparent 70%), radial-gradient(40% 50% at 90% 0%, rgba(56,189,248,0.08), transparent 70%)",
        }}
      />

      <Navbar tab={tab} onTab={setTab} />

      <main className="relative mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6">
        {/* hero */}
        <div className="max-w-2xl animate-fade-up">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.1]">
            Predict anything.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
              Resolved by AI you don&apos;t trust.
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/55">
            Trade real-world events on a fully on-chain market. Outcomes settle through
            GenLayer&apos;s consensus-safe LLM flow — verified by validators, not a single oracle.
          </p>
        </div>

        <div className="mt-8">
          <ConfigBanner />
        </div>

        {/* stats always visible */}
        <div className="mt-6">
          <StatsBar />
        </div>

        {/* tabbed body — each view renders only for its own tab */}
        <div className="mt-10">
          {tab === "markets" && <MarketExplorer />}
          {tab === "portfolio" && <Portfolio />}
          {tab === "protocol" && <ProtocolArchitecture />}
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-[13px] text-white/35">
        Predicta · AI-resolved prediction markets on GenLayer ·{" "}
        <span className="text-white/50">consensus-verified settlement</span>
      </footer>
    </div>
  );
}
