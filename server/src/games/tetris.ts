import { TETRIS_CONFIG, rewardForRank } from "@marvinho/shared";
import { TetrisMatch } from "../minigames/tetris.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { int, obj, str } from "./validate.js";

/** Lead time before the pieces start falling, ms. */
const START_DELAY_MS = 1200;
const RESYNC_DELAY_MS = 600;

export function createTetris(ctx: GameContext<"tetris">): Minigame<"tetris"> {
  const match = new TetrisMatch(ctx.roster, ctx.env);

  const init = (startsAt: number) => ({
    players: match.players(),
    seed: match.seed,
    startsAt,
    rows: ctx.settings.tetrisRows,
    cols: TETRIS_CONFIG.cols,
  });
  const roster = () => ({ alive: match.aliveIds(), kos: match.koIds() });

  const end = () => {
    const result = rankedResult(ctx, match.ranking(), (id, rank) => ({
      reward: rewardForRank(rank),
      win: rank === 0,
      detail: `${match.linesFor(id)} lines · ${match.isAlive(id) ? "survived" : "KO'd"}`,
    }));
    ctx.finish(result);
  };

  const kill = (playerId: string) => {
    if (!match.kill(playerId)) return;
    ctx.emit("players", roster());
    if (match.isOver()) end();
  };

  return {
    start() {
      ctx.emit("init", init(ctx.env.now() + START_DELAY_MS));
      ctx.emit("players", roster());
      // Hard time cap.
      ctx.schedule(end, ctx.roundSeconds() * 1000);
    },
    sync(playerId) {
      ctx.emitTo(playerId, "init", init(ctx.env.now() + RESYNC_DELAY_MS));
      ctx.emitTo(playerId, "players", roster());
    },
    removePlayer: kill,
    inputs: {
      board(playerId, payload) {
        const p = obj(payload);
        match.updateBoard(playerId, str(p.cells, 4096), int(p.lines, 0));
        // Relay to everyone else for the spectator mini-views.
        ctx.emitExcept(playerId, "board", match.snapshotFor(playerId));
      },
      lines(playerId, payload) {
        const route = match.routeLines(playerId, int(obj(payload).lines, 0, 40));
        if (route) ctx.emitTo(route.recipientId, "garbage", { rows: route.rows, hole: route.hole });
      },
      target(playerId, payload) {
        match.setTarget(playerId, str(obj(payload).targetId, 64));
      },
      dead: kill,
    },
  };
}
