import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import type { BattleStatePayload } from "@marvinho/shared";

const TILE = 28;

export function BattlePanel({ seat }: { seat: SeatState }) {
  const battle = seat.battle;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapRef = useRef<BattleStatePayload | null>(battle?.snap ?? null);
  const keys = useRef<Set<string>>(new Set());
  const lastDir = useRef({ dx: 0, dy: 0 });
  const cursor = useRef({ x: 0, y: 0 }); // in tile coords
  const [, setTick] = useState(0);
  const diedRef = useRef(false);

  const init = battle?.init;
  const cols = init?.cols ?? 34;
  const rows = init?.rows ?? 20;
  const walls = init?.walls ?? "";

  useEffect(() => {
    snapRef.current = battle?.snap ?? null;
    if (battle?.snap && !battle.snap.meAlive && !diedRef.current) {
      diedRef.current = true;
      sfx("wrong");
    }
  }, [battle?.snap]);

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
        net?.battleMove(dx, dy);
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
      ctx.fillStyle = "#141126";
      ctx.fillRect(0, 0, W, H);
      // Walls.
      ctx.fillStyle = "#463c85";
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
          const r = 0.42 * TILE;
          ctx.globalAlpha = p.alive ? 1 : 0.3;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = p.id === seat.playerId ? "#fff" : "#0d0b22";
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "10px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(p.id === seat.playerId ? "YOU" : p.name, px, py - r - 2);
        }
        // Aim barrel from me toward the cursor.
        if (me && me.alive) {
          const ang = Math.atan2(cursor.current.y - me.y, cursor.current.x - me.x);
          ctx.strokeStyle = "#ffd23f";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(me.x * TILE, me.y * TILE);
          ctx.lineTo((me.x + Math.cos(ang) * 0.9) * TILE, (me.y + Math.sin(ang) * 0.9) * TILE);
          ctx.stroke();
        }
        // Bullets.
        ctx.fillStyle = "#fff2a8";
        for (const b of s.bullets) {
          ctx.beginPath();
          ctx.arc(b.x * TILE, b.y * TILE, 0.16 * TILE, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [cols, rows, walls, seat.playerId]);

  function toTile(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    cursor.current = {
      x: ((e.clientX - rect.left) / rect.width) * cols,
      y: ((e.clientY - rect.top) / rect.height) * rows,
    };
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    toTile(e);
    const s = snapRef.current;
    const me = s?.players.find((p) => p.id === seat.playerId);
    if (!me || !me.alive) return;
    const ang = Math.atan2(cursor.current.y - me.y, cursor.current.x - me.x);
    store.net(seat.id)?.battleShoot(ang);
    sfx("submit");
  }

  if (!battle || !init) return null;
  const snap = battle.snap;
  const secsLeft = snap ? Math.ceil(snap.msLeft / 1000) : 0;

  return (
    <div className="hide-wrap">
      <div className="hide-topbar">
        <span className="hide-role pixel" style={{ color: "#ff8c42" }}>🔫 BATTLE ROYALE</span>
        <span className="hide-info pixel">{snap?.alive ?? "?"} alive</span>
        <span className="hide-info pixel">⏱ {secsLeft}s</span>
      </div>
      <div className="hide-field-frame" style={{ aspectRatio: `${cols} / ${rows}` }}>
        <canvas
          ref={canvasRef}
          width={cols * TILE}
          height={rows * TILE}
          className="battle-canvas"
          onPointerMove={toTile}
          onPointerDown={onDown}
        />
        {snap && !snap.meAlive && (
          <div className="hide-over">
            <div className="pixel" style={{ color: "var(--bad)", fontSize: 22 }}>Eliminated 💀</div>
            <div className="hide-sub">spectating…</div>
          </div>
        )}
      </div>
      <div className="hide-hint pixel">WASD to move · aim with the mouse · click to shoot</div>
    </div>
  );
}
