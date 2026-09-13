import { useState } from "react";
import { MINIGAME_NAMES, type MinigameType } from "@marvinho/shared";
import { store, REQUIRED_PLAYERS } from "../state/store.js";
import { useStore } from "../state/useStore.js";
import { DEBUG_FEATURE_ENABLED } from "../features.js";
import { AudioVisualizer } from "../audio/AudioVisualizer.js";
import type { SeatState } from "../state/types.js";
import { PRACTICE_ICON, PRACTICE_ORDER } from "./practiceGames.js";

function initialCode(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get("lobby") ?? "").toUpperCase();
}

export function HomeScreen({ seat }: { seat: SeatState }) {
  const snap = useStore();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [practiceBusy, setPracticeBusy] = useState(false);

  const net = store.net(seat.id);

  async function practice(game: MinigameType) {
    if (practiceBusy) return;
    setPracticeBusy(true);
    store.setSeatError(seat.id, null);
    try {
      await store.practice(game, nickname);
    } finally {
      setPracticeBusy(false);
    }
  }

  async function create() {
    if (!net) return;
    setBusy(true);
    store.setSeatError(seat.id, null);
    try {
      await net.create(nickname);
    } catch (e) {
      store.setSeatError(seat.id, e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!net) return;
    setBusy(true);
    store.setSeatError(seat.id, null);
    try {
      await net.join(code, nickname);
    } catch (e) {
      store.setSeatError(seat.id, e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const canPlay = nickname.trim().length > 0 && seat.connected && !busy;

  return (
    <div className="home-stage">
      {/* Left: branding */}
      <section className="home-hero">
        <h1 className="title home-title intro-left">Marvinho Party</h1>
        <p className="home-lede intro-up">
          A pixel party of quick minigames. Win them, race across the board, and
          be first to the finish.
        </p>
        <AudioVisualizer variant="bars" className="home-hero-viz intro-up" height={56} />
      </section>

      {/* Right: join / create */}
      <section className="home-join intro-right">
        <div className="panel home-join-card">
          <h2 className="pixel" style={{ fontSize: 15, marginTop: 0 }}>Join the party</h2>

          <div className="stack">
            <div>
              <label>Your nickname</label>
              <input
                type="text"
                value={nickname}
                maxLength={16}
                placeholder="e.g. Marvinho"
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canPlay && create()}
                autoFocus
              />
            </div>

            <button
              className="btn wide pink"
              disabled={!canPlay || code.trim().length > 0}
              title={code.trim().length > 0 ? "Clear the lobby code to create a new lobby" : undefined}
              onClick={create}
            >
              Create Lobby
            </button>

            <div className="home-or"><span>or join with a code</span></div>

            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Lobby code</label>
                <input
                  type="text"
                  value={code}
                  maxLength={4}
                  placeholder="ABCD"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && canPlay && code.trim().length >= 4 && join()}
                />
              </div>
              <button
                className="btn secondary"
                style={{ alignSelf: "flex-end" }}
                disabled={!canPlay || code.trim().length < 4}
                onClick={join}
              >
                Join
              </button>
            </div>

            <div className="error">{seat.error}</div>
            {!seat.connected && <div className="hint">Connecting to server…</div>}
          </div>
        </div>

        {DEBUG_FEATURE_ENABLED && snap.debugEnabled && (
          <div className="panel practice-panel">
            <h3 className="pixel" style={{ fontSize: 12, margin: "0 0 4px", color: "var(--warn)" }}>
              🐛 Practice a minigame
            </h3>
            <p className="hint" style={{ margin: "0 0 12px", fontSize: 16 }}>
              Launch any game standalone to test it — bots are spawned automatically.
            </p>
            <div className="practice-grid">
              {PRACTICE_ORDER.map((game) => (
                <button
                  key={game}
                  className="practice-btn"
                  disabled={practiceBusy || !seat.connected}
                  onClick={() => practice(game)}
                >
                  <span className="practice-emoji">{PRACTICE_ICON[game]}</span>
                  <span className="practice-name">{MINIGAME_NAMES[game]}</span>
                  <span className="practice-req">{REQUIRED_PLAYERS[game]}P</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
