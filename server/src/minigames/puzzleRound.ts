import type { PuzzleSpec } from "@marvinho/shared";
import { validatePuzzle } from "@marvinho/shared";
import { realEnv, type GameEnv } from "./env.js";

interface PlayerState {
  solved: boolean;
  finishOrder: number | null;
  finishedAt: number | null;
}

/**
 * A single-player puzzle everyone races to solve. Each player submits their own
 * solution; ranking is solvers-first, then by solve time.
 */
export class PuzzleRound {
  /** Clock + RNG (injectable for deterministic tests). */
  private readonly env: GameEnv;
  private players = new Map<string, PlayerState>();
  private nextOrder = 0;
  private readonly startTime: number;

  constructor(
    playerIds: string[],
    private readonly spec: PuzzleSpec,
    env: GameEnv = realEnv,
  ) {
    this.env = env;
    this.startTime = this.env.now();
    for (const id of playerIds) {
      this.players.set(id, { solved: false, finishOrder: null, finishedAt: null });
    }
  }

  /** Validate and record a submission. Returns whether it solved the puzzle. */
  submit(playerId: string, solution: number[]): { solved: boolean } {
    const st = this.players.get(playerId);
    if (!st) throw new Error("You are not in this round.");
    if (st.finishOrder !== null) return { solved: st.solved };
    if (validatePuzzle(this.spec, solution)) {
      st.solved = true;
      st.finishOrder = this.nextOrder++;
      st.finishedAt = this.env.now();
      return { solved: true };
    }
    return { solved: false };
  }

  finishPlayer(id: string): void {
    const st = this.players.get(id);
    if (st && st.finishOrder === null) {
      st.finishOrder = this.nextOrder++;
      st.finishedAt = this.env.now();
    }
  }

  finishAll(): void {
    for (const st of this.players.values()) {
      if (st.finishOrder === null) {
        st.finishOrder = this.nextOrder++;
        st.finishedAt = this.env.now();
      }
    }
  }

  isComplete(): boolean {
    for (const st of this.players.values()) if (st.finishOrder === null) return false;
    return true;
  }

  private timeMs(st: PlayerState): number {
    return (st.finishedAt ?? this.env.now()) - this.startTime;
  }

  ranking(): string[] {
    return [...this.players.entries()]
      .sort(([, a], [, b]) => {
        if (a.solved !== b.solved) return a.solved ? -1 : 1;
        if (a.solved && b.solved) return this.timeMs(a) - this.timeMs(b);
        return (a.finishOrder ?? 0) - (b.finishOrder ?? 0);
      })
      .map(([id]) => id);
  }

  statsFor(id: string): { solved: boolean; timeMs: number } {
    const st = this.players.get(id);
    if (!st) return { solved: false, timeMs: 0 };
    return { solved: st.solved, timeMs: this.timeMs(st) };
  }

  isSolved(id: string): boolean {
    return this.players.get(id)?.solved ?? false;
  }
}
