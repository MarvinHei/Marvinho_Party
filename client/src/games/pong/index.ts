import { realtime } from "../realtime.js";
import type { ClientGameModule } from "../types.js";
import { PongPanel } from "./PongPanel.js";

export const pongGame: ClientGameModule<"pong"> = { ...realtime<"pong">(), Panel: PongPanel };
