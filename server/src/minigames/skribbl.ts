import {
  SKRIBBL_CONFIG,
  type SkribblChatMessage,
  type SkribblScore,
  type SkribblView,
} from "@marvinho/shared";
import { pickWord } from "./skribblWords.js";

interface PlayerInfo {
  id: string;
  nickname: string;
  color: string;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
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

/**
 * A Skribbl minigame: each player draws exactly once (a "turn"). Guessers score
 * points that scale with how much time is left when they guess, so the gap
 * between a fast and a slow guess reflects the real time difference. The drawer
 * scores based on how many players guessed the word.
 */
export class SkribblGame {
  private order: string[];
  private info = new Map<string, PlayerInfo>();
  private scores = new Map<string, number>();
  private chat: SkribblChatMessage[] = [];
  private chatSeq = 0;

  private turnIndex = -1;
  private drawerId = "";
  private word = "";
  private wordStart = 0;
  private endsAt = 0;
  private phase: "drawing" | "turnEnd" = "drawing";
  private reveal: string | null = null;
  private correct = new Map<string, { timeMs: number; points: number }>();
  private revealedLetters = new Set<number>();

  constructor(players: PlayerInfo[]) {
    this.order = shuffle(players.map((p) => p.id));
    for (const p of players) {
      this.info.set(p.id, p);
      this.scores.set(p.id, 0);
    }
  }

  get currentDrawer(): string {
    return this.drawerId;
  }
  get currentPhase(): "drawing" | "turnEnd" {
    return this.phase;
  }
  get roundEndsAt(): number {
    return this.endsAt;
  }
  get totalTurns(): number {
    return this.order.length;
  }
  hasNextTurn(): boolean {
    return this.turnIndex < this.order.length - 1;
  }

  private guesserCount(): number {
    return Math.max(0, this.order.length - 1);
  }

  private pushChat(msg: Omit<SkribblChatMessage, "id">): void {
    this.chat.push({ id: this.chatSeq++, ...msg });
    if (this.chat.length > SKRIBBL_CONFIG.chatLimit) this.chat.shift();
  }

  // --- turns --------------------------------------------------------------

  beginTurn(): void {
    this.turnIndex++;
    this.drawerId = this.order[this.turnIndex];
    this.word = pickWord();
    this.wordStart = Date.now();
    this.endsAt = this.wordStart + SKRIBBL_CONFIG.roundSeconds * 1000;
    this.phase = "drawing";
    this.reveal = null;
    this.correct.clear();
    this.revealedLetters.clear();
    const drawer = this.info.get(this.drawerId);
    this.pushChat({
      kind: "system",
      text: `Round ${this.turnIndex + 1}/${this.order.length} — ${drawer?.nickname ?? "?"} is drawing!`,
    });
  }

  /** Total letters we're willing to reveal as hints (never the last one). */
  private maxHints(): number {
    const letters = this.word.replace(/[\s-]/g, "").length;
    return Math.min(2, Math.max(0, letters - 1));
  }

  /** Reveal one more random letter as a hint. Returns true if one was revealed. */
  revealHint(): boolean {
    if (this.phase !== "drawing") return false;
    if (this.revealedLetters.size >= this.maxHints()) return false;
    const hidden: number[] = [];
    for (let i = 0; i < this.word.length; i++) {
      // Only real letters are hidden/revealed — spaces and hyphens show already.
      if (this.word[i] !== " " && this.word[i] !== "-" && !this.revealedLetters.has(i)) {
        hidden.push(i);
      }
    }
    if (hidden.length <= 1) return false; // always keep at least one hidden
    this.revealedLetters.add(hidden[Math.floor(Math.random() * hidden.length)]);
    return true;
  }

