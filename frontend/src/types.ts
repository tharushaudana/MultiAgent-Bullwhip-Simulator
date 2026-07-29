export type Role = "Retailer" | "Wholesaler" | "Distributor" | "Factory";

export const ROLES: Role[] = ["Retailer", "Wholesaler", "Distributor", "Factory"];

export interface ChatMessage {
  from: string;
  text: string;
}

export interface TierSnapshot {
  role: Role;
  inventory: number;
  backlog: number;
  order: number;
  arriving_this_week: number;
  order_from_downstream: number;
  to_upstream: string;
  to_downstream: string;
  reasoning: string;
  fallback: boolean;
}

export interface LatestQuote {
  role: Role;
  reasoning: string;
}

export interface WeekSnapshot {
  week: number;
  customer_demand: number;
  tiers: TierSnapshot[];
  amplification_ratio: number | null;
  claim_inflation: number | null;
  latest_quote: LatestQuote | null;
}

export type WSMessage =
  | ({ type: "week" } & WeekSnapshot)
  | { type: "done"; run_id: string; final_amplification_ratio: number | null; final_claim_inflation: number | null }
  | { type: "error"; message: string };

export interface RunRecord {
  run_id: string;
  condition: string;
  config: Record<string, unknown>;
  weeks: WeekSnapshot[];
  final_amplification_ratio: number | null;
  final_claim_inflation: number | null;
}

export interface CompareResponse {
  a: RunRecord;
  b: RunRecord;
}
