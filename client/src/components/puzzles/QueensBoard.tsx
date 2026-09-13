import { useEffect, useRef, useState } from "react";
import { validateQueens, type QueensPuzzle } from "@marvinho/shared";
import { sfx } from "../../audio/audio.js";

const REGION_COLORS = [
  "#e6394b", "#3aa0ff", "#42d17a", "#ffd23f",
  "#b06bff", "#ff8c42", "#28e0d0", "#ff6fcf",
  "#9a8f63", "#7ad1ff",
];

interface Props {
  puzzle: QueensPuzzle;
  disabled: boolean;
  onSolved: (solution: number[]) => void;
}

export function QueensBoard({ puzzle, disabled, onSolved }: Props) {
  const N = puzzle.size;
  // 0 = empty, 1 = X mark, 2 = queen
  const [cells, setCells] = useState<number[]>(() => new Array(N * N).fill(0));
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  useEffect(() => {
    if (disabled) return;
    const queens: number[] = [];
    cells.forEach((v, i) => v === 2 && queens.push(i));
    if (queens.length === N && validateQueens(puzzle, queens)) onSolvedRef.current(queens);
  }, [cells, disabled, puzzle, N]);

  // A plain click cycles the cell: empty → X → queen → empty.
  function cycle(i: number) {
    if (disabled) return;
    setCells((prev) => {
      const next = (prev[i] + 1) % 3;
      sfx(next === 2 ? "place" : "click");
      return prev.map((v, idx) => (idx === i ? next : v));
    });
  }

  // Hold and drag to erase: any X the drag passes over is cleared. Empty cells
  // and queens are left untouched.
  const dragging = useRef(false);
  const moved = useRef(false);
  const startCell = useRef<number | null>(null);

  function eraseX(i: number) {
    if (disabled) return;
    setCells((prev) => {
      if (prev[i] !== 1) return prev; // only clear X marks
      sfx("click");
      return prev.map((v, idx) => (idx === i ? 0 : v));
    });
  }

  useEffect(() => {
    const up = () => {
      // A press with no drag = a plain click, which cycles the cell.
      if (dragging.current && !moved.current && startCell.current !== null) {
        cycle(startCell.current);
      }
      dragging.current = false;
      moved.current = false;
      startCell.current = null;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  function onCellDown(i: number) {
    if (disabled) return;
    dragging.current = true;
    moved.current = false;
    startCell.current = i;
  }
  function onCellEnter(i: number) {
    if (!dragging.current) return;
    if (!moved.current) {
      // First movement turns the gesture into an erase stroke; clear the origin too.
      moved.current = true;
      if (startCell.current !== null) eraseX(startCell.current);
    }
    eraseX(i);
  }

  // Queens that clash: share a row, column or region, or touch (incl. diagonally).
  const queens: number[] = [];
  cells.forEach((v, i) => v === 2 && queens.push(i));
  const bad = new Set<number>();
  for (let a = 0; a < queens.length; a++)
    for (let b = a + 1; b < queens.length; b++) {
      const ia = queens[a], ib = queens[b];
      const ra = Math.floor(ia / N), ca = ia % N;
      const rb = Math.floor(ib / N), cb = ib % N;
      if (ra === rb || ca === cb || puzzle.regions[ia] === puzzle.regions[ib] ||
          (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1)) {
        bad.add(ia); bad.add(ib);
      }
    }

  const border = (i: number) => {
    const r = Math.floor(i / N), c = i % N;
    const reg = puzzle.regions[i];
    const diff = (nr: number, nc: number) =>
      nr < 0 || nr >= N || nc < 0 || nc >= N || puzzle.regions[nr * N + nc] !== reg;
    const thick = "3px solid #0d0b22";
    const thin = "1px solid rgba(13,11,34,0.35)";
    return {
      borderTop: diff(r - 1, c) ? thick : thin,
      borderBottom: diff(r + 1, c) ? thick : thin,
      borderLeft: diff(r, c - 1) ? thick : thin,
      borderRight: diff(r, c + 1) ? thick : thin,
    };
  };

  return (
    <div
      className="queens-grid"
      style={{
        gridTemplateColumns: `repeat(${N}, 1fr)`,
        gridTemplateRows: `repeat(${N}, 1fr)`,
      }}
    >
      {cells.map((v, i) => (
        <div
          key={i}
          className={`queens-cell${v === 2 && bad.has(i) ? " conflict" : ""}`}
          style={{ background: REGION_COLORS[puzzle.regions[i] % REGION_COLORS.length], ...border(i), touchAction: "none" }}
          onPointerDown={() => onCellDown(i)}
          onPointerEnter={() => onCellEnter(i)}
        >
          {v === 2 ? <span className="q-queen">♛</span> : v === 1 ? <span className="q-x">✕</span> : null}
        </div>
      ))}
    </div>
  );
}
