import { useEffect, useState, type CSSProperties } from "react";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import { AudioVisualizer } from "../audio/AudioVisualizer.js";
import type { SeatState } from "../state/types.js";
import { PhaserBoard } from "../game/PhaserBoard.js";
import { WordlePanel } from "./WordlePanel.js";
import { CodenamesPanel } from "./CodenamesPanel.js";
import { SkribblPanel } from "./SkribblPanel.js";
import { SkribblTeamsPanel } from "./SkribblTeamsPanel.js";
import { FindWordPanel } from "./FindWordPanel.js";
import { TetrisPanel } from "./TetrisPanel.js";
import { PuzzlePanel } from "./PuzzlePanel.js";
import { GuessCountryPanel } from "./GuessCountryPanel.js";
import { TravlePanel } from "./TravlePanel.js";
import { PongPanel } from "./PongPanel.js";
import { HidePanel } from "./HidePanel.js";
import { BattlePanel } from "./BattlePanel.js";
import { TeamDraftScreen } from "./TeamDraftScreen.js";
import { ReadyPanel } from "./ReadyPanel.js";
import { ExplanationScreen } from "./ExplanationScreen.js";
import { SandboxMenu } from "./SandboxMenu.js";
import { Wheel } from "./Wheel.js";
import { Countdown } from "./Countdown.js";
import { Podium } from "./Podium.js";

export function GameScreen({ seat }: { seat: SeatState }) {
  // Briefly hold the results podium so the board's forward-hop animation plays
  // in the open first, then the podium slides in over it.
  const resultsActive = seat.minigamePhase === "results" && !!seat.lastResult;
  const [podiumReady, setPodiumReady] = useState(false);
  useEffect(() => {
    if (!resultsActive) {
      setPodiumReady(false);
      return;
    }
    const t = setTimeout(() => setPodiumReady(true), 1500);
    return () => clearTimeout(t);
  }, [resultsActive]);

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
  if (playing && seat.minigame === "guesscountry" && seat.guessCountry) {
    return (
      <div className="game-wrap">
        <GuessCountryPanel seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "travle" && seat.travle) {
    return (
      <div className="game-wrap">
        <TravlePanel seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "pong" && seat.pong) {
    return (
      <div className="game-wrap">
        <PongPanel seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "verstecken" && seat.hide) {
    return (
      <div className="game-wrap">
        <HidePanel seat={seat} />
      </div>
    );
  }
  if (playing && seat.minigame === "battle" && seat.battle) {
    return (
      <div className="game-wrap">
        <BattlePanel seat={seat} />
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

  const boardPlayers = lobby.players.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    color: p.color,
    position: p.position,
    ready: p.ready,
  }));

  const spinning = seat.minigamePhase === "spinning" && !!seat.wheel;
  const assigning = seat.minigamePhase === "assigning" && !!seat.teamDraft;
  const explaining = seat.minigamePhase === "explaining" && !!seat.explainGame;
  const countingDown = seat.minigamePhase === "countdown" && !!seat.countdown;
  const showPodium = !isFinished && resultsActive && podiumReady;
  // Between minigames we stay on the board. With explanations OFF, a ready vote
  // on the board paces the next round; with them ON, the explanation screen is
  // the ready-gate instead (so there's exactly one gate per round).
  const inIntermission =
    !isFinished && (seat.minigamePhase === "results" || seat.minigamePhase === "intermission");
  const showReady =
    inIntermission && !spinning && !assigning && !countingDown && !lobby.settings.explanations;

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

      {showPodium && seat.lastResult && <Podium result={seat.lastResult} />}

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
