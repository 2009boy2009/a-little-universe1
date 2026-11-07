import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* A Little Universe — two separate, real-time 3D night scenes.
   All scenery is generated locally in WebGL; no screenshot or flat background image is used. */
const canvas = document.getElementById('worldCanvas');
if (!canvas) throw new Error('The world canvas is missing.');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 1.6, 19);
camera.lookAt(0, 0.1, -2);

const clock = new THREE.Clock();
const worlds = {};
let activeWorld = 'entrance';
let frame = 0;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function makeStarField(group, count, spread, zNear, zFar, size) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (seeded(i + 2) - 0.5) * spread;
    positions[i * 3 + 1] = (seeded(i + 300) - 0.5) * spread * 0.62;
    positions[i * 3 + 2] = zFar + seeded(i + 800) * (zNear - zFar);
    const tint = seeded(i + 900);
    colors[i * 3] = 0.82 + tint * 0.18;
    colors[i * 3 + 1] = 0.69 + tint * 0.22;
    colors[i * 3 + 2] = 0.88 + tint * 0.12;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  group.add(points);
  return points;
}

function moonGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128,128,8,128,128,126);
  g.addColorStop(0, 'rgba(255,220,239,.52)');
  g.addColorStop(.25, 'rgba(255,178,221,.18)');
  g.addColorStop(1, 'rgba(255,150,210,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTexture = moonGlowTexture();

function addMoon(group, x, y, z, radius) {
  const moon = new THREE.Group();
  moon.position.set(x,y,z);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 72, 56),
    new THREE.MeshStandardMaterial({ color: 0xffe7f2, roughness: 0.96, metalness: 0, emissive: 0x241322, emissiveIntensity: 0.13 })
  );
  // Side-lit sphere: the visible lit portion forms a true 3D crescent terminator.
  const light = new THREE.DirectionalLight(0xffc6df, 4.0);
  light.position.set(4.5, 0.5, -3.1);
  moon.add(sphere, light);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffc4e5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.62 }));
  glow.scale.set(radius * 5.4, radius * 5.4, 1);
  glow.position.z = -0.12;
  moon.add(glow);
  // A tiny atmospheric rim, not a flat crescent graphic.
  group.add(moon);
  return moon;
}

function cloudMaterial(colorA, colorB, opacity, seed) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColorA: { value: new THREE.Color(colorA) }, uColorB: { value: new THREE.Color(colorB) }, uOpacity: { value: opacity }, uSeed: { value: seed } },
    vertexShader: `varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vWorld; uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB; uniform float uOpacity; uniform float uSeed;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.0,a=.55;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=.5;}return v;}
      void main(){vec2 p=vUv; p.x+=uTime*.004; float n=fbm(p*vec2(5.2,2.8)+vec2(uSeed,0.0)); float shape=smoothstep(.43,.73,n); float edge=smoothstep(0.0,.17,p.y)*smoothstep(0.0,.16,1.0-p.y); float alpha=shape*edge*uOpacity; vec3 col=mix(uColorA,uColorB,smoothstep(.38,.78,p.y+n*.24)); gl_FragColor=vec4(col,alpha);}`
  });
}
function addCloudBank(group, opts) {
  const mat = cloudMaterial(opts.a, opts.b, opts.opacity, opts.seed);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(opts.width, opts.height, 1, 1), mat);
  mesh.position.set(opts.x, opts.y, opts.z);
  mesh.rotation.z = opts.rotation || 0;
  group.add(mesh);
  return mesh;
}

