// Player character looks (customized on the home screen).

import { PLAYER_COLORS } from "./config.js";

/** Number of hair styles (index 0 = bald). */
export const HAIR_STYLES = 7;
/** Number of mouth styles. */
export const MOUTH_STYLES = 5;

/** Hair colour palette. */
export const HAIR_COLORS = [
  "#2b2b33", // black
  "#5a3b1e", // dark brown
  "#8a5a2b", // brown
  "#d9a441", // blonde
  "#c24b2c", // ginger
  "#9aa0ad", // grey
  "#ece9f2", // white
  "#b06bff", // purple
  "#3aa0ff", // blue
  "#42d17a", // green
] as const;

export interface Appearance {
  /** Body colour (from PLAYER_COLORS). */
  color: string;
  /** Hair style index (0 = bald). */
  hair: number;
  /** Hair colour (from HAIR_COLORS). */
  hairColor: string;
  /** Mouth style index. */
  mouth: number;
}

/** A player's look keyed by id, sent with real-time game inits so their token
 *  can render hair/mouth (body colour already rides on each dot). */
export interface TokenLook {
  id: string;
  hair: number;
  hairColor: string;
  mouth: number;
}

export function defaultAppearance(): Appearance {
  return { color: PLAYER_COLORS[0], hair: 1, hairColor: HAIR_COLORS[0], mouth: 1 };
}

/** Clamp/repair an appearance arriving from a client into a safe shape. */
export function sanitizeAppearance(raw: unknown): Appearance {
  const d = defaultAppearance();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<Appearance>;
  const intIn = (v: unknown, n: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : -1);
  const hair = intIn(r.hair, HAIR_STYLES);
  const mouth = intIn(r.mouth, MOUTH_STYLES);
  return {
    color: (PLAYER_COLORS as readonly string[]).includes(r.color as string) ? (r.color as string) : d.color,
    hair: hair < 0 ? d.hair : hair,
    hairColor: (HAIR_COLORS as readonly string[]).includes(r.hairColor as string) ? (r.hairColor as string) : d.hairColor,
    mouth: mouth < 0 ? d.mouth : mouth,
  };
}
