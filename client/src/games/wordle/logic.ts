import type { WordleGuessResult } from "@marvinho/shared";
import type { GameLogic } from "../state.js";
import type { WordleClientState } from "../types.js";

export const wordleLogic: GameLogic<"wordle"> = {
  centered: true,
  alwaysRender: true,
  reduce(state, event) {
    switch (event.kind) {
      case "init":
        return {
          wordLength: event.payload.wordLength,
          maxGuesses: event.payload.maxGuesses,
          endsAt: event.payload.endsAt,
          guesses: [],
          currentInput: "",
          solved: false,
          finished: false,
          message: null,
          standings: [],
        };
      case "standings":
        return state ? { ...state, standings: event.payload } : state;
    }
  },
  onTimer: (state, endsAt) => ({ ...state, endsAt }),
  onEnded: (state) => ({ ...state, finished: true }),
};

export const withInput = (s: WordleClientState, input: string): WordleClientState => ({
  ...s,
  currentInput: input,
  message: null,
});

export function withResult(s: WordleClientState, result: WordleGuessResult, solved: boolean): WordleClientState {
  const guesses = [...s.guesses, result];
  const finished = solved || guesses.length >= s.maxGuesses;
  return { ...s, guesses, currentInput: "", solved, finished, message: null };
}

export const withMessage = (s: WordleClientState, message: string): WordleClientState => ({ ...s, message });
