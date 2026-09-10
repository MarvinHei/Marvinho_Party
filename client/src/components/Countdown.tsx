import { useEffect, useRef, useState } from "react";
import { MINIGAME_NAMES, type MinigameType } from "@marvinho/shared";
import { sfx } from "../audio/audio.js";

const ICON: Record<MinigameType, string> = {
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

export function Countdown({ game, endsAt }: { game: MinigameType; endsAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);

  const n = Math.ceil(Math.max(0, endsAt - now) / 1000);
  const label = n > 0 ? String(n) : "GO!";

  // One beep per number, a brighter chime on "GO!".
  const lastLabel = useRef<string>("");
  useEffect(() => {
    if (label !== lastLabel.current) {
      lastLabel.current = label;
      sfx(label === "GO!" ? "correct" : "countdown");
    }
  }, [label]);

  return (
    <div className="overlay backdrop countdown-overlay">
      <div className="countdown-card">
        <div className="countdown-game">
          {ICON[game]} {MINIGAME_NAMES[game]}
        </div>
        {/* key changes each tick to re-fire the pop animation */}
        <div className={`countdown-num${label === "GO!" ? " go" : ""}`} key={label}>
          {label}
        </div>
        <div className="hint">Get ready…</div>
      </div>
    </div>
  );
}
