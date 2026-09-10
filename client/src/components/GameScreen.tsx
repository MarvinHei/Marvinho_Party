import type { CSSProperties } from "react";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { PhaserBoard } from "../game/PhaserBoard.js";
import { WordlePanel } from "./WordlePanel.js";
import { CodenamesPanel } from "./CodenamesPanel.js";
import { SkribblPanel } from "./SkribblPanel.js";
import { SkribblTeamsPanel } from "./SkribblTeamsPanel.js";
import { FindWordPanel } from "./FindWordPanel.js";
import { TetrisPanel } from "./TetrisPanel.js";
import { PuzzlePanel } from "./PuzzlePanel.js";
import { CodenamesAssign } from "./CodenamesAssign.js";
import { ReadyPanel } from "./ReadyPanel.js";
import { SandboxMenu } from "./SandboxMenu.js";
import { Wheel } from "./Wheel.js";
import { Countdown } from "./Countdown.js";
import { Podium } from "./Podium.js";

export function GameScreen({ seat }: { seat: SeatState }) {
  const lobby = seat.lobby;
  if (!lobby) return null;

  const isFinished = lobby.phase === "finished";
  const playing = seat.minigamePhase === "playing";

  // A running minigame takes over the full stage.
  if (playing && seat.minigame === "wordle") {
    return (
      <div className="game-wrap">
        <div className="center-stage" style={{ alignItems: "flex-start" }}>
          <WordlePanel seat={seat} />
        </div>
      </div>
    );
  }
  if (playing && seat.minigame === "codenames") {
    return (
      <div className="game-wrap">
        <CodenamesPanel seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "skribbl") {
    return (
      <div className="game-wrap">
        <SkribblPanel seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "skribblteams") {
    return (
      <div className="game-wrap">
        <SkribblTeamsPanel key={seat.id} seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "findword") {
    return (
      <div className="game-wrap">
        <FindWordPanel key={seat.id} seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "tetris") {
    return (
      <div className="game-wrap">
        <TetrisPanel key={seat.id} seat={seat} />
      </div>
    );
  }
  if (playing && seat.puzzle) {
    return (
      <div className="game-wrap">
        <PuzzlePanel seat={seat} />
      </div>
    );
  }

  // Sandbox (debug practice): no board/scoreboard — just transitions + a menu.
  if (lobby.sandbox) {
    return (
      <div className="game-wrap board-stage">
        {seat.minigamePhase === "assigning" && seat.assign && <CodenamesAssign seat={seat} />}
        {seat.minigamePhase === "countdown" && seat.countdown && (
          <Countdown game={seat.countdown.game} endsAt={seat.countdown.endsAt} />
        )}
        {(seat.minigamePhase === "results" || seat.minigamePhase === "intermission") && (
          <SandboxMenu seat={seat} />
        )}
      </div>
    );
  }

  const boardPlayers = lobby.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    color: p.color,
    position: p.position,
    ready: p.ready,
  }));

  const spinning = seat.minigamePhase === "spinning" && !!seat.wheel;
  const assigning = seat.minigamePhase === "assigning" && !!seat.assign;
  const countingDown = seat.minigamePhase === "countdown" && !!seat.countdown;
  const showPodium = !isFinished && seat.minigamePhase === "results" && !!seat.lastResult;
  // Between minigames we stay on the board and gate the next game behind a
  // ready vote (host can force-start), rather than dropping back to the lobby.
  const inIntermission =
    !isFinished && (seat.minigamePhase === "results" || seat.minigamePhase === "intermission");
  const showReady = inIntermission && !spinning && !assigning && !countingDown;

  return (
    <div className="game-wrap board-stage">
      <PhaserBoard boardLength={lobby.boardLength} players={boardPlayers} meId={seat.playerId} />

      {isFinished && <WinnerOverlay seat={seat} />}

      {spinning && seat.wheel && <Wheel wheel={seat.wheel} />}

      {assigning && <CodenamesAssign seat={seat} />}

      {countingDown && seat.countdown && (
        <Countdown game={seat.countdown.game} endsAt={seat.countdown.endsAt} />
      )}

      {showPodium && seat.lastResult && <Podium result={seat.lastResult} />}

      {showReady && <ReadyPanel seat={seat} withPodium={showPodium} />}
    </div>
  );
}

function WinnerOverlay({ seat }: { seat: SeatState }) {
  const lobby = seat.lobby!;
  const winner = lobby.players.find((p) => p.id === lobby.winnerId);
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
