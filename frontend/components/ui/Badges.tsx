import { cn } from "@/lib/cn";
import type { Category, MarketStatus, MarketOutcome } from "@/lib/contracts/types";

const CATEGORY_STYLE: Record<Category, string> = {
  CRYPTO: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  SPORTS: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
  TECH: "bg-sky-400/10 text-sky-200 ring-sky-400/20",
  POLITICS: "bg-violet-400/10 text-violet-200 ring-violet-400/20",
};

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1",
        CATEGORY_STYLE[category] ?? "bg-white/5 text-white/60 ring-white/10"
      )}
    >
      {category}
    </span>
  );
}

const STATUS_STYLE: Record<MarketStatus, { dot: string; text: string; label: string }> = {
  ACTIVE: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Active" },
  PENDING_RESOLUTION: { dot: "bg-amber-400", text: "text-amber-300", label: "Pending" },
  RESOLVED: { dot: "bg-white/40", text: "text-white/50", label: "Resolved" },
};

export function StatusBadge({ status }: { status: MarketStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.ACTIVE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

const OUTCOME_STYLE: Record<MarketOutcome, string> = {
  YES: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
  NO: "bg-rose-400/15 text-rose-200 ring-rose-400/30",
  INVALID: "bg-white/10 text-white/60 ring-white/15",
  UNRESOLVED: "bg-white/5 text-white/40 ring-white/10",
};

export function OutcomeBadge({ outcome }: { outcome: MarketOutcome }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1",
        OUTCOME_STYLE[outcome]
      )}
    >
      {outcome === "YES" ? "Resolved · YES" : outcome === "NO" ? "Resolved · NO" : outcome}
    </span>
  );
}
