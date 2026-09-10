import type { Server } from "socket.io";
import {
  CODENAMES_CONFIG,
  GAME_CONFIG,
  PLAYER_COLORS,
  PUZZLE_ROUND_SECONDS,
  SKRIBBL_CONFIG,
  SKRIBBL_TEAMS_CONFIG,
  TEAM_STYLES,
  TETRIS_CONFIG,
  WHEEL_SPIN_MS,
  WORDLE_CONFIG,
  canFormTeams,
  possibleTeamCounts,
  rewardForRank,
  type ClientToServerEvents,
  type CodenamesAssignment,
  type CodenamesTeam,
  type LobbyPhase,
  type LobbyView,
  type MinigameResult,
  type MinigameType,
  type PlayerView,
  type PuzzleDifficulty,
  type PuzzleGame,
  type PuzzleStanding,
  type ScoreRow,
  type ServerToClientEvents,
  type SkribblSegment,
  type TeamScore,
  type WordleStanding,
} from "@marvinho/shared";
import { WordleRound } from "./minigames/wordle.js";
import { CodenamesRound } from "./minigames/codenames.js";
import { SkribblGame } from "./minigames/skribbl.js";
import { SkribblTeamsGame, type TeamSpec } from "./minigames/skribblTeams.js";
import { FindWordGame } from "./minigames/findword.js";
import { TetrisMatch } from "./minigames/tetris.js";
import { PuzzleRound } from "./minigames/puzzleRound.js";
import { generatePuzzle } from "./minigames/puzzleGen.js";

const PUZZLE_GAMES: PuzzleGame[] = ["zip", "queens", "sudoku", "tango"];

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
}

const teamName = (t: CodenamesTeam) => (t === "a" ? "Red" : "Blue");
const teamColor = (t: CodenamesTeam) => (t === "a" ? "#e6394b" : "#3aa0ff");

/** Timings for the pre-game sequence (ms). */
const ASSIGN_MS = 4500;
const COUNTDOWN_MS = 5000;
/** How long the results podium shows before returning to the lobby (ms). */
const RESULTS_MS = 6500;
/** How long the winner celebration shows before returning to the lobby (ms). */
const MATCH_END_MS = 9000;

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A single game session. Owns its players, the board, and the minigame loop.
 * Between minigames a ready vote gates progression, then a wheel picks the game.
 */
export class Lobby {
  readonly id: string;
  phase: LobbyPhase = "lobby";
  private players = new Map<string, Player>();
  private hostId: string;
  private winnerId: string | null = null;
  private currentMinigame: MinigameType | null = null;

  private wordle: WordleRound | null = null;
  private codenames: CodenamesRound | null = null;
  private skribbl: SkribblGame | null = null;
  private skribblTeams: SkribblTeamsGame | null = null;
  private findword: FindWordGame | null = null;
  private tetris: TetrisMatch | null = null;
  private puzzle: PuzzleRound | null = null;
  private pendingAssign: CodenamesAssignment | null = null;
  private puzzleDifficulty: PuzzleDifficulty = "medium";
  private sandbox = false;
  private timers: NodeJS.Timeout[] = [];
  private interval: NodeJS.Timeout | null = null;

  onEmpty?: () => void;

