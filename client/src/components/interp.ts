// Client-side motion smoothing for the real-time minigames.
//
// The server streams positions at ~30 Hz, but the canvases redraw at the
// display's refresh rate (usually 60 Hz). Drawing the raw latest snapshot each
// frame means every position is held for ~2 frames and then jumps — visible
// stutter, especially on the fast Pong ball. These helpers ease the *displayed*
// position toward the latest server value every frame, framerate-independently,
// turning the 30 Hz steps into continuous motion for a small (~1 tick) lag.

/** Frame-rate-independent exponential approach of `cur` toward `target`. */
export function smoothTowards(cur: number, target: number, dt: number, tau: number): number {
  return cur + (target - cur) * (1 - Math.exp(-dt / Math.max(0.0001, tau)));
}

/**
 * Smooths a set of 2D positions keyed by a stable id (players, etc.). Call
 * `begin()` each frame, `step()` per entity, then `end()` to drop entities that
 * disappeared. A target that jumps further than `snap` tiles/units is treated as
 * a teleport (respawn / round reset) and snaps instead of gliding across.
 */
export class PosSmoother {
  private m = new Map<string, { x: number; y: number }>();
  private seen = new Set<string>();

  begin(): void {
    this.seen.clear();
  }

  step(id: string, tx: number, ty: number, dt: number, tau: number, snap = 3): { x: number; y: number } {
    this.seen.add(id);
    let s = this.m.get(id);
    if (!s || Math.hypot(tx - s.x, ty - s.y) > snap) {
      s = { x: tx, y: ty };
      this.m.set(id, s);
      return s;
    }
    s.x = smoothTowards(s.x, tx, dt, tau);
    s.y = smoothTowards(s.y, ty, dt, tau);
    return s;
  }

  end(): void {
    for (const id of [...this.m.keys()]) if (!this.seen.has(id)) this.m.delete(id);
  }
}
