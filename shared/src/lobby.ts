// Lobby and player views sent to clients.

import type { Appearance } from "./appearance.js";
import type { MinigameType } from "./minigames.js";
import type { LobbySettings } from "./settings.js";

export type LobbyPhase =
  | "lobby"
  | "intermission"
  | "spinning"
  | "assigning"
  | "explaining"
  | "countdown"
  | "minigame"
  | "finished";

export interface PlayerView {
  id: string;
  nickname: string;
  color: string;
  /** 0 = start tile, GAME_CONFIG.boardLength = finish line. */
  position: number;
  isHost: boolean;
  connected: boolean;
  /** Has this player voted ready during an intermission? */
  ready: boolean;
  /** Customized character look. */
  appearance: Appearance;
}

export interface LobbyView {
  id: string;
  phase: LobbyPhase;
  hostId: string;
  players: PlayerView[];
  boardLength: number;
  minPlayers: number;
  /** Set once someone crosses the finish line. */
  winnerId: string | null;
  /** Which minigame is active/last, for UI routing. */
  currentMinigame: MinigameType | null;
  /** Host-configured lobby settings (per-game timers, difficulty, blacklist…). */
  settings: LobbySettings;
  /** Debug practice mode: play minigames standalone, no board/scoreboard. */
  sandbox: boolean;
}

// ---------------------------------------------------------------------------
// Acknowledgement payloads (socket.io callback responses)
// ---------------------------------------------------------------------------

export type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

export interface JoinedLobby {
  lobbyId: string;
  playerId: string;
  lobby: LobbyView;
}


/** Normalize a user-typed nickname; returns null if invalid. */
export function sanitizeNickname(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 1 || trimmed.length > 16) return null;
  return trimmed;
}
