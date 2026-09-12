// Shared geography helpers used by both the "Guess the Country" and "Travle"
// minigames. Country data (names, centroids, borders) lives in geoData.ts and
// outline geometry in worldGeometry.ts — both derived from public-domain
// Natural Earth data plus openly-licensed country metadata.

import { GEO_COUNTRIES, type GeoCountry } from "./geoData.js";
import { WORLD_GEOMETRY, type GeoGeometry } from "./worldGeometry.js";

/** Diacritic-fold + lowercase a name for tolerant matching. */
export function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_CODE = new Map<string, GeoCountry>(GEO_COUNTRIES.map((c) => [c.code, c]));

/** Build the alias → code index once. */
const ALIAS_INDEX = (() => {
  const m = new Map<string, string>();
  for (const c of GEO_COUNTRIES) {
    for (const a of c.aliases) if (!m.has(a)) m.set(a, c.code);
    m.set(foldName(c.name), c.code);
  }
  return m;
})();

export function countryByCode(code: string): GeoCountry | undefined {
  return BY_CODE.get(code);
}

/** Resolve a typed country name/alias to its ISO code, or null. */
export function matchCountryCode(input: string): string | null {
  const f = foldName(input);
  if (!f) return null;
  return ALIAS_INDEX.get(f) ?? null;
}

/** Country display names, for building an autocomplete list. */
export function countryNames(): { code: string; name: string }[] {
  return GEO_COUNTRIES.map((c) => ({ code: c.code, name: c.name }));
}

const R_EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km between two [lat,lng] points. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s))));
}

// --- border-to-border distance ---------------------------------------------

/** All boundary points [lng,lat] of a country's outline. */
function boundaryPoints(code: string): [number, number][] {
  const geo: GeoGeometry | undefined = WORLD_GEOMETRY[code];
  if (!geo) return [];
  const rings = geo.type === "Polygon" ? geo.coordinates : geo.coordinates.flat();
  const out: [number, number][] = [];
  for (const ring of rings) for (const p of ring) out.push([p[0], p[1]]);
  return out;
}

/** Evenly subsample a point list down to at most `max` points. */
function subsample(pts: [number, number][], max: number): [number, number][] {
  if (pts.length <= max) return pts;
  const step = pts.length / max;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[Math.floor(i)]);
  return out;
}

const borderDistCache = new Map<string, number>();

/**
 * Shortest border-to-border distance (km) between two countries, approximated
 * from subsampled outline vertices. Adjacent countries return ~0. Cached.
 */
export function minBorderDistanceKm(codeA: string, codeB: string): number {
  if (codeA === codeB) return 0;
  const key = codeA < codeB ? `${codeA}|${codeB}` : `${codeB}|${codeA}`;
  const cached = borderDistCache.get(key);
  if (cached !== undefined) return cached;
  const a = subsample(boundaryPoints(codeA), 260);
  const b = subsample(boundaryPoints(codeB), 260);
  let min = Infinity;
  for (const [alng, alat] of a) {
    for (const [blng, blat] of b) {
      const d = haversineKm(alat, alng, blat, blng);
      if (d < min) min = d;
    }
  }
  const result = min === Infinity ? 0 : min;
  borderDistCache.set(key, result);
  return result;
}

/** Initial compass bearing (0=N, 90=E, 180=S, 270=W) from A to B. */
export function initialBearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const φ1 = toRad(aLat);
  const φ2 = toRad(bLat);
  const Δλ = toRad(bLng - aLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// --- Travle adjacency graph -------------------------------------------------

/** Countries that participate in the border graph (have at least one border). */
export function borderableCountries(): GeoCountry[] {
  return GEO_COUNTRIES.filter((c) => c.borders.length > 0);
}

/**
 * Shortest border path (inclusive of both endpoints) between two countries, or
 * null if disconnected. Plain BFS over the border adjacency graph.
 */
export function shortestCountryPath(fromCode: string, toCode: string): string[] | null {
  if (fromCode === toCode) return [fromCode];
  const prev = new Map<string, string | null>([[fromCode, null]]);
  const queue = [fromCode];
  while (queue.length) {
    const cur = queue.shift()!;
    const country = BY_CODE.get(cur);
    if (!country) continue;
    for (const nb of country.borders) {
      if (prev.has(nb)) continue;
      prev.set(nb, cur);
      if (nb === toCode) {
        const path: string[] = [];
        let n: string | null = toCode;
        while (n) {
          path.unshift(n);
          n = prev.get(n) ?? null;
        }
        return path;
      }
      queue.push(nb);
    }
  }
  return null;
}

/**
 * True if `nodes` (∪ endpoints) contain a connected border-chain from `from` to
 * `to`. Used to decide when a Travle player has bridged the two countries.
 */
export function connectsThrough(from: string, to: string, nodes: Set<string>): boolean {
  const allowed = new Set(nodes);
  allowed.add(from);
  allowed.add(to);
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) return true;
    const country = BY_CODE.get(cur);
    if (!country) continue;
    for (const nb of country.borders) {
      if (allowed.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen.has(to);
}
