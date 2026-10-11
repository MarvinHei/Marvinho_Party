import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../src/minigames/puzzleGen.js";
import { BattleRound } from "../src/minigames/battle.js";
import { PongRound } from "../src/minigames/pong.js";
import { RunnerRound } from "../src/minigames/runner.js";
import { seededRng, testEnv } from "../src/minigames/env.js";

const players = [
  { id: "a", nickname: "A", color: "#f00" },
  { id: "b", nickname: "B", color: "#00f" },
  { id: "c", nickname: "C", color: "#0f0" },
];

/** Run a real-time round for `steps` ticks on a seeded env and return its last snapshot. */
function simulate<R extends { tick(dt: number): void }>(
  make: (env: ReturnType<typeof testEnv>) => R,
  snapshot: (r: R) => unknown,
  seed: number,
  steps = 300,
) {
  const env = testEnv(seed);
  const round = make(env);
  for (let i = 0; i < steps; i++) {
    env.advance(33);
    round.tick(0.033);
  }
  return snapshot(round);
}

describe("seeded environments replay games exactly", () => {
  it("seededRng is reproducible and in [0, 1)", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRng(43)()).not.toBe(xs[0]);
  });

  it("puzzles", () => {
    for (const game of ["zip", "queens", "sudoku", "tango"] as const) {
      expect(generatePuzzle(game, "medium", seededRng(7))).toEqual(generatePuzzle(game, "medium", seededRng(7)));
    }
  });

  it("Pong", () => {
    const run = (seed: number) =>
      simulate((env) => new PongRound(players, 7, env), (r) => players.map((p) => r.stateFor(p.id)), seed);
    expect(run(1)).toEqual(run(1));
  });

  it("Battle Royale", () => {
    const run = (seed: number) =>
      simulate(
        (env) => {
          const r = new BattleRound(players, 60_000, env);
          r.setMove("a", 1, 0);
          r.shoot("b", 1.2);
          return r;
        },
        (r) => ({ walls: r.encodedWalls(), state: r.stateFor("a") }),
        seed,
      );
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  it("Runner Rush", () => {
    const run = (seed: number) =>
      simulate((env) => new RunnerRound(players, 60_000, env), (r) => r.stateFor("a"), seed, 600);
    expect(run(3)).toEqual(run(3));
  });
});
