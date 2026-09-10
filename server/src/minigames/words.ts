// Wordle word pools, sourced from the official Wordle word lists.
// The concrete data lives in wordleWordList.ts (auto-generated); this module
// keeps the small, stable API the rest of the server consumes.
import { WORDLE_ANSWERS, WORDLE_ALLOWED } from "./wordleWordList.js";

/** Answer pool = the canonical Wordle solution list. */
export const WORD_LIST: string[] = WORDLE_ANSWERS;

// Accepted guesses = the full Wordle valid-guess list (already includes every
// answer). Only exact 5-letter words are kept, so any stray entries are ignored.
const ACCEPTED = new Set(
  WORDLE_ALLOWED.map((w) => w.toLowerCase()).filter((w) => w.length === 5),
);

export function isValidWord(word: string): boolean {
  return ACCEPTED.has(word.toLowerCase());
}

// Answers are always drawn from the curated (common) answer list.
export function randomWord(): string {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}
