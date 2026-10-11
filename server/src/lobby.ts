import type { Server } from "socket.io";
import {
  GAME_CONFIG,
  MINIGAME_RULES,
  PLAYER_COLORS,
  WHEEL_SPIN_MS,
  defaultAppearance,
  defaultLobbySettings,
  type Appearance,
  type ClientToServerEvents,
  type GameInputMsg,
  type LobbyPhase,
  type LobbySettings,
  type LobbyView,
  type MinigameResult,
  type MinigameType,
  type PlayerView,
  type ServerToClientEvents,
  type TeamDraftTeam,
} from "@marvinho/shared";
import { LobbyGameContext } from "./games/context.js";
import { buildAssignment } from "./games/codenames.js";
import { buildTeams } from "./games/draft.js";
import { MINIGAMES } from "./games/registry.js";
import type { Draft, Minigame, MinigameFactory } from "./games/types.js";
import { pick, realEnv, type GameEnv } from "./minigames/env.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

interface Player {
  id: string;
  socketId: string | null;
  nickname: string;
  color: string;
  position: number;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
  appearance: Appearance;
}

/** Timings for the pre-game sequence (ms). */
const COUNTDOWN_MS = 5000;
/** Fallback: auto-confirm the podium if the host never does (ms). */
const RESULTS_MS = 45000;
/** Grace window to reclaim a seat after a disconnect before leaving the round (ms). */
const GRACE_MS = 12000;
/** How long the board-advance animation runs after the host confirms (ms). */
const ADVANCE_MS = 4200;
/** How long the on-board winner celebration plays before the win screen (ms). */
const CELEBRATE_MS = 2800;
/** How long the winner celebration shows before returning to the lobby (ms). */
const MATCH_END_MS = 9000;

/**
 * A single game session. Owns its players, the board, and the phase machine:
 * lobby → wheel → (team draft) → (explanation) → countdown → minigame → results.
 * The minigame itself is a pluggable {@link Minigame} from the registry.
 */
export class Lobby {
  readonly id: string;
  phase: LobbyPhase = "lobby";
  private players = new Map<string, Player>();
  private hostId: string;
  private winnerId: string | null = null;
  private currentMinigame: MinigameType | null = null;

  /** The running minigame and its context (timers, emit helpers). */
  private active: Minigame | null = null;
  private activeCtx: LobbyGameContext<MinigameType> | null = null;
  /** Teams drawn for the upcoming team game. */
  private pendingDraft: Draft = {};
  private settings: LobbySettings = defaultLobbySettings();
  /** The game awaiting its explanation-screen ready-gate, if any. */
  private explainGame: MinigameType | null = null;
  /** The team game awaiting its draft-confirmation ready-gate, if any. */
  private assignGame: MinigameType | null = null;
  private sandbox = false;
  /** Latest spectate snapshot per player, and who each spectator is watching. */
  private spectateFrames = new Map<string, string>();
  private spectateWatch = new Map<string, string>();
  /** True while the results podium waits for the host to confirm the advance. */
  private awaitingConfirm = false;
  /** Set when this round produced a winner: celebrate + win screen after the hops. */
  private pendingWinnerId: string | null = null;
  /** Deferred round-removal per disconnected player, cancelled if they resume. */
  private graceTimers = new Map<string, NodeJS.Timeout>();
  /** Players who forfeited the current round (forced to 0 points). */
  private forfeited = new Set<string>();
  /** How long the (sequential) board advance runs for this round's rewards (ms). */
  private lastAdvanceMs = ADVANCE_MS;
  private timers: NodeJS.Timeout[] = [];

  onEmpty?: () => void;

  constructor(
    private io: IO,
    id: string,
    host: { id: string; socketId: string; nickname: string; appearance?: Appearance },
    /** Clock + RNG for this lobby's rounds (seeded in tests). */
    private env: GameEnv = realEnv,
  ) {
    this.id = id;
    this.hostId = host.id;
    const appearance = host.appearance ?? { ...defaultAppearance(), color: PLAYER_COLORS[0] };
    this.players.set(host.id, {
      id: host.id,
      socketId: host.socketId,
      nickname: host.nickname,
      color: appearance.color,
      position: 0,
      isHost: true,
      connected: true,
      ready: false,
      appearance,
    });
  }

