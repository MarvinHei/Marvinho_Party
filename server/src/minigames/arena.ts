// Shared top-down arena for the real-time movement games (Hide & Seek, Battle
// Royale): a tile grid of walls plus circle movement, spawns and line-of-sight.

export interface Arena {
  cols: number;
  rows: number;
  walls: boolean[]; // row-major, true = solid
}

export function generateArena(cols: number, rows: number): Arena {
  const walls = new Array(cols * rows).fill(false);
  const at = (x: number, y: number) => y * cols + x;
  // Solid border.
  for (let x = 0; x < cols; x++) {
    walls[at(x, 0)] = true;
    walls[at(x, rows - 1)] = true;
  }
  for (let y = 0; y < rows; y++) {
    walls[at(0, y)] = true;
    walls[at(cols - 1, y)] = true;
  }
  // Scattered rectangular obstacles for cover.
  const count = Math.floor((cols * rows) / 40);
  for (let i = 0; i < count; i++) {
    const w = 1 + Math.floor(Math.random() * 3);
    const h = 1 + Math.floor(Math.random() * 3);
    const x = 2 + Math.floor(Math.random() * Math.max(1, cols - 4 - w));
    const y = 2 + Math.floor(Math.random() * Math.max(1, rows - 4 - h));
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) walls[at(x + dx, y + dy)] = true;
  }
  return { cols, rows, walls };
}

/** Compact "0"/"1" string of the wall grid, for the client init payload. */
export function encodeWalls(a: Arena): string {
  return a.walls.map((w) => (w ? "1" : "0")).join("");
}

export function isWall(a: Arena, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= a.cols || ty >= a.rows) return true;
  return a.walls[ty * a.cols + tx];
}

function collides(a: Arena, x: number, y: number, r: number): boolean {
  return (
    isWall(a, x - r, y - r) ||
    isWall(a, x + r, y - r) ||
    isWall(a, x - r, y + r) ||
    isWall(a, x + r, y + r) ||
    isWall(a, x, y)
  );
}

/** Move a circle by (dx,dy), sliding along walls (axis-separated). */
export function moveCircle(
  a: Arena,
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: number,
): { x: number; y: number } {
  let nx = x + dx;
  if (collides(a, nx, y, r)) nx = x;
  let ny = y + dy;
  if (collides(a, nx, ny, r)) ny = y;
  return { x: nx, y: ny };
}

/** A random open (non-wall) point, with a little padding from walls. */
export function randomSpawn(a: Arena, r = 0.4): { x: number; y: number } {
  for (let i = 0; i < 400; i++) {
    const x = 1.5 + Math.random() * (a.cols - 3);
    const y = 1.5 + Math.random() * (a.rows - 3);
    if (!collides(a, x, y, r)) return { x, y };
  }
  return { x: a.cols / 2, y: a.rows / 2 };
}

/** True if a straight line between the two points crosses no wall tile. */
export function hasLineOfSight(
  a: Arena,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist * 3) + 1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(a, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}
