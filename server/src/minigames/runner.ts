import type { RunnerDot, RunnerObstacle, RunnerStatePayload } from "@marvinho/shared";

// Horizontal auto-scroll runner. The camera scrolls right at an ever-increasing
// speed; players must keep pace, hurdling ground obstacles (jump) and ducking
// under hanging ones. Bonking an obstacle pins you in place while the camera
// keeps moving — drift off the left edge and you're out. A shockwave shoves
// nearby rivals (on a 5s cooldown), ideally into hazards or off the screen.

// --- world geometry (tiles) ---
const VIEW_W = 26;
const VIEW_H = 13;
const GROUND_H = 2; // ground band height; players stand on top of it

// --- player body ---
const PW = 0.8; // width
const HALF_W = PW / 2;
const STAND_H = 1.5;
const DUCK_H = 0.8;

// --- movement ---
const SCROLL0 = 5.0; // starting camera speed (tiles/s)
const SCROLL_RAMP = 0.06; // per second
const SCROLL_MAX = 9.5;
const ACCEL = 15; // tiles/s^2 from holding accelerate/brake
const EASE = 3.2; // how fast an idle player's speed relaxes toward the scroll
const MAX_LEAD = VIEW_W - 4; // furthest right a player can pull ahead
const V_SPREAD_HI = 6.5; // how much faster than scroll a player may go
const V_SPREAD_LO = 5.5; // how much slower than scroll a player may go

// --- jumping ---
const JUMP_V = 12.5; // tiles/s upward impulse
const GRAVITY = 34; // tiles/s^2

// --- obstacles ---
const LOW_H = 1.25; // ground obstacle height (clear it by jumping above)
const HIGH_BOTTOM = 1.05; // hanging obstacle's underside (duck below it)
const HIGH_H = VIEW_H - GROUND_H - HIGH_BOTTOM;

// --- shockwave ---
const SHOCK_CD = 5000; // ms
const SHOCK_R = 4.2; // tiles
const SHOCK_PUSH = 9.5; // horizontal impulse
const SHOCK_POP = 6.0; // vertical impulse

interface RP {
  id: string;
  name: string;
  color: string;
  x: number; // world x
  vx: number; // world x velocity
  h: number; // height above ground
  vy: number; // vertical velocity
  dir: number; // -1 brake, 0 none, +1 accelerate
  duck: boolean;
  alive: boolean;
  deathOrder: number | null;
  lastShock: number;
  boomAt: number; // timestamp of last shockwave, or 0
}

interface Obstacle {
  x: number; // world x (left edge)
  w: number;
  h: number;
  kind: "low" | "high";
  variant: number;
}

export interface RunnerPlayer {
  id: string;
  nickname: string;
  color: string;
}

export interface RunnerStats {
  placement: number; // 1 = best
  survived: boolean;
  distance: number; // world tiles reached
}

export class RunnerRound {
  readonly endsAt: number;
  readonly viewW = VIEW_W;
  readonly viewH = VIEW_H;
  readonly groundH = GROUND_H;
  readonly shockCooldownMs = SHOCK_CD;

  private players = new Map<string, RP>();
  private obstacles: Obstacle[] = [];
  private camX = 0;
  private scroll = SCROLL0;
  private nextObstacleX: number;
  private deaths = 0;
  private startedAt = Date.now();

  constructor(players: RunnerPlayer[], roundMs: number) {
    this.endsAt = Date.now() + roundMs;
    const startX = 7;
    for (const p of players) {
      this.players.set(p.id, {
        id: p.id,
        name: p.nickname,
        color: p.color,
        x: startX,
        vx: SCROLL0,
        h: 0,
        vy: 0,
        dir: 0,
        duck: false,
        alive: true,
        deathOrder: null,
        lastShock: -SHOCK_CD, // ready at the start
        boomAt: 0,
      });
    }
    // First obstacle a little way past the initial viewport so nobody is bonked
    // the instant the round begins.
    this.nextObstacleX = VIEW_W + 6;
  }

  infoOf(id: string): { name: string; color: string } {
    const p = this.players.get(id);
    return { name: p?.name ?? "?", color: p?.color ?? "#888" };
  }

