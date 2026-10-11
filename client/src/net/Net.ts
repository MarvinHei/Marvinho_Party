import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  Appearance,
  ClientToServerEvents,
  GameInputMsg,
  InputReq,
  InputRes,
  JoinedLobby,
  LobbySettings,
  MinigameType,
  RequestKind,
  SendKind,
  ServerToClientEvents,
} from "@marvinho/shared";
import { applyGameEnded, applyGameEvent, applyGameTimer, startGame } from "../games/registry.js";
import { SERVER_URL } from "./config.js";
import { clearSession, loadSession, saveSession, type Session } from "./session.js";
import type { SeatState } from "../state/types.js";

type SeatPatch = Partial<SeatState> | ((prev: SeatState) => Partial<SeatState>);

/**
 * One socket connection = one player seat. In normal play there is a single
 * Net; in debug mode each spawned seat owns its own Net so the server sees
 * genuinely independent players.
 */
export class Net {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  /** The seat this connection holds, for reconnect/refresh. */
  private session: Session | null = null;
  private resuming = false;

  constructor(
    readonly seatId: string,
    private patch: (patch: SeatPatch) => void,
    /** Only the primary seat persists its session across a page refresh. */
    private primary = false,
  ) {
    this.socket = io(SERVER_URL, { autoConnect: true, transports: ["websocket"] });
    this.wire();
  }

  private wire() {
    this.socket.on("connect", () => {
      this.patch({ connected: true });
      // On (re)connect, re-attach to our seat: the live one after a transient
      // drop, or the stored one after a page refresh.
      const s = this.session ?? (this.primary ? loadSession() : null);
      if (s && !this.resuming) {
        this.resuming = true;
        this.resume(s.lobbyId, s.playerId)
          .catch(() => { if (this.primary && !this.session) clearSession(); })
          .finally(() => { this.resuming = false; });
      }
    });
    this.socket.on("disconnect", () => this.patch({ connected: false }));

    this.socket.on("lobby:update", (lobby) => {
      this.patch((prev) => ({
        lobby,
        screen: lobby.phase === "lobby" ? "lobby" : prev.screen === "home" ? "game" : prev.screen,
      }));
    });

    this.socket.on("lobby:kicked", () => {
      // The host removed us — return to the home screen with a notice.
      this.session = null;
      if (this.primary) clearSession();
      this.patch({
        lobby: null,
        playerId: null,
        screen: "home",
        error: "You were removed from the lobby by the host.",
        minigame: null,
        minigamePhase: null,
        game: null,
      });
    });

    this.socket.on("intermission:start", ({ lobby }) => {
      this.patch({
        lobby,
        screen: "game",
        minigamePhase: "intermission",
        lastResult: null,
        wheel: null,
        teamDraft: null,
        teamDraftGame: null,
        countdown: null,
        game: null,
      });
    });

    this.socket.on("minigame:spin", ({ options, chosen, spinMs }) => {
      this.patch({
        screen: "game",
        minigamePhase: "spinning",
        wheel: { options, chosen, spinMs },
        teamDraft: null,
        teamDraftGame: null,
        countdown: null,
      });
    });

    this.socket.on("minigame:teams", ({ game, teams }) => {
      this.patch({
        screen: "game",
        minigamePhase: "assigning",
        teamDraft: teams,
        teamDraftGame: game,
      });
    });

    this.socket.on("minigame:explain", ({ game }) => {
      this.patch({
        screen: "game",
        minigamePhase: "explaining",
        explainGame: game,
        wheel: null,
        countdown: null,
      });
    });

    this.socket.on("minigame:countdown", ({ game, endsAt }) => {
      this.patch({ screen: "game", minigamePhase: "countdown", countdown: { game, endsAt } });
    });

    this.socket.on("minigame:start", ({ type }) => {
      this.patch({
        screen: "game",
        minigame: type,
        minigamePhase: "playing",
        // A fresh slot, so the previous round's state can't flash on screen
        // before this round's setup arrives.
        game: startGame(type),
        lastResult: null,
        wheel: null,
        teamDraft: null,
        teamDraftGame: null,
        countdown: null,
        spectateTarget: null,
        spectateFrame: null,
        celebrateWinnerId: null,
        forfeited: false,
      });
    });

    // A timed round's deadline moved (shrunk as players solved).
    this.socket.on("minigame:timer", ({ endsAt }) => {
      this.patch((prev) => applyGameTimer(prev, endsAt));
    });

    this.socket.on("game:event", (msg) => {
      this.patch((prev) => applyGameEvent(prev, msg));
    });

    this.socket.on("spectate:frame", ({ targetId, data }) => {
      // Only apply frames for the player we're currently watching.
      this.patch((prev) => (prev.spectateTarget === targetId ? { spectateFrame: { targetId, data } } : {}));
    });

    this.socket.on("minigame:ended", ({ result, lobby }) => {
      this.patch((prev) => ({
        lobby,
        minigamePhase: "results",
        lastResult: result,
        // Hold the board at the pre-advance positions until the host confirms.
        resultsPending: true,
        wheel: null,
        ...applyGameEnded(prev),
      }));
    });

    this.socket.on("minigame:advance", ({ lobby }) => {
      // Release the board advance — the board now plays the (sequential) hops.
      this.patch({ lobby, resultsPending: false });
    });

    this.socket.on("minigame:celebrate", ({ winnerId, lobby }) => {
      // Hops have landed; play the on-board celebration before the win screen.
      this.patch({ lobby, resultsPending: false, celebrateWinnerId: winnerId });
    });

    this.socket.on("game:finished", ({ lobby }) => {
      this.patch({ lobby, screen: "game", minigamePhase: "results", celebrateWinnerId: null });
    });

    this.socket.on("server:restarting", ({ message }) => {
      // Our match is gone with the old server process; don't try to resume it.
      this.session = null;
      if (this.primary) clearSession();
      this.patch({
        lobby: null,
        playerId: null,
        screen: "home",
        error: message,
        minigame: null,
        minigamePhase: null,
        game: null,
      });
    });

    this.socket.on("server:error", ({ message }) => {
      this.patch({ error: message });
    });
  }

