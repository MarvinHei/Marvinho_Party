// Runner Rush (real-time horizontal auto-scroll jump'n'run).

import type { TokenLook } from "../appearance.js";

export interface RunnerInitPayload {
  /** Visible track width, in tiles. */
  viewW: number;
  /** Track height, in tiles (vertical). */
  viewH: number;
  /** Height of the ground band, in tiles (players stand on top of it). */
  groundH: number;
  /** Shockwave cooldown, in ms (for the client's cooldown ring). */
  shockCooldownMs: number;
  endsAt: number;
  self: { name: string; color: string };
  /** Every player's look, so characters render hair/mouth. */
  appearances: TokenLook[];
}

/** One obstacle, positioned in screen space (x = worldX − camX). */
export interface RunnerObstacle {
  /** Left edge, in tiles from the left of the viewport. */
  x: number;
  w: number;
  h: number;
  /** "low" sits on the ground (jump over it); "high" hangs down (duck under it). */
  kind: "low" | "high";
  /** Visual variant index, so the client can vary the sprite. */
  variant: number;
}

export interface RunnerDot {
  id: string;
  /** Screen-space x (tiles from the left edge of the viewport). */
  x: number;
  /** Height above the ground, in tiles (0 = standing on the ground). */
  h: number;
  color: string;
  name: string;
  alive: boolean;
  ducking: boolean;
  /** Cooldown fraction 0..1 (1 = shockwave ready). */
  shock: number;
  /** ms since this player emitted a shockwave, or -1 (drives the burst ring). */
  boomAge: number;
}

export interface RunnerStatePayload {
  players: RunnerDot[];
  obstacles: RunnerObstacle[];
  /** World distance the camera has travelled (for the distance readout). */
  dist: number;
  alive: number;
  meAlive: boolean;
  msLeft: number;
}
