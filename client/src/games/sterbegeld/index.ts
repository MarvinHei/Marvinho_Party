import { realtime } from "../realtime.js";
import type { ClientGameModule } from "../types.js";
import { SterbegeldPanel } from "./SterbegeldPanel.js";

export const sterbegeldGame: ClientGameModule<"sterbegeld"> = { ...realtime<"sterbegeld">(), Panel: SterbegeldPanel };
