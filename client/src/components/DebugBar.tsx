import { useStore } from "../state/useStore.js";
import { store } from "../state/store.js";

/**
 * Developer-only control strip. Lets one browser hold several real player
 * seats and switch the point of view between them. Hidden unless enabled.
 */
export function DebugBar() {
  const snap = useStore();
  const active = snap.seats.find((s) => s.id === snap.activeSeatId);
  const lobbyCode = active?.lobby?.id ?? null;

  if (!snap.debugEnabled) {
    return (
      <div className="debug-bar">
        <span className="tag">DEBUG</span>
        <button className="mini-btn" onClick={() => store.setDebug(true)}>
          Enable debug mode
        </button>
      </div>
    );
  }

  return (
    <div className="debug-bar">
      <span className="tag">DEBUG MODE</span>

      {snap.seats.map((seat) => {
        const me = seat.lobby?.players.find((p) => p.id === seat.playerId);
        const isActive = seat.id === snap.activeSeatId;
        return (
          <button
            key={seat.id}
            className={`seat-chip${isActive ? " active" : ""}`}
            onClick={() => store.setActiveSeat(seat.id)}
            title="Switch POV to this player"
          >
            {me && (
              <span className="swatch" style={{ background: me.color }} />
            )}
            {me?.nickname ?? seat.label}
            {!seat.connected && " (off)"}
          </button>
        );
      })}

      <button
        className="mini-btn"
        disabled={!lobbyCode}
        onClick={() => lobbyCode && store.spawnBotSeat(lobbyCode)}
        title={lobbyCode ? "Add a controllable player to this lobby" : "Create/join a lobby first"}
      >
        + Add player
      </button>

      {snap.seats.length > 1 && active && (
        <button
          className="mini-btn"
          onClick={() => store.removeSeat(active.id)}
          title="Remove the current POV seat"
        >
          Remove current
        </button>
      )}

      <button
        className="mini-btn"
        style={{ marginLeft: "auto" }}
        onClick={() => store.setDebug(false)}
      >
        Turn off debug
      </button>
    </div>
  );
}
