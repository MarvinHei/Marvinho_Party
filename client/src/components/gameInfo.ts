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
  tango: "🪐",
  guesscountry: "🌍",
  travle: "🧭",
  pong: "🏓",
  verstecken: "🫥",
  battle: "🔫",
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
  guesscountry: "#42d17a",
  travle: "#28e0d0",
  pong: "#ffd23f",
  verstecken: "#b06bff",
  battle: "#ff8c42",
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
  guesscountry: {
    tagline: "Name the country from its shape.",
    rules: [
      "A country's silhouette appears — type its name and guess.",
      "A wrong guess shows the distance and a direction arrow (a left arrow means the answer lies to the east).",
      "Identify it in the fewest guesses to win.",
    ],
  },
  travle: {
    tagline: "Connect two countries across the map.",
    rules: [
      "You're given a start (A) and an end (B) country on the globe.",
      "Name the countries you'd cross to link them by land borders — they can be named in any order.",
      "Bridge them using the fewest countries to win.",
    ],
  },
  pong: {
    tagline: "Classic 1v1 Pong — first to the target wins.",
    rules: [
      "Move your paddle by moving the mouse up and down.",
      "The ball speeds up every time it's hit — don't miss.",
      "Players are paired into duels; an odd one out faces a CPU.",
    ],
  },
  verstecken: {
    tagline: "Hide from the seeker — or be the seeker and hunt.",
    rules: [
      "Move with WASD / arrow keys around the map.",
      "Hiders get a head start to find cover; then the seeker is released.",
      "The seeker only sees nearby hiders and catches them with a click (stab).",
    ],
  },
  battle: {
    tagline: "Free-for-all shootout — last one standing wins.",
    rules: [
      "Move with WASD / arrow keys; aim with the mouse.",
      "Click to fire your pistol — one hit eliminates a player.",
      "Use the walls for cover. Outlast everyone to win.",
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
