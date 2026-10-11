import type { LobbyView, MinigameResult, MinigameType, TeamDraftTeam } from "@marvinho/shared";
import type { ActiveGame } from "../games/types.js";

export type Screen = "home" | "lobby" | "game";
export type MinigamePhase =
  | "intermission"
  | "spinning"
  | "assigning"
  | "explaining"
  | "countdown"
  | "playing"
  | "results";

export interface WheelState {
  options: MinigameType[];
  chosen: MinigameType;
  spinMs: number;
}

/** Serializable snapshot of one player seat (the Net lives outside the store). */
export interface SeatState {
  id: string;
  label: string;
  connected: boolean;
  playerId: string | null;
  lobby: LobbyView | null;
  screen: Screen;
  error: string | null;

  minigame: MinigameType | null;
  minigamePhase: MinigamePhase | null;
  /** The running (or just-finished) minigame's own state; see games/registry. */
  game: ActiveGame | null;
  /** True while the results podium waits for the host to confirm the advance. */
  resultsPending: boolean;
  /** Set during the on-board winner celebration (before the win screen). */
  celebrateWinnerId: string | null;
  /** True after forfeiting the current minigame (0 points, sitting out). */
  forfeited: boolean;
  /** The game whose explanation screen is showing (phase "explaining"). */
  explainGame: MinigameType | null;
  lastResult: MinigameResult | null;
  wheel: WheelState | null;
  /** Drafted teams for the current team game (shown for confirmation). */
  teamDraft: TeamDraftTeam[] | null;
  teamDraftGame: MinigameType | null;
  countdown: { game: MinigameType; endsAt: number } | null;
  /** Which player's POV this seat is watching read-only (null = none). */
  spectateTarget: string | null;
  /** Latest streamed snapshot of the watched player. */
  spectateFrame: { targetId: string; data: string } | null;
}

export interface StoreSnapshot {
  debugEnabled: boolean;
  activeSeatId: string | null;
  seats: SeatState[];
}

export function initialSeat(id: string, label: string): SeatState {
  return {
    id,
    label,
    connected: false,
    playerId: null,
    lobby: null,
    screen: "home",
    error: null,
    minigame: null,
    minigamePhase: null,
    game: null,
    resultsPending: false,
    celebrateWinnerId: null,
    forfeited: false,
    explainGame: null,
    lastResult: null,
    wheel: null,
    teamDraft: null,
    teamDraftGame: null,
    countdown: null,
    spectateTarget: null,
    spectateFrame: null,
  };
}
