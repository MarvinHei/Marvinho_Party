import { FindWordGame } from "../minigames/findword.js";
import { buildTeams } from "./draft.js";
import { teamResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { obj, str } from "./validate.js";

export function createFindword(ctx: GameContext<"findword">): Minigame<"findword"> {
  const teams = ctx.draft.teams ?? buildTeams(ctx.roster.map((p) => p.id), ctx.env.random);
  const game = new FindWordGame(teams, ctx.roster, ctx.roundSeconds(), ctx.env);

  const broadcast = () => ctx.emitEach("state", (id) => game.viewFor(id));

  const end = () => {
    const results = game.results();
    const out = teamResult(ctx, results, (rank, t) => {
      const r = results.find((x) => x.id === t.id)!;
      if (!r.converged) return "did not converge";
      const word = `"${(r.convergedWord ?? "").toUpperCase()}" in ${r.attempts}`;
      return rank === 0 ? `${word} · winners` : word;
    });
    ctx.finish({ ...out, reveal: `${results[0]?.name ?? "?"} team wins!` });
  };

  return {
    start() {
      broadcast();
      // Poll for per-team attempt deadlines.
      ctx.loop(1000, () => {
        if (game.checkTimeouts(ctx.env.now())) broadcast();
        if (game.isComplete()) end();
      });
    },
    sync(playerId) {
      ctx.emitTo(playerId, "state", game.viewFor(playerId));
    },
    // A missing member is auto-filled at the attempt deadline (checkTimeouts).
    removePlayer: broadcast,
    inputs: {
      submit(playerId, payload) {
        const res = game.submit(playerId, str(obj(payload).word, 40));
        broadcast();
        if (game.isComplete()) end();
        return res;
      },
    },
  };
}
