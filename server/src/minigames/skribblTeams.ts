import {
  SKRIBBL_TEAMS_CONFIG,
  type SkribblChatMessage,
  type SkribblTeamProgress,
  type SkribblTeamsPhase,
  type SkribblTeamsView,
} from "@marvinho/shared";
import { pickWord } from "./skribblWords.js";

export interface TeamSpec {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

interface PlayerInfo {
  id: string;
  nickname: string;
  color: string;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Classic Levenshtein edit distance. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

interface TeamState extends TeamSpec {
  /** Rounds this team has guessed correctly. */
  solvedCount: number;
  /** Sum of solve times (ms) across solved rounds — tiebreak (lower wins). */
  totalTimeMs: number;
  /** Who guessed the current word. */
  correct: Set<string>;
  /** Set once this team guessed the current word. */
  solvedThisRound: boolean;
  chat: SkribblChatMessage[];
  chatSeq: number;
}

/**
 * Skribbl Teams: players are split into equal teams. Each round every team's
 * current drawer gets the SAME word and draws it for their own team only; the
 * team races to guess it. There are as many rounds as there are members per
 * team, so everyone draws exactly once. Teams are ranked by words guessed
 * (then by total guess time).
 */
export class SkribblTeamsGame {
  private teams: TeamState[];
  private info = new Map<string, PlayerInfo>();
  private teamOfPlayer = new Map<string, TeamState>();
  private teamSize: number;

  private roundIndex = -1;
  private word = "";
  private roundStart = 0;
  private endsAt = 0;
  private phase: SkribblTeamsPhase = "drawing";
  private reveal: string | null = null;
  private revealedLetters = new Set<number>();

  constructor(teams: TeamSpec[], players: PlayerInfo[]) {
    this.teamSize = teams[0]?.memberIds.length ?? 0;
    this.teams = teams.map((t) => ({
      ...t,
      solvedCount: 0,
      totalTimeMs: 0,
      correct: new Set<string>(),
      solvedThisRound: false,
      chat: [],
      chatSeq: 0,
    }));
    for (const p of players) this.info.set(p.id, p);
    for (const t of this.teams) {
      for (const id of t.memberIds) this.teamOfPlayer.set(id, t);
    }
  }

  get currentPhase(): SkribblTeamsPhase {
    return this.phase;
  }
  get totalRounds(): number {
    return this.teamSize;
  }
  hasNextRound(): boolean {
    return this.roundIndex < this.teamSize - 1;
  }

  teammateIds(playerId: string): string[] {
    const t = this.teamOfPlayer.get(playerId);
    return t ? t.memberIds : [];
  }

  /** Is this player the current drawer for their own team? */
  isDrawer(playerId: string): boolean {
    const t = this.teamOfPlayer.get(playerId);
    if (!t) return false;
    return t.memberIds[this.roundIndex] === playerId;
  }

  private pushChat(team: TeamState, msg: Omit<SkribblChatMessage, "id">): void {
    team.chat.push({ id: team.chatSeq++, ...msg });
    if (team.chat.length > SKRIBBL_TEAMS_CONFIG.chatLimit) team.chat.shift();
  }

  // --- rounds -------------------------------------------------------------

  beginRound(): void {
    this.roundIndex++;
    this.word = pickWord();
    this.roundStart = Date.now();
    this.endsAt = this.roundStart + SKRIBBL_TEAMS_CONFIG.roundSeconds * 1000;
    this.phase = "drawing";
    this.reveal = null;
    this.revealedLetters.clear();
    for (const t of this.teams) {
      t.correct.clear();
      t.solvedThisRound = false;
      const drawer = this.info.get(t.memberIds[this.roundIndex]);
      this.pushChat(t, {
        kind: "system",
        text: `Round ${this.roundIndex + 1}/${this.teamSize} — ${drawer?.nickname ?? "?"} is drawing!`,
      });
    }
  }

  private maxHints(): number {
    const letters = this.word.replace(/[\s-]/g, "").length;
    return Math.min(2, Math.max(0, letters - 1));
  }

  /** Reveal one more hint letter (shared across all teams). */
  revealHint(): boolean {
    if (this.phase !== "drawing") return false;
    if (this.revealedLetters.size >= this.maxHints()) return false;
    const hidden: number[] = [];
    for (let i = 0; i < this.word.length; i++) {
      if (this.word[i] !== " " && this.word[i] !== "-" && !this.revealedLetters.has(i)) {
        hidden.push(i);
      }
    }
    if (hidden.length <= 1) return false;
    this.revealedLetters.add(hidden[Math.floor(Math.random() * hidden.length)]);
    return true;
  }

