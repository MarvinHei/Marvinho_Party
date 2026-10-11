import { useEffect, useRef } from "react";
import type { SkribblSegment } from "@marvinho/shared";

const W = 800;
const H = 600;

interface Props {
  strokes: SkribblSegment[];
  drawable: boolean;
  color: string;
  width: number;
  /** "pen" draws lines; "fill" flood-fills the clicked area. */
  tool?: "pen" | "fill";
  onSegment: (seg: SkribblSegment) => void;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Stack-based flood fill with a small tolerance (to bleed under anti-aliased
 * lines). Deterministic given identical canvas state, so every client that has
 * replayed the same segments produces the same fill.
 */
function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, hex: string) {
  sx = Math.max(0, Math.min(W - 1, Math.round(sx)));
  sy = Math.max(0, Math.min(H - 1, Math.round(sy)));
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const at = (x: number, y: number) => (y * W + x) * 4;
  const s = at(sx, sy);
  const tr = d[s], tg = d[s + 1], tb = d[s + 2];
  const [fr, fg, fb] = hexToRgb(hex);
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 8) return; // same color
  const tol = 60;
  const matches = (p: number) =>
    Math.abs(d[p] - tr) + Math.abs(d[p + 1] - tg) + Math.abs(d[p + 2] - tb) <= tol;
  const stack = [[sx, sy]];
  const seen = new Uint8Array(W * H);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const li = y * W + x;
    if (seen[li]) continue;
    const p = li * 4;
    if (!matches(p)) continue;
    seen[li] = 1;
    d[p] = fr; d[p + 1] = fg; d[p + 2] = fb; d[p + 3] = 255;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Fixed-resolution (800×600) drawing surface, CSS-scaled to fit. Renders drawn
 * segments incrementally so a long drawing stays smooth, and (when drawable)
 * emits normalized segments as the pointer moves.
 */
export function SkribblCanvas({ strokes, drawable, color, width, tool = "pen", onSegment }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawnRef = useRef(0);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Incremental render: draw only new segments; full reset when cleared.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (strokes.length < drawnRef.current) {
      // Cleared (or new turn) — wipe and start over.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      drawnRef.current = 0;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = drawnRef.current; i < strokes.length; i++) {
      const s = strokes[i];
      if (s.fill) {
        floodFill(ctx, s.x0 * W, s.y0 * H, s.color);
        continue;
      }
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.x0 * W, s.y0 * H);
      ctx.lineTo(s.x1 * W, s.y1 * H);
      ctx.stroke();
    }
    drawnRef.current = strokes.length;
  }, [strokes]);

  // Paint the initial white background once.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
    }
  }, []);

  function toNorm(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function down(e: React.PointerEvent) {
    if (!drawable) return;
    const p = toNorm(e);
    if (tool === "fill") {
      // A single flood-fill op at the clicked point — no drag.
      onSegment({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, color, width: 0, fill: true });
      return;
    }
    drawing.current = true;
    last.current = p;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // A dot for a single click.
    onSegment({ x0: p.x, y0: p.y, x1: p.x + 0.001, y1: p.y, color, width });
  }
  function move(e: React.PointerEvent) {
    if (!drawable || !drawing.current || !last.current) return;
    const p = toNorm(e);
    onSegment({ x0: last.current.x, y0: last.current.y, x1: p.x, y1: p.y, color, width });
    last.current = p;
  }
  function up() {
    drawing.current = false;
    last.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className={`skribbl-canvas${drawable ? " drawable" : ""}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
    />
  );
}
