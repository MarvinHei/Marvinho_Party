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

  // Unlock audio (resume context + start music) on the first user gesture —
  // browsers block autoplay until then.
  useEffect(() => {
    const unlock = () => audio.unlock();
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

  return (
    <div className="app">
      {DEBUG_FEATURE_ENABLED && <DebugBar />}
      <MusicControl />
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
