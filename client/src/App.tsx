import { useEffect } from "react";
import { useStore } from "./state/useStore.js";
import { store } from "./state/store.js";
import { DEBUG_FEATURE_ENABLED } from "./features.js";
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

  const active = snap.seats.find((s) => s.id === snap.activeSeatId);

  return (
    <div className="app">
      {DEBUG_FEATURE_ENABLED && <DebugBar />}
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
