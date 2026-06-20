"""Requirement 3 — the non-deterministic AI resolution flow.

Each test drives the full consensus-safe path: the leader scrapes the evidence URL
(`gl.nondet.web.render`, mocked), runs the arbitration prompt (`gl.nondet.exec_prompt`,
mocked), and the contract folds per-source signals into a deterministic YES / NO /
INVALID outcome. `direct_vm.run_validator()` replays the captured validator to assert the
consensus guard: validators agree on the derived enum, never on raw LLM text.
"""

from conftest import (
    URL_PRIMARY, URL_SECONDARY, T_AFTER_END,
    create_market, mock_page, mock_arbiter,
    read_market, read_stats,
    warp_time,
)


def _resolve(contract, direct_vm, sender, mid):
    warp_time(direct_vm, T_AFTER_END)
    direct_vm.sender = sender
    return contract.resolve_market(mid)


def test_resolves_to_yes_with_evidence_logged(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "Official result: the event HAPPENED. Confirmed.")
    mock_arbiter(direct_vm, "YES", summary="Event confirmed by the source",
                 quote="the event HAPPENED")

    outcome = _resolve(contract, direct_vm, direct_owner, mid)
    assert outcome == "YES"

    m = read_market(contract, mid)
    assert m["status"] == "RESOLVED"
    assert m["outcome"] == "YES"
    assert m["resolved_at"]
    assert len(m["evidence_log"]) == 1
    ev = m["evidence_log"][0]
    assert ev["signal"] == "YES"
    assert ev["source_url"] == URL_PRIMARY
    assert ev["summary"] == "Event confirmed by the source"
    assert ev["quoted_text"] == "the event HAPPENED"

    stats = read_stats(contract)
    assert stats["resolved"] == 1
    assert stats["active"] == 0


def test_resolves_to_no(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "Official result: the event DID NOT occur.")
    mock_arbiter(direct_vm, "NO")
    assert _resolve(contract, direct_vm, direct_owner, mid) == "NO"
    assert read_market(contract, mid)["outcome"] == "NO"


def test_single_invalid_signal_resolves_invalid(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "The page is contradictory and unanswerable.")
    mock_arbiter(direct_vm, "INVALID")
    assert _resolve(contract, direct_vm, direct_owner, mid) == "INVALID"


def test_conflicting_sources_resolve_invalid(contract, direct_vm, direct_owner):
    # Two sources disagree (one YES, one NO) -> tie -> INVALID.
    mid = create_market(direct_vm, contract, sender=direct_owner,
                        urls=[URL_PRIMARY, URL_SECONDARY])
    mock_page(direct_vm, URL_PRIMARY, "SOURCE_A says it happened")
    mock_page(direct_vm, URL_SECONDARY, "SOURCE_B says it did not")
    mock_arbiter(direct_vm, "YES", page_marker="SOURCE_A says it happened")
    mock_arbiter(direct_vm, "NO", page_marker="SOURCE_B says it did not")

    assert _resolve(contract, direct_vm, direct_owner, mid) == "INVALID"
    assert len(read_market(contract, mid)["evidence_log"]) == 2


def test_majority_signal_wins(contract, direct_vm, direct_owner):
    # Three sources: YES, YES, NO -> majority YES.
    urls = [URL_PRIMARY, URL_SECONDARY, "https://example.com/evidence/third"]
    mid = create_market(direct_vm, contract, sender=direct_owner, urls=urls)
    mock_page(direct_vm, urls[0], "PAGE_ONE happened")
    mock_page(direct_vm, urls[1], "PAGE_TWO happened")
    mock_page(direct_vm, urls[2], "PAGE_THREE did not")
    mock_arbiter(direct_vm, "YES", page_marker="PAGE_ONE happened")
    mock_arbiter(direct_vm, "YES", page_marker="PAGE_TWO happened")
    mock_arbiter(direct_vm, "NO", page_marker="PAGE_THREE did not")

    assert _resolve(contract, direct_vm, direct_owner, mid) == "YES"


def test_unresolvable_event_reverts_and_stays_active(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "No information about the event yet.")
    mock_arbiter(direct_vm, "UNRESOLVED")

    warp_time(direct_vm, T_AFTER_END)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("not yet resolvable"):
        contract.resolve_market(mid)

    # The market is untouched and can be resolved later.
    m = read_market(contract, mid)
    assert m["status"] == "ACTIVE"
    assert m["outcome"] == "UNRESOLVED"


# --------------------------------------------------------------------------------------
# Consensus guard — validators agree on the derived enum, not raw LLM strings
# --------------------------------------------------------------------------------------


def test_validator_agrees_on_identical_outcome(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "It happened.")
    mock_arbiter(direct_vm, "YES")
    _resolve(contract, direct_vm, direct_owner, mid)

    # Validator re-runs the leader against the same evidence -> same outcome -> agree.
    assert direct_vm.run_validator() is True


def test_validator_agrees_despite_different_wording_same_signal(
    contract, direct_vm, direct_owner
):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "It happened.")
    mock_arbiter(direct_vm, "YES", summary="leader phrasing", quote="leader quote")
    _resolve(contract, direct_vm, direct_owner, mid)

    # Validator sees the SAME signal but completely different free-text fields.
    # Consensus is on the enum only, so it must still agree.
    direct_vm.clear_mocks()
    mock_page(direct_vm, URL_PRIMARY, "A totally differently worded confirmation page.")
    mock_arbiter(direct_vm, "YES", summary="validator phrasing", quote="validator quote")
    assert direct_vm.run_validator() is True


def test_validator_disagrees_on_different_outcome(contract, direct_vm, direct_owner):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "It happened.")
    mock_arbiter(direct_vm, "YES")
    _resolve(contract, direct_vm, direct_owner, mid)

    # Validator derives a DIFFERENT outcome -> disagree -> consensus rotation.
    direct_vm.clear_mocks()
    mock_page(direct_vm, URL_PRIMARY, "Actually it did not happen.")
    mock_arbiter(direct_vm, "NO")
    assert direct_vm.run_validator() is False


def test_validator_disagrees_when_leader_errors_but_validator_resolves(
    contract, direct_vm, direct_owner
):
    mid = create_market(direct_vm, contract, sender=direct_owner)
    mock_page(direct_vm, URL_PRIMARY, "It happened.")
    mock_arbiter(direct_vm, "YES")
    _resolve(contract, direct_vm, direct_owner, mid)

    # Simulate the leader having failed while the validator can resolve cleanly.
    # Mismatched success/failure must not reach consensus.
    assert direct_vm.run_validator(leader_error=RuntimeError("[LLM_ERROR] leader hiccup")) is False
