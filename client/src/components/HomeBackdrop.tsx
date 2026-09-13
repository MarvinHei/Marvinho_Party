import { useEffect, useRef } from "react";
import { PLAYER_COLORS } from "@marvinho/shared";
import { drawToken } from "./pixelChar.js";

// Decorative home-screen backdrop: one very large idle character breathing in
// the background, plus the occasional conga line of little characters hopping
// across the screen. Purely cosmetic — drawn on a full-viewport canvas behind
// the content, and skipped entirely under prefers-reduced-motion.

interface Train {
  dir: number; // +1 → right, -1 → left
  count: number;
  size: number;
  spacing: number;
  speed: number; // px / s
  baseY: number;
  hopH: number;
  hopPeriod: number; // px between hops
  startX: number;
  startT: number; // seconds
  colorOffset: number;
}

export function HomeBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    let train: Train | null = null;
    let nextAt = 1.2; // seconds until the first train

    const spawnTrain = (t: number): Train => {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const count = 4 + Math.floor(Math.random() * 4); // 4..7
      const size = Math.max(22, Math.min(44, Math.min(w, h) * 0.06));
      const spacing = size * 1.5;
      const speed = 80 + Math.random() * 70;
      const baseY = h * (0.48 + Math.random() * 0.36);
      const startX = dir > 0 ? -(count * spacing + size * 2) : w + count * spacing + size * 2;
      return {
        dir, count, size, spacing, speed, baseY,
        hopH: size * 1.15,
        hopPeriod: size * 2.4,
        startX,
        startT: t,
        colorOffset: Math.floor(Math.random() * PLAYER_COLORS.length),
      };
    };

    let raf = 0;
    const frame = () => {
      const t = (performance.now() - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // --- Big idle character ------------------------------------------------
      const bigSize = Math.max(240, Math.min(560, Math.min(w, h) * 0.62));
      const cx = w * 0.2;
      const cy = h * 0.6;
      const bob = reduce ? 0 : Math.sin(t * 1.6) * bigSize * 0.02;
      const sx = reduce ? 1 : 1 - Math.sin(t * 2.2) * 0.02;
      const sy = reduce ? 1 : 1 + Math.sin(t * 2.2) * 0.028;
      const sway = reduce ? 0 : Math.sin(t * 0.7) * 0.02;
      // Blink roughly every 3.4s (a quick double-blink).
      const bc = t % 3.4;
      const blink = !reduce && (bc < 0.13 || (bc > 0.2 && bc < 0.31)) ? 1 : 0;
      ctx.save();
      ctx.translate(cx, cy + bob);
      ctx.rotate(sway);
      ctx.scale(sx, sy);
      drawToken(ctx, 0, 0, bigSize, "#b06bff", { blink });
      ctx.restore();

      // --- Hopping conga line ------------------------------------------------
      if (!reduce) {
        if (!train && t >= nextAt) train = spawnTrain(t);
        if (train) {
          const tr = train;
          const leadX = tr.startX + tr.dir * tr.speed * (t - tr.startT);
          for (let i = 0; i < tr.count; i++) {
            const x = leadX - tr.dir * i * tr.spacing;
            if (x < -tr.size * 2 || x > w + tr.size * 2) continue;
            const frac = (((x / tr.hopPeriod) % 1) + 1) % 1;
            const hop = Math.sin(frac * Math.PI) * tr.hopH;
            const color = PLAYER_COLORS[(tr.colorOffset + i) % PLAYER_COLORS.length];
            drawToken(ctx, x, tr.baseY - hop, tr.size, color);
          }
          // Done once the trailing member has cleared the far edge.
          const done = tr.dir > 0
            ? leadX - (tr.count - 1) * tr.spacing > w + tr.size * 2
            : leadX + (tr.count - 1) * tr.spacing < -tr.size * 2;
          if (done) {
            train = null;
            nextAt = t + 3.5 + Math.random() * 5;
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-backdrop" aria-hidden="true" />;
}
