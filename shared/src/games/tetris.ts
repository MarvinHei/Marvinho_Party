// Tetris (real-time versus, garbage-sending).

export interface TetrisPlayerInfo {
  id: string;
  nickname: string;
  color: string;
}

/** A compact snapshot of one player's board for the spectator mini-views. */
export interface TetrisBoardSnapshot {
  playerId: string;
  /** rows*cols cells, top→bottom, left→right. "." = empty, else a piece key. */
  cells: string;
  /** Total lines this player has cleared. */
  lines: number;
  alive: boolean;
}

/** Sent when a Tetris match begins. */
export interface TetrisInitPayload {
  players: TetrisPlayerInfo[];
  /** Shared RNG seed so every player gets the same piece sequence. */
  seed: number;
  /** Server clock (ms epoch) at which falling begins. */
  startsAt: number;
  /** Board height in rows (host-configurable). */
  rows: number;
  /** Board width in columns. */
  cols: number;
}
