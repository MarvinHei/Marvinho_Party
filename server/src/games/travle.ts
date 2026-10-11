import {
  borderableCountries,
  countryByCode,
  rewardForRank,
  shortestCountryPath,
  type TravleStanding,
} from "@marvinho/shared";
import { pick as pickOne, type Rng } from "../minigames/env.js";
import { TravleRound } from "../minigames/travle.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { obj, str } from "./validate.js";

function pickTravlePair(rng: Rng): { start: string; end: string } {
  const pool = borderableCountries();
  const pick = () => pickOne(rng, pool).code;
  for (let attempt = 0; attempt < 60; attempt++) {
    const start = pick();
    const end = pick();
    if (start === end) continue;
    const path = shortestCountryPath(start, end);
    // 4–6 nodes → 2–4 countries to name in between: a good puzzle length.
    if (path && path.length >= 4 && path.length <= 6) return { start, end };
  }
  // Fallback: any connected pair.
  for (let attempt = 0; attempt < 60; attempt++) {
    const start = pick();
    const end = pick();
    if (start !== end && shortestCountryPath(start, end)) return { start, end };
  }
  return { start: "FRA", end: "POL" };
}

export function createTravle(ctx: GameContext<"travle">): Minigame<"travle"> {
  const { start, end: endCode } = pickTravlePair(ctx.env.random);
  const round = new TravleRound(ctx.roster.map((p) => p.id), start, endCode, ctx.env);
  const seconds = ctx.roundSeconds();

  const init = () => ({ startCode: start, endCode, endsAt: ctx.timer.endsAt, roundSeconds: seconds });

  const standings = (): TravleStanding[] => {
    const ranking = round.ranking();
    return ctx.allPlayers().map((p) => {
      const s = round.statsFor(p.id);
      return {
        playerId: p.id,
        nickname: p.nickname,
        color: p.color,
        connected: s.connected,
        count: s.count,
        rank: s.connected ? ranking.indexOf(p.id) : null,
      };
    });
  };

  const end = () => {
    const startName = countryByCode(round.startCode)?.name ?? round.startCode;
    const endName = countryByCode(round.endCode)?.name ?? round.endCode;
    const result = rankedResult(ctx, round.ranking(), (id, rank) => {
      const s = round.statsFor(id);
      return {
        // Only players who connected the two countries advance.
        reward: s.connected ? rewardForRank(rank) : 0,
        win: rank === 0 && s.connected,
        detail: s.connected ? `connected with ${s.count}` : `${s.count} named · no link`,
      };
    });
    ctx.finish({ ...result, reveal: `${startName} → ${endName}` });
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
        if (res.connected) ctx.timer.shrink();
        if (round.isComplete()) end();
        return res;
      },
    },
  };
}