  // --- membership ---------------------------------------------------------

  get playerCount(): number {
    return this.players.size;
  }

  hasConnectedPlayers(): boolean {
    return [...this.players.values()].some((p) => p.connected);
  }

  private connectedPlayers(): Player[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  addPlayer(player: { id: string; socketId: string; nickname: string; appearance?: Appearance }): void {
    // In sandbox we also allow joining between practice rounds (intermission).
    const joinable = this.phase === "lobby" || (this.sandbox && this.phase === "intermission");
    if (!joinable) throw new Error("Game already started.");
    // Guard against the same connection joining twice (e.g. a double-click).
    if ([...this.players.values()].some((p) => p.socketId === player.socketId)) {
      throw new Error("You are already in this lobby.");
    }
    if (this.players.size >= GAME_CONFIG.maxPlayers) throw new Error("Lobby is full.");
    // Their chosen colour, else the next colour in join order.
    const fallback = PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
    const appearance = player.appearance ?? { ...defaultAppearance(), color: fallback };
    this.players.set(player.id, {
      id: player.id,
      socketId: player.socketId,
      nickname: player.nickname,
      color: appearance.color,
      position: 0,
      isHost: false,
      connected: true,
      ready: false,
      appearance,
    });
    this.broadcastLobby();
  }

  /** Re-attach a fresh socket to an existing (disconnected) seat. */
  resume(playerId: string, socketId: string): void {
    const player = this.players.get(playerId);
    if (!player) throw new Error("Your seat has expired — join again.");
    player.socketId = socketId;
    player.connected = true;
    // Cancel the pending round-removal — they're back in time.
    const grace = this.graceTimers.get(playerId);
    if (grace) {
      clearTimeout(grace);
      this.graceTimers.delete(playerId);
    }
    this.broadcastLobby();
    // Re-send the active minigame so the client re-enters it (not just the board).
    if (this.phase === "minigame" && this.active && this.currentMinigame) {
      this.io.to(socketId).emit("minigame:start", { type: this.currentMinigame });
      this.active.sync(playerId);
    }
  }

  /** Change a player's character look (lobby phase only). */
  setAppearance(playerId: string, appearance: Appearance): void {
    if (this.phase !== "lobby") return;
    const player = this.players.get(playerId);
    if (!player) return;
    player.appearance = appearance;
    player.color = appearance.color;
    this.broadcastLobby();
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    if (this.phase === "lobby") {
      this.players.delete(playerId);
    } else {
      player.connected = false;
      player.socketId = null;
      player.ready = false;
      // Give a quick refresh / reconnect a grace window to reclaim the seat
      // before we actually remove the player from the running round.
      const existing = this.graceTimers.get(playerId);
      if (existing) clearTimeout(existing);
      this.graceTimers.set(
        playerId,
        setTimeout(() => {
          this.graceTimers.delete(playerId);
          if (!this.players.get(playerId)?.connected) this.finalizeDisconnect(playerId);
        }, GRACE_MS),
      );
    }

    this.reassignHost(playerId);
    if (!this.hasConnectedPlayers()) {
      this.dispose();
      this.onEmpty?.();
      return;
    }
    this.broadcastLobby();
    this.maybeStartFromReady();
  }

  /** An intentional Quit: remove the player from the round and the lobby now
   *  (no grace window — they chose to leave). */
  quit(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    const grace = this.graceTimers.get(playerId);
    if (grace) {
      clearTimeout(grace);
      this.graceTimers.delete(playerId);
    }
    player.connected = false;
    player.socketId = null;
    if (this.phase === "minigame") this.finalizeDisconnect(playerId);
    this.players.delete(playerId);
    this.reassignHost(playerId);
    if (!this.hasConnectedPlayers()) {
      this.dispose();
      this.onEmpty?.();
      return;
    }
    this.broadcastLobby();
    this.maybeStartFromReady();
  }

  private reassignHost(leavingId: string): void {
    if (this.hostId !== leavingId) return;
    const next = this.connectedPlayers()[0];
    if (next) {
      next.isHost = true;
      this.hostId = next.id;
    }
  }

  /** Give up the current minigame: take 0 points and leave the round. */
  forfeitMinigame(playerId: string): void {
    if (this.phase !== "minigame") return;
    if (!this.players.has(playerId) || this.forfeited.has(playerId)) return;
    this.forfeited.add(playerId);
    this.removeFromRound(playerId);
    this.broadcastLobby();
  }

  /** After the grace window, actually remove a still-disconnected player from
   *  the active round (so it can resolve / not hang). */
  private finalizeDisconnect(playerId: string): void {
    this.removeFromRound(playerId);
    this.broadcastLobby();
    this.maybeStartFromReady();
  }

  /** Remove a player from whatever round is running so it can resolve. */
  private removeFromRound(playerId: string): void {
    if (this.phase === "minigame") this.active?.removePlayer?.(playerId);
  }

  isHost(playerId: string): boolean {
    return this.hostId === playerId;
  }

  attachSocket(playerId: string, socketId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.socketId = socketId;
      player.connected = true;
      this.broadcastLobby();
    }
  }