  /** All teams have guessed this round — the round can end early. */
  allTeamsSolved(): boolean {
    return this.teams.every((t) => t.solvedThisRound);
  }

  guess(
    playerId: string,
    raw: string,
  ): { correct: boolean; roundComplete: boolean; close: boolean } {
    if (this.phase !== "drawing") throw new Error("Not guessing right now.");
    const team = this.teamOfPlayer.get(playerId);
    if (!team) throw new Error("Not in this game.");
    if (this.isDrawer(playerId)) throw new Error("You are drawing!");
    if (team.correct.has(playerId)) throw new Error("You already guessed it!");

    const player = this.info.get(playerId)!;
    const text = raw.trim().slice(0, 40);
    if (!text) return { correct: false, roundComplete: false, close: false };

    if (normalize(text) === normalize(this.word)) {
      const now = Date.now();
      team.correct.add(playerId);
      if (!team.solvedThisRound) {
        team.solvedThisRound = true;
        team.solvedCount++;
        team.totalTimeMs += now - this.roundStart;
      }
      this.pushChat(team, {
        kind: "correct",
        text: `${player.nickname} guessed it!`,
        nickname: player.nickname,
        color: player.color,
      });
      return { correct: true, roundComplete: this.allTeamsSolved(), close: false };
    }

    this.pushChat(team, {
      kind: "guess",
      text,
      nickname: player.nickname,
      color: player.color,
    });
    const close = levenshtein(normalize(text), normalize(this.word)) === 1;
    return { correct: false, roundComplete: false, close };
  }

  endRound(): void {
    if (this.phase === "roundEnd") return;
    this.phase = "roundEnd";
    this.reveal = this.word;
    for (const t of this.teams) {
      this.pushChat(t, {
        kind: "system",
        text: t.solvedThisRound
          ? `The word was "${this.word.toUpperCase()}" — guessed! ✅`
          : `Time! The word was "${this.word.toUpperCase()}".`,
      });
    }
  }

  finish(): void {
    this.phase = "done";
  }

  // --- views / results ----------------------------------------------------

  private maskedWord(): string {
    return this.word
      .split("")
      .map((c, i) => {
        if (c === " ") return " ";
        if (c === "-") return "-";
        return this.revealedLetters.has(i) ? c.toUpperCase() : "_";
      })
      .join("");
  }

  private progress(): SkribblTeamProgress[] {
    return this.rankedTeams().map((t) => ({
      teamId: t.id,
      name: t.name,
      color: t.color,
      solvedCount: t.solvedCount,
      solvedThisRound: t.solvedThisRound,
      memberIds: t.memberIds,
    }));
  }

  private rankedTeams(): TeamState[] {
    return [...this.teams].sort(
      (a, b) => b.solvedCount - a.solvedCount || a.totalTimeMs - b.totalTimeMs,
    );
  }

  /** Ranking (best first) across all players — winning team members first. */
  ranking(): string[] {
    return this.rankedTeams().flatMap((t) => t.memberIds);
  }

  results(): { id: string; name: string; color: string; solvedCount: number; totalTimeMs: number; memberIds: string[] }[] {
    return this.rankedTeams().map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      solvedCount: t.solvedCount,
      totalTimeMs: t.totalTimeMs,
      memberIds: t.memberIds,
    }));
  }

  viewFor(playerId: string): SkribblTeamsView {
    const team = this.teamOfPlayer.get(playerId);
    const drawerId = team ? team.memberIds[this.roundIndex] : "";
    const drawer = this.info.get(drawerId);
    const isDrawer = drawerId === playerId;
    return {
      round: this.roundIndex + 1,
      totalRounds: this.teamSize,
      phase: this.phase,
      endsAt: this.endsAt,
      teamId: team?.id ?? null,
      teamName: team?.name ?? "?",
      teamColor: team?.color ?? "#888",
      drawerId,
      drawerNickname: drawer?.nickname ?? "?",
      isDrawer,
      word: isDrawer ? this.word : null,
      maskedWord: this.maskedWord(),
      iGuessed: team?.correct.has(playerId) ?? false,
      correctIds: team ? [...team.correct] : [],
      chat: team?.chat ?? [],
      reveal: this.reveal,
      teams: this.progress(),
    };
  }
}
