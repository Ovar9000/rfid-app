import * as THREE from 'three';
import type { Quake } from '../data/types';
import { project } from '../geo/projection';
import { depthColor, magnitudeRadius } from './style';

const RECENT_MS = 24 * 60 * 60 * 1000;
const SURFACE_Y = 0.45;
const MAX_INSTANCES = 20000;

/**
 * Renders each earthquake as:
 *   - a sphere at its hypocentre (size = magnitude, colour = depth)
 *   - a vertical stem up to the surface
 *   - a ring marking the epicentre on the surface
 *   - a pulsing ring if it happened in the last 24 h
 */
export class QuakeLayer {
  readonly group = new THREE.Group();
  private quakes: Quake[] = [];
  private depthScale = 1;
  private selected: Quake | null = null;
  private readonly spheres: THREE.InstancedMesh;
  private readonly epicentres: THREE.InstancedMesh;
  private readonly pulses: THREE.InstancedMesh;
  private readonly stems: THREE.LineSegments;
  private readonly highlight: THREE.Mesh;
  private recent: { idx: number; base: THREE.Vector3; r: number }[] = [];
  private readonly tmp = new THREE.Object3D();
  private readonly raycaster = new THREE.Raycaster();

  constructor() {
    this.spheres = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1, emissive: 0x222222 }),
      MAX_INSTANCES,
    );
    this.epicentres = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
      MAX_INSTANCES,
    );
    this.pulses = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      MAX_INSTANCES,
    );
    this.stems = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45 }),
    );
    this.highlight = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 }),
    );
    this.highlight.visible = false;
    for (const m of [this.spheres, this.epicentres, this.pulses]) m.count = 0;
    this.group.add(this.stems, this.spheres, this.epicentres, this.pulses, this.highlight);
  }

  setQuakes(quakes: Quake[]): void {
    this.quakes = quakes.slice(0, MAX_INSTANCES);
    if (this.selected && !this.quakes.some((q) => q.id === this.selected!.id)) this.selected = null;
    this.layout();
  }

  setDepthScale(scale: number): void {
    this.depthScale = scale;
    this.layout();
  }

  setStemsVisible(v: boolean): void {
    this.stems.visible = v;
  }

  hypocentre(q: Quake): THREE.Vector3 {
    const p = project(q.lat, q.lon, q.depthKm, this.depthScale);
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  select(q: Quake | null): void {
    this.selected = q;
    this.highlight.visible = !!q;
    if (!q) return;
    this.highlight.position.copy(this.hypocentre(q));
    this.highlight.scale.setScalar(magnitudeRadius(q.magnitude) * 1.6);
  }

  /** Returns the quake under the given normalised device coordinates, if any. */
  pick(ndc: THREE.Vector2, camera: THREE.Camera): Quake | null {
    this.raycaster.setFromCamera(ndc, camera);
    const hit = this.raycaster.intersectObject(this.spheres, false)[0];
    return hit?.instanceId != null ? this.quakes[hit.instanceId] ?? null : null;
  }

  /** Animate pulses for recent events. */
  tick(t: number): void {
    if (!this.recent.length) return;
    const phase = (t % 2) / 2;
    (this.pulses.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - phase);
    this.recent.forEach((r, i) => {
      this.tmp.position.copy(r.base);
      this.tmp.scale.setScalar(r.r * (1.5 + phase * 4));
      this.tmp.updateMatrix();
      this.pulses.setMatrixAt(i, this.tmp.matrix);
    });
    this.pulses.instanceMatrix.needsUpdate = true;
  }

  private layout(): void {
    const color = new THREE.Color();
    const stemPos: number[] = [];
    const stemCol: number[] = [];
    const now = Date.now();
    this.recent = [];

    this.quakes.forEach((q, i) => {
      const r = magnitudeRadius(q.magnitude);
      const hypo = this.hypocentre(q);
      color.set(depthColor(q.depthKm));

      this.tmp.position.copy(hypo);
      this.tmp.scale.setScalar(r);
      this.tmp.updateMatrix();
      this.spheres.setMatrixAt(i, this.tmp.matrix);
      this.spheres.setColorAt(i, color);

      this.tmp.position.set(hypo.x, SURFACE_Y, hypo.z);
      this.tmp.scale.setScalar(r * 0.9);
      this.tmp.updateMatrix();
      this.epicentres.setMatrixAt(i, this.tmp.matrix);
      this.epicentres.setColorAt(i, color);

      stemPos.push(hypo.x, SURFACE_Y, hypo.z, hypo.x, hypo.y, hypo.z);
      stemCol.push(color.r, color.g, color.b, color.r, color.g, color.b);

      if (now - q.time.getTime() < RECENT_MS) this.recent.push({ idx: i, base: new THREE.Vector3(hypo.x, SURFACE_Y + 0.01, hypo.z), r });
    });

    this.spheres.count = this.epicentres.count = this.quakes.length;
    this.pulses.count = this.recent.length;
    for (const m of [this.spheres, this.epicentres]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
    this.stems.geometry.dispose();
    this.stems.geometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.Float32BufferAttribute(stemPos, 3))
      .setAttribute('color', new THREE.Float32BufferAttribute(stemCol, 3));
    this.select(this.selected);
    this.tick(0);
  }
}
