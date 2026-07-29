import type { TierSnapshot } from "../types";

interface Props {
  tiers: TierSnapshot[] | null;
  previousTiers?: TierSnapshot[] | null;
}

function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null;
  const diff = current - previous;
  if (diff === 0) {
    return <span className="tier-stat-delta tier-stat-delta--flat">±0</span>;
  }
  return (
    <span className={`tier-stat-delta${diff > 0 ? " tier-stat-delta--up" : " tier-stat-delta--down"}`}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
    </span>
  );
}

export function SupplyChain({ tiers, previousTiers }: Props) {
  if (!tiers) {
    return (
      <div className="supply-chain supply-chain--empty">
        <span>Run a simulation to see the chain in action.</span>
      </div>
    );
  }

  return (
    <div className="supply-chain">
      {tiers.map((t, i) => {
        const prev = previousTiers?.[i];
        return (
          <div key={t.role} className={`tier-card${t.fallback ? " tier-card--fallback" : ""}`}>
            <div className="tier-role">{t.role}</div>
            <div className="tier-stats">
              <div>
                <span className="tier-stat-label">Inventory</span>
                <span>
                  <span className="tier-stat-value">{t.inventory}</span>
                  <Delta current={t.inventory} previous={prev?.inventory} />
                </span>
              </div>
              <div>
                <span className="tier-stat-label">Backlog</span>
                <span className="tier-stat-value">{t.backlog}</span>
              </div>
              <div className="tier-order-row">
                <span className="tier-stat-label">Order</span>
                <span>
                  <span className="tier-stat-value tier-order-value">{t.order}</span>
                  <Delta current={t.order} previous={prev?.order} />
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
