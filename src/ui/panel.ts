import { DEFAULT_TIME_RANGE, MIN_MAGNITUDE, TIME_RANGES, type TimeRangeId } from '../config';
import type { Quake } from '../data/types';
import { DEPTH_CLASSES, depthColor } from '../scene/style';
import { escapeHtml, formatCoord, formatPHT, timeAgo } from './format';

export interface PanelState {
  timeRange: TimeRangeId;
  minMagnitude: number;
  depthScale: number;
  showStems: boolean;
  showCities: boolean;
}

export interface PanelEvents {
  onTimeRange(id: TimeRangeId): void;
  onFilterChange(): void;
  onDepthScale(scale: number): void;
  onStems(v: boolean): void;
  onCities(v: boolean): void;
  onSelect(q: Quake): void;
  onRefresh(): void;
}

const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;

/** Side panel: filters, stats, legend, event list. Plain DOM, no framework. */
export class Panel {
  readonly state: PanelState = {
    timeRange: DEFAULT_TIME_RANGE,
    minMagnitude: MIN_MAGNITUDE,
    depthScale: 1,
    showStems: true,
    showCities: true,
  };
  private readonly el: HTMLElement;

  constructor(root: HTMLElement, private readonly ev: PanelEvents, attribution: string) {
    root.innerHTML = `
      <header>
        <h1>PH Quake 3D</h1>
        <p class="sub">Earthquakes of magnitude ${MIN_MAGNITUDE.toFixed(1)}+ in the Philippine region</p>
      </header>
      <section class="controls">
        <label>Time range
          <select data-k="range">${TIME_RANGES.map((r) => `<option value="${r.id}">${r.label}</option>`).join('')}</select>
        </label>
        <label>Minimum magnitude <output data-k="magOut"></output>
          <input data-k="mag" type="range" min="${MIN_MAGNITUDE}" max="7" step="0.1" />
        </label>
        <label>Depth exaggeration <output data-k="depthOut"></output>
          <input data-k="depth" type="range" min="0.5" max="4" step="0.1" />
        </label>
        <div class="toggles">
          <label class="check"><input data-k="stems" type="checkbox" /> Depth stems</label>
          <label class="check"><input data-k="cities" type="checkbox" /> City labels</label>
        </div>
      </section>
      <section class="stats" data-k="stats"></section>
      <section class="legend">
        <h2>Hypocentre depth</h2>
        <ul>${DEPTH_CLASSES.map((c) => `<li><span class="dot" style="background:${c.color}"></span>${c.label}</li>`).join('')}</ul>
        <p class="hint">Sphere size = magnitude · ring on surface = epicentre · pulsing = last 24 h</p>
      </section>
      <section class="list">
        <h2>Events <button data-k="refresh" type="button" title="Reload data">↻</button></h2>
        <p class="status" data-k="status">Loading…</p>
        <ol data-k="list"></ol>
      </section>
      <footer>
        ${escapeHtml(attribution)} · Coastlines: Natural Earth.<br />
        For official Philippine bulletins see <a href="https://www.phivolcs.dost.gov.ph/" target="_blank" rel="noopener">PHIVOLCS</a>.
      </footer>`;
    this.el = root;

    const range = $<HTMLSelectElement>(root, '[data-k=range]');
    const mag = $<HTMLInputElement>(root, '[data-k=mag]');
    const depth = $<HTMLInputElement>(root, '[data-k=depth]');
    const stems = $<HTMLInputElement>(root, '[data-k=stems]');
    const cities = $<HTMLInputElement>(root, '[data-k=cities]');
    range.value = this.state.timeRange;
    mag.value = String(this.state.minMagnitude);
    depth.value = String(this.state.depthScale);
    stems.checked = this.state.showStems;
    cities.checked = this.state.showCities;
    const syncOutputs = () => {
      $(root, '[data-k=magOut]').textContent = `M${this.state.minMagnitude.toFixed(1)}`;
      $(root, '[data-k=depthOut]').textContent = `${this.state.depthScale.toFixed(1)}×`;
    };
    syncOutputs();

    range.addEventListener('change', () => {
      this.state.timeRange = range.value as TimeRangeId;
      ev.onTimeRange(this.state.timeRange);
    });
    mag.addEventListener('input', () => {
      this.state.minMagnitude = Math.max(MIN_MAGNITUDE, Number(mag.value));
      syncOutputs();
      ev.onFilterChange();
    });
    depth.addEventListener('input', () => {
      this.state.depthScale = Number(depth.value);
      syncOutputs();
      ev.onDepthScale(this.state.depthScale);
    });
    stems.addEventListener('change', () => ev.onStems((this.state.showStems = stems.checked)));
    cities.addEventListener('change', () => ev.onCities((this.state.showCities = cities.checked)));
    $(root, '[data-k=refresh]').addEventListener('click', () => ev.onRefresh());
  }

