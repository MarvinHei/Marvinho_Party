import type { LetterState, WordleGuessResult } from "@marvinho/shared";
import { isValidWord, randomWord } from "./words.js";

/**
 * Pure Wordle scoring. Handles duplicate letters the standard way:
 * greens are consumed first, then yellows are matched against remaining
 * unmatched letters in the answer.
 */
export function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const states: LetterState[] = new Array(g.length).fill("absent");
  const remaining: Record<string, number> = {};

  // First pass: greens.
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      states[i] = "correct";
    } else {
      remaining[a[i]] = (remaining[a[i]] ?? 0) + 1;
    }
  }

  // Second pass: yellows from the leftover pool.
  for (let i = 0; i < g.length; i++) {
    if (states[i] === "correct") continue;
    const c = g[i];
    if (remaining[c] > 0) {
      states[i] = "present";
      remaining[c]--;
    }
  }

  return states;
}

export interface WordlePlayerState {
  guesses: WordleGuessResult[];
  solved: boolean;
  /** Order in which this player finished (solved or exhausted); null if active. */
  finishOrder: number | null;
  /** Wall-clock ms when the player finished; null while active. */
  finishedAt: number | null;
}

/**
 * Server-side state for one Wordle round shared by all players in a lobby.
 */
export class WordleRound {
  readonly answer: string;
  readonly maxGuesses: number;
  private players = new Map<string, WordlePlayerState>();
  private nextFinishOrder = 0;
  private readonly startTime = Date.now();

  constructor(playerIds: string[], maxGuesses: number, answer = randomWord()) {
    this.answer = answer;
    this.maxGuesses = maxGuesses;
    for (const id of playerIds) {
      this.players.set(id, {
        guesses: [],
        solved: false,
        finishOrder: null,
        finishedAt: null,
      });
    }
  }

  hasPlayer(id: string): boolean {
    return this.players.has(id);
  }

  private markFinished(state: WordlePlayerState): void {
    state.finishOrder = this.nextFinishOrder++;
    state.finishedAt = Date.now();
  }

  /**
   * Apply a guess for a player. Throws with a user-facing message on invalid
   * input so the caller can relay it via the ack.
   */
  guess(playerId: string, raw: string): { result: WordleGuessResult; solved: boolean } {
    const state = this.players.get(playerId);
    if (!state) throw new Error("You are not part of this round.");
    if (state.finishOrder !== null) throw new Error("You are already done.");

    const word = raw.trim().toLowerCase();
    if (word.length !== this.answer.length) {
      throw new Error(`Guess must be ${this.answer.length} letters.`);
    }
    if (!/^[a-z]+$/.test(word)) {
      throw new Error("Letters only, please.");
    }
    if (!isValidWord(word)) {
      throw new Error("Not in word list.");
    }

    const states = scoreGuess(word, this.answer);
    const result: WordleGuessResult = { guess: word, states };
    state.guesses.push(result);

    const solved = word === this.answer;
    if (solved) {
      state.solved = true;
      this.markFinished(state);
    } else if (state.guesses.length >= this.maxGuesses) {
      this.markFinished(state);
    }

    return { result, solved };
  }

  /** Force a single still-active player to finish (used on disconnect). */
  finishPlayer(id: string): void {
    const state = this.players.get(id);
    if (state && state.finishOrder === null) this.markFinished(state);
  }

  /** Force any still-active players to finish (used on timeout). */
  finishAll(): void {
    for (const state of this.players.values()) {
      if (state.finishOrder === null) this.markFinished(state);
    }
  }

  isComplete(): boolean {
    for (const state of this.players.values()) {
      if (state.finishOrder === null) return false;
    }
    return true;
  }

  getPlayerState(id: string): WordlePlayerState | undefined {
    return this.players.get(id);
  }

  private timeMs(state: WordlePlayerState): number {
    return (state.finishedAt ?? Date.now()) - this.startTime;
  }

  /**
   * Ranking (best first). Solvers always beat non-solvers. Among solvers the
   * fewest guesses wins; ties are broken by the time needed to solve.
   * Non-solvers are ordered by who lasted (finished) latest as a fallback.
   */
  ranking(): string[] {
    return [...this.players.entries()]
      .sort(([, a], [, b]) => {
        if (a.solved !== b.solved) return a.solved ? -1 : 1;
        if (a.solved && b.solved) {
          if (a.guesses.length !== b.guesses.length) {
            return a.guesses.length - b.guesses.length;
          }
          return this.timeMs(a) - this.timeMs(b);
        }
        return (a.finishOrder ?? 0) - (b.finishOrder ?? 0);
      })
      .map(([id]) => id);
  }

  standingsData(): Array<{ playerId: string; guessesUsed: number; solved: boolean }> {
    return [...this.players.entries()].map(([playerId, s]) => ({
      playerId,
      guessesUsed: s.guesses.length,
      solved: s.solved,
    }));
  }

  /** Per-player stats for the podium, keyed by id. */
  statsFor(id: string): { solved: boolean; guessesUsed: number; timeMs: number } {
    const s = this.players.get(id);
    if (!s) return { solved: false, guessesUsed: 0, timeMs: 0 };
    return { solved: s.solved, guessesUsed: s.guesses.length, timeMs: this.timeMs(s) };
  }
}
