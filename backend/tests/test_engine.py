import pytest

from app.config import Config
from app.engine import Engine
from app.state import AgentResponse


def run_scripted(config: Config, policy) -> Engine:
    """Drive the engine exactly per the details.txt pseudocode, using a plain
    Python policy function instead of an LLM. This is how we lock the physics
    before spending a single API call.
    """
    engine = Engine(config)
    for week in range(config.weeks):
        engine.deliver_shipments()
        engine.deliver_messages()
        engine.fill_orders(week)
        replies: list[AgentResponse] = []
        for tier in range(4):
            payload = engine.payload_for(tier, week)
            reply = policy(tier, payload)
            engine.queue_order(tier, reply.order)
            engine.queue_messages(tier, reply.to_upstream, reply.to_downstream)
            replies.append(reply)
        engine.log(week, replies)
    return engine


PASS_THROUGH_DEMAND = [8, 8, 8, 12, 12, 12, 12, 12, 12, 12]


def pass_through(tier, payload) -> AgentResponse:
    return AgentResponse(order=payload.order_from_downstream, reasoning="relay")


def double_it(tier, payload) -> AgentResponse:
    return AgentResponse(order=payload.order_from_downstream * 2, reasoning="panic")


def test_pass_through_policy_reproduces_hand_derived_ratio():
    # Hand-derived: with a perfectly rational "relay demand" policy, each tier
    # lags its downstream neighbor by exactly one week (order visibility is a
    # fixed one-week lag, independent of shipping_delay). Over this 10-week
    # window the step lands at different offsets in customer vs factory
    # series (3 eights/7 twelves vs 6 eights/4 twelves), giving an exact,
    # non-1.0 ratio of 3.84/3.36 = 8/7. Getting this exact number confirms
    # fill_orders' demand routing, the delay chain, and the metric itself.
    config = Config(weeks=10, demand_pattern=PASS_THROUGH_DEMAND, shipping_delay=2, message_delay=1)
    engine = run_scripted(config, pass_through)

    assert engine.customer_demand_log == PASS_THROUGH_DEMAND
    assert engine.factory_orders_log == [8, 8, 8, 8, 8, 8, 12, 12, 12, 12]
    assert engine.logs[-1].amplification_ratio == pytest.approx(8 / 7)


def test_overreacting_policy_amplifies_more_than_pass_through():
    config = Config(weeks=10, demand_pattern=PASS_THROUGH_DEMAND, shipping_delay=2, message_delay=1)
    baseline = run_scripted(config, pass_through)
    amplified = run_scripted(config, double_it)

    assert baseline.logs[-1].amplification_ratio > 1.0
    assert amplified.logs[-1].amplification_ratio > baseline.logs[-1].amplification_ratio


def test_steady_demand_never_yields_a_ratio():
    # No shock, no variance to amplify -- the metric must stay undefined
    # rather than reporting a misleading 1.0 or dividing by zero.
    config = Config(weeks=8, demand_pattern=[8] * 8, shipping_delay=2, message_delay=1)
    engine = run_scripted(config, pass_through)
    assert all(snap.amplification_ratio is None for snap in engine.logs)


def test_inventory_and_backlog_stay_in_steady_state_sawtooth():
    config = Config(weeks=6, demand_pattern=[8] * 6, shipping_delay=2, message_delay=1)
    engine = run_scripted(config, pass_through)
    # Every tier should return to backlog 0 each week under flat demand with
    # a pass-through policy -- nothing should be silently accumulating.
    assert engine.backlog == [0, 0, 0, 0]
    assert engine.inventory == [12, 12, 12, 12]


def test_shared_visibility_reveals_real_demand_to_every_tier():
    hidden = Config(weeks=6, demand_pattern=[8, 8, 8, 12, 12, 12], shared_visibility=False)
    visible = Config(weeks=6, demand_pattern=[8, 8, 8, 12, 12, 12], shared_visibility=True)

    engine_hidden = Engine(hidden)
    engine_visible = Engine(visible)
    for engine in (engine_hidden, engine_visible):
        engine.deliver_shipments()
        engine.deliver_messages()
        engine.fill_orders(3)  # the week of the demand step

    factory_payload_hidden = engine_hidden.payload_for(tier=3, week=3)
    factory_payload_visible = engine_visible.payload_for(tier=3, week=3)

    assert factory_payload_hidden.real_customer_demand is None
    assert factory_payload_visible.real_customer_demand == 12


def test_chat_disabled_generates_but_never_delivers_messages():
    config = Config(weeks=4, demand_pattern=[8] * 4, chat_enabled=False)

    def chatty(tier, payload):
        return AgentResponse(order=payload.order_from_downstream, to_upstream="ramping hard", to_downstream="delayed")

    engine = run_scripted(config, chatty)
    # Messages were produced (visible in the ground-truth log for claim
    # inflation) but payload_for -- the only thing an agent ever sees --
    # must never expose them when the condition has chat disabled.
    assert len(engine.all_messages_log) > 0
    assert all(
        engine.payload_for(tier, week=config.weeks - 1).inbox == [] for tier in range(4)
    )


def test_chat_enabled_delivers_messages_after_delay():
    config = Config(weeks=4, demand_pattern=[8] * 4, chat_enabled=True, message_delay=1)

    def chatty(tier, payload):
        return AgentResponse(order=payload.order_from_downstream, to_upstream="ramping hard", to_downstream="")

    engine = run_scripted(config, chatty)
    # Wholesaler (tier=1) should have received Retailer's (tier=0) upstream
    # message in its inbox at some point during the run.
    # We can't inspect history directly, so re-derive: after 4 weeks with a
    # 1-week message delay, engine.inbox holds week 3's delivered batch.
    wholesaler_inbox_senders = [m.sender for m in engine.inbox[1]]
    assert "Retailer" in wholesaler_inbox_senders


def test_claim_inflation_flows_through_week_snapshot():
    config = Config(weeks=1, demand_pattern=[8], initial_inventory=20, initial_backlog=0)
    engine = Engine(config)
    engine.deliver_shipments()
    engine.deliver_messages()
    engine.fill_orders(0)
    replies = [
        AgentResponse(order=8, to_upstream="I'm critically short", reasoning="panic"),
        AgentResponse(order=8, reasoning="steady"),
        AgentResponse(order=8, reasoning="steady"),
        AgentResponse(order=8, reasoning="steady"),
    ]
    for tier, reply in enumerate(replies):
        engine.queue_order(tier, reply.order)
        engine.queue_messages(tier, reply.to_upstream, reply.to_downstream)
    snapshot = engine.log(0, replies)
    # Retailer just shipped down to 12 inventory (20 - 8), still comfortably
    # healthy, but claimed "critically short" -> should register as inflated.
    assert snapshot.claim_inflation is not None
    assert snapshot.claim_inflation > 0
