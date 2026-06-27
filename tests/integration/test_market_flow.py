"""Deterministic lifecycle flows against a live network — no LLM, no time travel.

Covers deploy -> create_market -> quote -> place_bet -> position/stats/portfolio views,
all of which run through real consensus. The AI-resolution path is exercised separately
in test_resolution.py (it needs the betting window to elapse + a live LLM call).
"""

from gltest import get_default_account
from gltest.assertions import tx_execution_succeeded

from conftest import deploy_market, future_window, gen


def test_create_market_bet_and_views():
    contract = deploy_market()
    creator = get_default_account()

    # Betting window comfortably in the future so place_bet stays open for the whole test.
    end_date, _ = future_window(3600)

    seed = gen(10)
    receipt = contract.create_market(
        args=[
            "Does example.com state it is for use in illustrative examples?",
            "Resolved from the linked evidence page.",
            "TECH",
            end_date,
            ["https://example.com"],
        ],
    ).transact(value=seed)
    assert tx_execution_succeeded(receipt)

    # next_id starts at 1, so the first market is id 1.
    market_id = 1
    market = contract.get_market(args=[market_id]).call()
    assert market["status"] == "ACTIVE"
    assert market["outcome"] == "UNRESOLVED"
    assert market["category"] == "TECH"
    assert market["verification_urls"] == ["https://example.com"]
    # Seed is split evenly across the YES/NO pools.
    assert int(market["yes_pool_atto"]) + int(market["no_pool_atto"]) == seed

    # quote_bet is a pure view: a YES stake should project a positive payout.
    stake = gen(5)
    quote = contract.quote_bet(args=[market_id, "YES", str(stake)]).call()
    assert int(quote["est_payout_atto"]) > 0
    assert int(quote["stake_atto"]) == stake

    # Place the YES bet through consensus.
    bet = contract.place_bet(args=[market_id, "YES"]).transact(value=stake)
    assert tx_execution_succeeded(bet)

    # Position reflects the stake.
    position = contract.get_position(args=[market_id, creator.address]).call()
    assert int(position["yes_shares_atto"]) == stake
    assert int(position["no_shares_atto"]) == 0
    assert position["claimed"] is False

    # The YES pool grew by the stake.
    market_after = contract.get_market(args=[market_id]).call()
    assert int(market_after["yes_pool_atto"]) == int(market["yes_pool_atto"]) + stake

    # Stats and portfolio aggregate the new state.
    stats = contract.get_stats().call()
    assert stats["active"] >= 1
    assert int(stats["tvl_atto"]) >= seed + stake

    portfolio = contract.get_user_portfolio(args=[creator.address]).call()
    assert portfolio["position_count"] >= 1
    assert int(portfolio["locked_atto"]) >= stake


def test_invalid_category_is_rejected():
    contract = deploy_market()
    end_date, _ = future_window(3600)

    receipt = contract.create_market(
        args=["Will it rain?", "desc", "WEATHER", end_date, ["https://example.com"]],
    ).transact(value=gen(10))

    # The contract raises a [EXPECTED] UserError for an unknown category — the
    # transaction should not succeed.
    assert not tx_execution_succeeded(receipt)
