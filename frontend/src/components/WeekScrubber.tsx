import type { WeekSnapshot } from "../types";

interface Props {
  weeks: WeekSnapshot[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  totalWeeks: number;
}

export function WeekScrubber({ weeks, selectedIndex, onSelect, totalWeeks }: Props) {
  if (weeks.length === 0) {
    return null;
  }

  const effectiveIndex = selectedIndex ?? weeks.length - 1;
  const currentWeekNumber = weeks[effectiveIndex]?.week ?? 0;
  const isFollowingLive = selectedIndex === null;

  return (
    <div className="week-scrubber">
      <input
        type="range"
        min={0}
        max={weeks.length - 1}
        step={1}
        value={effectiveIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
        aria-label="Scrub to a past week"
      />
      <span className="week-scrubber-label">
        week {currentWeekNumber} / {totalWeeks - 1}
      </span>
      <button
        className={`btn btn--small${isFollowingLive ? " btn--active" : ""}`}
        onClick={() => onSelect(null)}
        disabled={isFollowingLive}
      >
        Jump to live
      </button>
    </div>
  );
}
