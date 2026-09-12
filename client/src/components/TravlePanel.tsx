import { useEffect, useMemo, useState } from "react";
import { WORLD_GEOMETRY, countryByCode, countryNames } from "@marvinho/shared";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import { TimerTick } from "../audio/TimerTick.js";
import type { SeatState } from "../state/types.js";
import { orthographic, orthoPath, projectCentroid } from "../game/geoProject.js";

const NAMES = countryNames()
  .map((c) => c.name)
  .sort((a, b) => a.localeCompare(b));

const SIZE = 420;
const R = 198;

export function TravlePanel({ seat }: { seat: SeatState }) {
  const t = seat.travle;
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, []);

  // The globe is centered between the two endpoints and fixed for the round.
  const base = useMemo(() => {
    if (!t) return null;
    const a = countryByCode(t.startCode);
    const b = countryByCode(t.endCode);
    if (!a || !b) return null;
    const o = orthographic((a.lng + b.lng) / 2, (a.lat + b.lat) / 2, R, SIZE / 2, SIZE / 2);
    const paths: { code: string; d: string }[] = [];
    for (const [code, geo] of Object.entries(WORLD_GEOMETRY)) {
      const d = orthoPath(geo, o);
      if (d) paths.push({ code, d });
    }
    return { o, paths, a, b };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.startCode, t?.endCode]);

  if (!t || !base) return null;

  const timed = seat.lobby?.settings.games.travle?.timerEnabled ?? true;
  const secondsLeft = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  const lowTime = timed && secondsLeft <= 10 && secondsLeft > 0 && !t.connected;
  const namedCodes = new Set(t.named.map((n) => n.code));
  const done = t.connected;

  const startLabel = projectCentroid(base.o, base.a.lat, base.a.lng);
  const endLabel = projectCentroid(base.o, base.b.lat, base.b.lng);

  async function submit() {
    const net = store.net(seat.id);
    const name = input.trim();
    if (!net || !name || done) return;
    try {
      const res = await net.travleGuess(name);
      store.addTravleNamed(seat.id, { code: res.code, name: res.name, connected: res.connected });
      setInput("");
      setMsg(null);
      sfx(res.connected ? "correct" : "place");
    } catch (e) {
      sfx("wrong");
      setMsg(e instanceof Error ? e.message : "Bad guess");
    }
  }

  return (
    <div className="puzzle-wrap geo-wrap">
      {timed && <TimerTick seconds={secondsLeft} active={lowTime} />}
      <div className="puzzle-top">
        <div className="puzzle-name pixel">🧭 Travle · {base.a.name} → {base.b.name}</div>
        {timed && <div className={`puzzle-timer pixel${lowTime ? " low" : ""}`}>⏱ {secondsLeft}s</div>}
      </div>

      <div className="puzzle-body">
        <div className="puzzle-board-col">
          <div className="travle-globe">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="globe-ocean" />
              <g className="globe-land">
                {base.paths.map((p) => {
                  const isStart = p.code === t.startCode;
                  const isEnd = p.code === t.endCode;
                  const isNamed = namedCodes.has(p.code);
                  const cls = isStart
                    ? "c-start"
                    : isEnd
                      ? "c-end"
                      : isNamed
                        ? done
                          ? "c-linked"
                          : "c-named"
                        : "c-land";
                  return <path key={p.code} d={p.d} className={cls} />;
                })}
              </g>
              {startLabel && (
                <text x={startLabel[0]} y={startLabel[1]} className="globe-label start">A</text>
              )}
              {endLabel && (
                <text x={endLabel[0]} y={endLabel[1]} className="globe-label end">B</text>
              )}
            </svg>
          </div>

          {done ? (
            <div className="banner good">Connected {base.a.name} → {base.b.name} with {t.named.length}! 🎉</div>
          ) : (
            <div className="geo-guess-row">
              <input
                list="travle-country-list"
                value={input}
                placeholder="Name a country in between…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <datalist id="travle-country-list">
                {NAMES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <button className="btn pink" onClick={submit}>Add</button>
            </div>
          )}
          <div className="error" style={{ minHeight: 18 }}>{msg}</div>

          <div className="travle-named">
            <span className="travle-legend"><i className="c-start" /> {base.a.name}</span>
            <span className="travle-legend"><i className="c-end" /> {base.b.name}</span>
            {t.named.map((n) => (
              <span key={n.code} className="travle-chip">{n.name}</span>
            ))}
          </div>
        </div>

        <div className="puzzle-standings">
          <div className="p-standings-title pixel">Standings</div>
          {seat.travleStandings.map((s) => (
            <div key={s.playerId} className={`p-standing${s.connected ? " solved" : ""}`}>
              <span className="swatch" style={{ background: s.color }} />
              <span className="sk-nick">{s.nickname}</span>
              <span className="p-rank">{s.connected ? `#${(s.rank ?? 0) + 1}` : `${s.count}`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
