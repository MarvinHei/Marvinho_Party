import { SKRIBBL_TEAMS_CONFIG } from "@marvinho/shared";
import { SkribblTeamsGame } from "../minigames/skribblTeams.js";
import { buildTeams } from "./draft.js";
import { teamResult } from "./results.js";
import { segment } from "./skribbl.js";
import type { GameContext, Minigame } from "./types.js";
import { obj, str } from "./validate.js";

export function createSkribblTeams(ctx: GameContext<"skribblteams">): Minigame<"skribblteams"> {
  const roundMs = ctx.roundSeconds() * 1000;
  const teams = ctx.draft.teams ?? buildTeams(ctx.roster.map((p) => p.id), ctx.env.random);
  const game = new SkribblTeamsGame(teams, ctx.roster, ctx.roundSeconds(), ctx.env);

  const broadcast = () => ctx.emitEach("state", (id) => game.viewFor(id));

  /** Send to the drawer's teammates (not the drawer, who drew it locally). */
  const toTeammates = (drawerId: string, send: (mateId: string) => void) => {
    const connected = new Set(ctx.connectedIds());
    for (const id of game.teammateIds(drawerId)) {
      if (id !== drawerId && connected.has(id)) send(id);
    }
  };

  const nextRound = () => {
    game.beginRound();
    ctx.emit("clear", null);
    broadcast();
    const hint = () => {
      if (game.revealHint()) broadcast();
    };
    ctx.schedule(hint, Math.round(roundMs * 0.34));
    ctx.schedule(hint, Math.round(roundMs * 0.67));
    ctx.schedule(finishRound, roundMs);
  };

  const finishRound = () => {
    ctx.cancelScheduled();
    game.endRound();
    broadcast();
    ctx.schedule(() => (game.hasNextRound() ? nextRound() : end()), SKRIBBL_TEAMS_CONFIG.betweenRoundsMs);
  };

  const end = () => {
    const results = game.results();
    const out = teamResult(ctx, results, (rank, t) => {
      const r = results.find((x) => x.id === t.id)!;
      return rank === 0 ? `${r.solvedCount} guessed · winners` : `${r.solvedCount} guessed`;
    });
    ctx.finish({ ...out, reveal: `${results[0]?.name ?? "?"} team wins!` });
  };

  return {
    start: nextRound,
    sync(playerId) {
      ctx.emitTo(playerId, "state", game.viewFor(playerId));
    },
    // If a drawer left, their team can't draw — the round timer resolves it.
    removePlayer: broadcast,
    inputs: {
      draw(playerId, payload) {
        if (!game.isDrawer(playerId) || game.currentPhase !== "drawing") return;
        const seg = segment(obj(payload).seg);
        toTeammates(playerId, (id) => ctx.emitTo(id, "draw", { seg }));
      },
      clear(playerId) {
        if (!game.isDrawer(playerId)) return;
        toTeammates(playerId, (id) => ctx.emitTo(id, "clear", null));
      },
      guess(playerId, payload) {
        const { correct, roundComplete, close } = game.guess(playerId, str(obj(payload).text, 100));
        broadcast();
        if (roundComplete) finishRound();
        return { correct, close };
      },
    },
  };
}
