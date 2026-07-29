import { useCallback, useRef, useState } from "react";
import type { WeekSnapshot, WSMessage } from "../types";

const WS_URL = "ws://127.0.0.1:8000/ws/run";

export type RunStatus = "idle" | "connecting" | "running" | "done" | "error";

interface StartParams {
  condition: string;
  weeks?: number;
  speed: number;
}

export function useRunSocket() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [weeks, setWeeks] = useState<WeekSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const start = useCallback((params: StartParams) => {
    wsRef.current?.close();
    setWeeks([]);
    setError(null);
    setRunId(null);
    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("running");
      ws.send(JSON.stringify(params));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as WSMessage;
      if (msg.type === "week") {
        const { type: _type, ...snapshot } = msg;
        void _type;
        setWeeks((prev) => [...prev, snapshot as WeekSnapshot]);
      } else if (msg.type === "done") {
        setRunId(msg.run_id);
        setStatus("done");
      } else if (msg.type === "error") {
        setError(msg.message);
        setStatus("error");
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error -- is the backend running on :8000?");
      setStatus("error");
    };

    ws.onclose = () => {
      setStatus((s) => (s === "running" || s === "connecting" ? "error" : s));
    };
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setWeeks([]);
    setError(null);
    setRunId(null);
  }, []);

  return { status, weeks, error, runId, start, stop };
}
