import type { PongPowerKind, PongStatePayload } from "@marvinho/shared";

// Field is normalized 0..1 on both axes; the client renders it into a wide box.
const PAD_X_L = 0.04;
const PAD_X_R = 0.96;
const PAD_HALF = 0.09; // half paddle height
const BALL_R = 0.018;
const BASE_SPEED = 0.62; // field-widths per second
const MAX_SPEED = 1.5;
const SPEEDUP = 1.06; // per paddle hit
const CPU_SPEED = 0.78; // slightly slower than the ball, so it's beatable
const SERVE_DELAY = 0.8; // seconds the ball waits at center after a point

// --- power-ups (awarded to whoever scores a point) ---
const POWER_MS = 9000; // how long a scored power-up lasts
const FAST_SPEED = 1.35; // instant ball speed on a "fast" bounce (>= MAX_SPEED)
const SHRINK_HALF = 0.05; // opponent paddle half-height while "shrink" is active

interface Slot {
  playerId: string | null; // null = CPU
  name: string;
  color: string;
}

interface Match {
  id: string;
  left: Slot;
  right: Slot;
  padL: number;
  padR: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  speed: number;
  scoreL: number;
  scoreR: number;
  serveTimer: number; // >0 → ball frozen at center
  over: boolean;
  winner: "left" | "right" | null;
  /** Active power-up per side + its expiry (ms epoch). */
  powerL: PongPowerKind | null;
  powerR: PongPowerKind | null;
  powerUntilL: number;
  powerUntilR: number;
}

export interface PongPlayer {
  id: string;
  nickname: string;
  color: string;
}

export interface PongStats {
  won: boolean;
  scored: number;
  conceded: number;
  vsCpu: boolean;
}

const CPU_SLOT = (): Slot => ({ playerId: null, name: "CPU", color: "#8a8aa8" });

export class PongRound {
  private matches: Match[] = [];
  /** playerId → its match + side. */
  private index = new Map<string, { match: Match; side: "left" | "right" }>();

