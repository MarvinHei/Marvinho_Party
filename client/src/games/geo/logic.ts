import type { GuessCountryGuess } from "@marvinho/shared";
import type { GameLogic } from "../state.js";
import type { GuessCountryClientState, TravleClientState } from "../types.js";

export const guessCountryLogic: GameLogic<"guesscountry"> = {
  reduce(state, event) {
    if (event.kind === "init") return { ...event.payload, guesses: [], solved: false, standings: [] };
    return state ? { ...state, standings: event.payload } : state;
  },
  onTimer: (state, endsAt) => ({ ...state, endsAt }),
};

export const withCountryGuess = (s: GuessCountryClientState, guess: GuessCountryGuess): GuessCountryClientState => ({
  ...s,
  guesses: [...s.guesses, guess],
  solved: s.solved || guess.correct,
});

export const travleLogic: GameLogic<"travle"> = {
  reduce(state, event) {
    if (event.kind === "init") return { ...event.payload, named: [], connected: false, standings: [] };
    return state ? { ...state, standings: event.payload } : state;
  },
  onTimer: (state, endsAt) => ({ ...state, endsAt }),
};

export const withTravleNamed = (
  s: TravleClientState,
  entry: { code: string; name: string; connected: boolean },
): TravleClientState => ({ ...s, named: [...s.named, entry], connected: s.connected || entry.connected });
