// Small, dependency-free geographic projections for rendering country outlines
// as SVG paths. Geometry coordinates are GeoJSON [lng, lat]. All original code.
import type { GeoGeometry } from "@marvinho/shared";

const toRad = (d: number) => (d * Math.PI) / 180;

/** Iterate every linear ring of a Polygon/MultiPolygon geometry. */
function rings(geo: GeoGeometry): number[][][] {
  if (geo.type === "Polygon") return geo.coordinates as number[][][];
  return (geo.coordinates as number[][][][]).flat();
}

// --- silhouette (equirectangular, aspect-corrected, fit to a box) -----------

/**
 * Build an SVG path for a single country's shape, scaled to fit a `w`×`h` box
 * with padding. Used for the "Guess the Country" silhouette.
 */
export function silhouettePath(geo: GeoGeometry, w: number, h: number, pad = 8): string {
  const rs = rings(geo);
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const ring of rs) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos(toRad(midLat)); // east-west compression toward the poles
  const px = (lng: number) => lng * kx;
  const py = (lat: number) => -lat;
  const x0 = px(minLng), x1 = px(maxLng), y0 = py(maxLat), y1 = py(minLat);
  const spanX = Math.max(1e-6, x1 - x0), spanY = Math.max(1e-6, y1 - y0);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = (w - spanX * scale) / 2 - x0 * scale;
  const oy = (h - spanY * scale) / 2 - y0 * scale;
  let d = "";
  for (const ring of rs) {
    ring.forEach(([lng, lat], i) => {
      const x = px(lng) * scale + ox;
      const y = py(lat) * scale + oy;
      d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
    });
    d += "Z";
  }
  return d;
}

// --- orthographic globe -----------------------------------------------------

export interface Ortho {
  /** Project [lng,lat] to [x,y], or null if on the far side of the globe. */
  project(lng: number, lat: number): [number, number] | null;
  cx: number;
  cy: number;
  r: number;
}

/** An orthographic ("globe") projection centered on a lng/lat. */
export function orthographic(centerLng: number, centerLat: number, r: number, cx: number, cy: number): Ortho {
  const λ0 = toRad(centerLng);
  const φ0 = toRad(centerLat);
  const sinφ0 = Math.sin(φ0), cosφ0 = Math.cos(φ0);
  return {
    cx,
    cy,
    r,
    project(lng: number, lat: number): [number, number] | null {
      const λ = toRad(lng), φ = toRad(lat);
      const cosc = sinφ0 * Math.sin(φ) + cosφ0 * Math.cos(φ) * Math.cos(λ - λ0);
      if (cosc < 0) return null; // back hemisphere
      const x = r * Math.cos(φ) * Math.sin(λ - λ0);
      const y = -r * (cosφ0 * Math.sin(φ) - sinφ0 * Math.cos(φ) * Math.cos(λ - λ0));
      return [cx + x, cy + y];
    },
  };
}

/**
 * Build an SVG path for a geometry under an orthographic projection, breaking
 * the stroke where the outline crosses to the hidden hemisphere.
 */
export function orthoPath(geo: GeoGeometry, o: Ortho): string {
  let d = "";
  for (const ring of rings(geo)) {
    let penDown = false;
    for (const [lng, lat] of ring) {
      const p = o.project(lng, lat);
      if (!p) {
        penDown = false;
        continue;
      }
      d += (penDown ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
      penDown = true;
    }
  }
  return d;
}

/** Project a single [lat,lng] centroid (note: metadata stores lat,lng). */
export function projectCentroid(o: Ortho, lat: number, lng: number): [number, number] | null {
  return o.project(lng, lat);
}

// --- direction hint (8-way) -------------------------------------------------

// N, NE, E, SE, S, SW, W, NW at 0,45,…,315 degrees.
const ARROWS = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"];

/**
 * Icon for a compass bearing that points toward the answer: east → ➡️ (right),
 * west → ⬅️ (left), north → ⬆️, etc. One of 8 directions.
 */
export function directionIcon(bearingDeg: number): string {
  const idx = Math.round(bearingDeg / 45) % 8;
  return ARROWS[idx];
}
