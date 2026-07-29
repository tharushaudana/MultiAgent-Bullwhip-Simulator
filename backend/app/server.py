from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402

from .conditions import CONDITION_LABELS, build_config  # noqa: E402
from .simulation import run_simulation  # noqa: E402

RUNS_DIR = Path(__file__).parent.parent / "runs"
RUNS_DIR.mkdir(exist_ok=True)

MIN_SPEED = 0.0
MAX_SPEED = 3.0

app = FastAPI(title="Bullwhip Effect Simulator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_run(run_id: str) -> dict | None:
    path = RUNS_DIR / f"{run_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/conditions")
def list_conditions() -> dict[str, str]:
    return CONDITION_LABELS


@app.get("/api/runs")
def list_runs() -> list[str]:
    return sorted(p.stem for p in RUNS_DIR.glob("*.json"))


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    run = _load_run(run_id)
    if run is None:
        return JSONResponse({"error": f"no saved run named {run_id!r}"}, status_code=404)
    return run


@app.get("/api/compare")
def compare(a: str = "baseline", b: str = "shared_visibility"):
    """Pre-rendered ablation view: two saved runs, same axes, side by side.
    This is the demo backup if a live run stalls on an API call.
    """
    run_a, run_b = _load_run(a), _load_run(b)
    missing = [name for name, run in ((a, run_a), (b, run_b)) if run is None]
    if missing:
        return JSONResponse({"error": f"missing saved runs: {missing}"}, status_code=404)
    return {"a": run_a, "b": run_b}


@app.websocket("/ws/run")
async def ws_run(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        raw = await websocket.receive_text()
        params = json.loads(raw)
        condition = params.get("condition", "baseline")
        overrides: dict = {}
        if params.get("weeks"):
            overrides["weeks"] = int(params["weeks"])
        speed = max(MIN_SPEED, min(MAX_SPEED, float(params.get("speed", 0.15))))

        try:
            config = build_config(condition, **overrides)
        except ValueError as exc:
            await websocket.send_json({"type": "error", "message": str(exc)})
            return

        snapshots = []
        async for snapshot in run_simulation(config):
            snapshots.append(snapshot)
            await websocket.send_json({"type": "week", **snapshot.model_dump(by_alias=True)})
            if speed > 0:
                await asyncio.sleep(speed)

        run_id = f"{condition}-{uuid.uuid4().hex[:8]}"
        final = snapshots[-1]
        record = {
            "run_id": run_id,
            "condition": condition,
            "config": config.model_dump(),
            "weeks": [s.model_dump(by_alias=True) for s in snapshots],
            "final_amplification_ratio": final.amplification_ratio,
            "final_claim_inflation": final.claim_inflation,
        }
        (RUNS_DIR / f"{run_id}.json").write_text(json.dumps(record, indent=2))

        await websocket.send_json(
            {
                "type": "done",
                "run_id": run_id,
                "final_amplification_ratio": final.amplification_ratio,
                "final_claim_inflation": final.claim_inflation,
            }
        )
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass
