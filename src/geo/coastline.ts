import type { FeatureCollection, MultiPolygon } from 'geojson';

export interface CoastlineProps {
  name: string;
  philippines: boolean;
}

export type Coastline = FeatureCollection<MultiPolygon, CoastlineProps>;

/** Loads the pre-built land polygons (see scripts/build-coastline.mjs). */
export async function loadCoastline(): Promise<Coastline> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/coastline.geojson`);
  if (!res.ok) throw new Error(`Failed to load coastline: ${res.status}`);
  return res.json();
}
