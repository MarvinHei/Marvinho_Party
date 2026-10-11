import { realtime } from "../realtime.js";
import type { ClientGameModule } from "../types.js";
import { BattlePanel } from "./BattlePanel.js";

export const battleGame: ClientGameModule<"battle"> = { ...realtime<"battle">(), Panel: BattlePanel };
