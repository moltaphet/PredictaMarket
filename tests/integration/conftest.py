"""Shared helpers and fixtures for the Predicta integration suite.

These tests deploy `PredictaMarket` to a live GenLayer network and exercise it through
real consensus (leader + validators), real `gl.nondet.web.render` scraping and real
`gl.nondet.exec_prompt` LLM arbitration. There is no mocking here — this is the
end-to-end counterpart to the deterministic direct-mode suite under `contract/tests/`.

Default network is studionet (see `gltest.config.yaml`). Run from the repo root:

    gltest tests/integration -c tests/integration/pytest.ini -v -s

Write methods return transaction receipts (use `.transact(value=...)` and assert with
`tx_execution_succeeded`); read/view methods return values directly via `.call()`.
"""

from datetime import datetime, timedelta, timezone

import pytest

from gltest import get_contract_factory

CONTRACT_NAME = "PredictaMarket"

ATTO = 1_000_000_000_000_000_000  # 10**18 — atto scaling for on-chain value


def gen(amount: float) -> int:
    """Whole GEN -> atto integer (the unit the contract counts value in)."""
    return int(amount * ATTO)


def iso_utc(when: datetime) -> str:
    """Format a datetime as the ISO-8601 UTC string the contract compares against.

    Matches the frontend's `Date.toISOString()` output ("...Z", millisecond precision).
    The contract compares `end_date` lexicographically against the consensus message
    datetime, so identical field layout is what matters.
    """
    return when.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def future_window(seconds: int) -> tuple[str, datetime]:
    """A betting deadline `seconds` from now. Returns (iso_string, deadline_datetime).

    The datetime is handed back so the resolution test can sleep until the window has
    actually closed before calling `resolve_market` (we cannot warp time on a real chain).
    """
    deadline = datetime.now(timezone.utc) + timedelta(seconds=seconds)
    return iso_utc(deadline), deadline


def deploy_market():
    """Deploy a fresh PredictaMarket (constructor takes no args). Returns the contract."""
    factory = get_contract_factory(CONTRACT_NAME)
    return factory.deploy(args=[])


@pytest.fixture
def market_contract():
    """A freshly deployed PredictaMarket on the active network."""
    return deploy_market()
