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
  /** Read-only external path to display (spectating another player). */
  view?: number[];
  /** Report the local path on change (for spectate streaming). */
  onView?: (path: number[]) => void;
}

export function ZipBoard({ puzzle, disabled, onSolved, view, onView }: Props) {
  const N = puzzle.size;
  const cell = BOARD_PX / N;
  const [own, setPath] = useState<number[]>([]);
  const locked = disabled || view !== undefined;
  const path = view ?? own;
  const dragging = useRef(false);
  const dragToRef = useRef<(i: number) => void>(() => {});
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  useEffect(() => {
    if (view !== undefined) return;
    onViewRef.current?.(own);
  }, [own, view]);

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
    // Touch drags don't fire pointerenter on the cells under the finger; hit-test.
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const attr = el?.closest("[data-zi]")?.getAttribute("data-zi");
      if (attr != null) dragToRef.current(Number(attr));
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", move, { passive: false });
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  useEffect(() => {
    if (!locked && own.length === N * N && validateZip(puzzle, own)) {
      onSolvedRef.current(own);
    }
  }, [own, locked, puzzle, N]);

  // A fresh press: tapping an existing track cell rewinds the cursor to there
  // (so you can reset without tracing back); otherwise it starts/extends.
  function tapCell(target: number) {
    if (locked) return;
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
    if (locked) return;
    setPath((prev) => {
      if (prev.length === 0 || prev.includes(target)) return prev;
      const head = prev[prev.length - 1];
      if (!adjacent(head, target, N)) return prev;
      sfx("click");
      return [...prev, target];
    });
  }
  dragToRef.current = dragTo;

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
              data-zi={i}
              className={`zip-cell${inPath ? " on" : ""}${i === head ? " head" : ""}`}
              style={{ touchAction: "none" }}
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
      <button className="mini-btn zip-reset" onClick={() => setPath([])} disabled={locked}>
        Reset
      </button>
    </div>
  );
}
