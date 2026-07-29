import { useEffect, useState } from "react";
import { fetchCompare } from "../api/rest";
import type { CompareResponse } from "../types";
import { DemandChart } from "./DemandChart";

const CONDITION_OPTIONS = ["baseline", "shared_visibility", "chat_enabled", "personality"];

function formatRatio(value: number | null): string {
  if (value === null) return "—";
  if (value >= 100) return `${Math.round(value).toLocaleString()}×`;
  return `${value.toFixed(1)}×`;
}

export function CompareView() {
  const [top, setTop] = useState("baseline");
  const [bottom, setBottom] = useState("shared_visibility");
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setData(null);
    fetchCompare(top, bottom)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [top, bottom]);

  const maxY = data
    ? Math.max(
        1,
        ...[...data.a.weeks, ...data.b.weeks].flatMap((w) => [w.customer_demand, w.tiers[3]?.order ?? 0])
      ) * 1.08
    : undefined;

  return (
    <div className="compare-view">
      <div className="compare-selectors">
        <label>
          Top panel
          <select value={top} onChange={(e) => setTop(e.target.value)}>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bottom panel
          <select value={bottom} onChange={(e) => setBottom(e.target.value)}>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="controls-error">
          {error} — run <code>python run_cli.py --condition {top}</code> and{" "}
          <code>--condition {bottom}</code> from <code>backend/</code> first.
        </p>
      )}

      {data && (
        <>
          <div className="compare-panel">
            <div className="compare-panel-header">
              <span>{data.a.condition}</span>
              <strong>{formatRatio(data.a.final_amplification_ratio)}</strong>
            </div>
            <DemandChart weeks={data.a.weeks} maxY={maxY} heightPx={220} />
          </div>
          <div className="compare-panel">
            <div className="compare-panel-header">
              <span>{data.b.condition}</span>
              <strong>{formatRatio(data.b.final_amplification_ratio)}</strong>
            </div>
            <DemandChart weeks={data.b.weeks} maxY={maxY} heightPx={220} />
          </div>
        </>
      )}
    </div>
  );
}
