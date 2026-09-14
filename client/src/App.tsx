import { useEffect } from "react";
import { useStore } from "./state/useStore.js";
import { store } from "./state/store.js";
import { DEBUG_FEATURE_ENABLED } from "./features.js";
import { audio } from "./audio/audio.js";
import { MusicControl } from "./audio/MusicControl.js";
import { DebugBar } from "./components/DebugBar.js";
import { HomeScreen } from "./components/HomeScreen.js";
import { LobbyScreen } from "./components/LobbyScreen.js";
import { GameScreen } from "./components/GameScreen.js";

export function App() {
  const snap = useStore();

  // Create the primary seat (and its socket) once on load.
  useEffect(() => {
    store.ensurePrimarySeat();
  }, []);

  // Start the music. We try immediately on load (autoplays wherever the browser
  // allows it), and also on the first user gesture — each unlock() retries, so a
  // blocked autoplay simply starts on the first click/keypress instead.
  useEffect(() => {
    const unlock = () => audio.unlock();
    unlock(); // attempt immediate autoplay on page load
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const active = snap.seats.find((s) => s.id === snap.activeSeatId);

  // The opening theme loops on the start/lobby screens; once the game itself
  // starts, hand off to the in-game background loop.
  useEffect(() => {
    if (active?.screen === "game") audio.enterGame();
  }, [active?.screen]);

  return (
    <div className="app">
      {DEBUG_FEATURE_ENABLED && <DebugBar />}
      <MusicControl />
      {active && active.screen === "game" && !active.lobby?.sandbox && (
        <div className="game-hud-buttons">
          <QuitButton seat={active} />
          {active.minigamePhase === "playing" && !active.forfeited && <ForfeitButton seat={active} />}
        </div>
      )}
      {!active ? (
        <div className="center-stage">
          <div className="panel">
            <h2 className="pixel">Connecting…</h2>
          </div>
        </div>
      ) : active.screen === "home" ? (
        <HomeScreen seat={active} />
      ) : active.screen === "lobby" ? (
        <LobbyScreen seat={active} />
      ) : (
        <GameScreen seat={active} />
      )}
    </div>
  );
}

function QuitButton({ seat }: { seat: import("./state/types.js").SeatState }) {
  return (
    <button
      className="quit-btn"
      title="Leave the game"
      onClick={() => {
        if (!window.confirm("Leave the game? You'll return to the home screen.")) return;
        store.net(seat.id)?.leave();
        window.location.href = window.location.origin;
      }}
    >
      ⏻ Quit
    </button>
  );
}

function ForfeitButton({ seat }: { seat: import("./state/types.js").SeatState }) {
  return (
    <button
      className="forfeit-btn"
      title="Give up this minigame for 0 points"
      onClick={() => {
        if (!window.confirm("Forfeit this minigame? You'll get 0 points for it.")) return;
        store.net(seat.id)?.forfeit().catch(() => { /* ignore */ });
      }}
    >
      🏳️ Forfeit
    </button>
  );
}
