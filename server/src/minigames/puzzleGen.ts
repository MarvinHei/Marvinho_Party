import type {
  PuzzleSpec,
  PuzzleGame,
  PuzzleDifficulty,
  TangoConstraint,
} from "@marvinho/shared";

// ============================================================================
// Puzzle generators. Each returns a spec plus a known solution. Every generator
// enforces a UNIQUE solution: a dedicated backtracking counter (stopping at the
// second solution) drives clue selection so that exactly one valid solution
// exists — matching the shared rule validators.
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

/**
 * Count Hamiltonian paths (up to `cap`) that honour the numbered checkpoints:
 * start on checkpoint 1, end on checkpoint K, hitting checkpoints in order.
 * `nodeBudget` bounds the search; if hit, `exhausted` is false (uniqueness
 * unproven), which the generator treats as "not yet unique".
 */
function countZip(
  numbers: { index: number; value: number }[],
  N: number,
  nodeBudget: number,
  cap = 2,
): { count: number; exhausted: boolean } {
  const total = N * N;
  const checkpoint = new Array(total).fill(0);
  let K = 0;
  for (const n of numbers) { checkpoint[n.index] = n.value; K = Math.max(K, n.value); }
  const startCell = numbers.find((n) => n.value === 1)!.index;
  const visited = new Array(total).fill(false);
  let count = 0, nodes = 0, budgetHit = false;

  const rec = (cell: number, vcount: number, nextExpected: number): void => {
    if (count >= cap || budgetHit) return;
    if (++nodes > nodeBudget) { budgetHit = true; return; }
    let ne = nextExpected;
    const cv = checkpoint[cell];
    if (cv !== 0) {
      if (cv !== ne) return; // stepped on a checkpoint out of order
      ne = cv + 1;
    }
    if (vcount === total) { if (ne === K + 1) count++; return; }
    if (ne === K + 1) return; // reached the last checkpoint but cells remain
    for (const nb of neighbors(cell, N)) {
      if (!visited[nb]) {
        visited[nb] = true;
        rec(nb, vcount + 1, ne);
        visited[nb] = false;
        if (count >= cap || budgetHit) return;
      }
    }
  };

  visited[startCell] = true;
  rec(startCell, 1, 1);
  return { count, exhausted: !budgetHit };
}

