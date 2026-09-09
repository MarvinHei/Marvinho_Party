import { useEffect, useState } from "react";
import { MINIGAME_NAMES, type MinigameType } from "@marvinho/shared";

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
