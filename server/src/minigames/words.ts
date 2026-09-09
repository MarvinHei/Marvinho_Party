// Curated 5-letter words. Used both as the answer pool and the accepted-guess
// dictionary for the vertical slice. Kept intentionally common/readable.
export const WORD_LIST: string[] = [
  "about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult",
  "after", "again", "agent", "agree", "ahead", "alarm", "album", "alert",
  "alike", "alive", "allow", "alone", "along", "alter", "among", "anger",
  "angle", "angry", "apart", "apple", "apply", "arena", "argue", "arise",
  "array", "aside", "asset", "audio", "audit", "avoid", "award", "aware",
  "badly", "baker", "bases", "basic", "beach", "began", "begin", "being",
  "below", "bench", "billy", "birth", "black", "blame", "blind", "block",
  "blood", "board", "boost", "booth", "bound", "brain", "brand", "bread",
  "break", "breed", "brief", "bring", "broad", "broke", "brown", "build",
  "built", "buyer", "cable", "calif", "carry", "catch", "cause", "chain",
  "chair", "chart", "chase", "cheap", "check", "chest", "chief", "child",
  "china", "chose", "civil", "claim", "class", "clean", "clear", "click",
  "climb", "clock", "close", "coach", "coast", "could", "count", "court",
  "cover", "craft", "crash", "cream", "crime", "cross", "crowd", "crown",
  "curve", "cycle", "daily", "dance", "dated", "dealt", "death", "debut",
  "delay", "depth", "doing", "doubt", "dozen", "draft", "drama", "drawn",
  "dream", "dress", "drill", "drink", "drive", "drove", "dying", "eager",
  "early", "earth", "eight", "elite", "empty", "enemy", "enjoy", "enter",
  "entry", "equal", "error", "event", "every", "exact", "exist", "extra",
  "faith", "false", "fault", "fiber", "field", "fifth", "fifty", "fight",
  "final", "first", "fixed", "flame", "flash", "fleet", "floor", "fluid",
  "focus", "force", "forth", "forty", "forum", "found", "frame", "frank",
  "fraud", "fresh", "front", "fruit", "fully", "funny", "ghost", "giant",
  "given", "glass", "globe", "going", "grace", "grade", "grand", "grant",
  "grass", "great", "green", "gross", "group", "grown", "guard", "guess",
  "guest", "guide", "happy", "harsh", "heart", "heavy", "hence", "horse",
  "hotel", "house", "human", "ideal", "image", "index", "inner", "input",
  "issue", "japan", "joint", "judge", "known", "label", "large", "laser",
  "later", "laugh", "layer", "learn", "lease", "least", "leave", "legal",
  "level", "light", "limit", "links", "lives", "local", "logic", "loose",
  "lower", "lucky", "lunch", "lying", "magic", "major", "maker", "march",
  "match", "maybe", "mayor", "meant", "media", "metal", "might", "minor",
  "minus", "mixed", "model", "money", "month", "moral", "motor", "mount",
  "mouse", "mouth", "movie", "music", "needs", "never", "newly", "night",
  "noise", "north", "noted", "novel", "nurse", "occur", "ocean", "offer",
  "often", "order", "other", "ought", "paint", "panel", "paper", "party",
  "peace", "phase", "phone", "photo", "piece", "pilot", "pitch", "place",
  "plain", "plane", "plant", "plate", "point", "pound", "power", "press",
  "price", "pride", "prime", "print", "prior", "prize", "proof", "proud",
  "prove", "queen", "quick", "quiet", "quite", "radio", "raise", "range",
  "rapid", "ratio", "reach", "ready", "refer", "right", "rival", "river",
  "roman", "rough", "round", "route", "royal", "rural", "scale", "scene",
  "scope", "score", "sense", "serve", "seven", "shall", "shape", "share",
  "sharp", "sheet", "shelf", "shell", "shift", "shirt", "shock", "shoot",
  "short", "shown", "sight", "since", "sixth", "sixty", "sized", "skill",
  "sleep", "slide", "small", "smart", "smile", "smith", "smoke", "solid",
  "solve", "sorry", "sound", "south", "space", "spare", "speak", "speed",
  "spend", "spent", "split", "spoke", "sport", "staff", "stage", "stake",
  "stand", "start", "state", "steam", "steel", "stick", "still", "stock",
  "stone", "stood", "store", "storm", "story", "strip", "stuck", "study",
  "stuff", "style", "sugar", "suite", "super", "sweet", "table", "taken",
  "taste", "taxes", "teach", "teeth", "terry", "texas", "thank", "theft",
  "their", "theme", "there", "these", "thick", "thing", "think", "third",
  "those", "three", "threw", "throw", "tight", "times", "tired", "title",
  "today", "topic", "total", "touch", "tough", "tower", "track", "trade",
  "train", "treat", "trend", "trial", "tried", "tries", "truck", "truly",
  "trust", "truth", "twice", "under", "undue", "union", "unity", "until",
  "upper", "upset", "urban", "usage", "usual", "valid", "value", "video",
  "virus", "visit", "vital", "voice", "waste", "watch", "water", "wheel",
  "where", "which", "while", "white", "whole", "whose", "woman", "women",
  "world", "worry", "worse", "worst", "worth", "would", "write", "wrong",
  "wrote", "young", "youth",
];

import { EXTRA_GUESSES } from "./wordleGuesses.js";

// Accepted guesses = curated answers + a large supplementary list (plurals,
// conjugations, extra vocabulary). Only exact 5-letter words are kept, so any
// stray wrong-length entries are harmlessly ignored.
const ACCEPTED = new Set(
  [...WORD_LIST, ...EXTRA_GUESSES]
    .map((w) => w.toLowerCase())
    .filter((w) => w.length === 5),
);

export function isValidWord(word: string): boolean {
  return ACCEPTED.has(word.toLowerCase());
}

// Answers are always drawn from the curated (common) list.
export function randomWord(): string {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}
