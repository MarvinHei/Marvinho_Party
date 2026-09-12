import { useEffect, useRef, useState } from "react";
import { validateTango, type TangoPuzzle } from "@marvinho/shared";
import { sfx } from "../../audio/audio.js";

const ICON = ["", "🪐", "⭐"]; // index by cell value (1 = Jupiter, 2 = Star)

interface Props {
  puzzle: TangoPuzzle;
  disabled: boolean;
  onSolved: (solution: number[]) => void;
}

export function TangoBoard({ puzzle, disabled, onSolved }: Props) {
  const N = puzzle.size;
  const [grid, setGrid] = useState<number[]>(() => puzzle.givens.slice());
  // Mistakes only glow red once the player has paused (no clicks) for 2s, so
  // rapid experimenting doesn't flash red on every tap.
  const [showErrors, setShowErrors] = useState(false);
  const errTimer = useRef<number | null>(null);
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  useEffect(() => () => { if (errTimer.current != null) clearTimeout(errTimer.current); }, []);

  useEffect(() => {
    if (!disabled && grid.every((v) => v !== 0) && validateTango(puzzle, grid)) {
      onSolvedRef.current(grid);
    }
  }, [grid, disabled, puzzle]);

  function cycle(i: number) {
    if (disabled || puzzle.givens[i] !== 0) return;
    sfx("click");
    setGrid((prev) => prev.map((v, idx) => (idx === i ? (v + 1) % 3 : v)));
    // Reset the "settled" timer: hide errors now, reveal them after 2s of calm.
    setShowErrors(false);
    if (errTimer.current != null) clearTimeout(errTimer.current);
    errTimer.current = window.setTimeout(() => setShowErrors(true), 2000);
  }

  // --- rule-violation highlighting ---
  const badCells = new Set<number>();
  const badCons = new Set<number>();
  const half = N / 2;
  // three-in-a-row (horizontal + vertical)
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const i = r * N + c;
      const v = grid[i];
      if (!v) continue;
      if (c < N - 2 && grid[i + 1] === v && grid[i + 2] === v) { badCells.add(i); badCells.add(i + 1); badCells.add(i + 2); }
      if (r < N - 2 && grid[i + N] === v && grid[i + 2 * N] === v) { badCells.add(i); badCells.add(i + N); badCells.add(i + 2 * N); }
    }
  // too many of one symbol in a row / column
  for (let r = 0; r < N; r++)
    for (const val of [1, 2]) {
      const idxs: number[] = [];
      for (let c = 0; c < N; c++) if (grid[r * N + c] === val) idxs.push(r * N + c);
      if (idxs.length > half) idxs.forEach((i) => badCells.add(i));
    }
  for (let c = 0; c < N; c++)
    for (const val of [1, 2]) {
      const idxs: number[] = [];
      for (let r = 0; r < N; r++) if (grid[r * N + c] === val) idxs.push(r * N + c);
      if (idxs.length > half) idxs.forEach((i) => badCells.add(i));
    }
  // violated = / × constraints (only once both ends are filled)
  puzzle.constraints.forEach((con, k) => {
    const va = grid[con.a], vb = grid[con.b];
    if (!va || !vb) return;
    if ((con.kind === "eq" && va !== vb) || (con.kind === "neq" && va === vb)) {
      badCons.add(k);
      badCells.add(con.a);
      badCells.add(con.b);
    }
  });

  return (
    <div className="tango-board">
      <div
        className="tango-grid"
        style={{
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          gridTemplateRows: `repeat(${N}, 1fr)`,
        }}
      >
        {grid.map((v, i) => {
          const given = puzzle.givens[i] !== 0;
          return (
            <div
              key={i}
              className={`tango-cell${given ? " given" : ""}${showErrors && badCells.has(i) ? " conflict" : ""}${v ? ` v${v}` : ""}`}
              onClick={() => cycle(i)}
            >
              <span className="tango-icon">{ICON[v]}</span>
            </div>
          );
        })}
      </div>
      <div className="tango-constraints">
        {puzzle.constraints.map((con, k) => {
          const ra = Math.floor(con.a / N), ca = con.a % N;
          const horizontal = con.b === con.a + 1;
          const x = (horizontal ? ca + 1 : ca + 0.5) / N * 100;
          const y = (horizontal ? ra + 0.5 : ra + 1) / N * 100;
          return (
            <div
              key={k}
              className={`tango-con${showErrors && badCons.has(k) ? " bad" : ""}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {con.kind === "eq" ? "=" : "×"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
