import type { GameLogic } from "./state.js";
import type { ClientGameStates, RealtimeClientState } from "./types.js";

type RealtimeGame = "pong" | "verstecken" | "battle" | "runner" | "sterbegeld";

/** Real-time games: an init, then a stream of server snapshots. */
export function realtime<G extends RealtimeGame>(): GameLogic<G> {
  type S = ClientGameStates[G];
  return {
    reduce(state, event) {
      if (event.kind === "init") return { init: event.payload, snap: null } as RealtimeClientState<unknown, unknown> as S;
      return state ? ({ ...state, snap: event.payload } as S) : state;
    },
  };
}
