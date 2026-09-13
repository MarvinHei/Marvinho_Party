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
  /** Hair style index (0 = bald). */
  hair?: number;
  /** Hair colour. */
  hairColor?: string;
  /** Mouth style index (0 = neutral line). */
  mouth?: number;
}

/** Hair sits clipped to the head silhouette, so it always reads on the body. */
export function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  style: number,
  color: string,
) {
  if (!style || style <= 0) return;
  const L = cx - size / 2;
  const T = cy - size / 2;
  const W = size;
  const H = size;
  const y = (frac: number) => T + H * frac;
  ctx.save();
  roundRect(ctx, L, T, W, H, size * 0.34);
  ctx.clip();
  ctx.fillStyle = color;
  switch (style) {
    case 1: // short
      ctx.fillRect(L, T, W, H * 0.33);
      break;
    case 2: { // spiky bangs (zigzag hairline)
      ctx.beginPath();
      ctx.moveTo(L, T);
      ctx.lineTo(L + W, T);
      ctx.lineTo(L + W, y(0.26));
      const n = 6;
      for (let i = n; i >= 0; i--) {
        ctx.lineTo(L + (i / n) * W, y(i % 2 === 0 ? 0.44 : 0.24));
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 3: // bowl cut
      ctx.fillRect(L, T, W, H * 0.4);
      break;
    case 4: // mohawk (central strip)
      ctx.fillRect(cx - W * 0.11, T, W * 0.22, H * 0.52);
      break;
    case 5: // afro (fill + scalloped hairline)
      ctx.fillRect(L, T, W, H * 0.28);
      for (let i = 0; i <= 5; i++) {
        ctx.beginPath();
        ctx.arc(L + i * (W / 5), y(0.28), W * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 6: { // side swoop (diagonal hairline)
      ctx.beginPath();
      ctx.moveTo(L, T);
      ctx.lineTo(L + W, T);
      ctx.lineTo(L + W, y(0.2));
      ctx.lineTo(L, y(0.46));
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export function drawMouth(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, style: number) {
  const my = cy + size * 0.22;
  ctx.fillStyle = "#14122e";
  ctx.strokeStyle = "#14122e";
  switch (style) {
    case 1: // smile
      ctx.lineWidth = Math.max(2, size * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, my - size * 0.04, size * 0.15, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    case 2: // open oval
      ctx.beginPath();
      ctx.ellipse(cx, my, size * 0.09, size * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 3: // grin with a tooth line
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.16, my - size * 0.04);
      ctx.quadraticCurveTo(cx, my + size * 0.15, cx + size * 0.16, my - size * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(1, size * 0.025);
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.12, my - size * 0.01);
      ctx.lineTo(cx + size * 0.12, my - size * 0.01);
      ctx.stroke();
      break;
    case 4: // small o
      ctx.beginPath();
      ctx.arc(cx, my, size * 0.055, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: // 0 neutral line
      ctx.fillRect(cx - size * 0.11, cy + size * 0.2, size * 0.22, size * 0.05);
  }
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

  // Hair (clipped to the head, so it sits on the body).
  drawHair(ctx, cx, cy, size, opts.hair ?? 0, opts.hairColor ?? "#2b2b33");

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
  drawMouth(ctx, cx, cy, size, opts.mouth ?? 0);

  ctx.restore();
}

/**
 * Draws one character eye centered at (cx, cy) with radius `r`. `lookX`/`lookY`
 * (each ~ -1..1) shift the pupil to gaze in a direction; `blink` (0 open .. 1
 * shut) closes it. Used big and standalone for the lobby backdrop.
 */
export function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  lookX: number,
  lookY: number,
  blink: number,
) {
  if (blink > 0.5) {
    ctx.strokeStyle = "#c9cee0";
    ctx.lineWidth = Math.max(3, r * 0.18);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.9, cy);
    ctx.lineTo(cx + r * 0.9, cy);
    ctx.stroke();
    return;
  }
  // White.
  ctx.fillStyle = "#f2f4fa";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.strokeStyle = "#0d0b22";
  ctx.stroke();
  // Pupil, gazing toward (lookX, lookY).
  const px = cx + lookX * r * 0.42;
  const py = cy + lookY * r * 0.42;
  ctx.fillStyle = "#14122e";
  ctx.beginPath();
  ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Glint.
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(px - r * 0.18, py - r * 0.18, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
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
