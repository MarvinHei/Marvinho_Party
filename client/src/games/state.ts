import type { MinigameType } from "@marvinho/shared";
import type { SeatState } from "../state/types.js";
import type { ClientGameModule, ClientGameStates } from "./types.js";

/** Reducer half of a game module (the registry pairs it with its Panel). */
export type GameLogic<G extends MinigameType> = Omit<ClientGameModule<G>, "Panel">;

/** This seat's state for one of the given games, or null when it's in another. */
export function gameState<G extends MinigameType>(seat: SeatState, ...types: G[]): ClientGameStates[G] | null {
  const g = seat.game;
  if (!g || !(types as MinigameType[]).includes(g.type)) return null;
  return g.state as ClientGameStates[G] | null;
}