  setMove(id: string, dir: number, duck: boolean): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    p.dir = dir > 0 ? 1 : dir < 0 ? -1 : 0;
    p.duck = !!duck;
  }

  jump(id: string): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (p.h <= 0.02 && !p.duck) p.vy = JUMP_V;
  }

  shock(id: string): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    const now = Date.now();
    if (now - p.lastShock < SHOCK_CD) return;
    p.lastShock = now;
    p.boomAt = now;
    for (const q of this.players.values()) {
      if (q.id === id || !q.alive) continue;
      const dx = q.x - p.x;
      const dh = q.h - p.h;
      const d = Math.hypot(dx, dh);
      if (d > SHOCK_R) continue;
      // Impulse away from the emitter, falling off with distance.
      const falloff = 1 - d / SHOCK_R;
      const ux = d < 0.001 ? (Math.random() < 0.5 ? -1 : 1) : dx / d;
      q.vx += ux * SHOCK_PUSH * falloff;
      if (q.h <= 0.02) q.vy = Math.max(q.vy, SHOCK_POP * falloff);
    }
  }

  private spawnObstaclesAhead(): void {
    const horizon = this.camX + VIEW_W + 8;
    while (this.nextObstacleX < horizon) {
      const elapsed = (Date.now() - this.startedAt) / 1000;
      const high = Math.random() < 0.38; // bias toward jump obstacles
      if (high) {
        this.obstacles.push({
          x: this.nextObstacleX,
          w: 1.6,
          h: HIGH_H,
          kind: "high",
          variant: Math.floor(Math.random() * 2),
        });
      } else {
        const w = Math.random() < 0.3 ? 2 : 1;
        this.obstacles.push({
          x: this.nextObstacleX,
          w,
          h: LOW_H,
          kind: "low",
          variant: Math.floor(Math.random() * 3),
        });
      }
      // Gap shrinks a little as the round goes on, but stays clearable.
      const gap = Math.max(5.5, 9 - elapsed * 0.03) + Math.random() * 3.5;
      this.nextObstacleX += gap;
    }
    // Drop obstacles that have scrolled well off the left.
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > this.camX - 4);
  }

  tick(dt: number): void {
    this.scroll = Math.min(SCROLL_MAX, this.scroll + SCROLL_RAMP * dt);
    this.camX += this.scroll * dt;
    this.spawnObstaclesAhead();

    for (const p of this.players.values()) {
      if (!p.alive) continue;

      // Horizontal: accelerate/brake, or relax toward the camera speed.
      if (p.dir !== 0) {
        p.vx += p.dir * ACCEL * dt;
      } else {
        p.vx += (this.scroll - p.vx) * Math.min(1, EASE * dt);
      }
      p.vx = Math.max(this.scroll - V_SPREAD_LO, Math.min(this.scroll + V_SPREAD_HI, p.vx));
      p.x += p.vx * dt;

      // Vertical: jump arc.
      if (p.h > 0 || p.vy > 0) {
        p.vy -= GRAVITY * dt;
        p.h += p.vy * dt;
        if (p.h <= 0) {
          p.h = 0;
          p.vy = 0;
        }
      }

      // Obstacle collision: pin the player at the obstacle's left edge.
      const bodyH = p.duck && p.h <= 0.02 ? DUCK_H : STAND_H;
      for (const o of this.obstacles) {
        const oL = o.x;
        const oR = o.x + o.w;
        if (p.x + HALF_W <= oL || p.x - HALF_W >= oR) continue; // no x overlap
        let hit = false;
        if (o.kind === "low") {
          // Clear it by having your feet above the obstacle top.
          if (p.h < LOW_H) hit = true;
        } else {
          // Clear it by keeping your head below the hanging underside.
          if (p.h + bodyH > HIGH_BOTTOM) hit = true;
        }
        if (hit) {
          p.x = oL - HALF_W - 0.001;
          if (p.vx > this.scroll) p.vx = this.scroll; // can't push through it
        }
      }

      // Clamp how far ahead of the camera a player may run.
      const lead = p.x - this.camX;
      if (lead > MAX_LEAD) {
        p.x = this.camX + MAX_LEAD;
        if (p.vx > this.scroll) p.vx = this.scroll;
      }
      // Fell off the left edge → eliminated.
      if (lead < 0) {
        p.alive = false;
        p.deathOrder = ++this.deaths;
      }
    }
  }

  private aliveCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.alive) n++;
    return n;
  }

  private now(): number {
    return Date.now();
  }

  private dots(): RunnerDot[] {
    const now = this.now();
    return [...this.players.values()].map((p) => ({
      id: p.id,
      x: p.x - this.camX,
      h: p.h,
      color: p.color,
      name: p.name,
      alive: p.alive,
      ducking: p.duck && p.h <= 0.02,
      shock: Math.max(0, Math.min(1, (now - p.lastShock) / SHOCK_CD)),
      boomAge: p.boomAt ? now - p.boomAt : -1,
    }));
  }

  private visibleObstacles(): RunnerObstacle[] {
    const out: RunnerObstacle[] = [];
    for (const o of this.obstacles) {
      const sx = o.x - this.camX;
      if (sx > VIEW_W + 3 || sx + o.w < -3) continue;
      out.push({ x: sx, w: o.w, h: o.h, kind: o.kind, variant: o.variant });
    }
    return out;
  }

  stateFor(id: string): RunnerStatePayload {
    return {
      players: this.dots(),
      obstacles: this.visibleObstacles(),
      dist: this.camX,
      alive: this.aliveCount(),
      meAlive: this.players.get(id)?.alive ?? false,
      msLeft: Math.max(0, this.endsAt - Date.now()),
    };
  }

  playerIds(): string[] {
    return [...this.players.keys()];
  }

  isComplete(): boolean {
    return this.aliveCount() <= 1 || Date.now() >= this.endsAt;
  }

  statsFor(id: string): RunnerStats {
    const p = this.players.get(id);
    if (!p) return { placement: 999, survived: false, distance: 0 };
    const total = this.players.size;
    if (p.alive) return { placement: 1, survived: true, distance: p.x };
    return { placement: total - (p.deathOrder ?? total) + 1, survived: false, distance: p.x };
  }

  /** Best first: survivors (furthest ahead) then the latest to fall. */
  ranking(): string[] {
    return this.playerIds().sort((a, b) => {
      const pa = this.players.get(a)!;
      const pb = this.players.get(b)!;
      if (pa.alive !== pb.alive) return pa.alive ? -1 : 1;
      if (pa.alive) return pb.x - pa.x; // both alive: furthest wins
      return (pb.deathOrder ?? 0) - (pa.deathOrder ?? 0); // both out: later death wins
    });
  }
}
