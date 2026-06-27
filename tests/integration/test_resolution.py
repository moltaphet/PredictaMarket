"""End-to-end AI resolution against a live network — real web scrape + real LLM.

This is the full Predicta lifecycle with nothing mocked:

    create_market -> place_bet (YES + NO) -> [window closes] -> resolve_market -> claim

`resolve_market` runs `gl.vm.run_nondet_unsafe`: the leader scrapes every verification
URL with `gl.nondet.web.render` and arbitrates each with `gl.nondet.exec_prompt`, then
validators independently re-run and must agree on the outcome — i.e. this asserts real
consensus over a real LLM call.

We point the market at https://example.com, whose body is stable and unambiguous
("This domain is for use in illustrative examples in documents..."), and ask a question
that page plainly answers YES. We then verify the winner (YES) can claim a payout and the
loser (NO) cannot — observed via the contract's TVL accounting.

Marked `slow`: it deploys, sends several consensus transactions, and waits for the betting
window to close before resolving, so it can take a few minutes. Run it explicitly with:

    gltest tests/integration -c tests/integration/pytest.ini -v -s -m slow
"""

import time
from datetime import datetime, timezone

import pytest

from gltest import create_account, get_default_account
from gltest.assertions import tx_execution_succeeded

from conftest import deploy_market, future_window, gen

# Long enough to deploy + place two consensus bets before the window shuts, but short
# enough that the post-bet wait stays reasonable.
BETTING_WINDOW_SECONDS = 90
WINDOW_CLOSE_BUFFER_SECONDS = 8


def _sleep_until_window_closed(deadline: datetime) -> None:
    """Block until the on-chain clock is safely past `deadline`."""
    remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
    wait = max(0.0, remaining) + WINDOW_CLOSE_BUFFER_SECONDS
    if wait:
        time.sleep(wait)


@pytest.mark.slow
def test_full_resolution_and_settlement():
    contract = deploy_market()
    yes_bettor = get_default_account()
    no_bettor = create_account()

    end_date, deadline = future_window(BETTING_WINDOW_SECONDS)

    # 1. Create a market whose evidence page (example.com) unambiguously answers YES.
    seed = gen(10)
    created = contract.create_market(
        args=[
            "Does this page state the domain is for use in illustrative examples?",
            "Resolve YES if the linked page says it exists to be used in examples.",
            "TECH",
            end_date,
            ["https://example.com"],
        ],
    ).transact(value=seed)
    assert tx_execution_succeeded(created)
    market_id = 1

    # 2. Bets on both sides, from two different accounts, while the window is open.
    yes_stake = gen(6)
    no_stake = gen(4)
    yes_bet = contract.connect(yes_bettor).place_bet(args=[market_id, "YES"]).transact(value=yes_stake)
    assert tx_execution_succeeded(yes_bet)
    no_bet = contract.connect(no_bettor).place_bet(args=[market_id, "NO"]).transact(value=no_stake)
    assert tx_execution_succeeded(no_bet)

    # 3. Wait for the betting window to close (cannot warp time on a live chain).
    _sleep_until_window_closed(deadline)

    # 4. Resolve via real web scrape + real LLM arbitration + validator consensus.
    resolved = contract.resolve_market(args=[market_id]).transact()
    assert tx_execution_succeeded(resolved)

    market = contract.get_market(args=[market_id]).call()
    assert market["status"] == "RESOLVED"
    # The page plainly supports YES; the LLM should agree.
    assert market["outcome"] == "YES", f"unexpected outcome: {market['outcome']}"
    # Evidence from the live scrape/arbitration is logged on-chain.
    assert len(market["evidence_log"]) >= 1
    assert market["evidence_log"][0]["source_url"] == "https://example.com"

    # 5. Settlement: the winner (YES) draws a payout, the loser (NO) draws nothing.
    #    We observe this through TVL, which drops only when value is actually paid out.
    tvl_before_claims = int(contract.get_stats().call()["tvl_atto"])

    yes_claim = contract.connect(yes_bettor).claim_winnings(args=[market_id]).transact()
    assert tx_execution_succeeded(yes_claim)
    tvl_after_yes = int(contract.get_stats().call()["tvl_atto"])
    assert tvl_after_yes < tvl_before_claims, "winning YES claim should pay out (TVL drops)"

    no_claim = contract.connect(no_bettor).claim_winnings(args=[market_id]).transact()
    assert tx_execution_succeeded(no_claim)
    tvl_after_no = int(contract.get_stats().call()["tvl_atto"])
    assert tvl_after_no == tvl_after_yes, "losing NO claim should pay nothing (TVL flat)"

    # Both positions are now marked claimed.
    yes_pos = contract.get_position(args=[market_id, yes_bettor.address]).call()
    no_pos = contract.get_position(args=[market_id, no_bettor.address]).call()
    assert yes_pos["claimed"] is True
    assert no_pos["claimed"] is True
