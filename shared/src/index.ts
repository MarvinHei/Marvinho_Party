// ============================================================================
// Marvinho Party — shared protocol & domain types
// This module is the single source of truth for the client/server contract.
// ============================================================================

export * from "./puzzles.js";
export * from "./geoData.js";
export * from "./worldGeometry.js";
export * from "./geo.js";
import { PUZZLE_ROUND_SECONDS } from "./puzzles.js";
import type { PuzzleDifficulty, PuzzleGame, PuzzleSpec, PuzzleStanding } from "./puzzles.js";
import type { GeoGeometry } from "./worldGeometry.js";

// ---------------------------------------------------------------------------
// Constants / tunables
// ---------------------------------------------------------------------------

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

/** Tiles awarded by finishing rank (index 0 = 1st place). Extra ranks get 1. */
export const RANK_REWARDS = [4, 3, 2, 1] as const;

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

// ---------------------------------------------------------------------------
// Domain views (server -> client snapshots; never contain secrets)
// ---------------------------------------------------------------------------

export type LobbyPhase =
  | "lobby"
  | "intermission"
  | "spinning"
  | "assigning"
  | "explaining"
  | "countdown"
  | "minigame"
  | "finished";

export interface PlayerView {
  id: string;
  nickname: string;
  color: string;
  /** 0 = start tile, GAME_CONFIG.boardLength = finish line. */
  position: number;
  isHost: boolean;
  connected: boolean;
  /** Has this player voted ready during an intermission? */
  ready: boolean;
}

export interface LobbyView {
  id: string;
  phase: LobbyPhase;
  hostId: string;
  players: PlayerView[];
  boardLength: number;
  minPlayers: number;
  /** Set once someone crosses the finish line. */
  winnerId: string | null;
  /** Which minigame is active/last, for UI routing. */
  currentMinigame: MinigameType | null;
  /** Host-configured lobby settings (per-game timers, difficulty, blacklist…). */
  settings: LobbySettings;
  /** Debug practice mode: play minigames standalone, no board/scoreboard. */
  sandbox: boolean;
}

// ---------------------------------------------------------------------------
// Minigames
// ---------------------------------------------------------------------------

export type MinigameType =
  | "wordle"
  | "codenames"
  | "skribbl"
  | "skribblteams"
  | "findword"
  | "tetris"
  | "zip"
  | "queens"
  | "sudoku"
  | "tango"
  | "guesscountry"
  | "travle";

/** Human-facing names for the wheel and UI. */
export const MINIGAME_NAMES: Record<MinigameType, string> = {
  wordle: "Wordle Race",
  codenames: "Codenames",
  skribbl: "Skribbl",
  skribblteams: "Skribbl Teams",
  findword: "Find the Word",
  tetris: "Tetris",
  zip: "Zip",
  queens: "Queens",
  sudoku: "Mini-Sudoku",
  tango: "Tango",
  guesscountry: "Guess the Country",
  travle: "Travle",
};

// ---------------------------------------------------------------------------
// Lobby settings (host-configurable in the lobby, before the match starts)
// ---------------------------------------------------------------------------

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
  return out;
}

/** One row of Wordle feedback. */
export type LetterState = "correct" | "present" | "absent";

export interface WordleGuessResult {
  guess: string;
  states: LetterState[];
}

/** Per-player public standing during a Wordle round (no letters leaked). */
export interface WordleStanding {
  playerId: string;
  nickname: string;
  color: string;
  guessesUsed: number;
  solved: boolean;
  /** Finishing rank once solved/done, else null. */
  rank: number | null;
}

/** Sent to a client when a Wordle round begins. */
export interface WordleStartPayload {
  wordLength: number;
  maxGuesses: number;
  roundSeconds: number;
  /** Server clock (ms epoch) at which the round ends. */
  endsAt: number;
}

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

// ---------------------------------------------------------------------------
// Codenames
// ---------------------------------------------------------------------------

