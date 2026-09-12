import { useEffect, useMemo, useState } from "react";
import { countryNames } from "@marvinho/shared";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import { TimerTick } from "../audio/TimerTick.js";
import type { SeatState } from "../state/types.js";
import { silhouettePath, directionIcon } from "../game/geoProject.js";

const NAMES = countryNames()
  .map((c) => c.name)
  .sort((a, b) => a.localeCompare(b, "de"));

const SIZE = 1000;

export function GuessCountryPanel({ seat }: { seat: SeatState }) {
  const g = seat.guessCountry;
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, []);

  const path = useMemo(
    () => (g ? silhouettePath(g.geometry, SIZE, SIZE, 60) : ""),
    [g?.geometry],
  );

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
    <div className="geo-stage">
      <div className="geo-topbar">
        <div className="geo-title pixel">🌍 Welches Land ist das?</div>
        {timed && (
          <div className={`geo-timer pixel${lowTime ? " low" : ""}`}>⏱ {secondsLeft}s</div>
        )}
        {timed && <TimerTick seconds={secondsLeft} active={lowTime} />}
      </div>

      <div className="geo-main">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="xMidYMid meet" className="geo-silhouette-svg">
          <path d={path} className="geo-shape" />
        </svg>
        {g.solved && <div className="geo-solved-badge">Gelöst! 🎉</div>}

        <div className="geo-standings-float">
          {seat.geoStandings.map((s) => (
            <div key={s.playerId} className={`p-standing${s.solved ? " solved" : ""}`}>
              <span className="swatch" style={{ background: s.color }} />
              <span className="sk-nick">{s.nickname}</span>
              <span className="p-rank">{s.solved ? `#${(s.rank ?? 0) + 1}` : `${s.tries}·`}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="geo-bottombar">
        {!done ? (
          <>
            <div className="geo-guess-row">
              <input
                list="country-list"
                value={input}
                placeholder="Land benennen…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <datalist id="country-list">
                {NAMES.map((nm) => (
                  <option key={nm} value={nm} />
                ))}
              </datalist>
              <button className="btn pink" onClick={submit}>Raten</button>
            </div>
            <div className="geo-tries pixel">{triesLeft} Versuche übrig</div>
          </>
        ) : (
          !g.solved && <div className="banner">Keine Versuche mehr — warte kurz…</div>
        )}
        <div className="error" style={{ minHeight: 16 }}>{msg}</div>

        <div className="geo-history">
          {g.guesses.map((gu, i) => (
            <div key={i} className={`geo-guess${gu.correct ? " correct" : ""}`}>
              <span className="geo-guess-name">{gu.name}</span>
              {!gu.correct && (
                <>
                  <span className="geo-dist">{gu.distanceKm.toLocaleString("de-DE")} km</span>
                  <span className="geo-dir" aria-hidden>{directionIcon(gu.bearingDeg)}</span>
                  <span className="geo-warm">
                    <span className="geo-warm-fill" style={{ width: `${Math.round(gu.proximity * 100)}%` }} />
                  </span>
                </>
              )}
              {gu.correct && <span className="geo-correct-tag">✓ richtig</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
