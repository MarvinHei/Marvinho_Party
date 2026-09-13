import type { Server } from "socket.io";
import {
  GAME_CONFIG,
  NO_TIMER_SECONDS,
  PLAYER_COLORS,
  SKRIBBL_TEAMS_CONFIG,
  TEAM_STYLES,
  TETRIS_CONFIG,
  WHEEL_SPIN_MS,
  WORDLE_CONFIG,
  GEO_COUNTRIES,
  WORLD_GEOMETRY,
  borderableCountries,
  canFormTeams,
  countryByCode,
  defaultLobbySettings,
  possibleTeamCounts,
  rewardForRank,
  shortestCountryPath,
  type ClientToServerEvents,
  type CodenamesAssignment,
  type CodenamesTeam,
  type GeoStanding,
  type LobbyPhase,
  type LobbySettings,
  type LobbyView,
  type MinigameResult,
  type MinigameType,
  type PlayerView,
  type PuzzleGame,
  type PuzzleStanding,
  type ScoreRow,
  type ServerToClientEvents,
  type SkribblSegment,
  type TeamDraftTeam,
  type TeamScore,
  type TravleStanding,
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
import { GuessCountryRound } from "./minigames/guessCountry.js";
import { TravleRound } from "./minigames/travle.js";
import { PongRound } from "./minigames/pong.js";
import { HideRound } from "./minigames/verstecken.js";
import { BattleRound } from "./minigames/battle.js";

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
  private guessCountry: GuessCountryRound | null = null;
  private travle: TravleRound | null = null;
  private pong: PongRound | null = null;
  private hide: HideRound | null = null;
  private battle: BattleRound | null = null;
  private pendingAssign: CodenamesAssignment | null = null;
  private pendingTeams: TeamSpec[] | null = null;
  private settings: LobbySettings = defaultLobbySettings();
  /** The game awaiting its explanation-screen ready-gate, if any. */
  private explainGame: MinigameType | null = null;
  /** The team game awaiting its draft-confirmation ready-gate, if any. */
  private assignGame: MinigameType | null = null;
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
      if (this.phase === "minigame" && this.guessCountry) {
        this.guessCountry.finishPlayer(playerId);
        this.emitGeoStandings();
        if (this.guessCountry.isComplete()) this.endGuessCountry();
      }
      if (this.phase === "minigame" && this.travle) {
        this.travle.finishPlayer(playerId);
        this.emitTravleStandings();
        if (this.travle.isComplete()) this.endTravle();
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

  /** Effective round length for a game, honoring the timer on/off toggle. */
  private roundSecondsFor(game: MinigameType): number {
    const s = this.settings.games[game];
    return s.timerEnabled ? s.timerSeconds : NO_TIMER_SECONDS;
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
    // (the start methods build teams on the fly when none were drafted).
    this.beginCountdown(game);
  }

  private maybeStartFromReady(): void {
    if (this.sandbox) return; // sandbox rounds are launched explicitly

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
    const games: MinigameType[] = ["wordle", "guesscountry", "travle"];
    const n = this.connectedPlayers().length;
    // Single-player puzzle races work at any size.
    games.push(...PUZZLE_GAMES);
    // Skribbl needs a drawer + at least one guesser.
    if (n >= 2) games.push("skribbl");
    // Tetris is versus — needs at least two players.
    if (n >= 2) games.push("tetris");
    // Pong pairs players into 1v1 matches (an odd one out faces a CPU).
    if (n >= 2) games.push("pong");
    // Verstecken: one seeker + at least two hiders.
    if (n >= 3) games.push("verstecken");
    // Battle Royale: a free-for-all with at least three players.
    if (n >= 3) games.push("battle");
    // Team games need equal teams of ≥ 2 (e.g. 4, 6, 8, 9 players).
    if (canFormTeams(n)) {
      games.push("skribblteams");
      games.push("findword");
    }
    // Codenames needs two real teams — even count, at least 4 players.
    if (n >= 4 && n % 2 === 0) games.push("codenames");
    // Drop any the host has blacklisted for this lobby.
    return games.filter((g) => this.settings.games[g].enabled);
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
    const chosen = options[Math.floor(Math.random() * options.length)];
    this.currentMinigame = chosen;
    this.phase = "spinning";
    this.io.to(this.id).emit("minigame:spin", { options, chosen, spinMs: WHEEL_SPIN_MS });
    this.schedule(() => this.afterSpin(chosen), WHEEL_SPIN_MS + 300);
  }

  private afterSpin(game: MinigameType): void {
    // Team games draw their teams first (with a confirm gate); others go on.
    if (game === "codenames" || game === "skribblteams" || game === "findword") {
      this.beginTeamDraft(game);
    } else {
      this.proceed(game);
    }
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

  /**
   * Randomly draw the teams for a team game and show the draft, then wait for
   * everyone to confirm (or the host to force-start) before proceeding.
   */
  private beginTeamDraft(game: MinigameType): void {
    this.assignGame = game;
    this.pendingAssign = null;
    this.pendingTeams = null;
    let teams: TeamDraftTeam[];
    if (game === "codenames") {
      const a = this.buildAssignment();
      this.pendingAssign = a;
      teams = [
        { id: "a", name: "Red", color: "#e6394b", memberIds: a.a.memberIds, spymasterId: a.a.spymasterId },
        { id: "b", name: "Blue", color: "#3aa0ff", memberIds: a.b.memberIds, spymasterId: a.b.spymasterId },
      ];
    } else {
      const built = this.buildTeams();
      this.pendingTeams = built;
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
    this.phase = "countdown";
    const endsAt = Date.now() + COUNTDOWN_MS;
    this.io.to(this.id).emit("minigame:countdown", { game, endsAt });
    this.schedule(() => {
      if (game === "codenames") this.startCodenames();
      else if (game === "skribbl") this.startSkribbl();
      else if (game === "skribblteams") this.startSkribblTeams();
      else if (game === "findword") this.startFindword();
      else if (game === "tetris") this.startTetris();
      else if (game === "guesscountry") this.startGuessCountry();
      else if (game === "travle") this.startTravle();
      else if (game === "pong") this.startPong();
      else if (game === "verstecken") this.startVerstecken();
      else if (game === "battle") this.startBattle();
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
    const seconds = this.roundSecondsFor("wordle");
    const endsAt = Date.now() + seconds * 1000;

    this.io.to(this.id).emit("minigame:start", {
      type: "wordle",
      wordle: {
        wordLength: WORDLE_CONFIG.wordLength,
        maxGuesses: WORDLE_CONFIG.maxGuesses,
        roundSeconds: seconds,
        endsAt,
      },
    });
    this.emitStandings();

    this.schedule(() => {
      if (this.wordle) {
        this.wordle.finishAll();
        this.endWordle();
      }
    }, seconds * 1000);
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
      const s = round.statsFor(id);
      // Only players who solved the word advance.
      const reward = s.solved ? rewardForRank(rank) : 0;
      rewards[id] = reward;
      const player = this.players.get(id)!;
      player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
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
    this.codenames = new CodenamesRound(assignment, this.settings.codenamesSize);

    this.io.to(this.id).emit("minigame:start", { type: "codenames" });
    this.broadcastCodenames();

    this.schedule(() => {
      if (this.codenames) {
        this.codenames.finishByTimeout();
        this.broadcastCodenames();
        this.endCodenames();
      }
    }, this.roundSecondsFor("codenames") * 1000);
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
    this.skribbl = new SkribblGame(players, this.roundSecondsFor("skribbl"));
    this.io.to(this.id).emit("minigame:start", { type: "skribbl" });
    this.nextSkribblTurn();
  }

  private nextSkribblTurn(): void {
    if (!this.skribbl) return;
    this.skribbl.beginTurn();
    this.io.to(this.id).emit("skribbl:clear");
    this.broadcastSkribbl();
    const total = this.roundSecondsFor("skribbl") * 1000;
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
    const teams = this.pendingTeams ?? this.buildTeams();
    this.pendingTeams = null;
    const players = this.playerInfos(this.connectedPlayers().map((p) => p.id));
    this.phase = "minigame";
    this.currentMinigame = "skribblteams";
    this.skribblTeams = new SkribblTeamsGame(teams, players, this.roundSecondsFor("skribblteams"));
    this.io.to(this.id).emit("minigame:start", { type: "skribblteams" });
    this.nextSkribblTeamsRound();
  }

  private nextSkribblTeamsRound(): void {
    if (!this.skribblTeams) return;
    this.skribblTeams.beginRound();
    this.io.to(this.id).emit("skribblteams:clear");
    this.broadcastSkribblTeams();
    const total = this.roundSecondsFor("skribblteams") * 1000;
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
    const teams = this.pendingTeams ?? this.buildTeams();
    this.pendingTeams = null;
    const players = this.playerInfos(this.connectedPlayers().map((p) => p.id));
    this.phase = "minigame";
    this.currentMinigame = "findword";
    this.findword = new FindWordGame(teams, players, this.roundSecondsFor("findword"));
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
      rows: this.settings.tetrisRows,
      cols: TETRIS_CONFIG.cols,
    });
    this.broadcastTetrisPlayers();
    // Hard time cap.
    this.schedule(() => {
      if (this.tetris) this.endTetris();
    }, this.roundSecondsFor("tetris") * 1000);
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
    const { spec } = generatePuzzle(game, this.settings.puzzleDifficulty[game]);
    this.phase = "minigame";
    this.currentMinigame = game;
    this.puzzle = new PuzzleRound(participants.map((p) => p.id), spec);
    const seconds = this.roundSecondsFor(game);
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
      const s = round.statsFor(id);
      // Only players who actually solved the puzzle advance.
      const reward = s.solved ? rewardForRank(rank) : 0;
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) {
        player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      }
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

  // --- guess the country --------------------------------------------------

  private startGuessCountry(): void {
    const participants = this.connectedPlayers();
    const answer = GEO_COUNTRIES[Math.floor(Math.random() * GEO_COUNTRIES.length)];
    this.phase = "minigame";
    this.currentMinigame = "guesscountry";
    this.guessCountry = new GuessCountryRound(participants.map((p) => p.id), answer);
    const seconds = this.roundSecondsFor("guesscountry");
    const endsAt = Date.now() + seconds * 1000;

    this.io.to(this.id).emit("minigame:start", { type: "guesscountry" });
    // Send the silhouette geometry only — never the country's code/name.
    this.io.to(this.id).emit("guesscountry:start", {
      geometry: WORLD_GEOMETRY[answer.code],
      endsAt,
      roundSeconds: seconds,
      maxTries: 8,
    });
    this.emitGeoStandings();

    this.schedule(() => {
      if (this.guessCountry) {
        this.guessCountry.finishAll();
        this.endGuessCountry();
      }
    }, seconds * 1000);
  }

  handleGuessCountryGuess(playerId: string, name: string) {
    if (this.phase !== "minigame" || !this.guessCountry) throw new Error("No active round.");
    const res = this.guessCountry.guess(playerId, name);
    this.emitGeoStandings();
    if (this.guessCountry.isComplete()) this.endGuessCountry();
    return res;
  }

  private emitGeoStandings(): void {
    if (!this.guessCountry) return;
    const ranking = this.guessCountry.ranking();
    const standings: GeoStanding[] = [...this.players.values()].map((p) => {
      const s = this.guessCountry!.statsFor(p.id);
      return {
        playerId: p.id,
        nickname: p.nickname,
        color: p.color,
        solved: s.solved,
        tries: s.tries,
        rank: s.solved ? ranking.indexOf(p.id) : null,
      };
    });
    this.io.to(this.id).emit("guesscountry:standings", standings);
  }

  private endGuessCountry(): void {
    if (!this.guessCountry) return;
    const round = this.guessCountry;
    this.guessCountry = null;
    this.clearTimers();

    const ranking = round.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const s = round.statsFor(id);
      // Only players who identified the country advance.
      const reward = s.solved ? rewardForRank(rank) : 0;
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: rank === 0 && s.solved,
        detail: s.solved ? `${s.tries} ${s.tries === 1 ? "try" : "tries"}` : "did not solve",
      };
    });

    this.concludeMinigame({
      type: "guesscountry",
      ranking,
      rewards,
      scoreboard,
      reveal: round.answer.name,
    });
  }

  // --- travle -------------------------------------------------------------

  private pickTravlePair(): { start: string; end: string } {
    const pool = borderableCountries();
    for (let attempt = 0; attempt < 60; attempt++) {
      const start = pool[Math.floor(Math.random() * pool.length)].code;
      const end = pool[Math.floor(Math.random() * pool.length)].code;
      if (start === end) continue;
      const path = shortestCountryPath(start, end);
      // 4–6 nodes → 2–4 countries to name in between: a good puzzle length.
      if (path && path.length >= 4 && path.length <= 6) return { start, end };
    }
    // Fallback: any connected pair.
    for (let attempt = 0; attempt < 60; attempt++) {
      const start = pool[Math.floor(Math.random() * pool.length)].code;
      const end = pool[Math.floor(Math.random() * pool.length)].code;
      if (start !== end && shortestCountryPath(start, end)) return { start, end };
    }
    return { start: "FRA", end: "POL" };
  }

  private startTravle(): void {
    const participants = this.connectedPlayers();
    const { start, end } = this.pickTravlePair();
    this.phase = "minigame";
    this.currentMinigame = "travle";
    this.travle = new TravleRound(participants.map((p) => p.id), start, end);
    const seconds = this.roundSecondsFor("travle");
    const endsAt = Date.now() + seconds * 1000;

    this.io.to(this.id).emit("minigame:start", { type: "travle" });
    this.io.to(this.id).emit("travle:start", { startCode: start, endCode: end, endsAt, roundSeconds: seconds });
    this.emitTravleStandings();

    this.schedule(() => {
      if (this.travle) {
        this.travle.finishAll();
        this.endTravle();
      }
    }, seconds * 1000);
  }

  handleTravleGuess(playerId: string, name: string) {
    if (this.phase !== "minigame" || !this.travle) throw new Error("No active round.");
    const res = this.travle.guess(playerId, name);
    this.emitTravleStandings();
    if (this.travle.isComplete()) this.endTravle();
    return res;
  }

  private emitTravleStandings(): void {
    if (!this.travle) return;
    const ranking = this.travle.ranking();
    const standings: TravleStanding[] = [...this.players.values()].map((p) => {
      const s = this.travle!.statsFor(p.id);
      return {
        playerId: p.id,
        nickname: p.nickname,
        color: p.color,
        connected: s.connected,
        count: s.count,
        rank: s.connected ? ranking.indexOf(p.id) : null,
      };
    });
    this.io.to(this.id).emit("travle:standings", standings);
  }

  private endTravle(): void {
    if (!this.travle) return;
    const round = this.travle;
    this.travle = null;
    this.clearTimers();

    const startName = countryByCode(round.startCode)?.name ?? round.startCode;
    const endName = countryByCode(round.endCode)?.name ?? round.endCode;

    const ranking = round.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const s = round.statsFor(id);
      // Only players who connected the two countries advance.
      const reward = s.connected ? rewardForRank(rank) : 0;
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: rank === 0 && s.connected,
        detail: s.connected ? `connected with ${s.count}` : `${s.count} named · no link`,
      };
    });

    this.concludeMinigame({
      type: "travle",
      ranking,
      rewards,
      scoreboard,
      reveal: `${startName} → ${endName}`,
    });
  }

  // --- pong ---------------------------------------------------------------

  private startPong(): void {
    const players = this.connectedPlayers().map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
    }));
    this.phase = "minigame";
    this.currentMinigame = "pong";
    this.pong = new PongRound(players, this.settings.pongPoints);
    this.io.to(this.id).emit("minigame:start", { type: "pong" });
    // Tell each player which paddle they control and who they're up against.
    for (const p of this.connectedPlayers()) {
      const init = this.pong.initFor(p.id);
      if (!init || !p.socketId) continue;
      this.io.to(p.socketId).emit("pong:init", {
        side: init.side,
        target: this.settings.pongPoints,
        self: { name: init.self.name, color: init.self.color },
        opponent: { name: init.opponent.name, color: init.opponent.color },
        vsCpu: init.vsCpu,
      });
    }
    // 30 Hz physics + per-player state broadcast.
    let last = Date.now();
    this.interval = setInterval(() => {
      if (!this.pong) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.pong.tick(dt);
      for (const p of this.connectedPlayers()) {
        const s = this.pong.stateFor(p.id);
        if (s && p.socketId) this.io.to(p.socketId).emit("pong:state", s);
      }
      if (this.pong.isComplete()) this.endPong();
    }, 33);
    // Hard time cap — matches usually finish well before this.
    this.schedule(() => {
      if (this.pong) this.endPong();
    }, this.roundSecondsFor("pong") * 1000);
  }

  handlePongMove(playerId: string, y: number): void {
    if (this.phase !== "minigame" || !this.pong) return;
    this.pong.setPaddle(playerId, y);
  }

  private endPong(): void {
    if (!this.pong) return;
    const round = this.pong;
    this.pong = null;
    this.clearTimers();

    const ranking = round.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const s = round.statsFor(id);
      const reward = s.won ? 3 : 1;
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: s.won,
        detail: `${s.won ? "won" : "lost"} ${s.scored}–${s.conceded}${s.vsCpu ? " · vs CPU" : ""}`,
      };
    });

    this.concludeMinigame({ type: "pong", ranking, rewards, scoreboard });
  }

  // --- verstecken ---------------------------------------------------------

  private startVerstecken(): void {
    const players = this.connectedPlayers().map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
    }));
    this.phase = "minigame";
    this.currentMinigame = "verstecken";
    const roundMs = this.roundSecondsFor("verstecken") * 1000;
    const holdMs = 12000; // hiders get a head start before the seeker is loosed
    this.hide = new HideRound(players, holdMs, roundMs);
    this.io.to(this.id).emit("minigame:start", { type: "verstecken" });
    const walls = this.hide.encodedWalls();
    for (const p of this.connectedPlayers()) {
      if (!p.socketId) continue;
      this.io.to(p.socketId).emit("hide:init", {
        cols: this.hide.arena.cols,
        rows: this.hide.arena.rows,
        walls,
        role: this.hide.roleOf(p.id),
        releaseAt: this.hide.releaseAt,
        endsAt: this.hide.endsAt,
        self: this.hide.infoOf(p.id),
      });
    }
    let last = Date.now();
    this.interval = setInterval(() => {
      if (!this.hide) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.hide.tick(dt);
      for (const p of this.connectedPlayers()) {
        if (p.socketId) this.io.to(p.socketId).emit("hide:state", this.hide.stateFor(p.id));
      }
      if (this.hide.isComplete()) this.endVerstecken();
    }, 50); // 20 Hz
    this.schedule(() => {
      if (this.hide) this.endVerstecken();
    }, roundMs);
  }

  handleHideMove(playerId: string, dx: number, dy: number): void {
    if (this.phase === "minigame") this.hide?.setMove(playerId, dx, dy);
  }

  handleHideStab(playerId: string): void {
    if (this.phase === "minigame") this.hide?.stab(playerId);
  }

  private endVerstecken(): void {
    if (!this.hide) return;
    const round = this.hide;
    this.hide = null;
    this.clearTimers();

    const ranking = round.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const s = round.statsFor(id);
      let reward: number;
      let detail: string;
      if (s.role === "seeker") {
        reward = Math.min(4, 1 + s.catches);
        detail = `seeker · caught ${s.catches}`;
      } else if (s.survived) {
        reward = 3;
        detail = "survived!";
      } else {
        reward = 1;
        detail = `caught after ${(s.survivedMs / 1000).toFixed(0)}s`;
      }
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: rank === 0,
        detail,
      };
    });

    this.concludeMinigame({ type: "verstecken", ranking, rewards, scoreboard });
  }

  // --- battle royale ------------------------------------------------------

  private startBattle(): void {
    const players = this.connectedPlayers().map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
    }));
    this.phase = "minigame";
    this.currentMinigame = "battle";
    const roundMs = this.roundSecondsFor("battle") * 1000;
    this.battle = new BattleRound(players, roundMs);
    this.io.to(this.id).emit("minigame:start", { type: "battle" });
    const walls = this.battle.encodedWalls();
    for (const p of this.connectedPlayers()) {
      if (!p.socketId) continue;
      this.io.to(p.socketId).emit("battle:init", {
        cols: this.battle.arena.cols,
        rows: this.battle.arena.rows,
        walls,
        endsAt: this.battle.endsAt,
        self: this.battle.infoOf(p.id),
      });
    }
    let last = Date.now();
    this.interval = setInterval(() => {
      if (!this.battle) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.battle.tick(dt);
      for (const p of this.connectedPlayers()) {
        if (p.socketId) this.io.to(p.socketId).emit("battle:state", this.battle.stateFor(p.id));
      }
      if (this.battle.isComplete()) this.endBattle();
    }, 33); // 30 Hz
    this.schedule(() => {
      if (this.battle) this.endBattle();
    }, roundMs);
  }

  handleBattleMove(playerId: string, dx: number, dy: number): void {
    if (this.phase === "minigame") this.battle?.setMove(playerId, dx, dy);
  }

  handleBattleShoot(playerId: string, angle: number): void {
    if (this.phase === "minigame") this.battle?.shoot(playerId, angle);
  }

  private endBattle(): void {
    if (!this.battle) return;
    const round = this.battle;
    this.battle = null;
    this.clearTimers();

    const ranking = round.ranking();
    const rewards: Record<string, number> = {};
    const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
      const s = round.statsFor(id);
      const reward = rewardForRank(rank);
      rewards[id] = reward;
      const player = this.players.get(id);
      if (player) player.position = Math.min(player.position + reward, GAME_CONFIG.boardLength);
      return {
        playerId: id,
        nickname: player?.nickname ?? "?",
        color: player?.color ?? "#888",
        rank,
        reward,
        win: rank === 0 && s.survived,
        detail: s.survived ? "last one standing" : `#${s.placement} out`,
      };
    });

    this.concludeMinigame({ type: "battle", ranking, rewards, scoreboard });
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
    // intermission (the board race carries over). We deliberately do NOT return
    // to the lobby screen mid-match — the host only configures at the very start.
    this.phase = "intermission";
    this.resetReady();
    this.io.to(this.id).emit("minigame:ended", { result, lobby: this.toView() });
    this.schedule(() => {
      // Guard: a new round may already have been started from the ready vote.
      if (this.phase !== "intermission") return;
      if (this.settings.explanations) {
        // The explanation screen provides the ready-gate; roll straight into the
        // wheel so there aren't two consecutive ready votes.
        this.spinWheel();
      } else {
        // No explanation screen: the board's ready vote paces the next round.
        this.io.to(this.id).emit("intermission:start", { lobby: this.toView() });
      }
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
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  dispose(): void {
    this.clearTimers();
  }
}
