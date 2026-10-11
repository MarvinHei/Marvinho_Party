import { WORDLE_CONFIG, rewardForRank, type WordleStanding } from "@marvinho/shared";
import { WordleRound } from "../minigames/wordle.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { obj, str } from "./validate.js";

export function createWordle(ctx: GameContext<"wordle">): Minigame<"wordle"> {
  const round = new WordleRound(ctx.roster.map((p) => p.id), WORDLE_CONFIG.maxGuesses, undefined, ctx.env);
  const seconds = ctx.roundSeconds();

  const init = () => ({
    wordLength: WORDLE_CONFIG.wordLength,
    maxGuesses: WORDLE_CONFIG.maxGuesses,
    roundSeconds: seconds,
    endsAt: ctx.timer.endsAt,
  });

  const standings = (): WordleStanding[] => {
    const ranking = round.ranking();
    return round.standingsData().map((s) => {
      const p = ctx.player(s.playerId);
      const done = round.getPlayerState(s.playerId)?.finishOrder != null;
      return {
        playerId: s.playerId,
        nickname: p?.nickname ?? "?",
        color: p?.color ?? "#888",
        guessesUsed: s.guessesUsed,
        solved: s.solved,
        rank: done ? ranking.indexOf(s.playerId) : null,
      };
    });
  };

  const end = () => {
    const result = rankedResult(ctx, round.ranking(), (id, rank) => {
      const s = round.statsFor(id);
      return {
        // Only players who solved the word advance.
        reward: s.solved ? rewardForRank(rank) : 0,
        win: rank === 0 && s.solved,
        detail: s.solved
          ? `${s.guessesUsed} ${s.guessesUsed === 1 ? "guess" : "guesses"} · ${(s.timeMs / 1000).toFixed(1)}s`
          : "did not solve",
      };
    });
    ctx.finish({ ...result, reveal: round.answer });
  };

  const maybeEnd = () => {
    if (round.isComplete()) end();
  };

  return {
    start() {
      ctx.timer.arm(seconds, () => {
        round.finishAll();
        end();
      });
      ctx.emit("init", init());
      ctx.emit("standings", standings());
    },
    sync(playerId) {
      ctx.emitTo(playerId, "init", init());
      ctx.emitTo(playerId, "standings", standings());
    },
    removePlayer(playerId) {
      round.finishPlayer(playerId);
      ctx.emit("standings", standings());
      maybeEnd();
    },
    inputs: {
      guess(playerId, payload) {
        const guess = str(obj(payload).guess, 32);
        const outcome = round.guess(playerId, guess);
        ctx.emit("standings", standings());
        // Every solve pulls the shared clock in.
        if (outcome.solved) ctx.timer.shrink();
        maybeEnd();
        return outcome;
      },
    },
  };
}
