// Battle Royale (real-time top-down shooter on a shared map).

import type { TokenLook } from "../appearance.js";

export interface BattleInitPayload {
  cols: number;
  rows: number;
  walls: string;
  endsAt: number;
  self: { name: string; color: string };
  /** Every player's look, so tokens render hair/mouth. */
  appearances: TokenLook[];
}

/** Battle Royale power-up kinds. */
export type PowerKind = "autofire" | "bounce" | "speed";

export interface BattleDot {
  id: string;
  x: number;
  y: number;
  color: string;
  name: string;
  alive: boolean;
  /** Active power-up, or null. */
  power: PowerKind | null;
}

export interface BattleBullet {
  x: number;
  y: number;
}

export interface BattlePowerup {
  x: number;
  y: number;
  kind: PowerKind;
}

export interface BattleStatePayload {
  players: BattleDot[];
  bullets: BattleBullet[];
  powerups: BattlePowerup[];
  alive: number;
  meAlive: boolean;
  msLeft: number;
}
