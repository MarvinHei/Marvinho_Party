import { useState } from "react";
import type { MinigameType } from "@marvinho/shared";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { gameInfo } from "./gameInfo.js";

/**
 * Pre-game explanation screen (host-enabled). Shows how the chosen minigame
 * works and gates the start behind a ready vote (host can skip with "Start
 * now"). Reuses the same ready/forceStart mechanic as the intermission.
 */
export function ExplanationScreen({ seat, game }: { seat: SeatState; game: MinigameType }) {
  const [busy, setBusy] = useState(false);
  const info = gameInfo(game);
  const lobby = seat.lobby;
  const net = store.net(seat.id);
  const me = lobby?.players.find((p) => p.id === seat.playerId);
  const isHost = me?.isHost ?? false;
  const iAmReady = me?.ready ?? false;
  const connected = lobby?.players.filter((p) => p.connected) ?? [];
  const readyCount = connected.filter((p) => p.ready).length;

  async function toggleReady() {
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

  async function startNow() {
    if (!net) return;
    try {
      await net.forceStart();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="overlay backdrop explain-overlay">
      <div className="explain-card" style={{ ["--accent-game" as string]: info.color }}>
        <div className="explain-emoji" aria-hidden>{info.icon}</div>
        <h2 className="pixel explain-title">{info.name}</h2>
        <p className="explain-tagline">{info.tagline}</p>

        <ul className="explain-rules">
          {info.rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <div className="explain-ready">
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
          <div className="ready-count pixel">{readyCount}/{connected.length} ready</div>
        </div>

        <div className="explain-actions">
          <button
            className={`btn wide ${iAmReady ? "secondary" : "pink"}`}
            disabled={busy}
            onClick={toggleReady}
          >
            {iAmReady ? "Ready — waiting…" : "I'm Ready!"}
          </button>
          {isHost && (
            <button className="btn" onClick={startNow} title="Skip the vote and start now">
              Start now →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
