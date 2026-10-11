import type { MinigameType } from "@marvinho/shared";
import { createBattle } from "./battle.js";
import { createCodenames } from "./codenames.js";
import { createFindword } from "./findword.js";
import { createGuessCountry } from "./guessCountry.js";
import { createPong } from "./pong.js";
import { createPuzzle } from "./puzzle.js";
import { createRunner } from "./runner.js";
import { createSkribbl } from "./skribbl.js";
import { createSkribblTeams } from "./skribblTeams.js";
import { createSterbegeld } from "./sterbegeld.js";
import { createTetris } from "./tetris.js";
import { createTravle } from "./travle.js";
import type { MinigameFactory } from "./types.js";
import { createVerstecken } from "./verstecken.js";
import { createWordle } from "./wordle.js";

/** Every minigame the lobby can run. Adding a game = one entry here. */
export const MINIGAMES: { [G in MinigameType]: MinigameFactory<G> } = {
  wordle: createWordle,
  codenames: createCodenames,
  skribbl: createSkribbl,
  skribblteams: createSkribblTeams,
  findword: createFindword,
  tetris: createTetris,
  zip: createPuzzle,
  queens: createPuzzle,
  sudoku: createPuzzle,
  tango: createPuzzle,
  guesscountry: createGuessCountry,
  travle: createTravle,
  pong: createPong,
  verstecken: createVerstecken,
  battle: createBattle,
  runner: createRunner,
  sterbegeld: createSterbegeld,
};
