import { realtime } from "../realtime.js";
import type { ClientGameModule } from "../types.js";
import { RunnerPanel } from "./RunnerPanel.js";

export const runnerGame: ClientGameModule<"runner"> = { ...realtime<"runner">(), Panel: RunnerPanel };
