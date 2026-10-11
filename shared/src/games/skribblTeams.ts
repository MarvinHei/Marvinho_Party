// Skribbl Teams (team draw-and-guess race).

import type { SkribblChatMessage } from "./skribbl.js";

export type SkribblTeamsPhase = "drawing" | "roundEnd" | "done";

/** Live standing of one team during a Skribbl Teams match. */
export interface SkribblTeamProgress {
  teamId: string;
  name: string;
  color: string;
  /** Words this team has guessed correctly so far. */
  solvedCount: number;
  /** Has this team already guessed the current round's word? */
  solvedThisRound: boolean;
  memberIds: string[];
}

/** Per-player Skribbl Teams view (scoped to the viewer's own team). */
export interface SkribblTeamsView {
  round: number;
  totalRounds: number;
  phase: SkribblTeamsPhase;
  endsAt: number;
  /** The viewer's team, or null if they have none. */
  teamId: string | null;
  teamName: string;
  teamColor: string;
  /** The viewer's team's drawer this round. */
  drawerId: string;
  drawerNickname: string;
  isDrawer: boolean;
  /** The word — only for the viewer's own team drawer. */
  word: string | null;
  maskedWord: string;
  iGuessed: boolean;
  /** Teammates who have guessed the current word. */
  correctIds: string[];
  /** Team-scoped chat. */
  chat: SkribblChatMessage[];
  /** The word revealed during the round-end pause. */
  reveal: string | null;
  /** Standings for every team. */
  teams: SkribblTeamProgress[];
}
