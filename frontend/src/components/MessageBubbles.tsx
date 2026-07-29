import { AnimatePresence, motion } from "framer-motion";
import type { TierSnapshot } from "../types";
import { laneMessagesForWeek } from "../messageLanes";

interface Props {
  tiers: TierSnapshot[] | null;
  week: number | null;
}

export function MessageBubbles({ tiers, week }: Props) {
  if (!tiers || week === null) {
    return <div className="message-lane" />;
  }

  const lanes = laneMessagesForWeek(tiers, week);

  return (
    <div className="message-lane">
      {lanes.map((messages, i) => (
        <div key={i} className="message-gap">
          <AnimatePresence mode="popLayout">
            {messages.map((m) => (
              <motion.div
                key={`${m.week}-${m.lane}-${m.direction}`}
                className={`message-bubble message-bubble--${m.direction}`}
                initial={{ opacity: 0, x: m.direction === "up" ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                title={m.text}
              >
                {m.direction === "up" ? "↑ " : "↓ "}
                {m.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