  // --- lifecycle ----------------------------------------------------------

  start(playerId: string): void {
    if (!this.isHost(playerId)) throw new Error("Only the host can start.");
    if (this.phase !== "lobby") throw new Error("Already started.");
    if (this.connectedPlayers().length < GAME_CONFIG.minPlayers) {
      throw new Error(`Need at least ${GAME_CONFIG.minPlayers} players.`);
    }
    // Host presses Start in the lobby → spin the wheel for the next game.
    this.spinWheel();
  }

  private resetReady(): void {
    for (const p of this.players.values()) p.ready = false;
  }

  setReady(playerId: string, ready: boolean): void {
    if (
      this.phase !== "intermission" &&
      this.phase !== "explaining" &&
      this.phase !== "assigning"
    ) {
      throw new Error("Not ready-gating right now.");
    }
    const player = this.players.get(playerId);
    if (!player) throw new Error("Not in this lobby.");
    player.ready = ready;
    this.broadcastLobby();
    this.maybeStartFromReady();
  }

  forceStart(playerId: string): void {
    if (!this.isHost(playerId)) throw new Error("Only the host can start.");
    if (this.phase === "assigning" && this.assignGame) {
      this.proceed(this.assignGame);
    } else if (this.phase === "explaining" && this.explainGame) {
      this.beginCountdown(this.explainGame);
    } else if (this.phase === "intermission") {
      this.spinWheel();
    } else {
      throw new Error("Nothing to start.");
    }
  }

  /** Host-only: replace the lobby settings (only while in the lobby). */
  updateSettings(hostId: string, settings: LobbySettings): void {
    if (!this.isHost(hostId)) throw new Error("Only the host can change settings.");
    if (this.phase !== "lobby") throw new Error("Settings can only change in the lobby.");
    this.settings = settings;
    this.broadcastLobby();
  }

  /** Host-only: remove another player while still in the lobby. */
  kickPlayer(hostId: string, targetId: string): void {
    if (!this.isHost(hostId)) throw new Error("Only the host can kick players.");
    if (this.phase !== "lobby") throw new Error("Players can only be kicked in the lobby.");
    if (hostId === targetId) throw new Error("You can't kick yourself.");
    const target = this.players.get(targetId);
    if (!target) throw new Error("Player not found.");
    const socketId = target.socketId;
    // Remove them from the lobby (broadcasts the updated roster).
    this.removePlayer(targetId);
    // Notify the kicked client and detach their socket from the room.
    if (socketId) {
      this.io.to(socketId).emit("lobby:kicked", { lobbyId: this.id });
      this.io.sockets.sockets.get(socketId)?.leave(this.id);
    }
  }

  /** Debug: jump straight into a specific minigame, standalone (no scoring). */
  debugStart(playerId: string, game: MinigameType): void {
    if (!this.isHost(playerId)) throw new Error("Only the host can start.");
    if (this.phase === "minigame") throw new Error("A minigame is already running.");
    this.sandbox = true;
    this.winnerId = null;
    this.clearTimers();
    this.broadcastLobby(); // propagate sandbox flag before the pre-game sequence
    if (game === "codenames" && this.connectedPlayers().length < 4) {
      throw new Error("Codenames needs 4 players.");
    }
    // Sandbox/practice skips the team draft + confirm — jump to the countdown
    // (team games build their teams on the fly when none were drafted).
    this.pendingDraft = {};
    this.beginCountdown(game);
  }

