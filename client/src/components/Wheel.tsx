import { useEffect, useState } from "react";
import { MINIGAME_NAMES } from "@marvinho/shared";
import { sfx, audio } from "../audio/audio.js";
import { GAME_COLOR, GAME_ICON } from "./gameInfo.js";
import type { WheelState } from "../state/types.js";

const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = SIZE / 2 - 10; // sector radius
const RIM = R + 8; // decorative rim radius

/** Point on the circle; angle measured from the top, clockwise. */
function polar(angleDeg: number, radius = R) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

function sectorPath(start: number, end: number, radius = R): string {
  const a = polar(start, radius);
  const b = polar(end, radius);
  const large = end - start > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} 1 ${b.x} ${b.y} Z`;
}

export function Wheel({ wheel }: { wheel: WheelState }) {
  const { options, chosen, spinMs } = wheel;
  const n = options.length;
  const seg = 360 / n;
  const [rotation, setRotation] = useState(0);
  const [settled, setSettled] = useState(false);
  const chosenIdx = Math.max(0, options.indexOf(chosen));

  useEffect(() => {
    const center = (chosenIdx + 0.5) * seg;
    const jitter = (Math.random() - 0.5) * seg * 0.5;
    const target = 360 * 6 - center - jitter;
    const kick = setTimeout(() => {
      setRotation(target);
      audio.drumroll(spinMs);
    }, 60);
    const done = setTimeout(() => {
      setSettled(true);
      sfx("win");
    }, spinMs + 120);
    return () => {
      clearTimeout(kick);
      clearTimeout(done);
    };
  }, [options, chosen, seg, spinMs, chosenIdx]);

  // Decorative rim bulbs.
  const bulbs = Array.from({ length: 16 }, (_, i) => polar((i / 16) * 360, RIM));

  return (
    <div className="overlay backdrop wheel-overlay">
      <div className="wheel-card">
        <h2 className="pixel wheel-title">{settled ? "Get ready!" : "Spinning the wheel…"}</h2>

        <div className="wheel-wrap" style={{ width: SIZE, height: SIZE }}>
          <div className="wheel-pointer" aria-hidden />
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="wheel-svg">
            <defs>
              <radialGradient id="wheelDome" cx="50%" cy="42%" r="62%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
                <stop offset="55%" stopColor="#fff" stopOpacity="0" />
                <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
              </radialGradient>
              <radialGradient id="wheelHub" cx="42%" cy="38%" r="70%">
                <stop offset="0%" stopColor="#fff5c2" />
                <stop offset="45%" stopColor="#ffd23f" />
                <stop offset="100%" stopColor="#b8860b" />
              </radialGradient>
              <radialGradient id="wheelRim" cx="50%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#6f66c0" />
                <stop offset="100%" stopColor="#2a2560" />
              </radialGradient>
              <filter id="wheelGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Static rim + bulbs */}
            <circle cx={CX} cy={CY} r={RIM + 4} fill="url(#wheelRim)" stroke="#0d0b22" strokeWidth={3} />
            {bulbs.map((b, i) => (
              <circle
                key={i}
                cx={b.x}
                cy={b.y}
                r={4}
                className={`wheel-bulb${settled ? " lit" : ""}`}
                style={{ animationDelay: `${(i % 8) * 0.1}s` }}
              />
            ))}

            {/* Rotating disc */}
            <g
              className="wheel-disc"
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: `${CX}px ${CY}px`,
                transition: `transform ${spinMs}ms cubic-bezier(0.15, 0.85, 0.15, 1)`,
              }}
            >
              {n === 1 ? (
                <circle cx={CX} cy={CY} r={R} fill={GAME_COLOR[options[0]]} stroke="#0d0b22" strokeWidth={3} />
              ) : (
                options.map((opt, i) => (
                  <path
                    key={opt}
                    d={sectorPath(i * seg, (i + 1) * seg)}
                    fill={GAME_COLOR[opt]}
                    stroke="#0d0b22"
                    strokeWidth={2.5}
                    className={settled && i === chosenIdx ? "wheel-sector chosen" : "wheel-sector"}
                  />
                ))
              )}
              {/* Glassy dome shading */}
              <circle cx={CX} cy={CY} r={R} fill="url(#wheelDome)" pointerEvents="none" />
              {/* Icons */}
              {options.map((opt, i) => {
                const mid = (i + 0.5) * seg;
                const p = polar(mid, R * 0.64);
                return (
                  <text
                    key={`${opt}-label`}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${mid} ${p.x} ${p.y})`}
                    fontSize="22"
                  >
                    {GAME_ICON[opt]}
                  </text>
                );
              })}
            </g>

            {/* Center hub */}
            <circle cx={CX} cy={CY} r={20} fill="url(#wheelHub)" stroke="#0d0b22" strokeWidth={3} />
            <circle cx={CX - 5} cy={CY - 6} r={5} fill="#fff" opacity={0.6} />
          </svg>
        </div>

        <div className={`wheel-result${settled ? " show" : ""}`}>
          {GAME_ICON[chosen]} {MINIGAME_NAMES[chosen]}
        </div>
      </div>
    </div>
  );
}
