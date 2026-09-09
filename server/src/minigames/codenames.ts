import {
  CODENAMES_CONFIG,
  type CardColor,
  type CodenamesTeam,
  type CodenamesTurnPhase,
  type CodenamesView,
} from "@marvinho/shared";
import { pickWords } from "./codenamesWords.js";

interface TeamState {
  spymasterId: string | null;
  memberIds: string[];
  remaining: number;
}

function other(team: CodenamesTeam): CodenamesTeam {
  return team === "a" ? "b" : "a";
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * One turn-based Codenames round for two teams. Only spymasters ever receive
 * the key; everyone else sees the board and revealed cards.
 */
export class CodenamesRound {
  readonly words: string[];
  readonly key: CardColor[];
  readonly startingTeam: CodenamesTeam;
  private revealed: (CardColor | null)[];
  private teams: Record<CodenamesTeam, TeamState>;
  private turn: CodenamesTeam;
  private turnPhase: CodenamesTurnPhase = "clue";
  private clue: { word: string; count: number; guessesLeft: number } | null = null;
  private log: string[] = [];
  private winnerTeam: CodenamesTeam | null = null;

  constructor(teams: Record<CodenamesTeam, { spymasterId: string; memberIds: string[] }>) {
    const size = CODENAMES_CONFIG.gridSize;
    this.words = pickWords(size);
    this.startingTeam = Math.random() < 0.5 ? "a" : "b";
    const secondTeam = other(this.startingTeam);

    const colors: CardColor[] = [];
    for (let i = 0; i < CODENAMES_CONFIG.startingTeamCards; i++) colors.push(this.startingTeam);
    for (let i = 0; i < CODENAMES_CONFIG.otherTeamCards; i++) colors.push(secondTeam);
    for (let i = 0; i < CODENAMES_CONFIG.neutralCards; i++) colors.push("neutral");
    for (let i = 0; i < CODENAMES_CONFIG.assassinCards; i++) colors.push("assassin");
    this.key = shuffle(colors);
    this.revealed = new Array(size).fill(null);

    this.teams = {
      a: { ...teams.a, remaining: this.countColor("a") },
      b: { ...teams.b, remaining: this.countColor("b") },
    };
    this.turn = this.startingTeam;
    this.pushLog(`${this.teamName(this.startingTeam)} team goes first. Spymaster, give a clue!`);
  }

  private countColor(team: CodenamesTeam): number {
    return this.key.filter((c) => c === team).length;
  }

  private teamName(team: CodenamesTeam): string {
    return team === "a" ? "Red" : "Blue";
  }

  private pushLog(line: string): void {
    this.log.push(line);
    if (this.log.length > 10) this.log.shift();
  }

  private teamOf(playerId: string): CodenamesTeam | null {
    if (this.teams.a.memberIds.includes(playerId)) return "a";
    if (this.teams.b.memberIds.includes(playerId)) return "b";
    return null;
  }

  isSpymaster(playerId: string): boolean {
    return this.teams.a.spymasterId === playerId || this.teams.b.spymasterId === playerId;
  }

  // --- actions ------------------------------------------------------------

  giveClue(playerId: string, rawWord: string, count: number): void {
    if (this.winnerTeam) throw new Error("Round is over.");
    if (this.turnPhase !== "clue") throw new Error("A clue is already in play.");
    const team = this.teamOf(playerId);
    if (team !== this.turn) throw new Error("It's not your team's turn.");
    if (this.teams[team].spymasterId !== playerId) {
      throw new Error("Only the spymaster can give a clue.");
    }
    const word = rawWord.trim();
    if (!word || /\s/.test(word)) throw new Error("Clue must be a single word.");
    if (!Number.isInteger(count) || count < 1 || count > 9) {
      throw new Error("Clue number must be 1–9.");
    }
    this.clue = { word: word.toUpperCase(), count, guessesLeft: count + 1 };
    this.turnPhase = "guess";
    this.pushLog(`${this.teamName(team)} clue: ${word.toUpperCase()} (${count})`);
  }

  guess(playerId: string, index: number): void {
    if (this.winnerTeam) throw new Error("Round is over.");
    if (this.turnPhase !== "guess" || !this.clue) throw new Error("Wait for a clue.");
    const team = this.teamOf(playerId);
    if (team !== this.turn) throw new Error("It's not your team's turn.");
    // Spymasters don't guess unless they're the only member of their team.
    const soloTeam = this.teams[team].memberIds.length === 1;
    if (this.teams[team].spymasterId === playerId && !soloTeam) {
      throw new Error("The spymaster can't guess.");
    }
    if (index < 0 || index >= this.words.length) throw new Error("Bad card.");
    if (this.revealed[index]) throw new Error("Card already revealed.");

    const color = this.key[index];
    this.revealed[index] = color;
    const word = this.words[index];

    if (color === "assassin") {
      this.pushLog(`💀 ${this.teamName(team)} hit the ASSASSIN on ${word}!`);
      this.winnerTeam = other(team);
      return;
    }

    if (color === "a" || color === "b") {
      this.teams[color].remaining--;
      const mine = color === team;
      this.pushLog(
        `${this.teamName(team)} revealed ${word} — ${mine ? "correct!" : `it's ${this.teamName(color)}'s!`}`,
      );
      if (this.teams[color].remaining <= 0) {
        this.winnerTeam = color;
        return;
      }
      if (mine) {
        this.clue.guessesLeft--;
        if (this.clue.guessesLeft <= 0) this.endTurnInternal("out of guesses");
        return;
      }
      // Revealed the opponent's card: turn ends.
      this.endTurnInternal("wrong team");
      return;
    }

    // Neutral.
    this.pushLog(`${this.teamName(team)} revealed ${word} — bystander.`);
    this.endTurnInternal("bystander");
  }

  endTurn(playerId: string): void {
    if (this.winnerTeam) throw new Error("Round is over.");
    const team = this.teamOf(playerId);
    if (team !== this.turn) throw new Error("It's not your team's turn.");
    if (this.turnPhase !== "guess") throw new Error("Nothing to end yet.");
    this.endTurnInternal("passed");
  }

  private endTurnInternal(_reason: string): void {
    this.turn = other(this.turn);
    this.turnPhase = "clue";
    this.clue = null;
    this.pushLog(`${this.teamName(this.turn)} team's turn — spymaster, give a clue!`);
  }

  /** On timeout, the team with fewer remaining cards wins (tie → starting team). */
  finishByTimeout(): void {
    if (this.winnerTeam) return;
    if (this.teams.a.remaining < this.teams.b.remaining) this.winnerTeam = "a";
    else if (this.teams.b.remaining < this.teams.a.remaining) this.winnerTeam = "b";
    else this.winnerTeam = this.startingTeam;
    this.pushLog(`Time! ${this.teamName(this.winnerTeam)} team wins on cards.`);
  }

  isComplete(): boolean {
    return this.winnerTeam !== null;
  }

  get winner(): CodenamesTeam | null {
    return this.winnerTeam;
  }

  teamMembers(team: CodenamesTeam): string[] {
    return this.teams[team].memberIds;
  }

  // --- views --------------------------------------------------------------

  viewFor(playerId: string): CodenamesView {
    const myTeam = this.teamOf(playerId);
    const iAmSpymaster = this.isSpymaster(playerId);
    return {
      words: this.words,
      revealed: this.revealed,
      key: iAmSpymaster ? this.key : null,
      teams: {
        a: {
          team: "a",
          spymasterId: this.teams.a.spymasterId,
          memberIds: this.teams.a.memberIds,
          remaining: this.teams.a.remaining,
        },
        b: {
          team: "b",
          spymasterId: this.teams.b.spymasterId,
          memberIds: this.teams.b.memberIds,
          remaining: this.teams.b.remaining,
        },
      },
      startingTeam: this.startingTeam,
      turn: this.turn,
      turnPhase: this.turnPhase,
      clue: this.clue,
      myTeam,
      isSpymaster: iAmSpymaster,
      log: this.log,
      winner: this.winnerTeam,
    };
  }
}
