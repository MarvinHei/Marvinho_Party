import { MINIGAME_RULES, type MinigameType } from "@marvinho/shared";
import { Net } from "../net/Net.js";
import type { ClientGameStates } from "../games/types.js";
import { initialSeat, type SeatState, type StoreSnapshot } from "./types.js";

let seatCounter = 0;
const nextSeatId = () => `seat-${++seatCounter}`;

/**
 * Central client store. Holds all player seats (one in normal play, several in
 * debug mode) and the active POV. Net instances live in a side map so the
 * immutable snapshot stays cheap to diff for React.
 */
class GameStore {
  private snapshot: StoreSnapshot = {
    debugEnabled: false,
    activeSeatId: null,
    seats: [],
  };
  private nets = new Map<string, Net>();
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): StoreSnapshot => this.snapshot;

  private commit(next: StoreSnapshot) {
    this.snapshot = next;
    for (const fn of this.listeners) fn();
  }

  private makePatcher(seatId: string) {
    return (patch: Partial<SeatState> | ((prev: SeatState) => Partial<SeatState>)) => {
      const seats = this.snapshot.seats.map((s) => {
        if (s.id !== seatId) return s;
        const delta = typeof patch === "function" ? patch(s) : patch;
        return { ...s, ...delta };
      });
      this.commit({ ...this.snapshot, seats });
    };
  }

  // --- seat lifecycle -----------------------------------------------------

  /** Ensure at least one seat exists; returns the primary seat id. */
  ensurePrimarySeat(): string {
    if (this.snapshot.seats.length > 0) return this.snapshot.seats[0].id;
    return this.addSeat("Player", true);
  }

  addSeat(label: string, primary = false): string {
    const id = nextSeatId();
    const seat = initialSeat(id, label);
    this.nets.set(id, new Net(id, this.makePatcher(id), primary));
    this.commit({
      ...this.snapshot,
      seats: [...this.snapshot.seats, seat],
      activeSeatId: this.snapshot.activeSeatId ?? id,
    });
    return id;
  }

  removeSeat(seatId: string): void {
    const net = this.nets.get(seatId);
    net?.leave();
    net?.dispose();
    this.nets.delete(seatId);
    const seats = this.snapshot.seats.filter((s) => s.id !== seatId);
    const activeSeatId =
      this.snapshot.activeSeatId === seatId
        ? (seats[0]?.id ?? null)
        : this.snapshot.activeSeatId;
    this.commit({ ...this.snapshot, seats, activeSeatId });
  }

  setActiveSeat(seatId: string): void {
    if (this.snapshot.seats.some((s) => s.id === seatId)) {
      this.commit({ ...this.snapshot, activeSeatId: seatId });
    }
  }

  setDebug(enabled: boolean): void {
    // Turning debug off collapses back to just the active/primary seat.
    if (!enabled && this.snapshot.seats.length > 1) {
      const keep = this.snapshot.activeSeatId ?? this.snapshot.seats[0]?.id;
      for (const s of this.snapshot.seats) {
        if (s.id !== keep) {
          const net = this.nets.get(s.id);
          net?.leave();
          net?.dispose();
          this.nets.delete(s.id);
        }
      }
      const seats = this.snapshot.seats.filter((s) => s.id === keep);
      this.commit({ ...this.snapshot, debugEnabled: false, seats, activeSeatId: keep ?? null });
      return;
    }
    this.commit({ ...this.snapshot, debugEnabled: enabled });
  }

  net(seatId: string): Net | undefined {
    return this.nets.get(seatId);
  }

  /** Debug helper: spawn a new seat that immediately joins an existing lobby. */
  async spawnBotSeat(lobbyCode: string): Promise<void> {
    const n = this.snapshot.seats.length + 1;
    const id = this.addSeat(`P${n}`);
    const net = this.nets.get(id);
    if (!net) return;
    try {
      // socket.io buffers this emit until the connection is ready.
      await net.join(lobbyCode, `Player ${n}`);
    } catch (e) {
      this.setSeatError(id, e instanceof Error ? e.message : "Join failed");
    }
  }

  activeSeat(): SeatState | undefined {
    return this.snapshot.seats.find((s) => s.id === this.snapshot.activeSeatId);
  }

  setSeatError(seatId: string, error: string | null): void {
    this.makePatcher(seatId)({ error });
  }

  /** Update this seat's state for a game it's currently in (no-op otherwise). */
  updateGame<G extends MinigameType>(
    seatId: string,
    type: G | readonly G[],
    fn: (state: ClientGameStates[G]) => ClientGameStates[G],
  ): void {
    const types: readonly MinigameType[] = Array.isArray(type) ? type : [type];
    this.makePatcher(seatId)((prev) => {
      const g = prev.game;
      if (!g || !g.state || !types.includes(g.type)) return {};
      return { game: { ...g, state: fn(g.state as ClientGameStates[G]) } as SeatState["game"] };
    });
  }

  /** Start (or stop, with null) watching another player's read-only POV. */
  setSpectateTarget(seatId: string, targetId: string | null): void {
    this.net(seatId)?.spectateWatch(targetId);
    this.makePatcher(seatId)({ spectateTarget: targetId, spectateFrame: null });
  }

  /**
   * Debug practice: create a lobby if needed, spawn enough bot seats for the
   * chosen game, then start it standalone (no board/scoreboard).
   */
  async practice(game: MinigameType, nickname: string): Promise<void> {
    this.setDebug(true);
    const hostId = this.ensurePrimarySeat();
    const hostNet = this.nets.get(hostId);
    if (!hostNet) return;
    const hostSeat = () => this.snapshot.seats.find((s) => s.id === hostId);

    let code = hostSeat()?.lobby?.id ?? null;
    if (!code) {
      try {
        const jl = await hostNet.create(nickname.trim() || "Dev");
        code = jl.lobbyId;
      } catch (e) {
        this.setSeatError(hostId, e instanceof Error ? e.message : "Failed");
        return;
      }
    }
    this.setActiveSeat(hostId);

    const need = MINIGAME_RULES[game].minPlayers;
    const connected = () =>
      hostSeat()?.lobby?.players.filter((p) => p.connected).length ?? 1;
    let guard = 0;
    while (connected() < need && guard++ < 8) {
      await this.spawnBotSeat(code);
      await new Promise((r) => setTimeout(r, 150));
    }

    try {
      await hostNet.debugStart(game);
    } catch (e) {
      this.setSeatError(hostId, e instanceof Error ? e.message : "Failed");
    }
  }
}

export const store = new GameStore();
