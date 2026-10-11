import { rewardForRank, type PuzzleGame, type PuzzleStanding } from "@marvinho/shared";
import { PuzzleRound } from "../minigames/puzzleRound.js";
import { generatePuzzle } from "../minigames/puzzleGen.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { intArray, obj } from "./validate.js";

/** Zip / Queens / Mini-Sudoku / Tango: everyone races the same generated puzzle. */
export function createPuzzle<G extends PuzzleGame>(ctx: GameContext<G>): Minigame<G> {
  // The four puzzle games share one protocol; narrow the context to it once.
  const c = ctx as unknown as GameContext<PuzzleGame>;
  const game = ctx.type;
  const { spec } = generatePuzzle(game, ctx.settings.puzzleDifficulty[game], ctx.env.random);
  const round = new PuzzleRound(ctx.roster.map((p) => p.id), spec, ctx.env);
  const seconds = ctx.roundSeconds();

  const init = () => ({ game, spec, endsAt: c.timer.endsAt, roundSeconds: seconds });

  const standings = (): PuzzleStanding[] => {
    const ranking = round.ranking();
    return c.allPlayers().map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      color: p.color,
      solved: round.isSolved(p.id),
      rank: round.isSolved(p.id) ? ranking.indexOf(p.id) : null,
    }));
  };

  const end = () => {
    const result = rankedResult(c, round.ranking(), (id, rank) => {
      const s = round.statsFor(id);
      return {
        // Only players who actually solved the puzzle advance.
        reward: s.solved ? rewardForRank(rank) : 0,
        win: rank === 0 && s.solved,
        detail: s.solved ? `solved in ${(s.timeMs / 1000).toFixed(1)}s` : "did not solve",
      };
    });
    c.finish(result);
  };

  return {
    start() {
      c.timer.arm(seconds, () => {
        round.finishAll();
        end();
      });
      c.emit("init", init());
      c.emit("standings", standings());
    },
    sync(playerId) {
      c.emitTo(playerId, "init", init());
      c.emitTo(playerId, "standings", standings());
    },
    removePlayer(playerId) {
      round.finishPlayer(playerId);
      c.emit("standings", standings());
      if (round.isComplete()) end();
    },
    inputs: {
      submit(playerId: string, payload: unknown) {
        const res = round.submit(playerId, intArray(obj(payload).solution, 400));
        if (res.solved) {
          c.emit("standings", standings());
          c.timer.shrink();
          if (round.isComplete()) end();
        }
        return res;
      },
    } as Minigame<G>["inputs"],
  };
}
