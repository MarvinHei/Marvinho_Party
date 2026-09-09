import { useEffect, useRef, useState } from "react";
import { validateSudoku, type SudokuPuzzle } from "@marvinho/shared";

const BOARD_PX = 384;

interface Props {
  puzzle: SudokuPuzzle;
  disabled: boolean;
  onSolved: (solution: number[]) => void;
}

export function SudokuBoard({ puzzle, disabled, onSolved }: Props) {
  const N = puzzle.size;
  const [grid, setGrid] = useState<number[]>(() => puzzle.givens.slice());
  const [sel, setSel] = useState<number | null>(null);
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  useEffect(() => {
    if (!disabled && grid.every((v) => v !== 0) && validateSudoku(puzzle, grid)) {
      onSolvedRef.current(grid);
    }
  }, [grid, disabled, puzzle]);

  function set(i: number, val: number) {
    if (disabled || puzzle.givens[i] !== 0) return;
    setGrid((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (sel === null) return;
      if (/^[1-6]$/.test(e.key)) set(sel, Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") set(sel, 0);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, disabled]);

  // conflicts: a filled cell duplicated in its row/col/box
  const conflict = (i: number): boolean => {
    const v = grid[i];
    if (!v) return false;
    const r = Math.floor(i / N), c = i % N;
    for (let k = 0; k < N; k++) {
      if (k !== c && grid[r * N + k] === v) return true;
      if (k !== r && grid[k * N + c] === v) return true;
    }
    const br = Math.floor(r / puzzle.boxRows) * puzzle.boxRows;
    const bc = Math.floor(c / puzzle.boxCols) * puzzle.boxCols;
    for (let dr = 0; dr < puzzle.boxRows; dr++)
      for (let dc = 0; dc < puzzle.boxCols; dc++) {
        const j = (br + dr) * N + (bc + dc);
        if (j !== i && grid[j] === v) return true;
      }
    return false;
  };

  return (
    <div className="sudoku-outer">
      <div
        className="sudoku-grid"
        style={{
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          gridTemplateRows: `repeat(${N}, 1fr)`,
          width: BOARD_PX,
          height: BOARD_PX,
        }}
      >
        {grid.map((v, i) => {
          const r = Math.floor(i / N), c = i % N;
          const given = puzzle.givens[i] !== 0;
          const cls = ["sudoku-cell"];
          if (given) cls.push("given");
          if (sel === i) cls.push("sel");
          if (conflict(i)) cls.push("conflict");
          if (c % puzzle.boxCols === 0) cls.push("box-l");
          if (r % puzzle.boxRows === 0) cls.push("box-t");
          if (c === N - 1) cls.push("box-r");
          if (r === N - 1) cls.push("box-b");
          return (
            <div key={i} className={cls.join(" ")} onClick={() => setSel(i)}>
              {v !== 0 ? v : ""}
            </div>
          );
        })}
      </div>
      <div className="sudoku-pad">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} className="pad-btn" disabled={disabled} onClick={() => sel !== null && set(sel, n)}>
            {n}
          </button>
        ))}
        <button className="pad-btn" disabled={disabled} onClick={() => sel !== null && set(sel, 0)}>
          ⌫
        </button>
      </div>
    </div>
  );
}
