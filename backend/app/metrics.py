from __future__ import annotations

from typing import Optional, TypedDict

import numpy as np

# Urgency lexicon: substring -> weight in [0, 1]. Longer/more specific phrases
# are listed alongside their component words so "running dry" scores higher
# than a lone "dry" would.
URGENCY_TERMS: dict[str, float] = {
    "critical": 1.0,
    "emergency": 1.0,
    "desperate": 0.9,
    "urgent": 0.9,
    "urgently": 0.9,
    "running dry": 0.9,
    "out of stock": 0.9,
    "running low": 0.7,
    "shortage": 0.8,
    "please rush": 0.7,
    "rush": 0.6,
    "asap": 0.6,
    "immediately": 0.6,
    "short": 0.6,
    "behind": 0.4,
    "backlogged": 0.5,
    "prioritize": 0.5,
    "need more": 0.4,
    "double": 0.3,
    "increase": 0.2,
}

# Position (inventory - backlog) at/above which a tier is considered fully
# healthy, and at/below which it is considered fully justified in panicking.
HEALTHY_POSITION = 10


class ClaimRecord(TypedDict):
    text: str
    inventory: int
    backlog: int


def amplification_ratio(customer_demand: list[int], factory_orders: list[int]) -> Optional[float]:
    """variance(factory orders) / variance(customer demand).

    Undefined (None) until customer demand has actually varied -- dividing by
    a flat-demand variance of zero would be meaningless, not infinite chaos.
    """
    if len(customer_demand) < 2 or len(factory_orders) < 2:
        return None
    demand_var = float(np.var(customer_demand))
    if demand_var == 0.0:
        return None
    order_var = float(np.var(factory_orders))
    return order_var / demand_var


def message_urgency(text: str) -> float:
    if not text:
        return 0.0
    lowered = text.lower()
    best = 0.0
    for term, weight in URGENCY_TERMS.items():
        if term in lowered:
            best = max(best, weight)
    return best


def inventory_health(inventory: int, backlog: int, healthy_position: int = HEALTHY_POSITION) -> float:
    """1.0 = comfortable stock, 0.0 = deeply backlogged. Linear between."""
    position = inventory - backlog
    normalized = (position + healthy_position) / (2 * healthy_position)
    return max(0.0, min(1.0, normalized))


def claim_inflation(messages: list[ClaimRecord]) -> Optional[float]:
    """Mean over-statement of urgency relative to real inventory health.

    Only messages that both (a) use urgent language and (b) come from a tier
    sitting on comfortable stock contribute -- this is the detectable
    strategic-misrepresentation signal, not a general urgency average.
    """
    inflations: list[float] = []
    for m in messages:
        urgency = message_urgency(m["text"])
        if urgency == 0.0:
            continue
        health = inventory_health(m["inventory"], m["backlog"])
        inflation = max(0.0, urgency - (1 - health))
        if inflation > 0.0:
            inflations.append(inflation)
    if not inflations:
        return 0.0
    return sum(inflations) / len(inflations)
