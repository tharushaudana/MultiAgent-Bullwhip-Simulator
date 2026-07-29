from __future__ import annotations

from typing import Callable

from .config import Config

ConditionFactory = Callable[[], Config]

CONDITIONS: dict[str, ConditionFactory] = {
    "baseline": lambda: Config(),
    "shared_visibility": lambda: Config(shared_visibility=True),
    "chat_enabled": lambda: Config(chat_enabled=True),
    "personality": lambda: Config(chat_enabled=True, personality_tier="Wholesaler"),
}

CONDITION_LABELS: dict[str, str] = {
    "baseline": "Baseline — each tier sees only its immediate downstream order",
    "shared_visibility": "Shared visibility — every tier sees real customer demand",
    "chat_enabled": "Chat enabled — tiers exchange free-text messages, 1-week delay",
    "personality": "Personality — Wholesaler is prompted risk-averse, chat enabled",
}


def build_config(condition: str, **overrides) -> Config:
    if condition not in CONDITIONS:
        raise ValueError(f"unknown condition: {condition!r}. Choices: {sorted(CONDITIONS)}")
    config = CONDITIONS[condition]()
    if overrides:
        merged = config.model_dump()
        merged.update(overrides)
        config = Config(**merged)  # re-run validators (e.g. demand_pattern refit to weeks)
    return config