  constructor(players: PongPlayer[], readonly target: number) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i += 2) {
      const a = shuffled[i];
      const b = shuffled[i + 1];
      const left: Slot = { playerId: a.id, name: a.nickname, color: a.color };
      const right: Slot = b
        ? { playerId: b.id, name: b.nickname, color: b.color }
        : CPU_SLOT();
      const m: Match = {
        id: `m${i / 2}`,
        left,
        right,
        padL: 0.5,
        padR: 0.5,
        ballX: 0.5,
        ballY: 0.5,
        vx: 0,
        vy: 0,
        speed: BASE_SPEED,
        scoreL: 0,
        scoreR: 0,
        serveTimer: SERVE_DELAY,
        over: false,
        winner: null,
        powerL: null,
        powerR: null,
        powerUntilL: 0,
        powerUntilR: 0,
      };
      this.serve(m, Math.random() < 0.5 ? "left" : "right");
      this.matches.push(m);
      this.index.set(a.id, { match: m, side: "left" });
      if (b) this.index.set(b.id, { match: m, side: "right" });
    }
  }

  /** Aim a fresh serve toward `toward`, frozen at center for SERVE_DELAY. */
  private serve(m: Match, toward: "left" | "right") {
    m.ballX = 0.5;
    m.ballY = 0.5;
    m.speed = BASE_SPEED;
    const dir = toward === "right" ? 1 : -1;
    const angle = (Math.random() - 0.5) * 0.6; // small vertical spread
    m.vx = dir * BASE_SPEED * Math.cos(angle);
    m.vy = BASE_SPEED * Math.sin(angle);
    m.serveTimer = SERVE_DELAY;
  }

  /** Expire any lapsed power-ups on a match. */
  private agePowers(m: Match, now: number) {
    if (m.powerL && now >= m.powerUntilL) m.powerL = null;
    if (m.powerR && now >= m.powerUntilR) m.powerR = null;
  }

  /** Effective paddle half-height: shrinks while the OPPONENT holds "shrink". */
  private halfFor(m: Match, side: "left" | "right"): number {
    const foePower = side === "left" ? m.powerR : m.powerL;
    return foePower === "shrink" ? SHRINK_HALF : PAD_HALF;
  }

  setPaddle(playerId: string, y: number) {
    const e = this.index.get(playerId);
    if (!e || e.match.over) return;
    const half = this.halfFor(e.match, e.side);
    const clamped = Math.max(half, Math.min(1 - half, y));
    if (e.side === "left") e.match.padL = clamped;
    else e.match.padR = clamped;
  }

  /** Advance every match by `dt` seconds. */
  tick(dt: number) {
    const now = Date.now();
    for (const m of this.matches) {
      if (m.over) continue;
      this.agePowers(m, now);
      // CPU paddles track the ball with a capped speed.
      if (m.left.playerId === null) this.moveCpu(m, "left", dt);
      if (m.right.playerId === null) this.moveCpu(m, "right", dt);

      if (m.serveTimer > 0) {
        m.serveTimer = Math.max(0, m.serveTimer - dt);
        continue;
      }

      m.ballX += m.vx * dt;
      m.ballY += m.vy * dt;

      // Top / bottom walls.
      if (m.ballY < BALL_R) {
        m.ballY = BALL_R;
        m.vy = Math.abs(m.vy);
      } else if (m.ballY > 1 - BALL_R) {
        m.ballY = 1 - BALL_R;
        m.vy = -Math.abs(m.vy);
      }

      // Left paddle.
      if (m.vx < 0 && m.ballX - BALL_R <= PAD_X_L) {
        if (Math.abs(m.ballY - m.padL) <= this.halfFor(m, "left") + BALL_R) {
          this.bounce(m, "left");
        } else if (m.ballX < 0) {
          this.score(m, "right");
        }
      }
      // Right paddle.
      if (m.vx > 0 && m.ballX + BALL_R >= PAD_X_R) {
        if (Math.abs(m.ballY - m.padR) <= this.halfFor(m, "right") + BALL_R) {
          this.bounce(m, "right");
        } else if (m.ballX > 1) {
          this.score(m, "left");
        }
      }
    }
  }

  private moveCpu(m: Match, side: "left" | "right", dt: number) {
    const towardMe = side === "left" ? m.vx < 0 : m.vx > 0;
    const pad = side === "left" ? m.padL : m.padR;
    // Aim at the ball when it's coming, otherwise drift toward center.
    const target = towardMe ? m.ballY : 0.5;
    const max = CPU_SPEED * dt;
    let next = pad;
    if (target > pad + 0.005) next = Math.min(target, pad + max);
    else if (target < pad - 0.005) next = Math.max(target, pad - max);
    next = Math.max(PAD_HALF, Math.min(1 - PAD_HALF, next));
    if (side === "left") m.padL = next;
    else m.padR = next;
  }

  private bounce(m: Match, side: "left" | "right") {
    const pad = side === "left" ? m.padL : m.padR;
    const offset = Math.max(-1, Math.min(1, (m.ballY - pad) / this.halfFor(m, side)));
    m.speed = Math.min(m.speed * SPEEDUP, MAX_SPEED);
    // "fast" power: this side's paddle rockets the ball back.
    const power = side === "left" ? m.powerL : m.powerR;
    if (power === "fast") m.speed = Math.max(m.speed, FAST_SPEED);
    const angle = offset * (Math.PI * 0.38); // up to ~68°
    const dir = side === "left" ? 1 : -1;
    m.vx = dir * m.speed * Math.cos(angle);
    m.vy = m.speed * Math.sin(angle);
    // Nudge the ball out of the paddle so it can't re-collide next frame.
    m.ballX = side === "left" ? PAD_X_L + BALL_R + 0.001 : PAD_X_R - BALL_R - 0.001;
  }

  /** Grant the scorer one of the two power-ups. */
  private awardPower(m: Match, scorer: "left" | "right") {
    const kind: PongPowerKind = Math.random() < 0.5 ? "fast" : "shrink";
    const until = Date.now() + POWER_MS;
    if (scorer === "left") { m.powerL = kind; m.powerUntilL = until; }
    else { m.powerR = kind; m.powerUntilR = until; }
  }

  private score(m: Match, scorer: "left" | "right") {
    if (scorer === "left") m.scoreL++;
    else m.scoreR++;
    // The player who put the ball through earns a power-up for the next rallies.
    this.awardPower(m, scorer);
    if (m.scoreL >= this.target || m.scoreR >= this.target) {
      m.over = true;
      m.winner = m.scoreL > m.scoreR ? "left" : "right";
      m.ballX = 0.5;
      m.ballY = 0.5;
      m.vx = 0;
      m.vy = 0;
      return;
    }
    // Serve toward the player who just conceded.
    this.serve(m, scorer === "left" ? "right" : "left");
  }

  stateFor(playerId: string): PongStatePayload | null {
    const e = this.index.get(playerId);
    if (!e) return null;
    const m = e.match;
    return {
      ballX: m.ballX,
      ballY: m.ballY,
      padL: m.padL,
      padR: m.padR,
      padHalfL: this.halfFor(m, "left"),
      padHalfR: this.halfFor(m, "right"),
      powerL: m.powerL,
      powerR: m.powerR,
      scoreL: m.scoreL,
      scoreR: m.scoreR,
      over: m.over,
      winner: m.winner,
    };
  }

  initFor(playerId: string): {
    side: "left" | "right";
    self: Slot;
    opponent: Slot;
    vsCpu: boolean;
  } | null {
    const e = this.index.get(playerId);
    if (!e) return null;
    const m = e.match;
    const self = e.side === "left" ? m.left : m.right;
    const opponent = e.side === "left" ? m.right : m.left;
    return { side: e.side, self, opponent, vsCpu: opponent.playerId === null };
  }

  playerIds(): string[] {
    return [...this.index.keys()];
  }

  isComplete(): boolean {
    return this.matches.every((m) => m.over);
  }

  statsFor(playerId: string): PongStats {
    const e = this.index.get(playerId);
    if (!e) return { won: false, scored: 0, conceded: 0, vsCpu: false };
    const m = e.match;
    const mine = e.side === "left" ? m.scoreL : m.scoreR;
    const theirs = e.side === "left" ? m.scoreR : m.scoreL;
    return {
      won: m.winner === e.side,
      scored: mine,
      conceded: theirs,
      vsCpu: (e.side === "left" ? m.right : m.left).playerId === null,
    };
  }

  /** Winners first, then by score margin. */
  ranking(): string[] {
    return this.playerIds().sort((a, b) => {
      const sa = this.statsFor(a);
      const sb = this.statsFor(b);
      if (sa.won !== sb.won) return sa.won ? -1 : 1;
      return sb.scored - sb.conceded - (sa.scored - sa.conceded);
    });
  }
}
