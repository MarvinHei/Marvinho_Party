import type {
  CodenamesAssignment,
  CodenamesView,
  FindWordView,
  LobbyView,
  MinigameResult,
  MinigameType,
  PuzzleGame,
  PuzzleSpec,
  PuzzleStanding,
  SkribblSegment,
  SkribblTeamsView,
  SkribblView,
  TetrisBoardSnapshot,
  TetrisInitPayload,
  WordleGuessResult,
  WordleStanding,
} from "@marvinho/shared";

/** One incoming garbage event, tagged with a sequence so the engine dedupes. */
export interface TetrisGarbage {
  seq: number;
  rows: number;
  hole: number;
}

export interface PuzzleClientState {
  game: PuzzleGame;
  spec: PuzzleSpec;
  endsAt: number;
  roundSeconds: number;
  solvedByMe: boolean;
}

export type Screen = "home" | "lobby" | "game";
export type MinigamePhase =
  | "intermission"
  | "spinning"
  | "assigning"
  | "explaining"
  | "countdown"
  | "playing"
  | "results";

export interface WheelState {
  options: MinigameType[];
  chosen: MinigameType;
  spinMs: number;
}

export interface WordleClientState {
  wordLength: number;
  maxGuesses: number;
  endsAt: number;
  /** This seat's own submitted guesses. */
  guesses: WordleGuessResult[];
  currentInput: string;
  solved: boolean;
  finished: boolean;
  /** Transient inline message (e.g. "Not in word list"). */
  message: string | null;
}

/** Serializable snapshot of one player seat (the Net lives outside the store). */
export interface SeatState {
  id: string;
  label: string;
  connected: boolean;
  playerId: string | null;
  lobby: LobbyView | null;
  screen: Screen;
  error: string | null;

  minigame: MinigameType | null;
  minigamePhase: MinigamePhase | null;
  /** The game whose explanation screen is showing (phase "explaining"). */
  explainGame: MinigameType | null;
  standings: WordleStanding[];
  lastResult: MinigameResult | null;
  wordle: WordleClientState | null;
  wheel: WheelState | null;
  assign: CodenamesAssignment | null;
  countdown: { game: MinigameType; endsAt: number } | null;
  codenames: CodenamesView | null;
  skribbl: SkribblView | null;
  /** Accumulated drawn segments for the current turn (cleared on turn/clear). */
  skribblStrokes: SkribblSegment[];
  skribblTeams: SkribblTeamsView | null;
  findword: FindWordView | null;
  tetris: TetrisInitPayload | null;
  /** Latest opponent board snapshots, keyed by playerId. */
  tetrisBoards: TetrisBoardSnapshot[];
  /** Pending garbage events (append-only; the engine consumes by seq). */
  tetrisGarbage: TetrisGarbage[];
  tetrisAlive: string[];
  tetrisKos: string[];
  puzzle: PuzzleClientState | null;
  puzzleStandings: PuzzleStanding[];
}

export interface StoreSnapshot {
  debugEnabled: boolean;
  activeSeatId: string | null;
  seats: SeatState[];
}

export function initialSeat(id: string, label: string): SeatState {
  return {
    id,
    label,
    connected: false,
    playerId: null,
    lobby: null,
    screen: "home",
    error: null,
    minigame: null,
    minigamePhase: null,
    explainGame: null,
    standings: [],
    lastResult: null,
    wordle: null,
    wheel: null,
    assign: null,
    countdown: null,
    codenames: null,
    skribbl: null,
    skribblStrokes: [],
    skribblTeams: null,
    findword: null,
    tetris: null,
    tetrisBoards: [],
    tetrisGarbage: [],
    tetrisAlive: [],
    tetrisKos: [],
    puzzle: null,
    puzzleStandings: [],
  };
}
