// Find the Word (team convergence race).

export type FindWordPhase = "playing" | "done";

/** One player's submitted word in a resolved Find the Word round. */
export interface FindWordEntry {
  playerId: string;
  nickname: string;
  color: string;
  word: string;
}

/** Live standing of one team during a Find the Word match. */
export interface FindWordProgress {
  teamId: string;
  name: string;
  color: string;
  /** Attempts used so far (or final count once converged). */
  attempts: number;
  /** Has this team converged on a single word? */
  done: boolean;
  memberIds: string[];
}

/** Per-player Find the Word view (scoped to the viewer's own team). */
export interface FindWordView {
  phase: FindWordPhase;
  /** The viewer's team's current attempt (1-based). */
  round: number;
  teamId: string | null;
  teamName: string;
  teamColor: string;
  members: { id: string; nickname: string; color: string }[];
  /** Resolved rounds for the viewer's team, oldest first. */
  history: FindWordEntry[][];
  mySubmitted: boolean;
  myWord: string | null;
  /** Teammate ids who have not yet submitted this attempt. */
  waitingOn: string[];
  /** Has the viewer's team converged? */
  finished: boolean;
  attempts: number;
  convergedWord: string | null;
  minWordLength: number;
  /** The viewer's team's current attempt deadline (ms epoch), or null. */
  endsAt: number | null;
  teams: FindWordProgress[];
}
