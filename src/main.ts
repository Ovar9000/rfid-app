import * as THREE from 'three';
import './style.css';
import { MIN_MAGNITUDE, REFRESH_INTERVAL_MS, REGION, TIME_RANGES } from './config';
import { filterQuakes } from './data/filter';
import type { Quake, QuakeSource } from './data/types';
import { usgsSource } from './data/usgs';
import { loadCoastline } from './geo/coastline';
import { Basemap } from './scene/basemap';
import { QuakeLayer } from './scene/quakeLayer';
import { Stage } from './scene/stage';
import { Panel, renderDetails, renderTooltip } from './ui/panel';

const source: QuakeSource = usgsSource;

const viewport = document.getElementById('viewport')!;
const detailsEl = document.getElementById('details')!;
const tooltipEl = document.getElementById('tooltip')!;

const stage = new Stage(viewport);
const layer = new QuakeLayer();
stage.scene.add(layer.group);
stage.onTick((t) => layer.tick(t));

let basemap: Basemap | null = null;
let all: Quake[] = [];
let visible: Quake[] = [];
let selected: Quake | null = null;
let inflight: AbortController | null = null;

const panel = new Panel(
  document.getElementById('panel')!,
  {
    onTimeRange: () => load(),
    onFilterChange: () => applyFilter(),
    onDepthScale: (s) => {
      layer.setDepthScale(s);
      basemap?.setDepthScale(s);
    },
    onStems: (v) => layer.setStemsVisible(v),
    onCities: (v) => basemap?.setCitiesVisible(v),
    onSelect: (q) => select(q, true),
    onRefresh: () => load(),
  },
  source.attribution,
);

function applyFilter(): void {
  visible = filterQuakes(all, { minMagnitude: panel.state.minMagnitude, region: REGION });
  if (selected && !visible.includes(selected)) select(null);
  layer.setQuakes(visible);
  panel.render(visible, selected);
}

function select(q: Quake | null, fly = false): void {
  selected = q;
  layer.select(q);
  renderDetails(detailsEl, q, () => select(null));
  panel.render(visible, selected);
  if (q && fly) stage.flyTo(layer.hypocentre(q));
}

async function load(): Promise<void> {
  inflight?.abort();
  const ctrl = (inflight = new AbortController());
  const days = TIME_RANGES.find((r) => r.id === panel.state.timeRange)!.days;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  panel.setStatus('Loading…');
  try {
    // Always fetch the full M4+ set; the slider narrows it client-side.
    all = await source.fetch({ region: REGION, minMagnitude: MIN_MAGNITUDE, start, end }, ctrl.signal);
    // Keep the current selection if it is still in the new data.
    if (selected) selected = all.find((q) => q.id === selected!.id) ?? null;
    applyFilter();
    panel.setStatus(`Updated ${end.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })} PHT · ${source.name}`);
  } catch (err) {
    if (ctrl.signal.aborted) return;
    console.error(err);
    panel.setStatus(`Could not load data from ${source.name}. ${(err as Error).message}`, true);
  }
}

// Hover + click picking.
const ndc = new THREE.Vector2();
let downAt: { x: number; y: number } | null = null;
const toNdc = (e: PointerEvent) => {
  const r = stage.renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  return r;
};
stage.renderer.domElement.addEventListener('pointermove', (e) => {
  const r = toNdc(e);
  const q = layer.pick(ndc, stage.camera);
  renderTooltip(tooltipEl, q, e.clientX - r.left, e.clientY - r.top);
  stage.renderer.domElement.style.cursor = q ? 'pointer' : '';
});
stage.renderer.domElement.addEventListener('pointerleave', () => renderTooltip(tooltipEl, null, 0, 0));
stage.renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
stage.renderer.domElement.addEventListener('pointerup', (e) => {
  // Ignore drags (orbiting).
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
  toNdc(e);
  select(layer.pick(ndc, stage.camera));
});
window.addEventListener('keydown', (e) => e.key === 'Escape' && select(null));

loadCoastline()
  .then((coast) => {
    basemap = new Basemap(coast);
    basemap.setDepthScale(panel.state.depthScale);
    basemap.setCitiesVisible(panel.state.showCities);
    stage.scene.add(basemap.group);
  })
  .catch((err) => console.error(err));

load();
setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_INTERVAL_MS);
