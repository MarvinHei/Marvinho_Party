// Canvas helpers for drawing the game's pixel characters — the same rounded
// pixel token used on the board (BoardScene), so the real-time minigames
// (Battle Royale, Verstecken, Runner Rush) show the exact same characters.

/** Lighten (amt>0) or darken (amt<0) a #rrggbb color; returns #rrggbb. */
export function shadeHex(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  let r = parseInt(c.slice(0, 2), 16);
  let g = parseInt(c.slice(2, 4), 16);
  let b = parseInt(c.slice(4, 6), 16);
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface TokenOpts {
  /** Draw a white outline (the local player). */
  me?: boolean;
  /** Dim the token (caught / eliminated). */
  alive?: boolean;
  /** Eye closure 0 (open) .. 1 (shut), for a blink. */
  blink?: number;
}

/**
 * Draws a board-style pixel character centered at (cx, cy) with the given
 * overall size (≈ diameter). Matches the board token: rounded body with a drop
 * shadow, belly highlight, dark outline, two eyes and a mouth.
 */
export function drawToken(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  opts: TokenOpts = {},
) {
  const alive = opts.alive ?? true;
  const me = opts.me ?? false;
  const bw = size;
  const bh = size;
  const br = size * 0.34;
  const left = cx - bw / 2;
  const top = cy - bh / 2;

  ctx.save();
  ctx.globalAlpha = alive ? 1 : 0.35;

  // Ground shadow.
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + size * 0.52, size * 0.48, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body: drop shadow, fill, belly highlight, dark outline.
  ctx.fillStyle = shadeHex(color, -0.28);
  roundRect(ctx, left, top + 3, bw, bh, br);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, left, top, bw, bh, br);
  ctx.fill();
  ctx.globalAlpha = (alive ? 1 : 0.35) * 0.55;
  ctx.fillStyle = shadeHex(color, 0.35);
  roundRect(ctx, left + bw * 0.16, top + bh * 0.12, bw * 0.68, bh * 0.34, br * 0.7);
  ctx.fill();
  ctx.globalAlpha = alive ? 1 : 0.35;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = me ? "#ffffff" : "#0d0b22";
  roundRect(ctx, left, top, bw, bh, br);
  ctx.stroke();

  // Face.
  const blink = opts.blink ?? 0;
  const eyeR = size * 0.13;
  const eyeY = cy - size * 0.06;
  const eyeDX = size * 0.18;
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeDX;
    if (blink > 0.5) {
      // Closed eye: a short dark lash line.
      ctx.strokeStyle = "#14122e";
      ctx.lineWidth = Math.max(2, size * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ex - eyeR, eyeY);
      ctx.lineTo(ex + eyeR, eyeY);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14122e";
    ctx.beginPath();
    ctx.arc(ex + size * 0.03, eyeY + size * 0.02, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex - size * 0.03, eyeY - size * 0.03, eyeR * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(20,18,46,0.7)";
  ctx.fillRect(cx - size * 0.11, cy + size * 0.2, size * 0.22, size * 0.05);

  ctx.restore();
}

/**
 * Draws a small knife at (cx, cy) whose tip points along `angle`, its base
 * pushed `reach` pixels out from that origin. Used for the seeker in
 * Verstecken (with an extra thrust distance during a stab).
 */
export function drawKnife(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  reach: number,
  scale: number,
) {
  ctx.save();
  ctx.translate(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
  ctx.rotate(angle);
  // Handle.
  ctx.fillStyle = "#5c3a14";
  ctx.fillRect(-scale * 0.5, -scale * 0.16, scale * 0.5, scale * 0.32);
  // Guard.
  ctx.fillStyle = "#3a2a12";
  ctx.fillRect(-scale * 0.02, -scale * 0.24, scale * 0.08, scale * 0.48);
  // Blade.
  ctx.fillStyle = "#e8ecf5";
  ctx.beginPath();
  ctx.moveTo(scale * 0.06, -scale * 0.16);
  ctx.lineTo(scale * 0.9, 0);
  ctx.lineTo(scale * 0.06, scale * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#9aa3b8";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}