  private ack<T>(res: Ack<T>, resolve: (v: T) => void, reject: (e: Error) => void) {
    if (res.ok) resolve(res.data);
    else reject(new Error(res.error));
  }

  private adopt(data: JoinedLobby): JoinedLobby {
    // Remember this seat so a reconnect / refresh can rejoin the same match.
    this.session = { lobbyId: data.lobbyId, playerId: data.playerId };
    if (this.primary) saveSession(this.session);
    // Record who this seat is so the UI can recognize itself (host, "you", etc.).
    // Navigate straight from the ack so we don't depend on a broadcast arriving
    // (the joining socket can miss the initial lobby:update before joining the room).
    this.patch({
      playerId: data.playerId,
      lobby: data.lobby,
      error: null,
      screen: data.lobby.phase === "lobby" ? "lobby" : "game",
    });
    return data;
  }

  /** Re-attach to an existing seat (after a reconnect or page refresh). */
  resume(lobbyId: string, playerId: string): Promise<JoinedLobby> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:resume", { lobbyId, playerId }, (res) =>
        this.ack(res, (d) => resolve(this.adopt(d)), reject),
      );
    });
  }

  create(nickname: string, appearance?: Appearance): Promise<JoinedLobby> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:create", { nickname, appearance }, (res) =>
        this.ack(res, (d) => resolve(this.adopt(d)), reject),
      );
    });
  }

  join(lobbyId: string, nickname: string, appearance?: Appearance): Promise<JoinedLobby> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:join", { lobbyId, nickname, appearance }, (res) =>
        this.ack(res, (d) => resolve(this.adopt(d)), reject),
      );
    });
  }

  setAppearance(appearance: Appearance): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:setAppearance", { appearance }, (res) => this.ack(res, resolve, reject));
    });
  }

  start(): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:start", (res) => this.ack(res, resolve, reject));
    });
  }

  ready(ready: boolean): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:ready", { ready }, (res) =>
        this.ack(res, resolve, reject),
      );
    });
  }

  forceStart(): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:forceStart", (res) => this.ack(res, resolve, reject));
    });
  }

  confirmResults(): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:confirmResults", (res) => this.ack(res, resolve, reject));
    });
  }

  forfeit(): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:forfeit", (res) =>
        this.ack(res, (d) => { this.patch({ forfeited: true }); resolve(d); }, reject),
      );
    });
  }

  kick(playerId: string): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:kick", { playerId }, (res) => this.ack(res, resolve, reject));
    });
  }

  updateSettings(settings: LobbySettings): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:updateSettings", { settings }, (res) => this.ack(res, resolve, reject));
    });
  }

  debugStart(game: MinigameType): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:debugStart", { game }, (res) => this.ack(res, resolve, reject));
    });
  }

  /** A fire-and-forget input to the running minigame. */
  send<G extends MinigameType, K extends SendKind<G>>(game: G, kind: K, payload: InputReq<G, K>): void {
    this.socket.emit("game:send", { game, kind, payload } as GameInputMsg);
  }

  /** An input to the running minigame that the server answers. */
  request<G extends MinigameType, K extends RequestKind<G>>(
    game: G,
    kind: K,
    payload: InputReq<G, K>,
  ): Promise<InputRes<G, K>> {
    return new Promise((resolve, reject) => {
      this.socket.emit("game:request", { game, kind, payload } as GameInputMsg, (res) =>
        this.ack(res as Ack<InputRes<G, K>>, resolve, reject),
      );
    });
  }

  /** Spectate — push my own in-progress snapshot for watchers. */
  spectatePush(data: string) {
    this.socket.emit("spectate:push", { data });
  }

  /** Spectate — set/clear which player's POV I'm watching. */
  spectateWatch(targetId: string | null) {
    this.socket.emit("spectate:watch", { targetId });
  }

  leave() {
    this.socket.emit("lobby:leave");
    this.session = null;
    if (this.primary) clearSession();
  }

  dispose() {
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}
