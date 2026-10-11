// Verstecken (real-time hide & seek on a shared map).

import type { TokenLook } from "../appearance.js";

export type HideRole = "seeker" | "hider";

export interface HideInitPayload {
  cols: number;
  rows: number;
  /** "0"/"1" per tile, row-major (1 = wall). */
  walls: string;
  role: HideRole;
  /** Timestamp when the seeker is released onto the map. */
  releaseAt: number;
  endsAt: number;
  self: { name: string; color: string };
  /** Every player's look, so tokens render hair/mouth. */
  appearances: TokenLook[];
}

export interface HideDot {
  id: string;
  x: number;
  y: number;
  color: string;
  name: string;
  role: HideRole;
  caught: boolean;
}

/** Per-viewer snapshot (the seeker only receives hiders it can currently see). */
export interface HideStatePayload {
  players: HideDot[];
  released: boolean;
  aliveHiders: number;
  msLeft: number;
  meCaught: boolean;
  /** Radar-ping hider positions, shown to the seeker for a short window. */
  pings: { x: number; y: number }[];
  /** ms until this player's next teleport is ready (0 = ready now). */
  teleportCd: number;
  /** Seeker flashlight cone half-angle (radians), range (tiles) and current aim
   *  (radians) — the aim the SERVER uses to cull, so the client draws the exact
   *  same cone it detects with. (aim is 0 for hiders.) */
  flashHalfAngle: number;
  flashRange: number;
  flashAim: number;
}
