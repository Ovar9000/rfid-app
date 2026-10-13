import { describe, expect, it } from 'vitest';
import { REGION } from '../src/config';
import { buildUsgsUrl, parseUsgsFeature } from '../src/data/usgs';

describe('buildUsgsUrl', () => {
  it('requests M4+ earthquakes inside the Philippine bbox', () => {
    const url = new URL(
      buildUsgsUrl({ region: REGION, minMagnitude: 1, start: new Date('2026-01-01T00:00:00Z'), end: new Date('2026-02-01T00:00:00Z') }),
    );
    expect(url.origin + url.pathname).toBe('https://earthquake.usgs.gov/fdsnws/event/1/query');
    const p = url.searchParams;
    expect(p.get('minmagnitude')).toBe('4');
    expect(p.get('eventtype')).toBe('earthquake');
    expect(p.get('minlatitude')).toBe(String(REGION.minLat));
    expect(p.get('maxlongitude')).toBe(String(REGION.maxLon));
    expect(p.get('starttime')).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('parseUsgsFeature', () => {
  // Shape mirrors the USGS GeoJSON format; values are synthetic.
  const feature = (overrides: Record<string, unknown> = {}) => ({
    type: 'Feature' as const,
    id: 'test001',
    geometry: { type: 'Point' as const, coordinates: [126.5, 9.1, 33.2] },
    properties: { mag: 5.3, magType: 'mww', place: 'test place', time: 1_700_000_000_000, url: 'https://example.test', tsunami: 0, type: 'earthquake', ...overrides },
  });

  it('maps coordinates and properties', () => {
    const q = parseUsgsFeature(feature())!;
    expect(q).toMatchObject({ id: 'test001', magnitude: 5.3, lat: 9.1, lon: 126.5, depthKm: 33.2, tsunami: false });
    expect(q.time.getTime()).toBe(1_700_000_000_000);
  });

  it('rejects rows without a magnitude or that are not earthquakes', () => {
    expect(parseUsgsFeature(feature({ mag: null }))).toBeNull();
    expect(parseUsgsFeature(feature({ type: 'quarry blast' }))).toBeNull();
  });
});
