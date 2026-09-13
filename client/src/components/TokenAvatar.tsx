import { useEffect, useRef } from "react";
import type { Appearance } from "@marvinho/shared";
import { drawToken } from "./pixelChar.js";

/** Small canvas rendering a player's customized character (the board token). */
export function TokenAvatar({
  appearance,
  size = 32,
  me = false,
}: {
  appearance: Appearance;
  size?: number;
  me?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawToken(ctx, size / 2, size / 2 - size * 0.03, size * 0.74, appearance.color, {
      hair: appearance.hair,
      hairColor: appearance.hairColor,
      mouth: appearance.mouth,
      me,
    });
  }, [appearance, size, me, dpr]);

  return (
    <canvas
      ref={ref}
      width={Math.round(size * dpr)}
      height={Math.round(size * dpr)}
      style={{ width: size, height: size }}
      className="token-avatar"
      aria-hidden
    />
  );
}
