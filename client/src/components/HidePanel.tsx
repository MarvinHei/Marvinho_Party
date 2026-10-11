import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import { sfx, audio } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import type { HideStatePayload, TokenLook } from "@marvinho/shared";
import { drawToken, drawKnife } from "./pixelChar.js";
import { PosSmoother } from "./interp.js";

const TILE = 28;
const FLASH_RANGE = 6.5; // fallback seeker flashlight range (server sends the real one)
const NEAR = 2.1; // full-circle awareness right around the seeker (matches server)
const STAB_MS = 300; // knife-thrust animation length

export function HidePanel({ seat }: { seat: SeatState }) {
  const hide = seat.hide;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapRef = useRef<HideStatePayload | null>(hide?.snap ?? null);
  const looksRef = useRef<Map<string, TokenLook>>(new Map());
  looksRef.current = new Map((hide?.init?.appearances ?? []).map((a) => [a.id, a]));
  const keys = useRef<Set<string>>(new Set());
  const lastDir = useRef({ dx: 0, dy: 0 });
  const [, setTick] = useState(0);
  const caughtRef = useRef(false);
  // Local seeker aim + knife-stab animation (cursor is in tile coords).
  const cursor = useRef({ x: 0, y: 0 });
  const stab = useRef({ at: -1, angle: 0 });
  const smoother = useRef(new PosSmoother());
  const lastT = useRef(performance.now());
  const lastAim = useRef(0); // throttle for seeker aim updates

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
  useEffect(() => {
    audio.startGameMusic("/audio/battle.mp3");
    return () => audio.stopGameMusic();
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
      if (key === "e") {
        e.preventDefault();
        if (!e.repeat) tryTeleport();
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
          const look = looksRef.current.get(p.id);
          drawToken(ctx, px, py, TILE * 0.86, p.color, {
            me: isMe,
            alive: !p.caught,
            hair: look?.hair,
            hairColor: look?.hairColor,
            mouth: look?.mouth,
          });

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
      // Seeker flashlight: everything is dark except a cone toward the cursor
      // (plus a small circle of awareness right around the seeker).
      if (isSeeker && meDisp) {
        const cx = meDisp.x * TILE;
        const cy = meDisp.y * TILE;
        const range = (s?.flashRange ?? FLASH_RANGE) * TILE;
        const half = s?.flashHalfAngle ?? 0.8;
        // Draw the cone from the SERVER's aim so the visible light is exactly the
        // area the server reveals hiders in — the true field of view. Fall back to
        // the local cursor only until the first snapshot arrives.
        const aim = s ? s.flashAim : Math.atan2(cursor.current.y - meDisp.y, cursor.current.x - meDisp.x);
        ctx.save();
        ctx.fillStyle = "rgba(5,4,18,0.9)";
        ctx.fillRect(0, 0, W, H);
        // Punch the lit areas back out of the darkness.
        ctx.globalCompositeOperation = "destination-out";
        const nr = NEAR * TILE;
        const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, nr);
        ng.addColorStop(0, "rgba(0,0,0,0.95)");
        ng.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(cx, cy, nr, 0, Math.PI * 2);
        ctx.fill();
        const cg = ctx.createRadialGradient(cx, cy, nr * 0.4, cx, cy, range);
        cg.addColorStop(0, "rgba(0,0,0,1)");
        cg.addColorStop(0.7, "rgba(0,0,0,0.9)");
        cg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, range, aim - half, aim + half);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Radar pings (seeker only): pulsing markers over the fog.
      if (s && s.pings.length) {
        const pulse = (performance.now() % 1100) / 1100;
        for (const ping of s.pings) {
          const px = ping.x * TILE;
          const py = ping.y * TILE;
          ctx.strokeStyle = `rgba(255,80,80,${(1 - pulse) * 0.9})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, TILE * (0.4 + pulse * 1.6), 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,80,80,0.95)";
          ctx.beginPath();
          ctx.arc(px, py, TILE * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows, walls, isSeeker, seat.playerId]);

  function updateCursor(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    cursor.current = {
      x: ((clientX - rect.left) / rect.width) * cols,
      y: ((clientY - rect.top) / rect.height) * rows,
    };
  }
  function toTile(e: React.PointerEvent<HTMLCanvasElement>) {
    updateCursor(e.clientX, e.clientY);
    // Seekers stream their aim so the server's flashlight cone matches the cursor.
    if (isSeeker) {
      const now = performance.now();
      if (now - lastAim.current > 33) {
        lastAim.current = now;
        const me = snapRef.current?.players.find((p) => p.id === seat.playerId);
        if (me) store.net(seat.id)?.hideAim(Math.atan2(cursor.current.y - me.y, cursor.current.x - me.x));
      }
    }
  }
  /** Blink to the cursor tile if the cooldown is ready. */
  function tryTeleport() {
    if ((snapRef.current?.teleportCd ?? 1) > 0) return;
    if (isSeeker && !snapRef.current?.released) return;
    store.net(seat.id)?.hideTeleport(cursor.current.x, cursor.current.y);
    sfx("submit");
  }
  function onStab(e: React.PointerEvent<HTMLCanvasElement>) {
    toTile(e);
    if (isSeeker) {
      if (!snapRef.current?.released) return;
      const me = snapRef.current.players.find((p) => p.id === seat.playerId);
      if (me) stab.current = { at: performance.now(), angle: Math.atan2(cursor.current.y - me.y, cursor.current.x - me.x) };
      store.net(seat.id)?.hideStab();
      sfx("stab");
    } else {
      // Hiders have no knife — a click blinks them to safety.
      tryTeleport();
    }
  }
  function onContext(e: React.MouseEvent<HTMLCanvasElement>) {
    // Right-click blinks (handy for the seeker, whose left-click stabs).
    e.preventDefault();
    updateCursor(e.clientX, e.clientY);
    tryTeleport();
  }

  if (!hide || !init) return null;
  const snap = hide.snap;
  const now = Date.now();
  const releaseIn = Math.max(0, Math.ceil((init.releaseAt - now) / 1000));
  const tpCd = snap ? Math.ceil(snap.teleportCd / 1000) : 30;
  const tpReady = tpCd <= 0;
  const secsLeft = snap ? Math.ceil(snap.msLeft / 1000) : 0;
  const held = releaseIn > 0 && isSeeker;

  return (
    <div className="hide-wrap">
      <div className="hide-topbar">
        <span className="hide-role pixel" style={{ color: isSeeker ? "#e6394b" : "#42d17a" }}>
          {isSeeker ? "🔪 SEEKER" : "🫥 HIDER"}
        </span>
        <span className="hide-info pixel">{snap?.aliveHiders ?? "?"} hiders left</span>
        <span className="hide-info pixel" style={{ color: tpReady ? "#28e0d0" : undefined }}>
          🌀 {tpReady ? "Blink ready" : `${tpCd}s`}
        </span>
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
          onContextMenu={onContext}
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
            ? "WASD move · click/Space stab · aim your flashlight · right-click or E to blink"
            : "WASD move · click or E to blink to a spot · stay out of the light"}
      </div>
    </div>
  );
}
