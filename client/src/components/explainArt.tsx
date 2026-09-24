import type { ReactNode } from "react";
import type { ArtKind, KeysKind } from "./explainPages.js";

// ---------------------------------------------------------------------------
// Control diagrams (keycaps + mouse) — the "how do I play this" imagery.
// ---------------------------------------------------------------------------

function KeyCap({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <span className={`kc${wide ? " wide" : ""}`}>{children}</span>;
}

function MouseIcon({ btn }: { btn?: "left" | "right" }) {
  return (
    <svg className="ctrl-mouse" viewBox="0 0 40 56" width="34" height="46" aria-hidden>
      <rect x="4" y="2" width="32" height="52" rx="16" fill="#1d1a36" stroke="#6a5fae" strokeWidth="2" />
      <line x1="20" y1="4" x2="20" y2="26" stroke="#6a5fae" strokeWidth="1.5" />
      <line x1="20" y1="15" x2="36" y2="15" stroke="#6a5fae" strokeWidth="1.5" />
      {btn === "left" && <path d="M6 4 h13 v22 h-13 a14 14 0 0 1 0 -22 z" fill="#ffd23f" opacity="0.85" />}
      {btn === "right" && <path d="M34 4 h-13 v22 h13 a14 14 0 0 0 0 -22 z" fill="#ffd23f" opacity="0.85" />}
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
    case "rightclick":
      return <MouseIcon btn="right" />;
    case "type":
      return (
        <div className="keys-row">
          <KeyCap>A</KeyCap><KeyCap>B</KeyCap><KeyCap>C</KeyCap>
          <span className="keys-alt">type…</span>
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
// Scene illustrations (one per page's `art`).
// ---------------------------------------------------------------------------

/** A framed SVG scene that explains the game visually. */
export function GameArt({ art, color, icon }: { art: ArtKind; color: string; icon: string }) {
  return (
    <div className="explain-art" style={{ ["--accent-game" as string]: color }}>
      <svg viewBox="0 0 220 120" className="explain-art-svg" role="img">
        <defs>
          <linearGradient id="egsky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#241a45" />
            <stop offset="1" stopColor="#171433" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="220" height="120" rx="10" fill="url(#egsky)" />
        <Scene art={art} color={color} icon={icon} />
      </svg>
    </div>
  );
}

function Scene({ art, color, icon }: { art: ArtKind; color: string; icon: string }) {
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
    case "grid":
      return (
        <g>
          {Array.from({ length: 16 }).map((_, i) => {
            const cx = 74 + (i % 4) * 20;
            const cy = 26 + Math.floor(i / 4) * 20;
            const filled = [0, 5, 10, 15].includes(i);
            return <rect key={i} x={cx} y={cy} width="18" height="18" rx="3" fill={filled ? color : "#2b2450"} stroke="#4a4180" />;
          })}
        </g>
      );
    case "map":
      return (
        <g>
          <path d="M40 70 q10 -34 40 -30 q30 4 46 20 q20 14 8 30 q-14 18 -50 12 q-40 -6 -44 -32 z" fill={color} opacity="0.85" />
          <circle cx="120" cy="56" r="5" fill="#fff" />
          <path d="M120 56 l0 -16" stroke="#fff" strokeWidth="2" />
          <text x="110" y="104" textAnchor="middle" fontSize="11" fill="#b9b3d6">arrows point toward the answer</text>
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
          <path d="M96 40 l18 0 M108 34 l8 6 l-8 6" stroke="#ffd23f" strokeWidth="3" fill="none" strokeLinecap="round" />
          <text x="110" y="24" textAnchor="middle" fontSize="11" fill="#b9b3d6">the track scrolls faster and faster →</text>
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
          <path d="M110 78 l0 -8 M104 98 l-14 0 M116 98 l14 0" stroke="#28e0d0" strokeWidth="2" />
          <text x="110" y="118" textAnchor="middle" fontSize="9" fill="#b9b3d6">stay in the gap</text>
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
