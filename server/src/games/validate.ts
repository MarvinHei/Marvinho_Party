// Guards for minigame input payloads. Everything off the wire is untrusted, so
// each handler parses its payload through these before touching game state.

function invalid(): never {
  throw new Error("Invalid input.");
}

/** A plain object payload. */
export function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) invalid();
  return v as Record<string, unknown>;
}

/** A finite number, clamped into [min, max]. */
export function num(v: unknown, min = -Infinity, max = Infinity): number {
  if (typeof v !== "number" || !Number.isFinite(v)) invalid();
  return Math.max(min, Math.min(max, v));
}

/** An integer within [min, max] (rejected, not clamped, when outside). */
export function int(v: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) invalid();
  return v as number;
}

/** A string of at most `maxLen` characters. */
export function str(v: unknown, maxLen: number): string {
  if (typeof v !== "string" || v.length > maxLen) invalid();
  return v;
}

export function bool(v: unknown): boolean {
  if (typeof v !== "boolean") invalid();
  return v;
}

/** An array of integers, at most `maxLen` long. */
export function intArray(v: unknown, maxLen: number): number[] {
  if (!Array.isArray(v) || v.length > maxLen) invalid();
  return v.map((x) => int(x));
}
