import { useEffect, useState } from "react";
import type { LetterState } from "@marvinho/shared";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import { TimerTick } from "../audio/TimerTick.js";
import type { SeatState } from "../state/types.js";

function Cell({ ch, state }: { ch: string; state?: LetterState }) {
  const cls = ["wordle-cell"];
  if (state) cls.push(state, "reveal");
  else if (ch) cls.push("filled");
  return <div className={cls.join(" ")}>{ch}</div>;
}

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const RANK: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

export function WordlePanel({ seat }: { seat: SeatState }) {
  const w = seat.wordle;
  const [, setTick] = useState(0);

  // Tick for the round countdown.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  async function submit(word: string) {
    const net = store.net(seat.id);
    if (!net) return;
    try {
      const { result, solved } = await net.guess(word);
      store.applyWordleResult(seat.id, result, solved);
      sfx(solved ? "correct" : "submit");
    } catch (e) {
      sfx("wrong");
      store.setWordleMessage(seat.id, e instanceof Error ? e.message : "Bad guess");
    }
  }

  // Shared input handler for both the physical keyboard and on-screen keys.
  function press(key: string) {
    const active = store.activeSeat();
    const cur = active?.wordle;
    if (!active || active.id !== seat.id || !cur || cur.finished) return;
    const input = cur.currentInput;
    if (key === "Enter") {
      if (input.length === cur.wordLength) submit(input);
    } else if (key === "Backspace") {
      if (input.length) sfx("type");
      store.setWordleInput(seat.id, input.slice(0, -1));
    } else if (/^[a-zA-Z]$/.test(key) && input.length < cur.wordLength) {
      sfx("type");
      store.setWordleInput(seat.id, input + key.toLowerCase());
    }
  }

  // Physical keyboard for the seat currently in view.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "Backspace" || /^[a-zA-Z]$/.test(e.key)) press(e.key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Best-known state per letter, to colour the on-screen keyboard.
  const letterState: Record<string, LetterState> = {};
  for (const g of w.guesses) {
    for (let i = 0; i < g.guess.length; i++) {
      const ch = g.guess[i];
      const st = g.states[i];
      if (!letterState[ch] || RANK[st] > RANK[letterState[ch]]) letterState[ch] = st;
    }
  }

  const secondsLeft = Math.max(0, Math.ceil((w.endsAt - Date.now()) / 1000));
  const lowTime = secondsLeft <= 10 && secondsLeft > 0 && !w.finished;

  return (
    <div className="wordle">
      <TimerTick seconds={secondsLeft} active={lowTime} />
      <div className={`timer${lowTime ? " low" : ""}`}>⏱ {secondsLeft}s</div>
      <h2 className="pixel" style={{ fontSize: 16, margin: 0 }}>
        WORDLE RACE
      </h2>
      <p className="hint" style={{ margin: 0 }}>
        Fastest solver wins the most tiles. Tap letters and hit Enter.
      </p>

      <div className="wordle-grid">{rows}</div>

      <div className="error" style={{ minHeight: 20 }}>{w.message}</div>

      {w.finished ? (
        <div className="banner" style={{ padding: 0 }}>
          {w.solved ? "Solved! 🎉 Waiting for others…" : "Out of guesses — hang tight…"}
        </div>
      ) : (
        <div className="wordle-keyboard">
          {KEY_ROWS.map((row, ri) => (
            <div className="wk-row" key={ri}>
              {ri === 2 && (
                <button className="wk-key wide" onClick={() => press("Enter")}>⏎</button>
              )}
              {[...row].map((ch) => (
                <button
                  key={ch}
                  className={`wk-key${letterState[ch] ? " " + letterState[ch] : ""}`}
                  onClick={() => press(ch)}
                >
                  {ch}
                </button>
              ))}
              {ri === 2 && (
                <button className="wk-key wide" onClick={() => press("Backspace")}>⌫</button>
              )}
            </div>
          ))}
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
