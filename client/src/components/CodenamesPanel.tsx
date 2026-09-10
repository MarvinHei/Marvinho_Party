import { useState } from "react";
import type { CardColor, CodenamesTeam } from "@marvinho/shared";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";

const TEAM_COLOR: Record<CodenamesTeam, string> = { a: "#e6394b", b: "#3aa0ff" };
const TEAM_NAME: Record<CodenamesTeam, string> = { a: "Red", b: "Blue" };

function cardColor(c: CardColor): string {
  switch (c) {
    case "a": return "#e6394b";
    case "b": return "#3aa0ff";
    case "neutral": return "#9a8f63";
    case "assassin": return "#0d0b22";
  }
}

export function CodenamesPanel({ seat }: { seat: SeatState }) {
  const cv = seat.codenames;
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);
  const net = store.net(seat.id);

  if (!cv) {
    return (
      <div className="center-stage">
        <div className="panel"><h2 className="pixel">Setting up Codenames…</h2></div>
      </div>
    );
  }

  const nameOf = (id: string) =>
    seat.lobby?.players.find((p) => p.id === id)?.nickname ?? "?";

  const myTeam = cv.myTeam;
  const isMyTurn = myTeam !== null && cv.turn === myTeam;
  const solo = myTeam !== null && cv.teams[myTeam].memberIds.length === 1;
  const canClue = isMyTurn && cv.turnPhase === "clue" && cv.isSpymaster;
  const canGuess = isMyTurn && cv.turnPhase === "guess" && (!cv.isSpymaster || solo);

  async function giveClue() {
    if (!net || !clueWord.trim()) return;
    try {
      await net.codenamesClue(clueWord.trim(), clueCount);
      setClueWord("");
      setClueCount(1);
    } catch (e) {
      store.setSeatError(seat.id, e instanceof Error ? e.message : "Bad clue");
    }
  }

  async function guess(index: number) {
    if (!net || !canGuess || cv?.revealed[index]) return;
    try {
      await net.codenamesGuess(index);
    } catch (e) {
      store.setSeatError(seat.id, e instanceof Error ? e.message : "Bad guess");
    }
  }

  const turnLabel = (() => {
    if (cv.turnPhase === "clue") return `${TEAM_NAME[cv.turn]} spymaster is thinking…`;
    return `${TEAM_NAME[cv.turn]} team is guessing`;
  })();

  return (
    <div className="cn-wrap">
      {/* Top status bar */}
      <div className="cn-top">
        <TeamBadge team="a" cv={cv} nameOf={nameOf} />
        <div className="cn-status">
          <div className="cn-turn" style={{ color: TEAM_COLOR[cv.turn] }}>
            {turnLabel}
          </div>
          {cv.clue && (
            <div className="cn-clue">
              Clue: <b>{cv.clue.word}</b> · {cv.clue.count}{" "}
              <span className="cn-guessesleft">({cv.clue.guessesLeft} left)</span>
            </div>
          )}
          <div className="cn-role">
            You: <span style={{ color: myTeam ? TEAM_COLOR[myTeam] : "#fff" }}>
              {myTeam ? TEAM_NAME[myTeam] : "Spectator"}
            </span>{" "}
            {cv.isSpymaster ? "· Spymaster" : myTeam ? "· Operative" : ""}
          </div>
        </div>
        <TeamBadge team="b" cv={cv} nameOf={nameOf} />
      </div>

      {/* Grid (size adapts to the card count: 3×3, 4×4 or 5×5) */}
      <div
        className="cn-grid"
        style={{ gridTemplateColumns: `repeat(${Math.round(Math.sqrt(cv.words.length))}, 1fr)` }}
      >
        {cv.words.map((word, i) => {
          const revealed = cv.revealed[i];
          const keyColor = cv.key ? cv.key[i] : null; // spymaster only
          const clickable = canGuess && !revealed;
          const classes = ["cn-card"];
          if (revealed) classes.push("revealed");
          if (clickable) classes.push("clickable");
          if (keyColor && !revealed) classes.push("spy");

          const bg = revealed
            ? cardColor(revealed)
            : keyColor
              ? cardColor(keyColor)
              : undefined;

          return (
            <button
              key={i}
              className={classes.join(" ")}
              style={
                revealed
                  ? { background: bg, color: revealed === "neutral" ? "#241f10" : "#fff" }
                  : keyColor
                    ? { boxShadow: `inset 0 0 0 3px ${bg}` }
                    : undefined
              }
              disabled={!clickable}
              onClick={() => guess(i)}
            >
              {revealed === "assassin" ? "💀" : word}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="cn-controls">
        {canClue && (
          <div className="cn-clue-form">
            <input
              type="text"
              placeholder="one-word clue"
              value={clueWord}
              maxLength={20}
              onChange={(e) => setClueWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && giveClue()}
            />
            <select value={clueCount} onChange={(e) => setClueCount(Number(e.target.value))}>
              {Array.from({ length: 9 }, (_, k) => k + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button className="btn pink" onClick={giveClue}>Give clue</button>
          </div>
        )}
        {canGuess && (
          <button className="btn secondary" onClick={() => net?.codenamesEndTurn()}>
            End turn
          </button>
        )}
        {!canClue && !canGuess && (
          <div className="hint">
            {cv.isSpymaster && isMyTurn
              ? "Waiting for your team to guess…"
              : `Waiting — ${turnLabel.toLowerCase()}`}
          </div>
        )}
        {seat.error && <div className="error">{seat.error}</div>}
      </div>

      {/* Log */}
      <div className="cn-log">
        {cv.log.slice(-4).map((line, i) => (
          <div key={i} className="cn-log-line">{line}</div>
        ))}
      </div>
    </div>
  );
}

function TeamBadge({
  team,
  cv,
  nameOf,
}: {
  team: CodenamesTeam;
  cv: NonNullable<SeatState["codenames"]>;
  nameOf: (id: string) => string;
}) {
  const info = cv.teams[team];
  const active = cv.turn === team;
  return (
    <div className={`cn-team${active ? " active" : ""}`} style={{ borderColor: TEAM_COLOR[team] }}>
      <div className="cn-team-head" style={{ color: TEAM_COLOR[team] }}>
        {TEAM_NAME[team]} · {info.remaining}
      </div>
      <div className="cn-team-members">
        {info.memberIds.map((id) => (
          <span key={id} className="cn-member">
            {id === info.spymasterId ? "🎩 " : ""}
            {nameOf(id)}
          </span>
        ))}
      </div>
    </div>
  );
}
