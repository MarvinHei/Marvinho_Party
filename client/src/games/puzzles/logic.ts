import type { GameLogic } from "../state.js";
import type { PuzzleClientState } from "../types.js";

/** Zip / Queens / Mini-Sudoku / Tango share one protocol and panel. */
export const PUZZLE_TYPES = ["zip", "queens", "sudoku", "tango"] as const;

export function puzzleLogic<G extends (typeof PUZZLE_TYPES)[number]>(): GameLogic<G> {
  return {
    reduce(state, event, seat) {
      if (event.kind === "init") {
        const p = event.payload as Omit<PuzzleClientState, "solvedByMe" | "standings">;
        return { ...p, solvedByMe: false, standings: [] };
      }
      if (!state) return state;
      const standings = event.payload as PuzzleClientState["standings"];
      const mine = standings.find((s) => s.playerId === seat.playerId);
      return { ...state, standings, solvedByMe: state.solvedByMe || !!mine?.solved };
    },
    onTimer: (state, endsAt) => ({ ...state, endsAt }),
  };
}

export const solved = (s: PuzzleClientState): PuzzleClientState => ({ ...s, solvedByMe: true });
