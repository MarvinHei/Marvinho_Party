import type { GameEventMsg, MinigameType } from "@marvinho/shared";
import type { SeatState } from "../state/types.js";
import { battleGame } from "./battle/index.js";
import { codenamesGame } from "./codenames/index.js";
import { findwordGame } from "./findword/index.js";
import { guessCountryGame, travleGame } from "./geo/index.js";
import { pongGame } from "./pong/index.js";
import { queensGame, sudokuGame, tangoGame, zipGame } from "./puzzles/index.js";
import { runnerGame } from "./runner/index.js";
import { skribblGame, skribblTeamsGame } from "./skribbl/index.js";
import { sterbegeldGame } from "./sterbegeld/index.js";
import { tetrisGame } from "./tetris/index.js";
import type { ActiveGame, ClientGameModule, ClientGameStates } from "./types.js";
import { versteckenGame } from "./verstecken/index.js";
import { wordleGame } from "./wordle/index.js";

/**
 * Every minigame client module, one folder per game under games/: its panel
 * plus how its state evolves. Adding a game = one folder + one entry here.
 */
export const CLIENT_GAMES: { [G in MinigameType]: ClientGameModule<G> } = {
  wordle: wordleGame,
  codenames: codenamesGame,
  skribbl: skribblGame,
  skribblteams: skribblTeamsGame,
  findword: findwordGame,
  tetris: tetrisGame,
  zip: zipGame,
  queens: queensGame,
  sudoku: sudokuGame,
  tango: tangoGame,
  guesscountry: guessCountryGame,
  travle: travleGame,
  pong: pongGame,
  verstecken: versteckenGame,
  battle: battleGame,
  runner: runnerGame,
  sterbegeld: sterbegeldGame,
};

// The registry is keyed by game, so a module only ever sees its own game's
// state and events; these helpers erase that pairing for the generic paths.
type AnyModule = ClientGameModule<MinigameType>;
const moduleFor = (type: MinigameType) => CLIENT_GAMES[type] as unknown as AnyModule;
const active = <G extends MinigameType>(type: G, state: ClientGameStates[G] | null) =>
  ({ type, state }) as ActiveGame;

/** A fresh game slot for a starting minigame. */
export function startGame(type: MinigameType): ActiveGame {
  return active(type, moduleFor(type).initial?.() ?? null);
}

/** Fold a server game event into the seat (ignored unless it's for the current game). */
export function applyGameEvent(seat: SeatState, msg: GameEventMsg): Partial<SeatState> {
  const g = seat.game;
  if (!g || g.type !== msg.game) return {};
  const event = { kind: msg.kind, payload: msg.payload } as never;
  return { game: active(g.type, moduleFor(g.type).reduce(g.state, event, seat)) };
}

/** The round's deadline moved. */
export function applyGameTimer(seat: SeatState, endsAt: number): Partial<SeatState> {
  const g = seat.game;
  const onTimer = g && moduleFor(g.type).onTimer;
  if (!g || !g.state || !onTimer) return {};
  return { game: active(g.type, onTimer(g.state, endsAt)) };
}

/** The round ended. */
export function applyGameEnded(seat: SeatState): Partial<SeatState> {
  const g = seat.game;
  const onEnded = g && moduleFor(g.type).onEnded;
  if (!g || !g.state || !onEnded) return {};
  return { game: active(g.type, onEnded(g.state)) };
}
