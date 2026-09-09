import type {
  PuzzleSpec,
  PuzzleGame,
} from "@marvinho/shared";

// ============================================================================
// Puzzle generators. Each returns a spec plus a known solution, so puzzles are
// always solvable by construction (uniqueness isn't required for a race).
// ============================================================================

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i < b; i++) out.push(i);
  return out;
}
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function neighbors(cell: number, N: number): number[] {
  const r = Math.floor(cell / N), c = cell % N;
  const out: number[] = [];
  if (r > 0) out.push(cell - N);
  if (r < N - 1) out.push(cell + N);
  if (c > 0) out.push(cell - 1);
  if (c < N - 1) out.push(cell + 1);
  return out;
}

export interface GeneratedPuzzle {
  spec: PuzzleSpec;
  solution: number[];
}

// --- Zip --------------------------------------------------------------------

function snakePath(N: number): number[] {
  const path: number[] = [];
  for (let r = 0; r < N; r++) {
    const cols = r % 2 === 0 ? range(0, N) : range(0, N).reverse();
    for (const c of cols) path.push(r * N + c);
  }
  return path;
}

function hamiltonianPath(N: number): number[] {
  const total = N * N;
  for (let restart = 0; restart < 300; restart++) {
    const start = Math.floor(Math.random() * total);
    const visited = new Array(total).fill(false);
    const path = [start];
    visited[start] = true;
    let ok = true;
    for (let step = 1; step < total; step++) {
      const cur = path[path.length - 1];
      const cands = neighbors(cur, N).filter((n) => !visited[n]);
      if (cands.length === 0) { ok = false; break; }
      // Warnsdorff: prefer the neighbor with the fewest onward moves.
      let best: number[] = [];
      let bestDeg = Infinity;
      for (const n of cands) {
        const deg = neighbors(n, N).filter((m) => !visited[m]).length;
        if (deg < bestDeg) { bestDeg = deg; best = [n]; }
        else if (deg === bestDeg) best.push(n);
      }
      const next = best[Math.floor(Math.random() * best.length)];
      visited[next] = true;
      path.push(next);
    }
    if (ok && path.length === total) return path;
  }
  return snakePath(N);
}

export function genZip(N = 6): GeneratedPuzzle {
  const path = hamiltonianPath(N);
  const total = N * N;
  const K = Math.min(8, Math.max(5, Math.round(total / 6)));
  const interior = shuffle(range(1, total - 1)).slice(0, K - 2).sort((a, b) => a - b);
  const positions = [0, ...interior, total - 1];
  const numbers = positions.map((pos, i) => ({ index: path[pos], value: i + 1 }));
  return { spec: { game: "zip", zip: { size: N, numbers } }, solution: path };
}

// --- Queens -----------------------------------------------------------------

function queenColumns(N: number): number[] {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const cols = shuffle(range(0, N));
    let ok = true;
    for (let r = 1; r < N; r++) {
      if (Math.abs(cols[r] - cols[r - 1]) < 2) { ok = false; break; }
    }
    if (ok) return cols;
  }
  // Fallback: interleave evens then odds — always non-adjacent between rows.
  return [...range(0, N).filter((c) => c % 2 === 0), ...range(0, N).filter((c) => c % 2 === 1)];
}

export function genQueens(N = 8): GeneratedPuzzle {
  const cols = queenColumns(N);
  const seeds = cols.map((c, r) => r * N + c);
  const regions = new Array(N * N).fill(-1);
  let frontier: number[] = [];
  seeds.forEach((cell, r) => {
    regions[cell] = r;
    frontier.push(cell);
  });
  // Multi-source BFS with shuffled expansion → connected, organic regions.
  while (frontier.length) {
    const next: number[] = [];
    for (const cell of shuffle(frontier)) {
      for (const nb of shuffle(neighbors(cell, N))) {
        if (regions[nb] === -1) { regions[nb] = regions[cell]; next.push(nb); }
      }
    }
    frontier = next;
  }
  return { spec: { game: "queens", queens: { size: N, regions } }, solution: seeds };
}