function terrainGeometry(width, depth, segments, baseY, peak, seed) {
  const verts = [], colors = [], indices = [];
  const colorLow = new THREE.Color(0x1a1235), colorHigh = new THREE.Color(0x57406e);
  for (let j=0;j<=segments;j++) {
    const v=j/segments;
    for (let i=0;i<=segments;i++) {
      const u=i/segments, x=(u-.5)*width;
      const ridge = Math.pow(Math.max(0, Math.sin(u*17.1+seed)*.48 + Math.sin(u*31.4+seed*2)*.27 + Math.sin(u*7.7+seed*3)*.25), 1.35);
      const envelope = Math.pow(Math.max(0, Math.sin(Math.PI*u)), .38);
      const y = baseY + ridge*peak*envelope - v*depth;
      const z = -3.8 + v*1.5;
      verts.push(x,y,z);
      const shade = Math.max(0, Math.min(1, .18 + ridge*.68 + (1-v)*.16));
      const c = colorLow.clone().lerp(colorHigh, shade);
      colors.push(c.r,c.g,c.b);
      if(i<segments && j<segments){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}
function addMountain(group, cfg) {
  const geom = terrainGeometry(cfg.width, cfg.depth, 110, cfg.baseY, cfg.peak, cfg.seed);
  const mat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0, flatShading:false, side:THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom,mat); mesh.position.z=cfg.z; group.add(mesh); return mesh;
}

function addLake(group, moonX, variant) {
  const geometry = new THREE.PlaneGeometry(42, 12, 1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: false, depthWrite: true,
    uniforms: { uTime:{value:0}, uMoonX:{value:moonX}, uVariant:{value:variant} },
    vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.0);vPos=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vPos; uniform float uTime; uniform float uMoonX; uniform float uVariant;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){float y=vUv.y; float wave=sin(vUv.x*74.0+uTime*1.3)*.003+sin(vUv.x*29.0-uTime*.8)*.006;float rip=sin((y*68.0+wave*160.0)+uTime*1.5)*.5+.5;float streak=exp(-pow((vUv.x-uMoonX)*19.0,2.0))*exp(-pow((y-.70)*3.8,2.0));float glint=streak*(.22+.42*rip);vec3 deep=vec3(.045,.035,.12);vec3 mid=vec3(.18,.09,.22);vec3 col=mix(deep,mid,smoothstep(0.0,1.0,y));col+=vec3(.62,.30,.48)*glint;col+=vec3(.23,.17,.34)*rip*.055;float horizonFade=smoothstep(0.0,.18,y);col=mix(vec3(.12,.07,.19),col,horizonFade);gl_FragColor=vec4(col,1.0);}`
  });
  const lake = new THREE.Mesh(geometry,material); lake.position.set(0,-6.8,-1.5); group.add(lake); return lake;
}

function createWorld(kind) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(kind === 'entrance' ? 0x160d2d : 0x1b1034);
  scene.fog = new THREE.FogExp2(kind === 'entrance' ? 0x24143b : 0x28163d, 0.012);
  const group = new THREE.Group(); scene.add(group);
  scene.add(new THREE.AmbientLight(0x8b6d9e, 1.05));
  const horizonLight = new THREE.PointLight(0xe58dbd, 16, 34, 2);
  horizonLight.position.set(-1.5,-3.2,1); scene.add(horizonLight);
  const moonX = kind === 'entrance' ? 5.8 : 5.6;
  const moonY = kind === 'entrance' ? 5.3 : 5.8;
  const moon = addMoon(group, moonX, moonY, -3.1, kind === 'entrance' ? 1.22 : 1.38);
  const stars = makeStarField(group, kind === 'entrance' ? 1250 : 1700, 44, -8, -18, kind === 'entrance' ? .095 : .085);
  const farStars = makeStarField(group, 460, 54, -22, -35, .055);

  // Fine nebula veil: transparent, moving cloud volumes at different depths.
  addCloudBank(group,{x:-1.2,y:2.1,z:-7.5,width:32,height:12,a:0x563a83,b:0xd77ba9,opacity:kind==='entrance'?.30:.38,seed:3.4,rotation:.02});
  addCloudBank(group,{x:-10,y:-1.1,z:-2.8,width:18,height:9,a:0x9c5d9a,b:0xf0a5c1,opacity:.65,seed:8.2,rotation:.12});
  addCloudBank(group,{x:10.5,y:-.8,z:-2.6,width:18,height:8,a:0x89548f,b:0xe998b9,opacity:.53,seed:12.7,rotation:-.1});
  addCloudBank(group,{x:0,y:-3.1,z:-4.6,width:34,height:5.5,a:0x8a578e,b:0xe99bb8,opacity:.34,seed:19.2});

  // Distant, middle and foreground ridges create real parallax depth.
  addMountain(group,{width:46,depth:8,baseY:-5.5,peak:4.5,z:-5.5,seed:2.3});
  addMountain(group,{width:43,depth:7,baseY:-6.3,peak:3.1,z:-2.2,seed:6.8});
  addMountain(group,{width:49,depth:5.4,baseY:-7.1,peak:2.4,z:1.0,seed:11.2});
  const lake = addLake(group, .64, kind === 'entrance' ? 0 : 1);

  // Small luminous points near the waterline, moving gently at different depths.
  const fireflyPositions = [];
  for(let i=0;i<65;i++) fireflyPositions.push((seeded(i+41)-.5)*34,-4.1-seeded(i+77)*3.7,1.8+seeded(i+99)*1.2);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position',new THREE.Float32BufferAttribute(fireflyPositions,3));
  const fireflies = new THREE.Points(fg,new THREE.PointsMaterial({color:0xffb9df,size:.075,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false})); group.add(fireflies);

  // A few long, delicate shooting stars are 3D line objects rather than CSS streaks.
  const shooting = [];
  for(let i=0;i<3;i++){
    const points=[new THREE.Vector3(-14+i*9,7-i*1.2,-4),new THREE.Vector3(-12+i*9,6.1-i*1.2,-4)];
    const geo=new THREE.BufferGeometry().setFromPoints(points);
    const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd8ee,transparent:true,opacity:0}));
    group.add(line); shooting.push({line,offset:i*7.2});
  }
  return {scene,group,moon,stars,farStars,lake,fireflies,shooting,clouds:group.children.filter(o=>o.material?.uniforms?.uTime)};
}

worlds.entrance = createWorld('entrance');
worlds.heaven = createWorld('heaven');
worlds.heaven.scene.visible = false;
if (window.__universeWorld === 'heaven') { worlds.entrance.scene.visible = false; worlds.heaven.scene.visible = true; activeWorld = 'heaven'; }

document.addEventListener('universe:world', event => {
  const next = event.detail === 'heaven' ? 'heaven' : 'entrance';
  if (!worlds[next]) return;
  worlds[activeWorld].scene.visible = false;
  activeWorld = next;
  worlds[activeWorld].scene.visible = true;
  camera.position.set(0, 1.6, 19);
  camera.lookAt(0, 0.1, -2);
});

const resize = () => {
  const w=window.innerWidth,h=window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
};
window.addEventListener('resize',resize,{passive:true});

function animate(){
  requestAnimationFrame(animate);
  if(document.hidden) return;
  const t=clock.getElapsedTime();
  const w=worlds[activeWorld];
  if(!reducedMotion){
    w.group.rotation.y=Math.sin(t*.055)*.012;
    w.group.position.y=Math.sin(t*.16)*.045;
    w.moon.position.y=(activeWorld==='entrance'?5.3:5.8)+Math.sin(t*.12)*.055;
    w.stars.rotation.z=Math.sin(t*.018)*.004;
    w.farStars.rotation.z=-Math.sin(t*.012)*.003;
    w.fireflies.position.y=Math.sin(t*.22)*.08;
    for(const cloud of w.clouds) cloud.material.uniforms.uTime.value=t;
    w.lake.material.uniforms.uTime.value=t;
    for(const s of w.shooting){
      const phase=(t+s.offset)%22;
      const visible=phase>1.4&&phase<2.1;
      s.line.material.opacity=visible?Math.sin((phase-1.4)/.7*Math.PI)*.85:0;
      s.line.position.x=visible?(phase-1.4)*-2.2:0;
      s.line.position.y=visible?(phase-1.4)*-1.0:0;
    }
  }
  renderer.render(w.scene,camera);
}
animate();
