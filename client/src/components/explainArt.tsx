import type { ReactNode } from "react";
import type { ArtSpec, GridSpec, KeysKind, SceneKind } from "./explainPages.js";

// ---------------------------------------------------------------------------
// Control diagrams (keycaps + mouse) — the "how do I play this" imagery.
// ---------------------------------------------------------------------------

function KeyCap({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <span className={`kc${wide ? " wide" : ""}`}>{children}</span>;
}

function MouseIcon({ btn, drag }: { btn?: "left" | "right"; drag?: boolean }) {
  return (
    <svg className="ctrl-mouse" viewBox="0 0 56 56" width="48" height="46" aria-hidden>
      <rect x="12" y="2" width="32" height="52" rx="16" fill="#1d1a36" stroke="#6a5fae" strokeWidth="2" />
      <line x1="28" y1="4" x2="28" y2="26" stroke="#6a5fae" strokeWidth="1.5" />
      <line x1="28" y1="15" x2="44" y2="15" stroke="#6a5fae" strokeWidth="1.5" />
      {btn === "left" && <path d="M14 4 h13 v22 h-13 a14 14 0 0 1 0 -22 z" fill="#ffd23f" opacity="0.85" />}
      {btn === "right" && <path d="M42 4 h-13 v22 h13 a14 14 0 0 0 0 -22 z" fill="#ffd23f" opacity="0.85" />}
      {drag && (
        <g stroke="#28e0d0" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M2 46 H52" />
          <path d="M45 40 L52 46 L45 52" />
        </g>
      )}
    </svg>
  );
}

function SwipeIcon() {
  return (
    <svg className="ctrl-swipe" viewBox="0 0 60 40" width="56" height="38" aria-hidden>
      <path d="M8 20 H48" stroke="#28e0d0" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 12 L50 20 L40 28" fill="none" stroke="#28e0d0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="20" r="6" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

/** A small control illustration for the given input kind. */
export function Keys({ kind }: { kind: KeysKind }) {
  switch (kind) {
    case "wasd":
      return (
        <div className="keys-cross">
          <div className="kc-row"><KeyCap>W</KeyCap></div>
          <div className="kc-row"><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></div>
          <div className="keys-alt">or ↑ ← ↓ →</div>
        </div>
      );
    case "arrows":
      return (
        <div className="keys-cross">
          <div className="kc-row"><KeyCap>↑</KeyCap></div>
          <div className="kc-row"><KeyCap>←</KeyCap><KeyCap>↓</KeyCap><KeyCap>→</KeyCap></div>
        </div>
      );
    case "runnerkeys":
      return (
        <div className="keys-cross">
          <div className="kc-row"><KeyCap>↑</KeyCap></div>
          <div className="kc-row"><KeyCap>←</KeyCap><KeyCap>↓</KeyCap><KeyCap>→</KeyCap></div>
          <div className="keys-alt">← brake · → run · ↑ jump · ↓ duck</div>
        </div>
      );
    case "lr":
      return (
        <div className="keys-row">
          <KeyCap>A</KeyCap>
          <KeyCap>D</KeyCap>
          <span className="keys-alt">or ← →</span>
        </div>
      );
    case "space":
      return <KeyCap wide>Space</KeyCap>;
    case "enter":
      return <KeyCap wide>Enter ⏎</KeyCap>;
    case "mouse":
      return <MouseIcon />;
    case "click":
      return <MouseIcon btn="left" />;
    case "dblclick":
      return <MouseIcon btn="left" />;
    case "rightclick":
      return <MouseIcon btn="right" />;
    case "drag":
      return <MouseIcon btn="left" drag />;
    case "type":
      return (
        <div className="keys-row">
          <KeyCap>A</KeyCap><KeyCap>B</KeyCap><KeyCap>C</KeyCap>
          <span className="keys-alt">type…</span>
        </div>
      );
    case "digits":
      return (
        <div className="keys-row">
          <KeyCap>1</KeyCap><KeyCap>2</KeyCap><KeyCap>3</KeyCap>
          <span className="keys-alt">…6</span>
        </div>
      );
    case "swipe":
      return <SwipeIcon />;
    case "ekey":
      return <KeyCap>E</KeyCap>;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Top-level art dispatch.
// ---------------------------------------------------------------------------

export function GameArt({ art, color, icon }: { art: ArtSpec; color: string; icon: string }) {
  const isGrid = "grid" in art;
  return (
    <div className="explain-art" style={{ ["--accent-game" as string]: color }}>
      <svg viewBox={isGrid ? "0 0 220 142" : "0 0 220 120"} className="explain-art-svg" role="img">
        <defs>
          <linearGradient id="egsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#241a45" />
            <stop offset="1" stopColor="#171433" />
          </linearGradient>
        </defs>
        {isGrid ? (
          <>
            <rect x="0" y="0" width="220" height="142" rx="10" fill="#12102a" />
            <MiniGrid spec={art.grid} />
          </>
        ) : (
          <>
            <rect x="0" y="0" width="220" height="120" rx="10" fill="url(#egsky)" />
            <Scene art={art.scene} color={color} icon={icon} />
          </>
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parametrized puzzle grid — the workhorse for step-by-step rule imagery.
// ---------------------------------------------------------------------------

const REGION = [
  "#e6394b", "#3aa0ff", "#42d17a", "#ffd23f",
  "#b06bff", "#ff8c42", "#28e0d0", "#ff6fcf",
  "#9a8f63", "#7ad1ff",
];
const TINT: Record<string, string> = {
  block: "rgba(230,57,75,0.34)",
  bad: "rgba(230,57,75,0.62)",
  good: "rgba(66,209,122,0.42)",
  focus: "rgba(255,210,63,0.20)",
  dim: "rgba(8,6,20,0.55)",
};

function MiniGrid({ spec }: { spec: GridSpec }) {
  const { cols, rows, cells } = spec;
  const availW = 196;
  const availH = spec.caption ? 100 : 118;
  const cell = Math.min(availW / cols, availH / rows);
  const bw = cell * cols;
  const bh = cell * rows;
  const ox = (220 - bw) / 2;
  const oy = 8;
  const cellX = (i: number) => ox + (i % cols) * cell;
  const cellY = (i: number) => oy + Math.floor(i / cols) * cell;
  const cx = (i: number) => cellX(i) + cell / 2;
  const cy = (i: number) => cellY(i) + cell / 2;
  const regionOf = (i: number) => cells[i]?.region;

  return (
    <g>
      {/* cell fills + tints */}
      {cells.map((c, i) => {
        const x = cellX(i);
        const y = cellY(i);
        const fill = c.fill ?? (c.region !== undefined ? REGION[c.region % REGION.length] : "#2b2450");
        return (
          <g key={`c${i}`}>
            <rect x={x} y={y} width={cell} height={cell} fill={fill} stroke="rgba(13,11,34,0.4)" strokeWidth="1" />
            {c.tint && <rect x={x} y={y} width={cell} height={cell} fill={TINT[c.tint]} />}
            {c.tint === "focus" && (
              <rect x={x + 1.5} y={y + 1.5} width={cell - 3} height={cell - 3} fill="none" stroke="#ffd23f" strokeWidth="2" />
            )}
          </g>
        );
      })}

      {/* thick region borders */}
      {spec.regionBorders &&
        cells.map((_, i) => {
          const r = Math.floor(i / cols);
          const col = i % cols;
          const reg = regionOf(i);
          const segs: ReactNode[] = [];
          const thick = (x1: number, y1: number, x2: number, y2: number, key: string) => (
            <line key={`b${i}${key}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0d0b22" strokeWidth="2.5" strokeLinecap="square" />
          );
          const x = cellX(i);
          const y = cellY(i);
          if (col === cols - 1 || regionOf(i + 1) !== reg) segs.push(thick(x + cell, y, x + cell, y + cell, "r"));
          if (r === rows - 1 || regionOf(i + cols) !== reg) segs.push(thick(x, y + cell, x + cell, y + cell, "d"));
          if (col === 0) segs.push(thick(x, y, x, y + cell, "l"));
          if (r === 0) segs.push(thick(x, y, x + cell, y, "t"));
          return segs;
        })}

      {/* path line (Zip) */}
      {spec.path && spec.path.length > 1 && (
        <polyline
          points={spec.path.map((i) => `${cx(i)},${cy(i)}`).join(" ")}
          fill="none"
          stroke="#ffd23f"
          strokeWidth={cell * 0.22}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.95"
        />
      )}

      {/* marks + labels */}
      {cells.map((c, i) => {
        if (!c.mark && !c.label) return null;
        const mx = cx(i);
        const my = cy(i);
        if (c.label) {
          return (
            <text key={`m${i}`} x={mx} y={my + cell * 0.18} textAnchor="middle" fontSize={cell * 0.5} fill="#eae7ff" fontFamily="monospace" fontWeight="bold">
              {c.label}
            </text>
          );
        }
        switch (c.mark) {
          case "queen":
            return <text key={`m${i}`} x={mx} y={my + cell * 0.24} textAnchor="middle" fontSize={cell * 0.66} fill="#141130">♛</text>;
          case "x":
            return <text key={`m${i}`} x={mx} y={my + cell * 0.2} textAnchor="middle" fontSize={cell * 0.52} fill="#2a2440" fontWeight="bold">✕</text>;
          case "planet":
            return <text key={`m${i}`} x={mx} y={my + cell * 0.22} textAnchor="middle" fontSize={cell * 0.62}>🪐</text>;
          case "star":
            return <text key={`m${i}`} x={mx} y={my + cell * 0.22} textAnchor="middle" fontSize={cell * 0.62}>⭐</text>;
          case "head":
            return <circle key={`m${i}`} cx={mx} cy={my} r={cell * 0.22} fill="#ffd23f" stroke="#0d0b22" strokeWidth="1.5" />;
          case "dot":
            return <circle key={`m${i}`} cx={mx} cy={my} r={cell * 0.16} fill="#28e0d0" />;
          default:
            return null;
        }
      })}

      {/* Tango = / × constraint badges */}
      {spec.cons?.map((con, k) => {
        const horizontal = con.b === con.a + 1;
        const bx = horizontal ? ox + ((con.a % cols) + 1) * cell : cx(con.a);
        const by = horizontal ? cy(con.a) : oy + (Math.floor(con.a / cols) + 1) * cell;
        return (
          <g key={`con${k}`}>
            <circle cx={bx} cy={by} r={cell * 0.2} fill="#12102a" stroke="#ffd23f" strokeWidth="1.5" />
            <text x={bx} y={by + cell * 0.13} textAnchor="middle" fontSize={cell * 0.34} fill="#ffd23f" fontWeight="bold">
              {con.kind === "eq" ? "=" : "×"}
            </text>
          </g>
        );
      })}

      {spec.caption && (
        <text x="110" y={oy + bh + 20} textAnchor="middle" fontSize="10.5" fill="#b9b3d6" fontFamily="var(--font-read)">
          {spec.caption}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Fixed scene illustrations.
// ---------------------------------------------------------------------------

function Scene({ art, color, icon }: { art: SceneKind; color: string; icon: string }) {
  switch (art) {
    case "wordleTiles":
      return (
        <g>
          {["#3a3170", "#42d17a", "#ffd23f", "#3a3170", "#3a3170"].map((c, i) => (
            <g key={i}>
              <rect x={20 + i * 37} y={40} width="32" height="32" rx="5" fill={c} />
              <text x={36 + i * 37} y={62} textAnchor="middle" fontSize="20" fill="#fff" fontFamily="monospace">
                {"WORLD"[i]}
              </text>
            </g>
          ))}
          <text x="110" y="98" textAnchor="middle" fontSize="11" fill="#b9b3d6">green = right spot · yellow = wrong spot</text>
        </g>
      );
    case "wordle2":
      return (
        <g>
          {[
            { y: 22, word: "CRANE", cols: ["#3a3170", "#3a3170", "#ffd23f", "#3a3170", "#42d17a"] },
            { y: 60, word: "AUDIO", cols: ["#ffd23f", "#3a3170", "#3a3170", "#3a3170", "#3a3170"] },
          ].map((row, r) =>
            row.cols.map((c, i) => (
              <g key={`${r}-${i}`}>
                <rect x={30 + i * 33} y={row.y} width="28" height="28" rx="4" fill={c} />
                <text x={44 + i * 33} y={row.y + 20} textAnchor="middle" fontSize="16" fill="#fff" fontFamily="monospace">{row.word[i]}</text>
              </g>
            )),
          )}
          <text x="110" y="110" textAnchor="middle" fontSize="10.5" fill="#b9b3d6">🟩 right spot · 🟨 wrong spot · ⬛ not in word</text>
        </g>
      );
    case "map":
      return (
        <g>
          <path d="M40 70 q10 -34 40 -30 q30 4 46 20 q20 14 8 30 q-14 18 -50 12 q-40 -6 -44 -32 z" fill={color} opacity="0.85" />
          <circle cx="150" cy="40" r="5" fill="#fff" />
          <path d="M150 40 L120 56" stroke="#ffd23f" strokeWidth="2.5" />
          <path d="M126 50 L120 56 L128 58" fill="none" stroke="#ffd23f" strokeWidth="2.5" />
          <text x="110" y="104" textAnchor="middle" fontSize="11" fill="#b9b3d6">arrows + distance point to the answer</text>
        </g>
      );
    case "draw":
      return (
        <g>
          <path d="M40 78 q20 -40 44 -20 q10 8 24 -6 q18 -18 40 0" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          <path d="M150 24 l14 -8 l6 10 l-14 8 z" fill="#ffd23f" />
          <text x="110" y="104" textAnchor="middle" fontSize="11" fill="#b9b3d6">one draws, everyone else guesses</text>
        </g>
      );
    case "teams":
      return (
        <g>
          <rect x="24" y="30" width="76" height="60" rx="8" fill="#e6394b" opacity="0.18" stroke="#e6394b" />
          <rect x="120" y="30" width="76" height="60" rx="8" fill="#3aa0ff" opacity="0.18" stroke="#3aa0ff" />
          {[0, 1, 2].map((i) => <circle key={i} cx={40 + i * 22} cy={60} r="8" fill="#e6394b" />)}
          {[0, 1, 2].map((i) => <circle key={i} cx={136 + i * 22} cy={60} r="8" fill="#3aa0ff" />)}
          <text x="110" y="108" textAnchor="middle" fontSize="10.5" fill="#b9b3d6">two teams, racing side by side</text>
        </g>
      );
    case "codenamesGrid":
      return (
        <g>
          {Array.from({ length: 9 }).map((_, i) => {
            const cxx = 46 + (i % 3) * 46;
            const cyy = 20 + Math.floor(i / 3) * 30;
            const kind = [0, 4, 7].includes(i) ? "#e6394b" : [2, 5].includes(i) ? "#3aa0ff" : i === 8 ? "#111" : "#3a3170";
            return <rect key={i} x={cxx} y={cyy} width="40" height="24" rx="3" fill={kind} opacity={kind === "#3a3170" ? 0.7 : 0.9} />;
          })}
          <text x="110" y="112" textAnchor="middle" fontSize="10" fill="#b9b3d6">🔴 red agents · 🔵 blue · ⬛ assassin!</text>
        </g>
      );
    case "pong":
      return (
        <g>
          <line x1="110" y1="12" x2="110" y2="108" stroke="#3a3170" strokeWidth="2" strokeDasharray="6 8" />
          <rect x="18" y="42" width="8" height="36" rx="3" fill={color} />
          <rect x="194" y="52" width="8" height="26" rx="3" fill="#ff8c42" />
          <circle cx="140" cy="44" r="10" fill="none" stroke="#ffd23f" strokeWidth="2.5" />
          <text x="140" y="48" textAnchor="middle" fontSize="11">⚡</text>
          <circle cx="96" cy="60" r="6" fill="#fff" />
          <path d="M104 56 l30 -12" stroke="#fff" strokeWidth="2" opacity="0.5" />
          <text x="110" y="104" textAnchor="middle" fontSize="10" fill="#b9b3d6">shoot the ball through a pickup to grab it</text>
        </g>
      );
    case "runner":
      return (
        <g>
          <rect x="0" y="92" width="220" height="28" fill="#5a4a2c" />
          <rect x="150" y="66" width="18" height="26" rx="3" fill="#6b6480" />
          <rect x="60" y="60" width="16" height="32" rx="4" fill={color} stroke="#fff" strokeWidth="2" />
          <circle cx="68" cy="50" r="12" fill="none" stroke="#ffd23f" strokeWidth="2" />
          <text x="110" y="24" textAnchor="middle" fontSize="11" fill="#b9b3d6">the track scrolls faster and faster →</text>
        </g>
      );
    case "runnerObs":
      return (
        <g>
          <rect x="0" y="96" width="220" height="24" fill="#5a4a2c" />
          {/* jump over a low obstacle */}
          <rect x="60" y="80" width="16" height="16" rx="3" fill="#6b6480" />
          <path d="M40 96 q28 -46 52 0" fill="none" stroke="#ffd23f" strokeWidth="2" strokeDasharray="4 4" />
          <rect x="60" y="56" width="14" height="22" rx="4" fill={color} stroke="#fff" strokeWidth="1.5" />
          <text x="66" y="46" textAnchor="middle" fontSize="9" fill="#ffd23f">↑ jump</text>
          {/* duck under a hanging obstacle */}
          <rect x="150" y="20" width="40" height="36" fill="#7a4a8f" />
          <rect x="146" y="80" width="20" height="14" rx="4" fill={color} stroke="#fff" strokeWidth="1.5" />
          <text x="170" y="76" textAnchor="middle" fontSize="9" fill="#ffd23f">↓ duck</text>
        </g>
      );
    case "hide":
      return (
        <g>
          <path d="M60 60 L150 26 L150 94 Z" fill="#ffd23f" opacity="0.16" />
          <circle cx="56" cy="60" r="10" fill="#e6394b" />
          <circle cx="128" cy="48" r="8" fill="#42d17a" />
          <circle cx="170" cy="80" r="8" fill="#42d17a" opacity="0.35" />
          <text x="110" y="110" textAnchor="middle" fontSize="10" fill="#b9b3d6">seeker's flashlight reveals hiders</text>
        </g>
      );
    case "hideBlink":
      return (
        <g>
          <circle cx="52" cy="66" r="10" fill="#42d17a" opacity="0.4" />
          <path d="M62 62 Q110 20 158 50" fill="none" stroke="#28e0d0" strokeWidth="2.5" strokeDasharray="5 5" />
          <path d="M150 44 L160 50 L150 56" fill="none" stroke="#28e0d0" strokeWidth="2.5" />
          <circle cx="162" cy="52" r="10" fill="#42d17a" />
          <text x="110" y="104" textAnchor="middle" fontSize="10" fill="#b9b3d6">blink to a clicked spot every 30s</text>
        </g>
      );
    case "battle":
      return (
        <g>
          <circle cx="46" cy="60" r="11" fill={color} />
          <circle cx="182" cy="46" r="11" fill="#e6394b" />
          <circle cx="150" cy="86" r="6" fill="#28e0d0" />
          <line x1="58" y1="58" x2="170" y2="48" stroke="#ffd23f" strokeWidth="2" strokeDasharray="3 5" />
          <circle cx="120" cy="53" r="3.5" fill="#fff" />
          <text x="110" y="108" textAnchor="middle" fontSize="10" fill="#b9b3d6">last one standing wins · grab power-ups</text>
        </g>
      );
    case "tetris":
      return (
        <g>
          <rect x="82" y="10" width="56" height="100" rx="4" fill="#0d0b22" stroke="#3a3170" />
          <rect x="86" y="86" width="16" height="16" fill="#e6394b" />
          <rect x="102" y="86" width="16" height="16" fill="#3aa0ff" />
          <rect x="118" y="86" width="16" height="16" fill="#42d17a" />
          <rect x="102" y="70" width="16" height="16" fill="#ffd23f" />
          <rect x="118" y="70" width="16" height="16" fill="#ffd23f" />
          <rect x="102" y="30" width="16" height="16" fill={color} />
        </g>
      );
    case "tetrisClear":
      return (
        <g>
          <rect x="70" y="10" width="80" height="100" rx="4" fill="#0d0b22" stroke="#3a3170" />
          {/* a full row about to clear (highlighted) */}
          {Array.from({ length: 5 }).map((_, i) => (
            <rect key={i} x={74 + i * 15} y={88} width="14" height="14" fill="#ffd23f" />
          ))}
          <rect x="70" y="86" width="80" height="18" fill="rgba(255,255,255,0.25)" />
          <rect x="74" y="72" width="14" height="14" fill="#e6394b" />
          <rect x="119" y="72" width="14" height="14" fill="#3aa0ff" />
          {/* garbage sent to a rival */}
          <path d="M156 96 L186 96" stroke="#e6394b" strokeWidth="3" />
          <path d="M180 90 L188 96 L180 102" fill="none" stroke="#e6394b" strokeWidth="3" />
          <text x="110" y="122" textAnchor="middle" fontSize="10" fill="#b9b3d6" opacity="0">.</text>
        </g>
      );
    case "car":
      return (
        <g>
          <rect x="0" y="88" width="220" height="32" fill="#2b2450" />
          <g>
            <rect x="40" y="62" width="46" height="18" rx="5" fill="#d0342c" />
            <rect x="52" y="52" width="20" height="11" rx="3" fill="#7fb2ff" />
            <circle cx="52" cy="82" r="5" fill="#15121f" />
            <circle cx="76" cy="82" r="5" fill="#15121f" />
          </g>
          <path d="M100 66 l14 0 M108 60 l8 6 l-8 6" stroke="#ffd23f" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="176" cy="66" r="12" fill={color} stroke="#fff" strokeWidth="2" />
          <text x="110" y="30" textAnchor="middle" fontSize="11" fill="#b9b3d6">sign at the LAST second</text>
        </g>
      );
    case "dodge":
      return (
        <g>
          <rect x="20" y="14" width="70" height="16" rx="3" fill="#e6394b" />
          <rect x="130" y="14" width="70" height="16" rx="3" fill="#e6394b" />
          <rect x="30" y="44" width="55" height="16" rx="3" fill="#e6394b" />
          <rect x="150" y="44" width="50" height="16" rx="3" fill="#e6394b" />
          <circle cx="110" cy="98" r="11" fill={color} stroke="#fff" strokeWidth="2" />
          <path d="M96 98 l-14 0 M116 98 l14 0" stroke="#28e0d0" strokeWidth="2" />
          <text x="110" y="118" textAnchor="middle" fontSize="9" fill="#b9b3d6">slide to stay in the gap</text>
        </g>
      );
    case "podium":
      return (
        <g>
          <rect x="86" y="40" width="48" height="70" fill="#ffd23f" opacity="0.85" />
          <rect x="38" y="60" width="48" height="50" fill="#c0c6d6" opacity="0.8" />
          <rect x="134" y="74" width="48" height="36" fill="#cd7f32" opacity="0.85" />
          <text x="110" y="66" textAnchor="middle" fontSize="18" fill="#1a1436" fontFamily="monospace">1</text>
          <text x="62" y="84" textAnchor="middle" fontSize="15" fill="#1a1436" fontFamily="monospace">2</text>
          <text x="158" y="96" textAnchor="middle" fontSize="13" fill="#1a1436" fontFamily="monospace">3</text>
          <text x="110" y="28" textAnchor="middle" fontSize="11" fill="#b9b3d6">top three move 3 · 2 · 1 tiles</text>
        </g>
      );
    case "hero":
    default:
      return (
        <g>
          <text x="110" y="74" textAnchor="middle" fontSize="52">{icon}</text>
        </g>
      );
  }
}
