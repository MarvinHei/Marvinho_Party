import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";

interface Person {
  playerId: string;
  nickname: string;
  color: string;
}

/**
 * Shown once the local player is done with a round: a row of the other players
 * to watch read-only. Clicking one streams their POV; clicking again (or Stop)
 * returns to the player's own view.
 */
export function SpectateBar({ seat, people }: { seat: SeatState; people: Person[] }) {
  const others = people.filter((p) => p.playerId !== seat.playerId);
  if (others.length === 0) return null;
  const target = seat.spectateTarget;
  return (
    <div className="spectate-bar">
      <span className="spectate-label pixel">👁 Watch</span>
      {others.map((p) => (
        <button
          key={p.playerId}
          className={`spectate-btn${target === p.playerId ? " on" : ""}`}
          onClick={() => store.setSpectateTarget(seat.id, target === p.playerId ? null : p.playerId)}
        >
          <span className="swatch" style={{ background: p.color }} />
          {p.nickname}
        </button>
      ))}
      {target && (
        <button className="spectate-btn stop" onClick={() => store.setSpectateTarget(seat.id, null)}>
          ✕ stop
        </button>
      )}
    </div>
  );
}
