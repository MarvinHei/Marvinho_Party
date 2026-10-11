import type { GameLogic } from "../state.js";
import type { TetrisClientState } from "../types.js";

const initial = (): TetrisClientState => ({ init: null, boards: [], garbage: [], nextGarbageSeq: 0, alive: [], kos: [] });

export const tetrisLogic: GameLogic<"tetris"> = {
  alwaysRender: true,
  keyBySeat: true,
  initial,
  reduce(state, event) {
    const s = state ?? initial();
    switch (event.kind) {
      case "init":
        return { ...s, init: event.payload, boards: [], garbage: [], alive: event.payload.players.map((p) => p.id), kos: [] };
      case "board": {
        const snap = event.payload;
        return { ...s, boards: [...s.boards.filter((b) => b.playerId !== snap.playerId), snap] };
      }
      case "garbage":
        return {
          ...s,
          garbage: [...s.garbage, { seq: s.nextGarbageSeq, ...event.payload }],
          nextGarbageSeq: s.nextGarbageSeq + 1,
        };
      case "players":
        return { ...s, alive: event.payload.alive, kos: event.payload.kos };
    }
  },
};
