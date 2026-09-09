import { useEffect, useRef, useState } from "react";
import { validateTango, type TangoPuzzle } from "@marvinho/shared";

const BOARD_PX = 384;
const ICON = ["", "☀️", "🌙"]; // index by cell value

interface Props {
  puzzle: TangoPuzzle;
  disabled: boolean;
  onSolved: (solution: number[]) => void;
}

export function TangoBoard({ puzzle, disabled, onSolved }: Props) {
  const N = puzzle.size;
  const cell = BOARD_PX / N;
  const [grid, setGrid] = useState<number[]>(() => puzzle.givens.slice());
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  useEffect(() => {
    if (!disabled && grid.every((v) => v !== 0) && validateTango(puzzle, grid)) {
      onSolvedRef.current(grid);
    }
  }, [grid, disabled, puzzle]);

  function cycle(i: number) {
    if (disabled || puzzle.givens[i] !== 0) return;
    setGrid((prev) => prev.map((v, idx) => (idx === i ? (v + 1) % 3 : v)));
  }

  return (
    <div className="tango-board" style={{ width: BOARD_PX, height: BOARD_PX }}>
      <div
        className="tango-grid"
        style={{
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          gridTemplateRows: `repeat(${N}, 1fr)`,
          width: BOARD_PX,
          height: BOARD_PX,
        }}
      >
        {grid.map((v, i) => {
          const given = puzzle.givens[i] !== 0;
          return (
            <div
              key={i}
              className={`tango-cell${given ? " given" : ""}`}
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
          const x = horizontal ? (ca + 1) * cell : (ca + 0.5) * cell;
          const y = horizontal ? (ra + 0.5) * cell : (ra + 1) * cell;
          return (
            <div
              key={k}
              className="tango-con"
              style={{ left: x, top: y }}
            >
              {con.kind === "eq" ? "=" : "×"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