  private maybeStartFromReady(): void {
    if (this.sandbox) return; // sandbox rounds are launched explicitly
    if (this.awaitingConfirm) return; // wait for the host to confirm the podium first

    const connected = this.connectedPlayers();
    const allReady = connected.length >= 1 && connected.every((p) => p.ready);
    if (!allReady) return;

    if (this.phase === "assigning" && this.assignGame) {
      this.proceed(this.assignGame);
    } else if (this.phase === "explaining" && this.explainGame) {
      this.beginCountdown(this.explainGame);
    } else if (this.phase === "intermission") {
      this.spinWheel();
    }
  }

  // --- wheel --------------------------------------------------------------

  private availableGames(): MinigameType[] {
    const n = this.connectedPlayers().length;
    return (Object.keys(MINIGAME_RULES) as MinigameType[]).filter(
      // Drop any the host has blacklisted for this lobby.
      (g) => MINIGAME_RULES[g].playable(n) && this.settings.games[g].enabled,
    );
  }

  private spinWheel(): void {
    const all = this.availableGames();
    if (all.length === 0) {
      // Everything is blacklisted (or nobody can play any enabled game): return
      // to the lobby so the host can re-enable something.
      this.phase = "lobby";
      this.resetReady();
      this.io.to(this.id).emit("server:error", {
        message: "No minigames are enabled — turn some on in settings.",
      });
      this.broadcastLobby();
      return;
    }
    // Never offer the game that was just played (unless it's the only option).
    const prev = this.currentMinigame;
    let options = all;
    if (prev && all.length > 1) {
      const filtered = all.filter((g) => g !== prev);
      if (filtered.length > 0) options = filtered;
    }
    const chosen = pick(this.env.random, options);
    this.currentMinigame = chosen;
    this.phase = "spinning";
    this.io.to(this.id).emit("minigame:spin", { options, chosen, spinMs: WHEEL_SPIN_MS });
    this.schedule(() => this.afterSpin(chosen), WHEEL_SPIN_MS + 300);
  }

  private afterSpin(game: MinigameType): void {
    // Team games draw their teams first (with a confirm gate); others go on.
    this.pendingDraft = {};
    if (MINIGAME_RULES[game].teams) this.beginTeamDraft(game);
    else this.proceed(game);
  }

  /**
   * After a game has been chosen (and any assignment shown), either gate on an
   * explanation screen (host-enabled) or roll straight into the countdown.
   */
  private proceed(game: MinigameType): void {
    // Sandbox/practice skips the explanation gate (it has its own menu flow).
    if (this.settings.explanations && !this.sandbox) this.beginExplanation(game);
    else this.beginCountdown(game);
  }

  private beginExplanation(game: MinigameType): void {
    this.phase = "explaining";
    this.explainGame = game;
    this.resetReady();
    this.io.to(this.id).emit("minigame:explain", { game });
    this.broadcastLobby();
  }

  /**
   * Randomly draw the teams for a team game and show the draft, then wait for
   * everyone to confirm (or the host to force-start) before proceeding.
   */
  private beginTeamDraft(game: MinigameType): void {
    this.assignGame = game;
    const ids = this.connectedPlayers().map((p) => p.id);
    let teams: TeamDraftTeam[];
    if (MINIGAME_RULES[game].teams === "codenames") {
      const a = buildAssignment(ids, this.env.random);
      this.pendingDraft = { assignment: a };
      teams = [
        { id: "a", name: "Red", color: "#e6394b", memberIds: a.a.memberIds, spymasterId: a.a.spymasterId },
        { id: "b", name: "Blue", color: "#3aa0ff", memberIds: a.b.memberIds, spymasterId: a.b.spymasterId },
      ];
    } else {
      const built = buildTeams(ids, this.env.random);
      this.pendingDraft = { teams: built };
      teams = built.map((t) => ({ id: t.id, name: t.name, color: t.color, memberIds: t.memberIds }));
    }
    this.phase = "assigning";
    this.resetReady();
    this.io.to(this.id).emit("minigame:teams", { game, teams });
    this.broadcastLobby();
  }

