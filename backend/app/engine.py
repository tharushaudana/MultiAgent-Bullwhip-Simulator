from __future__ import annotations

from collections import deque
from typing import Union

from .config import ROLES, Config
from .metrics import amplification_ratio, claim_inflation
from .state import AgentResponse, LatestQuote, Message, Payload, TierSnapshot, WeekSnapshot

N_TIERS = len(ROLES)

ReplyLike = Union[AgentResponse, dict]


def _field(reply: ReplyLike, name: str, default=""):
    if isinstance(reply, AgentResponse):
        return getattr(reply, name)
    return reply.get(name, default)


class Engine:
    """Holds all supply-chain truth. Agents read it via payload_for() and can
    only ever push intentions back in through queue_order/queue_messages --
    they never touch inventory, backlog, or the pipelines directly.
    """

    def __init__(self, config: Config):
        self.config = config
        n = N_TIERS

        self.inventory: list[int] = [config.initial_inventory] * n
        self.backlog: list[int] = [config.initial_backlog] * n

        seed_order = config.demand_pattern[0]
        self.order_placed: list[int] = [seed_order] * n
        self.shipment_pipeline: list[deque[int]] = [
            deque([seed_order] * config.shipping_delay) for _ in range(n)
        ]
        self.message_pipeline: list[deque[list[dict]]] = [
            deque([[] for _ in range(config.message_delay)]) for _ in range(n)
        ]
        self.my_recent_orders: list[deque[int]] = [
            deque([seed_order] * config.history_len, maxlen=config.history_len) for _ in range(n)
        ]

        self.inbox: list[list[Message]] = [[] for _ in range(n)]
        self.arriving_this_week: list[int] = [0] * n
        self.demand_this_week: list[int] = [0] * n
        self._prev_orders: list[int] = list(self.order_placed)
        self._outgoing: list[list[dict]] = [[] for _ in range(n)]

        self.customer_demand_log: list[int] = []
        self.factory_orders_log: list[int] = []
        self.all_messages_log: list[dict] = []
        self.logs: list[WeekSnapshot] = []

    # -- one week, in order -------------------------------------------------

    def deliver_shipments(self) -> None:
        for i in range(N_TIERS):
            self.arriving_this_week[i] = self.shipment_pipeline[i].popleft()
            self.inventory[i] += self.arriving_this_week[i]

    def deliver_messages(self) -> None:
        for i in range(N_TIERS):
            self.inbox[i] = [Message.model_validate(m) for m in self.message_pipeline[i].popleft()]

    def fill_orders(self, week: int) -> None:
        self._prev_orders = list(self.order_placed)

        demand = [0] * N_TIERS
        demand[0] = self.config.demand_pattern[week]
        for i in range(1, N_TIERS):
            demand[i] = self.order_placed[i - 1]
        self.demand_this_week = demand

        shipped = [0] * N_TIERS
        for i in range(N_TIERS):
            self.backlog[i] += demand[i]
            shipped[i] = min(self.inventory[i], self.backlog[i])
            self.inventory[i] -= shipped[i]
            self.backlog[i] -= shipped[i]

        # Each tier's shipment lands in its downstream neighbor's pipeline.
        for i in range(1, N_TIERS):
            self.shipment_pipeline[i - 1].append(shipped[i])
        # Factory's own inventory is replenished by unlimited "production",
        # which always ships exactly what the Factory ordered, still subject
        # to the shipping delay.
        self.shipment_pipeline[N_TIERS - 1].append(self.order_placed[N_TIERS - 1])

    def payload_for(self, tier: int, week: int) -> Payload:
        payload = Payload(
            role=ROLES[tier],
            week=week,
            inventory=self.inventory[tier],
            backlog=self.backlog[tier],
            arriving_this_week=self.arriving_this_week[tier],
            order_from_downstream=self.demand_this_week[tier],
            my_recent_orders=list(self.my_recent_orders[tier]),
            inbox=list(self.inbox[tier]) if self.config.chat_enabled else [],
        )
        if self.config.shared_visibility:
            payload.real_customer_demand = self.demand_this_week[0]
        return payload

    def queue_order(self, tier: int, order: int) -> None:
        order = max(0, order)
        self.order_placed[tier] = order
        self.my_recent_orders[tier].append(order)

    def queue_messages(self, tier: int, to_upstream: str, to_downstream: str) -> None:
        if tier < N_TIERS - 1 and to_upstream:
            self._outgoing[tier + 1].append({"from": ROLES[tier], "text": to_upstream})
        if tier > 0 and to_downstream:
            self._outgoing[tier - 1].append({"from": ROLES[tier], "text": to_downstream})

    def log(self, week: int, replies: list[ReplyLike], fallback_flags: list[bool] | None = None) -> WeekSnapshot:
        for i in range(N_TIERS):
            self.message_pipeline[i].append(self._outgoing[i])
        self._outgoing = [[] for _ in range(N_TIERS)]

        tiers: list[TierSnapshot] = []
        for i in range(N_TIERS):
            reply = replies[i]
            to_up = _field(reply, "to_upstream")
            to_down = _field(reply, "to_downstream")
            tiers.append(
                TierSnapshot(
                    role=ROLES[i],
                    inventory=self.inventory[i],
                    backlog=self.backlog[i],
                    order=_field(reply, "order", 0),
                    arriving_this_week=self.arriving_this_week[i],
                    order_from_downstream=self.demand_this_week[i],
                    to_upstream=to_up,
                    to_downstream=to_down,
                    reasoning=_field(reply, "reasoning"),
                    fallback=fallback_flags[i] if fallback_flags else False,
                )
            )
            for msg_text in (to_up, to_down):
                if msg_text:
                    self.all_messages_log.append(
                        {"text": msg_text, "inventory": self.inventory[i], "backlog": self.backlog[i]}
                    )

        self.customer_demand_log.append(self.demand_this_week[0])
        self.factory_orders_log.append(tiers[N_TIERS - 1].order)

        amp = amplification_ratio(self.customer_demand_log, self.factory_orders_log)
        inflation = claim_inflation(self.all_messages_log)

        deltas = [abs(tiers[i].order - self._prev_orders[i]) for i in range(N_TIERS)]
        latest_idx = max(range(N_TIERS), key=lambda i: deltas[i])
        latest_quote = LatestQuote(role=ROLES[latest_idx], reasoning=tiers[latest_idx].reasoning)

        snapshot = WeekSnapshot(
            week=week,
            customer_demand=self.demand_this_week[0],
            tiers=tiers,
            amplification_ratio=amp,
            claim_inflation=inflation,
            latest_quote=latest_quote,
        )
        self.logs.append(snapshot)
        return snapshot
