import { TEAM_STYLES, possibleTeamCounts } from "@marvinho/shared";
import { pick, shuffled, type Rng } from "../minigames/env.js";
import type { TeamSpec } from "../minigames/skribblTeams.js";

/** Split players into `k` equal, randomly-chosen teams (k picked at random). */
export function buildTeams(ids: string[], rng: Rng): TeamSpec[] {
  const order = shuffled(rng, ids);
  const counts = possibleTeamCounts(order.length);
  const k = (counts.length ? pick(rng, counts) : 2);
  const size = order.length / k;
  const teams: TeamSpec[] = [];
  for (let i = 0; i < k; i++) {
    const style = TEAM_STYLES[i % TEAM_STYLES.length];
    teams.push({
      id: `t${i}`,
      name: style.name,
      color: style.color,
      memberIds: order.slice(i * size, (i + 1) * size),
    });
  }
  return teams;
}