  private beginCountdown(game: MinigameType): void {
    this.explainGame = null;
    this.assignGame = null;
    this.awaitingConfirm = false;
    this.pendingWinnerId = null;
    this.forfeited.clear();
    this.spectateFrames.clear();
    this.spectateWatch.clear();
    this.phase = "countdown";
    const endsAt = this.env.now() + COUNTDOWN_MS;
    this.io.to(this.id).emit("minigame:countdown", { game, endsAt });
    this.schedule(() => this.startMinigame(game), COUNTDOWN_MS + 100);
  }

  // --- the running minigame ----------------------------------------------

  private startMinigame<G extends MinigameType>(type: G): void {
    const ctx = new LobbyGameContext<G>({
      io: this.io,
      room: this.id,
      type,
      settings: this.settings,
      draft: this.pendingDraft,
      env: this.env,
      seats: () => this.players.values(),
      onFinish: (result) => this.concludeMinigame(result),
    });
    this.pendingDraft = {};
    this.phase = "minigame";
    this.currentMinigame = type;
    this.activeCtx = ctx as unknown as LobbyGameContext<MinigameType>;
    const factory = MINIGAMES[type] as MinigameFactory<G>;
    this.active = factory(ctx) as unknown as Minigame;
    this.io.to(this.id).emit("minigame:start", { type });
    this.active.start();
  }

  /**
   * Route a player's input to the running minigame. Returns the handler's
   * answer (for `game:request`); throws when there's no matching round.
   */
  handleInput(playerId: string, msg: GameInputMsg): unknown {
    if (this.phase !== "minigame" || !this.active) throw new Error("No active round.");
    if (!msg || typeof msg !== "object" || msg.game !== this.currentMinigame) {
      throw new Error("No active round.");
    }
    if (!this.players.has(playerId)) throw new Error("Not in this lobby.");
    const handlers = this.active.inputs as Record<string, (id: string, payload: unknown) => unknown>;
    const handler = Object.hasOwn(handlers, msg.kind) ? handlers[msg.kind] : undefined;
    if (!handler) throw new Error("Unknown input.");
    return handler(playerId, msg.payload);
  }

  // --- spectate (read-only POV of another player) -------------------------

  handleSpectatePush(playerId: string, data: string): void {
    if (this.phase !== "minigame") return;
    // Guard against oversized snapshots.
    if (typeof data !== "string" || data.length > 20000) return;
    this.spectateFrames.set(playerId, data);
    for (const [specId, targetId] of this.spectateWatch) {
      if (targetId !== playerId) continue;
      const spec = this.players.get(specId);
      if (spec?.socketId) this.io.to(spec.socketId).emit("spectate:frame", { targetId: playerId, data });
    }
  }

  handleSpectateWatch(playerId: string, targetId: string | null): void {
    if (!targetId) {
      this.spectateWatch.delete(playerId);
      return;
    }
    this.spectateWatch.set(playerId, targetId);
    const cached = this.spectateFrames.get(targetId);
    const spec = this.players.get(playerId);
    if (cached && spec?.socketId) this.io.to(spec.socketId).emit("spectate:frame", { targetId, data: cached });
  }

  // --- shared minigame conclusion ----------------------------------------

