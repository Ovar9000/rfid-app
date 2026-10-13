import { MIN_MAGNITUDE, type BBox } from '../config';
import type { Quake } from './types';

export interface QuakeFilter {
  /** Never allowed below MIN_MAGNITUDE (4.0). */
  minMagnitude: number;
  region: BBox;
  minDepthKm?: number;
  maxDepthKm?: number;
}

/** Clamp any requested threshold so nothing below M4.0 can be shown. */
export function effectiveMinMagnitude(requested: number): number {
  return Number.isFinite(requested) ? Math.max(MIN_MAGNITUDE, requested) : MIN_MAGNITUDE;
}

export function inRegion(q: Pick<Quake, 'lat' | 'lon'>, r: BBox): boolean {
  return q.lat >= r.minLat && q.lat <= r.maxLat && q.lon >= r.minLon && q.lon <= r.maxLon;
}

/**
 * Client-side filter. The upstream query already asks for M4+ in the region,
 * but we re-check here so the guarantee holds for any data source.
 */
export function filterQuakes(quakes: Quake[], f: QuakeFilter): Quake[] {
  const minMag = effectiveMinMagnitude(f.minMagnitude);
  const minDepth = f.minDepthKm ?? -Infinity;
  const maxDepth = f.maxDepthKm ?? Infinity;
  return quakes.filter(
    (q) =>
      Number.isFinite(q.magnitude) &&
      q.magnitude >= minMag &&
      inRegion(q, f.region) &&
      q.depthKm >= minDepth &&
      q.depthKm <= maxDepth,
  );
}
