// ============================================================================
// Socket protocol: lobby-level events plus one generic channel per direction
// that every minigame speaks through. A game's messages are declared once here
// (GameInputs / GameEvents) and both ends derive their types from that.
// ============================================================================

import type {
  Ack,
  Appearance,
  BattleInitPayload,
  BattleStatePayload,
  CodenamesView,
  FindWordView,
  GeoStanding,
  GuessCountryGuess,
  HideInitPayload,
  HideStatePayload,
  JoinedLobby,
  LobbySettings,
  LobbyView,
  MinigameResult,
  MinigameType,
  PongInitPayload,
  PongStatePayload,
  RunnerInitPayload,
  RunnerStatePayload,
  SkribblSegment,
  SkribblTeamsView,
  SkribblView,
  SterbegeldInitPayload,
  SterbegeldStatePayload,
  TeamDraftTeam,
  TetrisBoardSnapshot,
  TetrisInitPayload,
  TravleStanding,
  WordleGuessResult,
  WordleStanding,
  WordleStartPayload,
} from "./index.js";
import type { PuzzleGame, PuzzleSpec, PuzzleStanding } from "./puzzles.js";
import type { GeoGeometry } from "./worldGeometry.js";

// ---------------------------------------------------------------------------
// Per-game inputs (client -> server)
// ---------------------------------------------------------------------------

/** One input kind: its payload and what the server answers. `void` = fire-and-forget. */
export interface InputSpec<Req = unknown, Res = unknown> {
  req: Req;
  res: Res;
}

type Send<Req> = InputSpec<Req, void>;
type Empty = Record<string, never>;

interface SkribblInputs {
  /** Drawer only: relay a drawn segment. */
  draw: Send<{ seg: SkribblSegment }>;
  /** Drawer only: clear the canvas. */
  clear: Send<Empty>;
  guess: InputSpec<{ text: string }, { correct: boolean; close: boolean }>;
}

interface PuzzleInputs {
  /** Submit a solution (the client auto-submits when locally valid). */
  submit: InputSpec<{ solution: number[] }, { solved: boolean }>;
}

export interface GameInputs {
  wordle: {
    guess: InputSpec<{ guess: string }, { result: WordleGuessResult; solved: boolean }>;
  };
  codenames: {
    clue: InputSpec<{ word: string; count: number }, null>;
    guess: InputSpec<{ index: number }, null>;
    endTurn: InputSpec<Empty, null>;
  };
  skribbl: SkribblInputs;
  /** Drawing is relayed to the drawer's teammates only. */
  skribblteams: SkribblInputs;
  findword: {
    submit: InputSpec<{ word: string }, { accepted: boolean }>;
  };
  tetris: {
    /** Relay this player's board snapshot to spectators. */
    board: Send<{ cells: string; lines: number }>;
    /** Report a line clear; the server routes garbage to the target. */
    lines: Send<{ lines: number }>;
    /** Choose which opponent receives this player's garbage ("random" allowed). */
    target: Send<{ targetId: string }>;
    /** This player topped out. */
    dead: Send<Empty>;
  };
  zip: PuzzleInputs;
  queens: PuzzleInputs;
  sudoku: PuzzleInputs;
  tango: PuzzleInputs;
  guesscountry: {
    guess: InputSpec<{ name: string }, { guess: GuessCountryGuess }>;
  };
  travle: {
    guess: InputSpec<{ name: string }, { code: string; name: string; connected: boolean }>;
  };
  pong: {
    /** Paddle center, normalized 0..1. */
    move: Send<{ y: number }>;
  };
  verstecken: {
    /** Movement direction (each -1..1). */
    move: Send<{ dx: number; dy: number }>;
    /** Seeker attempts a catch. */
    stab: Send<Empty>;
    /** Blink to a map position (on a cooldown). */
    teleport: Send<{ x: number; y: number }>;
    /** Seeker aims the flashlight (radians). */
    aim: Send<{ angle: number }>;
  };
  battle: {
    move: Send<{ dx: number; dy: number }>;
    /** Fire a shot at the aim angle (radians). */
    shoot: Send<{ angle: number }>;
  };
  runner: {
    /** Held state: dir (+1 accelerate / -1 brake / 0) and duck. */
    move: Send<{ dir: number; duck: boolean }>;
    jump: Send<Empty>;
    /** Shockwave that shoves nearby players (on cooldown). */
    shock: Send<Empty>;
  };
  sterbegeld: {
    /** DELA: sign the contract. */
    sign: Send<Empty>;
    /** Wartezeit: held horizontal direction (-1..1). */
    move: Send<{ dir: number }>;
  };
}

