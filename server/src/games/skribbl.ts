import { rewardForRank, type SkribblSegment } from "@marvinho/shared";
import { SkribblGame } from "../minigames/skribbl.js";
import { SOLVE_MIN_MS, SOLVE_SHRINK } from "./context.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { bool, num, obj, str } from "./validate.js";

/** Pause between turns (and before the results), ms. */
const TURN_GAP_MS = 5000;

/** Parse a drawn segment from the wire. */
export function segment(v: unknown): SkribblSegment {
  const s = obj(v);
  const seg: SkribblSegment = {
    x0: num(s.x0),
    y0: num(s.y0),
    x1: num(s.x1),
    y1: num(s.y1),
    color: str(s.color, 32),
    width: num(s.width, 0, 200),
  };
  if (s.fill !== undefined) seg.fill = bool(s.fill);
  return seg;
}

export function createSkribbl(ctx: GameContext<"skribbl">): Minigame<"skribbl"> {
  const turnMs = ctx.roundSeconds() * 1000;
  const game = new SkribblGame(ctx.roster, ctx.roundSeconds(), ctx.env);
  /** Cancels the running turn's finish timer (kept apart so a solve can pull it in). */
  let cancelTurnEnd: (() => void) | null = null;

  const broadcast = () => ctx.emitEach("state", (id) => game.viewFor(id));

  const armTurnEnd = (ms: number) => {
    cancelTurnEnd?.();
    cancelTurnEnd = ctx.schedule(() => {
      cancelTurnEnd = null;
      finishTurn();
    }, ms);
  };

  const nextTurn = () => {
    game.beginTurn();
    ctx.emit("clear", null);
    broadcast();
    // Reveal up to two hint letters across the turn (at ~1/3 and ~2/3).
    const hint = () => {
      if (game.revealHint()) broadcast();
    };
    ctx.schedule(hint, Math.round(turnMs * 0.34));
    ctx.schedule(hint, Math.round(turnMs * 0.67));
    armTurnEnd(turnMs);
  };

  const finishTurn = () => {
    ctx.cancelScheduled(); // the turn timer + hints (harmless if already fired)
    cancelTurnEnd = null;
    game.endTurn();
    broadcast();
    ctx.schedule(() => (game.hasNextTurn() ? nextTurn() : end()), TURN_GAP_MS);
  };

  const end = () => {
    const result = rankedResult(ctx, game.ranking(), (id, rank) => ({
      reward: rewardForRank(rank),
      win: rank === 0,
      detail: `${game.pointsFor(id)} pts`,
    }));
    ctx.finish(result);
  };

  const isDrawing = (playerId: string) =>
    game.currentDrawer === playerId && game.currentPhase === "drawing";

  return {
    start: nextTurn,
    sync(playerId) {
      ctx.emitTo(playerId, "state", game.viewFor(playerId));
    },
    removePlayer(playerId) {
      // The drawer left — end their turn and move on.
      if (game.currentDrawer === playerId) finishTurn();
      else broadcast();
    },
    inputs: {
      draw(playerId, payload) {
        if (!isDrawing(playerId)) return;
        // Relay to everyone except the drawer (who already drew it locally).
        ctx.emitExcept(playerId, "draw", { seg: segment(obj(payload).seg) });
      },
      clear(playerId) {
        if (game.currentDrawer !== playerId) return;
        ctx.emitExcept(playerId, "clear", null);
      },
      guess(playerId, payload) {
        const { correct, turnComplete, close } = game.guess(playerId, str(obj(payload).text, 100));
        // Each correct guess pulls the turn's clock in (unless the timer is off).
        if (correct && !turnComplete && ctx.settings.games.skribbl.timerEnabled && cancelTurnEnd) {
          const newEnd = game.shrinkTurn(SOLVE_SHRINK, SOLVE_MIN_MS);
          if (newEnd) armTurnEnd(Math.max(0, newEnd - ctx.env.now()));
        }
        broadcast();
        if (turnComplete) finishTurn();
        return { correct, close };
      },
    },
  };
}
