import { MIN_MAGNITUDE } from '../config';

/** Depth classes used for colouring hypocentres (km). */
export const DEPTH_CLASSES = [
  { max: 70, color: '#ff4d3d', label: 'Shallow · 0–70 km' },
  { max: 150, color: '#ff9f2e', label: '70–150 km' },
  { max: 300, color: '#ffe14d', label: '150–300 km' },
  { max: 500, color: '#44d1ff', label: '300–500 km' },
  { max: Infinity, color: '#7a6bff', label: 'Deep · 500 km+' },
] as const;

export function depthColor(depthKm: number): string {
  return (DEPTH_CLASSES.find((c) => depthKm < c.max) ?? DEPTH_CLASSES[DEPTH_CLASSES.length - 1]).color;
}

/** Sphere radius in scene units. Grows ~1.6x per magnitude unit. */
export function magnitudeRadius(mag: number): number {
  return 0.45 * Math.pow(1.6, Math.max(0, mag - MIN_MAGNITUDE));
}
