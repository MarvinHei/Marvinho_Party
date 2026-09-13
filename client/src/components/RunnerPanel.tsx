import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import type { RunnerObstacle, RunnerStatePayload } from "@marvinho/shared";
import { shadeHex, roundRect } from "./pixelChar.js";
import { smoothTowards } from "./interp.js";

const TILE = 26;

/** Draws a board-style pixel character (matching the board tokens). */
function drawChar(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number, // vertical pixel position of the feet (rises when jumping)
  groundY: number,
  color: string,
  opts: { ducking: boolean; airborne: boolean; isMe: boolean; phase: number; alive: boolean },
) {
  const { ducking, airborne, isMe, phase, alive } = opts;
  const bw = (ducking ? 1.1 : 0.82) * TILE;
  const bh = (ducking ? 0.78 : 1.42) * TILE;
  const top = footY - bh;
  const br = bw * 0.4;

  ctx.save();
  ctx.globalAlpha = alive ? 1 : 0.35;

  // Ground shadow (stays on the ground; shrinks as the character rises).
  const lift = Math.max(0, groundY - footY);
  const shScale = Math.max(0.4, 1 - lift / (TILE * 3));
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(footX, groundY + 2, bw * 0.5 * shScale, TILE * 0.16 * shScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (little feet), wiggling while running on the ground.
  if (!airborne) {
    const swing = Math.sin(phase) * TILE * 0.14;
    ctx.fillStyle = shadeHex(color, -0.4);
    for (const s of [-1, 1]) {
      const lx = footX + s * bw * 0.22 + (s > 0 ? swing : -swing);
      ctx.beginPath();
      ctx.ellipse(lx, footY - 1, TILE * 0.16, TILE * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Body: drop shadow, fill, belly highlight, dark outline.
  ctx.fillStyle = shadeHex(color, -0.28);
  roundRect(ctx, footX - bw / 2, top + 3, bw, bh, br);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, footX - bw / 2, top, bw, bh, br);
  ctx.fill();
  ctx.globalAlpha = (alive ? 1 : 0.35) * 0.55;
  ctx.fillStyle = shadeHex(color, 0.35);
  roundRect(ctx, footX - bw / 2 + bw * 0.16, top + bh * 0.12, bw * 0.68, bh * 0.34, br * 0.7);
  ctx.fill();
  ctx.globalAlpha = alive ? 1 : 0.35;
  ctx.lineWidth = Math.max(2, TILE * 0.09);
  ctx.strokeStyle = isMe ? "#ffffff" : "#0d0b22";
  roundRect(ctx, footX - bw / 2, top, bw, bh, br);
  ctx.stroke();

  // Face: eyes (white + pupil + glint) looking forward, and a mouth.
  const eyeR = TILE * 0.12;
  const eyeY = top + bh * 0.34;
  const eyeDX = bw * 0.2;
  for (const s of [-1, 1]) {
    const ex = footX + s * eyeDX + TILE * 0.04; // shift gaze toward the run direction
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14122e";
    ctx.beginPath();
    ctx.arc(ex + TILE * 0.03, eyeY + TILE * 0.01, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex - TILE * 0.03, eyeY - TILE * 0.03, eyeR * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(20,18,46,0.7)";
  ctx.fillRect(footX - TILE * 0.11, top + bh * (ducking ? 0.58 : 0.64), TILE * 0.22, TILE * 0.06);

  ctx.restore();
}

/** Hand-drawn pixel-art obstacle, matching the game's pixel aesthetic. */
function drawObstacle(ctx: CanvasRenderingContext2D, o: RunnerObstacle, groundY: number) {
  const x = o.x * TILE;
  const w = o.w * TILE;
  if (o.kind === "low") {
    const h = o.h * TILE;
    const top = groundY - h;
    if (o.variant === 0) {
      // Spiked rock.
      ctx.fillStyle = "#6b6480";
      roundRect(ctx, x, top, w, h, 4);
      ctx.fill();
      ctx.fillStyle = "#4a4560";
      ctx.beginPath();
      const n = Math.max(2, Math.round(o.w * 2));
      for (let i = 0; i < n; i++) {
        const sx = x + (i + 0.5) * (w / n);
        ctx.moveTo(sx - w / n / 2, top);
        ctx.lineTo(sx, top - TILE * 0.34);
        ctx.lineTo(sx + w / n / 2, top);
      }
      ctx.fill();
      ctx.strokeStyle = "#2a2740";
      ctx.lineWidth = 2;
      roundRect(ctx, x, top, w, h, 4);
      ctx.stroke();
    } else if (o.variant === 1) {
      // Wooden crate.
      ctx.fillStyle = "#b3762f";
      ctx.fillRect(x, top, w, h);
      ctx.fillStyle = "#8a561f";
      ctx.fillRect(x + 3, top + 3, w - 6, h - 6);
      ctx.strokeStyle = "#5c3a14";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, top + 1.5, w - 3, h - 3);
      ctx.beginPath();
      ctx.moveTo(x + 3, top + 3);
      ctx.lineTo(x + w - 3, top + h - 3);
      ctx.moveTo(x + w - 3, top + 3);
      ctx.lineTo(x + 3, top + h - 3);
      ctx.stroke();
    } else {
      // Cactus.
      ctx.fillStyle = "#3f9d54";
      const cw = w * 0.42;
      roundRect(ctx, x + w / 2 - cw / 2, top, cw, h, cw * 0.4);
      ctx.fill();
      roundRect(ctx, x + w * 0.1, top + h * 0.35, cw * 0.5, h * 0.4, 4);
      ctx.fill();
      roundRect(ctx, x + w * 0.66, top + h * 0.25, cw * 0.5, h * 0.5, 4);
      ctx.fill();
      ctx.strokeStyle = "#256b38";
      ctx.lineWidth = 2;
      roundRect(ctx, x + w / 2 - cw / 2, top, cw, h, cw * 0.4);
      ctx.stroke();
    }
  } else {
    // Hanging overhang you duck under. It descends from the top; the underside
    // is o.h tiles below the ceiling (the gap beneath is where you pass).
    const bottom = groundY - (13 - 2 - o.h) * TILE; // = ceiling..underside
    const top = 0;
    const h = bottom - top;
    ctx.fillStyle = o.variant === 0 ? "#5a5270" : "#7a4a8f";
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = o.variant === 0 ? "#433c57" : "#5e3670";
    ctx.fillRect(x + 3, top, w - 6, h - 4);
    // Bright underside edge so the duck gap reads clearly.
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(x - 2, bottom - 4, w + 4, 4);
    ctx.strokeStyle = "#241f33";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, top, w - 2, h);
    // A couple of hanging bolts/stalactites for texture.
    ctx.fillStyle = "#ffd23f";
    for (let i = 0; i < Math.max(1, Math.round(o.w)); i++) {
      ctx.fillRect(x + (i + 0.5) * (w / Math.max(1, Math.round(o.w))) - 1, bottom - 10, 2, 6);
    }
  }
}

export function RunnerPanel({ seat }: { seat: SeatState }) {
  const runner = seat.runner;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapRef = useRef<RunnerStatePayload | null>(runner?.snap ?? null);
  const keys = useRef<Set<string>>(new Set());
  const lastState = useRef({ dir: 0, duck: false });
  const [, setTick] = useState(0);
  const diedRef = useRef(false);
  // Smoothing: a global camera-distance ease (so the scroll is fluid) plus a
  // per-player vertical ease (so jumps don't step).
  const dispDist = useRef<number | null>(null);
  const hSmooth = useRef<Map<string, number>>(new Map());
  const lastT = useRef(performance.now());

  const init = runner?.init;
  const viewW = init?.viewW ?? 26;
  const viewH = init?.viewH ?? 13;
  const groundH = init?.groundH ?? 2;

  useEffect(() => {
    snapRef.current = runner?.snap ?? null;
    if (runner?.snap && !runner.snap.meAlive && !diedRef.current) {
      diedRef.current = true;
      sfx("wrong");
    }
  }, [runner?.snap]);

  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 120);
    return () => clearInterval(i);
  }, []);

  // Keyboard: arrows for run/brake/jump/duck, Space for the shockwave.
  useEffect(() => {
    const net = store.net(seat.id);
    const sendHeld = () => {
      const k = keys.current;
      let dir = 0;
      if (k.has("arrowright") || k.has("d")) dir += 1;
      if (k.has("arrowleft") || k.has("a")) dir -= 1;
      const duck = k.has("arrowdown") || k.has("s");
      if (dir !== lastState.current.dir || duck !== lastState.current.duck) {
        lastState.current = { dir, duck };
        net?.runnerMove(dir, duck);
      }
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "spacebar"].includes(key)
      ) {
        e.preventDefault();
      }
      if (e.repeat) return;
      if (key === "arrowup" || key === "w") {
        net?.runnerJump();
        sfx("click");
        return;
      }
      if (key === " " || key === "spacebar") {
        const s = snapRef.current;
        const me = s?.players.find((p) => p.id === seat.playerId);
        if (me && me.shock >= 1) {
          net?.runnerShock();
          sfx("submit");
        }
        return;
      }
      keys.current.add(key);
      sendHeld();
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
      sendHeld();
    };
    const blur = () => {
      keys.current.clear();
      sendHeld();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [seat.id, seat.playerId]);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = viewW * TILE;
    const H = viewH * TILE;
    const groundY = (viewH - groundH) * TILE;
    let raf = 0;
    const draw = () => {
      const s = snapRef.current;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT.current) / 1000);
      lastT.current = now;
      // Ease the camera distance so the scroll is fluid between 30 Hz snapshots.
      const rawDist = s?.dist ?? 0;
      if (dispDist.current === null || Math.abs(rawDist - dispDist.current) > 40) {
        dispDist.current = rawDist;
      } else {
        dispDist.current = smoothTowards(dispDist.current, rawDist, dt, 0.05);
      }
      const dist = dispDist.current;
      // Everything in screen space is (worldX − rawDist); shift by this to draw
      // it at the smoothed camera position instead.
      const offset = rawDist - dist;

      // Sky.
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, "#241a45");
      sky.addColorStop(1, "#3a2b63");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, groundY);

      // Parallax dunes (scroll slower than the ground).
      const dune = (speed: number, color: string, baseY: number, amp: number, wl: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, H);
        const off = (dist * TILE * speed) % wl;
        for (let px = -off; px <= W; px += 6) {
          const y = baseY + Math.sin((px + off) / wl * Math.PI * 2) * amp;
          ctx.lineTo(px, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      };
      dune(0.15, "#2f2356", groundY - TILE * 2.4, TILE * 0.9, 220);
      dune(0.3, "#392a68", groundY - TILE * 1.1, TILE * 0.7, 150);

      // Ground band with scrolling stripes for a sense of speed.
      ctx.fillStyle = "#5a4a2c";
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.fillStyle = "#6b5836";
      ctx.fillRect(0, groundY, W, 5);
      ctx.fillStyle = "#4a3d24";
      const stripeW = TILE;
      const soff = (dist * TILE) % (stripeW * 2);
      for (let px = -soff; px < W; px += stripeW * 2) {
        ctx.fillRect(px, groundY + 6, stripeW, H - groundY - 6);
      }

      if (s) {
        // Ease each player's height once per frame (smooth jump arcs).
        for (const p of s.players) {
          const prev = hSmooth.current.get(p.id);
          const hd = prev === undefined || Math.abs(p.h - prev) > 1.5
            ? p.h
            : smoothTowards(prev, p.h, dt, 0.045);
          hSmooth.current.set(p.id, hd);
        }

        for (const o of s.obstacles) drawObstacle(ctx, { ...o, x: o.x + offset }, groundY);

        // Shockwave bursts (all players), then the characters on top.
        for (const p of s.players) {
          if (p.boomAge >= 0 && p.boomAge < 480) {
            const t = p.boomAge / 480;
            const hd = hSmooth.current.get(p.id) ?? p.h;
            ctx.strokeStyle = `rgba(255,210,63,${(1 - t) * 0.9})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc((p.x + offset) * TILE, groundY - hd * TILE - TILE * 0.7, t * 4.2 * TILE, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        const phase = now / 90;
        for (const p of s.players) {
          const hd = hSmooth.current.get(p.id) ?? p.h;
          const footX = (p.x + offset) * TILE;
          const footY = groundY - hd * TILE;
          const isMe = p.id === seat.playerId;
          drawChar(ctx, footX, footY, groundY, p.color, {
            ducking: p.ducking,
            airborne: hd > 0.05,
            isMe,
            phase: phase + footX,
            alive: p.alive,
          });
          // Name / YOU label.
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(isMe ? "YOU" : p.name, footX, footY - (p.ducking ? 0.8 : 1.42) * TILE - 4);
          // Shockwave-ready halo on my own character.
          if (isMe && p.alive && p.shock >= 1) {
            ctx.strokeStyle = "rgba(255,210,63,0.8)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(footX, footY - 0.7 * TILE, 0.95 * TILE, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [viewW, viewH, groundH, seat.playerId]);

  if (!runner || !init) return null;
  const snap = runner.snap;
  const secsLeft = snap ? Math.ceil(snap.msLeft / 1000) : 0;
  const me = snap?.players.find((p) => p.id === seat.playerId);
  const shockPct = Math.round((me?.shock ?? 0) * 100);
  const shockReady = (me?.shock ?? 0) >= 1;

  return (
    <div className="hide-wrap">
      <div className="hide-topbar">
        <span className="hide-role pixel" style={{ color: "#28e0d0" }}>🏃 RUNNER RUSH</span>
        <span className="hide-info pixel">{snap?.alive ?? "?"} left</span>
        <span className="hide-info pixel">📏 {Math.round(snap?.dist ?? 0)}m</span>
        <span className="hide-info pixel">⏱ {secsLeft}s</span>
      </div>
      <div className="hide-field-frame" style={{ aspectRatio: `${viewW} / ${viewH}` }}>
        <canvas ref={canvasRef} width={viewW * TILE} height={viewH * TILE} className="battle-canvas" />
        {snap && !snap.meAlive && (
          <div className="hide-over">
            <div className="pixel" style={{ color: "var(--bad)", fontSize: 22 }}>Off the edge! 💨</div>
            <div className="hide-sub">spectating…</div>
          </div>
        )}
      </div>
      <div className="runner-footer">
        <div className={`runner-shock${shockReady ? " ready" : ""}`}>
          <span className="pixel">💥 Shockwave</span>
          <div className="runner-shock-bar">
            <div className="runner-shock-fill" style={{ width: `${shockPct}%` }} />
          </div>
          <span className="runner-shock-label pixel">{shockReady ? "SPACE" : `${shockPct}%`}</span>
        </div>
        <div className="hide-hint pixel">→ run · ← brake · ↑ jump · ↓ duck · Space shove</div>
      </div>
    </div>
  );
}
