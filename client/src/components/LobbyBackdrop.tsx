import { useEffect, useRef } from "react";
import { drawEye } from "./pixelChar.js";
import { smoothTowards } from "./interp.js";

// Lobby background: just a giant pair of the character's eyes peering out,
// blinking and following the cursor. Purely decorative — full-viewport canvas
// behind the content, and static under prefers-reduced-motion.

export function LobbyBackdrop() {
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

    // Target gaze from the cursor (−1..1 from screen center); eased each frame.
    const targetLook = { x: 0, y: 0 };
    const look = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      targetLook.x = Math.max(-1, Math.min(1, (e.clientX / w - 0.5) * 2));
      targetLook.y = Math.max(-1, Math.min(1, (e.clientY / h - 0.5) * 2));
    };
    if (!reduce) window.addEventListener("pointermove", onMove);

    const start = performance.now();
    let last = start;
    let raf = 0;
    const frame = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      look.x = reduce ? 0 : smoothTowards(look.x, targetLook.x, dt, 0.12);
      look.y = reduce ? 0 : smoothTowards(look.y, targetLook.y, dt, 0.12);

      const eyeR = Math.max(110, Math.min(300, Math.min(w, h) * 0.2));
      const cy = h * 0.42;
      const gap = eyeR * 1.7;
      const cx = w * 0.5;
      // No blink here — the lobby eyes just track the cursor, always open.
      drawEye(ctx, cx - gap, cy, eyeR, look.x, look.y, 0);
      drawEye(ctx, cx + gap, cy, eyeR, look.x, look.y, 0);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-backdrop" aria-hidden="true" />;
}
