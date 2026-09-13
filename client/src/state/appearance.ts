import {
  HAIR_COLORS,
  HAIR_STYLES,
  MOUTH_STYLES,
  PLAYER_COLORS,
  sanitizeAppearance,
  type Appearance,
} from "@marvinho/shared";

// The player's chosen character look, remembered across sessions.
const KEY = "marvinho.appearance";

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** A fully random character look. */
export function randomAppearance(): Appearance {
  return {
    color: pick(PLAYER_COLORS),
    hair: Math.floor(Math.random() * HAIR_STYLES),
    hairColor: pick(HAIR_COLORS),
    mouth: Math.floor(Math.random() * MOUTH_STYLES),
  };
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitizeAppearance(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  // First time (or no customization): a random look, shown and used as-is.
  const a = randomAppearance();
  saveAppearance(a);
  return a;
}

export function saveAppearance(a: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    /* ignore quota / disabled storage */
  }
}
