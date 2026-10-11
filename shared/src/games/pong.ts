// Pong (real-time 1v1; the lobby is split into parallel matches).

export const PONG_POINTS_OPTIONS = [5, 7, 9] as const;
export type PongPoints = (typeof PONG_POINTS_OPTIONS)[number];

export interface PongInitPayload {
  /** Which paddle this client controls. */
  side: "left" | "right";
  /** Points needed to win the match. */
  target: number;
  self: { name: string; color: string };
  opponent: { name: string; color: string };
  /** True when the opponent is a CPU (odd player count / practice). */
  vsCpu: boolean;
}

/** Pong power-up. "fast" makes the ball rocket off the holder's own paddle;
 *  "shrink" shrinks the opponent's. Grabbed by shooting the ball through a
 *  floating pickup on the court. */
export type PongPowerKind = "fast" | "shrink";

/** A floating power-up pickup on the Pong court (coords normalized 0..1). */
export interface PongPowerup {
  x: number;
  y: number;
  kind: PongPowerKind;
}

/** Frequently-broadcast snapshot of one player's match (coords normalized 0..1). */
export interface PongStatePayload {
  ballX: number;
  ballY: number;
  padL: number; // left paddle center y (0..1)
  padR: number; // right paddle center y (0..1)
  /** Effective paddle half-heights (shrink power reduces one). */
  padHalfL: number;
  padHalfR: number;
  /** Active power-up per side (held by the player on that side), or null. */
  powerL: PongPowerKind | null;
  powerR: PongPowerKind | null;
  /** Floating pickups on the court — shoot the ball through one to grab it. */
  powerups: PongPowerup[];
  scoreL: number;
  scoreR: number;
  over: boolean;
  winner: "left" | "right" | null;
}
