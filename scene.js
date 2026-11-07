import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/*
  A Little Universe — reference-faithful layered 3D artwork.
  The uploaded reference artwork is split into three image planes (sky,
  cloud/mountain band, and lake/foreground). The planes have real depth,
  gentle independent parallax, and slow drift. No procedural puff clouds.
*/
const canvas = document.getElementById('worldCanvas');
if (!canvas) throw new Error('Missing #worldCanvas');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
camera.position.set(0, 0, 30);
camera.lookAt(0, 0, 0);
const clock = new THREE.Clock();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const worlds = {};
let activeWorld = 'entrance';
const pointer = new THREE.Vector2(0, 0);
const smoothPointer = new THREE.Vector2(0, 0);

const imageLoader = new THREE.TextureLoader();
function texture(path) {
  const t = imageLoader.load(path);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  return t;
}

function imagePlane(scene, path, width, height, x, y, z, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({
    map: texture(path),
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, z);
  mesh.renderOrder = Math.round((z + 30) * 10);
  scene.add(mesh);
  return mesh;
}

function createWorld(prefix, panelWidth, panelHeight) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#160d2b');
  const root = new THREE.Group();
  scene.add(root);

  // The blurred artwork fills only the side margins on wide screens.
  const sideFill = imagePlane(
    root,
    `assets/${prefix}-sidefill.jpg`,
    20,
    12,
    0,
    0,
    -24,
    0.92
  );

  const unit = 10 / panelHeight;
  const panelWorldWidth = panelWidth * unit;
  const bandDefs = [
    { file: 1, y0: 0, y1: 625, z: -17, drift: 0.012 },
    { file: 2, y0: 613, y1: 820, z: -11, drift: 0.035 },
    { file: 3, y0: 808, y1: 941, z: -5, drift: 0.060 }
  ];
  const bands = bandDefs.map((b) => {
    const h = (b.y1 - b.y0) * unit;
    const centerY = (panelHeight / 2 - (b.y0 + b.y1) / 2) * unit;
    const mesh = imagePlane(
      root,
      `assets/${prefix}-layer-${b.file}.png`,
      panelWorldWidth,
      h,
      0,
      centerY,
      b.z,
      1
    );
    return { mesh, drift: b.drift, baseX: 0, baseY: centerY };
  });

  // A few very small glints add life without competing with the reference stars.
  const starPositions = [];
  let seed = prefix === 'entrance' ? 17 : 41;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 34; i++) {
    const x = (random() - 0.5) * panelWorldWidth * 0.92;
    const y = (random() * 0.55 + 0.12) * 5 - 2.5;
    const z = -3.5 + random() * 0.6;
    starPositions.push(x, y, z);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffe2f4,
    size: 0.035,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const glints = new THREE.Points(starGeometry, starMaterial);
  glints.renderOrder = 300;
  root.add(glints);

  return { scene, root, sideFill, bands, glints, panelWorldWidth };
}

// Dimensions are the two separate panels in the supplied reference image.
worlds.entrance = createWorld('entrance', 552, 941);
worlds.heaven = createWorld('main', 1112, 941);
worlds.heaven.scene.visible = false;
if (window.__universeWorld === 'heaven') {
  worlds.entrance.scene.visible = false;
  worlds.heaven.scene.visible = true;
  activeWorld = 'heaven';
}

document.addEventListener('universe:world', (event) => {
  const next = event.detail === 'heaven' ? 'heaven' : 'entrance';
  if (next === activeWorld) return;
  worlds[activeWorld].scene.visible = false;
  activeWorld = next;
  worlds[activeWorld].scene.visible = true;
});

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
  pointer.y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
}, { passive: true });

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const aspect = width / height;
  const viewHeight = 10;
  const viewWidth = viewHeight * aspect;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(width, height, false);

  // Keep the crisp artwork at its original proportions and fill any extra
  // desktop width with the softly blurred edge treatment behind it.
  for (const world of Object.values(worlds)) {
    world.root.scale.setScalar(1);
    world.sideFill.scale.set(viewWidth / 20, viewHeight / 12, 1);
  }
}
window.addEventListener('resize', resize, { passive: true });
resize();

function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const time = clock.getElapsedTime();
  const world = worlds[activeWorld];

  if (!reduceMotion) {
    smoothPointer.lerp(pointer, 0.025);
    world.bands.forEach((band, index) => {
      const depth = index + 1;
      const wave = Math.sin(time * (0.11 + index * 0.025) + index * 1.4);
      band.mesh.position.x = band.baseX + smoothPointer.x * band.drift * 1.7 + wave * band.drift * 0.32;
      band.mesh.position.y = band.baseY - smoothPointer.y * band.drift * 0.65 + Math.sin(time * 0.13 + index) * 0.008 * depth;
    });
    world.glints.material.opacity = 0.27 + (Math.sin(time * 0.8) + 1) * 0.075;
  }
  renderer.render(world.scene, camera);
}
animate();
