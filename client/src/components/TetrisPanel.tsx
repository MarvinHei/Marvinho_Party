import { useEffect, useMemo, useRef, useState } from "react";
import { TETRIS_CONFIG } from "@marvinho/shared";
import { store } from "../state/store.js";
import { sfx, audio } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";

const COLS = TETRIS_CONFIG.cols;
const ROWS = TETRIS_CONFIG.rows;
const CELL = 26;

type Piece = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

const PIECES: Piece[] = ["I", "O", "T", "S", "Z", "J", "L"];

const COLORS: Record<string, string> = {
  I: "#28e0d0",
  O: "#ffd23f",
  T: "#b06bff",
  S: "#42d17a",
  Z: "#e6394b",
  J: "#3aa0ff",
  L: "#ff8c42",
  G: "#6b6b8a",
  ".": "",
};

// Rotation states: for each piece, 4 rotations of 4 [x,y] cells (within a box).
const SHAPES: Record<Piece, [number, number][][]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

const KICKS: [number, number][] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Active {
  type: Piece;
  rot: number;
  x: number;
  y: number;
}

class Engine {
  readonly rows: number;
  grid: string[][];
  active: Active | null = null;
  hold: Piece | null = null;
  canHold = true;
  bag: Piece[] = [];
  rng: () => number;
  lines = 0;
  pendingGarbage: { rows: number; hole: number }[] = [];
  dead = false;
  /** Lines cleared this lock, to report to the server. */
  lastSent = 0;

  constructor(seed: number, rows: number = ROWS) {
    this.rows = rows;
    this.grid = Array.from({ length: rows }, () => Array<string>(COLS).fill("."));
    this.rng = mulberry32(seed);
  }

  private refill(): void {
    const bag = [...PIECES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.bag.push(...bag);
  }

  next(): Piece {
    if (this.bag.length < 1) this.refill();
    return this.bag.shift()!;
  }

  cells(a: Active): [number, number][] {
    return SHAPES[a.type][a.rot].map(([cx, cy]) => [a.x + cx, a.y + cy]);
  }

  collides(a: Active): boolean {
    for (const [gx, gy] of this.cells(a)) {
      if (gx < 0 || gx >= COLS || gy >= this.rows) return true;
      if (gy >= 0 && this.grid[gy][gx] !== ".") return true;
    }
    return false;
  }

  spawn(type?: Piece): void {
    const t = type ?? this.next();
    const a: Active = { type: t, rot: 0, x: 3, y: 0 };
    if (this.collides(a)) {
      this.dead = true;
      this.active = null;
      return;
    }
    this.active = a;
    this.canHold = true;
  }

  move(dx: number, dy: number): boolean {
    if (!this.active) return false;
    const a = { ...this.active, x: this.active.x + dx, y: this.active.y + dy };
    if (this.collides(a)) return false;
    this.active = a;
    return true;
  }

  rotate(dir: number): void {
    if (!this.active) return;
    const rot = (this.active.rot + dir + 4) % 4;
    for (const [kx, ky] of KICKS) {
      const a = { ...this.active, rot, x: this.active.x + kx, y: this.active.y + ky };
      if (!this.collides(a)) {
        this.active = a;
        return;
      }
    }
  }

  holdSwap(): void {
    if (!this.active || !this.canHold) return;
    const cur = this.active.type;
    if (this.hold) {
      const h = this.hold;
      this.hold = cur;
      this.spawn(h);
    } else {
      this.hold = cur;
      this.spawn();
    }
    this.canHold = false;
  }

  ghostY(): number {
    if (!this.active) return 0;
    let a = { ...this.active };
    while (!this.collides({ ...a, y: a.y + 1 })) a = { ...a, y: a.y + 1 };
    return a.y;
  }

  /** Lock the active piece, clear lines, flush garbage, spawn next. */
  lock(): void {
    if (!this.active) return;
    for (const [gx, gy] of this.cells(this.active)) {
      if (gy < 0) {
        this.dead = true;
        this.active = null;
        return;
      }
      this.grid[gy][gx] = this.active.type;
    }
    this.active = null;

    // Clear full rows.
    let cleared = 0;
    for (let y = this.rows - 1; y >= 0; y--) {
      if (this.grid[y].every((c) => c !== ".")) {
        this.grid.splice(y, 1);
        this.grid.unshift(Array<string>(COLS).fill("."));
        cleared++;
        y++;
      }
    }
    this.lines += cleared;
    this.lastSent = cleared;

    // Pending garbage from opponents lands as soon as the current piece locks.
    this.flushGarbage();

    this.spawn();
  }

  addGarbage(rows: number, hole: number): void {
    this.pendingGarbage.push({ rows, hole });
  }

  private flushGarbage(): void {
    while (this.pendingGarbage.length > 0) {
      const { rows, hole } = this.pendingGarbage.shift()!;
      for (let i = 0; i < rows; i++) {
        const top = this.grid[0];
        if (top.some((c) => c !== ".")) {
          this.dead = true;
          return;
        }
        this.grid.shift();
        const row = Array<string>(COLS).fill("G");
        row[hole] = ".";
        this.grid.push(row);
      }
    }
  }

  /** Compose the render grid (locked + active) as a flat cells string. */
  serialize(): string {
    const flat = this.grid.map((r) => [...r]);
    if (this.active) {
      for (const [gx, gy] of this.cells(this.active)) {
        if (gy >= 0 && gy < this.rows && gx >= 0 && gx < COLS) flat[gy][gx] = this.active.type;
      }
    }
    return flat.map((r) => r.join("")).join("");
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  cells: string,
  cell: number,
  rows: number,
  ghost?: [number, number][],
) {
  const w = COLS * cell;
  const h = rows * cell;
  ctx.fillStyle = "#0b0a1e";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell, 0);
    ctx.lineTo(x * cell, h);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell);
    ctx.lineTo(w, y * cell);
    ctx.stroke();
  }
  if (ghost) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (const [gx, gy] of ghost) {
      if (gy >= 0) ctx.fillRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
    }
  }
  for (let i = 0; i < cells.length; i++) {
    const ch = cells[i];
    if (ch === ".") continue;
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    ctx.fillStyle = COLORS[ch] ?? "#888";
    ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, 3);
  }
}

