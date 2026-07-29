import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { useRunSocket } from "./api/useRunSocket";
import { fetchConditions } from "./api/rest";
import { DemandChart, type ChartMark } from "./components/DemandChart";
import { AmplificationNumber } from "./components/AmplificationNumber";
import { ClaimInflation } from "./components/ClaimInflation";
import { ReasoningQuote } from "./components/ReasoningQuote";
import { SupplyChain } from "./components/SupplyChain";
import { MessageBubbles } from "./components/MessageBubbles";
import { Controls } from "./components/Controls";
import { CompareView } from "./components/CompareView";
import { WeekScrubber } from "./components/WeekScrubber";
import { ConversationLog } from "./components/ConversationLog";

const FALLBACK_CONDITIONS: Record<string, string> = {
  baseline: "Baseline — each tier sees only its immediate downstream order",
  shared_visibility: "Shared visibility — every tier sees real customer demand",
  chat_enabled: "Chat enabled — tiers exchange free-text messages, 1-week delay",
  personality: "Personality — Wholesaler is prompted risk-averse, chat enabled",
};

// The backend's Config.weeks default; there is intentionally no weeks-override
// control in this UI (matches the "no 12-knob panel" design rule).
const DEFAULT_WEEKS = 40;

const DEMAND_STEP_COLOR = "#898781";
const VIEWING_COLOR = "#0ca30c";

function App() {
  const [conditions, setConditions] = useState<Record<string, string>>(FALLBACK_CONDITIONS);
  const [condition, setCondition] = useState("baseline");
  const [speed, setSpeed] = useState(0.15);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const { status, weeks, error, start, stop } = useRunSocket();

  useEffect(() => {
    fetchConditions()
      .then(setConditions)
      .catch(() => {
        /* backend not up yet -- keep the fallback labels */
      });
  }, []);

  const displayedIndex = selectedWeekIndex ?? (weeks.length > 0 ? weeks.length - 1 : -1);
  const displayedWeek = displayedIndex >= 0 ? weeks[displayedIndex] : null;
  const previousTiers = displayedIndex > 0 ? weeks[displayedIndex - 1].tiers : null;

  const stepMark = useMemo<ChartMark | null>(() => {
    if (weeks.length < 2) return null;
    const baseline = weeks[0].customer_demand;
    const stepWeek = weeks.find((w) => w.customer_demand !== baseline);
    return stepWeek ? { week: stepWeek.week, color: DEMAND_STEP_COLOR, label: "demand step", dash: [4, 4] } : null;
  }, [weeks]);

  const viewingMark = useMemo<ChartMark | null>(() => {
    if (selectedWeekIndex === null || !displayedWeek) return null;
    return { week: displayedWeek.week, color: VIEWING_COLOR, label: "viewing", dash: [2, 2] };
  }, [selectedWeekIndex, displayedWeek]);

  const marks = useMemo(() => [stepMark, viewingMark].filter((m): m is ChartMark => m !== null), [
    stepMark,
    viewingMark,
  ]);

  const combinedError = useMemo(() => error, [error]);

  const handleRun = () => {
    setSelectedWeekIndex(null);
    start({ condition, speed });
  };

  const handleReset = () => {
    setSelectedWeekIndex(null);
    setLogOpen(false);
    stop();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bullwhip Effect Simulator</h1>
        <p className="subtitle">
          Four LLM agents, each blind to everything but its own neighbor. A single 8→12 demand step
          becomes a supply-chain wave.
        </p>
      </header>

      <Controls
        conditions={conditions}
        condition={condition}
        onConditionChange={setCondition}
        speed={speed}
        onSpeedChange={setSpeed}
        status={status}
        onRun={handleRun}
        onReset={handleReset}
        compareMode={compareMode}
        onToggleCompare={() => setCompareMode((v) => !v)}
        error={combinedError}
        runningWeek={weeks.length > 0 ? weeks[weeks.length - 1].week : undefined}
        totalWeeks={DEFAULT_WEEKS}
      />

      {compareMode ? (
        <CompareView />
      ) : (
        <>
          <section className="hero-row">
            <DemandChart weeks={weeks} marks={marks} />
            <aside className="side-stats">
              <AmplificationNumber value={displayedWeek?.amplification_ratio ?? null} />
              <ClaimInflation value={displayedWeek?.claim_inflation ?? null} />
            </aside>
          </section>

          <WeekScrubber
            weeks={weeks}
            selectedIndex={selectedWeekIndex}
            onSelect={setSelectedWeekIndex}
            totalWeeks={DEFAULT_WEEKS}
          />

          <ReasoningQuote quote={displayedWeek?.latest_quote ?? null} />

          <SupplyChain tiers={displayedWeek?.tiers ?? null} previousTiers={previousTiers} />
          <MessageBubbles tiers={displayedWeek?.tiers ?? null} week={displayedWeek?.week ?? null} />

          <ConversationLog
            weeks={weeks}
            selectedWeek={selectedWeekIndex !== null ? displayedWeek?.week ?? null : null}
            open={logOpen}
            onToggle={() => setLogOpen((v) => !v)}
          />
        </>
      )}
    </div>
  );
}

export default App;
