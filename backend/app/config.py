from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

ROLES: tuple[str, ...] = ("Retailer", "Wholesaler", "Distributor", "Factory")
Role = Literal["Retailer", "Wholesaler", "Distributor", "Factory"]


class Config(BaseModel):
    weeks: int = 40
    demand_pattern: list[int] = Field(default_factory=lambda: [8] * 5 + [12] * 35)
    shipping_delay: int = 2
    message_delay: int = 1
    initial_inventory: int = 12
    initial_backlog: int = 0
    history_len: int = 5

    shared_visibility: bool = False
    chat_enabled: bool = False
    personality_tier: Optional[Role] = None

    model: str = "deepseek-v4-flash"
    speed: float = 1.0

    @model_validator(mode="after")
    def _fit_demand_pattern(self) -> "Config":
        n = len(self.demand_pattern)
        if n < self.weeks:
            self.demand_pattern = self.demand_pattern + [self.demand_pattern[-1]] * (self.weeks - n)
        elif n > self.weeks:
            self.demand_pattern = self.demand_pattern[: self.weeks]
        return self
