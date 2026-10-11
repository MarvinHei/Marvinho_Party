import type { CodenamesAssignment, CodenamesTeam, TeamScore } from "@marvinho/shared";
import { CodenamesRound } from "../minigames/codenames.js";
import { shuffled, type Rng } from "../minigames/env.js";
import { rankedResult } from "./results.js";
import type { GameContext, Minigame } from "./types.js";
import { int, obj, str } from "./validate.js";

const teamName = (t: CodenamesTeam) => (t === "a" ? "Red" : "Blue");
const teamColor = (t: CodenamesTeam) => (t === "a" ? "#e6394b" : "#3aa0ff");

/** Split players into Red/Blue halves, each led by its first member as spymaster. */
export function buildAssignment(ids: string[], rng: Rng): CodenamesAssignment {
  const order = shuffled(rng, ids);
  const half = Math.floor(order.length / 2);
  const a = order.slice(0, half);
  const b = order.slice(half);
  return {
    a: { spymasterId: a[0], memberIds: a },
    b: { spymasterId: b[0], memberIds: b },
  };
}

export function createCodenames(ctx: GameContext<"codenames">): Minigame<"codenames"> {
  // Practice skips the draft, so build teams on the fly.
  const assignment = ctx.draft.assignment ?? buildAssignment(ctx.roster.map((p) => p.id), ctx.env.random);
  const round = new CodenamesRound(assignment, ctx.settings.codenamesSize, ctx.env);

  const broadcast = () => ctx.emitEach("state", (id) => round.viewFor(id));

  const end = () => {
    const winTeam = round.winner ?? "a";
    const loseTeam: CodenamesTeam = winTeam === "a" ? "b" : "a";
    const winners = round.teamMembers(winTeam);
    const ranking = [...winners, ...round.teamMembers(loseTeam)];
    const result = rankedResult(ctx, ranking, (id) => {
      const isWinner = winners.includes(id);
      return {
        reward: isWinner ? 2 : 0,
        win: isWinner,
        detail: `${teamName(isWinner ? winTeam : loseTeam)} team · ${isWinner ? "won" : "lost"}`,
      };
    });
    const teams: TeamScore[] = (["a", "b"] as CodenamesTeam[]).map((t) => ({
      team: t,
      name: teamName(t),
      color: teamColor(t),
      points: t === winTeam ? 3 : 1,
      won: t === winTeam,
      members: round.teamMembers(t).map((id) => ({ playerId: id, nickname: ctx.player(id)?.nickname ?? "?" })),
    }));
    ctx.finish({ ...result, teams, reveal: `${teamName(winTeam)} team wins!` });
  };

  return {
    start() {
      broadcast();
      ctx.schedule(() => {
        round.finishByTimeout();
        broadcast();
        end();
      }, ctx.roundSeconds() * 1000);
    },
    sync(playerId) {
      ctx.emitTo(playerId, "state", round.viewFor(playerId));
    },
    removePlayer() {
      broadcast();
    },
    inputs: {
      clue(playerId, payload) {
        const p = obj(payload);
        round.giveClue(playerId, str(p.word, 40), int(p.count, 0, 25));
        broadcast();
        return null;
      },
      guess(playerId, payload) {
        round.guess(playerId, int(obj(payload).index, 0, 99));
        broadcast();
        if (round.isComplete()) end();
        return null;
      },
      endTurn(playerId) {
        round.endTurn(playerId);
        broadcast();
        return null;
      },
    },
  };
}
