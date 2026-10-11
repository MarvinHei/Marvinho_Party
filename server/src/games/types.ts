import type {
  CodenamesAssignment,
  EventKind,
  EventPayload,
  InputKind,
  InputRes,
  LobbySettings,
  MinigameResult,
  MinigameType,
  TokenLook,
} from "@marvinho/shared";
import type { TeamSpec } from "../minigames/skribblTeams.js";
import type { GameEnv } from "../minigames/env.js";

/** A player as a minigame sees them. */
export interface RosterPlayer {
  id: string;
  nickname: string;
  color: string;
}

/** Teams drawn by the lobby before a team game (empty when practicing). */
export interface Draft {
  assignment?: CodenamesAssignment;
  teams?: TeamSpec[];
}

/** A reschedulable deadline for timed rounds that shrinks as players solve. */
export interface RoundTimer {
  /** Arm the deadline; returns it (ms epoch). */
  arm(seconds: number, onExpire: () => void): number;
  /** A player solved: pull the deadline in and tell clients. */
  shrink(): void;
  readonly endsAt: number;
}

/**
 * Everything a running minigame may touch. The lobby builds one per round and
 * tears it down (timers, loop) when the round finishes.
 */
export interface GameContext<G extends MinigameType = MinigameType> {
  readonly type: G;
  readonly settings: LobbySettings;
  readonly draft: Draft;
  /** Clock + RNG for this round (seeded in tests). */
  readonly env: GameEnv;
  /** Connected players at the moment the round started. */
  readonly roster: RosterPlayer[];
  /** Every seat in the lobby, connected or not. */
  allPlayers(): RosterPlayer[];
  player(id: string): RosterPlayer | undefined;
  connectedIds(): string[];
  /** Each connected player's look, for real-time game inits. */
  looks(): TokenLook[];

  /** Emit to everyone in the lobby. */
  emit<K extends EventKind<G>>(kind: K, payload: EventPayload<G, K>): void;
  /** Emit to one player (no-op when they're disconnected). */
  emitTo<K extends EventKind<G>>(playerId: string, kind: K, payload: EventPayload<G, K>): void;
  /** Emit to everyone except one player. */
  emitExcept<K extends EventKind<G>>(playerId: string, kind: K, payload: EventPayload<G, K>): void;
  /** Emit a per-player payload to every connected player (null skips them). */
  emitEach<K extends EventKind<G>>(
    kind: K,
    payloadFor: (playerId: string) => EventPayload<G, K> | null | undefined,
  ): void;

  /** One-shot timer, cancelled automatically when the round ends. */
  schedule(fn: () => void, ms: number): () => void;
  /** Cancel every pending one-shot timer. */
  cancelScheduled(): void;
  /** Run a fixed-rate loop; `dt` is seconds since the last tick (capped). */
  loop(intervalMs: number, onTick: (dt: number) => void): void;
  readonly timer: RoundTimer;
  /** This game's round length, honoring the host's timer on/off toggle. */
  roundSeconds(): number;

  /** End the round with these results. Later calls (and emits) are ignored. */
  finish(result: Omit<MinigameResult, "type">): void;
  readonly finished: boolean;
}

/** Input handlers keyed by kind. Payloads arrive unvalidated from the wire. */
export type InputHandlers<G extends MinigameType> = {
  [K in InputKind<G>]: (playerId: string, payload: unknown) => InputRes<G, K>;
};

export interface Minigame<G extends MinigameType = MinigameType> {
  readonly inputs: InputHandlers<G>;
  /** Kick off the round (after `minigame:start` went out). */
  start(): void;
  /** Re-send what a (re)connecting player needs to rebuild the game. */
  sync(playerId: string): void;
  /** A player forfeited or dropped for good; let the round resolve without them. */
  removePlayer?(playerId: string): void;
}

export type MinigameFactory<G extends MinigameType = MinigameType> = (ctx: GameContext<G>) => Minigame<G>;
