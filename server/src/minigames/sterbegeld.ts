import type {
  SterbegeldBlock,
  SterbegeldDot,
  SterbegeldPhase,
  SterbegeldStatePayload,
} from "@marvinho/shared";

// ===========================================================================
// Sterbegeld — a two-act split-screen game. Everyone plays both acts; the
// player with the highest combined score wins.
//
//  Act 1 "DELA": a car accelerates into your character. Press to sign the
//  contract as late as you dare — the score bleeds away from the moment you
//  sign until the car hits, so you want to sign at the last possible instant.
//  Getting hit before you sign scores 0. The score bleeds fast, so DELA
//  spreads players out about as much as the survival act does.
//
//  Act 2 "Wartezeit": bars with a drifting hole fall from the sky; move to
//  stay in the hole. It starts hard and keeps speeding up. The longer you last
//  the more you score, and later seconds are worth more.
// ===========================================================================

// --- DELA (act 1) ---
const DELA_MAX = 20000;
const DELA_DECAY = 7000; // score lost per second after signing
const CAR_V0 = 0.1; // initial car speed (progress/s)
const CAR_ACCEL = 0.1; // car acceleration (progress/s^2)

// --- Wartezeit (act 2) ---
const COLS = 9;
const COL_W = 1 / COLS;
const CHAR_W = 0.06; // character hit-box width (field-widths)
const CHAR_Y = 0.9; // character vertical position (0 top … 1 bottom)
const BLOCK_H = 0.13; // falling-bar height
const PLAYER_SPEED = 1.5; // field-widths per second
const WAIT_BASE = 450; // score/s at the start…
const WAIT_RAMP = 25; // …plus this much per second survived (rewards endurance)
const GAP_SHIFT = 2; // max columns the hole may drift between waves (keeps it dodgeable)

interface Wave {
  gapStart: number; // first open column
  gapCols: number; // width of the hole, in columns
  y: number; // top edge (0 top → falls down)
}

interface SP {
  id: string;
  name: string;
  color: string;
  // DELA
  carPos: number;
  carVel: number;
  carAccel: number;
  signed: boolean;
  signAt: number;
  delaScore: number;
  delaDone: boolean;
  // Wartezeit
  x: number;
  dir: number;
  waitAlive: boolean;
  waitScore: number;
  waitDone: boolean;
}

export interface SterbegeldPlayer {
  id: string;
  nickname: string;
  color: string;
}

export interface SterbegeldStats {
  delaScore: number;
  waitScore: number;
  total: number;
}

export class SterbegeldRound {
  private players = new Map<string, SP>();
  private order: string[];
  private phase: SterbegeldPhase = "dela";
  // Wartezeit state.
  private waves: Wave[] = [];
  private waitStart = 0;
  private nextWaveAt = 0;
  private lastGapStart = Math.floor((COLS - 2) / 2);

  constructor(players: SterbegeldPlayer[]) {
    this.order = players.map((p) => p.id);
    for (const p of players) {
      // A small per-player wobble on the car so the timing isn't memorised.
      const wobble = 0.9 + Math.random() * 0.2;
      this.players.set(p.id, {
        id: p.id,
        name: p.nickname,
        color: p.color,
        carPos: 0,
        carVel: CAR_V0 * wobble,
        carAccel: CAR_ACCEL * wobble,
        signed: false,
        signAt: 0,
        delaScore: DELA_MAX, // shows the default 20,000 until you sign
        delaDone: false,
        x: 0.5,
        dir: 0,
        waitAlive: false,
        waitScore: 0,
        waitDone: false,
      });
    }
  }

  infoOf(id: string): { name: string; color: string } {
    const p = this.players.get(id);
    return { name: p?.name ?? "?", color: p?.color ?? "#888" };
  }

  // --- input --------------------------------------------------------------

  /** DELA: sign the contract now (locks in the decay start). */
  sign(id: string): void {
    if (this.phase !== "dela") return;
    const p = this.players.get(id);
    if (!p || p.signed || p.delaDone) return;
    p.signed = true;
    p.signAt = Date.now();
  }

  /** Wartezeit: set held horizontal direction. */
  setMove(id: string, dir: number): void {
    const p = this.players.get(id);
    if (!p) return;
    p.dir = dir > 0 ? 1 : dir < 0 ? -1 : 0;
  }

  // --- simulation ---------------------------------------------------------

  tick(dt: number): void {
    if (this.phase === "dela") this.tickDela(dt);
    else if (this.phase === "wartezeit") this.tickWait(dt);
  }

  private tickDela(dt: number): void {
    const now = Date.now();
    for (const p of this.players.values()) {
      if (p.delaDone) continue;
      p.carVel += p.carAccel * dt;
      p.carPos += p.carVel * dt;
      // Live score bleed once signed.
      if (p.signed) {
        p.delaScore = Math.max(0, DELA_MAX - (DELA_DECAY * (now - p.signAt)) / 1000);
      }
      if (p.carPos >= 1) {
        p.carPos = 1;
        p.delaDone = true;
        // Final DELA score: 0 if never signed, else the frozen bled value.
        p.delaScore = p.signed
          ? Math.max(0, Math.round(DELA_MAX - (DELA_DECAY * (now - p.signAt)) / 1000))
          : 0;
      }
    }
    if ([...this.players.values()].every((p) => p.delaDone)) this.startWait();
  }

  private startWait(): void {
    this.phase = "wartezeit";
    this.waitStart = Date.now();
    this.nextWaveAt = this.waitStart + 700; // brief beat before the first bar
    this.lastGapStart = Math.floor((COLS - 3) / 2);
    for (const p of this.players.values()) {
      p.x = 0.5;
      p.dir = 0;
      p.waitAlive = true;
      p.waitDone = false;
    }
  }

