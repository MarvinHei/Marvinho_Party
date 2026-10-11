import type { ClientGameModule } from "../types.js";
import { skribblLike } from "./logic.js";
import { SkribblPanel } from "./SkribblPanel.js";
import { SkribblTeamsPanel } from "./SkribblTeamsPanel.js";

export const skribblGame: ClientGameModule<"skribbl"> = { ...skribblLike<"skribbl">(), Panel: SkribblPanel };

export const skribblTeamsGame: ClientGameModule<"skribblteams"> = {
  ...skribblLike<"skribblteams">(),
  keyBySeat: true,
  Panel: SkribblTeamsPanel,
};
