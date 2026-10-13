/**
 * Central configuration. Everything region- or source-specific lives here so
 * the rest of the framework stays generic.
 */

export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Hard floor: this site only shows earthquakes of magnitude 4.0 and up. */
export const MIN_MAGNITUDE = 4.0;

/**
 * Philippine region. Covers Luzon Strait (Batanes) down to the Celebes Sea and
 * east past the Philippine Trench. Adjust to taste.
 */
export const REGION: BBox = {
  minLat: 4.0,
  maxLat: 21.5,
  minLon: 116.0,
  maxLon: 128.0,
};

/** Centre of the local projection (roughly the middle of the archipelago). */
export const ORIGIN = {
  lat: (REGION.minLat + REGION.maxLat) / 2,
  lon: (REGION.minLon + REGION.maxLon) / 2,
};

/** Scene units per kilometre. 1 unit = 10 km keeps numbers small. */
export const UNITS_PER_KM = 0.1;

/** Deepest point drawn on the depth box (km). Philippine slabs reach ~650 km. */
export const MAX_DEPTH_KM = 700;

export const TIME_RANGES = [
  { id: '7d', label: 'Past 7 days', days: 7 },
  { id: '30d', label: 'Past 30 days', days: 30 },
  { id: '90d', label: 'Past 90 days', days: 90 },
  { id: '1y', label: 'Past year', days: 365 },
] as const;

export type TimeRangeId = (typeof TIME_RANGES)[number]['id'];

export const DEFAULT_TIME_RANGE: TimeRangeId = '30d';

/** Auto-refresh interval for live data (ms). */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export const CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Manila', lat: 14.5995, lon: 120.9842 },
  { name: 'Baguio', lat: 16.4023, lon: 120.596 },
  { name: 'Legazpi', lat: 13.1391, lon: 123.7438 },
  { name: 'Iloilo', lat: 10.7202, lon: 122.5621 },
  { name: 'Cebu', lat: 10.3157, lon: 123.8854 },
  { name: 'Tacloban', lat: 11.2433, lon: 125.0048 },
  { name: 'Puerto Princesa', lat: 9.7392, lon: 118.7353 },
  { name: 'Cagayan de Oro', lat: 8.4542, lon: 124.6319 },
  { name: 'Zamboanga', lat: 6.9214, lon: 122.079 },
  { name: 'Davao', lat: 7.1907, lon: 125.4553 },
];
