import { ORIGIN, UNITS_PER_KM } from '../config';

export const KM_PER_DEG_LAT = 111.32;
const cosLat0 = Math.cos((ORIGIN.lat * Math.PI) / 180);

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Local equirectangular projection centred on ORIGIN.
 * Scene axes: +x = east, -z = north, +y = up (depth is negative y).
 * Accurate to a few percent across the archipelago, which is plenty here.
 */
export function project(lat: number, lon: number, depthKm = 0, depthScale = 1): Vec3 {
  return {
    x: (lon - ORIGIN.lon) * KM_PER_DEG_LAT * cosLat0 * UNITS_PER_KM,
    y: -depthKm * depthScale * UNITS_PER_KM,
    z: -(lat - ORIGIN.lat) * KM_PER_DEG_LAT * UNITS_PER_KM,
  };
}

export function unproject(x: number, z: number): { lat: number; lon: number } {
  return {
    lon: ORIGIN.lon + x / (KM_PER_DEG_LAT * cosLat0 * UNITS_PER_KM),
    lat: ORIGIN.lat - z / (KM_PER_DEG_LAT * UNITS_PER_KM),
  };
}