  constructor(
    private io: IO,
    id: string,
    host: { id: string; socketId: string; nickname: string },
  ) {
    this.id = id;
    this.hostId = host.id;
    this.players.set(host.id, {
      id: host.id,
      socketId: host.socketId,
      nickname: host.nickname,
      color: PLAYER_COLORS[0],
      position: 0,
      isHost: true,
      connected: true,
      ready: false,
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

  addPlayer(player: { id: string; socketId: string; nickname: string }): void {
    // In sandbox we also allow joining between practice rounds (intermission).
    const joinable = this.phase === "lobby" || (this.sandbox && this.phase === "intermission");
    if (!joinable) throw new Error("Game already started.");
    // Guard against the same connection joining twice (e.g. a double-click).
    if ([...this.players.values()].some((p) => p.socketId === player.socketId)) {
      throw new Error("You are already in this lobby.");
    }
    if (this.players.size >= GAME_CONFIG.maxPlayers) throw new Error("Lobby is full.");
    const color = PLAYER_COLORS[this.players.size % PLAYER_COLORS.length];
    this.players.set(player.id, {
      id: player.id,
      socketId: player.socketId,
      nickname: player.nickname,
      color,
      position: 0,
      isHost: false,
      connected: true,
      ready: false,
    });
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
      if (this.phase === "minigame" && this.wordle) {
        this.wordle.finishPlayer(playerId);
        this.emitStandings();
        this.maybeEndWordle();
      }
      if (this.phase === "minigame" && this.codenames) {
        this.broadcastCodenames();
      }
      if (this.phase === "minigame" && this.skribbl) {
        if (this.skribbl.currentDrawer === playerId) {
          // The drawer left — end their turn and move on.
          this.finishSkribblTurn();
        } else {
          this.broadcastSkribbl();
        }
      }
      if (this.phase === "minigame" && this.skribblTeams) {
        // If a drawer left, their team can't draw — the round timer resolves it.
        this.broadcastSkribblTeams();
      }
      if (this.phase === "minigame" && this.findword) {
        // A missing member is auto-filled at the attempt deadline (checkTimeouts).
        this.broadcastFindword();
      }
      if (this.phase === "minigame" && this.tetris) {
        if (this.tetris.kill(playerId)) {
          this.broadcastTetrisPlayers();
          if (this.tetris.isOver()) this.endTetris();
        }
      }
      if (this.phase === "minigame" && this.puzzle) {
        this.puzzle.finishPlayer(playerId);
        this.emitPuzzleStandings();
        if (this.puzzle.isComplete()) this.endPuzzle();
      }
    }

    if (this.hostId === playerId) {
      const next = this.connectedPlayers()[0];
      if (next) {
        next.isHost = true;
        this.hostId = next.id;
      }
    }

    if (!this.hasConnectedPlayers()) {
      this.dispose();
      this.onEmpty?.();
      return;
    }
    this.broadcastLobby();
    this.maybeStartFromReady();
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
    if (this.phase !== "intermission") throw new Error("Not in an intermission.");
    const player = this.players.get(playerId);
    if (!player) throw new Error("Not in this lobby.");
    player.ready = ready;
    this.broadcastLobby();
    this.maybeStartFromReady();
  }

  forceStart(playerId: string): void {
    if (!this.isHost(playerId)) throw new Error("Only the host can start.");
    if (this.phase !== "intermission") throw new Error("Nothing to start.");
    this.spinWheel();
  }

  /** Host-only: choose the puzzle difficulty (only while in the lobby). */
  setDifficulty(hostId: string, difficulty: PuzzleDifficulty): void {
    if (!this.isHost(hostId)) throw new Error("Only the host can change difficulty.");
    if (this.phase !== "lobby") throw new Error("Difficulty can only change in the lobby.");
    this.puzzleDifficulty = difficulty;
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
    if (game === "codenames") {
      if (this.connectedPlayers().length < 4) throw new Error("Codenames needs 4 players.");
      this.beginAssignment();
    } else {
      this.beginCountdown(game);
    }
  }

  private maybeStartFromReady(): void {
    if (this.sandbox) return; // sandbox rounds are launched explicitly

    if (this.phase !== "intermission") return;
    const connected = this.connectedPlayers();
    if (connected.length >= 1 && connected.every((p) => p.ready)) {
      this.spinWheel();
    }
  }

  // --- wheel --------------------------------------------------------------

  private availableGames(): MinigameType[] {
    const games: MinigameType[] = ["wordle"];
    const n = this.connectedPlayers().length;
    // Single-player puzzle races work at any size.
    games.push(...PUZZLE_GAMES);
    // Skribbl needs a drawer + at least one guesser.
    if (n >= 2) games.push("skribbl");
    // Tetris is versus — needs at least two players.
    if (n >= 2) games.push("tetris");
    // Team games need equal teams of ≥ 2 (e.g. 4, 6, 8, 9 players).
    if (canFormTeams(n)) {
      games.push("skribblteams");
      games.push("findword");
    }
    // Codenames needs two real teams — even count, at least 4 players.
    if (n >= 4 && n % 2 === 0) games.push("codenames");
    return games;
  }

  private spinWheel(): void {
    const all = this.availableGames();
    // Never offer the game that was just played (unless it's the only option).
    const prev = this.currentMinigame;
    let options = all;
    if (prev && all.length > 1) {
      const filtered = all.filter((g) => g !== prev);
      if (filtered.length > 0) options = filtered;
    }
    const chosen = options[Math.floor(Math.random() * options.length)];
    this.currentMinigame = chosen;
    this.phase = "spinning";
    this.io.to(this.id).emit("minigame:spin", { options, chosen, spinMs: WHEEL_SPIN_MS });
    this.schedule(() => this.afterSpin(chosen), WHEEL_SPIN_MS + 300);
  }

  private afterSpin(game: MinigameType): void {
    if (game === "codenames") this.beginAssignment();
    else this.beginCountdown(game);
  }

  private buildAssignment(): CodenamesAssignment {
    const ids = shuffled(this.connectedPlayers().map((p) => p.id));
    const half = Math.floor(ids.length / 2);
    const a = ids.slice(0, half);
    const b = ids.slice(half);
    return {
      a: { spymasterId: a[0], memberIds: a },
      b: { spymasterId: b[0], memberIds: b },
    };
  }

  private beginAssignment(): void {
    this.phase = "assigning";
    this.pendingAssign = this.buildAssignment();
    this.io.to(this.id).emit("minigame:assign", {
      teams: this.pendingAssign,
      animMs: ASSIGN_MS,
    });
    this.schedule(() => this.beginCountdown("codenames"), ASSIGN_MS + 200);
  }

  private beginCountdown(game: MinigameType): void {
    this.phase = "countdown";
    const endsAt = Date.now() + COUNTDOWN_MS;
    this.io.to(this.id).emit("minigame:countdown", { game, endsAt });
    this.schedule(() => {
      if (game === "codenames") this.startCodenames();
      else if (game === "skribbl") this.startSkribbl();
      else if (game === "skribblteams") this.startSkribblTeams();
      else if (game === "findword") this.startFindword();
      else if (game === "tetris") this.startTetris();
      else if (PUZZLE_GAMES.includes(game as PuzzleGame)) this.startPuzzle(game as PuzzleGame);
      else this.startWordle();
    }, COUNTDOWN_MS + 100);
  }

  /** Split the connected players into `k` equal, randomly-chosen teams. */
  private buildTeams(): TeamSpec[] {
    const ids = shuffled(this.connectedPlayers().map((p) => p.id));
    const counts = possibleTeamCounts(ids.length);
    const k = counts[Math.floor(Math.random() * counts.length)] ?? 2;
    const size = ids.length / k;
    const teams: TeamSpec[] = [];
    for (let i = 0; i < k; i++) {
      const style = TEAM_STYLES[i % TEAM_STYLES.length];
      teams.push({
        id: `t${i}`,
        name: style.name,
        color: style.color,
        memberIds: ids.slice(i * size, (i + 1) * size),
      });
    }
    return teams;
  }

  private playerInfos(ids: string[]): { id: string; nickname: string; color: string }[] {
    return ids.map((id) => {
      const p = this.players.get(id);
      return { id, nickname: p?.nickname ?? "?", color: p?.color ?? "#888" };
    });
  }

  /** Build a team-based results scoreboard from a ranked list of teams. */
  private teamOutcome(
    teams: { id: string; name: string; color: string; memberIds: string[] }[],
    detailFor: (teamRank: number, t: { id: string }) => string,
  ): { ranking: string[]; rewards: Record<string, number>; scoreboard: ScoreRow[]; teams: TeamScore[] } {
    const ranking: string[] = [];
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = [];
    const teamScores: TeamScore[] = [];
    teams.forEach((t, teamRank) => {
      const reward = Math.max(1, 3 - teamRank);
      const won = teamRank === 0;
      for (const id of t.memberIds) {
        ranking.push(id);
        rewards[id] = reward;
        const player = this.players.get(id);
        if (player) {
          player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
        }
        scoreboard.push({
          playerId: id,
          nickname: player?.nickname ?? "?",
          color: player?.color ?? "#888",
          rank: teamRank,
          reward,
          win: won,
          detail: `${t.name} · ${detailFor(teamRank, t)}`,
        });
      }
      teamScores.push({
        team: t.id,
        name: t.name,
        color: t.color,
        points: reward,
        won,
        members: t.memberIds.map((id) => ({
          playerId: id,
          nickname: this.players.get(id)?.nickname ?? "?",
        })),
      });
    });
    return { ranking, rewards, scoreboard, teams: teamScores };
  }

  // --- wordle -------------------------------------------------------------

  private startWordle(): void {
    const participants = this.connectedPlayers();
    this.phase = "minigame";
    this.currentMinigame = "wordle";
    this.wordle = new WordleRound(
      participants.map((p) => p.id),
      WORDLE_CONFIG.maxGuesses,
    );
    const endsAt = Date.now() + WORDLE_CONFIG.roundSeconds * 1000;

    this.io.to(this.id).emit("minigame:start", {
      type: "wordle",
      wordle: {
        wordLength: WORDLE_CONFIG.wordLength,
        maxGuesses: WORDLE_CONFIG.maxGuesses,
        roundSeconds: WORDLE_CONFIG.roundSeconds,
        endsAt,
      },
    });
    this.emitStandings();

    this.schedule(() => {
      if (this.wordle) {
        this.wordle.finishAll();
        this.endWordle();
      }
    }, WORDLE_CONFIG.roundSeconds * 1000);
  }

  handleWordleGuess(playerId: string, guess: string) {
    if (this.phase !== "minigame" || !this.wordle) throw new Error("No active round.");
    const outcome = this.wordle.guess(playerId, guess);
    this.emitStandings();
    this.maybeEndWordle();
    return outcome;
  }

  private maybeEndWordle(): void {
    if (this.wordle && this.wordle.isComplete()) this.endWordle();
  }

  private endWordle(): void {
    if (!this.wordle) return;
    const round = this.wordle;
    this.wordle = null;
    this.clearTimers();

    const ranking = round.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const reward = rewardForRank(rank);
      rewards[id] = reward;
      const player = this.players.get(id)!;
      player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      const s = round.statsFor(id);
      const detail = s.solved
        ? `${s.guessesUsed} ${s.guessesUsed === 1 ? "guess" : "guesses"} · ${(s.timeMs / 1000).toFixed(1)}s`
        : "did not solve";
      return {
        playerId: id,
        nickname: player.nickname,
        color: player.color,
        rank,
        reward,
        win: rank === 0 && s.solved,
        detail,
      };
    });

    this.concludeMinigame({ type: "wordle", ranking, rewards, scoreboard, reveal: round.answer });
  }

