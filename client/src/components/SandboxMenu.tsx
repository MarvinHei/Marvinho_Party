import { useState } from "react";
import { MINIGAME_NAMES, type MinigameType } from "@marvinho/shared";
import { store, REQUIRED_PLAYERS } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { PRACTICE_ICON, PRACTICE_ORDER } from "./practiceGames.js";

export function SandboxMenu({ seat }: { seat: SeatState }) {
  const [busy, setBusy] = useState(false);
  const net = store.net(seat.id);

  async function pick(game: MinigameType) {
    if (busy) return;
    setBusy(true);
    try {
      await store.practice(game, "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay backdrop sandbox-overlay">
      <div className="panel sandbox-panel">
        <h2 className="pixel" style={{ color: "var(--warn)", fontSize: 16, margin: 0 }}>
          🐛 Practice mode
        </h2>
        <p className="hint" style={{ margin: "6px 0 14px" }}>
          Pick a minigame to test — no board, no scoreboard.
        </p>
        <div className="practice-grid">
          {PRACTICE_ORDER.map((game) => (
            <button
              key={game}
              className="practice-btn"
              disabled={busy}
              onClick={() => pick(game)}
            >
              <span className="practice-emoji">{PRACTICE_ICON[game]}</span>
              <span className="practice-name">{MINIGAME_NAMES[game]}</span>
              <span className="practice-req">{REQUIRED_PLAYERS[game]}P</span>
            </button>
          ))}
        </div>
        <button
          className="btn secondary"
          style={{ marginTop: 14 }}
          onClick={() => {
            net?.leave();
            window.location.href = window.location.origin;
          }}
        >
          Leave practice
        </button>
      </div>
    </div>
  );
}
