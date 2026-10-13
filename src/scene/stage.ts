import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/** Renderer, camera, controls and the render loop. */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer = new CSS2DRenderer();
  readonly controls: OrbitControls;
  private readonly tickers: ((t: number, dt: number) => void)[] = [];
  private flight: { from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; t: number } | null = null;

  constructor(private readonly container: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.set(-10, 150, 230);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.setClearColor(0x05080f);
    container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, -35, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 600;
    this.controls.addEventListener('start', () => (this.flight = null));

    this.scene.fog = new THREE.Fog(0x05080f, 400, 900);
    this.scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x1a1208, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-80, 200, 120);
    this.scene.add(sun);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();

    const timer = new THREE.Timer();
    this.renderer.setAnimationLoop((ts) => {
      timer.update(ts);
      const dt = timer.getDelta();
      const t = timer.getElapsed();
      this.stepFlight(dt);
      this.controls.update();
      for (const fn of this.tickers) fn(t, dt);
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    });
  }

  onTick(fn: (t: number, dt: number) => void): void {
    this.tickers.push(fn);
  }

  /** Smoothly move the orbit target to `point`, keeping a sensible viewing distance. */
  flyTo(point: THREE.Vector3, distance = 60): void {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.flight = {
      from: this.controls.target.clone(),
      to: point.clone(),
      camFrom: this.camera.position.clone(),
      camTo: point.clone().add(dir.multiplyScalar(distance)),
      t: 0,
    };
  }

  private stepFlight(dt: number): void {
    if (!this.flight) return;
    const f = this.flight;
    f.t = Math.min(1, f.t + dt / 1.2);
    const k = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
    this.controls.target.lerpVectors(f.from, f.to, k);
    this.camera.position.lerpVectors(f.camFrom, f.camTo, k);
    if (f.t >= 1) this.flight = null;
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }
}
