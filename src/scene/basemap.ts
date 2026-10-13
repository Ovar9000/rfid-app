import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CITIES, MAX_DEPTH_KM, REGION } from '../config';
import type { Coastline } from '../geo/coastline';
import { project } from '../geo/projection';

const LAND_HEIGHT = 0.35;

function label(text: string, className: string): CSS2DObject {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}

/** Region bounds in scene space and matching clipping planes. */
function regionFrame() {
  const sw = project(REGION.minLat, REGION.minLon);
  const ne = project(REGION.maxLat, REGION.maxLon);
  const clip = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -sw.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), ne.x),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), sw.z),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -ne.z),
  ];
  return { minX: sw.x, maxX: ne.x, minZ: ne.z, maxZ: sw.z, clip };
}

/**
 * Static geography: translucent sea surface, extruded land, coastlines,
 * graticule, city labels, and a depth box that rescales with exaggeration.
 */
export class Basemap {
  readonly group = new THREE.Group();
  private readonly depthGroup = new THREE.Group();
  private readonly cityGroup = new THREE.Group();
  private readonly frame = regionFrame();

  constructor(coast: Coastline) {
    this.group.add(this.buildSea(), this.buildLand(coast), this.buildGraticule(), this.cityGroup, this.depthGroup);
    this.buildCities();
    this.setDepthScale(1);
  }

  setCitiesVisible(v: boolean): void {
    this.cityGroup.visible = v;
  }

  setDepthScale(scale: number): void {
    this.depthGroup.traverse((o) => {
      if (o instanceof CSS2DObject) o.element.remove();
    });
    this.depthGroup.clear();
    const { minX, maxX, minZ, maxZ } = this.frame;
    const bottom = project(0, 0, MAX_DEPTH_KM, scale).y;

    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    // Vertical edges of the depth box.
    for (const [x, z] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]]) seg([x, 0, z], [x, bottom, z]);
    // Depth rings every 100 km on the back (north) and west walls.
    for (let d = 100; d <= MAX_DEPTH_KM; d += 100) {
      const y = project(0, 0, d, scale).y;
      seg([minX, y, minZ], [maxX, y, minZ]);
      seg([minX, y, minZ], [minX, y, maxZ]);
      const l = label(`${d} km`, 'depth-label');
      l.position.set(minX, y, maxZ);
      this.depthGroup.add(l);
    }
    seg([maxX, bottom, minZ], [maxX, bottom, maxZ]);
    seg([minX, bottom, maxZ], [maxX, bottom, maxZ]);
    const geom = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.depthGroup.add(
      new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: 0x3a5a80, transparent: true, opacity: 0.45 })),
    );
  }

  private buildSea(): THREE.Mesh {
    const { minX, maxX, minZ, maxZ } = this.frame;
    const geom = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2);
    geom.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    return new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({ color: 0x0d4a7a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
  }

  private buildLand(coast: Coastline): THREE.Group {
    const group = new THREE.Group();
    const phGeoms: THREE.BufferGeometry[] = [];
    const otherGeoms: THREE.BufferGeometry[] = [];
    const outline: number[] = [];

    for (const f of coast.features) {
      for (const poly of f.geometry.coordinates) {
        const toVec = ([lon, lat]: number[]) => {
          const p = project(lat, lon);
          return new THREE.Vector2(p.x, p.z);
        };
        const shape = new THREE.Shape(poly[0].map(toVec));
        shape.holes = poly.slice(1).map((r) => new THREE.Path(r.map(toVec)));
        const g = new THREE.ExtrudeGeometry(shape, { depth: LAND_HEIGHT, bevelEnabled: false });
        // Shape lies in XY with y = scene z; rotate onto the ground, extrusion goes down, lift back up.
        g.rotateX(Math.PI / 2).translate(0, LAND_HEIGHT, 0);
        (f.properties.philippines ? phGeoms : otherGeoms).push(g);

        for (const ring of poly) {
          for (let i = 1; i < ring.length; i++) {
            const a = project(ring[i - 1][1], ring[i - 1][0]);
            const b = project(ring[i][1], ring[i][0]);
            outline.push(a.x, LAND_HEIGHT + 0.02, a.z, b.x, LAND_HEIGHT + 0.02, b.z);
          }
        }
      }
    }

    const clip = this.frame.clip;
    const mat = (color: number, opacity: number) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, transparent: true, opacity, side: THREE.DoubleSide, clippingPlanes: clip });
    if (phGeoms.length) group.add(new THREE.Mesh(mergeGeometries(phGeoms), mat(0x3f7d4f, 0.82)));
    if (otherGeoms.length) group.add(new THREE.Mesh(mergeGeometries(otherGeoms), mat(0x4a4f45, 0.55)));
    group.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(outline, 3)),
        new THREE.LineBasicMaterial({ color: 0xbfe6c8, transparent: true, opacity: 0.7, clippingPlanes: clip }),
      ),
    );
    return group;
  }

  private buildGraticule(): THREE.Group {
    const group = new THREE.Group();
    const pts: number[] = [];
    const y = 0.05;
    for (let lon = Math.ceil(REGION.minLon / 2) * 2; lon <= REGION.maxLon; lon += 2) {
      const a = project(REGION.minLat, lon, 0);
      const b = project(REGION.maxLat, lon, 0);
      pts.push(a.x, y, a.z, b.x, y, b.z);
      const l = label(`${lon}°E`, 'grid-label');
      l.position.set(a.x, y, a.z + 3);
      group.add(l);
    }
    for (let lat = Math.ceil(REGION.minLat / 2) * 2; lat <= REGION.maxLat; lat += 2) {
      const a = project(lat, REGION.minLon, 0);
      const b = project(lat, REGION.maxLon, 0);
      pts.push(a.x, y, a.z, b.x, y, b.z);
      const l = label(`${lat}°N`, 'grid-label');
      l.position.set(b.x + 4, y, b.z);
      group.add(l);
    }
    group.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
        new THREE.LineBasicMaterial({ color: 0x2d4d6e, transparent: true, opacity: 0.5 }),
      ),
    );
    return group;
  }

  private buildCities(): void {
    for (const c of CITIES) {
      const l = label(c.name, 'city-label');
      const p = project(c.lat, c.lon, 0);
      l.position.set(p.x, LAND_HEIGHT + 0.1, p.z);
      this.cityGroup.add(l);
    }
  }
}
