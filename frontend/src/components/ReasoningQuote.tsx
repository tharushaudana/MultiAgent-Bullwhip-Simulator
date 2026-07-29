import { AnimatePresence, motion } from "framer-motion";
import type { LatestQuote } from "../types";

interface Props {
  quote: LatestQuote | null;
}

export function ReasoningQuote({ quote }: Props) {
  return (
    <div className="reasoning-quote">
      <AnimatePresence mode="wait">
        {quote ? (
          <motion.blockquote
            key={`${quote.role}-${quote.reasoning}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <p>&ldquo;{quote.reasoning}&rdquo;</p>
            <footer>— {quote.role}</footer>
          </motion.blockquote>
        ) : (
          <blockquote className="reasoning-quote--placeholder">
            <p>An agent's reasoning will appear here once a run starts.</p>
          </blockquote>
        )}
      </AnimatePresence>
    </div>
  );
}
