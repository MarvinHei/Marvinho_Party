import { useEffect, useRef, useState } from "react";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";

export function FindWordPanel({ seat }: { seat: SeatState }) {
  const cv = seat.findword;
  const net = store.net(seat.id);
  const [word, setWord] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [cv?.history.length]);

  // Clear the input once a new attempt begins (my submission was consumed).
  useEffect(() => {
    if (cv && !cv.mySubmitted) setWord("");
  }, [cv?.round, cv?.mySubmitted]);

  if (!cv) {
    return (
      <div className="center-stage">
        <div className="panel"><h2 className="pixel">Setting up Find the Word…</h2></div>
      </div>
    );
  }

  const secondsLeft = cv.endsAt ? Math.max(0, Math.ceil((cv.endsAt - Date.now()) / 1000)) : 0;
  const canSubmit = !cv.finished && !cv.mySubmitted;
  const nameOf = (id: string) => cv.members.find((m) => m.id === id)?.nickname ?? "?";

  async function submit() {
    const w = word.trim();
    if (!w || !net) return;
    try {
      await net.findwordSubmit(w);
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Rejected");
    }
  }

  return (
    <div className="findword-wrap">
      <div className="findword-top">
        <span className="team-tag" style={{ background: cv.teamColor }}>{cv.teamName}</span>
        <div className="fw-goal">
          Attempt {cv.round} — everyone type the <b>same</b> word (≥ {cv.minWordLength} letters)
        </div>
        {!cv.finished && (seat.lobby?.settings.games.findword?.timerEnabled ?? true) && (
          <div className="skribbl-timer pixel">⏱ {secondsLeft}s</div>
        )}
      </div>

      <div className="findword-body">
        <div className="findword-main">
          <div className="fw-history" ref={historyRef}>
            {cv.history.length === 0 && (
              <div className="fw-empty hint">No attempts yet — think of a word your whole team would pick.</div>
            )}
            {cv.history.map((round, ri) => {
              const allSame =
                round.every((e) => e.word.toLowerCase() === round[0].word.toLowerCase() && e.word !== "—");
              return (
                <div key={ri} className={`fw-round${allSame ? " match" : ""}`}>
                  <div className="fw-round-no">#{ri + 1}</div>
                  <div className="fw-round-words">
                    {round.map((e) => (
                      <span key={e.playerId} className="fw-chip" style={{ borderColor: e.color }}>
                        <b style={{ color: e.color }}>{e.nickname}</b> {e.word.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {cv.finished ? (
            <div className="fw-done">
              {cv.convergedWord ? (
                <>
                  🎉 Converged on <b>{cv.convergedWord.toUpperCase()}</b> in {cv.attempts}{" "}
                  {cv.attempts === 1 ? "attempt" : "attempts"}! Waiting for other teams…
                </>
              ) : (
                <>Out of attempts — waiting for other teams…</>
              )}
            </div>
          ) : (
            <div className="fw-input-row">
              <input
                type="text"
                placeholder={cv.mySubmitted ? "Locked in — waiting…" : "Your word…"}
                value={cv.mySubmitted ? (cv.myWord ?? "") : word}
                maxLength={20}
                disabled={!canSubmit}
                onChange={(e) => setWord(e.target.value.replace(/[^a-zA-Zäöüßáéíóúàèìòùâêîôû]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button className="btn pink" disabled={!canSubmit} onClick={submit}>
                {cv.mySubmitted ? "Locked" : "Submit"}
              </button>
            </div>
          )}
          {msg && <div className="fw-msg">{msg}</div>}
          {!cv.finished && (
            <div className="fw-waiting hint">
              {cv.waitingOn.length === 0
                ? "All in — revealing…"
                : `Waiting on: ${cv.waitingOn.map(nameOf).join(", ")}`}
            </div>
          )}
        </div>

        <div className="findword-side">
          <div className="fw-side-title pixel">Teams</div>
          {cv.teams.map((t) => (
            <div
              key={t.teamId}
              className={`fw-team${t.teamId === cv.teamId ? " mine" : ""}${t.done ? " done" : ""}`}
            >
              <span className="swatch" style={{ background: t.color }} />
              <span className="fw-team-name">{t.name}</span>
              <span className="fw-team-attempts">
                {t.done ? `${t.attempts} ✓` : `#${t.attempts}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
