import type { Role, TierSnapshot, WeekSnapshot } from "./types";

export const LANE_COUNT = 3; // Retailer<->Wholesaler, Wholesaler<->Distributor, Distributor<->Factory

export interface LaneMessage {
  week: number;
  lane: number;
  fromRole: Role;
  toRole: Role;
  text: string;
  direction: "up" | "down"; // up = sent by the downstream tier of the pair, toward its supplier
  inventory: number; // sender's inventory at the time
  backlog: number; // sender's backlog at the time
}

/** The 3 adjacent-tier message pairs generated in a single week. */
export function laneMessagesForWeek(tiers: TierSnapshot[], week: number): LaneMessage[][] {
  const lanes: LaneMessage[][] = [[], [], []];
  for (let i = 0; i < LANE_COUNT; i++) {
    const downstreamTier = tiers[i];
    const upstreamTier = tiers[i + 1];
    if (downstreamTier.to_upstream) {
      lanes[i].push({
        week,
        lane: i,
        fromRole: downstreamTier.role,
        toRole: upstreamTier.role,
        text: downstreamTier.to_upstream,
        direction: "up",
        inventory: downstreamTier.inventory,
        backlog: downstreamTier.backlog,
      });
    }
    if (upstreamTier.to_downstream) {
      lanes[i].push({
        week,
        lane: i,
        fromRole: upstreamTier.role,
        toRole: downstreamTier.role,
        text: upstreamTier.to_downstream,
        direction: "down",
        inventory: upstreamTier.inventory,
        backlog: upstreamTier.backlog,
      });
    }
  }
  return lanes;
}

/** Full per-lane message history across every week streamed so far. */
export function laneHistories(weeks: WeekSnapshot[]): LaneMessage[][] {
  const lanes: LaneMessage[][] = [[], [], []];
  for (const wk of weeks) {
    const weekLanes = laneMessagesForWeek(wk.tiers, wk.week);
    for (let i = 0; i < LANE_COUNT; i++) lanes[i].push(...weekLanes[i]);
  }
  return lanes;
}
