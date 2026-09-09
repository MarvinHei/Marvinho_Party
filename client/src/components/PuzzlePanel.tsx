import { useEffect, useState } from "react";
import { MINIGAME_NAMES } from "@marvinho/shared";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { ZipBoard } from "./puzzles/ZipBoard.js";
import { QueensBoard } from "./puzzles/QueensBoard.js";
import { SudokuBoard } from "./puzzles/SudokuBoard.js";
import { TangoBoard } from "./puzzles/TangoBoard.js";

export function PuzzlePanel({ seat }: { seat: SeatState }) {
  const p = seat.puzzle;
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(i);
  }, []);

  if (!p) {
    return (
      <div className="center-stage">
        <div className="panel"><h2 className="pixel">Loading puzzle…</h2></div>
      </div>
    );
  }

  const net = store.net(seat.id);
  const solved = p.solvedByMe;
  const secondsLeft = Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000));

  async function onSolved(solution: number[]) {
    if (!net || solved) return;
    try {
      const res = await net.puzzleSubmit(solution);
      if (res.solved) store.setPuzzleSolved(seat.id);
    } catch {
      /* ignore */
    }
  }

  const board =
    p.spec.game === "zip" ? (
      <ZipBoard puzzle={p.spec.zip} disabled={solved} onSolved={onSolved} />
    ) : p.spec.game === "queens" ? (
      <QueensBoard puzzle={p.spec.queens} disabled={solved} onSolved={onSolved} />
    ) : p.spec.game === "sudoku" ? (
      <SudokuBoard puzzle={p.spec.sudoku} disabled={solved} onSolved={onSolved} />
    ) : (
      <TangoBoard puzzle={p.spec.tango} disabled={solved} onSolved={onSolved} />
    );

  return (
    <div className="puzzle-wrap">
      <div className="puzzle-top">
        <div className="puzzle-name pixel">{MINIGAME_NAMES[p.game]}</div>
        <div className="puzzle-timer pixel">⏱ {secondsLeft}s</div>
      </div>

      <div className="puzzle-body">
        <div className="puzzle-board-col">
          <div className="puzzle-board-frame">
            {board}
            {solved && (
              <div className="puzzle-solved">
                Solved! 🎉<span>waiting for others…</span>
              </div>
            )}
          </div>
        </div>

        <div className="puzzle-standings">
          <div className="p-standings-title pixel">Standings</div>
          {seat.puzzleStandings.map((s) => (
            <div key={s.playerId} className={`p-standing${s.solved ? " solved" : ""}`}>
              <span className="swatch" style={{ background: s.color }} />
              <span className="sk-nick">{s.nickname}</span>
              <span className="p-rank">{s.solved ? `#${(s.rank ?? 0) + 1}` : "…"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
