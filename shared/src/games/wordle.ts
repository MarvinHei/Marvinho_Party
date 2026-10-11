// Wordle Race.

/** One row of Wordle feedback. */
export type LetterState = "correct" | "present" | "absent";

export interface WordleGuessResult {
  guess: string;
  states: LetterState[];
}

/** Per-player public standing during a Wordle round (no letters leaked). */
export interface WordleStanding {
  playerId: string;
  nickname: string;
  color: string;
  guessesUsed: number;
  solved: boolean;
  /** Finishing rank once solved/done, else null. */
  rank: number | null;
}

/** Sent to a client when a Wordle round begins. */
export interface WordleStartPayload {
  wordLength: number;
  maxGuesses: number;
  roundSeconds: number;
  /** Server clock (ms epoch) at which the round ends. */
  endsAt: number;
}
