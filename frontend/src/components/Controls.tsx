import type { RunStatus } from "../api/useRunSocket";

interface Props {
  conditions: Record<string, string>;
  condition: string;
  onConditionChange: (c: string) => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  status: RunStatus;
  onRun: () => void;
  onReset: () => void;
  compareMode: boolean;
  onToggleCompare: () => void;
  error: string | null;
}

export function Controls({
  conditions,
  condition,
  onConditionChange,
  speed,
  onSpeedChange,
  status,
  onRun,
  onReset,
  compareMode,
  onToggleCompare,
  error,
}: Props) {
  const running = status === "connecting" || status === "running";

  return (
    <div className="controls">
      <label className="control">
        <span>Condition</span>
        <select
          value={condition}
          onChange={(e) => onConditionChange(e.target.value)}
          disabled={running || compareMode}
        >
          {Object.entries(conditions).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="control control--slider">
        <span>Speed</span>
        <span className="speed-hint">fast</span>
        <input
          type="range"
          min={0}
          max={0.6}
          step={0.02}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          disabled={running || compareMode}
        />
        <span className="speed-hint">slow</span>
      </label>

      <button className="btn btn--primary" onClick={onRun} disabled={running || compareMode}>
        {running ? "Running…" : "Run"}
      </button>
      <button className="btn" onClick={onReset} disabled={running}>
        Reset
      </button>
      <button
        className={`btn${compareMode ? " btn--active" : ""}`}
        onClick={onToggleCompare}
      >
        Compare both
      </button>

      {error && <span className="controls-error">{error}</span>}
    </div>
  );
}
