import { useEffect, useState } from "react";
import type { Appearance, MinigameResult, ScoreRow, TeamScore } from "@marvinho/shared";
import { sfx } from "../audio/audio.js";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { TokenAvatar } from "./TokenAvatar.js";

/** Host confirms the podium; others wait. Releases the board advance. */
function ResultsConfirm({ seat }: { seat: SeatState }) {
  const me = seat.lobby?.players.find((p) => p.id === seat.playerId);
  const isHost = me?.isHost ?? false;
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await store.net(seat.id)?.confirmResults();
    } catch {
      setBusy(false);
    }
  }
  return (
    <div className="podium-confirm">
      {isHost ? (
        <button className="btn wide pink" disabled={busy} onClick={go}>
          {busy ? "Los geht's…" : "Bestätigen & weiter →"}
        </button>
      ) : (
        <div className="hint">Warte auf den Host…</div>
      )}
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];
const HEIGHTS = [186, 146, 116];

function Column({ row, spot, appearance }: { row: ScoreRow; spot: number; appearance: Appearance }) {
  // Reveal 3rd → 2nd → 1st for drama.
  const delay = 0.15 + (2 - row.rank) * 0.4;
  return (
    <div className="pod-col" style={{ animationDelay: `${delay}s` }}>
      {row.rank === 0 && (
        <div className="confetti-field" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="confetti"
              style={{
                left: `${(i * 61) % 100}%`,
                background: ["#ffd23f", "#ff6fcf", "#3aa0ff", "#42d17a"][i % 4],
                animationDelay: `${delay + (i % 6) * 0.12}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className="pod-medal">{MEDALS[row.rank] ?? `#${row.rank + 1}`}</div>
      <TokenAvatar appearance={appearance} size={spot === 1 ? 78 : 64} />
      <div className="pod-name">{row.nickname}</div>
      <div
        className="pod-block"
        style={{ height: HEIGHTS[row.rank] ?? 70, background: row.color }}
      >
        <div className="pod-place">{row.rank + 1}</div>
        <div className="pod-reward">+{row.reward}</div>
      </div>
      <div className="pod-stats">{row.detail}</div>
    </div>
  );
}

function TeamColumn({ team }: { team: TeamScore }) {
  const height = team.won ? 288 : 208;
  return (
    <div className={`team-col${team.won ? " won" : ""}`}>
      <div className="team-medal">{team.won ? "🏆" : ""}</div>
      <div className="team-name" style={{ color: team.color }}>{team.name}</div>
      <div
        className="team-bar"
        style={{ height, background: team.color, borderColor: "rgba(0,0,0,0.45)" }}
      >
        <div className="team-points">
          +{team.points} <span>each</span>
        </div>
        <div className="team-members">
          {team.members.map((m) => (
            <div key={m.playerId} className="team-member">{m.nickname}</div>
          ))}
        </div>
      </div>
      <div className="team-outcome">{team.won ? "WINNERS" : "defeated"}</div>
    </div>
  );
}

function TeamScoreboard({ result, seat }: { result: MinigameResult; seat: SeatState }) {
  const teams = result.teams ?? [];
  return (
    <div className="overlay backdrop podium-overlay">
      <div className="podium-card">
        <h2 className="pixel podium-title">Results</h2>
        {result.reveal && (
          <p className="podium-answer">
            <span>{result.reveal.toUpperCase()}</span>
          </p>
        )}
        <div className="team-board">
          {teams.map((t) => (
            <TeamColumn key={t.team} team={t} />
          ))}
        </div>
        <ResultsConfirm seat={seat} />
      </div>
    </div>
  );
}

export function Podium({ result, seat }: { result: MinigameResult; seat: SeatState }) {
  // Celebratory fanfare when the results reveal.
  useEffect(() => {
    sfx("win");
  }, []);

  // Team games get a two-team scoreboard; solo games get the podium.
  if (result.teams && result.teams.length > 0) {
    return <TeamScoreboard result={result} seat={seat} />;
  }

  const board = result.scoreboard;
  const top3 = board.slice(0, 3);
  const rest = board.slice(3);
  // Classic podium arrangement: 2nd, 1st, 3rd.
  const order = [top3[1], top3[0], top3[2]].filter(Boolean) as ScoreRow[];

  return (
    <div className="overlay backdrop podium-overlay">
      <div className="podium-card">
        <h2 className="pixel podium-title">Results</h2>
        {result.reveal && (
          <p className="podium-answer">
            Word was <span>{result.reveal.toUpperCase()}</span>
          </p>
        )}

        <div className="podium">
          {order.map((row) => (
            <Column
              key={row.playerId}
              row={row}
              spot={row.rank}
              appearance={
                seat.lobby?.players.find((p) => p.id === row.playerId)?.appearance ?? {
                  color: row.color,
                  hair: 0,
                  hairColor: "#2b2b33",
                  mouth: 1,
                }
              }
            />
          ))}
        </div>

        {rest.length > 0 && (
          <div className="podium-rest">
            {rest.map((row) => (
              <div key={row.playerId} className="rest-row">
                <span className="rank-badge">#{row.rank + 1}</span>
                <span className="swatch" style={{ background: row.color }} />
                <span>{row.nickname}</span>
                <span className="rest-stats">{row.detail}</span>
                <span className="rest-reward">+{row.reward}</span>
              </div>
            ))}
          </div>
        )}

        <ResultsConfirm seat={seat} />
      </div>
    </div>
  );
}
