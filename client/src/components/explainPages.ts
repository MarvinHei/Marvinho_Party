import type { MinigameType } from "@marvinho/shared";

// ===========================================================================
// Data for the illustrated, multi-page pre-game explanations. Each page has a
// heading, an illustration (a scene OR a parametrized grid), body text and
// optional illustrated control rows. The renderer lives in explainArt.tsx.
// ===========================================================================

/** A fixed SVG scene illustration. */
export type SceneKind =
  | "hero"
  | "wordleTiles"
  | "wordle2"
  | "map"
  | "draw"
  | "teams"
  | "codenamesGrid"
  | "pong"
  | "runner"
  | "runnerObs"
  | "hide"
  | "hideBlink"
  | "battle"
  | "tetris"
  | "tetrisClear"
  | "car"
  | "dodge"
  | "podium";

/** A glyph drawn on a grid cell. `n1`..`n9` render as a centred digit. */
export type CellMark = "queen" | "x" | "planet" | "star" | "dot" | "head";
/** A translucent highlight overlaid on a cell. */
export type TintKind = "block" | "good" | "bad" | "focus" | "dim";

export interface Cell {
  region?: number;
  fill?: string;
  mark?: CellMark;
  tint?: TintKind;
  /** Small centred text (e.g. a Sudoku digit or Zip order number). */
  label?: string;
}

export interface GridSpec {
  cols: number;
  rows: number;
  cells: Cell[];
  /** Draw a continuous line through these cell indices (Zip). */
  path?: number[];
  /** Adjacency constraints between two cells (Tango = / ×). */
  cons?: { a: number; b: number; kind: "eq" | "neq" }[];
  /** Draw thick borders where the region colour changes (Queens/Sudoku boxes). */
  regionBorders?: boolean;
  caption?: string;
}

export type ArtSpec = { scene: SceneKind } | { grid: GridSpec };

/** Which control diagram a hint shows. */
export type KeysKind =
  | "wasd"
  | "arrows"
  | "runnerkeys"
  | "lr"
  | "space"
  | "enter"
  | "mouse"
  | "click"
  | "dblclick"
  | "rightclick"
  | "drag"
  | "type"
  | "digits"
  | "swipe"
  | "ekey";

export interface ControlHint {
  keys: KeysKind;
  label: string;
}

export interface ExplainPage {
  heading: string;
  art: ArtSpec;
  body: string[];
  controls?: ControlHint[];
}

const s = (scene: SceneKind): ArtSpec => ({ scene });

/** Build a GridSpec from compact sparse maps. `regions` is a digit-per-cell
 *  string (whitespace ignored). */
function grid(
  cols: number,
  rows: number,
  o: {
    regions?: string;
    marks?: Record<number, CellMark>;
    tints?: Record<number, TintKind>;
    labels?: Record<number, string>;
    path?: number[];
    cons?: { a: number; b: number; kind: "eq" | "neq" }[];
    regionBorders?: boolean;
    caption?: string;
  },
): ArtSpec {
  const reg = o.regions?.replace(/\s+/g, "");
  const cells: Cell[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const c: Cell = {};
    if (reg && i < reg.length) c.region = Number(reg[i]);
    if (o.marks && o.marks[i] !== undefined) c.mark = o.marks[i];
    if (o.tints && o.tints[i] !== undefined) c.tint = o.tints[i];
    if (o.labels && o.labels[i] !== undefined) c.label = o.labels[i];
    cells.push(c);
  }
  return { grid: { cols, rows, cells, path: o.path, cons: o.cons, regionBorders: o.regionBorders, caption: o.caption } };
}

// --- shared building blocks -------------------------------------------------

// A hand-designed, valid 5×5 Queens layout (one crown per colour region).
const Q_REGIONS = "00111 00112 03312 33442 34442";
const Q_SOLUTION = { 0: "queen", 8: "queen", 11: "queen", 19: "queen", 22: "queen" } as Record<number, CellMark>;

