import { AnimatePresence, motion } from "framer-motion";
import type { TierSnapshot } from "../types";

interface Props {
  tiers: TierSnapshot[] | null;
  week: number | null;
}

interface Bubble {
  key: string;
  text: string;
  direction: "up" | "down";
}

export function MessageBubbles({ tiers, week }: Props) {
  if (!tiers) {
    return <div className="message-lane" />;
  }

  const gaps: Bubble[][] = [0, 1, 2].map((i) => {
    const downstreamTier = tiers[i]; // its to_upstream message travels toward tiers[i + 1]
    const upstreamTier = tiers[i + 1]; // its to_downstream message travels toward tiers[i]
    const bubbles: Bubble[] = [];
    if (downstreamTier.to_upstream) {
      bubbles.push({ key: `${week}-${i}-up`, text: downstreamTier.to_upstream, direction: "up" });
    }
    if (upstreamTier.to_downstream) {
      bubbles.push({ key: `${week}-${i}-down`, text: upstreamTier.to_downstream, direction: "down" });
    }
    return bubbles;
  });

  return (
    <div className="message-lane">
      {gaps.map((bubbles, i) => (
        <div key={i} className="message-gap">
          <AnimatePresence mode="popLayout">
            {bubbles.map((b) => (
              <motion.div
                key={b.key}
                className={`message-bubble message-bubble--${b.direction}`}
                initial={{ opacity: 0, x: b.direction === "up" ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                title={b.text}
              >
                {b.direction === "up" ? "↑ " : "↓ "}
                {b.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
