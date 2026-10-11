// Sterbegeld (split-screen: DELA timing duel → Wartezeit dodge survival).

import type { TokenLook } from "../appearance.js";

export type SterbegeldPhase = "dela" | "wartezeit" | "done";

export interface SterbegeldInitPayload {
  /** Everyone's identity + look, so every POV can render every character. */
  players: { id: string; name: string; color: string }[];
  appearances: TokenLook[];
  self: { name: string; color: string };
}

/** One player's live state, shown in that player's split-screen cell. */
export interface SterbegeldDot {
  id: string;
  name: string;
  color: string;
  /** DELA: car progress 0 (far) → 1 (impact). */
  carPos: number;
  /** DELA: has this player signed the contract yet? */
  signed: boolean;
  /** DELA: the car has hit — this phase is finished for them. */
  delaDone: boolean;
  delaScore: number;
  /** Wartezeit: horizontal position 0..1. */
  x: number;
  /** Wartezeit: still dodging (false before the phase and after a hit). */
  waitAlive: boolean;
  waitScore: number;
  /** delaScore + waitScore, the value that decides the winner. */
  total: number;
}

/** A falling bar segment in the Wartezeit phase (shared across all POVs). */
export interface SterbegeldBlock {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SterbegeldStatePayload {
  phase: SterbegeldPhase;
  players: SterbegeldDot[];
  /** Wartezeit falling bars (empty during DELA). */
  blocks: SterbegeldBlock[];
}
