// ============================================================================
// LinkedIn-style single-player puzzles: types + pure rule validators.
// Validators live here so the client (auto-submit / live feedback) and the
// server (authoritative check) share exactly the same rules.
// ============================================================================

export type PuzzleGame = "zip" | "queens" | "sudoku" | "tango";

export const PUZZLE_ROUND_SECONDS: Record<PuzzleGame, number> = {
  zip: 150,
  queens: 180,
  sudoku: 300,
  tango: 240,
};

/** Host-selectable difficulty applied to all puzzle-race minigames. */
export type PuzzleDifficulty = "easy" | "medium" | "hard";

export const PUZZLE_DIFFICULTIES: PuzzleDifficulty[] = ["easy", "medium", "hard"];

export const PUZZLE_DIFFICULTY_LABELS: Record<PuzzleDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

// --- puzzle definitions -----------------------------------------------------

export interface ZipPuzzle {
  size: number;
  /** Numbered checkpoints; index = row*size+col, value = 1..K. */
  numbers: { index: number; value: number }[];
}

export interface QueensPuzzle {
  size: number;
  /** regions[cellIndex] = region id (0..size-1). */
  regions: number[];
}

export interface SudokuPuzzle {
  size: number; // 6
  boxRows: number; // 2
  boxCols: number; // 3
  /** givens[cellIndex] = 1..size, or 0 for empty. */
  givens: number[];
}

export interface TangoConstraint {
  a: number;
  b: number;
  kind: "eq" | "neq";
}

export interface TangoPuzzle {
  size: number; // 6
  /** givens[cellIndex] = 1 (sun), 2 (moon), or 0 empty. */
  givens: number[];
  constraints: TangoConstraint[];
}

export type PuzzleSpec =
  | { game: "zip"; zip: ZipPuzzle }
  | { game: "queens"; queens: QueensPuzzle }
  | { game: "sudoku"; sudoku: SudokuPuzzle }
  | { game: "tango"; tango: TangoPuzzle };

export interface PuzzleStanding {
  playerId: string;
  nickname: string;
  color: string;
  solved: boolean;
  rank: number | null;
}

// --- helpers ----------------------------------------------------------------

function adjacent(a: number, b: number, size: number): boolean {
  const ra = Math.floor(a / size), ca = a % size;
  const rb = Math.floor(b / size), cb = b % size;
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
}

// --- validators -------------------------------------------------------------

/** A valid Zip solution: a single path covering every cell once, starting at 1,
 *  ending at the highest number, hitting the numbered cells in order. */
export function validateZip(p: ZipPuzzle, path: number[]): boolean {
  const total = p.size * p.size;
  if (path.length !== total) return false;
  const seen = new Set(path);
  if (seen.size !== total) return false;
  for (const c of path) if (c < 0 || c >= total) return false;
  for (let i = 1; i < path.length; i++) {
    if (!adjacent(path[i - 1], path[i], p.size)) return false;
  }
  const numMap = new Map<number, number>();
  for (const n of p.numbers) numMap.set(n.index, n.value);
  const K = p.numbers.length;
  const first = p.numbers.find((n) => n.value === 1);
  const last = p.numbers.find((n) => n.value === K);
  if (!first || !last) return false;
  if (path[0] !== first.index || path[path.length - 1] !== last.index) return false;
  const seq: number[] = [];
  for (const c of path) if (numMap.has(c)) seq.push(numMap.get(c)!);
  if (seq.length !== K) return false;
  for (let i = 0; i < K; i++) if (seq[i] !== i + 1) return false;
  return true;
}

/** A valid Queens solution: one queen per row, column and region, none touching
 *  (including diagonally). */
export function validateQueens(p: QueensPuzzle, queens: number[]): boolean {
  const N = p.size;
  if (queens.length !== N) return false;
  if (new Set(queens).size !== N) return false;
  const cells = queens.map((c) => ({ r: Math.floor(c / N), c: c % N, idx: c }));
  for (const { idx } of cells) if (idx < 0 || idx >= N * N) return false;
  const rows = new Set<number>(), cols = new Set<number>(), regs = new Set<number>();
  for (const { r, c, idx } of cells) {
    rows.add(r); cols.add(c); regs.add(p.regions[idx]);
  }
  if (rows.size !== N || cols.size !== N || regs.size !== N) return false;
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      if (Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1) return false;
    }
  return true;
}

/** A valid Sudoku solution: rows/cols/boxes each hold 1..size once, givens kept. */
export function validateSudoku(p: SudokuPuzzle, g: number[]): boolean {
  const N = p.size;
  if (g.length !== N * N) return false;
  for (let i = 0; i < g.length; i++) {
    if (g[i] < 1 || g[i] > N) return false;
    if (p.givens[i] && g[i] !== p.givens[i]) return false;
  }
  for (let r = 0; r < N; r++) {
    const s = new Set<number>();
    for (let c = 0; c < N; c++) s.add(g[r * N + c]);
    if (s.size !== N) return false;
  }
  for (let c = 0; c < N; c++) {
    const s = new Set<number>();
    for (let r = 0; r < N; r++) s.add(g[r * N + c]);
    if (s.size !== N) return false;
  }
  for (let br = 0; br < N; br += p.boxRows)
    for (let bc = 0; bc < N; bc += p.boxCols) {
      const s = new Set<number>();
      for (let r = 0; r < p.boxRows; r++)
        for (let c = 0; c < p.boxCols; c++) s.add(g[(br + r) * N + (bc + c)]);
      if (s.size !== N) return false;
    }
  return true;
}

/** A valid Tango solution: filled with 1/2, each row/col balanced, no three in a
 *  row, all "=" / "×" constraints and givens satisfied. */
export function validateTango(p: TangoPuzzle, g: number[]): boolean {
  const N = p.size;
  if (g.length !== N * N) return false;
  for (let i = 0; i < g.length; i++) {
    if (g[i] !== 1 && g[i] !== 2) return false;
    if (p.givens[i] && g[i] !== p.givens[i]) return false;
  }
  const half = N / 2;
  for (let r = 0; r < N; r++) {
    let ones = 0;
    for (let c = 0; c < N; c++) if (g[r * N + c] === 1) ones++;
    if (ones !== half) return false;
  }
  for (let c = 0; c < N; c++) {
    let ones = 0;
    for (let r = 0; r < N; r++) if (g[r * N + c] === 1) ones++;
    if (ones !== half) return false;
  }
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N - 2; c++) {
      const i = r * N + c;
      if (g[i] === g[i + 1] && g[i] === g[i + 2]) return false;
    }
  for (let c = 0; c < N; c++)
    for (let r = 0; r < N - 2; r++) {
      const i = r * N + c;
      if (g[i] === g[i + N] && g[i] === g[i + 2 * N]) return false;
    }
  for (const { a, b, kind } of p.constraints) {
    if (kind === "eq" && g[a] !== g[b]) return false;
    if (kind === "neq" && g[a] === g[b]) return false;
  }
  return true;
}

export function validatePuzzle(spec: PuzzleSpec, solution: number[]): boolean {
  switch (spec.game) {
    case "zip": return validateZip(spec.zip, solution);
    case "queens": return validateQueens(spec.queens, solution);
    case "sudoku": return validateSudoku(spec.sudoku, solution);
    case "tango": return validateTango(spec.tango, solution);
  }
}
