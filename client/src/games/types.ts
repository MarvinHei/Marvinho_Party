import type { ComponentType } from "react";
import type {
  BattleInitPayload,
  BattleStatePayload,
  CodenamesView,
  EventKind,
  EventPayload,
  FindWordView,
  GeoGeometry,
  GeoStanding,
  GuessCountryGuess,
  HideInitPayload,
  HideStatePayload,
  MinigameType,
  PongInitPayload,
  PongStatePayload,
  PuzzleGame,
  PuzzleSpec,
  PuzzleStanding,
  RunnerInitPayload,
  RunnerStatePayload,
  SkribblSegment,
  SkribblTeamsView,
  SkribblView,
  SterbegeldInitPayload,
  SterbegeldStatePayload,
  TetrisBoardSnapshot,
  TetrisInitPayload,
  TravleStanding,
  WordleGuessResult,
  WordleStanding,
} from "@marvinho/shared";
import type { SeatState } from "../state/types.js";

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
  standings: WordleStanding[];
}

export interface SkribblClientState<View> {
  view: View | null;
  /** Accumulated drawn segments for the current turn (cleared on turn/clear). */
  strokes: SkribblSegment[];
}

/** One incoming garbage event, tagged with a sequence so the engine dedupes. */
export interface TetrisGarbage {
  seq: number;
  rows: number;
  hole: number;
}

export interface TetrisClientState {
  init: TetrisInitPayload | null;
  /** Latest opponent board snapshots, one per player. */
  boards: TetrisBoardSnapshot[];
  /** Pending garbage events (append-only; the engine consumes by seq). */
  garbage: TetrisGarbage[];
  nextGarbageSeq: number;
  alive: string[];
  kos: string[];
}

export interface PuzzleClientState {
  game: PuzzleGame;
  spec: PuzzleSpec;
  endsAt: number;
  roundSeconds: number;
  solvedByMe: boolean;
  standings: PuzzleStanding[];
}

export interface GuessCountryClientState {
  geometry: GeoGeometry;
  endsAt: number;
  roundSeconds: number;
  maxTries: number;
  guesses: GuessCountryGuess[];
  solved: boolean;
  standings: GeoStanding[];
}

export interface TravleClientState {
  startCode: string;
  endCode: string;
  endsAt: number;
  roundSeconds: number;
  named: { code: string; name: string; connected: boolean }[];
  connected: boolean;
  standings: TravleStanding[];
}

/** A real-time game: its setup plus the latest server snapshot. */
export interface RealtimeClientState<Init, Snap> {
  init: Init;
  snap: Snap | null;
}

/** Each minigame's client-side state. */
export interface ClientGameStates {
  wordle: WordleClientState;
  codenames: CodenamesView;
  skribbl: SkribblClientState<SkribblView>;
  skribblteams: SkribblClientState<SkribblTeamsView>;
  findword: FindWordView;
  tetris: TetrisClientState;
  zip: PuzzleClientState;
  queens: PuzzleClientState;
  sudoku: PuzzleClientState;
  tango: PuzzleClientState;
  guesscountry: GuessCountryClientState;
  travle: TravleClientState;
  pong: RealtimeClientState<PongInitPayload, PongStatePayload>;
  verstecken: RealtimeClientState<HideInitPayload, HideStatePayload>;
  battle: RealtimeClientState<BattleInitPayload, BattleStatePayload>;
  runner: RealtimeClientState<RunnerInitPayload, RunnerStatePayload>;
  sterbegeld: RealtimeClientState<SterbegeldInitPayload, SterbegeldStatePayload>;
}

/** The game a seat is in. `state` is null until the game's setup arrives. */
export type ActiveGame = {
  [G in MinigameType]: { type: G; state: ClientGameStates[G] | null };
}[MinigameType];

/** A game event as a reducer sees it. */
export type ClientGameEvent<G extends MinigameType> = {
  [K in EventKind<G>]: { kind: K; payload: EventPayload<G, K> };
}[EventKind<G>];

export interface ClientGameModule<G extends MinigameType> {
  Panel: ComponentType<{ seat: SeatState }>;
  /** State when the game starts, before any of its events (default null). */
  initial?(): ClientGameStates[G];
  /** Fold one server event into this game's state. */
  reduce(
    state: ClientGameStates[G] | null,
    event: ClientGameEvent<G>,
    seat: SeatState,
  ): ClientGameStates[G] | null;
  /** The round's deadline moved. */
  onTimer?(state: ClientGameStates[G], endsAt: number): ClientGameStates[G];
  /** The round ended (state kept for the results screen). */
  onEnded?(state: ClientGameStates[G]): ClientGameStates[G];
  /** Mount the panel before any state arrives (it handles the empty case). */
  alwaysRender?: boolean;
  /** Remount the panel when switching seat POV in debug mode. */
  keyBySeat?: boolean;
  /** Center the panel on the stage. */
  centered?: boolean;
}
