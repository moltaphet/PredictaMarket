# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *

# --------------------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------------------

ATTO = 1_000_000_000_000_000_000  # 10**18 - atto scaling for on-chain money

STATUS_ACTIVE = "ACTIVE"
STATUS_PENDING = "PENDING_RESOLUTION"
STATUS_RESOLVED = "RESOLVED"

OUTCOME_UNRESOLVED = "UNRESOLVED"
OUTCOME_YES = "YES"
OUTCOME_NO = "NO"
OUTCOME_INVALID = "INVALID"

SIDE_YES = "YES"
SIDE_NO = "NO"

CATEGORIES = ("CRYPTO", "SPORTS", "TECH", "POLITICS")

# Error classification prefixes (see the official validator-error handling pattern).
ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"


# --------------------------------------------------------------------------------------
# Storage records - scalar fields only (complex/nested data is kept as JSON in DynArray[str])
# --------------------------------------------------------------------------------------


@allow_storage
@dataclass
class Market:
    id: u256
    creator: Address
    question: str
    description: str
    category: str
    status: str
    outcome: str
    end_date: str
    created_at: str
    resolved_at: str
    yes_pool_atto: u256
    no_pool_atto: u256


@allow_storage
@dataclass
class Position:
    yes_shares_atto: u256
    no_shares_atto: u256
    claimed: bool


# --------------------------------------------------------------------------------------
# Module-level helpers (picklable for the non-det validator re-run)
# --------------------------------------------------------------------------------------


def _now_iso() -> str:
    """Transaction timestamp (ISO-8601 UTC) from the consensus message - no imports."""
    return str(gl.message_raw["datetime"])


def _coerce_signal(raw: object) -> str:
    token = str(raw).strip().upper()
    if token in ("YES", "TRUE", "1", "AFFIRMATIVE", "HAPPENED", "OCCURRED"):
        return OUTCOME_YES
    if token in ("NO", "FALSE", "0", "NEGATIVE", "DID NOT HAPPEN", "DIDNT HAPPEN"):
        return OUTCOME_NO
    if token in ("INVALID", "AMBIGUOUS", "UNDECIDABLE", "MALFORMED"):
        return OUTCOME_INVALID
    return OUTCOME_UNRESOLVED


def _parse_llm_object(analysis: object) -> dict:
    if isinstance(analysis, dict):
        return analysis
    if isinstance(analysis, str):
        text = analysis.strip()
        first, last = text.find("{"), text.rfind("}")
        if first != -1 and last != -1 and last > first:
            try:
                return json.loads(text[first : last + 1])
            except (ValueError, TypeError):
                pass
    raise gl.vm.UserError(f"{ERROR_LLM} Non-JSON LLM response: {type(analysis)}")


def _aggregate_outcome(signals: list) -> str:
    if OUTCOME_INVALID in signals:
        return OUTCOME_INVALID
    yes = sum(1 for s in signals if s == OUTCOME_YES)
    no = sum(1 for s in signals if s == OUTCOME_NO)
    if yes == 0 and no == 0:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Event not yet resolvable from sources")
    if yes > no:
        return OUTCOME_YES
    if no > yes:
        return OUTCOME_NO
    return OUTCOME_INVALID


def _handle_leader_error(leaders_res: gl.vm.Result, leader_fn) -> bool:
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        leader_fn()
        return False
    except gl.vm.UserError as e:
        validator_msg = e.message if hasattr(e, "message") else str(e)
        if validator_msg.startswith(ERROR_EXPECTED) or validator_msg.startswith(ERROR_EXTERNAL):
            return validator_msg == leader_msg
        if validator_msg.startswith(ERROR_TRANSIENT) and leader_msg.startswith(ERROR_TRANSIENT):
            return True
        return False
    except Exception:
        return False


# --------------------------------------------------------------------------------------
# Contract
# --------------------------------------------------------------------------------------


