interface Props {
  value: number | null;
}

export function ClaimInflation({ value }: Props) {
  return (
    <div className="stat-tile-secondary">
      <div className="stat-label-small">Claim inflation</div>
      <div className="stat-value-small">{value === null ? "—" : value.toFixed(2)}</div>
    </div>
  );
}