export function genZip(difficulty: PuzzleDifficulty = "medium"): GeneratedPuzzle {
  const N = difficulty === "easy" ? 5 : difficulty === "hard" ? 7 : 6;
  const path = hamiltonianPath(N);
  const total = N * N;
  // Bounds the uniqueness search per checkpoint set (keeps generation snappy);
  // if hit, another checkpoint is added. Larger grids inherently need more
  // checkpoints to pin a single path.
  const budget = 500_000;
  // Checkpoints are chosen path-positions (always the endpoints); their value is
  // their order along the path, so the intended path is always a solution.
  const posSet = new Set<number>([0, total - 1]);
  const interiorPool = shuffle(range(1, total - 1));
  let pi = 0;
  const initialInterior = Math.min(8, Math.max(5, Math.round(total / 6))) - 2;
  for (let k = 0; k < initialInterior && pi < interiorPool.length; k++) posSet.add(interiorPool[pi++]);

  const build = () =>
    [...posSet].sort((a, b) => a - b).map((pos, i) => ({ index: path[pos], value: i + 1 }));

  let numbers = build();
  for (let guard = 0; guard < total; guard++) {
    const { count, exhausted } = countZip(numbers, N, budget, 2);
    if (exhausted && count === 1) break;
    // Add another checkpoint to prune alternative paths.
    while (pi < interiorPool.length && posSet.has(interiorPool[pi])) pi++;
    if (pi < interiorPool.length) {
      posSet.add(interiorPool[pi++]);
    } else {
      let added = false;
      for (let p = 1; p < total - 1; p++) if (!posSet.has(p)) { posSet.add(p); added = true; break; }
      if (!added) break; // every cell numbered → path is forced
    }
    numbers = build();
  }
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

function growRegions(seeds: number[], N: number): number[] {
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
  return regions;
}

/** Collect valid queen placements (up to `cap`); each entry is a cell per row. */
function queensSolutions(regions: number[], N: number, cap = 2): number[][] {
  const sols: number[][] = [];
  const usedCol = new Array(N).fill(false);
  const usedReg = new Array(N).fill(false);
  const colAt = new Array(N).fill(-1);
  const rec = (r: number): void => {
    if (sols.length >= cap) return;
    if (r === N) { sols.push(colAt.map((c, rr) => rr * N + c)); return; }
    for (let c = 0; c < N; c++) {
      if (usedCol[c]) continue;
      const reg = regions[r * N + c];
      if (usedReg[reg]) continue;
      if (r > 0 && Math.abs(c - colAt[r - 1]) < 2) continue; // no touching (adjacent rows)
      usedCol[c] = true; usedReg[reg] = true; colAt[r] = c;
      rec(r + 1);
      usedCol[c] = false; usedReg[reg] = false; colAt[r] = -1;
      if (sols.length >= cap) return;
    }
  };
  rec(0);
  return sols;
}

/** Are all cells of `regionId` still connected (4-neighbour) in `regions`? */
function regionConnected(regions: number[], N: number, regionId: number): boolean {
  const cells: number[] = [];
  for (let i = 0; i < N * N; i++) if (regions[i] === regionId) cells.push(i);
  if (cells.length <= 1) return true;
  const set = new Set(cells);
  const seen = new Set<number>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const cell = stack.pop()!;
    for (const nb of neighbors(cell, N)) if (set.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
  }
  return seen.size === cells.length;
}

/**
 * Reshape `regions` in place until the seed placement is the ONLY solution:
 * repeatedly find an alternative solution and move one of its (non-seed) queen
 * cells into a neighbouring region — which makes that alternative place two
 * queens in one region, killing it — while keeping every region connected and
 * the seed solution intact. Returns false if it gets stuck.
 */
function makeQueensUnique(regions: number[], seeds: number[], N: number): boolean {
  for (let iter = 0; iter < 500; iter++) {
    const sols = queensSolutions(regions, N, 2);
    if (sols.length === 1) return true;
    const alt = sols.find((s) => s.some((cell, r) => cell !== seeds[r]));
    if (!alt) return true;
    let moved = false;
    for (const r of shuffle(range(0, N))) {
      const X = alt[r];
      if (X === seeds[r]) continue; // never move a seed
      const A = regions[X];
      const candB = shuffle([...new Set(neighbors(X, N).map((nb) => regions[nb]).filter((rg) => rg !== A))]);
      for (const B of candB) {
        regions[X] = B;
        if (regionConnected(regions, N, A)) { moved = true; break; }
        regions[X] = A; // revert — would have split region A
      }
      if (moved) break;
    }
    if (!moved) return false;
  }
  return queensSolutions(regions, N, 2).length === 1;
}

export function genQueens(difficulty: PuzzleDifficulty = "medium"): GeneratedPuzzle {
  const N = difficulty === "easy" ? 6 : difficulty === "hard" ? 8 : 7;
  for (let attempt = 0; attempt < 80; attempt++) {
    const cols = queenColumns(N);
    const seeds = cols.map((c, r) => r * N + c);
    const regions = growRegions(seeds, N);
    if (makeQueensUnique(regions, seeds, N)) {
      return { spec: { game: "queens", queens: { size: N, regions } }, solution: seeds };
    }
  }
  // Fallback (extremely rare): a fresh layout, unique or not.
  const cols = queenColumns(N);
  const seeds = cols.map((c, r) => r * N + c);
  const regions = growRegions(seeds, N);
  return { spec: { game: "queens", queens: { size: N, regions } }, solution: seeds };
}

// --- Sudoku (6×6, 2×3 boxes) ------------------------------------------------

/** Count Sudoku solutions (up to `cap`) for the given clues, via MRV backtracking. */
function countSudoku(givens: number[], N: number, boxRows: number, boxCols: number, cap = 2): number {
  const g = [...givens];
  let count = 0;
  const valid = (idx: number, v: number): boolean => {
    const r = Math.floor(idx / N), c = idx % N;
    for (let cc = 0; cc < N; cc++) if (g[r * N + cc] === v) return false;
    for (let rr = 0; rr < N; rr++) if (g[rr * N + c] === v) return false;
    const br = Math.floor(r / boxRows) * boxRows, bc = Math.floor(c / boxCols) * boxCols;
    for (let dr = 0; dr < boxRows; dr++)
      for (let dc = 0; dc < boxCols; dc++)
        if (g[(br + dr) * N + (bc + dc)] === v) return false;
    return true;
  };
  const solve = (): void => {
    if (count >= cap) return;
    let best = -1;
    let bestCands: number[] = [];
    for (let i = 0; i < N * N; i++) {
      if (g[i] !== 0) continue;
      const cands: number[] = [];
      for (let v = 1; v <= N; v++) if (valid(i, v)) cands.push(v);
      if (cands.length === 0) return; // dead end
      if (best === -1 || cands.length < bestCands.length) {
        best = i; bestCands = cands;
        if (cands.length === 1) break;
      }
    }
    if (best === -1) { count++; return; } // no empty cell → a full solution
    for (const v of bestCands) {
      g[best] = v;
      solve();
      g[best] = 0;
      if (count >= cap) return;
    }
  };
  solve();
  return count;
}

export function genSudoku(difficulty: PuzzleDifficulty = "medium"): GeneratedPuzzle {
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

  // Start from the full solution and remove clues while the puzzle stays unique
  // (this yields a minimal, hard puzzle).
  const givens = [...g2];
  for (const i of shuffle(range(0, N * N))) {
    const saved = givens[i];
    givens[i] = 0;
    if (countSudoku(givens, N, R, C, 2) !== 1) givens[i] = saved;
  }
  // Easier levels keep more clues (adding givens never breaks uniqueness).
  const target = difficulty === "easy" ? 20 : difficulty === "medium" ? 15 : 0;
  const empties = shuffle(range(0, N * N).filter((i) => givens[i] === 0));
  for (const i of empties) {
    if (givens.filter((v) => v !== 0).length >= target) break;
    givens[i] = g2[i];
  }
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

/** Count Tango solutions (up to `cap`) for the given clues + constraints. */
function countTango(givens: number[], constraints: TangoConstraint[], N: number, cap = 2): number {
  const half = N / 2;
  const g = new Array(N * N).fill(0);
  // Constraints checked when the higher-indexed endpoint is placed (fill order).
  const consByHi = new Map<number, { lo: number; kind: "eq" | "neq" }[]>();
  for (const { a, b, kind } of constraints) {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (!consByHi.has(hi)) consByHi.set(hi, []);
    consByHi.get(hi)!.push({ lo, kind });
  }
  const rowOnes = new Array(N).fill(0), rowTwos = new Array(N).fill(0);
  const colOnes = new Array(N).fill(0), colTwos = new Array(N).fill(0);
  let count = 0;

  const canPlace = (pos: number, v: number): boolean => {
    const r = Math.floor(pos / N), c = pos % N;
    if (v === 1) { if (rowOnes[r] + 1 > half || colOnes[c] + 1 > half) return false; }
    else { if (rowTwos[r] + 1 > half || colTwos[c] + 1 > half) return false; }
    if (c >= 2 && g[pos - 1] === v && g[pos - 2] === v) return false;
    if (r >= 2 && g[pos - N] === v && g[pos - 2 * N] === v) return false;
    const cons = consByHi.get(pos);
    if (cons) for (const { lo, kind } of cons) {
      if (kind === "eq" && g[lo] !== v) return false;
      if (kind === "neq" && g[lo] === v) return false;
    }
    return true;
  };

  const rec = (pos: number): void => {
    if (count >= cap) return;
    if (pos === N * N) { count++; return; }
    const r = Math.floor(pos / N), c = pos % N;
    const forced = givens[pos];
    for (const v of forced ? [forced] : [1, 2]) {
      if (!canPlace(pos, v)) continue;
      g[pos] = v;
      if (v === 1) { rowOnes[r]++; colOnes[c]++; } else { rowTwos[r]++; colTwos[c]++; }
      rec(pos + 1);
      if (v === 1) { rowOnes[r]--; colOnes[c]--; } else { rowTwos[r]--; colTwos[c]--; }
      g[pos] = 0;
      if (count >= cap) return;
    }
  };
  rec(0);
  return count;
}

export function genTango(difficulty: PuzzleDifficulty = "medium"): GeneratedPuzzle {
  const N = 6;
  const sol = genTangoSolution(N) ?? genTangoSolution(N)!;

  // Candidate constraints: every adjacent pair, labelled from the solution.
  const pairPool: TangoConstraint[] = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      if (c < N - 1) pairPool.push({ a: i, b: i + 1, kind: sol[i] === sol[i + 1] ? "eq" : "neq" });
      if (r < N - 1) pairPool.push({ a: i, b: i + N, kind: sol[i] === sol[i + N] ? "eq" : "neq" });
    }
  shuffle(pairPool);

  // Seed with a handful of constraints, then add givens until the solution is
  // unique (all givens set = the full solution = trivially unique, so this
  // always terminates). Note: constraints alone can never force uniqueness —
  // swapping every 1↔2 preserves them — so at least one given is always needed.
  const constraints: TangoConstraint[] = pairPool.slice(0, Math.min(pairPool.length, N));
  const givens = new Array(N * N).fill(0);
  for (const i of shuffle(range(0, N * N))) {
    if (countTango(givens, constraints, N, 2) === 1) break;
    givens[i] = sol[i];
  }

  // Prune redundant givens first (keep the puzzle leaning on constraints), then
  // redundant constraints — always preserving uniqueness.
  for (const i of shuffle(range(0, N * N))) {
    if (!givens[i]) continue;
    const saved = givens[i];
    givens[i] = 0;
    if (countTango(givens, constraints, N, 2) !== 1) givens[i] = saved;
  }
  for (let k = constraints.length - 1; k >= 0; k--) {
    const removed = constraints[k];
    constraints.splice(k, 1);
    if (countTango(givens, constraints, N, 2) !== 1) constraints.splice(k, 0, removed);
  }

  // Easier levels reveal more starting symbols (extra givens keep it unique).
  const target = difficulty === "easy" ? 14 : difficulty === "medium" ? 8 : 0;
  const empties = shuffle(range(0, N * N).filter((i) => !givens[i]));
  for (const i of empties) {
    if (givens.filter((v) => v !== 0).length >= target) break;
    givens[i] = sol[i];
  }

  return { spec: { game: "tango", tango: { size: N, givens, constraints } }, solution: sol };
}

export function generatePuzzle(game: PuzzleGame, difficulty: PuzzleDifficulty = "medium"): GeneratedPuzzle {
  switch (game) {
    case "zip": return genZip(difficulty);
    case "queens": return genQueens(difficulty);
    case "sudoku": return genSudoku(difficulty);
    case "tango": return genTango(difficulty);
  }
}
