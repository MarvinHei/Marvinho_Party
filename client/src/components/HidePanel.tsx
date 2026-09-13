import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import type { HideStatePayload } from "@marvinho/shared";
import { drawToken, drawKnife } from "./pixelChar.js";
import { PosSmoother } from "./interp.js";

const TILE = 28;
const VISION = 7; // must match the server
const STAB_MS = 300; // knife-thrust animation length

export function HidePanel({ seat }: { seat: SeatState }) {
  const hide = seat.hide;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapRef = useRef<HideStatePayload | null>(hide?.snap ?? null);
  const keys = useRef<Set<string>>(new Set());
  const lastDir = useRef({ dx: 0, dy: 0 });
  const [, setTick] = useState(0);
  const caughtRef = useRef(false);
  // Local seeker aim + knife-stab animation (cursor is in tile coords).
  const cursor = useRef({ x: 0, y: 0 });
  const stab = useRef({ at: -1, angle: 0 });
  const smoother = useRef(new PosSmoother());
  const lastT = useRef(performance.now());

  const init = hide?.init;
  const isSeeker = init?.role === "seeker";
  const cols = init?.cols ?? 34;
  const rows = init?.rows ?? 20;
  const walls = init?.walls ?? "";

  useEffect(() => {
    snapRef.current = hide?.snap ?? null;
    if (hide?.snap?.meCaught && !caughtRef.current) {
      caughtRef.current = true;
      sfx("wrong");
    }
  }, [hide?.snap]);

  // 1s ticker for the countdown / HUD text.
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(i);
  }, []);

  // Keyboard movement.
  useEffect(() => {
    const net = store.net(seat.id);
    const send = () => {
      let dx = 0;
      let dy = 0;
      const k = keys.current;
      if (k.has("a") || k.has("arrowleft")) dx -= 1;
      if (k.has("d") || k.has("arrowright")) dx += 1;
      if (k.has("w") || k.has("arrowup")) dy -= 1;
      if (k.has("s") || k.has("arrowdown")) dy += 1;
      if (dx !== lastDir.current.dx || dy !== lastDir.current.dy) {
        lastDir.current = { dx, dy };
        net?.hideMove(dx, dy);
      }
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === " " || key === "spacebar") {
        e.preventDefault();
        if (e.repeat) return;
        if (isSeeker && snapRef.current?.released) {
          const me = snapRef.current.players.find((p) => p.id === seat.playerId);
          if (me) {
            stab.current = { at: performance.now(), angle: Math.atan2(cursor.current.y - me.y, cursor.current.x - me.x) };
          }
          store.net(seat.id)?.hideStab();
          sfx("stab");
        }
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        keys.current.add(key);
        send();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
      send();
    };
    const blur = () => {
      keys.current.clear();
      send();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [seat.id, seat.playerId, isSeeker]);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = cols * TILE;
    const H = rows * TILE;
    let raf = 0;
    const draw = () => {
      const s = snapRef.current;
      // Floor.
      ctx.fillStyle = "#171433";
      ctx.fillRect(0, 0, W, H);
      // Walls.
      ctx.fillStyle = "#3a3170";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (walls[y * cols + x] === "1") {
            ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
          }
        }
      }
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT.current) / 1000);
      lastT.current = now;
      let meDisp: { x: number; y: number } | null = null;
      // Players — the same pixel characters as on the board (smoothed).
      if (s) {
        smoother.current.begin();
        for (const p of s.players) {
          const sp = smoother.current.step(p.id, p.x, p.y, dt, 0.06);
          const isMe = p.id === seat.playerId;
          if (isMe) meDisp = sp;
          const px = sp.x * TILE;
          const py = sp.y * TILE;
          drawToken(ctx, px, py, TILE * 0.86, p.color, { me: isMe, alive: !p.caught });

          // Seeker carries a knife; the local seeker's thrusts are animated.
          if (p.role === "seeker" && !p.caught) {
            let angle = isMe ? Math.atan2(cursor.current.y - sp.y, cursor.current.x - sp.x) : 0;
            let reach = TILE * 0.5;
            if (isMe && stab.current.at >= 0) {
              const prog = (now - stab.current.at) / STAB_MS;
              if (prog <= 1) {
                angle = stab.current.angle;
                reach += Math.sin(prog * Math.PI) * TILE * 0.9; // thrust out and back
              }
            }
            ctx.globalAlpha = p.caught ? 0.35 : 1;
            drawKnife(ctx, px, py, angle, reach, TILE * 0.7);
            ctx.globalAlpha = 1;
          }

          // Name.
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(isMe ? "YOU" : p.name, px, py - TILE * 0.48 - 2);
        }
        smoother.current.end();
      }
      // Seeker fog: darken beyond the vision radius.
      if (isSeeker && meDisp) {
        const grad = ctx.createRadialGradient(
          meDisp.x * TILE, meDisp.y * TILE, VISION * TILE * 0.55,
          meDisp.x * TILE, meDisp.y * TILE, VISION * TILE,
        );
        grad.addColorStop(0, "rgba(6,5,20,0)");
        grad.addColorStop(1, "rgba(6,5,20,0.82)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows, walls, isSeeker, seat.playerId]);

  function toTile(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    cursor.current = {
      x: ((e.clientX - rect.left) / rect.width) * cols,
      y: ((e.clientY - rect.top) / rect.height) * rows,
    };
  }
  function onStab(e: React.PointerEvent<HTMLCanvasElement>) {
    toTile(e);
    if (isSeeker && snapRef.current?.released) {
      const me = snapRef.current.players.find((p) => p.id === seat.playerId);
      if (me) stab.current = { at: performance.now(), angle: Math.atan2(cursor.current.y - me.y, cursor.current.x - me.x) };
      store.net(seat.id)?.hideStab();
      sfx("stab");
    }
  }

  if (!hide || !init) return null;
  const snap = hide.snap;
  const now = Date.now();
  const releaseIn = Math.max(0, Math.ceil((init.releaseAt - now) / 1000));
  const secsLeft = snap ? Math.ceil(snap.msLeft / 1000) : 0;
  const held = releaseIn > 0 && isSeeker;

  return (
    <div className="hide-wrap">
      <div className="hide-topbar">
        <span className="hide-role pixel" style={{ color: isSeeker ? "#e6394b" : "#42d17a" }}>
          {isSeeker ? "🔪 SEEKER" : "🫥 HIDER"}
        </span>
        <span className="hide-info pixel">{snap?.aliveHiders ?? "?"} hiders left</span>
        <span className="hide-info pixel">⏱ {secsLeft}s</span>
      </div>
      <div className="hide-field-frame" style={{ aspectRatio: `${cols} / ${rows}` }}>
        <canvas
          ref={canvasRef}
          width={cols * TILE}
          height={rows * TILE}
          className="hide-canvas"
          onPointerMove={toTile}
          onPointerDown={onStab}
        />
        {releaseIn > 0 && (
          <div className="hide-banner">
            {isSeeker
              ? `Hold… the hiders are hiding. Released in ${releaseIn}s`
              : `Hide! The seeker is released in ${releaseIn}s`}
          </div>
        )}
        {snap?.meCaught && (
          <div className="hide-over">
            <div className="pixel" style={{ color: "var(--bad)", fontSize: 22 }}>Caught! 🔪</div>
            <div className="hide-sub">spectating…</div>
          </div>
        )}
      </div>
      <div className="hide-hint pixel">
        {held
          ? "You're the seeker — get ready to hunt"
          : isSeeker
            ? "WASD to move · click or Space to stab a nearby hider"
            : "WASD to move · stay out of the seeker's sight"}
      </div>
    </div>
  );
}
