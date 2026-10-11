import type { ClientGameModule } from "../types.js";
import { wordleLogic } from "./logic.js";
import { WordlePanel } from "./WordlePanel.js";

export const wordleGame: ClientGameModule<"wordle"> = { ...wordleLogic, Panel: WordlePanel };
