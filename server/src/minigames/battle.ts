import type { BattleBullet, BattleDot, BattleStatePayload } from "@marvinho/shared";
import {
  type Arena,
  generateArena,
  encodeWalls,
  moveCircle,
  randomSpawn,
  isWall,
} from "./arena.js";

const COLS = 34;
const ROWS = 20;
const SPEED = 6.2; // tiles / second
const RADIUS = 0.4;
const BULLET_SPEED = 15; // tiles / second
const BULLET_R = 0.14;
const HIT_R = RADIUS + BULLET_R;
const SHOOT_COOLDOWN = 340; // ms between shots (moderate)

interface BP {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  alive: boolean;
  lastShot: number;
  deathOrder: number | null;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: string;
  life: number; // seconds remaining
}

export interface BattlePlayer {
  id: string;
  nickname: string;
  color: string;
}

export interface BattleStats {
  placement: number; // 1 = winner; larger = out earlier
  survived: boolean;
}

export class BattleRound {
  readonly arena: Arena;
  readonly endsAt: number;
  private players = new Map<string, BP>();
  private bullets: Bullet[] = [];
  private deaths = 0;

  constructor(players: BattlePlayer[], roundMs: number) {
    this.arena = generateArena(COLS, ROWS);
    this.endsAt = Date.now() + roundMs;
    for (const p of players) {
      const spawn = randomSpawn(this.arena, RADIUS);
      this.players.set(p.id, {
        id: p.id,
        name: p.nickname,
        color: p.color,
        x: spawn.x,
        y: spawn.y,
        dx: 0,
        dy: 0,
        alive: true,
        lastShot: 0,
        deathOrder: null,
      });
    }
  }

  encodedWalls(): string {
    return encodeWalls(this.arena);
  }
  infoOf(id: string): { name: string; color: string } {
    const p = this.players.get(id);
    return { name: p?.name ?? "?", color: p?.color ?? "#888" };
  }

  setMove(id: string, dx: number, dy: number): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    const m = Math.hypot(dx, dy);
    p.dx = m > 1 ? dx / m : dx;
    p.dy = m > 1 ? dy / m : dy;
  }

  shoot(id: string, angle: number): void {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    const now = Date.now();
    if (now - p.lastShot < SHOOT_COOLDOWN) return;
    p.lastShot = now;
    // Spawn the bullet just outside the shooter so it can't self-hit.
    const ox = Math.cos(angle);
    const oy = Math.sin(angle);
    this.bullets.push({
      x: p.x + ox * (RADIUS + BULLET_R + 0.02),
      y: p.y + oy * (RADIUS + BULLET_R + 0.02),
      vx: ox * BULLET_SPEED,
      vy: oy * BULLET_SPEED,
      owner: id,
      life: 2.2,
    });
  }

  tick(dt: number): void {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const next = moveCircle(this.arena, p.x, p.y, p.dx * SPEED * dt, p.dy * SPEED * dt, RADIUS);
      p.x = next.x;
      p.y = next.y;
    }
    const survivors: Bullet[] = [];
    for (const b of this.bullets) {
      b.life -= dt;
      if (b.life <= 0) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (isWall(this.arena, b.x, b.y)) continue; // absorbed by a wall
      let hit = false;
      for (const p of this.players.values()) {
        if (!p.alive || p.id === b.owner) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) <= HIT_R) {
          p.alive = false;
          p.deathOrder = ++this.deaths;
          hit = true;
          break;
        }
      }
      if (!hit) survivors.push(b);
    }
    this.bullets = survivors;
  }

  private aliveCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.alive) n++;
    return n;
  }

  state(): { players: BattleDot[]; bullets: BattleBullet[]; alive: number } {
    const players: BattleDot[] = [...this.players.values()].map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      color: p.color,
      name: p.name,
      alive: p.alive,
    }));
    const bullets: BattleBullet[] = this.bullets.map((b) => ({ x: b.x, y: b.y }));
    return { players, bullets, alive: this.aliveCount() };
  }

  stateFor(id: string): BattleStatePayload {
    const base = this.state();
    return {
      ...base,
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

  statsFor(id: string): BattleStats {
    const p = this.players.get(id);
    if (!p) return { placement: 999, survived: false };
    const total = this.players.size;
    // Survivors: placement 1..k (tie broken arbitrarily). Dead: by death order.
    if (p.alive) return { placement: 1, survived: true };
    return { placement: total - (p.deathOrder ?? total) + 1, survived: false };
  }

  /** Best (last alive) first. */
  ranking(): string[] {
    return this.playerIds().sort((a, b) => {
      const pa = this.players.get(a)!;
      const pb = this.players.get(b)!;
      if (pa.alive !== pb.alive) return pa.alive ? -1 : 1;
      // Both dead: later death order (bigger) ranks higher.
      return (pb.deathOrder ?? 0) - (pa.deathOrder ?? 0);
    });
  }
}
