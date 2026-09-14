// Remembers which seat this browser holds so a refresh / reconnect can rejoin
// the same match instead of dropping to the home screen.
const KEY = "marvinho.session";

export interface Session {
  lobbyId: string;
  playerId: string;
}

export function saveSession(s: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.lobbyId === "string" && typeof s.playerId === "string") return s;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
