import { useEffect, useMemo, useRef, useState } from "react";
import { countryNames } from "@marvinho/shared";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import { TimerTick } from "../audio/TimerTick.js";
import type { SeatState } from "../state/types.js";
import { silhouettePath, directionIcon } from "../game/geoProject.js";

const NAMES = countryNames()
  .map((c) => c.name)
  .sort((a, b) => a.localeCompare(b));

export function GuessCountryPanel({ seat }: { seat: SeatState }) {
  const g = seat.guessCountry;
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, []);

  const path = useMemo(() => (g ? silhouettePath(g.geometry, 360, 300, 14) : ""), [g?.geometry]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!g) return null;

  const timed = seat.lobby?.settings.games.guesscountry?.timerEnabled ?? true;
  const secondsLeft = Math.max(0, Math.ceil((g.endsAt - Date.now()) / 1000));
  const lowTime = timed && secondsLeft <= 10 && secondsLeft > 0 && !g.solved;
  const triesLeft = g.maxTries - g.guesses.length;
  const done = g.solved || triesLeft <= 0;

  async function submit() {
    const net = store.net(seat.id);
    const name = input.trim();
    if (!net || !name || done) return;
    try {
      const { guess } = await net.guessCountry(name);
      store.addGuessCountryGuess(seat.id, guess);
      setInput("");
      setMsg(null);
      sfx(guess.correct ? "correct" : "submit");
    } catch (e) {
      sfx("wrong");
      setMsg(e instanceof Error ? e.message : "Bad guess");
    }
  }

  return (
    <div className="puzzle-wrap geo-wrap">
      {timed && <TimerTick seconds={secondsLeft} active={lowTime} />}
      <div className="puzzle-top">
        <div className="puzzle-name pixel">🌍 Guess the Country</div>
        {timed && <div className={`puzzle-timer pixel${lowTime ? " low" : ""}`}>⏱ {secondsLeft}s</div>}
      </div>

      <div className="puzzle-body">
        <div className="puzzle-board-col">
          <div className="geo-silhouette">
            <svg viewBox="0 0 360 300" width="360" height="300" aria-label="Country silhouette">
              <path d={path} className="geo-shape" />
            </svg>
            {g.solved && (
              <div className="puzzle-solved">Solved! 🎉<span>waiting for others…</span></div>
            )}
          </div>

          {!done && (
            <div className="geo-guess-row">
              <input
                ref={inputRef}
                list="country-list"
                value={input}
                placeholder="Name the country…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <datalist id="country-list">
                {NAMES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button className="btn pink" onClick={submit}>Guess</button>
            </div>
          )}
          {!done && <div className="geo-tries pixel">{triesLeft} guesses left</div>}
          {done && !g.solved && <div className="banner">Out of guesses — hang tight…</div>}
          <div className="error" style={{ minHeight: 18 }}>{msg}</div>

          <div className="geo-history">
            {g.guesses.map((gu, i) => (
              <div key={i} className={`geo-guess${gu.correct ? " correct" : ""}`}>
                <span className="geo-guess-name">{gu.name}</span>
                {!gu.correct && (
                  <>
                    <span className="geo-dist">{gu.distanceKm.toLocaleString()} km</span>
                    <span className="geo-dir" aria-hidden>{directionIcon(gu.bearingDeg)}</span>
                    <span className="geo-warm">
                      <span className="geo-warm-fill" style={{ width: `${Math.round(gu.proximity * 100)}%` }} />
                    </span>
                  </>
                )}
                {gu.correct && <span className="geo-correct-tag">✓ correct</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="puzzle-standings">
          <div className="p-standings-title pixel">Standings</div>
          {seat.geoStandings.map((s) => (
            <div key={s.playerId} className={`p-standing${s.solved ? " solved" : ""}`}>
              <span className="swatch" style={{ background: s.color }} />
              <span className="sk-nick">{s.nickname}</span>
              <span className="p-rank">{s.solved ? `#${(s.rank ?? 0) + 1}` : `${s.tries}·`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
