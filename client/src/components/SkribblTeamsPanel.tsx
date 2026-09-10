import { useEffect, useRef, useState } from "react";
import type { SkribblSegment } from "@marvinho/shared";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { SkribblCanvas } from "./SkribblCanvas.js";

const COLORS = ["#0d0b22", "#e6394b", "#3aa0ff", "#42d17a", "#ffd23f", "#ff8c42", "#b06bff", "#ffffff"];
const SIZES = [3, 7, 14];

export function SkribblTeamsPanel({ seat }: { seat: SeatState }) {
  const cv = seat.skribblTeams;
  const net = store.net(seat.id);
  const [color, setColor] = useState("#0d0b22");
  const [width, setWidth] = useState(7);
  const [guess, setGuess] = useState("");
  const [closeMsg, setCloseMsg] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [cv?.chat.length]);

  if (!cv) {
    return (
      <div className="center-stage">
        <div className="panel"><h2 className="pixel">Setting up Skribbl Teams…</h2></div>
      </div>
    );
  }

  const drawable = cv.isDrawer && cv.phase === "drawing";
  const canGuess = !cv.isDrawer && !cv.iGuessed && cv.phase === "drawing";
  const secondsLeft = Math.max(0, Math.ceil((cv.endsAt - Date.now()) / 1000));

  function onSegment(seg: SkribblSegment) {
    net?.skribblTeamsDraw(seg);
    store.addSkribblStroke(seat.id, seg);
  }
  function clearCanvas() {
    store.clearSkribblStrokes(seat.id);
    net?.skribblTeamsClear();
  }
  function flashClose(text: string) {
    setCloseMsg(`"${text}" is close! 🔥`);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setCloseMsg(null), 3000);
  }

  async function submitGuess() {
    const text = guess.trim();
    if (!text || !net) return;
    setGuess("");
    try {
      const res = await net.skribblTeamsGuess(text);
      if (!res.correct && res.close) flashClose(text);
      else if (res.correct) setCloseMsg(null);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="skribbl-wrap">
      <div className="skribbl-top">
        <div className="skribbl-round pixel">
          Round {cv.round}/{cv.totalRounds}
        </div>
        <div className="skribbl-word">
          {cv.isDrawer ? (
            <>Draw: <b>{cv.word?.toUpperCase()}</b></>
          ) : cv.phase !== "drawing" && cv.reveal ? (
            <>Word: <b style={{ color: "var(--good)" }}>{cv.reveal.toUpperCase()}</b></>
          ) : (
            <span className="skribbl-mask">
              {[...cv.maskedWord].map((ch, i) =>
                ch === " " ? (
                  <span key={i} className="mask-gap" />
                ) : (
                  <span key={i} className={`mask-ch${ch === "-" ? " dash" : ""}`}>{ch}</span>
                ),
              )}
            </span>
          )}
        </div>
        {(seat.lobby?.settings.games.skribblteams?.timerEnabled ?? true) && (
          <div className="skribbl-timer pixel">⏱ {secondsLeft}s</div>
        )}
      </div>

      <div className="skribbl-role hint">
        <span className="team-tag" style={{ background: cv.teamColor }}>{cv.teamName}</span>{" "}
        {cv.isDrawer
          ? "— you are drawing for your team! ✏️"
          : cv.iGuessed
            ? "— you guessed it! 🎉"
            : `— ${cv.drawerNickname} is drawing, guess the word!`}
      </div>

      <div className="skribbl-body">
        <div className="skribbl-canvas-col">
          <div className="skribbl-canvas-frame">
            <SkribblCanvas
              strokes={seat.skribblStrokes}
              drawable={drawable}
              color={color}
              width={width}
              onSegment={onSegment}
            />
            {cv.phase !== "drawing" && (
              <div className="skribbl-reveal">
                The word was <span>{(cv.reveal ?? "").toUpperCase()}</span>
              </div>
            )}
          </div>

          {cv.isDrawer && (
            <div className="skribbl-tools">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`sw${color === c ? " on" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`color ${c}`}
                />
              ))}
              <span className="skribbl-sep" />
              {SIZES.map((sz) => (
                <button
                  key={sz}
                  className={`sizebtn${width === sz ? " on" : ""}`}
                  onClick={() => setWidth(sz)}
                >
                  <span style={{ width: sz + 2, height: sz + 2 }} />
                </button>
              ))}
              <span className="skribbl-sep" />
              <button className="mini-btn" onClick={clearCanvas}>Clear</button>
            </div>
          )}
        </div>

        <div className="skribbl-side">
          <div className="skribbl-scores">
            {cv.teams.map((t) => (
              <div
                key={t.teamId}
                className={`skribbl-score${t.teamId === cv.teamId ? " correct" : ""}`}
              >
                <span className="swatch" style={{ background: t.color }} />
                <span className="sk-nick">
                  {t.name}
                  {t.solvedThisRound ? " ✅" : ""}
                </span>
                <span className="sk-pts">{t.solvedCount}</span>
              </div>
            ))}
          </div>

          <div className="skribbl-chat" ref={chatRef}>
            {cv.chat.map((m) => (
              <div key={m.id} className={`chat-msg ${m.kind}`}>
                {m.kind === "guess" ? (
                  <>
                    <b style={{ color: m.color }}>{m.nickname}:</b> {m.text}
                  </>
                ) : (
                  m.text
                )}
              </div>
            ))}
          </div>

          {closeMsg && <div className="skribbl-close">{closeMsg}</div>}
          <div className="skribbl-guess">
            <input
              type="text"
              placeholder={canGuess ? "Type your guess…" : cv.isDrawer ? "You're drawing" : "…"}
              value={guess}
              maxLength={40}
              disabled={!canGuess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitGuess()}
            />
            <button className="btn pink" disabled={!canGuess} onClick={submitGuess}>
              Guess
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
