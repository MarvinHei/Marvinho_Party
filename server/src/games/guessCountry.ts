import { GEO_COUNTRIES, WORLD_GEOMETRY, rewardForRank, type GeoStanding } from "@marvinho/shared";
import { pick } from "../minigames/env.js";
import { GuessCountryRound } from "../minigames/guessCountry.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { obj, str } from "./validate.js";

const MAX_TRIES = 8;

export function createGuessCountry(ctx: GameContext<"guesscountry">): Minigame<"guesscountry"> {
  const answer = pick(ctx.env.random, GEO_COUNTRIES);
  const round = new GuessCountryRound(ctx.roster.map((p) => p.id), answer, ctx.env);
  const seconds = ctx.roundSeconds();

  // The silhouette geometry only — never the country's code/name.
  const init = () => ({
    geometry: WORLD_GEOMETRY[answer.code],
    endsAt: ctx.timer.endsAt,
    roundSeconds: seconds,
    maxTries: MAX_TRIES,
  });

  const standings = (): GeoStanding[] => {
    const ranking = round.ranking();
    return ctx.allPlayers().map((p) => {
      const s = round.statsFor(p.id);
      return {
        playerId: p.id,
        nickname: p.nickname,
        color: p.color,
        solved: s.solved,
        tries: s.tries,
        rank: s.solved ? ranking.indexOf(p.id) : null,
      };
    });
  };

  const end = () => {
    const result = rankedResult(ctx, round.ranking(), (id, rank) => {
      const s = round.statsFor(id);
      return {
        // Only players who identified the country advance.
        reward: s.solved ? rewardForRank(rank) : 0,
        win: rank === 0 && s.solved,
        detail: s.solved ? `${s.tries} ${s.tries === 1 ? "try" : "tries"}` : "did not solve",
      };
    });
    ctx.finish({ ...result, reveal: round.answer.name });
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
      if (round.isComplete()) end();
    },
    inputs: {
      guess(playerId, payload) {
        const res = round.guess(playerId, str(obj(payload).name, 80));
        ctx.emit("standings", standings());
        if (res.guess.correct) ctx.timer.shrink();
        if (round.isComplete()) end();
        return res;
      },
    },
  };
}
