import { useEffect, useState } from "react";
import {
  CODENAMES_SIZES,
  PONG_POINTS_OPTIONS,
  MINIGAME_NAMES,
  PUZZLE_DIFFICULTIES,
  PUZZLE_DIFFICULTY_LABELS,
  PUZZLE_GAME_LIST,
  TETRIS_ROWS_OPTIONS,
  TIMER_BOUNDS,
  type CodenamesSize,
  type LobbySettings,
  type MinigameType,
  type PuzzleDifficulty,
  type PuzzleGame,
} from "@marvinho/shared";
import { store } from "../state/store.js";
import type { SeatState } from "../state/types.js";
import { GAME_ICON } from "./gameInfo.js";
import { sfx } from "../audio/audio.js";

// Display order: puzzles, word games, team games, versus, arena, geography.
const GAME_ORDER: MinigameType[] = [
  "zip", "queens", "sudoku", "tango",
  "wordle", "skribbl", "skribblteams", "findword",
  "tetris", "codenames",
  "pong", "verstecken", "battle",
  "guesscountry", "travle",
];

const isPuzzle = (g: MinigameType): g is PuzzleGame =>
  (PUZZLE_GAME_LIST as string[]).includes(g);

export function LobbySettingsPanel({ seat, isHost }: { seat: SeatState; isHost: boolean }) {
  const lobby = seat.lobby;
  const net = store.net(seat.id);
  const serverSettings = lobby?.settings;
  // Collapsed by default so the lobby stays compact; expand to customize.
  const [expanded, setExpanded] = useState(false);

  // Local working copy so sliders/toggles feel instant; re-sync when the server
  // broadcasts a different set (e.g. another device, or our own echo).
  const [draft, setDraft] = useState<LobbySettings | null>(serverSettings ?? null);
  const serverKey = serverSettings ? JSON.stringify(serverSettings) : "";
  useEffect(() => {
    if (serverSettings) setDraft(serverSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  if (!draft || !lobby) return null;

  function commit(next: LobbySettings) {
    setDraft(next);
    if (isHost) net?.updateSettings(next).catch(() => { /* ignore */ });
  }

  function patchGame(game: MinigameType, patch: Partial<LobbySettings["games"][MinigameType]>) {
    commit({ ...draft!, games: { ...draft!.games, [game]: { ...draft!.games[game], ...patch } } });
  }

  const disabled = !isHost;
  const enabledCount = GAME_ORDER.filter((g) => draft.games[g].enabled).length;

  return (
    <div className="settings-panel">
      <button
        className="settings-toggle"
        onClick={() => { sfx("click"); setExpanded((v) => !v); }}
        aria-expanded={expanded}
      >
        <span className="pixel settings-title">⚙ Game settings</span>
        <span className="settings-summary">
          {enabledCount}/{GAME_ORDER.length} games · explanations {draft.explanations ? "on" : "off"}
        </span>
        <span className={`settings-chevron${expanded ? " open" : ""}`} aria-hidden>▾</span>
      </button>

      {!expanded ? null : (
        <>
          <label className={`switch-row${disabled ? " locked" : ""}`}>
            <span>Explanations before each game</span>
            <input
              type="checkbox"
              className="switch"
              checked={draft.explanations}
              disabled={disabled}
              onChange={(e) => { sfx("click"); commit({ ...draft, explanations: e.target.checked }); }}
            />
          </label>

          {!isHost && (
            <p className="hint" style={{ margin: "0 0 8px" }}>Only the host can change settings.</p>
          )}

          <div className="settings-grid">
        {GAME_ORDER.map((game) => {
          const gs = draft.games[game];
          const bounds = TIMER_BOUNDS[game];
          return (
            <div key={game} className={`game-card${gs.enabled ? "" : " off"}`}>
              <div className="game-card-head">
                <span className="game-card-icon" aria-hidden>{GAME_ICON[game]}</span>
                <span className="game-card-name">{MINIGAME_NAMES[game]}</span>
                <label className="game-enable" title={gs.enabled ? "Enabled" : "Blacklisted"}>
                  <input
                    type="checkbox"
                    className="switch small"
                    checked={gs.enabled}
                    disabled={disabled}
                    onChange={(e) => { sfx("click"); patchGame(game, { enabled: e.target.checked }); }}
                  />
                </label>
              </div>

              <div className="game-card-body">
                {/* Timer on/off (all games) */}
                <label className={`switch-row tight${disabled ? " locked" : ""}`}>
                  <span>Timer</span>
                  <input
                    type="checkbox"
                    className="switch small"
                    checked={gs.timerEnabled}
                    disabled={disabled}
                    onChange={(e) => { sfx("click"); patchGame(game, { timerEnabled: e.target.checked }); }}
                  />
                </label>

                {/* Timer duration slider (only games with a meaningful limit) */}
                {bounds && gs.timerEnabled && (
                  <div className="timer-row">
                    <input
                      type="range"
                      min={bounds.min}
                      max={bounds.max}
                      step={bounds.step}
                      value={gs.timerSeconds}
                      disabled={disabled}
                      onChange={(e) => patchGame(game, { timerSeconds: Number(e.target.value) })}
                    />
                    <span className="timer-val pixel">{gs.timerSeconds}s</span>
                  </div>
                )}

                {/* Puzzle difficulty */}
                {isPuzzle(game) && (
                  <div className="opt-row">
                    <span className="opt-label">Difficulty</span>
                    <div className="opt-btns">
                      {PUZZLE_DIFFICULTIES.map((d) => (
                        <button
                          key={d}
                          className={`opt-btn${draft.puzzleDifficulty[game] === d ? " on" : ""}`}
                          disabled={disabled}
                          onClick={() => {
                            sfx("click");
                            commit({
                              ...draft,
                              puzzleDifficulty: { ...draft.puzzleDifficulty, [game]: d as PuzzleDifficulty },
                            });
                          }}
                        >
                          {PUZZLE_DIFFICULTY_LABELS[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tetris board height */}
                {game === "tetris" && (
                  <div className="opt-row">
                    <span className="opt-label">Height</span>
                    <div className="opt-btns">
                      {TETRIS_ROWS_OPTIONS.map((r) => (
                        <button
                          key={r}
                          className={`opt-btn${draft.tetrisRows === r ? " on" : ""}`}
                          disabled={disabled}
                          onClick={() => { sfx("click"); commit({ ...draft, tetrisRows: r }); }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Codenames board size */}
                {game === "codenames" && (
                  <div className="opt-row">
                    <span className="opt-label">Board</span>
                    <div className="opt-btns">
                      {CODENAMES_SIZES.map((s) => (
                        <button
                          key={s}
                          className={`opt-btn${draft.codenamesSize === s ? " on" : ""}`}
                          disabled={disabled}
                          onClick={() => { sfx("click"); commit({ ...draft, codenamesSize: s as CodenamesSize }); }}
                        >
                          {s}×{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Travle: show outlines of not-yet-named countries */}
                {game === "travle" && (
                  <label className={`switch-row tight${disabled ? " locked" : ""}`}>
                    <span>Country outlines</span>
                    <input
                      type="checkbox"
                      className="switch small"
                      checked={draft.travleOutlines}
                      disabled={disabled}
                      onChange={(e) => { sfx("click"); commit({ ...draft, travleOutlines: e.target.checked }); }}
                    />
                  </label>
                )}

                {/* Pong: points to win */}
                {game === "pong" && (
                  <div className="opt-row">
                    <span className="opt-label">Play to</span>
                    <div className="opt-btns">
                      {PONG_POINTS_OPTIONS.map((p) => (
                        <button
                          key={p}
                          className={`opt-btn${draft.pongPoints === p ? " on" : ""}`}
                          disabled={disabled}
                          onClick={() => { sfx("click"); commit({ ...draft, pongPoints: p }); }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
