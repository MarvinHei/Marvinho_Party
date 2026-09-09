import { useState } from "react";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";

export function LobbyScreen({ seat }: { seat: SeatState }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const lobby = seat.lobby;
  const net = store.net(seat.id);

  if (!lobby) return null;

  const me = lobby.players.find((p) => p.id === seat.playerId);
  const isHost = me?.isHost ?? false;
  const connectedCount = lobby.players.filter((p) => p.connected).length;
  const canStart = isHost && connectedCount >= lobby.minPlayers && !busy;
  const inviteUrl = `${window.location.origin}/?lobby=${lobby.id}`;

  async function start() {
    if (!net) return;
    setBusy(true);
    store.setSeatError(seat.id, null);
    try {
      await net.start();
    } catch (e) {
      store.setSeatError(seat.id, e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function kick(playerId: string) {
    if (!net) return;
    store.setSeatError(seat.id, null);
    try {
      await net.kick(playerId);
    } catch (e) {
      store.setSeatError(seat.id, e instanceof Error ? e.message : "Failed");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div className="center-stage">
      <div className="panel" style={{ width: 460, maxWidth: "100%" }}>
        <p className="subtitle" style={{ margin: 0 }}>Lobby code</p>
        <div className="lobby-code">{lobby.id}</div>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn secondary" style={{ flex: 1 }} onClick={copyInvite}>
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>

        <h3 className="pixel" style={{ fontSize: 13, marginTop: 24 }}>
          Players ({connectedCount})
        </h3>
        <div className="player-list">
          {lobby.players.map((p) => (
            <div
              key={p.id}
              className={`player-row${p.connected ? "" : " offline"}`}
            >
              <span className="swatch" style={{ background: p.color }} />
              <span>{p.nickname}</span>
              {p.id === seat.playerId && (
                <span style={{ color: "var(--ink-dim)" }}>(you)</span>
              )}
              {p.isHost && <span className="host-tag">HOST</span>}
              {isHost && p.id !== seat.playerId && (
                <button
                  className="kick-btn"
                  title={`Kick ${p.nickname}`}
                  onClick={() => kick(p.id)}
                >
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {isHost ? (
            <button className="btn wide pink" disabled={!canStart} onClick={start}>
              {connectedCount < lobby.minPlayers
                ? `Need ${lobby.minPlayers - connectedCount} more player(s)`
                : "Start Game"}
            </button>
          ) : (
            <p className="hint">Waiting for the host to start…</p>
          )}
        </div>

        <div className="error">{seat.error}</div>
      </div>
    </div>
  );
}
