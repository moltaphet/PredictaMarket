"""Requirement 2/3 — parimutuel settlement: winners split the whole pool, losers get
nothing, INVALID refunds stake. Exercises the native payout path (`emit_transfer`)."""

from conftest import (
    URL_PRIMARY, T_AFTER_END, gen, addr_hex,
    create_market, place_bet, mock_page, mock_arbiter,
    read_position,
    warp_time,
)


def _resolve(contract, direct_vm, owner, mid, signal):
    warp_time(direct_vm, T_AFTER_END)
    direct_vm.sender = owner
    mock_page(direct_vm, URL_PRIMARY, f"Resolved as {signal}.")
    mock_arbiter(direct_vm, signal)
    return contract.resolve_market(mid)


def test_winner_claims_proportional_share_of_whole_pool(
    contract, direct_vm, direct_owner, direct_alice, direct_bob
):
    # Seed 100 (50/50). Alice +50 YES -> yes_pool 100. Bob +50 NO -> no_pool 100.
    # total_pool = 200. Outcome YES. Alice owns all YES shares (50) of yes_pool (100).
    # payout = 50 * 200 // 100 = 100.
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(50))
    place_bet(direct_vm, contract, sender=direct_bob, market_id=mid, side="NO", amount=gen(50))
    _resolve(contract, direct_vm, direct_owner, mid, "YES")

    direct_vm.sender = direct_alice
    payout = contract.claim_winnings(mid)
    assert payout == gen(100)
    assert read_position(contract, mid, addr_hex(direct_alice))["claimed"] is True


def test_loser_claims_nothing(contract, direct_vm, direct_owner, direct_alice, direct_bob):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(50))
    place_bet(direct_vm, contract, sender=direct_bob, market_id=mid, side="NO", amount=gen(50))
    _resolve(contract, direct_vm, direct_owner, mid, "YES")

    # Bob bet NO; outcome was YES -> zero payout, but his position is marked settled.
    direct_vm.sender = direct_bob
    payout = contract.claim_winnings(mid)
    assert payout == 0
    assert read_position(contract, mid, addr_hex(direct_bob))["claimed"] is True


def test_invalid_outcome_refunds_full_stake(
    contract, direct_vm, direct_owner, direct_alice
):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(20))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="NO", amount=gen(5))
    _resolve(contract, direct_vm, direct_owner, mid, "INVALID")

    direct_vm.sender = direct_alice
    # Refund is the user's combined stake on both sides: 20 + 5 = 25.
    assert contract.claim_winnings(mid) == gen(25)


def test_two_winners_split_pool_pro_rata(
    contract, direct_vm, direct_owner, direct_alice, direct_bob, direct_charlie
):
    # Seed 100 (50/50). Alice +50 YES, Bob +50 YES -> yes_pool 150.
    # Charlie +50 NO -> no_pool 100. total = 250. Outcome YES.
    # Each YES better owns 50 of yes_pool 150: payout = 50 * 250 // 150 = 83.33 -> 83 (floor).
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(50))
    place_bet(direct_vm, contract, sender=direct_bob, market_id=mid, side="YES", amount=gen(50))
    place_bet(direct_vm, contract, sender=direct_charlie, market_id=mid, side="NO", amount=gen(50))
    _resolve(contract, direct_vm, direct_owner, mid, "YES")

    expected = (gen(50) * gen(250)) // gen(150)
    direct_vm.sender = direct_alice
    assert contract.claim_winnings(mid) == expected
    direct_vm.sender = direct_bob
    assert contract.claim_winnings(mid) == expected
