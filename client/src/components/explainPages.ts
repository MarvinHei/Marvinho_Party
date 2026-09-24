import type { MinigameType } from "@marvinho/shared";

/** Which scene illustration a page shows. */
export type ArtKind =
  | "hero"
  | "wordleTiles"
  | "grid"
  | "map"
  | "draw"
  | "teams"
  | "pong"
  | "runner"
  | "hide"
  | "battle"
  | "tetris"
  | "car"
  | "dodge"
  | "podium";

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
  | "rightclick"
  | "type"
  | "swipe"
  | "ekey";

export interface ControlHint {
  keys: KeysKind;
  label: string;
}

export interface ExplainPage {
  /** Short tab-style heading (Goal / Controls / Scoring …). */
  heading: string;
  art: ArtKind;
  /** A short paragraph plus any number of bullet lines. */
  body: string[];
  /** Illustrated control rows (optional). */
  controls?: ControlHint[];
}

const SCORING_TOPTHREE: ExplainPage = {
  heading: "Scoring",
  art: "podium",
  body: [
    "The top three finishers move forward on the board — 3, 2 then 1 tile.",
    "Everyone else stays put. First across the finish line wins the match.",
    "Out early? You can watch a rival's screen while you wait.",
  ],
};

/**
 * Rich, multi-page explanations shown before each minigame. Every game gets a
 * Goal page, a Controls page (with illustrated keys/mouse) and a Scoring page.
 */
