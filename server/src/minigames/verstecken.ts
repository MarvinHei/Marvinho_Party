import type { HideDot, HideRole, HideStatePayload } from "@marvinho/shared";
import {
  type Arena,
  generateArena,
  encodeWalls,
  moveCircle,
  randomSpawn,
  hasLineOfSight,
} from "./arena.js";

const COLS = 34;
const ROWS = 20;
const HIDER_SPEED = 5.6; // tiles / second
const SEEKER_SPEED = 6.4; // a touch faster so it can catch up
const RADIUS = 0.36;
const CATCH_RANGE = 1.2; // tiles — how close a stab reaches
const VISION = 7; // seeker sight radius (tiles)

interface HP {
  id: string;
  name: string;
  color: string;
  role: HideRole;
  x: number;
  y: number;
  dx: number;
  dy: number;
  caught: boolean;
  survivedMs: number | null;
}

export interface HidePlayer {
  id: string;
  nickname: string;
  color: string;
}

export interface HideStats {
  role: HideRole;
  survived: boolean;
  survivedMs: number;
  catches: number;
}

export class HideRound {
  readonly arena: Arena;
  readonly releaseAt: number;
  readonly endsAt: number;
  private players = new Map<string, HP>();
  private seekerId: string;
  private catches = 0;

  constructor(players: HidePlayer[], holdMs: number, roundMs: number) {
    this.arena = generateArena(COLS, ROWS);
    const now = Date.now();
    this.releaseAt = now + holdMs;
    this.endsAt = now + roundMs;
    const ids = players.map((p) => p.id);
    this.seekerId = ids[Math.floor(Math.random() * ids.length)];
    for (const p of players) {
      const spawn = randomSpawn(this.arena, RADIUS);
      this.players.set(p.id, {
        id: p.id,
        name: p.nickname,
        color: p.color,
        role: p.id === this.seekerId ? "seeker" : "hider",
        x: spawn.x,
        y: spawn.y,
        dx: 0,
        dy: 0,
        caught: false,
        survivedMs: null,
      });
    }
  }

  encodedWalls(): string {
    return encodeWalls(this.arena);
  }
  roleOf(id: string): HideRole {
    return this.players.get(id)?.role ?? "hider";
  }
  infoOf(id: string): { name: string; color: string } {
    const p = this.players.get(id);
    return { name: p?.name ?? "?", color: p?.color ?? "#888" };
  }

  private released(): boolean {
    return Date.now() >= this.releaseAt;
  }

  setMove(id: string, dx: number, dy: number): void {
    const p = this.players.get(id);
    if (!p || p.caught) return;
    const m = Math.hypot(dx, dy);
    p.dx = m > 1 ? dx / m : dx;
    p.dy = m > 1 ? dy / m : dy;
  }

  stab(id: string): void {
    const p = this.players.get(id);
    if (!p || p.role !== "seeker" || !this.released()) return;
    let best: HP | null = null;
    let bestD = CATCH_RANGE;
    for (const h of this.players.values()) {
      if (h.role !== "hider" || h.caught) continue;
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d <= bestD) {
        bestD = d;
        best = h;
      }
    }
    if (best) {
      best.caught = true;
      best.survivedMs = Date.now() - this.releaseAt;
      this.catches++;
    }
  }

  tick(dt: number): void {
    const released = this.released();
    for (const p of this.players.values()) {
      if (p.caught) continue;
      if (p.role === "seeker" && !released) continue; // held until release
      const speed = p.role === "seeker" ? SEEKER_SPEED : HIDER_SPEED;
      const next = moveCircle(this.arena, p.x, p.y, p.dx * speed * dt, p.dy * speed * dt, RADIUS);
      p.x = next.x;
      p.y = next.y;
    }
  }

  private aliveHiders(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.role === "hider" && !p.caught) n++;
    return n;
  }

  stateFor(id: string): HideStatePayload {
    const me = this.players.get(id);
    const released = this.released();
    const isSeeker = me?.role === "seeker";
    const dots: HideDot[] = [];
    for (const p of this.players.values()) {
      // Seeker fog-of-war: only see hiders in range + line of sight.
      if (isSeeker && p.role === "hider" && !p.caught && me) {
        const d = Math.hypot(p.x - me.x, p.y - me.y);
        const visible = d <= VISION && hasLineOfSight(this.arena, me.x, me.y, p.x, p.y);
        if (!visible) continue;
      }
      // Hiders don't see the seeker until it's released onto the map.
      if (!isSeeker && p.role === "seeker" && !released) continue;
      dots.push({
        id: p.id,
        x: p.x,
        y: p.y,
        color: p.color,
        name: p.name,
        role: p.role,
        caught: p.caught,
      });
    }
    return {
      players: dots,
      released,
      aliveHiders: this.aliveHiders(),
      msLeft: Math.max(0, this.endsAt - Date.now()),
      meCaught: me?.caught ?? false,
    };
  }

  playerIds(): string[] {
    return [...this.players.keys()];
  }

  isComplete(): boolean {
    return this.aliveHiders() === 0 || Date.now() >= this.endsAt;
  }

  statsFor(id: string): HideStats {
    const p = this.players.get(id);
    if (!p) return { role: "hider", survived: false, survivedMs: 0, catches: 0 };
    const roundMs = this.endsAt - this.releaseAt;
    return {
      role: p.role,
      survived: p.role === "hider" && !p.caught,
      survivedMs: p.role === "hider" ? p.survivedMs ?? roundMs : 0,
      catches: p.role === "seeker" ? this.catches : 0,
    };
  }

  /** Rank: surviving hiders, then the seeker (by catches), then caught hiders. */
  ranking(): string[] {
    const score = (id: string): number => {
      const s = this.statsFor(id);
      if (s.role === "seeker") return 100000 + s.catches * 1000;
      if (s.survived) return 1000000; // survivors on top
      return s.survivedMs; // caught: longer survival ranks higher
    };
    return this.playerIds().sort((a, b) => score(b) - score(a));
  }
}
