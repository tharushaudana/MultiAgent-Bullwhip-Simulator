interface Props {
  value: number | null;
}

function formatRatio(value: number): string {
  if (value >= 100) return `${Math.round(value).toLocaleString()}×`;
  if (value >= 10) return `${value.toFixed(0)}×`;
  return `${value.toFixed(1)}×`;
}

export function AmplificationNumber({ value }: Props) {
  return (
    <div className="hero-figure">
      <div className="stat-label">Amplification ratio</div>
      <div className="stat-value">{value === null ? "—" : formatRatio(value)}</div>
      <div className="stat-caption">variance(factory orders) ÷ variance(customer demand)</div>
    </div>
  );
}
