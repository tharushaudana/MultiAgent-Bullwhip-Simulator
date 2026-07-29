import pytest

from app.metrics import amplification_ratio, claim_inflation, inventory_health, message_urgency


def test_amplification_ratio_basic():
    # customer var = 1.0, factory var = 9.0 -> ratio 9.0
    assert amplification_ratio([8, 10], [8, 14]) == pytest.approx(9.0)


def test_amplification_ratio_undefined_when_too_short():
    assert amplification_ratio([8], [8]) is None
    assert amplification_ratio([], []) is None


def test_amplification_ratio_undefined_when_demand_flat():
    # No variance in customer demand yet -> ratio is meaningless, not infinite
    assert amplification_ratio([8, 8, 8], [8, 10, 14]) is None


def test_message_urgency_terms():
    assert message_urgency("shipment is on the way, all good") == 0.0
    assert message_urgency("I'm running low on stock") == pytest.approx(0.7)
    assert message_urgency("this is critical, please rush") == pytest.approx(1.0)
    assert message_urgency("") == 0.0


def test_inventory_health_bounds():
    assert inventory_health(inventory=100, backlog=0) == 1.0  # clipped at healthy ceiling
    assert inventory_health(inventory=0, backlog=100) == 0.0  # clipped at unhealthy floor
    assert inventory_health(inventory=10, backlog=10) == 0.5  # position 0 -> midpoint


def test_claim_inflation_flags_exaggeration_but_not_honest_urgency():
    messages = [
        # comfortable stock (position=20, health=1.0) claiming top urgency -> fully inflated
        {"text": "I'm critically short", "inventory": 20, "backlog": 0},
        # genuinely backlogged (position=-15, health=0.0) using urgent language -> justified, excluded
        {"text": "we are desperate here", "inventory": 0, "backlog": 15},
        # no urgency language at all -> excluded regardless of stock level
        {"text": "shipment on the way", "inventory": 20, "backlog": 0},
    ]
    # Only the first message contributes: max(0, 1.0 - (1 - 1.0)) == 1.0
    assert claim_inflation(messages) == pytest.approx(1.0)


def test_claim_inflation_zero_when_no_claims():
    assert claim_inflation([]) == 0.0
    assert claim_inflation([{"text": "all fine", "inventory": 5, "backlog": 5}]) == 0.0
