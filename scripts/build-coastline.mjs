// Extracts land polygons that fall inside the Philippine region from the
// Natural Earth 1:10m dataset (via world-atlas) and writes a compact GeoJSON
// to public/data/coastline.geojson. Run with: npm run build:coastline
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-10m.json'), 'utf8'));

// Keep in sync with REGION in src/config.ts (padded slightly so coasts reach the edge).
const PAD = 0.5;
const box = { minLat: 4.0 - PAD, maxLat: 21.5 + PAD, minLon: 116.0 - PAD, maxLon: 128.0 + PAD };
const PH_ID = '608';

const round = (n) => Math.round(n * 1000) / 1000;
const ringInBox = (ring) =>
  ring.some(([lon, lat]) => lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat);

const countries = feature(topo, topo.objects.countries).features;
const out = [];
for (const f of countries) {
  const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates]
    : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  const kept = polys
    .filter((p) => ringInBox(p[0]))
    .map((p) => p.map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])));
  if (kept.length) {
    out.push({
      type: 'Feature',
      properties: { name: f.properties.name, philippines: f.id === PH_ID },
      geometry: { type: 'MultiPolygon', coordinates: kept },
    });
  }
}

writeFileSync('public/data/coastline.geojson', JSON.stringify({ type: 'FeatureCollection', features: out }));
console.log(`wrote ${out.length} features:`, out.map((f) => f.properties.name).join(', '));
