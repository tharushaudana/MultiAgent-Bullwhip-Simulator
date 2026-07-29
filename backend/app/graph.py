from __future__ import annotations

from typing import Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from .agents import decide_tier
from .config import ROLES, Config
from .engine import Engine
from .state import WeekSnapshot


class WeekState(TypedDict):
    engine: Engine
    config: Config
    week: int
    snapshot: Optional[WeekSnapshot]


def deliver_node(state: WeekState) -> dict:
    engine = state["engine"]
    engine.deliver_shipments()
    engine.deliver_messages()
    engine.fill_orders(state["week"])
    # Staging area for this week's replies -- NOT part of the ledger. Kept on
    # the engine (not in graph state) so the four decide nodes, which run
    # concurrently within this superstep, don't need a LangGraph reducer to
    # merge writes to the same state key.
    engine.pending_replies = {}
    engine.pending_fallback = {}
    return {}


def make_decide_node(tier: int):
    role = ROLES[tier]

    async def decide_node(state: WeekState) -> dict:
        engine = state["engine"]
        config = state["config"]
        week = state["week"]
        payload = engine.payload_for(tier, week)
        response, used_fallback = await decide_tier(role, payload, config)
        # The only two ways an agent's intention reaches the ledger.
        engine.queue_order(tier, response.order)
        engine.queue_messages(tier, response.to_upstream, response.to_downstream)
        engine.pending_replies[tier] = response
        engine.pending_fallback[tier] = used_fallback
        return {}

    return decide_node


def commit_node(state: WeekState) -> dict:
    engine = state["engine"]
    week = state["week"]
    replies = [engine.pending_replies[i] for i in range(4)]
    fallback = [engine.pending_fallback[i] for i in range(4)]
    snapshot = engine.log(week, replies, fallback)
    return {"snapshot": snapshot}


def build_week_graph():
    graph = StateGraph(WeekState)
    graph.add_node("deliver", deliver_node)
    for tier in range(4):
        graph.add_node(f"decide_{tier}", make_decide_node(tier))
    graph.add_node("commit", commit_node)

    graph.add_edge(START, "deliver")
    for tier in range(4):
        graph.add_edge("deliver", f"decide_{tier}")
        graph.add_edge(f"decide_{tier}", "commit")
    graph.add_edge("commit", END)

    return graph.compile()
