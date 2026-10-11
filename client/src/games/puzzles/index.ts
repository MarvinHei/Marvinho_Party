import type { ClientGameModule } from "../types.js";
import { puzzleLogic } from "./logic.js";
import { PuzzlePanel } from "./PuzzlePanel.js";

export const zipGame: ClientGameModule<"zip"> = { ...puzzleLogic<"zip">(), Panel: PuzzlePanel };
export const queensGame: ClientGameModule<"queens"> = { ...puzzleLogic<"queens">(), Panel: PuzzlePanel };
export const sudokuGame: ClientGameModule<"sudoku"> = { ...puzzleLogic<"sudoku">(), Panel: PuzzlePanel };
export const tangoGame: ClientGameModule<"tango"> = { ...puzzleLogic<"tango">(), Panel: PuzzlePanel };
