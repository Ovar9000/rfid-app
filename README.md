# PH Quake 3D

A 3D web visualization of **magnitude 4.0+ earthquakes in the Philippines**.
Each event is drawn at its true hypocentre (depth below the surface), with a stem up to its
**epicentre** on a 3D map of the archipelago. Orbit, zoom and click any event for details.

- **Data:** live from the USGS FDSN Event API (ComCat). It refreshes every 5 minutes.
- **Filter:** only M4.0 and up. The site sends this in the API query and checks it again on the client
  (`src/data/filter.ts`). The magnitude slider can raise the threshold but never lower it below 4.0.
- **Region:** 4.0°N–21.5°N, 116°E–128°E (Batanes to the Celebes Sea, east past the Philippine Trench).
- **Encoding:** sphere size = magnitude, colour = depth class, ring = epicentre, pulse = last 24 h.
- **Times** are shown in Philippine Standard Time (UTC+8).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (filter, USGS parsing, projection)
npm run build      # type-check + production build into dist/
```

## Project structure

```
src/
  config.ts            Region bbox, MIN_MAGNITUDE (4.0), time ranges, cities, scale
  data/
    types.ts           Quake model + QuakeSource interface (pluggable providers)
    usgs.ts            USGS FDSN adapter: query builder + GeoJSON parser
    filter.ts          Magnitude floor / region / depth filtering (pure, tested)
  geo/
    projection.ts      lat/lon/depth -> 3D scene coordinates (local equirectangular)
    coastline.ts       Loads public/data/coastline.geojson
  scene/
    stage.ts           Three.js renderer, camera, OrbitControls, fly-to animation
    basemap.ts         Sea surface, extruded land, coastlines, graticule, depth box, city labels
    quakeLayer.ts      Instanced hypocentre spheres, stems, epicentre rings, pulses, picking
    style.ts           Depth colour scale and magnitude→size
  ui/
    panel.ts           Filters, stats, legend, event list, details card, tooltip
    format.ts          PHT time formatting, coordinates, escaping
  main.ts              Wires data → filter → scene + UI
scripts/build-coastline.mjs   Regenerates the coastline from Natural Earth 1:10m (world-atlas)
tests/                         Vitest unit tests
.github/workflows/deploy.yml   CI (test + build) and GitHub Pages deploy on main
```

## Extending

- **Another data source (e.g. PHIVOLCS):** implement `QuakeSource` in `src/data/` and swap
  `source` in `src/main.ts`. PHIVOLCS has no public JSON API, so it would need a small backend or
  scraper proxy, plus CORS. The M4+ filter still applies, because `filterQuakes` runs on all data.
- **Different region or threshold:** edit `REGION` / `MIN_MAGNITUDE` in `src/config.ts`. If you change
  the region, also update the box in `scripts/build-coastline.mjs` and run `npm run build:coastline`.
- **Fault lines / trenches:** add a layer class like `QuakeLayer` that takes GeoJSON lines and
  projects them with `project()`.

## Deploying

The workflow in `.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every
push to `main`. To turn it on, go to **Settings → Pages → Source: GitHub Actions**. On free GitHub
plans, Pages needs a public repository.

## Attribution & disclaimer

Earthquake data comes from the U.S. Geological Survey. Coastlines are from Natural Earth (public domain).
This is a visualization tool, not an official source. For official Philippine earthquake bulletins and
tsunami advisories, see [PHIVOLCS](https://www.phivolcs.dost.gov.ph/).