  private concludeMinigame(result: MinigameResult): void {
    this.active = null;
    this.activeCtx = null;
    this.clearTimers();

    // Forfeiters take 0, whatever the round handed them.
    for (const id of this.forfeited) {
      result.rewards[id] = 0;
      const row = result.scoreboard.find((r) => r.playerId === id);
      if (row) {
        row.reward = 0;
        row.win = false;
        row.detail = "forfeited";
      }
    }

    if (this.sandbox) {
      // Practice mode: no board movement, no winner, back to the menu.
      for (const p of this.players.values()) p.position = 0;
      this.phase = "intermission";
      this.resetReady();
      this.io.to(this.id).emit("minigame:ended", { result, lobby: this.toView() });
      return;
    }

    for (const [id, reward] of Object.entries(result.rewards)) {
      const p = this.players.get(id);
      if (p) p.position = Math.min(p.position + reward, GAME_CONFIG.boardLength);
    }

    // A winner is handled AFTER the board advance so players see the winning hop
    // cross the finish, then the celebration, then the win screen.
    const winner = result.ranking
      .map((id) => this.players.get(id))
      .find((p): p is Player => !!p && p.position >= GAME_CONFIG.boardLength);
    this.pendingWinnerId = winner ? winner.id : null;

    // Show the results podium and wait for the host to confirm before the board
    // advances (the client then plays the hops). We deliberately do NOT return to
    // the lobby screen mid-match — the host only configures at the very start.
    this.phase = "intermission";
    this.awaitingConfirm = true;
    // Time the sequential advance to the actual rewards (players hop one by one).
    const tiles = Object.values(result.rewards).reduce((a, b) => a + b, 0);
    const movers = Object.values(result.rewards).filter((r) => r > 0).length;
    this.lastAdvanceMs = Math.min(9000, 900 + movers * 350 + tiles * 260);
    this.resetReady();
    this.io.to(this.id).emit("minigame:ended", { result, lobby: this.toView() });
    // Fallback: auto-confirm if the host is idle/absent for a long time.
    this.schedule(() => {
      if (this.phase === "intermission" && this.awaitingConfirm) this.confirmResults(this.hostId);
    }, RESULTS_MS);
  }

  /** Host confirms the podium: release the board advance, then pace the next round. */
  confirmResults(playerId: string): void {
    if (this.phase !== "intermission" || !this.awaitingConfirm) return;
    if (!this.isHost(playerId)) throw new Error("Only the host can continue.");
    this.awaitingConfirm = false;
    this.clearTimers();
    // Tell clients to play the board advance (sequential hops) now.
    this.io.to(this.id).emit("minigame:advance", { lobby: this.toView() });
    // After the hops finish: celebrate a winner, else roll into the next round.
    this.schedule(() => {
      if (this.phase !== "intermission") return;
      if (this.pendingWinnerId) {
        this.startCelebration();
      } else if (this.settings.explanations) {
        this.spinWheel();
      } else {
        this.io.to(this.id).emit("intermission:start", { lobby: this.toView() });
      }
    }, this.lastAdvanceMs);
  }

  /** After the winning hop lands: play the on-board celebration, then the win screen. */
  private startCelebration(): void {
    const winnerId = this.pendingWinnerId;
    if (!winnerId) return;
    this.io.to(this.id).emit("minigame:celebrate", { winnerId, lobby: this.toView() });
    this.schedule(() => {
      this.winnerId = winnerId;
      this.pendingWinnerId = null;
      this.phase = "finished";
      this.io.to(this.id).emit("game:finished", { winnerId, lobby: this.toView() });
      // After the win screen, reset the board and return everyone to the OPEN lobby.
      this.schedule(() => {
        for (const p of this.players.values()) {
          p.position = 0;
          p.ready = false;
        }
        this.winnerId = null;
        this.currentMinigame = null;
        this.phase = "lobby";
        this.broadcastLobby();
      }, MATCH_END_MS);
    }, CELEBRATE_MS);
  }

  // --- views --------------------------------------------------------------

  private playerView(p: Player): PlayerView {
    return {
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      position: p.position,
      isHost: p.isHost,
      connected: p.connected,
      ready: p.ready,
      appearance: p.appearance,
    };
  }

  toView(): LobbyView {
    return {
      id: this.id,
      phase: this.phase,
      hostId: this.hostId,
      players: [...this.players.values()].map((p) => this.playerView(p)),
      boardLength: GAME_CONFIG.boardLength,
      minPlayers: GAME_CONFIG.minPlayers,
      winnerId: this.winnerId,
      currentMinigame: this.currentMinigame,
      settings: this.settings,
      sandbox: this.sandbox,
    };
  }

  broadcastLobby(): void {
    this.io.to(this.id).emit("lobby:update", this.toView());
  }

  // --- timers -------------------------------------------------------------

  private schedule(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  dispose(): void {
    this.clearTimers();
    this.activeCtx?.dispose();
    this.activeCtx = null;
    this.active = null;
    for (const t of this.graceTimers.values()) clearTimeout(t);
    this.graceTimers.clear();
  }
}
