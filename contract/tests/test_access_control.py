"""Requirement 4 — access controls: no betting after expiry, no premature/double
resolution, and guarded claims. Also covers unknown-market guards."""

from conftest import (
    URL_PRIMARY, T_BEFORE_END, T_AFTER_END, gen, addr_hex,
    create_market, place_bet, mock_page, mock_arbiter,
    read_position,
    warp_time,
)


def _resolve_yes(contract, direct_vm, owner, mid):
    warp_time(direct_vm, T_AFTER_END)
    direct_vm.sender = owner
    mock_page(direct_vm, URL_PRIMARY, "It happened.")
    mock_arbiter(direct_vm, "YES")
    return contract.resolve_market(mid)


def test_cannot_bet_after_end_date(contract, direct_vm, direct_owner, direct_alice):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    warp_time(direct_vm, T_AFTER_END)
    direct_vm.sender = direct_alice
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("Betting window has closed"):
        contract.place_bet(mid, "YES")


def test_can_bet_before_end_date(contract, direct_vm, direct_owner, direct_alice):
    # Positive control for the time gate above.
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES",
              amount=gen(10), at_time=T_BEFORE_END)
    assert read_position(contract, mid, addr_hex(direct_alice))["yes_shares_atto"] == str(gen(10))


def test_cannot_resolve_before_end_date(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    warp_time(direct_vm, T_BEFORE_END)
    direct_vm.sender = direct_owner
    mock_page(direct_vm, URL_PRIMARY, "It happened.")
    mock_arbiter(direct_vm, "YES")
    with direct_vm.expect_revert("end date not reached"):
        contract.resolve_market(mid)


def test_cannot_double_resolve(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    _resolve_yes(contract, direct_vm, direct_owner, mid)
    # Second attempt, mocks still present and time still past end.
    with direct_vm.expect_revert("already resolved"):
        contract.resolve_market(mid)


def test_cannot_bet_after_resolution(contract, direct_vm, direct_owner, direct_alice):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    _resolve_yes(contract, direct_vm, direct_owner, mid)
    # Even rewinding to before the end date, a resolved market is closed to betting.
    warp_time(direct_vm, T_BEFORE_END)
    direct_vm.sender = direct_alice
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("not open for betting"):
        contract.place_bet(mid, "YES")


def test_cannot_claim_before_resolution(contract, direct_vm, direct_owner, direct_alice):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(10))
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Market not resolved"):
        contract.claim_winnings(mid)


def test_cannot_double_claim(contract, direct_vm, direct_owner, direct_alice):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(50))
    _resolve_yes(contract, direct_vm, direct_owner, mid)

    direct_vm.sender = direct_alice
    contract.claim_winnings(mid)
    with direct_vm.expect_revert("already claimed"):
        contract.claim_winnings(mid)


def test_cannot_claim_without_position(contract, direct_vm, direct_owner, direct_alice, direct_bob):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    place_bet(direct_vm, contract, sender=direct_alice, market_id=mid, side="YES", amount=gen(50))
    _resolve_yes(contract, direct_vm, direct_owner, mid)

    direct_vm.sender = direct_bob  # never bet
    with direct_vm.expect_revert("No position in this market"):
        contract.claim_winnings(mid)


def test_unknown_market_guards(contract, direct_vm, direct_owner, direct_alice):
    warp_time(direct_vm, T_BEFORE_END)
    direct_vm.sender = direct_alice
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("Unknown market"):
        contract.place_bet(999, "YES")

    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("Unknown market"):
        contract.resolve_market(999)
