from __future__ import annotations

import argparse
import asyncio
import json
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from app.config import Config  # noqa: E402
from app.simulation import run_simulation  # noqa: E402

RUNS_DIR = Path(__file__).parent / "runs"

CONDITIONS = {
    "baseline": lambda: Config(),
    "shared_visibility": lambda: Config(shared_visibility=True),
    "chat_enabled": lambda: Config(chat_enabled=True),
    "personality": lambda: Config(chat_enabled=True, personality_tier="Wholesaler"),
}


async def main(condition: str, out_name: str | None, weeks: int | None) -> None:
    config = CONDITIONS[condition]()
    if weeks is not None:
        config = config.model_copy(update={"weeks": weeks})
        config = Config(**config.model_dump())  # re-run validator to refit demand_pattern

    print(f"Running condition={condition!r} weeks={config.weeks} model={config.model}")
    snapshots = []
    start = time.time()
    async for snapshot in run_simulation(config):
        marker = " (fallback)" if any(t.fallback for t in snapshot.tiers) else ""
        print(
            f"week {snapshot.week:02d}  demand={snapshot.customer_demand:3d}  "
            f"factory_order={snapshot.tiers[3].order:3d}  "
            f"amp={snapshot.amplification_ratio!s:>8}  "
            f"claim_inflation={snapshot.claim_inflation!s:>6}{marker}"
        )
        snapshots.append(snapshot)
    elapsed = time.time() - start

    final = snapshots[-1]
    print(f"\nDone in {elapsed:.1f}s.")
    print(f"Final amplification ratio: {final.amplification_ratio}")
    print(f"Final claim inflation:      {final.claim_inflation}")

    RUNS_DIR.mkdir(exist_ok=True)
    run_id = out_name or condition
    out_path = RUNS_DIR / f"{run_id}.json"
    payload = {
        "run_id": run_id,
        "condition": condition,
        "config": config.model_dump(),
        "weeks": [s.model_dump(by_alias=True) for s in snapshots],
        "final_amplification_ratio": final.amplification_ratio,
        "final_claim_inflation": final.claim_inflation,
    }
    out_path.write_text(json.dumps(payload, indent=2))
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run one bullwhip simulation headlessly.")
    parser.add_argument("--condition", choices=sorted(CONDITIONS), default="baseline")
    parser.add_argument("--out", dest="out_name", default=None, help="filename stem under runs/")
    parser.add_argument("--weeks", type=int, default=None, help="override weeks (default 40)")
    args = parser.parse_args()
    asyncio.run(main(args.condition, args.out_name, args.weeks))