export type CodenamesTeam = "a" | "b";
export type CardColor = "a" | "b" | "neutral" | "assassin";
export type CodenamesTurnPhase = "clue" | "guess";

/** A team/role assignment (used for the draft animation and to build a round). */
export type CodenamesAssignment = Record<
  CodenamesTeam,
  { spymasterId: string; memberIds: string[] }
>;

/** One team in a generic team draft (any team game). */
export interface TeamDraftTeam {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  /** Codenames only: the spymaster of this team. */
  spymasterId?: string | null;
}

export interface CodenamesTeamInfo {
  team: CodenamesTeam;
  spymasterId: string | null;
  memberIds: string[];
  /** Cards of this team still hidden. */
  remaining: number;
}

/** Per-player Codenames view. The key is included only for that team's spymaster. */
export interface CodenamesView {
  words: string[];
  /** What each card has been revealed as (null = still hidden). */
  revealed: (CardColor | null)[];
  /** True colors of every card — present ONLY for the viewing spymaster. */
  key: CardColor[] | null;
  teams: Record<CodenamesTeam, CodenamesTeamInfo>;
  startingTeam: CodenamesTeam;
  turn: CodenamesTeam;
  turnPhase: CodenamesTurnPhase;
  clue: { word: string; count: number; guessesLeft: number } | null;
  /** Viewer context. */
  myTeam: CodenamesTeam | null;
  isSpymaster: boolean;
  /** Recent event log lines, newest last. */
  log: string[];
  /** Set once the round ends. */
  winner: CodenamesTeam | null;
}

// ---------------------------------------------------------------------------
// Skribbl
// ---------------------------------------------------------------------------

/** One drawn line segment, coordinates normalized to 0..1. */
export interface SkribblSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  /** When true, this op is a flood fill starting at (x0,y0) with `color`. */
  fill?: boolean;
}

export type SkribblChatKind = "guess" | "system" | "correct";

export interface SkribblChatMessage {
  id: number;
  kind: SkribblChatKind;
  text: string;
  nickname?: string;
  color?: string;
}

export interface SkribblScore {
  playerId: string;
  nickname: string;
  color: string;
  points: number;
}

export type SkribblPhase = "drawing" | "turnEnd";

/** Per-player Skribbl view. The real word is included only for the drawer. */
export interface SkribblView {
  round: number;
  totalRounds: number;
  drawerId: string;
  drawerNickname: string;
  isDrawer: boolean;
  /** The word — only for the drawer. */
  word: string | null;
  /** Masked display for guessers (e.g. "_ _ _ _ _"), revealing length/spaces. */
  maskedWord: string;
  endsAt: number;
  phase: SkribblPhase;
  /** Has the viewing player guessed correctly this turn? */
  iGuessed: boolean;
  correctIds: string[];
  chat: SkribblChatMessage[];
  scores: SkribblScore[];
  /** The word, revealed during the turn-end pause. */
  reveal: string | null;
}

// ---------------------------------------------------------------------------
// Skribbl Teams (team draw-and-guess race)
// ---------------------------------------------------------------------------

export type SkribblTeamsPhase = "drawing" | "roundEnd" | "done";

/** Live standing of one team during a Skribbl Teams match. */
export interface SkribblTeamProgress {
  teamId: string;
  name: string;
  color: string;
  /** Words this team has guessed correctly so far. */
  solvedCount: number;
  /** Has this team already guessed the current round's word? */
  solvedThisRound: boolean;
  memberIds: string[];
}

/** Per-player Skribbl Teams view (scoped to the viewer's own team). */
export interface SkribblTeamsView {
  round: number;
  totalRounds: number;
  phase: SkribblTeamsPhase;
  endsAt: number;
  /** The viewer's team, or null if they have none. */
  teamId: string | null;
  teamName: string;
  teamColor: string;
  /** The viewer's team's drawer this round. */
  drawerId: string;
  drawerNickname: string;
  isDrawer: boolean;
  /** The word — only for the viewer's own team drawer. */
  word: string | null;
  maskedWord: string;
  iGuessed: boolean;
  /** Teammates who have guessed the current word. */
  correctIds: string[];
  /** Team-scoped chat. */
  chat: SkribblChatMessage[];
  /** The word revealed during the round-end pause. */
  reveal: string | null;
  /** Standings for every team. */
  teams: SkribblTeamProgress[];
}

