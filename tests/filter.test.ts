import { describe, expect, it } from 'vitest';
import { MIN_MAGNITUDE, REGION } from '../src/config';
import { effectiveMinMagnitude, filterQuakes } from '../src/data/filter';
import type { Quake } from '../src/data/types';

// Synthetic test fixtures, not real events.
const q = (id: string, magnitude: number, lat = 12, lon = 122, depthKm = 10): Quake => ({
  id, magnitude, magType: 'mb', lat, lon, depthKm, time: new Date(0), place: 'test', url: '', tsunami: false,
});

describe('magnitude floor', () => {
  it('is 4.0', () => expect(MIN_MAGNITUDE).toBe(4));

  it('clamps requests below M4 up to M4', () => {
    expect(effectiveMinMagnitude(2.5)).toBe(4);
    expect(effectiveMinMagnitude(NaN)).toBe(4);
    expect(effectiveMinMagnitude(5.2)).toBe(5.2);
  });

  it('drops everything below M4 even if asked for lower', () => {
    const out = filterQuakes([q('a', 3.9), q('b', 4.0), q('c', 6.1)], { minMagnitude: 0, region: REGION });
    expect(out.map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('honours a higher user threshold', () => {
    const out = filterQuakes([q('a', 4.4), q('b', 5.0)], { minMagnitude: 4.5, region: REGION });
    expect(out.map((x) => x.id)).toEqual(['b']);
  });
});

describe('region filter', () => {
  it('keeps the archipelago and drops points outside', () => {
    const out = filterQuakes(
      [q('manila', 5, 14.6, 121.0), q('davao', 5, 7.2, 125.5), q('tokyo', 5, 35.7, 139.7), q('jakarta', 5, -6.2, 106.8)],
      { minMagnitude: 4, region: REGION },
    );
    expect(out.map((x) => x.id)).toEqual(['manila', 'davao']);
  });

  it('applies optional depth bounds', () => {
    const out = filterQuakes([q('s', 5, 12, 122, 15), q('d', 5, 12, 122, 550)], {
      minMagnitude: 4, region: REGION, minDepthKm: 300,
    });
    expect(out.map((x) => x.id)).toEqual(['d']);
  });
});