  private emitStandings(): void {
    if (!this.wordle) return;
    const round = this.wordle;
    const ranking = round.ranking();
    const standings: WordleStanding[] = round.standingsData().map((s) => {
      const player = this.players.get(s.playerId)!;
      const state = round.getPlayerState(s.playerId);
      const done = state?.finishOrder !== null && state?.finishOrder !== undefined;
      return {
        playerId: s.playerId,
        nickname: player.nickname,
        color: player.color,
        guessesUsed: s.guessesUsed,
        solved: s.solved,
        rank: done ? ranking.indexOf(s.playerId) : null,
      };
    });
    this.io.to(this.id).emit("wordle:standings", standings);
  }

  // --- codenames ----------------------------------------------------------

  private startCodenames(): void {
    const assignment = this.pendingAssign ?? this.buildAssignment();
    this.pendingAssign = null;

    this.phase = "minigame";
    this.currentMinigame = "codenames";
    this.codenames = new CodenamesRound(assignment);

    this.io.to(this.id).emit("minigame:start", { type: "codenames" });
    this.broadcastCodenames();

    this.schedule(() => {
      if (this.codenames) {
        this.codenames.finishByTimeout();
        this.broadcastCodenames();
        this.endCodenames();
      }
    }, CODENAMES_CONFIG.roundSeconds * 1000);
  }

