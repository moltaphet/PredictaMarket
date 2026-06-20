"use client";

import { useIsConfigured } from "@/lib/hooks/usePredicta";

/** Shown when NEXT_PUBLIC_CONTRACT_ADDRESS is missing so the dashboard fails gracefully. */
export function ConfigBanner() {
  const configured = useIsConfigured();
  if (configured) return null;

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-5 py-4">
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="text-sm">
          <p className="font-semibold text-amber-200">Contract address not configured</p>
          <p className="mt-0.5 text-amber-200/70">
            Set <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[12px]">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in
            <code className="ml-1 rounded bg-black/30 px-1 py-0.5 font-mono text-[12px]">.env.local</code> to your deployed
            PredictaMarket address, then restart the dev server. Live data stays empty until then.
          </p>
        </div>
      </div>
    </div>
  );
}
