// Build-time feature flags.
//
// Debug mode (multi-seat POV switching + standalone minigame practice) is a
// developer tool and must never appear in a normal production build. It is
// gated behind this flag: enabled automatically during local `vite dev`, and
// in production only when the site is built with `VITE_ENABLE_DEBUG=true`.
export const DEBUG_FEATURE_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === "true";
