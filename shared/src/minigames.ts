// The minigame catalog.

export type MinigameType =
  | "wordle"
  | "codenames"
  | "skribbl"
  | "skribblteams"
  | "findword"
  | "tetris"
  | "zip"
  | "queens"
  | "sudoku"
  | "tango"
  | "guesscountry"
  | "travle"
  | "pong"
  | "verstecken"
  | "battle"
  | "runner"
  | "sterbegeld";

/** Human-facing names for the wheel and UI. */
export const MINIGAME_NAMES: Record<MinigameType, string> = {
  wordle: "Wordle Race",
  codenames: "Codenames",
  skribbl: "Skribbl",
  skribblteams: "Skribbl Teams",
  findword: "Find the Word",
  tetris: "Tetris",
  zip: "Zip",
  queens: "Queens",
  sudoku: "Mini-Sudoku",
  tango: "Tango",
  guesscountry: "Guess the Country",
  travle: "Travle",
  pong: "Pong",
  verstecken: "Hide n' Seek",
  battle: "Battle Royale",
  runner: "Runner Rush",
  sterbegeld: "Sterbegeld",
};
