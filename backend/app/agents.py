from __future__ import annotations

from .config import Config, Role
from .llm import structured_decide
from .state import AgentResponse, Payload

BASE_RULES = """You are the {role} in a four-tier supply chain: Retailer -> Wholesaler -> Distributor -> Factory.
Real customers buy from the Retailer. Each tier orders units from the tier directly upstream of it (the Factory \
orders raw material from production, which has unlimited capacity but the same shipping delay). Shipments take \
{shipping_delay} weeks to arrive after you place an order.

You only see the order placed by the tier directly downstream of you (or, if you are the Retailer, the order \
customers actually placed this week) -- you do NOT see real end-customer demand{visibility_note}, and you do NOT \
see any other tier's inventory or backlog.

Every week you decide how many units to order from your supplier. Order too little and you risk running out, \
accumulating backlog (unfulfilled orders you still owe your downstream customer). Order too much and you tie up \
inventory you may not need. You may also send a short message upstream (to your supplier) and downstream (to your \
customer); these are delivered with a {message_delay}-week delay.

Respond with exactly: order (integer units to order this week, >= 0), to_upstream (short message to your supplier), \
to_downstream (short message to your customer), reasoning (1-2 sentences on why you chose this order).""".strip()

PERSONA_RISK_AVERSE = (
    "\n\nYou are naturally risk-averse and anxious about running out of stock. Even a small hint of rising demand, "
    "a rising backlog, or an ambiguous message makes you want to over-order as a safety margin. You would rather "
    "sit on excess inventory than risk a stockout."
)

VISIBILITY_NOTE_SHARED = (
    " -- except in this run you additionally receive real_customer_demand, the true current end-customer demand, "
    "visible to every tier"
)


def system_prompt_for(role: Role, config: Config) -> str:
    prompt = BASE_RULES.format(
        role=role,
        shipping_delay=config.shipping_delay,
        message_delay=config.message_delay,
        visibility_note=VISIBILITY_NOTE_SHARED if config.shared_visibility else "",
    )
    if config.personality_tier == role:
        prompt += PERSONA_RISK_AVERSE
    return prompt


def user_prompt_for(payload: Payload) -> str:
    lines = [
        f"Week {payload.week}.",
        f"Your current inventory: {payload.inventory} units.",
        f"Your current backlog (orders you still owe your downstream customer): {payload.backlog} units.",
        f"Shipment that arrived this week (already added to the inventory above): {payload.arriving_this_week} units.",
        f"Order placed by your downstream customer that you must fill: {payload.order_from_downstream} units.",
        f"Your own order history, oldest to newest: {payload.my_recent_orders}.",
    ]
    if payload.real_customer_demand is not None:
        lines.append(f"Real end-customer demand this week: {payload.real_customer_demand} units.")
    if payload.inbox:
        lines.append("Messages you received this week:")
        for msg in payload.inbox:
            lines.append(f'  - {msg.sender}: "{msg.text}"')
    else:
        lines.append("No messages received this week.")
    lines.append("Decide your order for this week.")
    return "\n".join(lines)


async def decide_tier(role: Role, payload: Payload, config: Config) -> tuple[AgentResponse, bool]:
    """Returns (response, used_fallback). The fallback repeats the tier's own
    last order rather than guessing -- keeps a flaky API call from silently
    contaminating the experiment's result.
    """
    system_prompt = system_prompt_for(role, config)
    user_prompt = user_prompt_for(payload)
    try:
        response = await structured_decide(config.model, system_prompt, user_prompt)
        return response, False
    except Exception:
        fallback_order = payload.my_recent_orders[-1] if payload.my_recent_orders else payload.order_from_downstream
        return (
            AgentResponse(
                order=fallback_order,
                reasoning="fallback: LLM call failed twice this week, repeating last order",
            ),
            True,
        )
