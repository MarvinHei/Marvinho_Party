import type { ClientGameModule } from "../types.js";
import { CodenamesPanel } from "./CodenamesPanel.js";

/** The latest per-viewer view is the whole state. */
export const codenamesGame: ClientGameModule<"codenames"> = {
  alwaysRender: true,
  reduce: (_state, event) => event.payload,
  Panel: CodenamesPanel,
};
