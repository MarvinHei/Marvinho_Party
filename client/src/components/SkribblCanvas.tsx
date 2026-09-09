import { useEffect, useRef } from "react";
import type { SkribblSegment } from "@marvinho/shared";

const W = 800;
const H = 600;

interface Props {
  strokes: SkribblSegment[];
  drawable: boolean;
  color: string;
  width: number;
  onSegment: (seg: SkribblSegment) => void;
}

/**
 * Fixed-resolution (800×600) drawing surface, CSS-scaled to fit. Renders drawn
 * segments incrementally so a long drawing stays smooth, and (when drawable)
 * emits normalized segments as the pointer moves.
 */
export function SkribblCanvas({ strokes, drawable, color, width, onSegment }: Props) {
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
    drawing.current = true;
    last.current = toNorm(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // A dot for a single click.
    const p = last.current;
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
