import type { ClientGameModule } from "../types.js";
import { FindWordPanel } from "./FindWordPanel.js";

/** The latest per-viewer (team-scoped) view is the whole state. */
export const findwordGame: ClientGameModule<"findword"> = {
  alwaysRender: true,
  keyBySeat: true,
  reduce: (_state, event) => event.payload,
  Panel: FindWordPanel,
};
