import { useEffect, useState } from "react";
import type { MinigameType } from "@marvinho/shared";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { gameInfo } from "./gameInfo.js";
import { EXPLAIN_PAGES } from "./explainPages.js";
import { GameArt, Keys } from "./explainArt.js";

/**
 * Pre-game explanation screen (host-enabled). A multi-page, illustrated
 * walkthrough of the chosen minigame — goal, controls and scoring — that you
 * flip through with the chevrons. The start stays gated behind a ready vote
 * (host can skip with "Start now").
 */
export function ExplanationScreen({ seat, game }: { seat: SeatState; game: MinigameType }) {
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const info = gameInfo(game);
  const pages = EXPLAIN_PAGES[game];
  const lobby = seat.lobby;
  const net = store.net(seat.id);
  const me = lobby?.players.find((p) => p.id === seat.playerId);
  const isHost = me?.isHost ?? false;
  const iAmReady = me?.ready ?? false;
  const connected = lobby?.players.filter((p) => p.connected) ?? [];
  const readyCount = connected.filter((p) => p.ready).length;

  // Reset to the first page whenever the game changes.
  useEffect(() => setPage(0), [game]);

  const total = pages.length;
  const go = (d: number) => setPage((p) => Math.max(0, Math.min(total - 1, p + d)));

  // Flip pages with the arrow keys too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

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

  const p = pages[Math.min(page, total - 1)];

  return (
    <div className="overlay backdrop explain-overlay">
      <div className="explain-card wide" style={{ ["--accent-game" as string]: info.color }}>
        <div className="explain-head">
          <div className="explain-emoji" aria-hidden>{info.icon}</div>
          <div>
            <h2 className="pixel explain-title">{info.name}</h2>
            <p className="explain-tagline">{info.tagline}</p>
          </div>
        </div>

        <div className="explain-pager">
          <button
            className="explain-chevron"
            onClick={() => go(-1)}
            disabled={page === 0}
            aria-label="Previous page"
          >
            ‹
          </button>

          <div className="explain-page" key={page}>
            <GameArt art={p.art} color={info.color} icon={info.icon} />
            <div className="explain-page-body">
              <div className="explain-page-heading pixel">
                {p.heading} <span className="explain-page-num">{page + 1}/{total}</span>
              </div>
              {p.body.map((line, i) => (
                <p key={i} className="explain-line">{line}</p>
              ))}
              {p.controls && p.controls.length > 0 && (
                <div className="explain-controls">
                  {p.controls.map((c, i) => (
                    <div key={i} className="explain-control">
                      <div className="explain-control-keys"><Keys kind={c.keys} /></div>
                      <span className="explain-control-label">{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            className="explain-chevron"
            onClick={() => go(1)}
            disabled={page === total - 1}
            aria-label="Next page"
          >
            ›
          </button>
        </div>

        <div className="explain-dots">
          {pages.map((pg, i) => (
            <button
              key={i}
              className={`explain-dot${i === page ? " on" : ""}`}
              onClick={() => setPage(i)}
              title={pg.heading}
              aria-label={`Page ${i + 1}: ${pg.heading}`}
            />
          ))}
        </div>

        <div className="explain-ready">
          <div className="ready-dots">
            {connected.map((pl) => (
              <span
                key={pl.id}
                className={`ready-dot${pl.ready ? " on" : ""}`}
                style={{ background: pl.ready ? pl.color : "transparent", borderColor: pl.color }}
                title={`${pl.nickname}${pl.ready ? " (ready)" : ""}`}
              />
            ))}
          </div>
          <div className="ready-count pixel">{readyCount}/{connected.length} ready</div>
        </div>

        <div className="explain-actions">
          <button
            className={`btn wide ${iAmReady ? "secondary" : "pink"}`}
            disabled={busy}
            onClick={toggleReady}
          >
            {iAmReady ? "Ready — waiting…" : "I'm Ready!"}
          </button>
          {isHost && (
            <button className="btn" onClick={startNow} title="Skip the vote and start now">
              Start now →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