// ---------------------------------------------------------------------------
// Find the Word (team convergence race)
// ---------------------------------------------------------------------------

export type FindWordPhase = "playing" | "done";

/** One player's submitted word in a resolved Find the Word round. */
export interface FindWordEntry {
  playerId: string;
  nickname: string;
  color: string;
  word: string;
}

/** Live standing of one team during a Find the Word match. */
export interface FindWordProgress {
  teamId: string;
  name: string;
  color: string;
  /** Attempts used so far (or final count once converged). */
  attempts: number;
  /** Has this team converged on a single word? */
  done: boolean;
  memberIds: string[];
}

/** Per-player Find the Word view (scoped to the viewer's own team). */
export interface FindWordView {
  phase: FindWordPhase;
  /** The viewer's team's current attempt (1-based). */
  round: number;
  teamId: string | null;
  teamName: string;
  teamColor: string;
  members: { id: string; nickname: string; color: string }[];
  /** Resolved rounds for the viewer's team, oldest first. */
  history: FindWordEntry[][];
  mySubmitted: boolean;
  myWord: string | null;
  /** Teammate ids who have not yet submitted this attempt. */
  waitingOn: string[];
  /** Has the viewer's team converged? */
  finished: boolean;
  attempts: number;
  convergedWord: string | null;
  minWordLength: number;
  /** The viewer's team's current attempt deadline (ms epoch), or null. */
  endsAt: number | null;
  teams: FindWordProgress[];
}

// ---------------------------------------------------------------------------
// Tetris (real-time versus, garbage-sending)
// ---------------------------------------------------------------------------

export interface TetrisPlayerInfo {
  id: string;
  nickname: string;
  color: string;
}

/** A compact snapshot of one player's board for the spectator mini-views. */
export interface TetrisBoardSnapshot {
  playerId: string;
  /** rows*cols cells, top→bottom, left→right. "." = empty, else a piece key. */
  cells: string;
  /** Total lines this player has cleared. */
  lines: number;
  alive: boolean;
}

/** Sent when a Tetris match begins. */
export interface TetrisInitPayload {
  players: TetrisPlayerInfo[];
  /** Shared RNG seed so every player gets the same piece sequence. */
  seed: number;
  /** Server clock (ms epoch) at which falling begins. */
  startsAt: number;
  /** Board height in rows (host-configurable). */
  rows: number;
  /** Board width in columns. */
  cols: number;
}

// ---------------------------------------------------------------------------
// Guess the Country (shape-guessing race)
// ---------------------------------------------------------------------------

/** One guess in Guess the Country, with the distance/direction hint. */
export interface GuessCountryGuess {
  code: string;
  name: string;
  correct: boolean;
  /** Distance in km from the guessed country to the answer (0 when correct). */
  distanceKm: number;
  /** True compass bearing (0=N,90=E,…) from the guess toward the answer. */
  bearingDeg: number;
  /** Proximity 0..1 (1 = correct) for a warmth bar. */
  proximity: number;
}

/** Per-player public standing during a Guess the Country round. */
export interface GeoStanding {
  playerId: string;
  nickname: string;
  color: string;
  solved: boolean;
  tries: number;
  rank: number | null;
}

// ---------------------------------------------------------------------------
// Travle (connect two countries by naming the ones in between)
// ---------------------------------------------------------------------------

/** Per-player public standing during a Travle round. */
export interface TravleStanding {
  playerId: string;
  nickname: string;
  color: string;
  connected: boolean;
  /** How many countries the player has named so far. */
  count: number;
  rank: number | null;
}

// ---------------------------------------------------------------------------
// Acknowledgement payloads (socket.io callback responses)
// ---------------------------------------------------------------------------

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export interface JoinedLobby {
  lobbyId: string;
  playerId: string;
  lobby: LobbyView;
}

