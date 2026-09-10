import {
  FINDWORD_CONFIG,
  type FindWordEntry,
  type FindWordProgress,
  type FindWordView,
} from "@marvinho/shared";
import type { TeamSpec } from "./skribblTeams.js";

interface PlayerInfo {
  id: string;
  nickname: string;
  color: string;
}

function normalize(s: string): string {
  // Diacritic-insensitive so German words converge regardless of umlaut typing.
  return s
    .trim()
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** A submitted word: ≥ minWordLength letters (Latin + German umlauts). */
export function validWord(raw: string): boolean {
  const w = raw.trim();
  return w.length >= FINDWORD_CONFIG.minWordLength && /^[a-zA-Zäöüßáéíóúàèìòùâêîôû]+$/.test(w);
}

interface TeamState extends TeamSpec {
  roundIndex: number;
  roundStart: number;
  endsAt: number;
  /** Current attempt's submissions. */
  current: Map<string, string>;
  history: FindWordEntry[][];
  done: boolean;
  converged: boolean;
  attempts: number;
  convergedWord: string | null;
  finishTimeMs: number;
}

/**
 * Find the Word: teams try to converge. Each attempt every member secretly
 * writes a word (≥ 5 letters); when all have written, the words are revealed to
 * the team. If they all match, the team is done. Otherwise they try again,
 * seeing the history. Fewest attempts wins (ties broken by total time).
 */
export class FindWordGame {
  private teams: TeamState[];
  private info = new Map<string, PlayerInfo>();
  private teamOfPlayer = new Map<string, TeamState>();
  private gameStart = Date.now();

  constructor(teams: TeamSpec[], players: PlayerInfo[]) {
    const now = Date.now();
    this.teams = teams.map((t) => ({
      ...t,
      roundIndex: 0,
      roundStart: now,
      endsAt: now + FINDWORD_CONFIG.roundSeconds * 1000,
      current: new Map<string, string>(),
      history: [],
      done: false,
      converged: false,
      attempts: 0,
      convergedWord: null,
      finishTimeMs: 0,
    }));
    for (const p of players) this.info.set(p.id, p);
    for (const t of this.teams) {
      for (const id of t.memberIds) this.teamOfPlayer.set(id, t);
    }
  }

  isComplete(): boolean {
    return this.teams.every((t) => t.done);
  }

  /** Submit a word for the player's team's current attempt. */
  submit(playerId: string, raw: string): { accepted: boolean } {
    const team = this.teamOfPlayer.get(playerId);
    if (!team) throw new Error("Not in this game.");
    if (team.done) throw new Error("Your team is already done.");
    if (!validWord(raw)) {
      throw new Error(`Use at least ${FINDWORD_CONFIG.minWordLength} letters (letters only).`);
    }
    team.current.set(playerId, raw.trim());
    if (team.memberIds.every((id) => team.current.has(id))) {
      this.resolveRound(team);
    }
    return { accepted: true };
  }

  /** Resolve any team whose attempt deadline has passed. Returns true if any changed. */
  checkTimeouts(now: number): boolean {
    let changed = false;
    for (const t of this.teams) {
      if (!t.done && now >= t.endsAt) {
        // Auto-fill missing submissions so the attempt resolves and advances.
        for (const id of t.memberIds) if (!t.current.has(id)) t.current.set(id, "");
        this.resolveRound(t);
        changed = true;
      }
    }
    return changed;
  }

  private resolveRound(team: TeamState): void {
    const entries: FindWordEntry[] = team.memberIds.map((id) => {
      const p = this.info.get(id);
      const word = team.current.get(id) ?? "";
      return {
        playerId: id,
        nickname: p?.nickname ?? "?",
        color: p?.color ?? "#888",
        word: word || "—",
      };
    });
    team.history.push(entries);

    const words = team.memberIds.map((id) => normalize(team.current.get(id) ?? ""));
    const converged = words.every((w) => w.length > 0 && w === words[0]);

    team.attempts = team.roundIndex + 1;
    team.current = new Map();

    if (converged) {
      team.done = true;
      team.converged = true;
      team.convergedWord = entries[0].word;
      team.finishTimeMs = Date.now() - this.gameStart;
      return;
    }

    team.roundIndex++;
    if (team.roundIndex >= FINDWORD_CONFIG.maxRounds) {
      team.done = true;
      team.converged = false;
      team.finishTimeMs = Date.now() - this.gameStart;
      return;
    }
    team.roundStart = Date.now();
    team.endsAt = team.roundStart + FINDWORD_CONFIG.roundSeconds * 1000;
  }

  // --- views / results ----------------------------------------------------

  private rankedTeams(): TeamState[] {
    return [...this.teams].sort((a, b) => {
      if (a.converged !== b.converged) return a.converged ? -1 : 1;
      if (a.converged && b.converged) {
        return a.attempts - b.attempts || a.finishTimeMs - b.finishTimeMs;
      }
      return 0;
    });
  }

  ranking(): string[] {
    return this.rankedTeams().flatMap((t) => t.memberIds);
  }

  results(): {
    id: string;
    name: string;
    color: string;
    converged: boolean;
    attempts: number;
    convergedWord: string | null;
    memberIds: string[];
  }[] {
    return this.rankedTeams().map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      converged: t.converged,
      attempts: t.attempts,
      convergedWord: t.convergedWord,
      memberIds: t.memberIds,
    }));
  }

  private progress(): FindWordProgress[] {
    return this.rankedTeams().map((t) => ({
      teamId: t.id,
      name: t.name,
      color: t.color,
      attempts: t.done ? t.attempts : t.roundIndex + 1,
      done: t.done,
      memberIds: t.memberIds,
    }));
  }

  viewFor(playerId: string): FindWordView {
    const team = this.teamOfPlayer.get(playerId);
    if (!team) {
      return {
        phase: this.isComplete() ? "done" : "playing",
        round: 0,
        teamId: null,
        teamName: "?",
        teamColor: "#888",
        members: [],
        history: [],
        mySubmitted: false,
        myWord: null,
        waitingOn: [],
        finished: false,
        attempts: 0,
        convergedWord: null,
        minWordLength: FINDWORD_CONFIG.minWordLength,
        endsAt: null,
        teams: this.progress(),
      };
    }
    return {
      phase: team.done ? "done" : "playing",
      round: team.roundIndex + 1,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      members: team.memberIds.map((id) => {
        const p = this.info.get(id);
        return { id, nickname: p?.nickname ?? "?", color: p?.color ?? "#888" };
      }),
      history: team.history,
      mySubmitted: team.current.has(playerId),
      myWord: team.current.get(playerId) ?? null,
      waitingOn: team.memberIds.filter((id) => !team.current.has(id)),
      finished: team.done,
      attempts: team.done ? team.attempts : team.roundIndex + 1,
      convergedWord: team.convergedWord,
      minWordLength: FINDWORD_CONFIG.minWordLength,
      endsAt: team.done ? null : team.endsAt,
      teams: this.progress(),
    };
  }
}
