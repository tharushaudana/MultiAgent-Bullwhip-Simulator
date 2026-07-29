import type { TierSnapshot } from "../types";

interface Props {
  tiers: TierSnapshot[] | null;
}

export function SupplyChain({ tiers }: Props) {
  if (!tiers) {
    return (
      <div className="supply-chain supply-chain--empty">
        <span>Run a simulation to see the chain in action.</span>
      </div>
    );
  }

  return (
    <div className="supply-chain">
      {tiers.map((t) => (
        <div key={t.role} className={`tier-card${t.fallback ? " tier-card--fallback" : ""}`}>
          <div className="tier-role">{t.role}</div>
          <div className="tier-stats">
            <div>
              <span className="tier-stat-label">Inventory</span>
              <span className="tier-stat-value">{t.inventory}</span>
            </div>
            <div>
              <span className="tier-stat-label">Backlog</span>
              <span className="tier-stat-value">{t.backlog}</span>
            </div>
            <div className="tier-order-row">
              <span className="tier-stat-label">Order</span>
              <span className="tier-stat-value tier-order-value">{t.order}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
