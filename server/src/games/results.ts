import type { MinigameResult, MinigameType, ScoreRow, TeamScore } from "@marvinho/shared";
import type { GameContext } from "./types.js";

type RankedResult = Pick<MinigameResult, "ranking" | "rewards" | "scoreboard">;

/** How one player fared, for their scoreboard row. */
export interface RowOutcome {
  reward: number;
  win: boolean;
  detail: string;
}

/** Build an individual (non-team) result from a best-first ranking. */
export function rankedResult(
  ctx: GameContext<MinigameType>,
  ranking: string[],
  outcome: (id: string, rank: number) => RowOutcome,
): RankedResult {
  const rewards: Record<string, number> = {};
  const scoreboard: ScoreRow[] = ranking.map((id, rank) => {
    const o = outcome(id, rank);
    rewards[id] = o.reward;
    const p = ctx.player(id);
    return {
      playerId: id,
      nickname: p?.nickname ?? "?",
      color: p?.color ?? "#888",
      rank,
      reward: o.reward,
      win: o.win,
      detail: o.detail,
    };
  });
  return { ranking, rewards, scoreboard };
}

interface RankedTeam {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

/**
 * Build a team result from best-first teams: the top three teams' members get
 * 3/2/1 tiles, any team beyond 3rd gets 0.
 */
export function teamResult(
  ctx: GameContext<MinigameType>,
  teams: RankedTeam[],
  detailFor: (teamRank: number, team: RankedTeam) => string,
): RankedResult & { teams: TeamScore[] } {
  const ranking: string[] = [];
  const rewards: Record<string, number> = {};
  const scoreboard: ScoreRow[] = [];
  const teamScores: TeamScore[] = [];
  teams.forEach((t, teamRank) => {
    const reward = Math.max(0, 3 - teamRank);
    const won = teamRank === 0;
    for (const id of t.memberIds) {
      ranking.push(id);
      rewards[id] = reward;
      const p = ctx.player(id);
      scoreboard.push({
        playerId: id,
        nickname: p?.nickname ?? "?",
        color: p?.color ?? "#888",
        rank: teamRank,
        reward,
        win: won,
        detail: `${t.name} · ${detailFor(teamRank, t)}`,
      });
    }
    teamScores.push({
      team: t.id,
      name: t.name,
      color: t.color,
      points: reward,
      won,
      members: t.memberIds.map((id) => ({ playerId: id, nickname: ctx.player(id)?.nickname ?? "?" })),
    });
  });
  return { ranking, rewards, scoreboard, teams: teamScores };
}
