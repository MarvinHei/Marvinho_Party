// Host-configurable lobby settings.

import { CODENAMES_CONFIG, FINDWORD_CONFIG, SKRIBBL_CONFIG, SKRIBBL_TEAMS_CONFIG, TETRIS_CONFIG, WORDLE_CONFIG } from "./config.js";
import { PONG_POINTS_OPTIONS, type PongPoints } from "./games/pong.js";
import { MINIGAME_NAMES, type MinigameType } from "./minigames.js";
import { PUZZLE_ROUND_SECONDS, type PuzzleDifficulty, type PuzzleGame } from "./puzzles.js";

export type CodenamesSize = 3 | 4 | 5;

/** Per-minigame knobs shared by every game. */
export interface MinigameSettings {
  /** In the wheel pool. false = blacklisted for this lobby. */
  enabled: boolean;
  /** Whether the round enforces a time limit at all. */
  timerEnabled: boolean;
  /** Time limit in seconds (used only when timerEnabled). */
  timerSeconds: number;
}

export interface LobbySettings {
  /** Show an explanation screen (with a ready-gate) before each minigame. */
  explanations: boolean;
  games: Record<MinigameType, MinigameSettings>;
  /** Difficulty per puzzle-race game. */
  puzzleDifficulty: Record<PuzzleGame, PuzzleDifficulty>;
  /** Tetris board height, in rows. */
  tetrisRows: number;
  /** Codenames grid is codenamesSize × codenamesSize. */
  codenamesSize: CodenamesSize;
  /** Travle: show the outlines of not-yet-named countries on the globe. */
  travleOutlines: boolean;
  /** Pong: points needed to win a match. */
  pongPoints: PongPoints;
}

/** Default round length per game (seconds), used to seed settings. */
export const DEFAULT_TIMER_SECONDS: Record<MinigameType, number> = {
  wordle: WORDLE_CONFIG.roundSeconds,
  codenames: CODENAMES_CONFIG.roundSeconds,
  skribbl: SKRIBBL_CONFIG.roundSeconds,
  skribblteams: SKRIBBL_TEAMS_CONFIG.roundSeconds,
  findword: FINDWORD_CONFIG.roundSeconds,
  tetris: TETRIS_CONFIG.roundSeconds,
  zip: PUZZLE_ROUND_SECONDS.zip,
  queens: PUZZLE_ROUND_SECONDS.queens,
  sudoku: PUZZLE_ROUND_SECONDS.sudoku,
  tango: PUZZLE_ROUND_SECONDS.tango,
  guesscountry: 120,
  travle: 180,
  pong: 120,
  verstecken: 150,
  battle: 150,
  runner: 90,
  sterbegeld: 120, // unused: this game has no timer (ends when everyone's out)
};

/** Games that expose a timer-duration slider, with their allowed range. */
export const TIMER_BOUNDS: Partial<Record<MinigameType, { min: number; max: number; step: number }>> = {
  wordle: { min: 30, max: 300, step: 15 },
  skribbl: { min: 30, max: 180, step: 15 },
  skribblteams: { min: 30, max: 180, step: 15 },
  findword: { min: 20, max: 120, step: 10 },
  codenames: { min: 60, max: 600, step: 30 },
  guesscountry: { min: 45, max: 300, step: 15 },
  travle: { min: 60, max: 420, step: 30 },
  runner: { min: 45, max: 180, step: 15 },
};

/** Selectable Tetris board heights. */
export const TETRIS_ROWS_OPTIONS = [14, 16, 18, 20, 24] as const;
export const TETRIS_ROWS_MIN = 12;
export const TETRIS_ROWS_MAX = 26;
export const CODENAMES_SIZES: CodenamesSize[] = [3, 4, 5];

/** When a game's timer is OFF, use a large fallback so mechanics still end. */
export const NO_TIMER_SECONDS = 3600;

/** Puzzle-race games (the ones with a difficulty knob). */
export const PUZZLE_GAME_LIST: PuzzleGame[] = ["zip", "queens", "sudoku", "tango"];

/** A fresh settings object with sensible defaults. */
export function defaultLobbySettings(): LobbySettings {
  const games = {} as Record<MinigameType, MinigameSettings>;
  for (const g of Object.keys(MINIGAME_NAMES) as MinigameType[]) {
    games[g] = { enabled: true, timerEnabled: true, timerSeconds: DEFAULT_TIMER_SECONDS[g] };
  }
  return {
    explanations: true,
    games,
    puzzleDifficulty: { zip: "medium", queens: "medium", sudoku: "medium", tango: "medium" },
    tetrisRows: TETRIS_CONFIG.rows,
    codenamesSize: 5,
    travleOutlines: true,
    pongPoints: 7,
  };
}

/** Card distribution for a Codenames grid of the given size. */
export function codenamesDistribution(size: CodenamesSize): {
  grid: number;
  startingTeamCards: number;
  otherTeamCards: number;
  neutralCards: number;
  assassinCards: number;
} {
  const grid = size * size;
  if (size === 3) return { grid, startingTeamCards: 3, otherTeamCards: 2, neutralCards: 3, assassinCards: 1 };
  if (size === 4) return { grid, startingTeamCards: 6, otherTeamCards: 5, neutralCards: 4, assassinCards: 1 };
  return { grid, startingTeamCards: 9, otherTeamCards: 8, neutralCards: 7, assassinCards: 1 };
}

/** Clamp/repair a settings object arriving from a client into a safe shape. */
export function sanitizeSettings(raw: unknown): LobbySettings {
  const base = defaultLobbySettings();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<LobbySettings>;
  const out = base;
  out.explanations = Boolean(r.explanations);
  if (r.games && typeof r.games === "object") {
    for (const g of Object.keys(base.games) as MinigameType[]) {
      const gs = (r.games as Record<string, Partial<MinigameSettings>>)[g];
      if (!gs) continue;
      const bounds = TIMER_BOUNDS[g];
      const lo = bounds?.min ?? 10;
      const hi = bounds?.max ?? 3600;
      out.games[g] = {
        enabled: gs.enabled !== false,
        timerEnabled: gs.timerEnabled !== false,
        timerSeconds: Math.round(
          Math.max(lo, Math.min(hi, Number(gs.timerSeconds ?? DEFAULT_TIMER_SECONDS[g]))),
        ),
      };
    }
  }
  if (r.puzzleDifficulty && typeof r.puzzleDifficulty === "object") {
    for (const p of PUZZLE_GAME_LIST) {
      const d = (r.puzzleDifficulty as Record<string, PuzzleDifficulty>)[p];
      if (d === "easy" || d === "medium" || d === "hard") out.puzzleDifficulty[p] = d;
    }
  }
  out.tetrisRows = Math.round(
    Math.max(TETRIS_ROWS_MIN, Math.min(TETRIS_ROWS_MAX, Number(r.tetrisRows ?? TETRIS_CONFIG.rows))),
  );
  out.codenamesSize = r.codenamesSize === 3 || r.codenamesSize === 4 ? r.codenamesSize : 5;
  out.travleOutlines = r.travleOutlines !== false;
  out.pongPoints = PONG_POINTS_OPTIONS.includes(r.pongPoints as PongPoints) ? (r.pongPoints as PongPoints) : 7;
  return out;
}
