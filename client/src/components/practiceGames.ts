import type { MinigameType } from "@marvinho/shared";

export const PRACTICE_ICON: Record<MinigameType, string> = {
  wordle: "🔤",
  codenames: "🕵️",
  skribbl: "🎨",
  skribblteams: "🖌️",
  findword: "🧠",
  tetris: "🟦",
  zip: "🔢",
  queens: "👑",
  sudoku: "🧩",
  tango: "🪐",
  guesscountry: "🌍",
  travle: "🧭",
  pong: "🏓",
  verstecken: "🫥",
};

export const PRACTICE_ORDER: MinigameType[] = [
  "wordle", "zip", "queens", "sudoku", "tango", "skribbl",
  "skribblteams", "findword", "tetris", "codenames",
  "guesscountry", "travle", "pong", "verstecken",
];
