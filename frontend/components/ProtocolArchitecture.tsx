/**
 * ProtocolArchitecture — the "How it Works" section for the Predicta dashboard.
 *
 * Self-contained: only React + Tailwind, inline SVG icons, no external deps. Drop it
 * anywhere in the dashboard (e.g. the landing route or an "About the protocol" tab).
 *
 * The copy intentionally mirrors the real `contract/PredictaMarket.py` implementation
 * (web.render + exec_prompt inside run_nondet_unsafe, parimutuel payout math) so the
 * narrative shown to users and judges matches the on-chain mechanics exactly.
 */

import type { ReactNode } from "react";

type Accent = "emerald" | "violet" | "sky" | "amber";

interface Step {
  index: string;
  title: string;
  accent: Accent;
  description: string;
  icon: ReactNode;
  /** Optional code/terminal block (steps that map to concrete GenLayer calls). */
  code?: { lines: { text: string; muted?: boolean }[] };
  /** Optional inline formula/chip. */
  chip?: string;
}

/**
 * Per-accent class tokens — written out in full (including the `hover:` variants) so
 * Tailwind's JIT scanner sees every class literally and never purges them. Do NOT build
 * these by string concatenation; the scanner only matches literal class strings.
 */
const ACCENT: Record<
  Accent,
  {
    text: string;
    hoverRing: string;
    glow: string;
    chipBg: string;
    chipText: string;
    bar: string;
    iconBg: string;
  }
> = {
  emerald: {
    text: "text-emerald-300",
    hoverRing: "hover:ring-emerald-400/20",
    glow: "from-emerald-500/15",
    chipBg: "bg-emerald-400/10 ring-emerald-400/20",
    chipText: "text-emerald-200",
    bar: "from-emerald-400/80 to-emerald-400/0",
    iconBg: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  },
  violet: {
    text: "text-violet-300",
    hoverRing: "hover:ring-violet-400/20",
    glow: "from-violet-500/15",
    chipBg: "bg-violet-400/10 ring-violet-400/20",
    chipText: "text-violet-200",
    bar: "from-violet-400/80 to-violet-400/0",
    iconBg: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
  },
  sky: {
    text: "text-sky-300",
    hoverRing: "hover:ring-sky-400/20",
    glow: "from-sky-500/15",
    chipBg: "bg-sky-400/10 ring-sky-400/20",
    chipText: "text-sky-200",
    bar: "from-sky-400/80 to-sky-400/0",
    iconBg: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  },
  amber: {
    text: "text-amber-300",
    hoverRing: "hover:ring-amber-400/20",
    glow: "from-amber-500/15",
    chipBg: "bg-amber-400/10 ring-amber-400/20",
    chipText: "text-amber-200",
    bar: "from-amber-400/80 to-amber-400/0",
    iconBg: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  },
};

const iconClass = "h-5 w-5";

const STEPS: Step[] = [
  {
    index: "01",
    title: "Market Creation",
    accent: "emerald",
    description:
      "Anyone opens a market with a clear yes/no question and locks initial liquidity that seeds both sides of the pool. A public verification URL is attached as the single source of truth the AI will later read.",
    chip: "create_market() — seeds YES + NO pools",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass} stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3v18M3 7.5h12a3 3 0 0 1 0 6H6a3 3 0 0 0 0 6h12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    index: "02",
    title: "AI-Driven Resolution",
    accent: "violet",
    description:
      "After the expiration date passes, a GenLayer Intelligent Contract natively fetches the verification URL and reads the outcome with an LLM — no centralized API keys and no off-chain scripts in the trust path.",
    code: {
      lines: [
        { text: "# inside run_nondet_unsafe → leader", muted: true },
        { text: 'page = gl.nondet.web.render(url, mode="text")' },
        { text: "verdict = gl.nondet.exec_prompt(" },
        { text: '    prompt, response_format="json")', muted: true },
      ],
    },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass} stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="7" width="16" height="12" rx="2.5" />
        <path d="M12 7V4M9 12h.01M15 12h.01M9 16h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    index: "03",
    title: "Optimistic Consensus",
    accent: "sky",
    description:
      "Every validator independently re-runs the fetch-and-read flow and must agree only on the derived YES / NO / INVALID outcome — never on raw model text. No single leader or oracle can move the settlement.",
    chip: "run_nondet_unsafe(leader, validator)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass} stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.8C7.9 18.4 5 15.2 5 11V6l7-3z" strokeLinejoin="round" />
        <path d="M9 11.5l2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    index: "04",
    title: "Parimutuel Payouts",
    accent: "amber",
    description:
      "Once settled, winners claim deterministically from the unified pool, proportional to their share of the winning side. INVALID markets refund every stake. The math is integer-exact and fully on-chain.",
    chip: "payout = shares × total_pool ÷ winning_pool",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className={iconClass} stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9M9.5 14c0 1.1 1.1 1.8 2.5 1.8s2.5-.7 2.5-1.9-1-1.6-2.5-1.9-2.5-.8-2.5-1.9S10.6 8.2 12 8.2s2.5.7 2.5 1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const TRUST_BADGES = [
  "Consensus-verified",
  "No single oracle",
  "Deterministic settlement",
  "Fully on-chain",
];