  private broadcastCodenames(): void {
    if (!this.codenames) return;
    for (const p of this.players.values()) {
      if (p.connected && p.socketId) {
        this.io.to(p.socketId).emit("codenames:state", this.codenames.viewFor(p.id));
      }
    }
  }

  handleCodenamesClue(playerId: string, word: string, count: number): void {
    if (this.phase !== "minigame" || !this.codenames) throw new Error("No active round.");
    this.codenames.giveClue(playerId, word, count);
    this.broadcastCodenames();
  }

  handleCodenamesGuess(playerId: string, index: number): void {
    if (this.phase !== "minigame" || !this.codenames) throw new Error("No active round.");
    this.codenames.guess(playerId, index);
    this.broadcastCodenames();
    if (this.codenames.isComplete()) this.endCodenames();
  }

  handleCodenamesEndTurn(playerId: string): void {
    if (this.phase !== "minigame" || !this.codenames) throw new Error("No active round.");
    this.codenames.endTurn(playerId);
    this.broadcastCodenames();
  }

  private endCodenames(): void {
    if (!this.codenames) return;
    const round = this.codenames;
    this.codenames = null;
    this.clearTimers();

    const winTeam = round.winner ?? "a";
    const loseTeam: CodenamesTeam = winTeam === "a" ? "b" : "a";
    const winners = round.teamMembers(winTeam);
    const losers = round.teamMembers(loseTeam);
    const ranking = [...winners, ...losers];

    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const isWinner = winners.includes(id);
      const reward = isWinner ? 3 : 1;
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) {
        player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      }
      const t = isWinner ? winTeam : loseTeam;
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: isWinner,
        detail: `${teamName(t)} team · ${isWinner ? "won" : "lost"}`,
      };
    });

    const teams: TeamScore[] = (["a", "b"] as CodenamesTeam[]).map((t) => ({
      team: t,
      name: teamName(t),
      color: teamColor(t),
      points: t === winTeam ? 3 : 1,
      won: t === winTeam,
      members: round.teamMembers(t).map((id) => ({
        playerId: id,
        nickname: this.players.get(id)?.nickname ?? "?",
      })),
    }));

    this.concludeMinigame({
      type: "codenames",
      ranking,
      rewards,
      scoreboard,
      teams,
      reveal: `${teamName(winTeam)} team wins!`,
    });
  }

  // --- skribbl ------------------------------------------------------------

  private startSkribbl(): void {
    const players = this.connectedPlayers().map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
    }));
    this.phase = "minigame";
    this.currentMinigame = "skribbl";
    this.skribbl = new SkribblGame(players);
    this.io.to(this.id).emit("minigame:start", { type: "skribbl" });
    this.nextSkribblTurn();
  }

  private nextSkribblTurn(): void {
    if (!this.skribbl) return;
    this.skribbl.beginTurn();
    this.io.to(this.id).emit("skribbl:clear");
    this.broadcastSkribbl();
    const total = SKRIBBL_CONFIG.roundSeconds * 1000;
    // Reveal up to two hint letters across the turn (at ~1/3 and ~2/3).
    this.schedule(() => this.revealSkribblHint(), Math.round(total * 0.34));
    this.schedule(() => this.revealSkribblHint(), Math.round(total * 0.67));
    this.schedule(() => this.finishSkribblTurn(), total);
  }

  private revealSkribblHint(): void {
    if (this.skribbl && this.skribbl.revealHint()) this.broadcastSkribbl();
  }

  private finishSkribblTurn(): void {
    if (!this.skribbl) return;
    this.clearTimers(); // cancel the turn timer (harmless if it already fired)
    this.skribbl.endTurn();
    this.broadcastSkribbl();
    if (this.skribbl.hasNextTurn()) {
      this.schedule(() => this.nextSkribblTurn(), 5000);
    } else {
      this.schedule(() => this.endSkribbl(), 5000);
    }
  }

  private broadcastSkribbl(): void {
    if (!this.skribbl) return;
    for (const p of this.players.values()) {
      if (p.connected && p.socketId) {
        this.io.to(p.socketId).emit("skribbl:state", this.skribbl.viewFor(p.id));
      }
    }
  }

  handleSkribblGuess(playerId: string, text: string): { correct: boolean; close: boolean } {
    if (this.phase !== "minigame" || !this.skribbl) throw new Error("No active round.");
    const { correct, turnComplete, close } = this.skribbl.guess(playerId, text);
    this.broadcastSkribbl();
    if (turnComplete) this.finishSkribblTurn();
    return { correct, close };
  }

  handleSkribblDraw(playerId: string, seg: SkribblSegment): void {
    if (this.phase !== "minigame" || !this.skribbl) return;
    if (this.skribbl.currentDrawer !== playerId || this.skribbl.currentPhase !== "drawing") return;
    const drawer = this.players.get(playerId);
    // Relay to everyone except the drawer (who already drew it locally).
    this.io.to(this.id).except(drawer?.socketId ?? "").emit("skribbl:draw", { seg });
  }

  handleSkribblClear(playerId: string): void {
    if (this.phase !== "minigame" || !this.skribbl) return;
    if (this.skribbl.currentDrawer !== playerId) return;
    const drawer = this.players.get(playerId);
    this.io.to(this.id).except(drawer?.socketId ?? "").emit("skribbl:clear");
  }

  private endSkribbl(): void {
    if (!this.skribbl) return;
    const game = this.skribbl;
    this.skribbl = null;
    this.clearTimers();

    const ranking = game.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const reward = rewardForRank(rank);
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) {
        player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      }
      const pts = game.pointsFor(id);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: rank === 0,
        detail: `${pts} pts`,
      };
    });

    this.concludeMinigame({ type: "skribbl", ranking, rewards, scoreboard });
  }

  // --- skribbl teams ------------------------------------------------------

  private startSkribblTeams(): void {
    const teams = this.buildTeams();
    const players = this.playerInfos(this.connectedPlayers().map((p) => p.id));
    this.phase = "minigame";
    this.currentMinigame = "skribblteams";
    this.skribblTeams = new SkribblTeamsGame(teams, players);
    this.io.to(this.id).emit("minigame:start", { type: "skribblteams" });
    this.nextSkribblTeamsRound();
  }

  private nextSkribblTeamsRound(): void {
    if (!this.skribblTeams) return;
    this.skribblTeams.beginRound();
    this.io.to(this.id).emit("skribblteams:clear");
    this.broadcastSkribblTeams();
    const total = SKRIBBL_TEAMS_CONFIG.roundSeconds * 1000;
    this.schedule(() => this.revealSkribblTeamsHint(), Math.round(total * 0.34));
    this.schedule(() => this.revealSkribblTeamsHint(), Math.round(total * 0.67));
    this.schedule(() => this.finishSkribblTeamsRound(), total);
  }

  private revealSkribblTeamsHint(): void {
    if (this.skribblTeams && this.skribblTeams.revealHint()) this.broadcastSkribblTeams();
  }

  private finishSkribblTeamsRound(): void {
    if (!this.skribblTeams) return;
    this.clearTimers();
    this.skribblTeams.endRound();
    this.broadcastSkribblTeams();
    if (this.skribblTeams.hasNextRound()) {
      this.schedule(() => this.nextSkribblTeamsRound(), SKRIBBL_TEAMS_CONFIG.betweenRoundsMs);
    } else {
      this.schedule(() => this.endSkribblTeams(), SKRIBBL_TEAMS_CONFIG.betweenRoundsMs);
    }
  }

  private broadcastSkribblTeams(): void {
    if (!this.skribblTeams) return;
    for (const p of this.players.values()) {
      if (p.connected && p.socketId) {
        this.io.to(p.socketId).emit("skribblteams:state", this.skribblTeams.viewFor(p.id));
      }
    }
  }

  handleSkribblTeamsGuess(playerId: string, text: string): { correct: boolean; close: boolean } {
    if (this.phase !== "minigame" || !this.skribblTeams) throw new Error("No active round.");
    const { correct, roundComplete, close } = this.skribblTeams.guess(playerId, text);
    this.broadcastSkribblTeams();
    if (roundComplete) this.finishSkribblTeamsRound();
    return { correct, close };
  }

  handleSkribblTeamsDraw(playerId: string, seg: SkribblSegment): void {
    if (this.phase !== "minigame" || !this.skribblTeams) return;
    if (!this.skribblTeams.isDrawer(playerId) || this.skribblTeams.currentPhase !== "drawing") return;
    const drawer = this.players.get(playerId);
    // Relay only to teammates (excluding the drawer, who already drew locally).
    for (const id of this.skribblTeams.teammateIds(playerId)) {
      if (id === playerId) continue;
      const mate = this.players.get(id);
      if (mate?.connected && mate.socketId && mate.socketId !== drawer?.socketId) {
        this.io.to(mate.socketId).emit("skribblteams:draw", { seg });
      }
    }
  }

  handleSkribblTeamsClear(playerId: string): void {
    if (this.phase !== "minigame" || !this.skribblTeams) return;
    if (!this.skribblTeams.isDrawer(playerId)) return;
    for (const id of this.skribblTeams.teammateIds(playerId)) {
      if (id === playerId) continue;
      const mate = this.players.get(id);
      if (mate?.connected && mate.socketId) {
        this.io.to(mate.socketId).emit("skribblteams:clear");
      }
    }
  }

  private endSkribblTeams(): void {
    if (!this.skribblTeams) return;
    const game = this.skribblTeams;
    this.skribblTeams = null;
    this.clearTimers();

    const results = game.results();
    const out = this.teamOutcome(results, (rank, t) => {
      const r = results.find((x) => x.id === t.id)!;
      return rank === 0
        ? `${r.solvedCount} guessed · winners`
        : `${r.solvedCount} guessed`;
    });
    this.concludeMinigame({
      type: "skribblteams",
      ranking: out.ranking,
      rewards: out.rewards,
      scoreboard: out.scoreboard,
      teams: out.teams,
      reveal: `${results[0]?.name ?? "?"} team wins!`,
    });
  }

  // --- find the word ------------------------------------------------------

  private startFindword(): void {
    const teams = this.buildTeams();
    const players = this.playerInfos(this.connectedPlayers().map((p) => p.id));
    this.phase = "minigame";
    this.currentMinigame = "findword";
    this.findword = new FindWordGame(teams, players);
    this.io.to(this.id).emit("minigame:start", { type: "findword" });
    this.broadcastFindword();
    // Poll for per-team attempt deadlines.
    this.interval = setInterval(() => {
      if (!this.findword) return;
      if (this.findword.checkTimeouts(Date.now())) this.broadcastFindword();
      if (this.findword.isComplete()) this.endFindword();
    }, 1000);
  }

  private broadcastFindword(): void {
    if (!this.findword) return;
    for (const p of this.players.values()) {
      if (p.connected && p.socketId) {
        this.io.to(p.socketId).emit("findword:state", this.findword.viewFor(p.id));
      }
    }
  }

  handleFindwordSubmit(playerId: string, word: string): { accepted: boolean } {
    if (this.phase !== "minigame" || !this.findword) throw new Error("No active round.");
    const res = this.findword.submit(playerId, word);
    this.broadcastFindword();
    if (this.findword.isComplete()) this.endFindword();
    return res;
  }

  private endFindword(): void {
    if (!this.findword) return;
    const game = this.findword;
    this.findword = null;
    this.clearTimers();

    const results = game.results();
    const out = this.teamOutcome(results, (rank, t) => {
      const r = results.find((x) => x.id === t.id)!;
      if (!r.converged) return "did not converge";
      return rank === 0
        ? `"${(r.convergedWord ?? "").toUpperCase()}" in ${r.attempts} · winners`
        : `"${(r.convergedWord ?? "").toUpperCase()}" in ${r.attempts}`;
    });
    this.concludeMinigame({
      type: "findword",
      ranking: out.ranking,
      rewards: out.rewards,
      scoreboard: out.scoreboard,
      teams: out.teams,
      reveal: `${results[0]?.name ?? "?"} team wins!`,
    });
  }

  // --- tetris -------------------------------------------------------------

  private startTetris(): void {
    const players = this.playerInfos(this.connectedPlayers().map((p) => p.id));
    this.phase = "minigame";
    this.currentMinigame = "tetris";
    this.tetris = new TetrisMatch(players);
    const startsAt = Date.now() + 1200;
    this.io.to(this.id).emit("minigame:start", { type: "tetris" });
    this.io.to(this.id).emit("tetris:init", {
      players: this.tetris.players(),
      seed: this.tetris.seed,
      startsAt,
    });
    this.broadcastTetrisPlayers();
    // Hard time cap.
    this.schedule(() => {
      if (this.tetris) this.endTetris();
    }, TETRIS_CONFIG.roundSeconds * 1000);
  }

  private broadcastTetrisPlayers(): void {
    if (!this.tetris) return;
    this.io.to(this.id).emit("tetris:players", {
      alive: this.tetris.aliveIds(),
      kos: this.tetris.koIds(),
    });
  }

  handleTetrisBoard(playerId: string, cells: string, lines: number): void {
    if (this.phase !== "minigame" || !this.tetris) return;
    this.tetris.updateBoard(playerId, cells, lines);
    const snap = this.tetris.snapshotFor(playerId);
    const sender = this.players.get(playerId);
    // Relay to everyone else for the spectator mini-views.
    this.io.to(this.id).except(sender?.socketId ?? "").emit("tetris:board", snap);
  }

  handleTetrisLines(playerId: string, lines: number): void {
    if (this.phase !== "minigame" || !this.tetris) return;
    const route = this.tetris.routeLines(playerId, lines);
    if (!route) return;
    const target = this.players.get(route.recipientId);
    if (target?.connected && target.socketId) {
      this.io.to(target.socketId).emit("tetris:garbage", { rows: route.rows, hole: route.hole });
    }
  }

  handleTetrisTarget(playerId: string, targetId: string): void {
    if (this.phase !== "minigame" || !this.tetris) return;
    this.tetris.setTarget(playerId, targetId);
  }

  handleTetrisDead(playerId: string): void {
    if (this.phase !== "minigame" || !this.tetris) return;
    if (this.tetris.kill(playerId)) {
      this.broadcastTetrisPlayers();
      if (this.tetris.isOver()) this.endTetris();
    }
  }

  private endTetris(): void {
    if (!this.tetris) return;
    const game = this.tetris;
    this.tetris = null;
    this.clearTimers();

    const ranking = game.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const reward = rewardForRank(rank);
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) {
        player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      }
      const survived = game.isAlive(id);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: rank === 0,
        detail: `${game.linesFor(id)} lines · ${survived ? "survived" : "KO'd"}`,
      };
    });
    this.concludeMinigame({ type: "tetris", ranking, rewards, scoreboard });
  }

  // --- puzzles (zip / queens / sudoku / tango) ---------------------------

  private startPuzzle(game: PuzzleGame): void {
    const participants = this.connectedPlayers();
    const { spec } = generatePuzzle(game, this.puzzleDifficulty);
    this.phase = "minigame";
    this.currentMinigame = game;
    this.puzzle = new PuzzleRound(participants.map((p) => p.id), spec);
    const seconds = PUZZLE_ROUND_SECONDS[game];
    const endsAt = Date.now() + seconds * 1000;

    this.io.to(this.id).emit("minigame:start", { type: game });
    this.io.to(this.id).emit("puzzle:start", { game, spec, endsAt, roundSeconds: seconds });
    this.emitPuzzleStandings();

    this.schedule(() => {
      if (this.puzzle) {
        this.puzzle.finishAll();
        this.endPuzzle();
      }
    }, seconds * 1000);
  }

  handlePuzzleSubmit(playerId: string, solution: number[]): { solved: boolean } {
    if (this.phase !== "minigame" || !this.puzzle) throw new Error("No active round.");
    const res = this.puzzle.submit(playerId, solution);
    if (res.solved) {
      this.emitPuzzleStandings();
      if (this.puzzle.isComplete()) this.endPuzzle();
    }
    return res;
  }

  private emitPuzzleStandings(): void {
    if (!this.puzzle) return;
    const ranking = this.puzzle.ranking();
    const standings: PuzzleStanding[] = [...this.players.values()].map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      color: p.color,
      solved: this.puzzle!.isSolved(p.id),
      rank: this.puzzle!.isSolved(p.id) ? ranking.indexOf(p.id) : null,
    }));
    this.io.to(this.id).emit("puzzle:standings", standings);
  }

  private endPuzzle(): void {
    if (!this.puzzle) return;
    const round = this.puzzle;
    this.puzzle = null;
    this.clearTimers();

    const ranking = round.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const reward = rewardForRank(rank);
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) {
        player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      }
      const s = round.statsFor(id);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: rank === 0 && s.solved,
        detail: s.solved ? `solved in ${(s.timeMs / 1000).toFixed(1)}s` : "did not solve",
      };
    });

    this.concludeMinigame({ type: this.currentMinigame ?? "wordle", ranking, rewards, scoreboard });
  }

  // --- shared minigame conclusion ----------------------------------------

  private concludeMinigame(result: MinigameResult): void {
    if (this.sandbox) {
      // Practice mode: undo any board movement, no winner, back to the menu.
      for (const p of this.players.values()) p.position = 0;
      this.phase = "intermission";
      this.resetReady();
      this.io.to(this.id).emit("minigame:ended", { result, lobby: this.toView() });
      return;
    }

    const winner = result.ranking
      .map((id) => this.players.get(id))
      .find((p): p is Player => !!p && p.position >= GAME_CONFIG.boardLength);

    if (winner) {
      this.winnerId = winner.id;
      this.phase = "finished";
      this.io.to(this.id).emit("minigame:ended", { result, lobby: this.toView() });
      this.io.to(this.id).emit("game:finished", {
        winnerId: this.winnerId,
        lobby: this.toView(),
      });
      // After the celebration, reset the board and return everyone to the OPEN
      // lobby (not the home page) so they can start a fresh match.
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
      return;
    }

    // Show the results podium briefly, then keep everyone on the board in an
    // intermission (the board race carries over) and open the ready vote for
    // the next game. We deliberately do NOT return to the lobby screen
    // mid-match — the host only picks difficulty / roster at the very start.
    this.phase = "intermission";
    this.resetReady();
    this.io.to(this.id).emit("minigame:ended", { result, lobby: this.toView() });
    this.schedule(() => {
      // Guard: a new round may already have been started from the ready vote.
      if (this.phase !== "intermission") return;
      this.io.to(this.id).emit("intermission:start", { lobby: this.toView() });
    }, RESULTS_MS);
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
      puzzleDifficulty: this.puzzleDifficulty,
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
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  dispose(): void {
    this.clearTimers();
  }
}
