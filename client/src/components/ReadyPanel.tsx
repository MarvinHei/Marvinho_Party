import { useState } from "react";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";

export function ReadyPanel({ seat, withPodium }: { seat: SeatState; withPodium: boolean }) {
  const [busy, setBusy] = useState(false);
  const lobby = seat.lobby;
  if (!lobby) return null;

  const net = store.net(seat.id);
  const me = lobby.players.find((p) => p.id === seat.playerId);
  const isHost = me?.isHost ?? false;
  const iAmReady = me?.ready ?? false;
  const connected = lobby.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready).length;

  async function toggle() {
    if (!net) return;
    setBusy(true);
    try {
      await net.ready(!iAmReady);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function forceStart() {
    if (!net) return;
    try {
      await net.forceStart();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`ready-bar${withPodium ? " with-podium" : ""}`}>
      <div className="ready-dots">
        {connected.map((p) => (
          <span
            key={p.id}
            className={`ready-dot${p.ready ? " on" : ""}`}
            style={{ background: p.ready ? p.color : "transparent", borderColor: p.color }}
            title={`${p.nickname}${p.ready ? " (ready)" : ""}`}
          />
        ))}
      </div>

      <div className="ready-count pixel">
        {readyCount}/{connected.length} ready
      </div>

      <button
        className={`btn ${iAmReady ? "secondary" : "pink"}`}
        disabled={busy}
        onClick={toggle}
      >
        {iAmReady ? "Ready — waiting" : "I'm Ready!"}
      </button>

      {isHost && (
        <button className="btn" onClick={forceStart} title="Skip the vote and start now">
          Start now →
        </button>
      )}
    </div>
  );
}
