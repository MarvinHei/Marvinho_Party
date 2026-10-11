import { useEffect, useRef, useState } from "react";
import { store } from "../../state/store.js";
import { sfx, audio } from "../../audio/audio.js";
import type { SeatState } from "../../state/types.js";
import { gameState } from "../state.js";
import type { SterbegeldPhase, SterbegeldStatePayload, TokenLook } from "@marvinho/shared";
import { drawToken, roundRect } from "../../components/pixelChar.js";

const CHAR_Y = 0.9; // must match the server

/** Split-screen two-act game: everyone sees every player's cell at once. */
export function SterbegeldPanel({ seat }: { seat: SeatState }) {
  const st = gameState(seat, "sterbegeld");
  const snapRef = useRef<SterbegeldStatePayload | null>(st?.snap ?? null);
  const looksRef = useRef<Map<string, TokenLook>>(new Map());
  looksRef.current = new Map((st?.init?.appearances ?? []).map((a) => [a.id, a]));
  const keys = useRef<Set<string>>(new Set());
  const lastDir = useRef(0);
  const signed = useRef(false);
  // Only re-render the frame (banner/hint) when the act changes; the cells
  // animate themselves off the ref at full frame rate.
  const [phase, setPhase] = useState<SterbegeldPhase>("dela");

  useEffect(() => {
    snapRef.current = st?.snap ?? null;
    if (st?.snap && st.snap.phase !== phase) setPhase(st.snap.phase);
  }, [st?.snap, phase]);

  useEffect(() => {
    audio.startGameMusic("/audio/battle.mp3");
    return () => audio.stopGameMusic();
  }, []);

  // Input: Space signs during DELA; A/D (or arrows) dodge during Wartezeit.
  useEffect(() => {
    const net = store.net(seat.id);
    const sendMove = () => {
      const k = keys.current;
      let dir = 0;
      if (k.has("a") || k.has("arrowleft")) dir -= 1;
      if (k.has("d") || k.has("arrowright")) dir += 1;
      if (dir !== lastDir.current) {
        lastDir.current = dir;
        net?.send("sterbegeld", "move", { dir });
      }
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const phase = snapRef.current?.phase;
      if (key === " " || key === "spacebar") {
        e.preventDefault();
        if (e.repeat) return;
        if (phase === "dela" && !signed.current) {
          const me = snapRef.current?.players.find((p) => p.id === seat.playerId);
          if (me && !me.signed && !me.delaDone) {
            signed.current = true;
            net?.send("sterbegeld", "sign", {});
            sfx("submit");
          }
        }
        return;
      }
      if (["a", "d", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
        keys.current.add(key);
        sendMove();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
      sendMove();
    };
    const blur = () => {
      keys.current.clear();
      sendMove();
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

  if (!st || !st.init) return null;
  const players = st.init.players;

  return (
    <div className="sg-wrap">
      <div className="sg-topbar">
        <span className="hide-role pixel" style={{ color: "#b06bff" }}>⚰️ STERBEGELD</span>
        <span className="sg-act pixel">
          {phase === "dela"
            ? "Act 1 · DELA — sign as LATE as you dare"
            : phase === "wartezeit"
              ? "Act 2 · Wartezeit — dodge the falling bars"
              : "Round over"}
        </span>
      </div>
      <div className="sg-grid" data-count={players.length}>
        {players.map((p) => (
          <Cell
            key={p.id}
            playerId={p.id}
            name={p.name}
            color={p.color}
            isMe={p.id === seat.playerId}
            snapRef={snapRef}
            looksRef={looksRef}
          />
        ))}
      </div>
      <div className="hide-hint pixel">
        {phase === "dela"
          ? "Press SPACE to sign — the longer you wait, the higher your score (but don't get hit first!)"
          : "A / D or ← / → to dodge · survive as long as you can"}
      </div>
    </div>
  );
}

const CW = 240;
const CH = 210;

function Cell({
  playerId,
  name,
  color,
  isMe,
  snapRef,
  looksRef,
}: {
  playerId: string;
  name: string;
  color: string;
  isMe: boolean;
  snapRef: React.MutableRefObject<SterbegeldStatePayload | null>;
  looksRef: React.MutableRefObject<Map<string, TokenLook>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const snap = snapRef.current;
      const me = snap?.players.find((p) => p.id === playerId);
      const look = looksRef.current.get(playerId);
      ctx.clearRect(0, 0, CW, CH);
      if (!snap || !me) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (snap.phase === "dela") {
        drawDela(ctx, me, look, isMe);
      } else {
        drawWait(ctx, snap, me, look, isMe);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playerId, isMe, snapRef, looksRef]);

  return (
    <div className={`sg-cell${isMe ? " me" : ""}`}>
      <div className="sg-name pixel" style={{ color }}>
        {isMe ? "YOU" : name}
      </div>
      <canvas ref={canvasRef} width={CW} height={CH} className="sg-canvas" />
    </div>
  );
}

type Dot = SterbegeldStatePayload["players"][number];

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Act 1: a car accelerates toward the character on the right. */
function drawDela(
  ctx: CanvasRenderingContext2D,
  me: Dot,
  look: TokenLook | undefined,
  isMe: boolean,
) {
  // Sky + road.
  ctx.fillStyle = "#1a1436";
  ctx.fillRect(0, 0, CW, CH);
  const groundY = CH * 0.72;
  ctx.fillStyle = "#2b2450";
  ctx.fillRect(0, groundY, CW, CH - groundY);
  ctx.fillStyle = "#4a3f7a";
  ctx.fillRect(0, groundY, CW, 4);
  // Lane dashes.
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let x = 0; x < CW; x += 26) ctx.fillRect(x, groundY + (CH - groundY) / 2 - 2, 14, 3);

  const charX = CW * 0.82;
  const footY = groundY + 6;
  // Car: from the left toward the character.
  const carX = 20 + me.carPos * (charX - 54);
  drawCar(ctx, carX, groundY - 2, me.color);

  // Character (knocked over once the car has hit).
  ctx.save();
  if (me.delaDone) {
    ctx.globalAlpha = 0.85;
    ctx.translate(charX, footY - 14);
    ctx.rotate(0.9);
    ctx.translate(-charX, -(footY - 14));
  }
  drawToken(ctx, charX, footY - 16, 34, me.color, {
    me: isMe,
    alive: !me.delaDone,
    hair: look?.hair,
    hairColor: look?.hairColor,
    mouth: look?.mouth,
  });
  ctx.restore();

  // Score readout.
  ctx.textAlign = "center";
  ctx.fillStyle = me.signed ? "#42d17a" : "#ffd23f";
  ctx.font = "bold 26px monospace";
  ctx.fillText(fmt(me.delaScore), CW / 2, 34);

  // Prompt / status.
  ctx.font = "11px monospace";
  if (me.delaDone) {
    ctx.fillStyle = me.delaScore > 0 ? "#42d17a" : "#e6394b";
    ctx.fillText(me.delaScore > 0 ? "SIGNED — hit!" : "TOO LATE — 0", CW / 2, 52);
  } else if (me.signed) {
    ctx.fillStyle = "#42d17a";
    ctx.fillText("✍ signed — bleeding!", CW / 2, 52);
  } else if (isMe) {
    // Pulse the call to action.
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
    ctx.fillStyle = `rgba(255,210,63,${0.5 + pulse * 0.5})`;
    ctx.fillText("PRESS SPACE!", CW / 2, 52);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("waiting…", CW / 2, 52);
  }
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, baseY: number, color: string) {
  const w = 40;
  const h = 16;
  const top = baseY - h;
  ctx.fillStyle = "#d0342c";
  roundRect(ctx, x, top, w, h, 4);
  ctx.fill();
  // Cabin.
  ctx.fillStyle = "#7fb2ff";
  roundRect(ctx, x + 10, top - 8, 18, 9, 3);
  ctx.fill();
  // Accent stripe in the player colour.
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, top + h - 5, w - 4, 3);
  // Wheels.
  ctx.fillStyle = "#15121f";
  ctx.beginPath();
  ctx.arc(x + 10, baseY, 4.5, 0, Math.PI * 2);
  ctx.arc(x + w - 10, baseY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Speed lines behind it.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 6 - i * 8, top + 4 + i * 4);
    ctx.lineTo(x - 14 - i * 8, top + 4 + i * 4);
    ctx.stroke();
  }
}

/** Act 2: falling bars with a drifting hole; the character dodges below. */
function drawWait(
  ctx: CanvasRenderingContext2D,
  snap: SterbegeldStatePayload,
  me: Dot,
  look: TokenLook | undefined,
  isMe: boolean,
) {
  ctx.fillStyle = "#141130";
  ctx.fillRect(0, 0, CW, CH);
  // Falling bars (shared across every cell).
  for (const b of snap.blocks) {
    const x = b.x * CW;
    const y = b.y * CH;
    const w = b.w * CW;
    const h = b.h * CH;
    ctx.fillStyle = "#7a3050";
    roundRect(ctx, x + 1, y, w - 2, h, 3);
    ctx.fill();
    ctx.fillStyle = "#e6394b";
    ctx.fillRect(x + 2, y + 1, w - 4, 3);
  }
  // Character at the bottom.
  const cx = me.x * CW;
  const cy = CHAR_Y * CH;
  drawToken(ctx, cx, cy, 30, me.color, {
    me: isMe,
    alive: me.waitAlive,
    hair: look?.hair,
    hairColor: look?.hairColor,
    mouth: look?.mouth,
  });
  // Score.
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold 22px monospace";
  ctx.fillText(fmt(me.total), CW / 2, 30);
  if (!me.waitAlive) {
    ctx.fillStyle = "rgba(8,6,20,0.55)";
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = "#e6394b";
    ctx.font = "bold 20px monospace";
    ctx.fillText("OUT", CW / 2, CH / 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px monospace";
    ctx.fillText(`${fmt(me.total)} pts`, CW / 2, CH / 2 + 20);
  }
}
