import { useEffect, type CSSProperties } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import { AudioVisualizer } from "../audio/AudioVisualizer.js";
import type { SeatState } from "../state/types.js";
import { PhaserBoard } from "../game/PhaserBoard.js";
import { CLIENT_GAMES } from "../games/registry.js";
import { TeamDraftScreen } from "./TeamDraftScreen.js";
import { ReadyPanel } from "./ReadyPanel.js";
import { ExplanationScreen } from "./ExplanationScreen.js";
import { SandboxMenu } from "./SandboxMenu.js";
import { Wheel } from "./Wheel.js";
import { Countdown } from "./Countdown.js";
import { Podium } from "./Podium.js";
import { CelebrationOverlay } from "./CelebrationOverlay.js";

export function GameScreen({ seat }: { seat: SeatState }) {
  const resultsActive = seat.minigamePhase === "results" && !!seat.lastResult;

  const lobby = seat.lobby;
  if (!lobby) return null;

  const isFinished = lobby.phase === "finished";
  const playing = seat.minigamePhase === "playing";

  // Forfeited this round: sit out (panel unmounts, so no input) until it ends.
  if (playing && seat.forfeited) {
    return (
      <div className="game-wrap">
        <div className="center-stage">
          <div className="panel" style={{ textAlign: "center" }}>
            <h2 className="pixel" style={{ color: "var(--bad)" }}>Forfeited 🏳️</h2>
            <p className="hint">0 points this round — waiting for the others to finish…</p>
          </div>
        </div>
      </div>
    );
  }

  // A running minigame takes over the full stage.
  const game = playing ? seat.game : null;
  const mod = game ? CLIENT_GAMES[game.type] : null;
  if (game && mod && (mod.alwaysRender || game.state)) {
    const panel = <mod.Panel key={mod.keyBySeat ? seat.id : undefined} seat={seat} />;
    return (
      <div className="game-wrap">
        {mod.centered ? (
          <div className="center-stage" style={{ alignItems: "flex-start" }}>
            {panel}
          </div>
        ) : (
          panel
        )}
      </div>
    );
  }

  // Sandbox (debug practice): no board/scoreboard — just transitions + a menu.
  if (lobby.sandbox) {
    return (
      <div className="game-wrap board-stage">
        {seat.minigamePhase === "assigning" && seat.teamDraft && seat.teamDraftGame && (
          <TeamDraftScreen seat={seat} teams={seat.teamDraft} game={seat.teamDraftGame} />
        )}
        {seat.minigamePhase === "countdown" && seat.countdown && (
          <Countdown game={seat.countdown.game} endsAt={seat.countdown.endsAt} />
        )}
        {(seat.minigamePhase === "results" || seat.minigamePhase === "intermission") && (
          <SandboxMenu seat={seat} />
        )}
      </div>
    );
  }

  // While the results podium waits for the host to confirm, hold every token at
  // its pre-advance tile (subtract this round's reward). Confirming clears
  // resultsPending, the real positions flow in, and the board plays the hops.
  const rewards = seat.resultsPending ? seat.lastResult?.rewards : undefined;
  const boardPlayers = lobby.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    color: p.color,
    position: rewards ? Math.max(0, p.position - (rewards[p.id] ?? 0)) : p.position,
    ready: p.ready,
    appearance: {
      hair: p.appearance.hair,
      hairColor: p.appearance.hairColor,
      mouth: p.appearance.mouth,
    },
  }));

  const spinning = seat.minigamePhase === "spinning" && !!seat.wheel;
  const assigning = seat.minigamePhase === "assigning" && !!seat.teamDraft;
  const explaining = seat.minigamePhase === "explaining" && !!seat.explainGame;
  const countingDown = seat.minigamePhase === "countdown" && !!seat.countdown;
  // The podium shows until the host confirms; then it hides and the board plays
  // the advance hops.
  const showPodium = !isFinished && resultsActive && seat.resultsPending;
  // Between minigames we stay on the board. With explanations OFF, a ready vote
  // on the board paces the next round; with them ON, the explanation screen is
  // the ready-gate instead (so there's exactly one gate per round).
  const inIntermission =
    !isFinished && (seat.minigamePhase === "results" || seat.minigamePhase === "intermission");
  const celebrating = !isFinished && !!seat.celebrateWinnerId;
  const showReady =
    inIntermission && !spinning && !assigning && !countingDown && !seat.resultsPending &&
    !celebrating && !lobby.settings.explanations;

  return (
    <div className="game-wrap board-stage">
      <PhaserBoard boardLength={lobby.boardLength} players={boardPlayers} meId={seat.playerId} />

      <AudioVisualizer variant="bars" className="board-visualizer" height={52} />

      {isFinished && <WinnerOverlay seat={seat} />}

      {spinning && seat.wheel && <Wheel wheel={seat.wheel} />}

      {assigning && seat.teamDraft && seat.teamDraftGame && (
        <TeamDraftScreen seat={seat} teams={seat.teamDraft} game={seat.teamDraftGame} />
      )}

      {explaining && seat.explainGame && (
        <ExplanationScreen seat={seat} game={seat.explainGame} />
      )}

      {countingDown && seat.countdown && (
        <Countdown game={seat.countdown.game} endsAt={seat.countdown.endsAt} />
      )}

      {showPodium && seat.lastResult && <Podium result={seat.lastResult} seat={seat} />}

      {celebrating && seat.celebrateWinnerId && (
        <CelebrationOverlay seat={seat} winnerId={seat.celebrateWinnerId} />
      )}

      {showReady && <ReadyPanel seat={seat} withPodium={showPodium} />}
    </div>
  );
}

function WinnerOverlay({ seat }: { seat: SeatState }) {
  const lobby = seat.lobby!;
  const winner = lobby.players.find((p) => p.id === lobby.winnerId);
  useEffect(() => {
    sfx("win");
  }, []);
  return (
    <div className="overlay backdrop">
      <div className="panel win-panel">
        <div className="confetti-field" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="confetti" style={confettiStyle(i)} />
          ))}
        </div>
        <div className="trophy">🏆</div>
        <h1 className="title" style={{ fontSize: 24 }}>
          {winner?.nickname ?? "Someone"} wins!
        </h1>
        <p className="subtitle">Marvinho Party champion</p>
        <p className="hint" style={{ marginTop: 8 }}>Returning to the lobby…</p>
        <button
          className="btn secondary"
          style={{ marginTop: 8 }}
          onClick={() => {
            store.net(seat.id)?.leave();
            window.location.href = window.location.origin;
          }}
        >
          Leave lobby
        </button>
      </div>
    </div>
  );
}

export function confettiStyle(i: number): CSSProperties {
  const colors = ["#e6394b", "#3aa0ff", "#42d17a", "#ffd23f", "#b06bff", "#ff8c42", "#28e0d0", "#ff6fcf"];
  return {
    left: `${(i * 37) % 100}%`,
    background: colors[i % colors.length],
    animationDelay: `${(i % 8) * 0.15}s`,
    animationDuration: `${1.8 + (i % 5) * 0.25}s`,
  };
}
