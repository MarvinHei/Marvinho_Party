// Codenames.

export type CodenamesTeam = "a" | "b";
export type CardColor = "a" | "b" | "neutral" | "assassin";
export type CodenamesTurnPhase = "clue" | "guess";

/** A team/role assignment (used for the draft animation and to build a round). */
export type CodenamesAssignment = Record<
  CodenamesTeam,
  { spymasterId: string; memberIds: string[] }
>;

/** One team in a generic team draft (any team game). */
export interface TeamDraftTeam {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
  /** Codenames only: the spymaster of this team. */
  spymasterId?: string | null;
}

export interface CodenamesTeamInfo {
  team: CodenamesTeam;
  spymasterId: string | null;
  memberIds: string[];
  /** Cards of this team still hidden. */
  remaining: number;
}

/** Per-player Codenames view. The key is included only for that team's spymaster. */
export interface CodenamesView {
  words: string[];
  /** What each card has been revealed as (null = still hidden). */
  revealed: (CardColor | null)[];
  /** True colors of every card — present ONLY for the viewing spymaster. */
  key: CardColor[] | null;
  teams: Record<CodenamesTeam, CodenamesTeamInfo>;
  startingTeam: CodenamesTeam;
  turn: CodenamesTeam;
  turnPhase: CodenamesTurnPhase;
  clue: { word: string; count: number; guessesLeft: number } | null;
  /** Viewer context. */
  myTeam: CodenamesTeam | null;
  isSpymaster: boolean;
  /** Recent event log lines, newest last. */
  log: string[];
  /** Set once the round ends. */
  winner: CodenamesTeam | null;
}
