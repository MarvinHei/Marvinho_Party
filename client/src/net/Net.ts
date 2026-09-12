import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  ClientToServerEvents,
  JoinedLobby,
  ServerToClientEvents,
} from "@marvinho/shared";
import { SERVER_URL } from "./config.js";
import type { SeatState } from "../state/types.js";

type SeatPatch = Partial<SeatState> | ((prev: SeatState) => Partial<SeatState>);

/**
 * One socket connection = one player seat. In normal play there is a single
 * Net; in debug mode each spawned seat owns its own Net so the server sees
 * genuinely independent players.
 */
export class Net {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private garbageSeq = 0;

  constructor(
    readonly seatId: string,
    private patch: (patch: SeatPatch) => void,
  ) {
    this.socket = io(SERVER_URL, { autoConnect: true, transports: ["websocket"] });
    this.wire();
  }

  private wire() {
    this.socket.on("connect", () => this.patch({ connected: true }));
    this.socket.on("disconnect", () => this.patch({ connected: false }));

    this.socket.on("lobby:update", (lobby) => {
      this.patch((prev) => ({
        lobby,
        screen: lobby.phase === "lobby" ? "lobby" : prev.screen === "home" ? "game" : prev.screen,
      }));
    });

    this.socket.on("lobby:kicked", () => {
      // The host removed us — return to the home screen with a notice.
      this.patch({
        lobby: null,
        playerId: null,
        screen: "home",
        error: "You were removed from the lobby by the host.",
        minigame: null,
        minigamePhase: null,
      });
    });

    this.socket.on("intermission:start", ({ lobby }) => {
      this.patch({
        lobby,
        screen: "game",
        minigamePhase: "intermission",
        lastResult: null,
        standings: [],
        wheel: null,
        teamDraft: null,
        teamDraftGame: null,
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
        guessCountry: null,
        geoStandings: [],
        travle: null,
        travleStandings: [],
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

    this.socket.on("minigame:start", ({ type, wordle }) => {
      this.patch({
        screen: "game",
        minigame: type,
        minigamePhase: "playing",
        lastResult: null,
        wheel: null,
        teamDraft: null,
        teamDraftGame: null,
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
        wordle: wordle
          ? {
              wordLength: wordle.wordLength,
              maxGuesses: wordle.maxGuesses,
              endsAt: wordle.endsAt,
              guesses: [],
              currentInput: "",
              solved: false,
              finished: false,
              message: null,
            }
          : null,
      });
    });

    this.socket.on("wordle:standings", (standings) => {
      this.patch({ standings });
    });

    this.socket.on("codenames:state", (view) => {
      this.patch({ codenames: view });
    });

    this.socket.on("skribbl:state", (view) => {
      this.patch({ skribbl: view });
    });

    this.socket.on("skribbl:draw", ({ seg }) => {
      this.patch((prev) => ({ skribblStrokes: [...prev.skribblStrokes, seg] }));
    });

    this.socket.on("skribbl:clear", () => {
      this.patch({ skribblStrokes: [] });
    });

    this.socket.on("skribblteams:state", (view) => {
      this.patch({ skribblTeams: view });
    });

    this.socket.on("skribblteams:draw", ({ seg }) => {
      this.patch((prev) => ({ skribblStrokes: [...prev.skribblStrokes, seg] }));
    });

    this.socket.on("skribblteams:clear", () => {
      this.patch({ skribblStrokes: [] });
    });

    this.socket.on("findword:state", (view) => {
      this.patch({ findword: view });
    });

    this.socket.on("tetris:init", (payload) => {
      this.patch({
        tetris: payload,
        tetrisBoards: [],
        tetrisGarbage: [],
        tetrisAlive: payload.players.map((p) => p.id),
        tetrisKos: [],
      });
    });

    this.socket.on("tetris:board", (snap) => {
      this.patch((prev) => {
        const others = prev.tetrisBoards.filter((b) => b.playerId !== snap.playerId);
        return { tetrisBoards: [...others, snap] };
      });
    });

    this.socket.on("tetris:garbage", ({ rows, hole }) => {
      this.patch((prev) => ({
        tetrisGarbage: [...prev.tetrisGarbage, { seq: this.garbageSeq++, rows, hole }],
      }));
    });

    this.socket.on("tetris:players", ({ alive, kos }) => {
      this.patch({ tetrisAlive: alive, tetrisKos: kos });
    });

    this.socket.on("puzzle:start", ({ game, spec, endsAt, roundSeconds }) => {
      this.patch({
        screen: "game",
        minigame: game,
        minigamePhase: "playing",
        puzzle: { game, spec, endsAt, roundSeconds, solvedByMe: false },
        puzzleStandings: [],
      });
    });

    this.socket.on("puzzle:standings", (standings) => {
      this.patch((prev) => {
        const mine = standings.find((s) => s.playerId === prev.playerId);
        return {
          puzzleStandings: standings,
          puzzle:
            prev.puzzle && mine?.solved
              ? { ...prev.puzzle, solvedByMe: true }
              : prev.puzzle,
        };
      });
    });

    this.socket.on("guesscountry:start", ({ geometry, endsAt, roundSeconds, maxTries }) => {
      this.patch({
        screen: "game",
        minigame: "guesscountry",
        minigamePhase: "playing",
        guessCountry: { geometry, endsAt, roundSeconds, maxTries, guesses: [], solved: false },
        geoStandings: [],
      });
    });

    this.socket.on("guesscountry:standings", (standings) => {
      this.patch({ geoStandings: standings });
    });

    this.socket.on("travle:start", ({ startCode, endCode, endsAt, roundSeconds }) => {
      this.patch({
        screen: "game",
        minigame: "travle",
        minigamePhase: "playing",
        travle: { startCode, endCode, endsAt, roundSeconds, named: [], connected: false },
        travleStandings: [],
      });
    });

    this.socket.on("travle:standings", (standings) => {
      this.patch({ travleStandings: standings });
    });

    this.socket.on("minigame:ended", ({ result, lobby }) => {
      this.patch((prev) => ({
        lobby,
        minigamePhase: "results",
        lastResult: result,
        wheel: null,
        wordle: prev.wordle ? { ...prev.wordle, finished: true } : null,
      }));
    });

    this.socket.on("game:finished", ({ lobby }) => {
      this.patch({ lobby, screen: "game", minigamePhase: "results" });
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

  create(nickname: string): Promise<JoinedLobby> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:create", { nickname }, (res) =>
        this.ack(res, (d) => resolve(this.adopt(d)), reject),
      );
    });
  }

  join(lobbyId: string, nickname: string): Promise<JoinedLobby> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:join", { lobbyId, nickname }, (res) =>
        this.ack(res, (d) => resolve(this.adopt(d)), reject),
      );
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

  kick(playerId: string): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:kick", { playerId }, (res) => this.ack(res, resolve, reject));
    });
  }

  updateSettings(settings: import("@marvinho/shared").LobbySettings): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:updateSettings", { settings }, (res) => this.ack(res, resolve, reject));
    });
  }

  debugStart(game: import("@marvinho/shared").MinigameType): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("lobby:debugStart", { game }, (res) => this.ack(res, resolve, reject));
    });
  }

  guess(word: string): Promise<{ result: import("@marvinho/shared").WordleGuessResult; solved: boolean }> {
    return new Promise((resolve, reject) => {
      this.socket.emit("wordle:guess", { guess: word }, (res) =>
        this.ack(res, resolve, reject),
      );
    });
  }

  codenamesClue(word: string, count: number): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("codenames:clue", { word, count }, (res) =>
        this.ack(res, resolve, reject),
      );
    });
  }

  codenamesGuess(index: number): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("codenames:guess", { index }, (res) =>
        this.ack(res, resolve, reject),
      );
    });
  }

  codenamesEndTurn(): Promise<null> {
    return new Promise((resolve, reject) => {
      this.socket.emit("codenames:endTurn", (res) => this.ack(res, resolve, reject));
    });
  }

  skribblDraw(seg: import("@marvinho/shared").SkribblSegment): void {
    this.socket.emit("skribbl:draw", { seg });
  }

  skribblClear(): void {
    this.socket.emit("skribbl:clear");
  }

  skribblGuess(text: string): Promise<{ correct: boolean; close: boolean }> {
    return new Promise((resolve, reject) => {
      this.socket.emit("skribbl:guess", { text }, (res) => this.ack(res, resolve, reject));
    });
  }

  skribblTeamsDraw(seg: import("@marvinho/shared").SkribblSegment): void {
    this.socket.emit("skribblteams:draw", { seg });
  }

  skribblTeamsClear(): void {
    this.socket.emit("skribblteams:clear");
  }

  skribblTeamsGuess(text: string): Promise<{ correct: boolean; close: boolean }> {
    return new Promise((resolve, reject) => {
      this.socket.emit("skribblteams:guess", { text }, (res) => this.ack(res, resolve, reject));
    });
  }

  findwordSubmit(word: string): Promise<{ accepted: boolean }> {
    return new Promise((resolve, reject) => {
      this.socket.emit("findword:submit", { word }, (res) => this.ack(res, resolve, reject));
    });
  }

  tetrisBoard(cells: string, lines: number): void {
    this.socket.emit("tetris:board", { cells, lines });
  }

  tetrisLines(lines: number): void {
    this.socket.emit("tetris:lines", { lines });
  }

  tetrisTarget(targetId: string): void {
    this.socket.emit("tetris:target", { targetId });
  }

  tetrisDead(): void {
    this.socket.emit("tetris:dead");
  }

  puzzleSubmit(solution: number[]): Promise<{ solved: boolean }> {
    return new Promise((resolve, reject) => {
      this.socket.emit("puzzle:submit", { solution }, (res) => this.ack(res, resolve, reject));
    });
  }

  guessCountry(
    name: string,
  ): Promise<{ guess: import("@marvinho/shared").GuessCountryGuess }> {
    return new Promise((resolve, reject) => {
      this.socket.emit("guesscountry:guess", { name }, (res) => this.ack(res, resolve, reject));
    });
  }

  travleGuess(name: string): Promise<{ code: string; name: string; connected: boolean }> {
    return new Promise((resolve, reject) => {
      this.socket.emit("travle:guess", { name }, (res) => this.ack(res, resolve, reject));
    });
  }

  leave() {
    this.socket.emit("lobby:leave");
  }

  dispose() {
    this.socket.removeAllListeners();
    this.socket.disconnect();
  }
}
