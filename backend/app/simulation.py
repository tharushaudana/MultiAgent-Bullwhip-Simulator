from __future__ import annotations

from typing import AsyncIterator, Optional

from .config import Config
from .engine import Engine
from .graph import build_week_graph
from .state import WeekSnapshot

_week_graph = None


def _get_week_graph():
    global _week_graph
    if _week_graph is None:
        _week_graph = build_week_graph()
    return _week_graph


async def run_simulation(config: Config) -> AsyncIterator[WeekSnapshot]:
    """One LangGraph invocation per week; the Engine persists across
    invocations and is the only thing carrying state week to week.
    """
    engine = Engine(config)
    graph = _get_week_graph()
    for week in range(config.weeks):
        result = await graph.ainvoke(
            {"engine": engine, "config": config, "week": week, "snapshot": None}
        )
        snapshot: Optional[WeekSnapshot] = result["snapshot"]
        assert snapshot is not None
        yield snapshot
