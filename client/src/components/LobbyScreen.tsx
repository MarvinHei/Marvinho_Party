import { useState } from "react";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { LobbySettingsPanel } from "./LobbySettingsPanel.js";
import { AudioVisualizer } from "../audio/AudioVisualizer.js";

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
  const raceStarted = lobby.players.some((p) => p.position > 0);

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
    <div className="lobby-stage">
      <header className="lobby-hero">
        <div className="lobby-hero-left">
          <h1 className="title lobby-hero-title">Marvinho Party</h1>
          <p className="subtitle" style={{ margin: 0 }}>Set up your party, then start when everyone's in.</p>
        </div>
        <div className="lobby-code-box">
          <span className="lobby-code-label">Lobby code</span>
          <div className="lobby-code">{lobby.id}</div>
          <button className="btn secondary lobby-copy" onClick={copyInvite}>
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>
        <AudioVisualizer variant="bars" className="lobby-hero-viz" height={40} />
      </header>

      <div className="lobby-body">
        {/* Players & start */}
        <section className="panel lobby-players-panel">
          <h3 className="pixel section-title">Players ({connectedCount})</h3>
          <div className="player-list">
            {lobby.players.map((p) => (
              <div key={p.id} className={`player-row${p.connected ? "" : " offline"}`}>
                <span className="swatch" style={{ background: p.color }} />
                <span className="player-name">{p.nickname}</span>
                {p.id === seat.playerId && <span style={{ color: "var(--ink-dim)" }}>(you)</span>}
                {p.isHost && <span className="host-tag">HOST</span>}
                {isHost && p.id !== seat.playerId && (
                  <button className="kick-btn" title={`Kick ${p.nickname}`} onClick={() => kick(p.id)}>
                    Kick
                  </button>
                )}
              </div>
            ))}
          </div>

          {raceStarted && (
            <>
              <h3 className="pixel section-title">Race to the finish</h3>
              <div className="race-list">
                {lobby.players.map((p) => (
                  <div key={p.id} className="race-row">
                    <span className="race-nick">{p.nickname}</span>
                    <div className="race-track">
                      <div
                        className="race-fill"
                        style={{
                          width: `${Math.min(100, (p.position / lobby.boardLength) * 100)}%`,
                          background: p.color,
                        }}
                      />
                      <span className="race-finish" aria-hidden>🏁</span>
                    </div>
                    <span className="race-pos pixel">{p.position}/{lobby.boardLength}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="lobby-start">
            {isHost ? (
              <button className="btn wide pink" disabled={!canStart} onClick={start}>
                {connectedCount < lobby.minPlayers
                  ? `Need ${lobby.minPlayers - connectedCount} more player(s)`
                  : raceStarted
                    ? "Start next game 🎲"
                    : "Start Game"}
              </button>
            ) : (
              <p className="hint">Waiting for the host to start the game…</p>
            )}
            <div className="error">{seat.error}</div>
          </div>
        </section>

        {/* Settings */}
        <section className="panel lobby-settings-col">
          <LobbySettingsPanel seat={seat} isHost={isHost} />
        </section>
      </div>
    </div>
  );
}
