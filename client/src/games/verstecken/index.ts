import { realtime } from "../realtime.js";
import type { ClientGameModule } from "../types.js";
import { HidePanel } from "./HidePanel.js";

export const versteckenGame: ClientGameModule<"verstecken"> = { ...realtime<"verstecken">(), Panel: HidePanel };