function CodeBlock({ lines }: NonNullable<Step["code"]>) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-rose-400/60" />
        <span className="h-2 w-2 rounded-full bg-amber-400/60" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
        <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-white/30">
          genvm · python
        </span>
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-[11.5px] leading-relaxed">
        <code className="font-mono">
          {lines.map((l, i) => (
            <div key={i} className={l.muted ? "text-white/35" : "text-white/80"}>
              {l.text || " "}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

function StepCard({ step }: { step: Step }) {
  const a = ACCENT[step.accent];
  return (
    <article
      className={[
        "group relative flex flex-col overflow-hidden rounded-2xl",
        "border border-white/10 bg-white/[0.02] p-5",
        "ring-1 ring-inset ring-white/5 backdrop-blur-sm",
        "transition-all duration-300 hover:-translate-y-1 hover:border-white/20",
        a.hoverRing,
      ].join(" ")}
    >
      {/* top accent bar */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.bar}`} />
      {/* corner glow */}
      <div
        className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${a.glow} to-transparent opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100`}
      />

      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${a.iconBg}`}
        >
          {step.icon}
        </span>
        <span className="font-mono text-2xl font-semibold tracking-tight text-white/10 transition-colors duration-300 group-hover:text-white/20">
          {step.index}
        </span>
      </div>

      <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{step.description}</p>

      <div className="mt-auto">
        {step.code && <CodeBlock lines={step.code.lines} />}
        {step.chip && (
          <div
            className={`mt-4 inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ${a.chipBg}`}
          >
            <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 ${a.text}`} fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 9l-4 3 4 3M16 9l4 3-4 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <code className={`truncate font-mono text-[11.5px] ${a.chipText}`}>{step.chip}</code>
          </div>
        )}
      </div>
    </article>
  );
}

export default function ProtocolArchitecture() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0c10] px-6 py-12 sm:px-10 sm:py-16"
    >
      {/* ambient background: radial tint + subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,0.10), transparent 70%), radial-gradient(40% 40% at 100% 100%, rgba(16,185,129,0.08), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(70% 60% at 50% 0%, #000 40%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* header */}
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
            Protocol Architecture
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            How Predicta works
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/55">
            A fully on-chain prediction market resolved by AI you don&apos;t have to trust. Markets
            settle through GenLayer&apos;s consensus-safe LLM flow — every validator re-runs the
            evidence check, so the outcome is verified by the network, not a single oracle.
          </p>
        </div>

        {/* steps */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step) => (
            <StepCard key={step.index} step={step} />
          ))}
        </div>

        {/* trust footer */}
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
          <span className="text-xs font-medium uppercase tracking-wider text-white/35">
            Guarantees
          </span>
          {TRUST_BADGES.map((badge) => (
            <span key={badge} className="inline-flex items-center gap-2 text-sm text-white/65">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12.5l4 4 10-10.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
