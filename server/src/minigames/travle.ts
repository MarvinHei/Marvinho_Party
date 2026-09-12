import {
  connectsThrough,
  countryByCode,
  matchCountryCode,
} from "@marvinho/shared";

interface PlayerState {
  named: Set<string>;
  connected: boolean;
  finishOrder: number | null;
  finishedAt: number | null;
}

/**
 * Players name countries to bridge a start and end country through their shared
 * borders. First to connect them wins; fewer countries used is better. Ranking
 * is connectors-first (fewest named, then time), then by how many they named.
 */
export class TravleRound {
  private players = new Map<string, PlayerState>();
  private nextOrder = 0;
  private readonly startTime = Date.now();

  constructor(
    playerIds: string[],
    readonly startCode: string,
    readonly endCode: string,
  ) {
    for (const id of playerIds) {
      this.players.set(id, { named: new Set(), connected: false, finishOrder: null, finishedAt: null });
    }
  }

  guess(playerId: string, rawName: string): { code: string; name: string; connected: boolean } {
    const st = this.players.get(playerId);
    if (!st) throw new Error("You are not in this round.");
    if (st.finishOrder !== null) throw new Error("You already connected them!");
    const code = matchCountryCode(rawName);
    if (!code) throw new Error("Unknown country — check the spelling.");
    if (code === this.startCode || code === this.endCode) {
      throw new Error("That's an endpoint — name the countries in between.");
    }
    if (st.named.has(code)) throw new Error("Already named.");
    st.named.add(code);
    const connected = connectsThrough(this.startCode, this.endCode, st.named);
    if (connected && st.finishOrder === null) {
      st.connected = true;
      st.finishOrder = this.nextOrder++;
      st.finishedAt = Date.now();
    }
    return { code, name: countryByCode(code)?.name ?? code, connected };
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
        if (a.connected !== b.connected) return a.connected ? -1 : 1;
        if (a.connected && b.connected) {
          if (a.named.size !== b.named.size) return a.named.size - b.named.size;
          return this.timeMs(a) - this.timeMs(b);
        }
        // both unconnected: fewer wasted names ranks ahead
        return a.named.size - b.named.size;
      })
      .map(([id]) => id);
  }

  statsFor(id: string): { connected: boolean; count: number } {
    const st = this.players.get(id);
    return { connected: st?.connected ?? false, count: st?.named.size ?? 0 };
  }
}
