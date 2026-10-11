// Time and randomness for game logic. Every round gets a GameEnv so tests (and
// bug reproductions) can run a game deterministically with a seeded RNG and a
// hand-driven clock; production uses the real ones.

/** A source of uniform random numbers in [0, 1), like Math.random. */
export type Rng = () => number;

export interface GameEnv {
  /** Current time in ms (epoch-based in production). */
  now(): number;
  random: Rng;
}

export const realEnv: GameEnv = {
  now: () => Date.now(),
  random: () => Math.random(),
};

/** A small, fast deterministic PRNG (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A clock that only moves when told to. */
export function manualClock(start = 0): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return { now: () => t, advance: (ms) => void (t += ms) };
}

/** A deterministic env for tests: seeded RNG + manual clock. */
export function testEnv(seed = 1, start = 1_000_000): GameEnv & { advance: (ms: number) => void } {
  const clock = manualClock(start);
  return { now: clock.now, advance: clock.advance, random: seededRng(seed) };
}

/** Random integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** A random element of a non-empty array. */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[randInt(rng, arr.length)];
}

/** A shuffled copy (Fisher–Yates). */
export function shuffled<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
