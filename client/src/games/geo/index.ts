import type { ClientGameModule } from "../types.js";
import { GuessCountryPanel } from "./GuessCountryPanel.js";
import { guessCountryLogic, travleLogic } from "./logic.js";
import { TravlePanel } from "./TravlePanel.js";

export const guessCountryGame: ClientGameModule<"guesscountry"> = { ...guessCountryLogic, Panel: GuessCountryPanel };
export const travleGame: ClientGameModule<"travle"> = { ...travleLogic, Panel: TravlePanel };
