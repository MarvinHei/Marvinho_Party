import { rewardForRank } from "@marvinho/shared";
import { RunnerRound } from "../minigames/runner.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { bool, num, obj } from "./validate.js";

export function createRunner(ctx: GameContext<"runner">): Minigame<"runner"> {
  const round = new RunnerRound(ctx.roster, ctx.roundSeconds() * 1000, ctx.env);

  const sendInit = (playerId: string) =>
    ctx.emitTo(playerId, "init", {
      viewW: round.viewW,
      viewH: round.viewH,
      groundH: round.groundH,
      shockCooldownMs: round.shockCooldownMs,
      endsAt: round.endsAt,
      self: round.infoOf(playerId),
      appearances: ctx.looks(),
    });

  const end = () => {
    const result = rankedResult(ctx, round.ranking(), (id, rank) => {
      const s = round.statsFor(id);
      return {
        reward: rewardForRank(rank),
        win: rank === 0 && s.survived,
        detail: s.survived ? "reached the end" : `ran ${Math.round(s.distance)}m`,
      };
    });
    ctx.finish(result);
  };

  return {
    start() {
      for (const id of ctx.connectedIds()) sendInit(id);
      // No timer: the race runs until only one runner remains.
      ctx.loop(33, (dt) => {
        round.tick(dt);
        ctx.emitEach("state", (id) => round.stateFor(id));
        if (round.isComplete()) end();
      });
    },
    sync: sendInit,
    inputs: {
      move(playerId, payload) {
        const p = obj(payload);
        round.setMove(playerId, num(p.dir, -1, 1), bool(p.duck));
      },
      jump(playerId) {
        round.jump(playerId);
      },
      shock(playerId) {
        round.shock(playerId);
      },
    },
  };
}
