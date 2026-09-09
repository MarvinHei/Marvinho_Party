import { useEffect, useState } from "react";
import type { LetterState } from "@marvinho/shared";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";

function Cell({ ch, state }: { ch: string; state?: LetterState }) {
  const cls = ["wordle-cell"];
  if (state) cls.push(state, "reveal");
  else if (ch) cls.push("filled");
  return <div className={cls.join(" ")}>{ch}</div>;
}

export function WordlePanel({ seat }: { seat: SeatState }) {
  const w = seat.wordle;
  const [, setTick] = useState(0);

  // Tick for the round countdown.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  // Keyboard input for the active seat. Bound once per seat; every keypress
  // reads the latest state from the store so the listener never goes stale.
  useEffect(() => {
    async function submit(word: string) {
      const net = store.net(seat.id);
      if (!net) return;
      try {
        const { result, solved } = await net.guess(word);
        store.applyWordleResult(seat.id, result, solved);
      } catch (e) {
        store.setWordleMessage(seat.id, e instanceof Error ? e.message : "Bad guess");
      }
    }

    function onKey(e: KeyboardEvent) {
      const active = store.activeSeat();
      const cur = active?.wordle;
      // Only the seat currently in view accepts keystrokes.
      if (!active || active.id !== seat.id || !cur || cur.finished) return;
      const input = cur.currentInput;
      if (e.key === "Enter") {
        if (input.length === cur.wordLength) submit(input);
      } else if (e.key === "Backspace") {
        store.setWordleInput(seat.id, input.slice(0, -1));
      } else if (/^[a-zA-Z]$/.test(e.key) && input.length < cur.wordLength) {
        store.setWordleInput(seat.id, input + e.key.toLowerCase());
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seat.id]);

  if (!w) return null;

  const rows = [];
  for (let r = 0; r < w.maxGuesses; r++) {
    const guess = w.guesses[r];
    const isCurrent = r === w.guesses.length && !w.finished;
    const letters: { ch: string; state?: LetterState }[] = [];
    for (let c = 0; c < w.wordLength; c++) {
      if (guess) {
        letters.push({ ch: guess.guess[c], state: guess.states[c] });
      } else if (isCurrent) {
        letters.push({ ch: w.currentInput[c] ?? "" });
      } else {
        letters.push({ ch: "" });
      }
    }
    rows.push(
      <div className="wordle-row" key={r}>
        {letters.map((l, i) => (
          <Cell key={i} ch={l.ch} state={l.state} />
        ))}
      </div>,
    );
  }

  const secondsLeft = Math.max(0, Math.ceil((w.endsAt - Date.now()) / 1000));

  return (
    <div className="wordle">
      <div className="timer">⏱ {secondsLeft}s</div>
      <h2 className="pixel" style={{ fontSize: 16, margin: 0 }}>
        WORDLE RACE
      </h2>
      <p className="hint" style={{ margin: 0 }}>
        Fastest solver wins the most tiles. Type your guess and hit Enter.
      </p>

      <div className="wordle-grid">{rows}</div>

      <div className="error" style={{ minHeight: 20 }}>{w.message}</div>

      {w.finished && (
        <div className="banner" style={{ padding: 0 }}>
          {w.solved ? "Solved! 🎉 Waiting for others…" : "Out of guesses — hang tight…"}
        </div>
      )}

      <div className="standings">
        {seat.standings.map((s) => (
          <div key={s.playerId} className={`standing${s.solved ? " solved" : ""}`}>
            <span className="swatch" style={{ background: s.color }} />
            <span>{s.nickname}</span>
            <span className="dots">
              {s.solved ? "SOLVED" : `${s.guessesUsed}/${w.maxGuesses}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