export type InputKind<G extends MinigameType> = keyof GameInputs[G] & string;
type SpecOf<G extends MinigameType, K extends InputKind<G>> =
  GameInputs[G][K] extends InputSpec ? GameInputs[G][K] : never;
export type InputReq<G extends MinigameType, K extends InputKind<G>> = SpecOf<G, K>["req"];
export type InputRes<G extends MinigameType, K extends InputKind<G>> = SpecOf<G, K>["res"];

/** Input kinds that expect an answer (sent over `game:request`). */
export type RequestKind<G extends MinigameType> = {
  [K in InputKind<G>]: InputRes<G, K> extends void ? never : K;
}[InputKind<G>];
/** Fire-and-forget input kinds (sent over `game:send`). */
export type SendKind<G extends MinigameType> = Exclude<InputKind<G>, RequestKind<G>>;

/** A game input on the wire. */
export type GameInputMsg = {
  [G in MinigameType]: {
    [K in InputKind<G>]: { game: G; kind: K; payload: InputReq<G, K> };
  }[InputKind<G>];
}[MinigameType];

// ---------------------------------------------------------------------------
// Per-game events (server -> client)
// ---------------------------------------------------------------------------

interface PuzzleEvents {
  /** The puzzle everyone races to solve. */
  init: { game: PuzzleGame; spec: PuzzleSpec; endsAt: number; roundSeconds: number };
  standings: PuzzleStanding[];
}

interface SkribblEvents<View> {
  /** Per-player state (the drawer additionally receives the word). */
  state: View;
  /** A drawn segment relayed from the drawer. */
  draw: { seg: SkribblSegment };
  /** Clear the canvas (new turn or drawer cleared). */
  clear: null;
}

interface RealtimeEvents<Init, State> {
  /** Setup + this player's identity/role. */
  init: Init;
  /** A per-viewer snapshot (~20–30/s). */
  state: State;
}

export interface GameEvents {
  wordle: {
    init: WordleStartPayload;
    standings: WordleStanding[];
  };
  /** Per-player view (spymasters additionally receive the key). */
  codenames: { state: CodenamesView };
  skribbl: SkribblEvents<SkribblView>;
  skribblteams: SkribblEvents<SkribblTeamsView>;
  /** Per-player view, scoped to the viewer's team. */
  findword: { state: FindWordView };
  tetris: {
    init: TetrisInitPayload;
    /** A relayed opponent board snapshot. */
    board: TetrisBoardSnapshot;
    /** Incoming garbage for the receiving player. */
    garbage: { rows: number; hole: number };
    /** Alive/KO'd roster update. */
    players: { alive: string[]; kos: string[] };
  };
  zip: PuzzleEvents;
  queens: PuzzleEvents;
  sudoku: PuzzleEvents;
  tango: PuzzleEvents;
  guesscountry: {
    /** The anonymized silhouette to identify (never its code/name). */
    init: { geometry: GeoGeometry; endsAt: number; roundSeconds: number; maxTries: number };
    standings: GeoStanding[];
  };
  travle: {
    /** The two countries to connect. */
    init: { startCode: string; endCode: string; endsAt: number; roundSeconds: number };
    standings: TravleStanding[];
  };
  pong: RealtimeEvents<PongInitPayload, PongStatePayload>;
  verstecken: RealtimeEvents<HideInitPayload, HideStatePayload>;
  battle: RealtimeEvents<BattleInitPayload, BattleStatePayload>;
  runner: RealtimeEvents<RunnerInitPayload, RunnerStatePayload>;
  /** Split-screen: every client receives the same full state. */
  sterbegeld: RealtimeEvents<SterbegeldInitPayload, SterbegeldStatePayload>;
}