// ---------------------------------------------------------------------------
// Socket.IO event maps (typed both ends)
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  "lobby:create": (
    payload: { nickname: string },
    ack: (res: Ack<JoinedLobby>) => void,
  ) => void;

  "lobby:join": (
    payload: { lobbyId: string; nickname: string },
    ack: (res: Ack<JoinedLobby>) => void,
  ) => void;

  "lobby:start": (ack: (res: Ack<null>) => void) => void;

  /** Toggle this player's ready vote during an intermission. */
  "lobby:ready": (payload: { ready: boolean }, ack: (res: Ack<null>) => void) => void;

  /** Host-only: skip the ready vote and start the next minigame now. */
  "lobby:forceStart": (ack: (res: Ack<null>) => void) => void;

  /** Host-only: remove another player from the lobby. */
  "lobby:kick": (
    payload: { playerId: string },
    ack: (res: Ack<null>) => void,
  ) => void;

  /** Host-only: replace the lobby settings (only while in the lobby). */
  "lobby:updateSettings": (
    payload: { settings: LobbySettings },
    ack: (res: Ack<null>) => void,
  ) => void;

  /** Debug: start a specific minigame standalone (sandbox, no board scoring). */
  "lobby:debugStart": (
    payload: { game: MinigameType },
    ack: (res: Ack<null>) => void,
  ) => void;

  "lobby:leave": () => void;

  "wordle:guess": (
    payload: { guess: string },
    ack: (
      res: Ack<{ result: WordleGuessResult; solved: boolean }>,
    ) => void,
  ) => void;

  "codenames:clue": (
    payload: { word: string; count: number },
    ack: (res: Ack<null>) => void,
  ) => void;

  "codenames:guess": (
    payload: { index: number },
    ack: (res: Ack<null>) => void,
  ) => void;

  "codenames:endTurn": (ack: (res: Ack<null>) => void) => void;

  /** Drawer only: broadcast a drawn segment (fire-and-forget). */
  "skribbl:draw": (payload: { seg: SkribblSegment }) => void;

  /** Drawer only: clear the canvas. */
  "skribbl:clear": () => void;

  "skribbl:guess": (
    payload: { text: string },
    ack: (res: Ack<{ correct: boolean; close: boolean }>) => void,
  ) => void;

  /** Skribbl Teams — drawer only: broadcast a segment to teammates. */
  "skribblteams:draw": (payload: { seg: SkribblSegment }) => void;
  /** Skribbl Teams — drawer only: clear the team canvas. */
  "skribblteams:clear": () => void;
  "skribblteams:guess": (
    payload: { text: string },
    ack: (res: Ack<{ correct: boolean; close: boolean }>) => void,
  ) => void;

  /** Find the Word — submit this attempt's secret word. */
  "findword:submit": (
    payload: { word: string },
    ack: (res: Ack<{ accepted: boolean }>) => void,
  ) => void;

  /** Tetris — relay this player's board snapshot to spectators. */
  "tetris:board": (payload: { cells: string; lines: number }) => void;
  /** Tetris — report a line clear; the server routes garbage to the target. */
  "tetris:lines": (payload: { lines: number }) => void;
  /** Tetris — choose which opponent receives this player's garbage. */
  "tetris:target": (payload: { targetId: string }) => void;
  /** Tetris — this player topped out. */
  "tetris:dead": () => void;

  /** Submit a puzzle solution (client auto-submits when locally valid). */
  "puzzle:submit": (
    payload: { solution: number[] },
    ack: (res: Ack<{ solved: boolean }>) => void,
  ) => void;

  /** Guess the Country — submit a country name. */
  "guesscountry:guess": (
    payload: { name: string },
    ack: (res: Ack<{ guess: GuessCountryGuess }>) => void,
  ) => void;

  /** Travle — name a country to bridge the start and end. */
  "travle:guess": (
    payload: { name: string },
    ack: (res: Ack<{ code: string; name: string; connected: boolean }>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "lobby:update": (lobby: LobbyView) => void;

  /** Sent to a player the host has removed from the lobby. */
  "lobby:kicked": (payload: { lobbyId: string }) => void;

  "intermission:start": (payload: { lobby: LobbyView }) => void;

  /** Optional explanation screen before a game: players ready-gate to begin. */
  "minigame:explain": (payload: { game: MinigameType }) => void;

  /** The wheel result: which games were available and which one was chosen. */
  "minigame:spin": (payload: {
    options: MinigameType[];
    chosen: MinigameType;
    spinMs: number;
  }) => void;

  /** Team games: the drafted teams to animate + confirm before the round. */
  "minigame:teams": (payload: {
    game: MinigameType;
    teams: TeamDraftTeam[];
  }) => void;

  /** Countdown before the chosen game begins. */
  "minigame:countdown": (payload: {
    game: MinigameType;
    endsAt: number;
  }) => void;

  "minigame:start": (payload: {
    type: MinigameType;
    wordle?: WordleStartPayload;
  }) => void;

  "wordle:standings": (standings: WordleStanding[]) => void;

  /** Per-player Codenames state (spymasters additionally receive the key). */
  "codenames:state": (view: CodenamesView) => void;

  /** Per-player Skribbl state (the drawer additionally receives the word). */
  "skribbl:state": (view: SkribblView) => void;

  /** A drawn segment relayed to everyone except the drawer. */
  "skribbl:draw": (payload: { seg: SkribblSegment }) => void;

  /** Clear the canvas (new turn or drawer cleared). */
  "skribbl:clear": () => void;

  /** Per-player Skribbl Teams state (own team's drawer additionally gets the word). */
  "skribblteams:state": (view: SkribblTeamsView) => void;
  /** A drawn segment relayed to the drawer's teammates. */
  "skribblteams:draw": (payload: { seg: SkribblSegment }) => void;
  /** Clear the team canvas (new round or drawer cleared). */
  "skribblteams:clear": () => void;

  /** Per-player Find the Word state (scoped to the viewer's team). */
  "findword:state": (view: FindWordView) => void;

  /** Tetris match setup. */
  "tetris:init": (payload: TetrisInitPayload) => void;
  /** A relayed opponent board snapshot. */
  "tetris:board": (payload: TetrisBoardSnapshot) => void;
  /** Incoming garbage for the receiving player. */
  "tetris:garbage": (payload: { rows: number; hole: number }) => void;
  /** Alive/KO'd roster update. */
  "tetris:players": (payload: { alive: string[]; kos: string[] }) => void;

  /** The puzzle everyone races to solve. */
  "puzzle:start": (payload: {
    game: PuzzleGame;
    spec: PuzzleSpec;
    endsAt: number;
    roundSeconds: number;
  }) => void;

  "puzzle:standings": (standings: PuzzleStanding[]) => void;

  /** Guess the Country — the anonymized silhouette to identify. */
  "guesscountry:start": (payload: {
    geometry: GeoGeometry;
    endsAt: number;
    roundSeconds: number;
    maxTries: number;
  }) => void;
  "guesscountry:standings": (standings: GeoStanding[]) => void;

  /** Travle — the two countries to connect. */
  "travle:start": (payload: {
    startCode: string;
    endCode: string;
    endsAt: number;
    roundSeconds: number;
  }) => void;
  "travle:standings": (standings: TravleStanding[]) => void;

  "minigame:ended": (payload: {
    result: MinigameResult;
    lobby: LobbyView;
  }) => void;

  "game:finished": (payload: { winnerId: string; lobby: LobbyView }) => void;

  "server:error": (payload: { message: string }) => void;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** Tiles awarded for a given 0-based finishing rank. */
export function rewardForRank(rank: number): number {
  return RANK_REWARDS[rank] ?? 1;
}

/** Normalize a user-typed nickname; returns null if invalid. */
export function sanitizeNickname(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 16) return null;
  return trimmed;
}