export const EXPLAIN_PAGES: Record<MinigameType, ExplainPage[]> = {
  wordle: [
    {
      heading: "Goal",
      art: "wordleTiles",
      body: [
        "Race everyone to crack the same hidden 5-letter word.",
        "After each guess the tiles recolour: green = right letter in the right spot, yellow = right letter wrong spot, grey = not in the word at all.",
      ],
    },
    {
      heading: "Controls",
      art: "wordleTiles",
      body: ["Type a real 5-letter word and press Enter. You get six tries."],
      controls: [
        { keys: "type", label: "Type your guess" },
        { keys: "enter", label: "Submit the guess" },
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "The fastest solvers take 3 · 2 · 1 tiles; players who never solve it get nothing.",
        "The clock speeds up: every time someone solves it, the round's timer shrinks — so don't dawdle.",
      ],
    },
  ],
  codenames: [
    {
      heading: "Goal",
      art: "teams",
      body: [
        "Two teams race to find all of their own secret agents on a 5×5 grid of words — without hitting the assassin.",
      ],
    },
    {
      heading: "Roles",
      art: "teams",
      body: [
        "Each team has one Spymaster who alone sees which cards belong to whom.",
        "The Spymaster gives a one-word clue and a number; the Operatives pick the matching cards.",
      ],
    },
    {
      heading: "Controls",
      art: "teams",
      body: ["Spymaster: type a clue word + count. Operatives: click cards to reveal them."],
      controls: [
        { keys: "type", label: "Spymaster — type the clue" },
        { keys: "click", label: "Operatives — reveal a card" },
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "The whole winning team moves 2 tiles; the losing team gets nothing.",
        "Reveal the assassin and your team loses instantly — clue carefully!",
      ],
    },
  ],
  skribbl: [
    {
      heading: "Goal",
      art: "draw",
      body: [
        "Each player takes a turn drawing a secret word while everyone else races to guess it in the chat.",
      ],
    },
    {
      heading: "Controls",
      art: "draw",
      body: ["Drawer: hold the mouse to draw. Guessers: type guesses into the chat box."],
      controls: [
        { keys: "click", label: "Drawer — hold to draw" },
        { keys: "type", label: "Guessers — type a guess" },
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "Guess sooner for more points; the drawer scores when people guess their word.",
        "Each correct guess pulls the turn's timer in, so the window closes fast. Most points takes 3 · 2 · 1 tiles.",
      ],
    },
  ],
  skribblteams: [
    {
      heading: "Goal",
      art: "teams",
      body: [
        "Teams draw and guess at the same time. Every team draws the same word — first to guess each round pulls ahead.",
      ],
    },
    {
      heading: "Controls",
      art: "draw",
      body: ["Your team's drawer draws with the mouse; teammates type guesses. Only your team sees your canvas."],
      controls: [
        { keys: "click", label: "Drawer — hold to draw" },
        { keys: "type", label: "Teammates — type a guess" },
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "The team that guesses the most words wins.",
        "Teams place 3 · 2 · 1 by words guessed; 4th place and beyond get nothing.",
      ],
    },
  ],
  findword: [
    {
      heading: "Goal",
      art: "teams",
      body: [
        "A word-telepathy race: your whole team must land on the exact same secret word — without talking about it.",
      ],
    },
    {
      heading: "How it works",
      art: "teams",
      body: [
        "Everyone submits a word each round. If they don't all match, you see each other's words and try again — nudging toward a common answer.",
      ],
      controls: [{ keys: "type", label: "Submit your word" }],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "Teams that converge in the fewest rounds place highest (3 · 2 · 1).",
        "With more than three teams, 4th and beyond get nothing.",
      ],
    },
  ],
  tetris: [
    {
      heading: "Goal",
      art: "tetris",
      body: [
        "Stack the falling blocks to clear full lines. Clearing lines dumps garbage on a rival — be the last one standing.",
      ],
    },
    {
      heading: "Controls",
      art: "tetris",
      body: ["Move and rotate the falling piece; soft-drop to speed it down."],
      controls: [
        { keys: "lr", label: "Move left / right" },
        { keys: "wasd", label: "W rotate · S soft-drop" },
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "Survive longest and clear the most lines to place 3 · 2 · 1.",
        "Knocked out? Click a rival to watch their board while the match finishes.",
      ],
    },
  ],
  zip: [
    {
      heading: "Goal",
      art: "grid",
      body: ["Draw one continuous path that connects the numbers in order and fills every cell of the grid."],
    },
    {
      heading: "Controls",
      art: "grid",
      body: ["Click-drag (or swipe on a phone) from cell to cell to lay your path. It auto-submits when it's valid."],
      controls: [
        { keys: "click", label: "Drag to draw the path" },
        { keys: "swipe", label: "Swipe on touch screens" },
      ],
    },
    SCORING_TOPTHREE,
  ],
  queens: [
    {
      heading: "Goal",
      art: "grid",
      body: ["Place one crown in every row, every column and every colour region — and no two crowns may touch, even diagonally."],
    },
    {
      heading: "Controls",
      art: "grid",
      body: ["Click a cell to place or clear a crown (swipe-paint works on a phone). It auto-submits when solved."],
      controls: [
        { keys: "click", label: "Place / clear a crown" },
        { keys: "swipe", label: "Swipe on touch screens" },
      ],
    },
    SCORING_TOPTHREE,
  ],
  sudoku: [
    {
      heading: "Goal",
      art: "grid",
      body: ["Fill the grid so every row, column and box contains each number exactly once — a compact race-sudoku."],
    },
    {
      heading: "Controls",
      art: "grid",
      body: ["Click a cell, then pick a number. It auto-submits the moment the grid is correct."],
      controls: [{ keys: "click", label: "Select a cell + number" }],
    },
    SCORING_TOPTHREE,
  ],
  tango: [
    {
      heading: "Goal",
      art: "grid",
      body: [
        "Fill every cell with one of two symbols so each row and column has an equal number of both — with no three-in-a-row.",
      ],
    },
    {
      heading: "Controls",
      art: "grid",
      body: ["Click a cell to cycle its symbol; the = and × hints between cells must be respected. Auto-submits when solved."],
      controls: [{ keys: "click", label: "Cycle a cell's symbol" }],
    },
    SCORING_TOPTHREE,
  ],
  guesscountry: [
    {
      heading: "Goal",
      art: "map",
      body: ["A country's silhouette appears with no label — name it in as few guesses as you can."],
    },
    {
      heading: "Controls",
      art: "map",
      body: ["Type a country name. Each wrong guess shows how far and in which direction the real answer lies."],
      controls: [{ keys: "type", label: "Type a country" }],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "Identify it in the fewest tries to place 3 · 2 · 1. Never solving it scores nothing.",
        "The clock shrinks each time someone gets it — keep up.",
      ],
    },
  ],
  travle: [
    {
      heading: "Goal",
      art: "map",
      body: ["Connect a start country to an end country by naming the countries that form a land route between them."],
    },
    {
      heading: "Controls",
      art: "map",
      body: ["Type bordering countries to build the chain from one end to the other."],
      controls: [{ keys: "type", label: "Name a country" }],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "Connect the two ends with the fewest countries to place 3 · 2 · 1.",
        "Each time someone connects it, the timer tightens.",
      ],
    },
  ],
  pong: [
    {
      heading: "Goal",
      art: "pong",
      body: ["A classic 1v1 duel — everyone is paired off. First to the target score wins their match."],
    },
    {
      heading: "Controls",
      art: "pong",
      body: ["Move the mouse up and down to steer your paddle. Your name always sits on your paddle's side."],
      controls: [{ keys: "mouse", label: "Move to steer your paddle" }],
    },
    {
      heading: "Power-ups",
      art: "pong",
      body: [
        "Pickup fields float on the court. Shoot the ball through one and whoever last hit the ball grabs it:",
        "⚡ Fast — your paddle rockets the ball back for a while.",
        "🤏 Shrink — your opponent's paddle shrinks for a while.",
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: ["Win your duel for 2 tiles; lose and you get nothing. No timer — play to the target score."],
    },
  ],
  verstecken: [
    {
      heading: "Goal",
      art: "hide",
      body: [
        "One player is the Seeker; everyone else hides.",
        "If any hider is still hidden when the timer runs out, the hiders win. The Seeker wins only by catching everyone before then.",
      ],
    },
    {
      heading: "Move",
      art: "hide",
      body: ["Everyone moves around the maze on foot. The Seeker only sees a flashlight cone toward the mouse — stay out of the light."],
      controls: [
        { keys: "wasd", label: "Move around the maze" },
        { keys: "mouse", label: "Seeker — aim the flashlight" },
      ],
    },
    {
      heading: "Catch & Blink",
      art: "hide",
      body: [
        "Seeker: click or Space to stab a nearby hider. A radar ping reveals hiders every few seconds.",
        "Everyone can Blink to a clicked spot every 30 seconds — hiders left-click, the Seeker right-clicks (or press E).",
      ],
      controls: [
        { keys: "click", label: "Seeker — stab (or Space)" },
        { keys: "rightclick", label: "Blink to a spot (or E)" },
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "If any hider survives, every hider takes a tile. If the Seeker catches everyone, the Seeker takes 2 and the hiders get nothing.",
      ],
    },
  ],
  battle: [
    {
      heading: "Goal",
      art: "battle",
      body: ["A top-down free-for-all shooter. Use the walls for cover and be the last player standing. No timer."],
    },
    {
      heading: "Controls",
      art: "battle",
      body: ["Move with the keys, aim with the mouse, and click or Space to fire."],
      controls: [
        { keys: "wasd", label: "Move" },
        { keys: "mouse", label: "Aim" },
        { keys: "click", label: "Shoot (or Space)" },
      ],
    },
    {
      heading: "Power-ups",
      art: "battle",
      body: [
        "Grab power-ups that appear on the map:",
        "🔥 Autofire · ⚡ Speed boost · 🪃 Bouncing bullets (ricochet three times).",
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: ["Last three standing place 3 · 2 · 1. Get eliminated and you can spectate the rest."],
    },
  ],
  runner: [
    {
      heading: "Goal",
      art: "runner",
      body: [
        "An auto-scrolling survival race. The track speeds up relentlessly — keep pace and don't drift off the left edge.",
        "There's no timer; it runs until one runner is left.",
      ],
    },
    {
      heading: "Controls",
      art: "runner",
      body: ["Accelerate and brake to hold your spot; jump over ground hazards and duck under hanging ones."],
      controls: [
        { keys: "runnerkeys", label: "Run · brake · jump · duck" },
        { keys: "space", label: "Shockwave — shove rivals (5s)" },
      ],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: ["Survive longest / get furthest to place 3 · 2 · 1. Shove rivals into hazards or off the screen to thin the pack."],
    },
  ],
  sterbegeld: [
    {
      heading: "Goal",
      art: "car",
      body: [
        "A split-screen two-act game — everyone plays both acts and the highest combined score wins.",
        "You'll see every player's screen at once.",
      ],
    },
    {
      heading: "Act 1 · DELA",
      art: "car",
      body: [
        "A car accelerates toward you. Your score sits at 20,000 until you sign — then it bleeds away fast until the car hits.",
        "So sign as LATE as you dare. Get hit before you sign and you score 0.",
      ],
      controls: [{ keys: "space", label: "Sign the contract" }],
    },
    {
      heading: "Act 2 · Wartezeit",
      art: "dodge",
      body: [
        "Bars fall from the sky with a drifting gap. Slide left and right to stay in the gap.",
        "It starts hard and keeps speeding up — the longer you last, the more you score.",
      ],
      controls: [{ keys: "lr", label: "Dodge left / right" }],
    },
    {
      heading: "Scoring",
      art: "podium",
      body: [
        "Both acts add up to your total; highest total places 3 · 2 · 1.",
        "Both acts are tuned to matter about equally, so a great dodge can rescue a nervous signature.",
      ],
    },
  ],
};