export function TetrisPanel({ seat }: { seat: SeatState }) {
  const init = seat.tetris;
  const net = store.net(seat.id);
  const me = seat.playerId;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engRef = useRef<Engine | null>(null);
  const [dead, setDead] = useState(false);
  const [lines, setLines] = useState(0);
  const [pending, setPending] = useState(0);
  const [target, setTarget] = useState<string>("random");
  const garbageProcessed = useRef(0);

  // Swap the idle music for the Tetris track for the duration of the match.
  useEffect(() => {
    audio.startGameMusic("/audio/tetris.mp3");
    return () => audio.stopGameMusic();
  }, []);
  // On-screen control actions, wired up inside the engine effect below.
  const actionsRef = useRef<{
    left: () => void;
    right: () => void;
    rotate: () => void;
    hold: () => void;
    hardDrop: () => void;
    setSoft: (on: boolean) => void;
  } | null>(null);

  const opponents = useMemo(
    () => (init?.players ?? []).filter((p) => p.id !== me),
    [init, me],
  );

  // --- engine lifecycle ---------------------------------------------------
  useEffect(() => {
    if (!init) return;
    const eng = new Engine(init.seed, init.rows);
    engRef.current = eng;
    eng.spawn();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let sinceSnap = 0;
    const soft = { on: false };

    const sync = () => {
      setDead(eng.dead);
      setLines(eng.lines);
      setPending(eng.pendingGarbage.reduce((s, g) => s + g.rows, 0));
    };
    const sendBoard = () => net?.tetrisBoard(eng.serialize(), eng.lines);

    const afterLock = () => {
      // A cleared line gets the brighter sweep; a plain landing gets the thud.
      sfx(eng.lastSent > 0 ? "lineclear" : "lock");
      if (eng.lastSent > 0) net?.tetrisLines(eng.lastSent);
      eng.lastSent = 0;
      sendBoard();
      if (eng.dead) net?.tetrisDead();
      sync();
    };

    const draw = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const ghost = eng.active
        ? SHAPES[eng.active.type][eng.active.rot].map(
            ([cx, cy]) => [eng.active!.x + cx, eng.ghostY() + cy] as [number, number],
          )
        : undefined;
      drawGrid(ctx, eng.serialize(), CELL, eng.rows, ghost);
    };

    const startsIn = () => init.startsAt - Date.now();

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      raf = requestAnimationFrame(loop);
      if (eng.dead) {
        draw();
        return;
      }
      if (startsIn() > 0) {
        draw();
        return;
      }
      const interval = soft.on ? 45 : Math.max(140, 750 - eng.lines * 12);
      acc += dt;
      sinceSnap += dt;
      if (acc >= interval) {
        acc = 0;
        if (!eng.move(0, 1)) {
          eng.lock();
          afterLock();
        }
      }
      if (sinceSnap >= 250) {
        sinceSnap = 0;
        sendBoard();
      }
      draw();
    };
    raf = requestAnimationFrame(loop);
    sendBoard();

    const onKeyDown = (e: KeyboardEvent) => {
      if (eng.dead) return;
      if (startsIn() > 0) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          eng.move(-1, 0);
          draw();
          break;
        case "ArrowRight":
          e.preventDefault();
          eng.move(1, 0);
          draw();
          break;
        case "ArrowUp":
        case "x":
          e.preventDefault();
          eng.rotate(1);
          draw();
          break;
        case "z":
          e.preventDefault();
          eng.rotate(-1);
          draw();
          break;
        case "ArrowDown":
          e.preventDefault();
          soft.on = true;
          break;
        case " ":
          e.preventDefault();
          while (eng.move(0, 1)) {
            /* hard drop */
          }
          eng.lock();
          afterLock();
          acc = 0;
          draw();
          break;
        case "c":
        case "Shift":
          e.preventDefault();
          eng.holdSwap();
          sync();
          draw();
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") soft.on = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Wire up on-screen (touch) controls to the same engine actions.
    const guard = () => !eng.dead && startsIn() <= 0;
    actionsRef.current = {
      left: () => { if (guard()) { eng.move(-1, 0); draw(); } },
      right: () => { if (guard()) { eng.move(1, 0); draw(); } },
      rotate: () => { if (guard()) { eng.rotate(1); draw(); } },
      hold: () => { if (guard()) { eng.holdSwap(); sync(); draw(); } },
      hardDrop: () => {
        if (!guard()) return;
        while (eng.move(0, 1)) { /* hard drop */ }
        eng.lock();
        afterLock();
        acc = 0;
        draw();
      },
      setSoft: (on: boolean) => { soft.on = on; },
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      actionsRef.current = null;
      engRef.current = null;
    };
    // Re-create the engine only when a new match is initialized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init?.seed]);

  // --- apply incoming garbage --------------------------------------------
  useEffect(() => {
    const eng = engRef.current;
    if (!eng) return;
    for (const g of seat.tetrisGarbage) {
      if (g.seq >= garbageProcessed.current) {
        eng.addGarbage(g.rows, g.hole);
        garbageProcessed.current = g.seq + 1;
      }
    }
    setPending(eng.pendingGarbage.reduce((s, x) => s + x.rows, 0));
  }, [seat.tetrisGarbage]);

  // --- keep the target valid as opponents get knocked out -----------------
  useEffect(() => {
    if (target === "random") return;
    if (!seat.tetrisAlive.includes(target)) {
      setTarget("random");
      net?.tetrisTarget("random");
    }
  }, [seat.tetrisAlive, target, net]);

  function chooseTarget(id: string) {
    setTarget(id);
    net?.tetrisTarget(id);
  }

  if (!init) {
    return (
      <div className="center-stage">
        <div className="panel"><h2 className="pixel">Setting up Tetris…</h2></div>
      </div>
    );
  }

  const boardsById = new Map(seat.tetrisBoards.map((b) => [b.playerId, b]));

  return (
    <div className="tetris-wrap">
      <div className="tetris-main">
        <div className="tetris-hud">
          <div className="pixel">Lines <b style={{ color: "var(--accent)" }}>{lines}</b></div>
          {pending > 0 && <div className="tetris-danger pixel">⚠ +{pending} incoming</div>}
        </div>
        <div className="tetris-board-frame">
          <canvas
            ref={canvasRef}
            width={COLS * CELL}
            height={(init?.rows ?? ROWS) * CELL}
            className="tetris-canvas"
          />
          {dead && (
            <div className="tetris-ko">
              <span className="pixel">KO'd</span>
              <span className="hint">Waiting for the match to end…</span>
            </div>
          )}
        </div>
        <div className="tetris-help hint">
          ← → move · ↑ rotate · ↓ soft drop · Space hard drop · C hold
        </div>

        <div className="tetris-controls">
          <button
            className="tctl"
            aria-label="Move left"
            onPointerDown={(e) => { e.preventDefault(); actionsRef.current?.left(); }}
          >◀</button>
          <button
            className="tctl"
            aria-label="Rotate"
            onPointerDown={(e) => { e.preventDefault(); actionsRef.current?.rotate(); }}
          >⟳</button>
          <button
            className="tctl"
            aria-label="Move right"
            onPointerDown={(e) => { e.preventDefault(); actionsRef.current?.right(); }}
          >▶</button>
          <button
            className="tctl"
            aria-label="Hold"
            onPointerDown={(e) => { e.preventDefault(); actionsRef.current?.hold(); }}
          >Hold</button>
          <button
            className="tctl"
            aria-label="Soft drop"
            onPointerDown={(e) => { e.preventDefault(); actionsRef.current?.setSoft(true); }}
            onPointerUp={() => actionsRef.current?.setSoft(false)}
            onPointerLeave={() => actionsRef.current?.setSoft(false)}
            onPointerCancel={() => actionsRef.current?.setSoft(false)}
          >▼</button>
          <button
            className="tctl drop"
            aria-label="Hard drop"
            onPointerDown={(e) => { e.preventDefault(); actionsRef.current?.hardDrop(); }}
          >⤓</button>
        </div>
      </div>

      <div className="tetris-side">
        <div className="fw-side-title pixel">Send lines to</div>
        <div className="tetris-targets">
          <button
            className={`tetris-target${target === "random" ? " on" : ""}`}
            onClick={() => chooseTarget("random")}
            title="Automatically attack whoever's in the lead"
          >
            🎯 Auto (leader)
          </button>
          {opponents.map((op) => {
            const alive = seat.tetrisAlive.includes(op.id);
            return (
              <button
                key={op.id}
                className={`tetris-target${target === op.id ? " on" : ""}${alive ? "" : " out"}`}
                disabled={!alive}
                onClick={() => chooseTarget(op.id)}
              >
                <span className="swatch" style={{ background: op.color }} />
                {op.nickname} {alive ? "" : "💀"}
              </button>
            );
          })}
        </div>

        <div className="fw-side-title pixel">Opponents</div>
        <div className="tetris-opps">
          {opponents.map((op) => {
            const b = boardsById.get(op.id);
            const alive = seat.tetrisAlive.includes(op.id);
            return (
              <div key={op.id} className={`tetris-opp${alive ? "" : " out"}`}>
                <MiniBoard cells={b?.cells ?? ""} />
                <div className="tetris-opp-name" style={{ color: op.color }}>
                  {op.nickname}
                </div>
                <div className="tetris-opp-lines">{b?.lines ?? 0} lines{alive ? "" : " · 💀"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniBoard({ cells }: { cells: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const mini = 8;
  // Rows are derived from the snapshot so it matches the configured board height.
  const rows = cells.length ? Math.round(cells.length / COLS) : ROWS;
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0b0a1e";
    ctx.fillRect(0, 0, COLS * mini, rows * mini);
    for (let i = 0; i < cells.length; i++) {
      const ch = cells[i];
      if (ch === ".") continue;
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      ctx.fillStyle = COLORS[ch] ?? "#888";
      ctx.fillRect(x * mini, y * mini, mini - 1, mini - 1);
    }
  }, [cells, rows]);
  return <canvas ref={ref} width={COLS * mini} height={rows * mini} className="tetris-mini" />;
}
