import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import type { PongStatePayload } from "@marvinho/shared";

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
    const draw = () => {
      const s = snapRef.current;
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
      const padL = side === "left" ? localPad.current : (s?.padL ?? 0.5);
      const padR = side === "right" ? localPad.current : (s?.padR ?? 0.5);
      const colL = side === "left" ? selfColor : oppColor;
      const colR = side === "right" ? selfColor : oppColor;
      drawPaddle(ctx, PAD_X_L * W, padL * H, colL);
      drawPaddle(ctx, PAD_X_R * W, padR * H, colR);

      // Ball.
      if (s) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.ballX * W, s.ballY * H, BALL_R * H, 0, Math.PI * 2);
        ctx.fill();
      }
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
