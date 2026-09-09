import { TETRIS_CONFIG, type TetrisBoardSnapshot } from "@marvinho/shared";

interface PlayerInfo {
  id: string;
  nickname: string;
  color: string;
}

interface BoardState {
  cells: string;
  lines: number;
}

/**
 * Server-side coordinator for a Tetris match. Each client runs its own game
 * loop (authoritative over its own board); the server relays board snapshots
 * for the spectator mini-views, routes garbage to the chosen target, and
 * tracks who is still alive to decide the winner.
 */
export class TetrisMatch {
  readonly seed: number;
  private info = new Map<string, PlayerInfo>();
  private order: string[];
  private alive = new Set<string>();
  private kos: string[] = [];
  private targets = new Map<string, string>();
  private boards = new Map<string, BoardState>();

  constructor(players: PlayerInfo[]) {
    this.seed = Math.floor(Math.random() * 2 ** 31);
    this.order = players.map((p) => p.id);
    for (const p of players) {
      this.info.set(p.id, p);
      this.alive.add(p.id);
      this.boards.set(p.id, { cells: "", lines: 0 });
    }
  }

  players(): PlayerInfo[] {
    return this.order.map((id) => this.info.get(id)!);
  }

  aliveIds(): string[] {
    return this.order.filter((id) => this.alive.has(id));
  }
  koIds(): string[] {
    return [...this.kos];
  }

  setTarget(playerId: string, targetId: string): void {
    this.targets.set(playerId, targetId);
  }

  updateBoard(playerId: string, cells: string, lines: number): void {
    const b = this.boards.get(playerId);
    if (b) {
      b.cells = cells;
      b.lines = lines;
    }
  }

  snapshotFor(playerId: string): TetrisBoardSnapshot {
    const b = this.boards.get(playerId) ?? { cells: "", lines: 0 };
    return { playerId, cells: b.cells, lines: b.lines, alive: this.alive.has(playerId) };
  }

  /**
   * Route a line clear from `sender` to their chosen (or a random alive) target.
   * Returns the recipient and the garbage to add, or null if nobody to hit.
   */
  routeLines(sender: string, lines: number): { recipientId: string; rows: number; hole: number } | null {
    if (!this.alive.has(sender)) return null;
    const clamped = Math.max(0, Math.min(lines, TETRIS_CONFIG.garbageForLines.length - 1));
    const rows = TETRIS_CONFIG.garbageForLines[clamped];
    if (rows <= 0) return null;

    const recipient = this.resolveTarget(sender);
    if (!recipient) return null;
    const hole = Math.floor(Math.random() * TETRIS_CONFIG.cols);
    return { recipientId: recipient, rows, hole };
  }

  private resolveTarget(sender: string): string | null {
    const others = this.aliveIds().filter((id) => id !== sender);
    if (others.length === 0) return null;
    const chosen = this.targets.get(sender);
    if (chosen && chosen !== "random" && others.includes(chosen)) return chosen;
    return others[Math.floor(Math.random() * others.length)];
  }

  /** Mark a player as topped out. Returns true if the roster changed. */
  kill(playerId: string): boolean {
    if (!this.alive.has(playerId)) return false;
    this.alive.delete(playerId);
    this.kos.push(playerId);
    return true;
  }

  /** Over once at most one player remains. */
  isOver(): boolean {
    return this.alive.size <= 1;
  }

  /** Final ranking (best first): survivors by lines, then latest KO'd first. */
  ranking(): string[] {
    const survivors = this.aliveIds().sort(
      (a, b) => (this.boards.get(b)?.lines ?? 0) - (this.boards.get(a)?.lines ?? 0),
    );
    const eliminated = [...this.kos].reverse();
    return [...survivors, ...eliminated];
  }

  linesFor(id: string): number {
    return this.boards.get(id)?.lines ?? 0;
  }
  isAlive(id: string): boolean {
    return this.alive.has(id);
  }
}
