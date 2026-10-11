import { describe, expect, it } from "vitest";
import {
  MINIGAME_RULES,
  PUZZLE_GAME_LIST,
  validatePuzzle,
  type MinigameType,
  type PuzzleDifficulty,
} from "@marvinho/shared";
import { generatePuzzle } from "../src/minigames/puzzleGen.js";
import { WordleRound, scoreGuess } from "../src/minigames/wordle.js";
import { rankedResult, teamResult } from "../src/games/results.js";
import { MINIGAMES } from "../src/games/registry.js";
import type { GameContext } from "../src/games/types.js";
import { int, intArray, num, obj, str } from "../src/games/validate.js";

describe("puzzle generation", () => {
  const difficulties: PuzzleDifficulty[] = ["easy", "medium", "hard"];
  for (const game of PUZZLE_GAME_LIST) {
    for (const d of difficulties) {
      it(`${game} (${d}) is always solvable by its own solution`, () => {
        for (let i = 0; i < 5; i++) {
          const { spec, solution } = generatePuzzle(game, d);
          expect(validatePuzzle(spec, solution)).toBe(true);
        }
      });
    }
  }
});

describe("wordle scoring", () => {
  it("marks greens before yellows with duplicate letters", () => {
    expect(scoreGuess("speed", "abide")).toEqual(["absent", "absent", "present", "absent", "present"]);
    expect(scoreGuess("allee", "eagle")).toEqual(["present", "present", "absent", "present", "correct"]);
  });

  it("ranks solvers by guesses, then time", () => {
    const round = new WordleRound(["a", "b"], 6, "crane");
    round.guess("b", "slate");
    round.guess("b", "crane");
    round.guess("a", "crane");
    expect(round.ranking()).toEqual(["a", "b"]);
  });
});

/** Just enough context for the result helpers. */
const ctx = {
  player: (id: string) => ({ id, nickname: id.toUpperCase(), color: "#fff" }),
} as unknown as GameContext;

describe("result helpers", () => {
  it("builds rewards and rows from a ranking", () => {
    const r = rankedResult(ctx, ["x", "y"], (_id, rank) => ({ reward: 3 - rank, win: rank === 0, detail: "d" }));
    expect(r.rewards).toEqual({ x: 3, y: 2 });
    expect(r.scoreboard.map((s) => [s.nickname, s.rank, s.win])).toEqual([
      ["X", 0, true],
      ["Y", 1, false],
    ]);
  });

  it("gives team members 3/2/1/0 by team place", () => {
    const teams = ["t0", "t1", "t2", "t3"].map((id, i) => ({ id, name: id, color: "#000", memberIds: [`m${i}`] }));
    const r = teamResult(ctx, teams, () => "");
    expect(r.rewards).toEqual({ m0: 3, m1: 2, m2: 1, m3: 0 });
    expect(r.teams.map((t) => t.won)).toEqual([true, false, false, false]);
  });
});

describe("input validation", () => {
  it("accepts well-formed values and clamps numbers", () => {
    expect(num(5, -1, 1)).toBe(1);
    expect(int(3, 0, 5)).toBe(3);
    expect(str("hi", 5)).toBe("hi");
    expect(intArray([1, 2], 4)).toEqual([1, 2]);
  });

  it("rejects malformed values", () => {
    expect(() => obj(null)).toThrow();
    expect(() => obj([1])).toThrow();
    expect(() => num(NaN)).toThrow();
    expect(() => num("1")).toThrow();
    expect(() => int(1.5)).toThrow();
    expect(() => str("toolong", 3)).toThrow();
    expect(() => intArray([1, "x"], 4)).toThrow();
    expect(() => intArray([1, 2, 3], 2)).toThrow();
  });
});

describe("registry", () => {
  it("has a server game and player rules for every minigame", () => {
    for (const g of Object.keys(MINIGAME_RULES) as MinigameType[]) {
      expect(typeof MINIGAMES[g]).toBe("function");
      expect(MINIGAME_RULES[g].playable(MINIGAME_RULES[g].minPlayers)).toBe(true);
    }
  });
});
