import type { HideDot, HideRole, HideStatePayload } from "@marvinho/shared";
import {
  type Arena,
  generateArena,
  encodeWalls,
  moveCircle,
  randomSpawn,
  hasLineOfSight,
  isWall,
} from "./arena.js";

const COLS = 34;
const ROWS = 20;
const HIDER_SPEED = 5.6; // tiles / second
const SEEKER_SPEED = 8.8; // much faster, so hiders must really use cover
const RADIUS = 0.36;
const CATCH_RANGE = 1.2; // tiles — how close a stab reaches
const VISION = 9; // seeker flashlight range (tiles)
const NEAR_VISION = 2.6; // full-circle awareness right around the seeker
const FLASH_HALF_ANGLE = Math.PI * 0.26; // ~47° half-angle flashlight cone
const PING_INTERVAL = 5000; // ms — seeker gets a radar ping of hiders this often
const PING_SHOW_MS = 2200; // how long each ping stays on the seeker's screen
const TELEPORT_CD = 30000; // ms — every player may blink to a spot this often

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
  /** Last teleport timestamp (for the shared cooldown). */
  lastTeleport: number;
  /** Seeker flashlight aim (radians); ignored for hiders. */
  aim: number;
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
  private lastPingAt = 0;
  private pingPositions: { x: number; y: number }[] = [];

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
        lastTeleport: now, // first teleport becomes available 30s in
        aim: 0,
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

  /** Point the seeker's flashlight (radians). */
  setAim(id: string, angle: number): void {
    const p = this.players.get(id);
    if (p && p.role === "seeker" && Number.isFinite(angle)) p.aim = angle;
  }

  /** Blink to a map spot (on a shared cooldown; clamped to open floor). */
  teleport(id: string, x: number, y: number): void {
    const p = this.players.get(id);
    if (!p || p.caught) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now();
    if (now - p.lastTeleport < TELEPORT_CD) return;
    // The seeker can't blink before it's loosed onto the map.
    if (p.role === "seeker" && !this.released()) return;
    const tx = Math.max(RADIUS, Math.min(this.arena.cols - RADIUS, x));
    const ty = Math.max(RADIUS, Math.min(this.arena.rows - RADIUS, y));
    if (isWall(this.arena, tx, ty)) return; // don't land inside a wall
    p.x = tx;
    p.y = ty;
    p.lastTeleport = now;
  }

  private teleportCd(id: string): number {
    const p = this.players.get(id);
    if (!p) return 0;
    return Math.max(0, TELEPORT_CD - (Date.now() - p.lastTeleport));
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
    // Every few seconds, snapshot the hiders' positions as a radar ping.
    const now = Date.now();
    if (released && now - this.lastPingAt >= PING_INTERVAL) {
      this.lastPingAt = now;
      this.pingPositions = [];
      for (const p of this.players.values()) {
        if (p.role === "hider" && !p.caught) this.pingPositions.push({ x: p.x, y: p.y });
      }
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
      // Seeker flashlight: a narrow cone in the aim direction (plus a small
      // full-circle right around the seeker), all gated on line of sight.
      if (isSeeker && p.role === "hider" && !p.caught && me) {
        const d = Math.hypot(p.x - me.x, p.y - me.y);
        let visible = d <= NEAR_VISION;
        if (!visible && d <= VISION) {
          const ang = Math.atan2(p.y - me.y, p.x - me.x);
          let diff = Math.abs(ang - me.aim) % (Math.PI * 2);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          visible = diff <= FLASH_HALF_ANGLE;
        }
        if (visible) visible = hasLineOfSight(this.arena, me.x, me.y, p.x, p.y);
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
    // The seeker sees a radar ping for a short window after each snapshot.
    const pings =
      isSeeker && Date.now() - this.lastPingAt < PING_SHOW_MS ? this.pingPositions : [];
    return {
      players: dots,
      released,
      aliveHiders: this.aliveHiders(),
      msLeft: Math.max(0, this.endsAt - Date.now()),
      meCaught: me?.caught ?? false,
      pings,
      teleportCd: this.teleportCd(id),
      flashHalfAngle: FLASH_HALF_ANGLE,
      flashRange: VISION,
    };
  }

  playerIds(): string[] {
    return [...this.players.keys()];
  }

  isComplete(): boolean {
    // Ends when the seeker catches everyone, or when time runs out (any hider
    // still alive at the buzzer means the hiders win).
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
