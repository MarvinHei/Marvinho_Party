// Player-count rules per minigame — the one place both the server's wheel and
// the client's practice launcher read from.

import { canFormTeams } from "./config.js";
import type { MinigameType } from "./minigames.js";

/** How a team game splits players before the round. */
export type TeamDraftMode = "codenames" | "equal";

export interface MinigameRules {
  /** Can this game be played with `n` connected players? */
  playable(n: number): boolean;
  /** Smallest lobby that can play it (debug practice spawns bots up to this). */
  minPlayers: number;
  /** Team games draw teams (with a confirm gate) before the round. */
  teams: TeamDraftMode | null;
}

const atLeast = (min: number): MinigameRules => ({ playable: (n) => n >= min, minPlayers: min, teams: null });

export const MINIGAME_RULES: Record<MinigameType, MinigameRules> = {
  wordle: atLeast(1),
  guesscountry: atLeast(1),
  travle: atLeast(1),
  // Single-player puzzle races work at any size.
  zip: atLeast(1),
  queens: atLeast(1),
  sudoku: atLeast(1),
  tango: atLeast(1),
  // A drawer + at least one guesser.
  skribbl: atLeast(2),
  tetris: atLeast(2),
  // 1v1 matches; an odd one out faces a CPU.
  pong: atLeast(2),
  // One seeker + at least two hiders.
  verstecken: atLeast(3),
  battle: atLeast(3),
  runner: atLeast(2),
  // Split-screen score duel (up to 8, enforced by the lobby cap).
  sterbegeld: atLeast(2),
  // Equal teams of ≥ 2 (e.g. 4, 6, 8, 9 players).
  skribblteams: { playable: canFormTeams, minPlayers: 4, teams: "equal" },
  findword: { playable: canFormTeams, minPlayers: 4, teams: "equal" },
  // Two real teams — even count, at least 4 players.
  codenames: { playable: (n) => n >= 4 && n % 2 === 0, minPlayers: 4, teams: "codenames" },
};
