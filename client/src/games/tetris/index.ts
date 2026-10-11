import type { ClientGameModule } from "../types.js";
import { tetrisLogic } from "./logic.js";
import { TetrisPanel } from "./TetrisPanel.js";

export const tetrisGame: ClientGameModule<"tetris"> = { ...tetrisLogic, Panel: TetrisPanel };
