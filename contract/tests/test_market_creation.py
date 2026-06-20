"""Requirement 1 — market creation with initial liquidity and correct setup parameters."""

from conftest import (
    URL_PRIMARY, URL_SECONDARY, T_END, gen, addr_hex, create_market,
    read_market, read_markets, read_stats,
)


def test_create_sets_all_parameters(contract, direct_vm, direct_owner):
    mid = create_market(
        direct_vm, contract, sender=direct_owner,
        question="Will BTC close above 100k on 2026-12-31?",
        description="Resolved from the linked exchange snapshot.",
        category="CRYPTO",
        end_date=T_END,
        urls=[URL_PRIMARY, URL_SECONDARY],
        liquidity=gen(100),
    )
    assert mid == 1

    m = read_market(contract, mid)
    assert m["question"] == "Will BTC close above 100k on 2026-12-31?"
    assert m["description"] == "Resolved from the linked exchange snapshot."
    assert m["category"] == "CRYPTO"
    assert m["status"] == "ACTIVE"
    assert m["outcome"] == "UNRESOLVED"
    assert m["end_date"] == T_END
    assert m["resolved_at"] == ""
    assert m["creator"].lower() == addr_hex(direct_owner)
    assert m["verification_urls"] == [URL_PRIMARY, URL_SECONDARY]
    assert m["evidence_log"] == []
    assert m["created_at"]  # non-empty ISO timestamp


def test_initial_liquidity_seeds_both_pools_equally(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(100))
    m = read_market(contract, mid)
    assert m["yes_pool_atto"] == str(gen(50))
    assert m["no_pool_atto"] == str(gen(50))
    assert m["volume_atto"] == str(gen(100))
    # 50/50 pools => implied 50% each, in basis points.
    assert m["yes_price_bps"] == 5000
    assert m["no_price_bps"] == 5000


def test_odd_liquidity_remainder_goes_to_no_pool(contract, direct_vm, direct_owner):
    # 3 atto -> yes = 3 // 2 = 1, no = 3 - 1 = 2. No value is ever lost.
    mid = create_market(direct_vm, contract, sender=direct_owner, liquidity=3)
    m = read_market(contract, mid)
    assert m["yes_pool_atto"] == "1"
    assert m["no_pool_atto"] == "2"
    assert int(m["yes_pool_atto"]) + int(m["no_pool_atto"]) == 3


def test_category_is_normalized_to_uppercase(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner, category="sports")
    assert read_market(contract, mid)["category"] == "SPORTS"


def test_ids_increment_and_stats_track(contract, direct_vm, direct_owner, direct_alice):
    create_market(direct_vm, contract, sender=direct_owner, liquidity=gen(10))
    second = create_market(direct_vm, contract, sender=direct_alice, liquidity=gen(20))
    assert second == 2

    stats = read_stats(contract)
    assert stats["total_markets"] == 2
    assert stats["active"] == 2
    assert stats["pending"] == 0
    assert stats["resolved"] == 0
    # TVL aggregates both seeds.
    assert stats["tvl_atto"] == str(gen(30))

    listed = read_markets(contract)
    assert [row["id"] for row in listed] == [1, 2]


def test_rejects_invalid_category(contract, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("Invalid category"):
        contract.create_market("Q?", "d", "WEATHER", T_END, [URL_PRIMARY])


def test_rejects_zero_liquidity(contract, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    direct_vm.value = 0
    with direct_vm.expect_revert("Initial liquidity must be positive"):
        contract.create_market("Q?", "d", "CRYPTO", T_END, [URL_PRIMARY])


def test_rejects_empty_question(contract, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("Question is required"):
        contract.create_market("   ", "d", "CRYPTO", T_END, [URL_PRIMARY])


def test_rejects_missing_verification_urls(contract, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("verification URL"):
        contract.create_market("Q?", "d", "CRYPTO", T_END, [])


def test_rejects_empty_end_date(contract, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    direct_vm.value = gen(10)
    with direct_vm.expect_revert("End date is required"):
        contract.create_market("Q?", "d", "CRYPTO", "", [URL_PRIMARY])
