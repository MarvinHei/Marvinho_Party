// End-of-minigame results (podium / team scoreboard).

import { RANK_REWARDS } from "./config.js";
import type { MinigameType } from "./minigames.js";

/** One player's line on the end-of-minigame podium/scoreboard. */
export interface ScoreRow {
  playerId: string;
  nickname: string;
  color: string;
  /** 0-based finishing place. */
  rank: number;
  /** Tiles awarded this round. */
  reward: number;
  /** Whether this row is a "winning" outcome (for styling). */
  win: boolean;
  /** Short human-readable detail, e.g. "3 guesses · 12.4s" or "Blue · won". */
  detail: string;
}

/** Result of a completed minigame, used to animate the board & podium. */
export interface MinigameResult {
  type: MinigameType;
  /** Player ids in finishing order (best first). */
  ranking: string[];
  /** Tiles awarded this round, keyed by player id. */
  rewards: Record<string, number>;
  /** Detailed rows for the results animation, best first. */
  scoreboard: ScoreRow[];
  /** Present for team games — drives the team scoreboard instead of the podium. */
  teams?: TeamScore[];
  /** A short thing to reveal after the round (e.g. the Wordle answer). */
  reveal?: string;
}

/** One team's line on a team-based results scoreboard. */
export interface TeamScore {
  /** Team id — "a"/"b" for Codenames, or a generic id for team minigames. */
  team: string;
  name: string;
  color: string;
  /** Tiles each member of this team earned. */
  points: number;
  won: boolean;
  members: { playerId: string; nickname: string }[];
}


/** Tiles awarded for a given 0-based finishing rank. */
export function rewardForRank(rank: number): number {
  return RANK_REWARDS[rank] ?? 0;
}
