import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import type { PongStatePayload } from "@marvinho/shared";
import { smoothTowards } from "./interp.js";

const W = 900;
const H = 520;
const PAD_X_L = 0.04;
const PAD_X_R = 0.96;
const PAD_HALF = 0.09;
const PAD_W = 12;
const BALL_R = 0.02;

export function PongPanel({ seat }: { seat: SeatState }) {
  const pong = seat.pong;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Latest server snapshot + a locally-predicted position for our own paddle.
  const snapRef = useRef<PongStatePayload | null>(pong?.snap ?? null);
  const localPad = useRef(0.5);
  const [over, setOver] = useState<{ won: boolean } | null>(null);
  const lastScore = useRef({ l: 0, r: 0 });
  const lastSent = useRef(0);
  // Impact particles + previous ball sample (to detect paddle/wall bounces).
  const particles = useRef<Particle[]>([]);
  const prevBall = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const lastT = useRef(performance.now());
  // Smoothed (interpolated) display positions, so 30 Hz snapshots render at
  // the full frame rate instead of stepping.
  const dispBall = useRef<{ x: number; y: number } | null>(null);
  const dispPad = useRef<{ l: number; r: number } | null>(null);

  const side = pong?.init.side ?? "left";

  useEffect(() => {
    snapRef.current = pong?.snap ?? null;
    const s = pong?.snap;
    if (s) {
      // Beep on a score change.
      if (s.scoreL !== lastScore.current.l || s.scoreR !== lastScore.current.r) {
        lastScore.current = { l: s.scoreL, r: s.scoreR };
        sfx("place");
      }
      if (s.over) setOver({ won: s.winner === side });
    }
  }, [pong?.snap, side]);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const spawnBurst = (x: number, y: number, color: string) => {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 200;
        particles.current.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.5,
          max: 0.5,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    };
    const draw = () => {
      const s = snapRef.current;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT.current) / 1000);
      lastT.current = now;
      ctx.fillStyle = "#0c0a20";
      ctx.fillRect(0, 0, W, H);
      // Center dashed line.
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 14]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      const selfColor = pong?.init.self.color ?? "#ffd23f";
      const oppColor = pong?.init.opponent.color ?? "#8a8aa8";
      // Smooth the server-driven (opponent) paddle; our own stays predicted.
      const rawPadL = s?.padL ?? 0.5;
      const rawPadR = s?.padR ?? 0.5;
      if (!dispPad.current) dispPad.current = { l: rawPadL, r: rawPadR };
      dispPad.current.l = smoothTowards(dispPad.current.l, rawPadL, dt, 0.04);
      dispPad.current.r = smoothTowards(dispPad.current.r, rawPadR, dt, 0.04);
      const padL = side === "left" ? localPad.current : dispPad.current.l;
      const padR = side === "right" ? localPad.current : dispPad.current.r;
      const colL = side === "left" ? selfColor : oppColor;
      const colR = side === "right" ? selfColor : oppColor;
      drawPaddle(ctx, PAD_X_L * W, padL * H, colL);
      drawPaddle(ctx, PAD_X_R * W, padR * H, colR);

      // Detect bounces by watching the ball's velocity flip sign near an edge,
      // and spew particles + play a beep on each hit.
      if (s) {
        const pb = prevBall.current;
        if (pb) {
          const dx = s.ballX - pb.x;
          const dy = s.ballY - pb.y;
          if (dx !== 0 || dy !== 0) {
            // Ignore big jumps (a point reset re-centers the ball).
            if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) {
              // Spawn at the drawn (smoothed) ball so bursts stay on the ball.
              const bx = (dispBall.current?.x ?? s.ballX) * W;
              const by = (dispBall.current?.y ?? s.ballY) * H;
              if (pb.vx !== 0 && Math.sign(dx) !== Math.sign(pb.vx) && (s.ballX < 0.14 || s.ballX > 0.86)) {
                spawnBurst(bx, by, s.ballX < 0.5 ? colL : colR);
                sfx("bounce");
              }
              if (pb.vy !== 0 && Math.sign(dy) !== Math.sign(pb.vy) && (s.ballY < 0.06 || s.ballY > 0.94)) {
                spawnBurst(bx, by, "#dfe6ff");
                sfx("bounceWall");
              }
            }
            prevBall.current = { x: s.ballX, y: s.ballY, vx: dx !== 0 ? dx : pb.vx, vy: dy !== 0 ? dy : pb.vy };
          }
        } else {
          prevBall.current = { x: s.ballX, y: s.ballY, vx: 0, vy: 0 };
        }
      }

      // Ball (smoothed; snaps on a point reset that re-centers it).
      if (s) {
        let d = dispBall.current;
        if (!d || Math.abs(s.ballX - d.x) > 0.2 || Math.abs(s.ballY - d.y) > 0.2) {
          d = { x: s.ballX, y: s.ballY };
          dispBall.current = d;
        } else {
          d.x = smoothTowards(d.x, s.ballX, dt, 0.04);
          d.y = smoothTowards(d.y, s.ballY, dt, 0.04);
        }
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, BALL_R * H, 0, Math.PI * 2);
        ctx.fill();
      }

      // Impact particles.
      const survivors: Particle[] = [];
      for (const pt of particles.current) {
        pt.life -= dt;
        if (pt.life <= 0) continue;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.98;
        pt.vy *= 0.98;
        ctx.globalAlpha = Math.max(0, pt.life / pt.max);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
        survivors.push(pt);
      }
      ctx.globalAlpha = 1;
      particles.current = survivors;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [pong?.init, side]);

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = Math.max(PAD_HALF, Math.min(1 - PAD_HALF, (e.clientY - rect.top) / rect.height));
    localPad.current = y;
    const now = performance.now();
    if (now - lastSent.current > 16) {
      lastSent.current = now;
      store.net(seat.id)?.pongMove(y);
    }
  }

  if (!pong) return null;
  const s = pong.snap;

  return (
    <div className="pong-wrap">
      <div className="pong-topbar">
        <span className="pong-name" style={{ color: pong.init.self.color }}>
          {pong.init.self.name} {side === "left" ? "◀" : "▶"}
        </span>
        <span className="pong-score pixel">
          {s ? s.scoreL : 0} : {s ? s.scoreR : 0}
        </span>
        <span className="pong-name" style={{ color: pong.init.opponent.color }}>
          {pong.init.opponent.name}{pong.init.vsCpu ? " 🤖" : ""} {side === "right" ? "◀" : "▶"}
        </span>
      </div>
      <div className="pong-field-frame">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="pong-canvas"
          onPointerMove={onMove}
        />
        {over && (
          <div className="pong-over">
            <div className={`pong-result pixel ${over.won ? "win" : "lose"}`}>
              {over.won ? "You win! 🏆" : "You lose"}
            </div>
            <div className="pong-sub">waiting for the other duels…</div>
          </div>
        )}
      </div>
      <div className="pong-hint pixel">First to {pong.init.target} — move the mouse to steer your paddle</div>
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

function drawPaddle(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  const h = PAD_HALF * 2 * H;
  ctx.fillStyle = color;
  const x = cx - PAD_W / 2;
  const y = cy - h / 2;
  const r = 5;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + PAD_W, y, x + PAD_W, y + h, r);
  ctx.arcTo(x + PAD_W, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + PAD_W, y, r);
  ctx.fill();
}
