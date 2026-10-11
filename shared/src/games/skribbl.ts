// Skribbl.

/** One drawn line segment, coordinates normalized to 0..1. */
export interface SkribblSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  /** When true, this op is a flood fill starting at (x0,y0) with `color`. */
  fill?: boolean;
}

export type SkribblChatKind = "guess" | "system" | "correct";

export interface SkribblChatMessage {
  id: number;
  kind: SkribblChatKind;
  text: string;
  nickname?: string;
  color?: string;
}

export interface SkribblScore {
  playerId: string;
  nickname: string;
  color: string;
  points: number;
}

export type SkribblPhase = "drawing" | "turnEnd";

/** Per-player Skribbl view. The real word is included only for the drawer. */
export interface SkribblView {
  round: number;
  totalRounds: number;
  drawerId: string;
  drawerNickname: string;
  isDrawer: boolean;
  /** The word — only for the drawer. */
  word: string | null;
  /** Masked display for guessers (e.g. "_ _ _ _ _"), revealing length/spaces. */
  maskedWord: string;
  endsAt: number;
  phase: SkribblPhase;
  /** Has the viewing player guessed correctly this turn? */
  iGuessed: boolean;
  correctIds: string[];
  chat: SkribblChatMessage[];
  scores: SkribblScore[];
  /** The word, revealed during the turn-end pause. */
  reveal: string | null;
}
