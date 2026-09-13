import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import type { HideStatePayload } from "@marvinho/shared";

const TILE = 28;
const VISION = 7; // must match the server

export function HidePanel({ seat }: { seat: SeatState }) {
  const hide = seat.hide;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapRef = useRef<HideStatePayload | null>(hide?.snap ?? null);
  const keys = useRef<Set<string>>(new Set());
  const lastDir = useRef({ dx: 0, dy: 0 });
  const [, setTick] = useState(0);
  const caughtRef = useRef(false);

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
  }, [seat.id]);

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
      const me = s?.players.find((p) => p.id === seat.playerId) ?? null;
      // Players.
      if (s) {
        for (const p of s.players) {
          const px = p.x * TILE;
          const py = p.y * TILE;
          const r = 0.4 * TILE;
          ctx.globalAlpha = p.caught ? 0.35 : 1;
          ctx.fillStyle = p.role === "seeker" ? "#e6394b" : p.color;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = p.id === seat.playerId ? "#fff" : "#0d0b22";
          ctx.stroke();
          if (p.role === "seeker") {
            ctx.fillStyle = "#fff";
            ctx.font = `${TILE * 0.6}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🔪", px, py - r - 6);
          }
          ctx.globalAlpha = 1;
          // Name.
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(p.id === seat.playerId ? "YOU" : p.name, px, py - r - 2);
        }
      }
      // Seeker fog: darken beyond the vision radius.
      if (isSeeker && me) {
        const grad = ctx.createRadialGradient(
          me.x * TILE, me.y * TILE, VISION * TILE * 0.55,
          me.x * TILE, me.y * TILE, VISION * TILE,
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

  function onClick() {
    if (isSeeker && snapRef.current?.released) {
      store.net(seat.id)?.hideStab();
      sfx("place");
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
          onPointerDown={onClick}
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
            ? "WASD to move · click to stab a nearby hider"
            : "WASD to move · stay out of the seeker's sight"}
      </div>
    </div>
  );
}
