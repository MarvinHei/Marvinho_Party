import type { Server } from "socket.io";
import {
  NO_TIMER_SECONDS,
  type Appearance,
  type ClientToServerEvents,
  type EventKind,
  type EventPayload,
  type GameEventMsg,
  type LobbySettings,
  type MinigameResult,
  type MinigameType,
  type ServerToClientEvents,
  type TokenLook,
} from "@marvinho/shared";
import type { GameEnv } from "../minigames/env.js";
import type { Draft, GameContext, RosterPlayer, RoundTimer } from "./types.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/** Each time a player solves a timed round, cut the remaining time to this… */
const SOLVE_SHRINK = 0.55;
/** …but never below this floor (ms), so latecomers still get a fair shot. */
const SOLVE_MIN_MS = 8000;
/** Longest simulated step for real-time loops, so a stall can't teleport things. */
const MAX_DT = 0.05;

export { SOLVE_MIN_MS, SOLVE_SHRINK };

/** The lobby's view of a seat, as the context needs it. */
export interface Seat {
  id: string;
  socketId: string | null;
  nickname: string;
  color: string;
  connected: boolean;
  appearance: Appearance;
}

export interface ContextDeps<G extends MinigameType> {
  io: IO;
  room: string;
  type: G;
  settings: LobbySettings;
  draft: Draft;
  env: GameEnv;
  seats: () => Iterable<Seat>;
  onFinish: (result: MinigameResult) => void;
}

const roster = (s: Seat): RosterPlayer => ({ id: s.id, nickname: s.nickname, color: s.color });

export class LobbyGameContext<G extends MinigameType> implements GameContext<G> {
  readonly type: G;
  readonly settings: LobbySettings;
  readonly draft: Draft;
  readonly env: GameEnv;
  readonly roster: RosterPlayer[];
  finished = false;

  private timeouts = new Set<NodeJS.Timeout>();
  private interval: NodeJS.Timeout | null = null;
  private deadline: NodeJS.Timeout | null = null;
  private deadlineAt = 0;
  private onExpire: (() => void) | null = null;

  constructor(private deps: ContextDeps<G>) {
    this.type = deps.type;
    this.settings = deps.settings;
    this.draft = deps.draft;
    this.env = deps.env;
    this.roster = this.connected().map(roster);
  }

  // --- players ------------------------------------------------------------

  private seat(id: string): Seat | undefined {
    for (const s of this.deps.seats()) if (s.id === id) return s;
    return undefined;
  }

  private connected(): Seat[] {
    return [...this.deps.seats()].filter((s) => s.connected);
  }

  allPlayers(): RosterPlayer[] {
    return [...this.deps.seats()].map(roster);
  }

  player(id: string): RosterPlayer | undefined {
    const s = this.seat(id);
    return s ? roster(s) : undefined;
  }

  connectedIds(): string[] {
    return this.connected().map((s) => s.id);
  }

  looks(): TokenLook[] {
    return this.connected().map((s) => ({
      id: s.id,
      hair: s.appearance.hair,
      hairColor: s.appearance.hairColor,
      mouth: s.appearance.mouth,
    }));
  }

  // --- events -------------------------------------------------------------

  private msg<K extends EventKind<G>>(kind: K, payload: EventPayload<G, K>): GameEventMsg {
    return { game: this.type, kind, payload } as GameEventMsg;
  }

  emit<K extends EventKind<G>>(kind: K, payload: EventPayload<G, K>): void {
    if (this.finished) return;
    this.deps.io.to(this.deps.room).emit("game:event", this.msg(kind, payload));
  }

  emitTo<K extends EventKind<G>>(playerId: string, kind: K, payload: EventPayload<G, K>): void {
    if (this.finished) return;
    const s = this.seat(playerId);
    if (s?.connected && s.socketId) this.deps.io.to(s.socketId).emit("game:event", this.msg(kind, payload));
  }

  emitExcept<K extends EventKind<G>>(playerId: string, kind: K, payload: EventPayload<G, K>): void {
    if (this.finished) return;
    const except = this.seat(playerId)?.socketId ?? "";
    this.deps.io.to(this.deps.room).except(except).emit("game:event", this.msg(kind, payload));
  }

  emitEach<K extends EventKind<G>>(
    kind: K,
    payloadFor: (playerId: string) => EventPayload<G, K> | null | undefined,
  ): void {
    for (const s of this.connected()) {
      const payload = payloadFor(s.id);
      if (payload != null) this.emitTo(s.id, kind, payload);
    }
  }

  // --- time ---------------------------------------------------------------

  schedule(fn: () => void, ms: number): () => void {
    const t = setTimeout(() => {
      this.timeouts.delete(t);
      fn();
    }, ms);
    this.timeouts.add(t);
    return () => {
      clearTimeout(t);
      this.timeouts.delete(t);
    };
  }

  cancelScheduled(): void {
    for (const t of this.timeouts) clearTimeout(t);
    this.timeouts.clear();
  }

  loop(intervalMs: number, onTick: (dt: number) => void): void {
    if (this.interval) clearInterval(this.interval);
    let last = this.env.now();
    this.interval = setInterval(() => {
      const now = this.env.now();
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      onTick(dt);
    }, intervalMs);
  }

  readonly timer: RoundTimer = ((ctx) => ({
    arm: (seconds: number, onExpire: () => void) => {
      ctx.clearDeadline();
      ctx.onExpire = onExpire;
      ctx.setDeadline(seconds * 1000);
      return ctx.deadlineAt;
    },
    shrink: () => {
      // Disabled when the host turned this game's timer off.
      if (!ctx.settings.games[ctx.type].timerEnabled) return;
      if (!ctx.deadline || !ctx.onExpire) return;
      const remaining = ctx.deadlineAt - ctx.env.now();
      if (remaining <= SOLVE_MIN_MS) return;
      const next = Math.max(SOLVE_MIN_MS, Math.round(remaining * SOLVE_SHRINK));
      if (next >= remaining) return;
      ctx.clearDeadline();
      ctx.setDeadline(next);
      ctx.deps.io.to(ctx.deps.room).emit("minigame:timer", { endsAt: ctx.deadlineAt });
    },
    get endsAt() {
      return ctx.deadlineAt;
    },
  }))(this);

  private setDeadline(ms: number): void {
    this.deadlineAt = this.env.now() + ms;
    this.deadline = setTimeout(() => {
      this.deadline = null;
      this.onExpire?.();
    }, ms);
  }

  private clearDeadline(): void {
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = null;
  }

  roundSeconds(): number {
    const s = this.settings.games[this.type];
    return s.timerEnabled ? s.timerSeconds : NO_TIMER_SECONDS;
  }

  // --- lifecycle ----------------------------------------------------------

  finish(result: Omit<MinigameResult, "type">): void {
    if (this.finished) return;
    this.dispose();
    this.finished = true;
    this.deps.onFinish({ type: this.type, ...result });
  }

  /** Stop every timer and the loop (round over, or lobby torn down). */
  dispose(): void {
    this.cancelScheduled();
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.clearDeadline();
    this.onExpire = null;
  }
}
