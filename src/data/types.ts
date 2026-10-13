import type { BBox } from '../config';

/** Normalised earthquake record, independent of the upstream provider. */
export interface Quake {
  id: string;
  magnitude: number;
  magType: string;
  /** Epicentre */
  lat: number;
  lon: number;
  /** Hypocentre depth below sea level, km (positive down). */
  depthKm: number;
  time: Date;
  place: string;
  url: string;
  /** Present when the provider has issued a tsunami flag. */
  tsunami: boolean;
}

export interface QuakeQuery {
  region: BBox;
  minMagnitude: number;
  start: Date;
  end: Date;
}

/**
 * A pluggable earthquake data provider. USGS is the default; a PHIVOLCS
 * adapter (or a proxy to it) can implement the same interface.
 */
export interface QuakeSource {
  readonly name: string;
  readonly attribution: string;
  fetch(query: QuakeQuery, signal?: AbortSignal): Promise<Quake[]>;
}
