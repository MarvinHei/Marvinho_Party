import type { SkribblSegment } from "@marvinho/shared";
import type { GameLogic } from "../state.js";
import type { ClientGameStates, SkribblClientState } from "../types.js";

/** Skribbl and Skribbl Teams: the latest view plus this turn's strokes. */
export function skribblLike<G extends "skribbl" | "skribblteams">(): GameLogic<G> {
  type S = ClientGameStates[G];
  return {
    alwaysRender: true,
    initial: () => ({ view: null, strokes: [] }) as SkribblClientState<never> as S,
    reduce(state, event) {
      const s = (state ?? { view: null, strokes: [] }) as SkribblClientState<unknown>;
      const e = event as { kind: "state" | "draw" | "clear"; payload: unknown };
      if (e.kind === "state") return { ...s, view: e.payload } as S;
      if (e.kind === "draw") return { ...s, strokes: [...s.strokes, (e.payload as { seg: SkribblSegment }).seg] } as S;
      return { ...s, strokes: [] } as S;
    },
  };
}

/** Append the drawer's own segment locally (the server won't echo it back). */
export function withStroke<S extends SkribblClientState<unknown>>(s: S, seg: SkribblSegment): S {
  return { ...s, strokes: [...s.strokes, seg] };
}

export function withoutStrokes<S extends SkribblClientState<unknown>>(s: S): S {
  return { ...s, strokes: [] };
}
