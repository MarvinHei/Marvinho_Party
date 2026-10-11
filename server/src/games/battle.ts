import { rewardForRank } from "@marvinho/shared";
import { BattleRound } from "../minigames/battle.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { num, obj } from "./validate.js";

export function createBattle(ctx: GameContext<"battle">): Minigame<"battle"> {
  const round = new BattleRound(ctx.roster, ctx.roundSeconds() * 1000, ctx.env);
  const walls = round.encodedWalls();

  const sendInit = (playerId: string) =>
    ctx.emitTo(playerId, "init", {
      cols: round.arena.cols,
      rows: round.arena.rows,
      walls,
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
        detail: s.survived ? "last one standing" : `#${s.placement} out`,
      };
    });
    ctx.finish(result);
  };

  return {
    start() {
      for (const id of ctx.connectedIds()) sendInit(id);
      // No timer: the free-for-all runs until one player is left standing.
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
        round.setMove(playerId, num(p.dx, -1, 1), num(p.dy, -1, 1));
      },
      shoot(playerId, payload) {
        round.shoot(playerId, num(obj(payload).angle));
      },
    },
  };
}