const SCORING_TOPTHREE: ExplainPage = {
  heading: "Scoring",
  art: s("podium"),
  body: [
    "The three fastest solvers move forward on the party board — 3, 2 then 1 tile.",
    "Everyone else (and anyone who doesn't finish) stays put. First to the end of the board wins the match.",
    "Solved and out early? Click a rival to watch their screen while the round finishes.",
  ],
};

/**
 * Rich, multi-page explanations shown before each minigame. Puzzles get a
 * step-by-step illustrated rule breakdown; every game ends on how it's scored.
 */
export const EXPLAIN_PAGES: Record<MinigameType, ExplainPage[]> = {
  // ---- QUEENS -------------------------------------------------------------
  queens: [
    {
      heading: "The goal",
      art: grid(5, 5, { regions: Q_REGIONS, marks: Q_SOLUTION, tints: { 0: "good", 8: "good", 11: "good", 19: "good", 22: "good" }, regionBorders: true, caption: "exactly one 👑 in every colour region" }),
      body: [
        "Place one crown 👑 on the board for every colour region — no more, no less.",
        "A finished board has exactly one crown in each colour, and they never fight (see the next pages).",
      ],
    },
    {
      heading: "One per line",
      art: grid(5, 5, { regions: Q_REGIONS, marks: { 12: "queen" }, tints: { 10: "block", 11: "block", 13: "block", 14: "block", 2: "block", 7: "block", 17: "block", 22: "block" }, regionBorders: true, caption: "its row and column are now off-limits" }),
      body: [
        "A crown rules its whole row and its whole column.",
        "No second crown may share that row or column — the red squares are blocked by the crown in the middle.",
      ],
    },
    {
      heading: "No touching",
      art: grid(5, 5, { regions: Q_REGIONS, marks: { 12: "queen" }, tints: { 6: "block", 7: "block", 8: "block", 11: "block", 13: "block", 16: "block", 17: "block", 18: "block" }, regionBorders: true, caption: "the 8 neighbours are blocked too" }),
      body: [
        "Crowns also can't stand next to each other — not even diagonally.",
        "So every crown blocks the eight squares that touch it, on top of its row and column.",
      ],
    },
    {
      heading: "A clash",
      art: grid(5, 5, { regions: Q_REGIONS, marks: { 12: "queen", 18: "queen" }, tints: { 12: "bad", 18: "bad" }, regionBorders: true, caption: "diagonal neighbours — not allowed" }),
      body: [
        "These two crowns sit corner-to-corner, so they clash and glow red.",
        "The board tells you the moment two crowns share a row, column, colour or touch — fix the red ones.",
      ],
    },
    {
      heading: "Controls",
      art: grid(5, 5, { regions: Q_REGIONS, marks: { 2: "x", 3: "x", 7: "x", 8: "queen" }, tints: { 8: "focus" }, regionBorders: true, caption: "✕ = 'can't be here' · 👑 = a crown" }),
      body: [
        "Click a square once to drop an ✕ (a note to yourself that a crown can't go there).",
        "Click the same square again to turn the ✕ into a crown 👑; click a third time to clear it.",
        "Hold and drag to sweep ✕'s across many squares at once.",
      ],
      controls: [
        { keys: "click", label: "Click: ✕ → 👑 → clear" },
        { keys: "drag", label: "Drag to paint ✕'s" },
      ],
    },
    SCORING_TOPTHREE,
  ],

  // ---- ZIP ----------------------------------------------------------------
  zip: [
    {
      heading: "The goal",
      art: grid(5, 5, { labels: { 0: "1", 4: "2", 24: "3", 20: "4", 12: "5" }, path: [0, 1, 2, 3, 4], tints: { 4: "focus" }, caption: "draw ONE line: 1 → 2 → 3 → 4 → 5" }),
      body: [
        "Draw a single line that visits the numbers in order: start on 1, then reach 2, then 3, and so on.",
        "The line has started here from 1 and reached 2 along the top row.",
      ],
    },
    {
      heading: "Fill everything",
      art: grid(5, 5, { labels: { 0: "1", 24: "5" }, path: [0, 1, 2, 3, 4, 9, 8, 7, 6, 5, 10, 11, 12, 13, 14, 19, 18, 17, 16, 15, 20, 21, 22, 23, 24], caption: "every square is used exactly once" }),
      body: [
        "The line must also pass through every single square — no gaps left over.",
        "So it snakes around, filling the whole grid on its way from the first number to the last.",
      ],
    },
    {
      heading: "Step by step",
      art: grid(5, 5, { marks: { 12: "head" }, tints: { 12: "focus", 7: "good", 11: "good", 13: "good", 17: "good", 6: "bad", 8: "bad", 16: "bad", 18: "bad" }, caption: "green = allowed · red = too far" }),
      body: [
        "From the tip of your line you can only step to a square that shares an edge — up, down, left or right.",
        "You can't jump diagonally (red) or skip over a square.",
      ],
    },
    {
      heading: "Controls",
      art: grid(5, 5, { labels: { 0: "1", 4: "2" }, path: [0, 1, 2], marks: { 2: "head" }, tints: { 2: "focus" }, caption: "drag out from 1 · tap a square to rewind" }),
      body: [
        "Press on the 1 and drag to trail the line out square by square (swipe works on a phone).",
        "Tap a square already on the line to rewind back to it, or hit Reset to start over.",
      ],
      controls: [
        { keys: "drag", label: "Drag to draw the line" },
        { keys: "swipe", label: "Swipe on touch screens" },
      ],
    },
    SCORING_TOPTHREE,
  ],

  // ---- MINI-SUDOKU --------------------------------------------------------
  sudoku: [
    {
      heading: "The goal",
      art: grid(6, 6, {
        regions: "000111 000111 222333 222333 444555 444555",
        labels: { 0: "5", 4: "2", 8: "3", 13: "6", 16: "4", 21: "1", 27: "2", 31: "5", 34: "6" },
        regionBorders: true,
        caption: "fill every empty square with 1–6",
      }),
      body: [
        "A compact 6×6 sudoku. Some squares start filled — you complete the rest with the digits 1 to 6.",
        "The three rules on the next pages decide where each digit can go.",
      ],
    },
    {
      heading: "Every row",
      art: grid(6, 6, {
        regions: "000111 000111 222333 222333 444555 444555",
        labels: { 12: "1", 13: "2", 14: "3", 15: "4", 16: "5", 17: "6" },
        tints: { 12: "focus", 13: "focus", 14: "focus", 15: "focus", 16: "focus", 17: "focus" },
        regionBorders: true,
        caption: "each row holds 1–6, once each",
      }),
      body: ["Across every row, the digits 1 to 6 each appear exactly once — no repeats."],
    },
    {
      heading: "Every column",
      art: grid(6, 6, {
        regions: "000111 000111 222333 222333 444555 444555",
        labels: { 1: "1", 7: "2", 13: "3", 19: "4", 25: "5", 31: "6" },
        tints: { 1: "focus", 7: "focus", 13: "focus", 19: "focus", 25: "focus", 31: "focus" },
        regionBorders: true,
        caption: "…and each column, once each",
      }),
      body: ["The same is true down every column: 1 to 6, each exactly once."],
    },
    {
      heading: "Every box",
      art: grid(6, 6, {
        regions: "000111 000111 222333 222333 444555 444555",
        labels: { 0: "1", 1: "2", 2: "3", 6: "4", 7: "5", 8: "6" },
        tints: { 0: "focus", 1: "focus", 2: "focus", 6: "focus", 7: "focus", 8: "focus" },
        regionBorders: true,
        caption: "…and each bordered 2×3 box",
      }),
      body: ["Finally, each bold 2×3 box also contains 1 to 6 once. Balance all three rules to solve it."],
    },
    {
      heading: "Controls",
      art: grid(6, 6, {
        regions: "000111 000111 222333 222333 444555 444555",
        labels: { 14: "4" },
        tints: { 14: "focus" },
        regionBorders: true,
        caption: "click a square, then press a number",
      }),
      body: [
        "Click an empty square to select it, then press a key 1–6 to drop that digit in.",
        "Backspace clears the selected square. Given (starting) digits can't be changed.",
      ],
      controls: [
        { keys: "click", label: "Select a square" },
        { keys: "digits", label: "Type 1–6 · Backspace clears" },
      ],
    },
    SCORING_TOPTHREE,
  ],

  // ---- TANGO --------------------------------------------------------------
  tango: [
    {
      heading: "The goal",
      art: grid(4, 4, {
        marks: { 0: "planet", 1: "star", 2: "planet", 3: "star", 4: "star", 5: "planet", 6: "star", 7: "planet", 8: "planet", 9: "star", 10: "star", 11: "planet", 12: "star", 13: "planet", 14: "planet", 15: "star" },
        caption: "fill every square with 🪐 or ⭐",
      }),
      body: [
        "Fill the whole grid with two symbols — 🪐 and ⭐. Some squares are given to start.",
        "Two simple rules and a couple of clues decide the rest.",
      ],
    },
    {
      heading: "Keep it even",
      art: grid(4, 4, {
        marks: { 0: "planet", 1: "star", 2: "planet", 3: "star" },
        tints: { 0: "focus", 1: "focus", 2: "focus", 3: "focus" },
        caption: "two of each in every row and column",
      }),
      body: ["Every row and every column must hold the same number of 🪐 and ⭐ — here, two of each."],
    },
    {
      heading: "No three in a row",
      art: grid(4, 4, {
        marks: { 0: "planet", 1: "planet", 2: "planet", 3: "star" },
        tints: { 0: "bad", 1: "bad", 2: "bad" },
        caption: "three 🪐 in a row is not allowed",
      }),
      body: ["You can never place three of the same symbol in a row or column — a run of three glows red."],
    },
    {
      heading: "The clues",
      art: grid(4, 4, {
        marks: { 0: "planet", 1: "planet", 2: "star", 3: "planet" },
        cons: [{ a: 0, b: 1, kind: "eq" }, { a: 2, b: 3, kind: "neq" }],
        caption: "= same neighbour · × different",
      }),
      body: [
        "A = between two squares means they hold the SAME symbol.",
        "A × means they must be DIFFERENT. Use these to work out the tricky squares.",
      ],
    },
    {
      heading: "Controls",
      art: grid(4, 4, { marks: { 5: "planet" }, tints: { 5: "focus" }, caption: "click to cycle 🪐 → ⭐ → empty" }),
      body: ["Click a square to cycle it: empty → 🪐 → ⭐ → empty. Given squares stay locked."],
      controls: [{ keys: "click", label: "Click: 🪐 → ⭐ → empty" }],
    },
    SCORING_TOPTHREE,
  ],

  // ---- WORDLE -------------------------------------------------------------
  wordle: [
    {
      heading: "The goal",
      art: s("wordleTiles"),
      body: ["Everyone races to crack the same hidden 5-letter word. Type a guess and the tiles tell you how close you were."],
    },
    {
      heading: "Reading the clues",
      art: s("wordle2"),
      body: [
        "Green = right letter in the right spot.",
        "Yellow = the letter is in the word, but somewhere else.",
        "Grey = that letter isn't in the word at all. Use the clues to narrow it down.",
      ],
    },
    {
      heading: "Controls",
      art: s("wordleTiles"),
      body: ["Type any real 5-letter word and press Enter to lock in a guess. You get six tries."],
      controls: [
        { keys: "type", label: "Type your guess" },
        { keys: "enter", label: "Submit it" },
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: [
        "The fastest solvers take 3 · 2 · 1 tiles; never solving it scores nothing.",
        "The clock speeds up: every time somebody solves it, the round timer shrinks — so keep moving.",
      ],
    },
  ],

  // ---- GUESS THE COUNTRY --------------------------------------------------
  guesscountry: [
    {
      heading: "The goal",
      art: s("map"),
      body: ["A country's outline appears with no name attached. Work out which country it is in as few guesses as you can."],
    },
    {
      heading: "Warmer, colder",
      art: s("map"),
      body: [
        "Each wrong guess is answered with a distance and an arrow pointing toward the real country.",
        "Follow the arrows and the distance shrinking to home in on the answer.",
      ],
      controls: [{ keys: "type", label: "Type a country name" }],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: [
        "Identify it in the fewest tries to place 3 · 2 · 1; never getting it scores nothing.",
        "The timer tightens each time someone solves it.",
      ],
    },
  ],

  // ---- TRAVLE -------------------------------------------------------------
  travle: [
    {
      heading: "The goal",
      art: s("map"),
      body: ["You're given a start country and an end country. Build a land route between them by naming the countries in between."],
    },
    {
      heading: "Building the chain",
      art: s("map"),
      body: [
        "Name any country and it lights up on the globe. Link neighbours together until the start and end are connected.",
        "Fewer countries used = a cleaner solve.",
      ],
      controls: [{ keys: "type", label: "Name a country" }],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: [
        "Connect the two ends with the fewest countries to place 3 · 2 · 1.",
        "Each time someone connects it, the timer tightens.",
      ],
    },
  ],

  // ---- CODENAMES ----------------------------------------------------------
  codenames: [
    {
      heading: "The goal",
      art: s("codenamesGrid"),
      body: ["Two teams share a 5×5 grid of words. Each team races to uncover all of its own secret agents — and to dodge the deadly assassin."],
    },
    {
      heading: "Two roles",
      art: s("teams"),
      body: [
        "Each team has one Spymaster who secretly sees which words belong to whom.",
        "The Spymaster gives a one-word clue and a number; their Operatives read it and pick words.",
      ],
    },
    {
      heading: "Controls",
      art: s("codenamesGrid"),
      body: [
        "Spymaster: type a clue word and how many cards it points to.",
        "Operatives: click the words you think are yours. Guess wrong and your turn ends — reveal the assassin and you lose on the spot.",
      ],
      controls: [
        { keys: "type", label: "Spymaster — type the clue" },
        { keys: "click", label: "Operatives — reveal a card" },
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: ["The whole winning team moves 2 tiles; the losing team gets nothing."],
    },
  ],

  // ---- SKRIBBL ------------------------------------------------------------
  skribbl: [
    {
      heading: "The goal",
      art: s("draw"),
      body: ["Players take turns drawing a secret word while everyone else races to guess it in the chat."],
    },
    {
      heading: "Controls",
      art: s("draw"),
      body: ["When it's your turn, hold the mouse to draw. Otherwise, type your guesses into the chat box as fast as you can."],
      controls: [
        { keys: "click", label: "Drawer — hold to draw" },
        { keys: "type", label: "Guessers — type a guess" },
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: [
        "Guess sooner for more points; the drawer scores when people guess their word.",
        "Each correct guess pulls the turn's clock in. Most points takes 3 · 2 · 1 tiles.",
      ],
    },
  ],

  // ---- SKRIBBL TEAMS ------------------------------------------------------
  skribblteams: [
    {
      heading: "The goal",
      art: s("teams"),
      body: ["Teams draw and guess at the same time. Every team gets the same word each round — be first to guess it."],
    },
    {
      heading: "Controls",
      art: s("draw"),
      body: ["Your team's drawer draws with the mouse; teammates type guesses. Only your own team sees your canvas."],
      controls: [
        { keys: "click", label: "Drawer — hold to draw" },
        { keys: "type", label: "Teammates — type a guess" },
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: ["The team that guesses the most words wins. Teams place 3 · 2 · 1; 4th and beyond get nothing."],
    },
  ],

  // ---- FIND THE WORD ------------------------------------------------------
  findword: [
    {
      heading: "The goal",
      art: s("teams"),
      body: ["A word-telepathy race: your whole team must secretly land on the exact same word — without saying it out loud."],
    },
    {
      heading: "How it works",
      art: s("teams"),
      body: [
        "Every round each teammate submits a word. If they don't all match, you see each other's words and try again — nudging toward a shared answer.",
      ],
      controls: [{ keys: "type", label: "Submit your word" }],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: ["Teams that converge in the fewest rounds place 3 · 2 · 1. With more than three teams, 4th and beyond get nothing."],
    },
  ],

  // ---- TETRIS -------------------------------------------------------------
  tetris: [
    {
      heading: "The goal",
      art: s("tetris"),
      body: ["Stack the falling blocks to fill complete rows. It's a versus match — outlast everyone else."],
    },
    {
      heading: "Controls",
      art: s("tetris"),
      body: ["Slide the piece left and right, rotate it, and soft-drop to send it down faster."],
      controls: [
        { keys: "lr", label: "Move left / right" },
        { keys: "wasd", label: "W rotate · S soft-drop" },
      ],
    },
    {
      heading: "Clear & attack",
      art: s("tetrisClear"),
      body: [
        "A full row vanishes and gives you space. Clearing several rows at once dumps 'garbage' rows onto a rival's board.",
        "Fill up to the top and you're knocked out.",
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: [
        "Survive longest and clear the most lines to place 3 · 2 · 1.",
        "Knocked out? Click a rival to watch their board while the match finishes.",
      ],
    },
  ],

  // ---- PONG ---------------------------------------------------------------
  pong: [
    {
      heading: "The goal",
      art: s("pong"),
      body: ["A classic 1v1 duel — everyone is paired off. First to the target score wins their match."],
    },
    {
      heading: "Controls",
      art: s("pong"),
      body: ["Move the mouse up and down to steer your paddle. Your own name always sits on your paddle's side of the court."],
      controls: [{ keys: "mouse", label: "Move to steer your paddle" }],
    },
    {
      heading: "Power-ups",
      art: s("pong"),
      body: [
        "Glowing pickups float on the court. Shoot the ball through one and whoever last hit the ball grabs it:",
        "⚡ Fast — your paddle rockets the ball back for a while.",
        "🤏 Shrink — your opponent's paddle shrinks for a while.",
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: ["Win your duel for 2 tiles; lose and you get nothing. No timer — play to the target score."],
    },
  ],

  // ---- HIDE N' SEEK -------------------------------------------------------
  verstecken: [
    {
      heading: "The goal",
      art: s("hide"),
      body: [
        "One player is the Seeker; everyone else hides in the maze.",
        "If any hider is still hidden when the timer runs out, the hiders win. The Seeker wins only by catching everyone first.",
      ],
    },
    {
      heading: "Move & hide",
      art: s("hide"),
      body: ["Everyone moves around the maze on foot. Use the walls as cover — and keep an eye on the Seeker's light."],
      controls: [{ keys: "wasd", label: "Move around the maze" }],
    },
    {
      heading: "The flashlight",
      art: s("hide"),
      body: [
        "The Seeker doesn't see the whole map — only a flashlight cone pointing toward their mouse (plus a small circle around themselves).",
        "Hiders: stay out of that beam. Seeker: sweep it to search.",
      ],
      controls: [
        { keys: "mouse", label: "Seeker — aim the flashlight" },
        { keys: "click", label: "Seeker — stab a nearby hider (or Space)" },
      ],
    },
    {
      heading: "Blink away",
      art: s("hideBlink"),
      body: [
        "Every 30 seconds each player can Blink — teleport to a spot they click.",
        "Hiders left-click to blink to safety; the Seeker right-clicks (or presses E). A radar ping also flashes the hiders' positions every few seconds.",
      ],
      controls: [
        { keys: "click", label: "Hider — blink to a spot" },
        { keys: "rightclick", label: "Seeker — blink (or E)" },
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: ["If any hider survives, every hider takes a tile. If the Seeker catches everyone, the Seeker takes 2 and the hiders get nothing."],
    },
  ],

  // ---- BATTLE ROYALE ------------------------------------------------------
  battle: [
    {
      heading: "The goal",
      art: s("battle"),
      body: ["A top-down free-for-all shooter. Use the walls for cover and be the last player standing — there's no timer."],
    },
    {
      heading: "Controls",
      art: s("battle"),
      body: ["Move with the keys, aim with the mouse, and click (or Space) to fire a shot."],
      controls: [
        { keys: "wasd", label: "Move" },
        { keys: "mouse", label: "Aim" },
        { keys: "click", label: "Shoot (or Space)" },
      ],
    },
    {
      heading: "Power-ups",
      art: s("battle"),
      body: [
        "Grab the power-ups that appear on the map:",
        "🔥 Autofire · ⚡ Speed boost · 🪃 Bouncing bullets that ricochet three times.",
      ],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: ["The last three standing place 3 · 2 · 1. Get eliminated and you can spectate the rest."],
    },
  ],

  // ---- RUNNER RUSH --------------------------------------------------------
  runner: [
    {
      heading: "The goal",
      art: s("runner"),
      body: [
        "An auto-scrolling survival race. The track drags left and speeds up relentlessly — don't get pushed off the left edge.",
        "No timer; it runs until one runner is left.",
      ],
    },
    {
      heading: "Controls",
      art: s("runnerObs"),
      body: [
        "Accelerate to pull ahead or brake to hold back. Jump over the obstacles on the ground, and duck under the ones hanging from above.",
      ],
      controls: [{ keys: "runnerkeys", label: "Run · brake · jump · duck" }],
    },
    {
      heading: "Shockwave",
      art: s("runner"),
      body: [
        "Every 5 seconds you can fire a shockwave that shoves nearby rivals — ideally into a hazard or off the screen.",
        "Watch the meter under your runner to see when it's ready.",
      ],
      controls: [{ keys: "space", label: "Shockwave (5s cooldown)" }],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: ["Survive longest / get the furthest to place 3 · 2 · 1."],
    },
  ],

  // ---- STERBEGELD ---------------------------------------------------------
  sterbegeld: [
    {
      heading: "The goal",
      art: s("car"),
      body: [
        "A split-screen game in two acts — you'll see everyone's screen at once, and the highest combined score across both acts wins.",
      ],
    },
    {
      heading: "Act 1 · DELA",
      art: s("car"),
      body: [
        "A car speeds toward you. Your score sits at 20,000 until you sign — then it bleeds away fast until the car hits.",
        "So sign as LATE as you dare. Sign too early and you leave points on the table; get hit before you sign and you score 0.",
      ],
      controls: [{ keys: "space", label: "Sign the contract" }],
    },
    {
      heading: "Act 2 · Wartezeit",
      art: s("dodge"),
      body: [
        "Then bars fall from the sky, each with a gap. Slide left and right to keep your character in the gap.",
        "It starts hard and keeps speeding up — the longer you survive, the more you score.",
      ],
      controls: [{ keys: "lr", label: "Dodge left / right" }],
    },
    {
      heading: "Scoring",
      art: s("podium"),
      body: [
        "Both acts add up to your total, and they're tuned to matter about equally — a great dodge can rescue a nervous signature.",
        "Highest total places 3 · 2 · 1.",
      ],
    },
  ],
};
