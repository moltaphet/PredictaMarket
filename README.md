# Predicta

**AI-resolved, fully on-chain prediction markets on [GenLayer](https://genlayer.com).**

Predicta lets anyone open a market on a real-world yes/no question, seed it with
liquidity, and let a **consensus-safe GenLayer LLM flow** settle the outcome — fetching
the evidence page natively and reading the result with an on-chain LLM. No centralized
oracle, no off-chain scripts in the trust path: every validator independently re-runs the
evidence check and agrees only on the derived `YES` / `NO` / `INVALID` outcome.

- **Contract** — `contract/PredictaMarket.py`, a GenLayer Intelligent Contract (GenVM v0.2.16)
- **Tests** — `contract/tests/`, 42 direct-mode tests (42/42 passing)
- **Frontend** — `frontend/`, a Next.js 16 + Tailwind v4 dashboard wired with `genlayer-js`
- **Live on StudioNet** — `0x28D5dDeE6333579c98060C94bd6D27A10aA406f6` (`chainId 61999`)

---

## 1. Overview

Predicta is a **parimutuel** prediction market resolved by AI you don't have to trust:

| Phase | What happens |
|-------|--------------|
| **Create** | A user poses a yes/no question, attaches one or more verification URLs, sets an expiration date, and locks initial liquidity that seeds **both** the YES and NO pools. |
| **Trade** | Anyone buys YES or NO shares before expiry. All money is tracked in atto-scale (`value × 10^18`) integers — no floats, no rounding drift. |
| **Resolve** | After expiry, `resolve_market` runs the verification URLs through `gl.nondet.web.render` + `gl.nondet.exec_prompt` inside a single `gl.vm.run_nondet_unsafe` block. The leader derives an outcome; validators re-run and **reach consensus only on the derived enum**, never on raw LLM text. |
| **Settle** | Winners claim their pro-rata share of the unified pool (`payout = shares × total_pool ÷ winning_pool`); `INVALID` markets refund every stake. Payout is a deterministic, integer-exact native transfer. |

The dashboard surfaces this as four views — **Market Explorer**, **Market Creation
Wizard**, **trade panel with a live return calculator**, and a **Portfolio** — plus a
"How it works" protocol breakdown, all in a premium dark, Polymarket-inspired theme.

---

## 2. Architecture Highlights — GenVM v0.2.16 alignment

The single hardest part of this build was making the contract **compile and register on the
web Studio** (`gen_getContractSchemaForCode`). The desktop validator is more permissive than
the on-chain WASM compiler, so a contract can pass locally yet fail deployment with
`{"kind": "VM_ERROR", "message": "invalid_contract"}`. Predicta is aligned to the
**certified GenVM v0.2.16 primitives** so it deploys cleanly.

### Fully flattened storage layout

The original design used nested and structured storage that the on-chain compiler rejected.
The production layout uses only certified primitives — `TreeMap[str, V]`, `DynArray[str]`,
and scalar-only `@allow_storage` dataclasses:

| Concern | ❌ Rejected by the Studio compiler | ✅ Flattened (production) |
|---------|-----------------------------------|--------------------------|
| **Positions** | `TreeMap[u256, TreeMap[Address, Position]]` (nested map) | `TreeMap[str, Position]` keyed by a **composite string** `"<market_id>#<owner_hex>"` |
| **Evidence log** | `DynArray[Evidence]` (array of dataclass) | `DynArray[str]` of **serialized JSON** — `json.dumps(...)` on write, `json.loads(...)` on read |
| **Indexes & URLs** | `DynArray[u256]`, `TreeMap[u256, …]` | `DynArray[str]`, `TreeMap[str, …]` (string keys throughout) |

This follows the official GenLayer guidance directly: *"Complex data in DynArray → serialize
to JSON string: `DynArray[str]` with `json.dumps()`/`json.loads()`."* Flattening nested maps
into composite string keys keeps every collection a first-class, compiler-supported shape.

### Other certified-primitive choices

- **Single-line pinned runner header** — `# { "Depends": "py-genlayer:1jb45aa8…" }` (the
  exact v0.2.16 `py-genlayer` runner), per the official contract skeleton.
- **Scalar-only storage dataclasses** — `Market` and `Position` hold only `u256` / `Address`
  / `str` / `bool`; no nested collections inside records.
- **Native transaction clock** — time gates read `gl.message_raw["datetime"]` (the
  consensus-provided datetime) instead of importing Python's `datetime`.
- **Consensus on derived state only** — the non-deterministic LLM/web work lives entirely
  inside the `run_nondet_unsafe` leader; validators agree on the `YES`/`NO`/`INVALID` enum.
- **Schema-safe public returns** — views return native `dict`, scalars return `int`, writes
  return `None`/`str`. Atto-scale money is returned as **decimal strings** so it survives the
  JSON/bigint boundary; the frontend casts defensively with `BigInt`.

Every change was verified with the official toolchain (`genvm-lint check`) against the exact
**v0.2.16** SDK — the local equivalent of the Studio's schema generation.

---

## 3. Repository structure

```
.
├── contract/
│   ├── PredictaMarket.py        # the Intelligent Contract (GenVM v0.2.16)
│   └── tests/                   # 42 direct-mode pytest tests
│       ├── conftest.py          # fixtures, mocks, view-reader + time helpers
│       ├── test_market_creation.py
│       ├── test_betting.py
│       ├── test_resolution.py   # AI flow + run_validator consensus checks
│       ├── test_settlement.py
│       └── test_access_control.py
├── frontend/                    # Next.js 16 + React 19 + Tailwind v4 dashboard
│   ├── app/                     # App Router shell, providers, theme
│   ├── components/              # Explorer, MarketCard, BetModal, MarketCreate, Portfolio, …
│   ├── lib/
│   │   ├── genlayer/            # genlayer-js client, wallet, defensive decode
│   │   ├── contracts/           # typed PredictaMarket wrapper + view models
│   │   ├── hooks/               # React Query hooks (useMarkets, usePlaceBet, useCreateMarket, …)
│   │   ├── format.ts            # atto-scale money helpers
│   │   └── parimutuel.ts        # client-side mirror of quote_bet
│   └── .env.example
└── pytest.ini                   # runs contract/tests in direct mode
```

---

## 4. Getting Started

### Prerequisites

- **Python 3.12+** and **Node 20+**
- GenLayer tooling:
  ```bash
  pip install genlayer-test genvm-linter   # direct-mode test runner + contract linter
  npm install -g genlayer                   # GenLayer CLI (deploy / call / write)
  ```

### Contract — lint & test

From the repository root:

```bash
# Static + schema validation against the GenVM compiler
genvm-lint check contract/PredictaMarket.py

# Run the full suite (pytest.ini already targets contract/tests in direct mode)
python -m pytest            # -> 42 passed
```

Direct-mode tests run in-memory (~30 ms each, no server) and mock the web/LLM calls, so the
AI-resolution flow is fully deterministic — including `run_validator()` checks that assert
the consensus guard (validators agree on the derived enum, disagree on a different outcome).

### Deploy to StudioNet

StudioNet is **gasless** — a 0 GEN balance can deploy and interact.

```bash
genlayer network set studionet
genlayer account unlock                                  # if your keystore is locked
genlayer deploy --contract contract/PredictaMarket.py    # constructor takes no args
```

Copy the printed contract address for the frontend. A read-only sanity check:

```bash
genlayer call <CONTRACT_ADDRESS> get_stats
# -> { total_markets: 0, active: 0, pending: 0, resolved: 0, tvl_atto: '0' }
```

### Frontend — run the dashboard

```bash
cd frontend
npm install
cp .env.example .env.local
# set NEXT_PUBLIC_CONTRACT_ADDRESS to your deployed address (StudioNet RPC is the default)
npm run dev          # http://localhost:3000
```

`.env.local`:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x28D5dDeE6333579c98060C94bd6D27A10aA406f6
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
```

Reads are gasless and work immediately. For **writes** (create market, place bet, claim),
connect MetaMask on the **StudioNet** network (`chainId 61999`). Then click **New market** in
the Explorer to seed one — the Explorer, Stats, and Portfolio populate from the live contract.

Useful scripts: `npm run build`, `npm run start`, `npm run typecheck`.

---

## 5. Contract reference

| Method | Kind | Purpose |
|--------|------|---------|
| `create_market(question, description, category, end_date, verification_urls)` | write · payable | Open a market; the sent value seeds both pools. Returns the market id (`int`). |
| `place_bet(market_id, side)` | write · payable | Buy `YES`/`NO` shares with the sent value. |
| `resolve_market(market_id)` | write | Run the consensus-safe AI resolution after expiry. Returns the outcome (`str`). |
| `claim_winnings(market_id)` | write | Settle a position; pays out via native transfer. Returns the payout (`int`). |
| `get_markets()` | view | All market summaries, keyed by id string. |
| `get_market(market_id)` | view | Full market detail incl. the AI evidence log. |
| `get_stats()` | view | TVL and market counts. |
| `get_position(market_id, user)` | view | A single user's shares + claim status. |
| `get_user_portfolio(user)` | view | Locked value and every position for a user. |
| `quote_bet(market_id, side, amount_atto)` | view | Closed-form parimutuel payout estimate. |

---

## 6. Tech stack

- **Contract:** GenLayer Intelligent Contract · GenVM **v0.2.16** · `py-genlayer` runner
- **Testing:** `genlayer-test` direct mode · `pytest` · `genvm-lint`
- **Frontend:** Next.js 16 (App Router) · React 19 · Tailwind v4 · `@tanstack/react-query` · `genlayer-js`
- **Network:** GenLayer StudioNet (`chainId 61999`, gasless)

---

*Predicta — predict anything, resolved by AI you don't have to trust.*