  private elapsedWait(): number {
    return (Date.now() - this.waitStart) / 1000;
  }

  private fallSpeed(e: number): number {
    return Math.min(1.8, 0.8 + 0.03 * e);
  }
  private waveInterval(e: number): number {
    return Math.max(0.35, 0.9 - 0.016 * e);
  }
  private gapCols(e: number): number {
    // A short grace, then a tight hole, then a single-column needle late on —
    // every wave stays passable, but the pace makes a slip inevitable.
    return e < 6 ? 3 : e < 22 ? 2 : 1;
  }

  private spawnWave(e: number): void {
    const gapCols = this.gapCols(e);
    const lo = Math.max(0, this.lastGapStart - GAP_SHIFT);
    const hi = Math.min(COLS - gapCols, this.lastGapStart + GAP_SHIFT);
    const gapStart = lo + Math.floor(Math.random() * (hi - lo + 1));
    this.lastGapStart = gapStart;
    this.waves.push({ gapStart, gapCols, y: -BLOCK_H });
  }

  private tickWait(dt: number): void {
    const now = Date.now();
    const e = this.elapsedWait();
    const fall = this.fallSpeed(e);

    // Spawn waves on the shrinking interval.
    if (now >= this.nextWaveAt) {
      this.spawnWave(e);
      this.nextWaveAt = now + this.waveInterval(e) * 1000;
    }

    // Advance the bars; drop ones that have fallen off the bottom.
    for (const w of this.waves) w.y += fall * dt;
    this.waves = this.waves.filter((w) => w.y <= 1.2);

    const rate = WAIT_BASE + WAIT_RAMP * e;
    for (const p of this.players.values()) {
      if (!p.waitAlive) continue;
      // Move + clamp.
      p.x = Math.max(CHAR_W / 2, Math.min(1 - CHAR_W / 2, p.x + p.dir * PLAYER_SPEED * dt));
      // Score for staying alive (later seconds worth more).
      p.waitScore += rate * dt;
      // Collision: a bar overlapping the character's row kills unless the
      // character sits entirely within that bar's hole.
      const cl = p.x - CHAR_W / 2;
      const cr = p.x + CHAR_W / 2;
      for (const w of this.waves) {
        if (CHAR_Y < w.y || CHAR_Y > w.y + BLOCK_H) continue; // not at our row yet
        const gapL = w.gapStart * COL_W;
        const gapR = (w.gapStart + w.gapCols) * COL_W;
        if (cl < gapL || cr > gapR) {
          p.waitAlive = false;
          p.waitDone = true;
          p.waitScore = Math.round(p.waitScore);
          break;
        }
      }
    }
    if ([...this.players.values()].every((p) => !p.waitAlive)) this.phase = "done";
  }

  // --- disconnect / forfeit ----------------------------------------------

  /** Force a player out of whatever act is running so the round can resolve. */
  finishPlayer(id: string): void {
    const p = this.players.get(id);
    if (!p) return;
    if (!p.delaDone) {
      p.delaDone = true;
      p.delaScore = p.signed
        ? Math.max(0, Math.round(DELA_MAX - (DELA_DECAY * (Date.now() - p.signAt)) / 1000))
        : 0;
    }
    if (p.waitAlive) {
      p.waitAlive = false;
      p.waitDone = true;
      p.waitScore = Math.round(p.waitScore);
    }
    if (this.phase === "dela" && [...this.players.values()].every((q) => q.delaDone)) {
      this.startWait();
    } else if (this.phase === "wartezeit" && [...this.players.values()].every((q) => !q.waitAlive)) {
      this.phase = "done";
    }
  }

  // --- views --------------------------------------------------------------

  private dot(p: SP): SterbegeldDot {
    const total = Math.round(p.delaScore + p.waitScore);
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      carPos: p.carPos,
      signed: p.signed,
      delaDone: p.delaDone,
      delaScore: Math.round(p.delaScore),
      x: p.x,
      waitAlive: p.waitAlive,
      waitScore: Math.round(p.waitScore),
      total,
    };
  }

  private blockList(): SterbegeldBlock[] {
    if (this.phase !== "wartezeit") return [];
    const out: SterbegeldBlock[] = [];
    for (const w of this.waves) {
      // Left filled segment [0, gapStart) and right [gapStart+gapCols, COLS).
      if (w.gapStart > 0) {
        out.push({ x: 0, y: w.y, w: w.gapStart * COL_W, h: BLOCK_H });
      }
      const rightStart = w.gapStart + w.gapCols;
      if (rightStart < COLS) {
        out.push({ x: rightStart * COL_W, y: w.y, w: (COLS - rightStart) * COL_W, h: BLOCK_H });
      }
    }
    return out;
  }

  state(): SterbegeldStatePayload {
    return {
      phase: this.phase,
      players: this.order.map((id) => this.dot(this.players.get(id)!)),
      blocks: this.blockList(),
    };
  }

  playerIds(): string[] {
    return [...this.players.keys()];
  }

  isComplete(): boolean {
    return this.phase === "done";
  }

  statsFor(id: string): SterbegeldStats {
    const p = this.players.get(id);
    if (!p) return { delaScore: 0, waitScore: 0, total: 0 };
    const delaScore = Math.round(p.delaScore);
    const waitScore = Math.round(p.waitScore);
    return { delaScore, waitScore, total: delaScore + waitScore };
  }

  /** Highest combined score first. */
  ranking(): string[] {
    return this.playerIds().sort((a, b) => this.statsFor(b).total - this.statsFor(a).total);
  }
}
