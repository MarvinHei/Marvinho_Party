import { useEffect, useState } from "react";
import type { CodenamesTeam } from "@marvinho/shared";
import type { SeatState } from "../state/types.js";

const TEAM_COLOR: Record<CodenamesTeam, string> = { a: "#e6394b", b: "#3aa0ff" };
const TEAM_NAME: Record<CodenamesTeam, string> = { a: "Red", b: "Blue" };

/**
 * Animated team/role draft shown before a Codenames round. Player chips shuffle
 * in a pool, then lock into their Red/Blue columns with a spymaster badge.
 */
export function CodenamesAssign({ seat }: { seat: SeatState }) {
  const assign = seat.assign;
  const lobby = seat.lobby;
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLocked(true), 1800);
    return () => clearTimeout(t);
  }, []);

  if (!assign || !lobby) return null;

  const info = (id: string) => lobby.players.find((p) => p.id === id);
  const allIds = [...assign.a.memberIds, ...assign.b.memberIds];

  const TeamColumn = ({ team }: { team: CodenamesTeam }) => {
    const t = assign[team];
    return (
      <div className="draft-col" style={{ borderColor: TEAM_COLOR[team] }}>
        <div className="draft-team-name" style={{ color: TEAM_COLOR[team] }}>
          {TEAM_NAME[team]} team
        </div>
        <div className="draft-members">
          {t.memberIds.map((id, i) => {
            const isSpy = id === t.spymasterId;
            const me = id === seat.playerId;
            return (
              <div
                key={id}
                className={`draft-card${isSpy ? " spy" : ""}${me ? " me" : ""}`}
                style={{ animationDelay: `${i * 0.18}s`, borderColor: TEAM_COLOR[team] }}
              >
                <span className="swatch" style={{ background: info(id)?.color }} />
                <span className="draft-nick">{info(id)?.nickname ?? "?"}</span>
                <span className="draft-role">{isSpy ? "🎩 Spymaster" : "🕵️ Operative"}</span>
                {me && <span className="draft-you">YOU</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="overlay backdrop draft-overlay">
      <div className="draft-card-wrap">
        <h2 className="pixel draft-title">
          {locked ? "Teams set!" : "Drafting teams & roles…"}
        </h2>

        {!locked ? (
          <div className="draft-pool">
            {allIds.map((id, i) => (
              <div
                key={id}
                className="draft-chip cycling"
                style={{ animationDelay: `${(i % 6) * 0.12}s` }}
              >
                <span className="swatch" style={{ background: info(id)?.color }} />
                {info(id)?.nickname ?? "?"}
              </div>
            ))}
          </div>
        ) : (
          <div className="draft-board">
            <TeamColumn team="a" />
            <div className="draft-vs pixel">VS</div>
            <TeamColumn team="b" />
          </div>
        )}
      </div>
    </div>
  );
}
