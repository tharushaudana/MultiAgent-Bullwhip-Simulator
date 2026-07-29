from __future__ import annotations

import os
from functools import lru_cache

from langchain_anthropic import ChatAnthropic

from .state import AgentResponse

MAX_ATTEMPTS = 2


@lru_cache(maxsize=4)
def _base_llm(model: str) -> ChatAnthropic:
    return ChatAnthropic(
        model=model,
        base_url=os.environ["ANTHROPIC_BASE_URL"],
        api_key=os.environ["ANTHROPIC_API_KEY"],
        max_tokens=600,
        thinking={"type": "disabled"},
        timeout=30,
    )


async def structured_decide(model: str, system_prompt: str, user_prompt: str) -> AgentResponse:
    """One tier's decision for one week, retried once on any failure (bad
    JSON, timeout, ...). Raises on a second failure -- callers must supply an
    honest, logged fallback rather than silently inventing a plausible order.
    """
    llm = _base_llm(model).with_structured_output(AgentResponse)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    last_error: Exception | None = None
    for _ in range(MAX_ATTEMPTS):
        try:
            return await llm.ainvoke(messages)
        except Exception as exc:  # noqa: BLE001 - any failure should retry, then fall back
            last_error = exc
    raise RuntimeError(f"LLM structured decision failed after {MAX_ATTEMPTS} attempts") from last_error
