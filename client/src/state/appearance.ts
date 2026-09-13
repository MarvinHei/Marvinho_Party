import { PLAYER_COLORS, defaultAppearance, sanitizeAppearance, type Appearance } from "@marvinho/shared";

// The player's chosen character look, remembered across sessions.
const KEY = "marvinho.appearance";

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitizeAppearance(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  // First time: start from a random body colour so players don't all match.
  const a: Appearance = {
    ...defaultAppearance(),
    color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
  };
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
