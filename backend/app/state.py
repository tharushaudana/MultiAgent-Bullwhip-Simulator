from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import Role


class Message(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sender: str = Field(alias="from")
    text: str


class Payload(BaseModel):
    """What one agent receives on one turn. The blindness is the experiment."""

    role: Role
    week: int
    inventory: int
    backlog: int
    arriving_this_week: int
    order_from_downstream: int
    my_recent_orders: list[int]
    inbox: list[Message]
    real_customer_demand: Optional[int] = None


class AgentResponse(BaseModel):
    """What the agent returns. The engine never lets this touch the ledger directly."""

    order: int
    to_upstream: str = ""
    to_downstream: str = ""
    reasoning: str = ""

    @field_validator("order")
    @classmethod
    def _non_negative(cls, v: int) -> int:
        return max(0, v)


class TierSnapshot(BaseModel):
    role: Role
    inventory: int
    backlog: int
    order: int
    arriving_this_week: int
    order_from_downstream: int
    to_upstream: str
    to_downstream: str
    reasoning: str
    fallback: bool = False


class LatestQuote(BaseModel):
    role: Role
    reasoning: str


class WeekSnapshot(BaseModel):
    week: int
    customer_demand: int
    tiers: list[TierSnapshot]
    amplification_ratio: Optional[float] = None
    claim_inflation: Optional[float] = None
    latest_quote: Optional[LatestQuote] = None
