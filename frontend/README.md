# Predicta Dashboard

Premium dark-mode dashboard for the Predicta AI-resolved prediction market, built on
**Next.js 16 (App Router) · React 19 · Tailwind v4 · `genlayer-js`**.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env.local      # set NEXT_PUBLIC_CONTRACT_ADDRESS to your deployed contract
npm run dev                     # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run typecheck`.

Without a contract address the UI degrades gracefully — a config banner appears and all
live views render their empty/zero states (no crashes).

## Architecture

```
app/            App Router shell, providers (React Query + Wallet), global theme
lib/
  genlayer/     SDK client, MetaMask WalletProvider, defensive calldata decoding
  contracts/    PredictaMarket client wrapper + strict typed view models
  hooks/        React Query hooks (useMarkets, useStats, useUserPortfolio, usePlaceBet, …)
  format.ts     atto-scale (10^18) money formatting + safe parsing
  parimutuel.ts client-side mirror of quote_bet for instant return previews
components/      Navbar, StatsBar, MarketExplorer/Card, BetModal, Portfolio, ProtocolArchitecture
```

### State synchronization
All contract reads go through React Query (`staleTime`, focus refetch). Writes
(`place_bet`, `claim_winnings`, …) invalidate the `markets` / `stats` / `portfolio`
query keys on success, so every view re-syncs automatically.

### Defensive decoding
`genlayer-js` decodes Python `dict → Map`, `list → Array`. `lib/genlayer/decode.ts`
recursively normalizes Maps to objects and strictly casts every field — atto money via
`BigInt`, counts/bps via `asInt` — so a malformed field degrades to a safe default rather
than throwing. The contract returns atto values as strings precisely for this round-trip.

## Verified
`npm run typecheck` and `npm run build` both pass; the page prerenders and was
visually confirmed via a headless render.
# PredictaMarket