  setStatus(text: string, isError = false): void {
    const s = $(this.el, '[data-k=status]');
    s.textContent = text;
    s.classList.toggle('error', isError);
  }

  render(quakes: Quake[], selected: Quake | null): void {
    const stats = $(this.el, '[data-k=stats]');
    if (!quakes.length) {
      stats.innerHTML = `<div class="stat"><b>0</b><span>events</span></div>`;
    } else {
      const strongest = quakes.reduce((a, b) => (b.magnitude > a.magnitude ? b : a));
      const deepest = quakes.reduce((a, b) => (b.depthKm > a.depthKm ? b : a));
      const latest = quakes.reduce((a, b) => (b.time > a.time ? b : a));
      stats.innerHTML = `
        <div class="stat"><b>${quakes.length}</b><span>events</span></div>
        <div class="stat"><b>M${strongest.magnitude.toFixed(1)}</b><span>strongest</span></div>
        <div class="stat"><b>${Math.round(deepest.depthKm)} km</b><span>deepest</span></div>
        <div class="stat"><b>${timeAgo(latest.time)}</b><span>latest</span></div>`;
    }

    const list = $(this.el, '[data-k=list]');
    const sorted = [...quakes].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 200);
    list.innerHTML = sorted
      .map(
        (q) => `
        <li data-id="${escapeHtml(q.id)}" class="${selected?.id === q.id ? 'active' : ''}">
          <span class="mag" style="--c:${depthColor(q.depthKm)}">${q.magnitude.toFixed(1)}</span>
          <span class="meta"><b>${escapeHtml(q.place)}</b><small>${formatPHT(q.time)} · ${Math.round(q.depthKm)} km deep</small></span>
        </li>`,
      )
      .join('');
    const byId = new Map(sorted.map((q) => [q.id, q]));
    list.querySelectorAll('li').forEach((li) =>
      li.addEventListener('click', () => {
        const q = byId.get(li.dataset.id!);
        if (q) this.ev.onSelect(q);
      }),
    );
  }
}

/** Floating card with full details of the selected event. */
export function renderDetails(el: HTMLElement, q: Quake | null, onClose: () => void): void {
  el.hidden = !q;
  if (!q) return;
  el.innerHTML = `
    <button class="close" type="button" aria-label="Close">×</button>
    <div class="big" style="--c:${depthColor(q.depthKm)}">M${q.magnitude.toFixed(1)} <small>${escapeHtml(q.magType)}</small></div>
    <h3>${escapeHtml(q.place)}</h3>
    <dl>
      <dt>Time</dt><dd>${formatPHT(q.time)}<br /><small>${q.time.toISOString().replace('.000Z', 'Z')} · ${timeAgo(q.time)}</small></dd>
      <dt>Epicentre</dt><dd>${formatCoord(q.lat, q.lon)}</dd>
      <dt>Depth</dt><dd>${q.depthKm.toFixed(1)} km</dd>
      ${q.tsunami ? '<dt>Tsunami</dt><dd class="warn">Tsunami flag issued — check PHIVOLCS advisories</dd>' : ''}
    </dl>
    <a href="${escapeHtml(q.url)}" target="_blank" rel="noopener">View on USGS ↗</a>`;
  el.querySelector('.close')!.addEventListener('click', onClose);
}

export function renderTooltip(el: HTMLElement, q: Quake | null, x: number, y: number): void {
  el.hidden = !q;
  if (!q) return;
  el.innerHTML = `<b>M${q.magnitude.toFixed(1)}</b> · ${Math.round(q.depthKm)} km<br />${escapeHtml(q.place)}`;
  el.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
}