export type EventKind<G extends MinigameType> = keyof GameEvents[G] & string;
export type EventPayload<G extends MinigameType, K extends EventKind<G>> = GameEvents[G][K];

/** A game event on the wire. */
export type GameEventMsg = {
  [G in MinigameType]: {
    [K in EventKind<G>]: { game: G; kind: K; payload: EventPayload<G, K> };
  }[EventKind<G>];
}[MinigameType];

// ---------------------------------------------------------------------------
// Socket.IO event maps (typed both ends)
// ---------------------------------------------------------------------------

export interface ClientToServerEvents {
  "lobby:create": (
    payload: { nickname: string; appearance?: Appearance },
    ack: (res: Ack<JoinedLobby>) => void,
  ) => void;

  "lobby:join": (
    payload: { lobbyId: string; nickname: string; appearance?: Appearance },
    ack: (res: Ack<JoinedLobby>) => void,
  ) => void;

  /** Re-attach to an existing seat after a reconnect / page refresh. */
  "lobby:resume": (
    payload: { lobbyId: string; playerId: string },
    ack: (res: Ack<JoinedLobby>) => void,
  ) => void;

  /** Change this player's character look (only while in the lobby). */
  "lobby:setAppearance": (
    payload: { appearance: Appearance },
    ack: (res: Ack<null>) => void,
  ) => void;

  "lobby:start": (ack: (res: Ack<null>) => void) => void;

  /** Toggle this player's ready vote during an intermission. */
  "lobby:ready": (payload: { ready: boolean }, ack: (res: Ack<null>) => void) => void;

  /** Host-only: skip the ready vote and start the next minigame now. */
  "lobby:forceStart": (ack: (res: Ack<null>) => void) => void;

  /** Host-only: confirm the results podium, releasing the board advance. */
  "lobby:confirmResults": (ack: (res: Ack<null>) => void) => void;

  /** Give up the current minigame — take 0 points and sit out the rest. */
  "lobby:forfeit": (ack: (res: Ack<null>) => void) => void;

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

  /** A fire-and-forget input to the running minigame. */
  "game:send": (msg: GameInputMsg) => void;
  /** An input to the running minigame that the server answers. */
  "game:request": (msg: GameInputMsg, ack: (res: Ack<unknown>) => void) => void;

  /** Spectate — a player pushes an opaque snapshot of its own in-progress view. */
  "spectate:push": (payload: { data: string }) => void;
  /** Spectate — set (or clear, with null) which player's POV I'm watching. */
  "spectate:watch": (payload: { targetId: string | null }) => void;
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

  /** A minigame begins (or is re-entered after a reconnect). Its own setup
   *  follows as `game:event`s. */
  "minigame:start": (payload: { type: MinigameType }) => void;

  /** The active timed round's deadline moved (e.g. shrunk after a solve). */
  "minigame:timer": (payload: { endsAt: number }) => void;

  /** An event from the running minigame. */
  "game:event": (msg: GameEventMsg) => void;

  /** Spectate — the latest snapshot of the player this client is watching. */
  "spectate:frame": (payload: { targetId: string; data: string }) => void;

  "minigame:ended": (payload: {
    result: MinigameResult;
    lobby: LobbyView;
  }) => void;

  /** The host confirmed the podium — clients play the board advance now. */
  "minigame:advance": (payload: { lobby: LobbyView }) => void;

  /** After the winning hop lands: play the on-board celebration before the win screen. */
  "minigame:celebrate": (payload: { winnerId: string; lobby: LobbyView }) => void;

  "game:finished": (payload: { winnerId: string; lobby: LobbyView }) => void;

  "server:error": (payload: { message: string }) => void;

  /** The server is shutting down (e.g. a deploy); running matches end. */
  "server:restarting": (payload: { message: string }) => void;
}
