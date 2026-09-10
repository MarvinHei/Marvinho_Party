import { useEffect, useRef } from "react";
import { audio } from "./audio.js";

interface Props {
  /** Visual style: an equalizer bar strip, or an ambient waveform ribbon. */
  variant?: "bars" | "wave";
  /** CSS class for positioning (the canvas fills its parent). */
  className?: string;
  height?: number;
  /** Bar/line colors; cycles through for bars. */
  colors?: string[];
}

const DEFAULT_COLORS = ["#e6394b", "#3aa0ff", "#42d17a", "#ffd23f", "#b06bff", "#ff8c42"];

/**
 * A lightweight, audio-reactive canvas visualizer driven by the shared
 * AnalyserNode. Falls back to a gentle idle animation when no audio is running,
 * so it never looks dead before the music is unlocked.
 */
export function AudioVisualizer({ variant = "bars", className, height = 64, colors = DEFAULT_COLORS }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t0 = performance.now();
    const freq = new Uint8Array(128);
    const time = new Uint8Array(256);

    function resize() {
      const parent = canvas!.parentElement;
      const w = parent ? parent.clientWidth : 300;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas!.width = Math.max(1, Math.floor(w * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      canvas!.style.width = "100%";
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function draw(now: number) {
      const analyser = audio.analyser;
      const w = canvas!.clientWidth || 300;
      const h = height;
      ctx!.clearRect(0, 0, w, h);
      const elapsed = (now - t0) / 1000;

      if (variant === "bars") {
        const N = 40;
        let data: number[];
        if (analyser) {
          analyser.getByteFrequencyData(freq);
          data = Array.from({ length: N }, (_, i) => freq[Math.floor((i / N) * freq.length)] / 255);
        } else {
          data = Array.from({ length: N }, (_, i) => 0.15 + 0.12 * (0.5 + 0.5 * Math.sin(elapsed * 2 + i * 0.5)));
        }
        const gap = 2;
        const bw = (w - gap * (N - 1)) / N;
        for (let i = 0; i < N; i++) {
          const v = Math.max(0.02, data[i]);
          const bh = v * h;
          const color = colors[i % colors.length];
          ctx!.fillStyle = color;
          ctx!.globalAlpha = 0.85;
          const x = i * (bw + gap);
          ctx!.fillRect(x, h - bh, bw, bh);
          // mirrored soft reflection
          ctx!.globalAlpha = 0.12;
          ctx!.fillRect(x, h - bh - 3, bw, 3);
        }
        ctx!.globalAlpha = 1;
      } else {
        // waveform ribbon
        if (analyser) analyser.getByteTimeDomainData(time);
        ctx!.lineWidth = 2;
        ctx!.strokeStyle = colors[1];
        ctx!.beginPath();
        for (let i = 0; i < time.length; i++) {
          const x = (i / (time.length - 1)) * w;
          const base = analyser ? (time[i] - 128) / 128 : Math.sin(elapsed * 3 + i * 0.08) * 0.3;
          const y = h / 2 + base * (h / 2 - 2);
          if (i === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.stroke();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [variant, height, colors]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
