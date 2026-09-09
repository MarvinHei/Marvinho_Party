import { useSyncExternalStore } from "react";
import { store } from "./store.js";
import type { StoreSnapshot } from "./types.js";

export function useStore(): StoreSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
