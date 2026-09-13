import type { CSSProperties } from "react";
import { TokenAvatar } from "./TokenAvatar.js";
import type { SeatState } from "../state/types.js";

const COLORS = ["#ffd23f", "#ff6fcf", "#3aa0ff", "#42d17a", "#b06bff", "#ff8c42", "#28e0d0", "#e6394b"];

function confettiStyle(i: number): CSSProperties {
  return {
    left: `${(i * 29) % 100}%`,
    background: COLORS[i % COLORS.length],
    animationDelay: `${(i % 10) * 0.12}s`,
    animationDuration: `${1.6 + (i % 6) * 0.22}s`,
  };
}

/** On-board winner celebration: confetti rains over the board and the winner's
 *  character bounces, before the win screen panel takes over. */
export function CelebrationOverlay({ seat, winnerId }: { seat: SeatState; winnerId: string }) {
  const p = seat.lobby?.players.find((x) => x.id === winnerId);
  return (
    <div className="overlay celebrate-overlay" aria-hidden>
      <div className="confetti-field">
        {Array.from({ length: 44 }).map((_, i) => (
          <span key={i} className="confetti" style={confettiStyle(i)} />
        ))}
      </div>
      <div className="celebrate-banner">
        {p && (
          <div className="celebrate-char">
            <TokenAvatar appearance={p.appearance} size={110} />
          </div>
        )}
        <div className="celebrate-text pixel">{p?.nickname ?? "Someone"} wins!</div>
      </div>
    </div>
  );
}