class PredictaMarket(gl.Contract):
    owner: Address
    markets: TreeMap[str, Market]
    market_ids: DynArray[str]
    next_id: u256
    positions: TreeMap[str, Position]          # key: "<market_id>#<owner_hex>"
    user_markets: TreeMap[str, DynArray[str]]  # owner_hex -> market id strings
    market_urls: TreeMap[str, DynArray[str]]   # market_id -> verification URLs
    market_evidence: TreeMap[str, DynArray[str]]  # market_id -> evidence JSON strings
    tvl_atto: u256
    count_active: u256
    count_pending: u256
    count_resolved: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.next_id = u256(1)
        self.tvl_atto = u256(0)
        self.count_active = u256(0)
        self.count_pending = u256(0)
        self.count_resolved = u256(0)

    # ---------------------------------------------------------------- internal helpers

    def _require_market(self, market_id: int) -> Market:
        key = str(market_id)
        if key not in self.markets:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown market {market_id}")
        return self.markets[key]

    def _pos_key(self, market_id: int, owner_hex: str) -> str:
        return str(market_id) + "#" + owner_hex

    # ---------------------------------------------------------------- creation wizard

    @gl.public.write.payable
    def create_market(
        self,
        question: str,
        description: str,
        category: str,
        end_date: str,
        verification_urls: list,
    ) -> int:
        cat = category.strip().upper()
        if cat not in CATEGORIES:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid category: {category}")
        if not question.strip():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Question is required")
        if not end_date.strip():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} End date is required")
        if len(verification_urls) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} At least one verification URL required")

        seed = int(gl.message.value)
        if seed <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Initial liquidity must be positive")

        yes_seed = seed // 2
        no_seed = seed - yes_seed

        market_id = int(self.next_id)
        key = str(market_id)
        self.markets[key] = Market(
            id=u256(market_id),
            creator=gl.message.sender_address,
            question=question,
            description=description,
            category=cat,
            status=STATUS_ACTIVE,
            outcome=OUTCOME_UNRESOLVED,
            end_date=end_date,
            created_at=_now_iso(),
            resolved_at="",
            yes_pool_atto=u256(yes_seed),
            no_pool_atto=u256(no_seed),
        )
        self.market_ids.append(key)
        urls = self.market_urls.get_or_insert_default(key)
        for url in verification_urls:
            urls.append(str(url))

        self.next_id = u256(market_id + 1)
        self.tvl_atto = u256(int(self.tvl_atto) + seed)
        self.count_active = u256(int(self.count_active) + 1)
        return market_id

    # ---------------------------------------------------------------- betting panel

    @gl.public.write.payable
    def place_bet(self, market_id: int, side: str) -> None:
        market = self._require_market(market_id)
        if market.status != STATUS_ACTIVE:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Market is not open for betting")
        if _now_iso() >= market.end_date:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Betting window has closed")

        chosen = side.strip().upper()
        if chosen not in (SIDE_YES, SIDE_NO):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Side must be YES or NO")

        stake = int(gl.message.value)
        if stake <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Stake must be positive")

        owner_hex = gl.message.sender_address.as_hex
        pos_key = self._pos_key(market_id, owner_hex)
        if pos_key not in self.positions:
            self.positions[pos_key] = Position(
                yes_shares_atto=u256(0), no_shares_atto=u256(0), claimed=False
            )
            self.user_markets.get_or_insert_default(owner_hex).append(str(market_id))

        pos = self.positions[pos_key]
        if chosen == SIDE_YES:
            pos.yes_shares_atto = u256(int(pos.yes_shares_atto) + stake)
            market.yes_pool_atto = u256(int(market.yes_pool_atto) + stake)
        else:
            pos.no_shares_atto = u256(int(pos.no_shares_atto) + stake)
            market.no_pool_atto = u256(int(market.no_pool_atto) + stake)

        self.tvl_atto = u256(int(self.tvl_atto) + stake)

    # ---------------------------------------------------------------- AI resolution

    @gl.public.write
    def resolve_market(self, market_id: int) -> str:
        market = self._require_market(market_id)
        if market.status == STATUS_RESOLVED:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Market already resolved")
        if _now_iso() < market.end_date:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Market end date not reached")

        question = market.question
        description = market.description
        key = str(market_id)
        stored_urls = self.market_urls.get(key)
        urls = [str(u) for u in stored_urls] if stored_urls is not None else []

        def leader_fn() -> dict:
            evidence_items = []
            signals = []
            for url in urls:
                try:
                    page = gl.nondet.web.render(url, mode="text")
                except Exception:
                    raise gl.vm.UserError(f"{ERROR_TRANSIENT} Failed to fetch {url}")

                prompt = f"""You are an impartial arbitrator for a prediction market.

QUESTION: {question}
CONTEXT: {description}

Decide the outcome using ONLY the page content below. Quote the exact text that
supports your decision. If the page does not settle the question, answer UNRESOLVED.
If the question is unanswerable or contradictory, answer INVALID.

PAGE CONTENT:
{page}

Respond with ONLY this JSON:
{{"signal": "YES or NO or UNRESOLVED or INVALID", "summary": "<=200 chars", "quoted_text": "supporting excerpt"}}"""

                analysis = _parse_llm_object(
                    gl.nondet.exec_prompt(prompt, response_format="json")
                )
                signal = _coerce_signal(analysis.get("signal"))
                signals.append(signal)
                evidence_items.append(
                    {
                        "source_url": url,
                        "summary": str(analysis.get("summary", "")),
                        "quoted_text": str(analysis.get("quoted_text", "")),
                        "signal": signal,
                    }
                )

            outcome = _aggregate_outcome(signals)
            return {"outcome": outcome, "evidence": evidence_items}

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)
            mine = leader_fn()
            return mine["outcome"] == leaders_res.calldata["outcome"]

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        outcome = str(result["outcome"])

        # Deterministic state commit - store evidence as JSON strings (certified pattern).
        now = _now_iso()
        log = self.market_evidence.get_or_insert_default(key)
        for item in result["evidence"]:
            log.append(json.dumps({"timestamp": now, **item}))

        market.outcome = outcome
        market.status = STATUS_RESOLVED
        market.resolved_at = now
        if int(self.count_active) > 0:
            self.count_active = u256(int(self.count_active) - 1)
        self.count_resolved = u256(int(self.count_resolved) + 1)
        return outcome

    # ---------------------------------------------------------------- settlement

    @gl.public.write
    def claim_winnings(self, market_id: int) -> int:
        market = self._require_market(market_id)
        if market.status != STATUS_RESOLVED:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Market not resolved")

        owner_hex = gl.message.sender_address.as_hex
        pos_key = self._pos_key(market_id, owner_hex)
        if pos_key not in self.positions:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No position in this market")

        pos = self.positions[pos_key]
        if pos.claimed:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Winnings already claimed")

        yes_shares = int(pos.yes_shares_atto)
        no_shares = int(pos.no_shares_atto)
        yes_pool = int(market.yes_pool_atto)
        no_pool = int(market.no_pool_atto)
        total_pool = yes_pool + no_pool
        outcome = market.outcome

        if outcome == OUTCOME_INVALID:
            payout = yes_shares + no_shares
        elif outcome == OUTCOME_YES:
            payout = (yes_shares * total_pool) // yes_pool if yes_pool > 0 else 0
        elif outcome == OUTCOME_NO:
            payout = (no_shares * total_pool) // no_pool if no_pool > 0 else 0
        else:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Market outcome is not payable")

        pos.claimed = True
        if payout <= 0:
            return 0

        if int(self.tvl_atto) >= payout:
            self.tvl_atto = u256(int(self.tvl_atto) - payout)
        else:
            self.tvl_atto = u256(0)

        gl.get_contract_at(gl.message.sender_address).emit_transfer(value=u256(payout))
        return int(payout)

    # ---------------------------------------------------------------- read models (views)

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "tvl_atto": str(int(self.tvl_atto)),
            "total_markets": len(self.market_ids),
            "active": int(self.count_active),
            "pending": int(self.count_pending),
            "resolved": int(self.count_resolved),
        }

    def _market_summary(self, market: Market) -> dict:
        yes_pool = int(market.yes_pool_atto)
        no_pool = int(market.no_pool_atto)
        total = yes_pool + no_pool
        yes_pct = (yes_pool * 10000) // total if total > 0 else 5000
        return {
            "id": int(market.id),
            "creator": market.creator.as_hex,
            "question": market.question,
            "category": market.category,
            "status": market.status,
            "outcome": market.outcome,
            "end_date": market.end_date,
            "created_at": market.created_at,
            "yes_pool_atto": str(yes_pool),
            "no_pool_atto": str(no_pool),
            "volume_atto": str(total),
            "yes_price_bps": yes_pct,
            "no_price_bps": 10000 - yes_pct,
        }

    @gl.public.view
    def get_markets(self) -> dict:
        """All market summaries keyed by market id (string)."""
        return {key: self._market_summary(self.markets[key]) for key in self.market_ids}

    @gl.public.view
    def get_market(self, market_id: int) -> dict:
        market = self._require_market(market_id)
        summary = self._market_summary(market)
        summary["description"] = market.description
        summary["resolved_at"] = market.resolved_at

        key = str(market_id)
        stored_urls = self.market_urls.get(key)
        summary["verification_urls"] = (
            [str(u) for u in stored_urls] if stored_urls is not None else []
        )

        log = self.market_evidence.get(key)
        summary["evidence_log"] = (
            [json.loads(str(e)) for e in log] if log is not None else []
        )
        return summary

    @gl.public.view
    def quote_bet(self, market_id: int, side: str, amount_atto: str) -> dict:
        market = self._require_market(market_id)
        amount = int(amount_atto)
        if amount <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Amount must be positive")

        chosen = side.strip().upper()
        yes_pool = int(market.yes_pool_atto)
        no_pool = int(market.no_pool_atto)
        if chosen == SIDE_YES:
            side_pool, total = yes_pool, yes_pool + no_pool
        elif chosen == SIDE_NO:
            side_pool, total = no_pool, yes_pool + no_pool
        else:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Side must be YES or NO")

        new_side = side_pool + amount
        new_total = total + amount
        payout = (amount * new_total) // new_side if new_side > 0 else 0
        roi_bps = ((payout - amount) * 10000) // amount if amount > 0 else 0
        return {
            "stake_atto": str(amount),
            "est_payout_atto": str(payout),
            "est_profit_atto": str(payout - amount),
            "roi_bps": roi_bps,
            "multiplier_bps": (payout * 10000) // amount if amount > 0 else 0,
        }

    @gl.public.view
    def get_position(self, market_id: int, user: str) -> dict:
        owner_hex = Address(user).as_hex
        pos_key = self._pos_key(market_id, owner_hex)
        if pos_key not in self.positions:
            return {"yes_shares_atto": "0", "no_shares_atto": "0", "claimed": False}
        pos = self.positions[pos_key]
        return {
            "yes_shares_atto": str(int(pos.yes_shares_atto)),
            "no_shares_atto": str(int(pos.no_shares_atto)),
            "claimed": pos.claimed,
        }

    @gl.public.view
    def get_user_portfolio(self, user: str) -> dict:
        owner_hex = Address(user).as_hex
        ids = self.user_markets.get(owner_hex)
        positions_out = []
        locked = 0
        if ids is not None:
            for mid_str in ids:
                key = str(mid_str)
                pos_key = key + "#" + owner_hex
                if pos_key not in self.positions or key not in self.markets:
                    continue
                pos = self.positions[pos_key]
                market = self.markets[key]
                yes_s = int(pos.yes_shares_atto)
                no_s = int(pos.no_shares_atto)
                locked += yes_s + no_s
                positions_out.append(
                    {
                        "market_id": int(market.id),
                        "question": market.question,
                        "status": market.status,
                        "outcome": market.outcome,
                        "yes_shares_atto": str(yes_s),
                        "no_shares_atto": str(no_s),
                        "claimed": pos.claimed,
                    }
                )
        return {
            "user": owner_hex,
            "locked_atto": str(locked),
            "position_count": len(positions_out),
            "positions": positions_out,
        }
