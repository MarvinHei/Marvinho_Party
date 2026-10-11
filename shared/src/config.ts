// Tunables: board size, per-game configs, rewards, palettes, teams.

export const GAME_CONFIG = {
  /** Number of tiles between the start (0) and the finish line. */
  boardLength: 20,
  /** Minimum players required for the host to start a game. */
  minPlayers: 2,
  /** Maximum players a single lobby accepts. */
  maxPlayers: 8,
} as const;

export const WORDLE_CONFIG = {
  wordLength: 5,
  maxGuesses: 6,
  /** Hard time limit for a single Wordle round, in seconds. */
  roundSeconds: 120,
} as const;

export const CODENAMES_CONFIG = {
  gridSize: 25,
  /** Card counts: starting team, other team, neutral, assassin (sum = 25). */
  startingTeamCards: 9,
  otherTeamCards: 8,
  neutralCards: 7,
  assassinCards: 1,
  /** Hard time limit for a Codenames round, in seconds. */
  roundSeconds: 300,
} as const;

export const SKRIBBL_CONFIG = {
  /** Seconds each drawer gets. */
  roundSeconds: 90,
  /** Max points a guesser can earn on an instant guess (scales down with time). */
  guessMaxPoints: 200,
  /** Minimum points for any correct guess. */
  guessMinPoints: 10,
  /** Max points the drawer earns when everyone guesses. */
  drawMaxPoints: 150,
  /** How many chat lines to retain. */
  chatLimit: 60,
} as const;

export const SKRIBBL_TEAMS_CONFIG = {
  /** Seconds each drawing round gets (all teams draw the same word at once). */
  roundSeconds: 75,
  /** Pause between rounds, in milliseconds. */
  betweenRoundsMs: 4500,
  /** How many chat lines to retain per team. */
  chatLimit: 60,
} as const;

export const FINDWORD_CONFIG = {
  /** A submitted word must be at least this many letters. */
  minWordLength: 5,
  /** Give up (rank the team as "did not converge") after this many attempts. */
  maxRounds: 12,
  /** Per-attempt soft deadline, in seconds. Non-submitters are auto-skipped. */
  roundSeconds: 60,
} as const;

export const TETRIS_CONFIG = {
  cols: 10,
  rows: 20,
  /** Garbage lines sent to the target, indexed by lines cleared at once. */
  garbageForLines: [0, 0, 1, 2, 4] as const,
  /** Hard time cap for a Tetris match, in seconds. */
  roundSeconds: 240,
} as const;

/** Named/colored slots for generic team games (index = team order). */
export const TEAM_STYLES = [
  { name: "Red", color: "#e6394b" },
  { name: "Blue", color: "#3aa0ff" },
  { name: "Green", color: "#42d17a" },
  { name: "Yellow", color: "#ffd23f" },
] as const;

/**
 * Valid numbers of equal-sized teams for `n` players: every team must have at
 * least 2 members and there must be at least 2 teams. e.g. 6 → [2, 3]
 * (2v2v2 or 3v3), 4 → [2], primes/`<4` → [].
 */
export function possibleTeamCounts(n: number): number[] {
  const out: number[] = [];
  for (let k = 2; k <= Math.floor(n / 2); k++) {
    if (n % k === 0 && n / k >= 2) out.push(k);
  }
  return out;
}

/** True when `n` players can be split into equal teams of ≥ 2. */
export function canFormTeams(n: number): boolean {
  return possibleTeamCounts(n).length > 0;
}

/** How long the game-selection wheel spins, in milliseconds. */
export const WHEEL_SPIN_MS = 4000;

/** Tiles awarded by finishing rank (index 0 = 1st place). Only the top three
 *  place; everyone else (4th and beyond, and non-finishers) gets 0. */
export const RANK_REWARDS = [3, 2, 1] as const;

/** Palette assigned to players in join order (pixel-friendly, high contrast). */
export const PLAYER_COLORS = [
  "#e6394b", // red
  "#3aa0ff", // blue
  "#42d17a", // green
  "#ffd23f", // yellow
  "#b06bff", // purple
  "#ff8c42", // orange
  "#28e0d0", // teal
  "#ff6fcf", // pink
] as const;
