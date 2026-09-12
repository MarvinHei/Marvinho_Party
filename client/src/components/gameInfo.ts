import { MINIGAME_NAMES, type MinigameType } from "@marvinho/shared";

export const GAME_ICON: Record<MinigameType, string> = {
  wordle: "🔤",
  codenames: "🕵️",
  skribbl: "🎨",
  skribblteams: "🖌️",
  findword: "🧠",
  tetris: "🟦",
  zip: "🔢",
  queens: "👑",
  sudoku: "🧩",
  tango: "☀️",
};

export const GAME_COLOR: Record<MinigameType, string> = {
  wordle: "#42d17a",
  codenames: "#3aa0ff",
  skribbl: "#ff6fcf",
  skribblteams: "#b06bff",
  findword: "#28e0d0",
  tetris: "#e6394b",
  zip: "#ff8c42",
  queens: "#b06bff",
  sudoku: "#28e0d0",
  tango: "#ffd23f",
};

/** One-line tagline + how-to-play bullets for the explanation screen. */
export interface GameInfo {
  name: string;
  icon: string;
  color: string;
  tagline: string;
  rules: string[];
}

const RULES: Record<MinigameType, { tagline: string; rules: string[] }> = {
  wordle: {
    tagline: "Guess the 5-letter word fastest.",
    rules: [
      "Type a 5-letter word and press Enter to guess.",
      "Green = right letter & spot, yellow = right letter wrong spot, grey = not in the word.",
      "You have 6 tries — the fastest solvers earn the most tiles.",
    ],
  },
  codenames: {
    tagline: "Spymasters give one-word clues; teams find their agents.",
    rules: [
      "Each team's spymaster sees the secret colors and gives a one-word clue + a number.",
      "Teammates tap the words they think belong to their team.",
      "Avoid the assassin — hitting it loses the round instantly.",
    ],
  },
  skribbl: {
    tagline: "One player draws, everyone else guesses.",
    rules: [
      "The drawer gets a secret word and sketches it on the canvas.",
      "Everyone else types guesses — faster correct guesses score more.",
      "Letters are revealed over time as hints.",
    ],
  },
  skribblteams: {
    tagline: "Teams race to draw & guess the same word.",
    rules: [
      "Every team draws the same secret word at the same time.",
      "Guess within your team's chat — first teams to solve win the round.",
      "Rotate drawers each round.",
    ],
  },
  findword: {
    tagline: "Your team secretly converges on one word.",
    rules: [
      "Everyone on your team secretly submits a word (5+ letters).",
      "Words are revealed — try to think alike and land on the same word.",
      "The fewer attempts to converge, the better your team places.",
    ],
  },
  tetris: {
    tagline: "Last stack standing wins.",
    rules: [
      "Clear lines to send garbage rows to your target.",
      "Move with ←/→, rotate with ↑, soft drop ↓, hard drop Space, hold C.",
      "Get knocked out when your stack tops out — survive the longest.",
    ],
  },
  zip: {
    tagline: "Draw one path touching every cell in order.",
    rules: [
      "Start at 1 and connect the numbers in order.",
      "Your path must fill every cell exactly once.",
      "Drag across neighboring cells; the first to finish wins.",
    ],
  },
  queens: {
    tagline: "One crown per row, column and color region.",
    rules: [
      "Place exactly one queen in every row, column and colored region.",
      "No two queens may touch — not even diagonally.",
      "Tap to cycle empty → mark ✕ → queen.",
    ],
  },
  sudoku: {
    tagline: "Fill the grid — no repeats.",
    rules: [
      "Fill every row, column and box with the digits with no repeats.",
      "Tap a cell, then a number (or use your keyboard).",
      "Fastest correct solver wins the most tiles.",
    ],
  },
  tango: {
    tagline: "Balance planets and stars.",
    rules: [
      "Each row and column has equal 🪐 and ⭐.",
      "No more than two of the same symbol in a row.",
      "= means neighbors match, × means they differ.",
    ],
  },
};

export function gameInfo(game: MinigameType): GameInfo {
  return {
    name: MINIGAME_NAMES[game],
    icon: GAME_ICON[game],
    color: GAME_COLOR[game],
    ...RULES[game],
  };
}
