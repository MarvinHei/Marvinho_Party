import { useEffect, useState } from "react";
import type { MinigameType, TeamDraftTeam } from "@marvinho/shared";
import { store } from "../state/store.js";
import { sfx } from "../audio/audio.js";
import type { SeatState } from "../state/types.js";
import { MINIGAME_NAMES } from "@marvinho/shared";
import { GAME_ICON } from "./gameInfo.js";

/**
 * Randomised team draft shown before any team game (Codenames, Skribbl Teams,
 * Find the Word). Player chips shuffle in a pool, lock into their team columns,
 * then everyone confirms (or the host force-starts) before the round begins.
 */
export function TeamDraftScreen({ seat, teams, game }: { seat: SeatState; teams: TeamDraftTeam[]; game: MinigameType }) {
  const lobby = seat.lobby;
  const net = store.net(seat.id);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sfx("spin");
    const t = setTimeout(() => {
      setLocked(true);
      sfx("correct");
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  if (!lobby) return null;

  const me = lobby.players.find((p) => p.id === seat.playerId);
  const isHost = me?.isHost ?? false;
  const iAmReady = me?.ready ?? false;
  const connected = lobby.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready).length;

  const info = (id: string) => lobby.players.find((p) => p.id === id);
  const allIds = teams.flatMap((t) => t.memberIds);

  async function toggleReady() {
    if (!net) return;
    setBusy(true);
    try {
      await net.ready(!iAmReady);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }
  async function startNow() {
    if (!net) return;
    try {
      await net.forceStart();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="overlay backdrop draft-overlay">
      <div className="draft-card-wrap">
        <h2 className="pixel draft-title">
          {locked ? (
            <>{GAME_ICON[game]} {MINIGAME_NAMES[game]} — Teams!</>
          ) : (
            "Teams werden ausgelost…"
          )}
        </h2>

        {!locked ? (
          <div className="draft-pool">
            {allIds.map((id, i) => (
              <div key={id} className="draft-chip cycling" style={{ animationDelay: `${(i % 6) * 0.12}s` }}>
                <span className="swatch" style={{ background: info(id)?.color }} />
                {info(id)?.nickname ?? "?"}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className={`draft-board cols-${teams.length}`}>
              {teams.map((team) => (
                <div key={team.id} className="draft-col" style={{ borderColor: team.color }}>
                  <div className="draft-team-name" style={{ color: team.color }}>{team.name}</div>
                  <div className="draft-members">
                    {team.memberIds.map((id, i) => {
                      const isSpy = team.spymasterId === id;
                      const meCard = id === seat.playerId;
                      return (
                        <div
                          key={id}
                          className={`draft-card${isSpy ? " spy" : ""}${meCard ? " me" : ""}`}
                          style={{ animationDelay: `${i * 0.15}s`, borderColor: team.color }}
                        >
                          <span className="swatch" style={{ background: info(id)?.color }} />
                          <span className="draft-nick">{info(id)?.nickname ?? "?"}</span>
                          {team.spymasterId !== undefined && (
                            <span className="draft-role">{isSpy ? "🎩 Spymaster" : "🕵️ Operative"}</span>
                          )}
                          {meCard && <span className="draft-you">DU</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="explain-ready">
              <div className="ready-dots">
                {connected.map((p) => (
                  <span
                    key={p.id}
                    className={`ready-dot${p.ready ? " on" : ""}`}
                    style={{ background: p.ready ? p.color : "transparent", borderColor: p.color }}
                    title={`${p.nickname}${p.ready ? " (ready)" : ""}`}
                  />
                ))}
              </div>
              <div className="ready-count pixel">{readyCount}/{connected.length} bereit</div>
            </div>

            <div className="explain-actions">
              <button className={`btn wide ${iAmReady ? "secondary" : "pink"}`} disabled={busy} onClick={toggleReady}>
                {iAmReady ? "Bereit — warte…" : "Teams bestätigen"}
              </button>
              {isHost && (
                <button className="btn" onClick={startNow} title="Ohne Abstimmung starten">
                  Jetzt starten →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
