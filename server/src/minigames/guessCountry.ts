import {
  countryByCode,
  haversineKm,
  initialBearing,
  matchCountryCode,
  type GeoCountry,
  type GuessCountryGuess,
} from "@marvinho/shared";

interface PlayerState {
  tries: number;
  solved: boolean;
  finishOrder: number | null;
  finishedAt: number | null;
}

const MAX_KM = 20000; // ~half the earth's circumference

/**
 * Everyone sees the same country silhouette and races to name it. Wrong guesses
 * return a distance + bearing hint. Ranking is solvers-first (fewest tries, then
 * time), then by tries.
 */
export class GuessCountryRound {
  private players = new Map<string, PlayerState>();
  private nextOrder = 0;
  private readonly startTime = Date.now();

  constructor(
    playerIds: string[],
    readonly answer: GeoCountry,
  ) {
    for (const id of playerIds) {
      this.players.set(id, { tries: 0, solved: false, finishOrder: null, finishedAt: null });
    }
  }

  guess(playerId: string, rawName: string): { guess: GuessCountryGuess } {
    const st = this.players.get(playerId);
    if (!st) throw new Error("You are not in this round.");
    if (st.finishOrder !== null) throw new Error("You already found it!");
    const code = matchCountryCode(rawName);
    if (!code) throw new Error("Unknown country — check the spelling.");
    const guessed = countryByCode(code)!;
    const correct = code === this.answer.code;
    st.tries++;
    const distanceKm = correct
      ? 0
      : haversineKm(guessed.lat, guessed.lng, this.answer.lat, this.answer.lng);
    const bearingDeg = correct
      ? 0
      : initialBearing(guessed.lat, guessed.lng, this.answer.lat, this.answer.lng);
    const proximity = correct ? 1 : Math.max(0, 1 - distanceKm / MAX_KM);
    if (correct) {
      st.solved = true;
      st.finishOrder = this.nextOrder++;
      st.finishedAt = Date.now();
    }
    return { guess: { code, name: guessed.name, correct, distanceKm, bearingDeg, proximity } };
  }

  finishPlayer(id: string): void {
    const st = this.players.get(id);
    if (st && st.finishOrder === null) {
      st.finishOrder = this.nextOrder++;
      st.finishedAt = Date.now();
    }
  }

  finishAll(): void {
    for (const st of this.players.values()) {
      if (st.finishOrder === null) {
        st.finishOrder = this.nextOrder++;
        st.finishedAt = Date.now();
      }
    }
  }

  isComplete(): boolean {
    for (const st of this.players.values()) if (st.finishOrder === null) return false;
    return true;
  }

  private timeMs(st: PlayerState): number {
    return (st.finishedAt ?? Date.now()) - this.startTime;
  }

  ranking(): string[] {
    return [...this.players.entries()]
      .sort(([, a], [, b]) => {
        if (a.solved !== b.solved) return a.solved ? -1 : 1;
        if (a.solved && b.solved) {
          if (a.tries !== b.tries) return a.tries - b.tries;
          return this.timeMs(a) - this.timeMs(b);
        }
        // both unsolved: fewer tries used = "gave up later", rank ahead
        return b.tries - a.tries;
      })
      .map(([id]) => id);
  }

  statsFor(id: string): { solved: boolean; tries: number } {
    const st = this.players.get(id);
    return { solved: st?.solved ?? false, tries: st?.tries ?? 0 };
  }
}
