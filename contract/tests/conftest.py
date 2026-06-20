"""Shared fixtures and helpers for the Predicta direct-mode test suite.

These tests run against the GenLayer `gltest` direct-mode VM (in-memory, no server,
~30ms each). They exercise the real contract bytecode/logic with deterministic mocks
for the non-deterministic web + LLM calls, so the AI-resolution flow is fully
reproducible in CI.

Run from the repository root:

    python -m pytest contract/tests/ -v -p no:gltest

(`-p no:gltest` disables the network/integration plugin so only the direct-mode
plugin `gltest_direct` is active — no live network or LLM is required.)
"""

import json
import re
import sys

import pytest


def warp_time(direct_vm, iso: str) -> None:
    """Advance the simulated clock.

    The contract reads the transaction time from `gl.message_raw["datetime"]` (the native
    GenVM source). `vm.warp()` alone doesn't update that dict in direct mode, so we set it
    here too — mirroring how a real GenVM transaction carries its own datetime.
    """
    direct_vm.warp(iso)
    gl_mod = sys.modules.get("genlayer.gl")
    if gl_mod is not None and getattr(gl_mod, "message_raw", None) is not None:
        gl_mod.message_raw["datetime"] = iso

# --------------------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------------------

CONTRACT = "contract/PredictaMarket.py"

ATTO = 1_000_000_000_000_000_000  # 10**18

# Deterministic timeline. end_date is compared lexicographically against
# gl.message.datetime (both ISO-8601 UTC), which we drive with vm.warp(...).
T_BEFORE_END = "2026-06-01T00:00:00Z"
T_END = "2026-12-31T23:59:59Z"
T_AFTER_END = "2027-01-01T00:00:00Z"

# A canonical evidence URL used across tests.
URL_PRIMARY = "https://example.com/evidence/primary"
URL_SECONDARY = "https://example.com/evidence/secondary"


def gen(amount: float) -> int:
    """Whole GEN -> atto integer."""
    return int(amount * ATTO)


# --------------------------------------------------------------------------------------
# View readers. Public views return native dicts (standard GenLayer idiom). `get_markets`
# returns a dict keyed by id (like the official `get_bets`); tests want a list, so we
# flatten its values here.
# --------------------------------------------------------------------------------------


def read_markets(contract):
    return list(contract.get_markets().values())


def read_market(contract, market_id):
    return contract.get_market(market_id)


def read_stats(contract):
    return contract.get_stats()


def read_position(contract, market_id, user):
    return contract.get_position(market_id, user)


def read_portfolio(contract, user):
    return contract.get_user_portfolio(user)


def read_quote(contract, market_id, side, amount_atto):
    return contract.quote_bet(market_id, side, amount_atto)


def addr_hex(account) -> str:
    """Normalize an account fixture to a lowercase 0x-hex string.

    Fixtures come through as raw 20-byte `bytes` or as `Address`. `Address(hex)` parses
    any case and compares by bytes, so lowercase is a safe canonical form for both method
    args and (case-insensitive) assertions against the contract's checksummed output.
    """
    if isinstance(account, bytes):
        return "0x" + account.hex()
    if hasattr(account, "as_bytes"):
        return "0x" + bytes(account.as_bytes).hex()
    if hasattr(account, "as_hex"):
        return account.as_hex.lower()
    return str(account).lower()


# --------------------------------------------------------------------------------------
# Mock helpers
# --------------------------------------------------------------------------------------


def mock_page(vm, url: str, body: str) -> None:
    """Mock `gl.nondet.web.render(url, mode="text")` so it returns `body` as page text."""
    vm.mock_web(re.escape(url), {"status": 200, "body": body})


def mock_arbiter(vm, signal: str, *, page_marker: str | None = None,
                 summary: str = "auto", quote: str = "auto") -> None:
    """Mock the arbitration LLM call.

    The contract prompt always contains the phrase "impartial arbitrator" and embeds the
    scraped page text under "PAGE CONTENT:". By default we match every arbitration prompt;
    pass `page_marker` to bind this mock to a specific page's content (so different URLs in
    one resolution can yield different signals).
    """
    pattern = re.escape(page_marker) if page_marker else r"impartial arbitrator"
    payload = json.dumps(
        {
            "signal": signal,
            "summary": summary if summary != "auto" else f"Derived signal {signal}",
            "quoted_text": quote if quote != "auto" else f"evidence for {signal}",
        }
    )
    vm.mock_llm(pattern, payload)


def create_market(
    vm,
    contract,
    *,
    sender,
    question: str = "Will the test event happen?",
    description: str = "Resolved from the linked evidence page.",
    category: str = "CRYPTO",
    end_date: str = T_END,
    urls=None,
    liquidity: int = gen(100),
) -> int:
    """Create a market as `sender` with `liquidity` atto of seed value. Returns market id."""
    vm.sender = sender
    vm.value = liquidity
    if urls is None:
        urls = [URL_PRIMARY]
    market_id = contract.create_market(question, description, category, end_date, urls)
    vm.value = 0
    return market_id


def place_bet(vm, contract, *, sender, market_id: int, side: str, amount: int,
              at_time: str = T_BEFORE_END):
    """Place a bet as `sender` for `amount` atto on `side`, at simulated time `at_time`."""
    warp_time(vm, at_time)
    vm.sender = sender
    vm.value = amount
    result = contract.place_bet(market_id, side)
    vm.value = 0
    return result


# --------------------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------------------


@pytest.fixture
def contract(direct_deploy, direct_vm, direct_owner):
    """A freshly deployed PredictaMarket, deployed by `direct_owner`."""
    direct_vm.sender = direct_owner
    return direct_deploy(CONTRACT)
