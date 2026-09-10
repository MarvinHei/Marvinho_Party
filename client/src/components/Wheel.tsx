import { useEffect, useState } from "react";
import { MINIGAME_NAMES, type MinigameType } from "@marvinho/shared";
import { sfx } from "../audio/audio.js";
import type { WheelState } from "../state/types.js";

const GAME_COLOR: Record<MinigameType, string> = {
  wordle: "#42d17a",
  codenames: "#3aa0ff",
  skribbl: "#ff6fcf",
  skribblteams: "#b06bff",
  findword: "#28e0d0",
  tetris: "#e6394b",
  zip: "#ff8c42",
  queens: "#b06bff",
  sudoku: "#28e0d0",
  tango: "#ffd23f",
};
const GAME_ICON: Record<MinigameType, string> = {
  wordle: "🔤",
  codenames: "🕵️",
  skribbl: "🎨",
  skribblteams: "🖌️",
  findword: "🧠",
  tetris: "🟦",
  zip: "🔢",
  queens: "👑",
  sudoku: "🧩",
  tango: "☀️",
};

const SIZE = 300;
const R = SIZE / 2 - 8;
const CX = SIZE / 2;
const CY = SIZE / 2;

/** Point on the circle; angle measured from the top, clockwise. */
function polar(angleDeg: number, radius = R) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

function sectorPath(start: number, end: number): string {
  const a = polar(start);
  const b = polar(end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${a.x} ${a.y} A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y} Z`;
}

export function Wheel({ wheel }: { wheel: WheelState }) {
  const { options, chosen, spinMs } = wheel;
  const n = options.length;
  const seg = 360 / n;
  // Start already turned a bit so even a re-mount shows motion; the target adds
  // several full turns and lands the chosen sector under the pointer.
  const [rotation, setRotation] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const idx = Math.max(0, options.indexOf(chosen));
    const center = (idx + 0.5) * seg;
    const jitter = (Math.random() - 0.5) * seg * 0.5;
    const target = 360 * 6 - center - jitter;
    // Delay one tick so the browser paints rotation:0 first, then transitions.
    const kick = setTimeout(() => {
      setRotation(target);
      sfx("spin");
    }, 60);
    const done = setTimeout(() => {
      setSettled(true);
      sfx("correct");
    }, spinMs + 120);
    return () => {
      clearTimeout(kick);
      clearTimeout(done);
    };
  }, [options, chosen, seg, spinMs]);

  return (
    <div className="overlay backdrop wheel-overlay">
      <div className="wheel-card">
        <h2 className="pixel wheel-title">{settled ? "Get ready!" : "Spinning the wheel…"}</h2>

        <div className="wheel-wrap" style={{ width: SIZE, height: SIZE }}>
          <div className="wheel-pointer" aria-hidden />
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="wheel-svg"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${spinMs}ms cubic-bezier(0.15, 0.8, 0.2, 1)`,
            }}
          >
            {n === 1 ? (
              <circle cx={CX} cy={CY} r={R} fill={GAME_COLOR[options[0]]} stroke="#0d0b22" strokeWidth={4} />
            ) : (
              options.map((opt, i) => (
                <path
                  key={opt}
                  d={sectorPath(i * seg, (i + 1) * seg)}
                  fill={GAME_COLOR[opt]}
                  stroke="#0d0b22"
                  strokeWidth={4}
                />
              ))
            )}
            {options.map((opt, i) => {
              const mid = (i + 0.5) * seg;
              const p = polar(mid, R * 0.6);
              return (
                <text
                  key={`${opt}-label`}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid} ${p.x} ${p.y})`}
                  fontSize="20"
                >
                  {GAME_ICON[opt]}
                </text>
              );
            })}
            <circle cx={CX} cy={CY} r={16} fill="#12102b" stroke="#0d0b22" strokeWidth={4} />
          </svg>
        </div>

        <div className={`wheel-result${settled ? " show" : ""}`}>
          {GAME_ICON[chosen]} {MINIGAME_NAMES[chosen]}
        </div>
      </div>
    </div>
  );
}
