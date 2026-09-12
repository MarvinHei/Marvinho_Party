import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { WORLD_GEOMETRY, countryByCode, countryNames } from "@marvinho/shared";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import { TimerTick } from "../audio/TimerTick.js";
import type { SeatState } from "../state/types.js";
import { orthographic, orthoPath } from "../game/geoProject.js";

const NAMES = countryNames()
  .map((c) => c.name)
  .sort((a, b) => a.localeCompare(b, "de"));

const SIZE = 1000;
const C = SIZE / 2;
const R = 460;

export function TravlePanel({ seat }: { seat: SeatState }) {
  const t = seat.travle;
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  // Manual globe rotation (projection center). null = framed on the A↔B midpoint.
  const [center, setCenter] = useState<{ lng: number; lat: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ lng: number; lat: number } | null>(null);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, []);
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const outlinesOn = seat.lobby?.settings.travleOutlines ?? true;

  // A fresh round reframes the globe on the new endpoints (drops any rotation).
  useEffect(() => { setCenter(null); }, [t?.startCode, t?.endCode]);

  // Endpoints are fixed for the round.
  const ends = useMemo(() => {
    if (!t) return null;
    const a = countryByCode(t.startCode);
    const b = countryByCode(t.endCode);
    if (!a || !b) return null;
    return { a, b };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.startCode, t?.endCode]);

  // Effective globe center: the user's dragged rotation, else the A↔B midpoint.
  const cLng = center ? center.lng : ends ? (ends.a.lng + ends.b.lng) / 2 : 0;
  const cLat = center ? center.lat : ends ? (ends.a.lat + ends.b.lat) / 2 : 0;

  // Projection + all-country paths, recomputed whenever the globe is rotated.
  const base = useMemo(() => {
    if (!ends) return null;
    const o = orthographic(cLng, cLat, R, C, C);
    const paths: { code: string; d: string }[] = [];
    for (const [code, geo] of Object.entries(WORLD_GEOMETRY)) {
      const d = orthoPath(geo, o);
      if (d) paths.push({ code, d });
    }
    return { o, paths, a: ends.a, b: ends.b };
  }, [ends, cLng, cLat]);

  // Faint base outlines never change → memoize the elements so guesses/zoom
  // don't re-render 170+ detailed paths.
  const outlineEls = useMemo(
    () => (base ? base.paths.map((p) => <path key={p.code} d={p.d} className="c-land" />) : null),
    [base],
  );

  // Scroll-to-zoom (toward the cursor). Non-passive so we can preventDefault.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const m = svg.getScreenCTM();
      if (!m) return;
      const loc = pt.matrixTransform(m.inverse());
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
        const zoom = Math.max(1, Math.min(8, v.zoom * factor));
        if (zoom === 1) return { zoom: 1, x: 0, y: 0 };
        const mx = (loc.x - v.x) / v.zoom;
        const my = (loc.y - v.y) / v.zoom;
        return { zoom, x: loc.x - zoom * mx, y: loc.y - zoom * my };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [base]);

  if (!t || !base) return null;

  const timed = seat.lobby?.settings.games.travle?.timerEnabled ?? true;
  const secondsLeft = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
  const lowTime = timed && secondsLeft <= 10 && secondsLeft > 0 && !t.connected;
  const namedCodes = new Set(t.named.map((n) => n.code));
  const done = t.connected;
  const zt = `translate(${view.x} ${view.y}) scale(${view.zoom})`;

  // Drag to spin the globe: convert the pointer delta (in screen px → viewBox
  // units via the CTM) into degrees of rotation, finer as you zoom in. Updates
  // are coalesced to one re-projection per animation frame so it stays smooth.
  function rotateFromPointer(clientX: number, clientY: number, st: { x: number; y: number; lng: number; lat: number }) {
    const m = svgRef.current?.getScreenCTM();
    const scale = m && m.a ? m.a : 1;
    const dvx = (clientX - st.x) / scale;
    const dvy = (clientY - st.y) / scale;
    const degPerUnit = 180 / (2 * R);
    const dLng = (-dvx * degPerUnit) / view.zoom;
    const dLat = (dvy * degPerUnit) / view.zoom;
    const lat = Math.max(-90, Math.min(90, st.lat + dLat));
    const lng = (((st.lng + dLng + 180) % 360) + 360) % 360 - 180;
    return { lng, lat };
  }
  function onGlobePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY, lng: cLng, lat: cLat };
    setGrabbing(true);
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onGlobePointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const st = dragRef.current;
    if (!st) return;
    pendingRef.current = rotateFromPointer(e.clientX, e.clientY, st);
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current) setCenter(pendingRef.current);
      });
    }
  }
  function onGlobePointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setGrabbing(false);
    try { svgRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  // Label screen positions (kept outside the zoom group → constant size).
  const labelPos = (lat: number, lng: number): [number, number] | null => {
    const p = base.o.project(lng, lat);
    return p ? [p[0] * view.zoom + view.x, p[1] * view.zoom + view.y] : null;
  };
  const aPos = labelPos(base.a.lat, base.a.lng);
  const bPos = labelPos(base.b.lat, base.b.lng);

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
    <div className="geo-stage">
      <div className="geo-topbar">
        <div className="geo-title pixel">🧭 {base.a.name} → {base.b.name}</div>
        {timed && (
          <div className={`geo-timer pixel${lowTime ? " low" : ""}`}>⏱ {secondsLeft}s</div>
        )}
        {timed && <TimerTick seconds={secondsLeft} active={lowTime} />}
      </div>

      <div className="geo-main">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          className="travle-globe-svg"
          onPointerDown={onGlobePointerDown}
          onPointerMove={onGlobePointerMove}
          onPointerUp={onGlobePointerUp}
          onPointerCancel={onGlobePointerUp}
          style={{ cursor: grabbing ? "grabbing" : "grab", touchAction: "none" }}
        >
          <defs>
            <clipPath id="globeClip">
              <circle cx={C} cy={C} r={R} />
            </clipPath>
            <radialGradient id="oceanGrad" cx="50%" cy="38%" r="65%">
              <stop offset="0%" stopColor="#1e3a6e" />
              <stop offset="100%" stopColor="#0c1836" />
            </radialGradient>
          </defs>
          <circle cx={C} cy={C} r={R} fill="url(#oceanGrad)" stroke="#3aa0ff" strokeWidth={3} />
          <g clipPath="url(#globeClip)">
            <g transform={zt}>
              {outlinesOn && outlineEls}
              {/* Named countries (filled) */}
              {base.paths
                .filter((p) => namedCodes.has(p.code))
                .map((p) => (
                  <path key={p.code} d={p.d} className={done ? "c-linked" : "c-named"} />
                ))}
              {/* Endpoints on top */}
              {base.paths
                .filter((p) => p.code === t.startCode)
                .map((p) => (
                  <path key={p.code} d={p.d} className="c-start" />
                ))}
              {base.paths
                .filter((p) => p.code === t.endCode)
                .map((p) => (
                  <path key={p.code} d={p.d} className="c-end" />
                ))}
            </g>
          </g>
          {/* Constant-size endpoint labels */}
          {aPos && <text x={aPos[0]} y={aPos[1]} className="globe-label start">A</text>}
          {bPos && <text x={bPos[0]} y={bPos[1]} className="globe-label end">B</text>}
        </svg>

        <div className="geo-standings-float">
          {seat.travleStandings.map((s) => (
            <div key={s.playerId} className={`p-standing${s.connected ? " solved" : ""}`}>
              <span className="swatch" style={{ background: s.color }} />
              <span className="sk-nick">{s.nickname}</span>
              <span className="p-rank">{s.connected ? `#${(s.rank ?? 0) + 1}` : `${s.count}`}</span>
            </div>
          ))}
        </div>
        {view.zoom > 1 && (
          <button className="geo-zoom-reset" onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
            reset zoom
          </button>
        )}
        <div className="geo-hint">scroll to zoom</div>
      </div>

      <div className="geo-bottombar">
        {done ? (
          <div className="banner good">Connected {base.a.name} → {base.b.name} with {t.named.length}! 🎉</div>
        ) : (
          <div className="geo-guess-row">
            <input
              list="travle-country-list"
              value={input}
              placeholder="Land dazwischen benennen…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <datalist id="travle-country-list">
              {NAMES.map((nm) => (
                <option key={nm} value={nm} />
              ))}
            </datalist>
            <button className="btn pink" onClick={submit}>Hinzufügen</button>
          </div>
        )}
        <div className="error" style={{ minHeight: 16 }}>{msg}</div>
        <div className="travle-named">
          <span className="travle-legend"><i className="c-start" /> {base.a.name}</span>
          <span className="travle-legend"><i className="c-end" /> {base.b.name}</span>
          {t.named.map((n) => (
            <span key={n.code} className="travle-chip">{n.name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
