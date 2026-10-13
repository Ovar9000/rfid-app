import type { Feature, FeatureCollection, Point } from 'geojson';
import { effectiveMinMagnitude } from './filter';
import type { Quake, QuakeQuery, QuakeSource } from './types';

const ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

interface UsgsProps {
  mag: number | null;
  magType: string | null;
  place: string | null;
  time: number;
  url: string;
  tsunami: number;
  type: string;
}

/** Build the FDSN event query URL. Exported for testing. */
export function buildUsgsUrl(q: QuakeQuery): string {
  const params = new URLSearchParams({
    format: 'geojson',
    eventtype: 'earthquake',
    orderby: 'time',
    starttime: q.start.toISOString(),
    endtime: q.end.toISOString(),
    minmagnitude: String(effectiveMinMagnitude(q.minMagnitude)),
    minlatitude: String(q.region.minLat),
    maxlatitude: String(q.region.maxLat),
    minlongitude: String(q.region.minLon),
    maxlongitude: String(q.region.maxLon),
    limit: '20000',
  });
  return `${ENDPOINT}?${params}`;
}

/** Convert a USGS GeoJSON feature into a Quake. Returns null for unusable rows. */
export function parseUsgsFeature(f: Feature<Point, UsgsProps>): Quake | null {
  const p = f.properties;
  const [lon, lat, depth] = f.geometry?.coordinates ?? [];
  if (p?.mag == null || lat == null || lon == null || p.type !== 'earthquake') return null;
  return {
    id: String(f.id),
    magnitude: p.mag,
    magType: p.magType ?? '',
    lat,
    lon,
    depthKm: depth ?? 0,
    time: new Date(p.time),
    place: p.place ?? 'Unknown location',
    url: p.url,
    tsunami: p.tsunami === 1,
  };
}

export const usgsSource: QuakeSource = {
  name: 'USGS',
  attribution: 'Earthquake data: U.S. Geological Survey (USGS) ComCat',
  async fetch(query, signal) {
    const res = await fetch(buildUsgsUrl(query), { signal });
    if (!res.ok) throw new Error(`USGS request failed: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as FeatureCollection<Point, UsgsProps>;
    return body.features.map(parseUsgsFeature).filter((q): q is Quake => q !== null);
  },
};
