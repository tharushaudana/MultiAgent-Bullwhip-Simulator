import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { useRunSocket } from "./api/useRunSocket";
import { fetchConditions } from "./api/rest";
import { DemandChart } from "./components/DemandChart";
import { AmplificationNumber } from "./components/AmplificationNumber";
import { ClaimInflation } from "./components/ClaimInflation";
import { ReasoningQuote } from "./components/ReasoningQuote";
import { SupplyChain } from "./components/SupplyChain";
import { MessageBubbles } from "./components/MessageBubbles";
import { Controls } from "./components/Controls";
import { CompareView } from "./components/CompareView";

const FALLBACK_CONDITIONS: Record<string, string> = {
  baseline: "Baseline — each tier sees only its immediate downstream order",
  shared_visibility: "Shared visibility — every tier sees real customer demand",
  chat_enabled: "Chat enabled — tiers exchange free-text messages, 1-week delay",
  personality: "Personality — Wholesaler is prompted risk-averse, chat enabled",
};

function App() {
  const [conditions, setConditions] = useState<Record<string, string>>(FALLBACK_CONDITIONS);
  const [condition, setCondition] = useState("baseline");
  const [speed, setSpeed] = useState(0.15);
  const [compareMode, setCompareMode] = useState(false);

  const { status, weeks, error, start, stop } = useRunSocket();

  useEffect(() => {
    fetchConditions()
      .then(setConditions)
      .catch(() => {
        /* backend not up yet -- keep the fallback labels */
      });
  }, []);

  const latestWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null;

  const combinedError = useMemo(() => error, [error]);

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
        onRun={() => start({ condition, speed })}
        onReset={stop}
        compareMode={compareMode}
        onToggleCompare={() => setCompareMode((v) => !v)}
        error={combinedError}
      />

      {compareMode ? (
        <CompareView />
      ) : (
        <>
          <section className="hero-row">
            <DemandChart weeks={weeks} />
            <aside className="side-stats">
              <AmplificationNumber value={latestWeek?.amplification_ratio ?? null} />
              <ClaimInflation value={latestWeek?.claim_inflation ?? null} />
            </aside>
          </section>

          <ReasoningQuote quote={latestWeek?.latest_quote ?? null} />

          <SupplyChain tiers={latestWeek?.tiers ?? null} />
          <MessageBubbles tiers={latestWeek?.tiers ?? null} week={latestWeek?.week ?? null} />
        </>
      )}
    </div>
  );
}

export default App;
