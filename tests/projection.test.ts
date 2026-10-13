import { describe, expect, it } from 'vitest';
import { ORIGIN, UNITS_PER_KM } from '../src/config';
import { project, unproject } from '../src/geo/projection';

describe('projection', () => {
  it('puts the origin at 0,0,0', () => {
    const p = project(ORIGIN.lat, ORIGIN.lon);
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(0);
  });

  it('maps north to -z, east to +x and depth to -y', () => {
    const p = project(ORIGIN.lat + 1, ORIGIN.lon + 1, 100);
    expect(p.z).toBeLessThan(0);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeCloseTo(-100 * UNITS_PER_KM);
  });

  it('round-trips', () => {
    const p = project(10.3, 123.9);
    const back = unproject(p.x, p.z);
    expect(back.lat).toBeCloseTo(10.3);
    expect(back.lon).toBeCloseTo(123.9);
  });
});
