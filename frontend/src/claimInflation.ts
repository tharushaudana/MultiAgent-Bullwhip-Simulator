// Client-side mirror of backend/app/metrics.py's urgency lexicon + inventory
// health formula. The Python file is the authoritative source for the
// aggregate `claim_inflation` number reported by the API; this copy exists
// only to flag individual messages in the Conversation log UI, so keep the
// constants identical if the backend formula ever changes.

const URGENCY_TERMS: Record<string, number> = {
  critical: 1.0,
  emergency: 1.0,
  desperate: 0.9,
  urgent: 0.9,
  urgently: 0.9,
  "running dry": 0.9,
  "out of stock": 0.9,
  "running low": 0.7,
  shortage: 0.8,
  "please rush": 0.7,
  rush: 0.6,
  asap: 0.6,
  immediately: 0.6,
  short: 0.6,
  behind: 0.4,
  backlogged: 0.5,
  prioritize: 0.5,
  "need more": 0.4,
  double: 0.3,
  increase: 0.2,
};

const HEALTHY_POSITION = 10;

export function messageUrgency(text: string): number {
  if (!text) return 0;
  const lowered = text.toLowerCase();
  let best = 0;
  for (const [term, weight] of Object.entries(URGENCY_TERMS)) {
    if (lowered.includes(term)) best = Math.max(best, weight);
  }
  return best;
}

export function inventoryHealth(inventory: number, backlog: number): number {
  const position = inventory - backlog;
  const normalized = (position + HEALTHY_POSITION) / (2 * HEALTHY_POSITION);
  return Math.max(0, Math.min(1, normalized));
}

export function inflationScore(text: string, inventory: number, backlog: number): number {
  const urgency = messageUrgency(text);
  if (urgency === 0) return 0;
  const health = inventoryHealth(inventory, backlog);
  return Math.max(0, urgency - (1 - health));
}

export function isExaggerated(text: string, inventory: number, backlog: number): boolean {
  return inflationScore(text, inventory, backlog) > 0;
}