  /** Apply a guess. Returns correctness, whether the turn is done, and whether
   * the guess was a near miss (edit distance 1) for private feedback. */
  guess(
    playerId: string,
    raw: string,
  ): { correct: boolean; turnComplete: boolean; close: boolean } {
    if (this.phase !== "drawing") throw new Error("Not guessing right now.");
    if (playerId === this.drawerId) throw new Error("You are drawing!");
    if (!this.info.has(playerId)) throw new Error("Not in this game.");
    if (this.correct.has(playerId)) throw new Error("You already guessed it!");

    const player = this.info.get(playerId)!;
    const text = raw.trim().slice(0, 40);
    if (!text) return { correct: false, turnComplete: false, close: false };

    if (normalize(text) === normalize(this.word)) {
      const now = Date.now();
      const total = SKRIBBL_CONFIG.roundSeconds * 1000;
      const frac = Math.max(0, Math.min(1, (this.endsAt - now) / total));
      const points = Math.max(
        SKRIBBL_CONFIG.guessMinPoints,
        Math.round(SKRIBBL_CONFIG.guessMaxPoints * frac),
      );
      this.correct.set(playerId, { timeMs: now - this.wordStart, points });
      this.scores.set(playerId, (this.scores.get(playerId) ?? 0) + points);
      this.pushChat({
        kind: "correct",
        text: `${player.nickname} guessed the word! (+${points})`,
        nickname: player.nickname,
        color: player.color,
      });
      return { correct: true, turnComplete: this.correct.size >= this.guesserCount(), close: false };
    }

    // Wrong guess — shown to everyone in the chat like any other guess.
    this.pushChat({
      kind: "guess",
      text,
      nickname: player.nickname,
      color: player.color,
    });
    // A near miss (edit distance 1) is additionally flagged back to the guesser
    // only — nobody else is told it was close.
    const close = levenshtein(normalize(text), normalize(this.word)) === 1;
    return { correct: false, turnComplete: false, close };
  }

  /** End the current turn: award the drawer and reveal the word. */
  endTurn(): void {
    if (this.phase === "turnEnd") return;
    this.phase = "turnEnd";
    this.reveal = this.word;
    const g = this.guesserCount();
    const drawerPoints = g > 0 ? Math.round(SKRIBBL_CONFIG.drawMaxPoints * (this.correct.size / g)) : 0;
    if (drawerPoints > 0) {
      this.scores.set(this.drawerId, (this.scores.get(this.drawerId) ?? 0) + drawerPoints);
    }
    this.pushChat({
      kind: "system",
      text: `The word was "${this.word.toUpperCase()}" — ${this.correct.size}/${g} guessed it.`,
    });
  }

  // --- scores / views -----------------------------------------------------

  private maskedWord(): string {
    // Compact (no separators): spaces stay spaces, hyphens are always shown,
    // letters are "_" until revealed. The client spaces the glyphs out.
    return this.word
      .split("")
      .map((c, i) => {
        if (c === " ") return " ";
        if (c === "-") return "-";
        return this.revealedLetters.has(i) ? c.toUpperCase() : "_";
      })
      .join("");
  }

  private scoreList(): SkribblScore[] {
    return [...this.info.values()]
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        color: p.color,
        points: this.scores.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points);
  }

  /** Ranking (best first) for the final board reward. */
  ranking(): string[] {
    return this.scoreList().map((s) => s.playerId);
  }

  pointsFor(id: string): number {
    return this.scores.get(id) ?? 0;
  }

  viewFor(playerId: string): SkribblView {
    const isDrawer = playerId === this.drawerId;
    const drawer = this.info.get(this.drawerId);
    return {
      round: this.turnIndex + 1,
      totalRounds: this.order.length,
      drawerId: this.drawerId,
      drawerNickname: drawer?.nickname ?? "?",
      isDrawer,
      word: isDrawer ? this.word : null,
      maskedWord: this.maskedWord(),
      endsAt: this.endsAt,
      phase: this.phase,
      iGuessed: this.correct.has(playerId),
      correctIds: [...this.correct.keys()],
      chat: this.chat,
      scores: this.scoreList(),
      reveal: this.reveal,
    };
  }
}
