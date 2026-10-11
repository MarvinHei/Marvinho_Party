import { PongRound } from "../minigames/pong.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { num, obj } from "./validate.js";

export function createPong(ctx: GameContext<"pong">): Minigame<"pong"> {
  const target = ctx.settings.pongPoints;
  const round = new PongRound(ctx.roster, target, ctx.env);

  // Which paddle this player controls and who they're up against.
  const sendInit = (playerId: string) => {
    const init = round.initFor(playerId);
    if (!init) return;
    ctx.emitTo(playerId, "init", {
      side: init.side,
      target,
      self: { name: init.self.name, color: init.self.color },
      opponent: { name: init.opponent.name, color: init.opponent.color },
      vsCpu: init.vsCpu,
    });
  };

  const end = () => {
    const result = rankedResult(ctx, round.ranking(), (id) => {
      const s = round.statsFor(id);
      // Winners take 2 tiles, losers none.
      return {
        reward: s.won ? 2 : 0,
        win: s.won,
        detail: `${s.won ? "won" : "lost"} ${s.scored}–${s.conceded}${s.vsCpu ? " · vs CPU" : ""}`,
      };
    });
    ctx.finish(result);
  };

  return {
    start() {
      for (const id of ctx.connectedIds()) sendInit(id);
      // No timer: matches run until every duel has reached the target score.
      ctx.loop(33, (dt) => {
        round.tick(dt);
        ctx.emitEach("state", (id) => round.stateFor(id));
        if (round.isComplete()) end();
      });
    },
    sync: sendInit,
    inputs: {
      move(playerId, payload) {
        round.setPaddle(playerId, num(obj(payload).y, 0, 1));
      },
    },
  };
}
