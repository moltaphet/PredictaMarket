"""Requirement 2 — placing YES/NO bets; integer parimutuel shares and pools update correctly."""

from conftest import (
    gen, addr_hex, create_market, place_bet,
    read_market, read_position, read_quote, read_portfolio, read_stats,
    warp_time,
)


def test_yes_bet_updates_pool_and_position(contract, direct_vm, direct_owner, direct_alice):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(30))

    m = read_market(contract, mid)
    assert m["yes_pool_atto"] == str(gen(80))   # 50 seed + 30
    assert m["no_pool_atto"] == str(gen(50))    # unchanged
    assert m["volume_atto"] == str(gen(130))

    pos = read_position(contract, mid, addr_hex(direct_alice))
    assert pos["yes_shares_atto"] == str(gen(30))
    assert pos["no_shares_atto"] == "0"
    assert pos["claimed"] is False


def test_no_bet_updates_pool_and_position(contract, direct_vm, direct_owner, direct_bob):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_bob, market_id=mid, side="NO", amount=gen(40))

    m = read_market(contract, mid)
    assert m["no_pool_atto"] == str(gen(90))
    assert m["yes_pool_atto"] == str(gen(50))

    pos = read_position(contract, mid, addr_hex(direct_bob))
    assert pos["no_shares_atto"] == str(gen(40))
    assert pos["yes_shares_atto"] == "0"


def test_repeated_bets_accumulate_shares(contract, direct_vm, direct_owner, direct_alice):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(10))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(15))

    pos = read_position(contract, mid, addr_hex(direct_alice))
    assert pos["yes_shares_atto"] == str(gen(25))
    assert read_market(contract, mid)["yes_pool_atto"] == str(gen(75))


def test_same_user_can_hold_both_sides(contract, direct_vm, direct_owner, direct_alice):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(20))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="NO", amount=gen(5))

    pos = read_position(contract, mid, addr_hex(direct_alice))
    assert pos["yes_shares_atto"] == str(gen(20))
    assert pos["no_shares_atto"] == str(gen(5))


def test_quote_bet_matches_closed_form_parimutuel(contract, direct_vm, direct_owner):
    # Fresh 50/50 market. Quote a 50 YES bet:
    #   side_pool=50, total=100 -> new_side=100, new_total=150
    #   payout = 50 * 150 // 100 = 75 ; profit = 25
    #   roi_bps = 25 * 10000 // 50 = 5000 ; multiplier_bps = 75 * 10000 // 50 = 15000
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    q = read_quote(contract, mid, "YES", str(gen(50)))
    assert q["stake_atto"] == str(gen(50))
    assert q["est_payout_atto"] == str(gen(75))
    assert q["est_profit_atto"] == str(gen(25))
    assert q["roi_bps"] == 5000
    assert q["multiplier_bps"] == 15000


def test_portfolio_tracks_positions_and_locked_value(
    contract, direct_vm, direct_owner, direct_alice
):
    mid1 = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    mid2 = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid1, side="YES", amount=gen(30))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid2, side="NO", amount=gen(20))

    portfolio = read_portfolio(contract, addr_hex(direct_alice))
    assert portfolio["user"].lower() == addr_hex(direct_alice)
    assert portfolio["position_count"] == 2
    # Locked value is the user's own stake only (excludes creator seed).
    assert portfolio["locked_atto"] == str(gen(50))
    by_market = {p["market_id"]: p for p in portfolio["positions"]}
    assert by_market[mid1]["yes_shares_atto"] == str(gen(30))
    assert by_market[mid2]["no_shares_atto"] == str(gen(20))


def test_tvl_includes_seed_and_bets(contract, direct_vm, direct_owner, direct_alice, direct_bob):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(30))
    place_bet(direct_vm, contract, sender=direct_bob, market_id=mid, side="NO", amount=gen(70))
    assert read_stats(contract)["tvl_atto"] == str(gen(200))


def test_bet_rejects_zero_value(contract, direct_vm, direct_owner, direct_alice):
    from conftest import T_BEFORE_END
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    warp_time(direct_vm, T_BEFORE_END)
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("Stake must be positive"):
        contract.place_bet(mid, "YES")


def test_bet_rejects_invalid_side(contract, direct_vm, direct_owner, direct_alice):
    from conftest import T_BEFORE_END
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    warp_time(direct_vm, T_BEFORE_END)
    direct_vm.sender = direct_alice
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("Side must be YES or NO"):
        contract.place_bet(mid, "MAYBE")
