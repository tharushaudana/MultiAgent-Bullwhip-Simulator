import { useEffect, useMemo, useRef } from "react";
import type { WeekSnapshot } from "../types";
import { laneHistories } from "../messageLanes";
import { isExaggerated } from "../claimInflation";

const LANE_LABELS = ["Retailer ↔ Wholesaler", "Wholesaler ↔ Distributor", "Distributor ↔ Factory"];

interface Props {
  weeks: WeekSnapshot[];
  selectedWeek: number | null;
  open: boolean;
  onToggle: () => void;
}

export function ConversationLog({ weeks, selectedWeek, open, onToggle }: Props) {
  const lanes = useMemo(() => laneHistories(weeks), [weeks]);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  useEffect(() => {
    if (!open) return;
    lanes.forEach((_, i) => {
      const el = laneRefs.current[i];
      if (!el) return;
      if (selectedWeek === null) {
        el.scrollTop = el.scrollHeight;
      } else {
        const target = el.querySelector<HTMLElement>(`[data-week="${selectedWeek}"]`);
        target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }, [open, lanes, selectedWeek]);

  const totalMessages = lanes.reduce((sum, l) => sum + l.length, 0);

  return (
    <div className="conversation-log">
      <button className="conversation-log-toggle" onClick={onToggle}>
        {open ? "▾" : "▸"} Conversation log{totalMessages > 0 ? ` (${totalMessages})` : ""}
      </button>

      {open && (
        <div className="conversation-log-body">
          {lanes.map((messages, i) => (
            <div
              key={i}
              className="chat-lane"
              ref={(el) => {
                laneRefs.current[i] = el;
              }}
            >
              <div className="chat-lane-header">{LANE_LABELS[i]}</div>
              <div className="chat-lane-messages">
                {messages.length === 0 && <p className="chat-lane-empty">No messages yet.</p>}
                {messages.map((m) => {
                  const flagged = isExaggerated(m.text, m.inventory, m.backlog);
                  const active = selectedWeek !== null && m.week === selectedWeek;
                  return (
                    <div
                      key={`${m.week}-${m.direction}`}
                      data-week={m.week}
                      className={`chat-bubble chat-bubble--${m.direction}${flagged ? " chat-bubble--flagged" : ""}${
                        active ? " chat-bubble--active" : ""
                      }`}
                    >
                      <div className="chat-bubble-meta">
                        <span>wk {m.week}</span>
                        <span>
                          inv {m.inventory} · backlog {m.backlog}
                        </span>
                      </div>
                      <div className="chat-bubble-text">{m.text}</div>
                      {flagged && <div className="chat-bubble-flag">⚠ exaggerated</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
