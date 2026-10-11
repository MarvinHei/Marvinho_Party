import { HideRound } from "../minigames/verstecken.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { num, obj } from "./validate.js";

/** Hiders get a head start before the seeker is loosed, ms. */
const HOLD_MS = 12000;

export function createVerstecken(ctx: GameContext<"verstecken">): Minigame<"verstecken"> {
  // The round length scales with the lobby size: more hiders → a longer hunt.
  const hunterSeconds = 30 + Math.max(0, ctx.roster.length - 2) * 12;
  const roundMs = HOLD_MS + hunterSeconds * 1000;
  const round = new HideRound(ctx.roster, HOLD_MS, roundMs, ctx.env);
  const walls = round.encodedWalls();

  const sendInit = (playerId: string) =>
    ctx.emitTo(playerId, "init", {
      cols: round.arena.cols,
      rows: round.arena.rows,
      walls,
      role: round.roleOf(playerId),
      releaseAt: round.releaseAt,
      endsAt: round.endsAt,
      self: round.infoOf(playerId),
      appearances: ctx.looks(),
    });

  const end = () => {
    const ranking = round.ranking();
    const stats = new Map(ranking.map((id) => [id, round.statsFor(id)]));
    // If any hider makes it to the end, the hiders win: everyone but the seeker
    // gets 1 tile. If the seeker catches them all, the seeker takes 2 and the
    // hiders get nothing.
    const anySurvived = [...stats.values()].some((s) => s.role !== "seeker" && s.survived);
    const result = rankedResult(ctx, ranking, (id) => {
      const s = stats.get(id)!;
      if (s.role === "seeker") {
        return {
          reward: anySurvived ? 0 : 2,
          win: !anySurvived,
          detail: anySurvived ? `seeker · caught ${s.catches}` : `caught everyone! · ${s.catches}`,
        };
      }
      return {
        reward: anySurvived ? 1 : 0,
        win: anySurvived,
        detail: s.survived ? "survived!" : `caught after ${(s.survivedMs / 1000).toFixed(0)}s`,
      };
    });
    ctx.finish(result);
  };

  return {
    start() {
      for (const id of ctx.connectedIds()) sendInit(id);
      ctx.loop(50, (dt) => {
        round.tick(dt);
        ctx.emitEach("state", (id) => round.stateFor(id));
        if (round.isComplete()) end();
      });
      // Hide n' Seek keeps its timer: if any hider survives to the buzzer, the
      // hiders win — so the round must be able to end on time.
      ctx.schedule(end, roundMs);
    },
    sync: sendInit,
    inputs: {
      move(playerId, payload) {
        const p = obj(payload);
        round.setMove(playerId, num(p.dx, -1, 1), num(p.dy, -1, 1));
      },
      stab(playerId) {
        round.stab(playerId);
      },
      teleport(playerId, payload) {
        const p = obj(payload);
        round.teleport(playerId, num(p.x), num(p.y));
      },
      aim(playerId, payload) {
        round.setAim(playerId, num(obj(payload).angle));
      },
    },
  };
}