// --- Sudoku (6×6, 2×3 boxes) ------------------------------------------------

export function genSudoku(): GeneratedPuzzle {
  const N = 6, R = 2, C = 3;
  let g = new Array(N * N);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      g[r * N + c] = ((C * (r % R) + Math.floor(r / R) + c) % N) + 1;

  const sym = shuffle(range(1, N + 1));
  g = g.map((v) => sym[v - 1]);

  const rowOrder: number[] = [];
  for (const b of shuffle(range(0, N / R)))
    rowOrder.push(...shuffle(range(b * R, b * R + R)));
  const colOrder: number[] = [];
  for (const s of shuffle(range(0, N / C)))
    colOrder.push(...shuffle(range(s * C, s * C + C)));

  const g2 = new Array(N * N);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) g2[r * N + c] = g[rowOrder[r] * N + colOrder[c]];
  // Note: no transpose — it would turn 2×3 boxes into 3×2 and break validity.

  const clues = 18;
  const idxs = shuffle(range(0, N * N));
  const givens = new Array(N * N).fill(0);
  for (let i = 0; i < clues; i++) givens[idxs[i]] = g2[idxs[i]];
  return { spec: { game: "sudoku", sudoku: { size: N, boxRows: R, boxCols: C, givens } }, solution: g2 };
}

// --- Tango (6×6) ------------------------------------------------------------

function genTangoSolution(N: number): number[] | null {
  const g = new Array(N * N).fill(0);
  const half = N / 2;
  const rowCount = (r: number, v: number) => {
    let k = 0;
    for (let c = 0; c < N; c++) if (g[r * N + c] === v) k++;
    return k;
  };
  const colCount = (c: number, v: number) => {
    let k = 0;
    for (let r = 0; r < N; r++) if (g[r * N + c] === v) k++;
    return k;
  };
  const ok = (r: number, c: number, v: number) => {
    if (c >= 2 && g[r * N + c - 1] === v && g[r * N + c - 2] === v) return false;
    if (r >= 2 && g[(r - 1) * N + c] === v && g[(r - 2) * N + c] === v) return false;
    if (rowCount(r, v) + 1 > half) return false;
    if (colCount(c, v) + 1 > half) return false;
    return true;
  };
  const solve = (pos: number): boolean => {
    if (pos === N * N) return true;
    const r = Math.floor(pos / N), c = pos % N;
    for (const v of shuffle([1, 2])) {
      if (ok(r, c, v)) {
        g[pos] = v;
        if (solve(pos + 1)) return true;
        g[pos] = 0;
      }
    }
    return false;
  };
  return solve(0) ? g : null;
}

export function genTango(N = 6): GeneratedPuzzle {
  const sol = genTangoSolution(N) ?? genTangoSolution(N)!;
  // Constraints from a handful of random adjacent pairs.
  const pairs: { a: number; b: number }[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      if (c < N - 1) pairs.push({ a: i, b: i + 1 });
      if (r < N - 1) pairs.push({ a: i, b: i + N });
    }
  const chosen = shuffle(pairs).slice(0, 7);
  const constraints = chosen.map(({ a, b }) => ({
    a,
    b,
    kind: sol[a] === sol[b] ? ("eq" as const) : ("neq" as const),
  }));

  const givens = new Array(N * N).fill(0);
  const clueIdx = shuffle(range(0, N * N)).slice(0, 8);
  for (const i of clueIdx) givens[i] = sol[i];

  return { spec: { game: "tango", tango: { size: N, givens, constraints } }, solution: sol };
}

export function generatePuzzle(game: PuzzleGame): GeneratedPuzzle {
  switch (game) {
    case "zip": return genZip();
    case "queens": return genQueens();
    case "sudoku": return genSudoku();
    case "tango": return genTango();
  }
}
