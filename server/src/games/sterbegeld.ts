import { rewardForRank } from "@marvinho/shared";
import { SterbegeldRound } from "../minigames/sterbegeld.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { num, obj } from "./validate.js";

export function createSterbegeld(ctx: GameContext<"sterbegeld">): Minigame<"sterbegeld"> {
  const round = new SterbegeldRound(ctx.roster, ctx.env);
  const players = ctx.roster.map((p) => ({ id: p.id, name: p.nickname, color: p.color }));

  const sendInit = (playerId: string) =>
    ctx.emitTo(playerId, "init", { players, appearances: ctx.looks(), self: round.infoOf(playerId) });

  const end = () => {
    const result = rankedResult(ctx, round.ranking(), (id, rank) => {
      const s = round.statsFor(id);
      return {
        reward: rewardForRank(rank),
        win: rank === 0,
        detail: `${s.total.toLocaleString()} pts · ${s.delaScore.toLocaleString()} + ${s.waitScore.toLocaleString()}`,
      };
    });
    ctx.finish(result);
  };

  return {
    start() {
      for (const id of ctx.connectedIds()) sendInit(id);
      // No timer: the round runs until everyone has been eliminated in both acts.
      ctx.loop(33, (dt) => {
        round.tick(dt);
        // Split-screen: everyone sees the same full state (all POVs).
        ctx.emit("state", round.state());
        if (round.isComplete()) end();
      });
    },
    sync: sendInit,
    removePlayer(playerId) {
      round.finishPlayer(playerId);
      if (round.isComplete()) end();
    },
    inputs: {
      sign(playerId) {
        round.sign(playerId);
      },
      move(playerId, payload) {
        round.setMove(playerId, num(obj(payload).dir, -1, 1));
      },
    },
  };
}
