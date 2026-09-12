import { useEffect, useMemo, useRef, useState } from "react";
import { validateZip, type ZipPuzzle } from "@marvinho/shared";
import { sfx } from "../../audio/audio.js";

const BOARD_PX = 384;

function adjacent(a: number, b: number, N: number): boolean {
  const ra = Math.floor(a / N), ca = a % N, rb = Math.floor(b / N), cb = b % N;
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
}

interface Props {
  puzzle: ZipPuzzle;
  disabled: boolean;
  onSolved: (solution: number[]) => void;
}

export function ZipBoard({ puzzle, disabled, onSolved }: Props) {
  const N = puzzle.size;
  const cell = BOARD_PX / N;
  const [path, setPath] = useState<number[]>([]);
  const dragging = useRef(false);
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  const numMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const n of puzzle.numbers) m.set(n.index, n.value);
    return m;
  }, [puzzle]);
  const startIndex = useMemo(
    () => puzzle.numbers.find((n) => n.value === 1)?.index ?? 0,
    [puzzle],
  );

  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  useEffect(() => {
    if (!disabled && path.length === N * N && validateZip(puzzle, path)) {
      onSolvedRef.current(path);
    }
  }, [path, disabled, puzzle, N]);

  // A fresh press: tapping an existing track cell rewinds the cursor to there
  // (so you can reset without tracing back); otherwise it starts/extends.
  function tapCell(target: number) {
    if (disabled) return;
    setPath((prev) => {
      let next = prev;
      const existing = prev.indexOf(target);
      if (existing >= 0) {
        next = existing === prev.length - 1 ? prev : prev.slice(0, existing + 1);
      } else if (prev.length === 0) {
        next = target === startIndex ? [target] : prev;
      } else {
        const head = prev[prev.length - 1];
        if (adjacent(head, target, N)) next = [...prev, target];
      }
      if (next !== prev) sfx("click");
      return next;
    });
  }

  // While dragging: only extend onto new adjacent cells. Crossing back over the
  // existing track does NOT rewind — you keep going. (To rewind, lift and tap.)
  function dragTo(target: number) {
    if (disabled) return;
    setPath((prev) => {
      if (prev.length === 0 || prev.includes(target)) return prev;
      const head = prev[prev.length - 1];
      if (!adjacent(head, target, N)) return prev;
      sfx("click");
      return [...prev, target];
    });
  }

  const pathSet = new Set(path);
  const head = path[path.length - 1];

  const points = path
    .map((c) => `${(c % N + 0.5) * cell},${(Math.floor(c / N) + 0.5) * cell}`)
    .join(" ");

  return (
    <div className="zip-board">
      <div
        className="zip-grid"
        style={{
          gridTemplateColumns: `repeat(${N}, 1fr)`,
          gridTemplateRows: `repeat(${N}, 1fr)`,
        }}
      >
        {Array.from({ length: N * N }, (_, i) => {
          const num = numMap.get(i);
          const inPath = pathSet.has(i);
          return (
            <div
              key={i}
              className={`zip-cell${inPath ? " on" : ""}${i === head ? " head" : ""}`}
              onPointerDown={() => {
                dragging.current = true;
                tapCell(i);
              }}
              onPointerEnter={() => {
                if (dragging.current) dragTo(i);
              }}
            >
              {num !== undefined && <span className="zip-num">{num}</span>}
            </div>
          );
        })}
      </div>
      <svg className="zip-lines" viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`} preserveAspectRatio="none">
        {path.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke="#ffd23f"
            strokeWidth={cell * 0.28}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
      <button className="mini-btn zip-reset" onClick={() => setPath([])} disabled={disabled}>
        Reset
      </button>
    </div>
  );
}
