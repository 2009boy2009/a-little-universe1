import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* A Little Universe — two separate animated 3D worlds.
   The reference is recreated as layered scenery, not used as a flat screenshot. */
const canvas = document.getElementById('worldCanvas');
if (!canvas) throw new Error('Missing #worldCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 180);
camera.position.set(0, .15, 25);
camera.lookAt(0, -1.1, -4);
const clock = new THREE.Clock();
const worlds = {};
let active = 'entrance';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function rand(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }
function addStars(group, count, width, height, z0, z1, size, opacity) {
  const p = new Float32Array(count * 3), c = new Float32Array(count * 3);
  for (let i=0;i<count;i++) {
    p[i*3] = (rand(i+2)-.5)*width; p[i*3+1] = (rand(i+300)-.5)*height; p[i*3+2] = z0 + rand(i+800)*(z1-z0);
    const warm = rand(i+1000); c[i*3]=.72+warm*.28; c[i*3+1]=.64+warm*.25; c[i*3+2]=.82+warm*.18;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(p,3)); g.setAttribute('color',new THREE.BufferAttribute(c,3));
  const m = new THREE.PointsMaterial({size,sizeAttenuation:true,vertexColors:true,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  const pts = new THREE.Points(g,m); group.add(pts); return pts;
}
function glowTexture() {
  const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,2,128,128,126); g.addColorStop(0,'rgba(255,222,242,.75)');g.addColorStop(.18,'rgba(255,174,222,.30)');g.addColorStop(1,'rgba(255,130,205,0)');x.fillStyle=g;x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const glowMap=glowTexture();
function addMoon(group, x, y, r) {
  const pivot=new THREE.Group();pivot.position.set(x,y,-7);group.add(pivot);
  const ball=new THREE.Mesh(new THREE.SphereGeometry(r,96,72),new THREE.MeshStandardMaterial({color:0xffe5ef,roughness:1,emissive:0x4a2039,emissiveIntensity:.12}));
  // Light comes from the viewer's right, making the illuminated crescent face the camera.
  const key=new THREE.DirectionalLight(0xffc1dd,4.5);key.position.set(4.5,1.1,8);pivot.add(ball,key);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:0xffb9dd,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.set(r*5.8,r*5.8,1);halo.position.z=-.18;pivot.add(halo);
  return pivot;
}

// Cloud puffs are overlapping lit 3D spheres, not a 2D cloud texture.
const cloudMaterials = new Map();
function getCloudMaterial(shadow, highlight) {
  const key = shadow + '-' + highlight;
  if (!cloudMaterials.has(key)) cloudMaterials.set(key, new THREE.MeshStandardMaterial({
    color: highlight, emissive: shadow, emissiveIntensity: .16, roughness: 1, metalness: 0,
    transparent: true, opacity: .86, depthWrite: false
  }));
  return cloudMaterials.get(key);
}
function addCloudBank(group, cfg) {
  const bank = new THREE.Group(); bank.position.set(cfg.x, cfg.y, cfg.z); group.add(bank);
  const count = cfg.count || 34;
  for (let i=0;i<count;i++) {
    const t=i/(count-1), envelope=Math.sin(Math.PI*t)**.5;
    const radius=cfg.scale*(.48+rand(i+cfg.seed)*.68)*(.62+.38*envelope);
    const puff=new THREE.Mesh(new THREE.SphereGeometry(radius,24,18),getCloudMaterial(cfg.shadow,cfg.light));
    puff.position.set((t-.5)*cfg.width+(rand(i+50)-.5)*.75,(rand(i+100)-.5)*cfg.height+Math.sin(t*Math.PI*2+cfg.seed)*.28,(rand(i+150)-.5)*cfg.depth);
    puff.scale.set(1.35,.72+rand(i+220)*.55,.76+rand(i+250)*.55);
    bank.add(puff);
  }
  return bank;
}
function ridgeGeometry(width, segments, baseline, amplitude, seed, jagged=1) {
  const positions=[],colors=[],indices=[];const dark=new THREE.Color(0x17132f),lit=new THREE.Color(0x55416e);
  for(let i=0;i<=segments;i++){
    const u=i/segments,x=(u-.5)*width;
    const peak=Math.max(0,Math.sin(u*15.2+seed)*.36+Math.sin(u*31.1+seed*2)*.24+Math.sin(u*7.1+seed*4)*.4);
    const edge=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.34);
    const y=baseline+peak*amplitude*edge*jagged;
    positions.push(x,y,-.7, x,baseline-8,-.7);
    const shade=.18+peak*.62;for(let k=0;k<2;k++){const c=dark.clone().lerp(lit,shade*(k===0?1:.65));colors.push(c.r,c.g,c.b);}
    if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function addRidge(group, cfg){const mesh=new THREE.Mesh(ridgeGeometry(cfg.width,220,cfg.base,cfg.amp,cfg.seed,cfg.jag||1),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));mesh.position.z=cfg.z;group.add(mesh);return mesh;}
function addRockSpire(group,x,y,z,s,seed){const g=new THREE.Group();g.position.set(x,y,z);group.add(g);for(let i=0;i<7;i++){const h=s*(.55+rand(seed+i)*.9),r=s*(.13+rand(seed+i+20)*.17);const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,5),new THREE.MeshStandardMaterial({color:i%2?0x34264e:0x49345f,roughness:1,flatShading:true}));m.position.set((rand(seed+i+40)-.5)*s*.45,h*.35,(rand(seed+i+60)-.5)*s*.3);m.rotation.z=(rand(seed+i+80)-.5)*.24;g.add(m);}return g;}
function addLake(group){
 const geo=new THREE.PlaneGeometry(48,15,1,1);
 const mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`varying vec2 vUv;uniform float uTime;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float y=vUv.y;float wave=sin(vUv.x*110.0+uTime*1.2)*.012+sin(vUv.x*43.0-uTime*.8)*.018;float lines=pow(max(0.0,sin((y*100.0+wave*95.0)+uTime*1.6)),14.0);float reflection=exp(-pow((vUv.x-.52)*23.0,2.0))*smoothstep(.1,.75,y);float horizon= smoothstep(0.0,.75,y);vec3 deep=vec3(.035,.025,.095);vec3 violet=vec3(.17,.09,.23);vec3 col=mix(deep,violet,horizon);col+=vec3(.54,.25,.43)*lines*(.12+reflection*.85);col+=vec3(.35,.16,.34)*reflection*.16;gl_FragColor=vec4(col,1.0);}`,depthWrite:true});
 const water=new THREE.Mesh(geo,mat);water.rotation.x=-Math.PI/2;water.position.set(0,-8.8,-2);group.add(water);return water;
}
function makeFlower(group,x,y,z,scale,seed){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);group.add(g);
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.02,.9,5),new THREE.MeshStandardMaterial({color:0x283c37}));stem.position.y=.42;stem.rotation.z=(rand(seed)-.5)*.35;g.add(stem);
 const center=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshStandardMaterial({color:0xf8c4df,emissive:0x5b294a,emissiveIntensity:.3}));center.position.y=.92;g.add(center);
 const petalMat=new THREE.MeshStandardMaterial({color:rand(seed+1)>.5?0xffb9db:0xe6a5d5,roughness:.8,side:THREE.DoubleSide});
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const p=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),petalMat);p.scale.set(.65,1.35,.28);p.position.set(Math.cos(a)*.12,.92+Math.sin(a)*.12,Math.sin(a)*.12);p.rotation.z=-a;g.add(p);}
 return g;
}
function createWorld(kind){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x160d2c);scene.fog=new THREE.FogExp2(0x24143b,.0085);
 const group=new THREE.Group();scene.add(group);
 scene.add(new THREE.AmbientLight(0x9a7aaa,1.15));
 const horizon=new THREE.PointLight(0xe69ac7,21,48,2);horizon.position.set(-1.8,-5.1,7);scene.add(horizon);
 const moon=addMoon(group,kind==='entrance'?7.1:7.0,kind==='entrance'?7.4:7.7,kind==='entrance'?1.24:1.32);
 const stars=addStars(group,kind==='entrance'?1900:2200,47,27,-9,-35,.075,.95);const farStars=addStars(group,600,60,34,-37,-58,.045,.55);
 // Bright, mottled magenta nebula behind the clouds; three transparent layers drift independently.
 const nebulaCanvas=document.createElement('canvas');nebulaCanvas.width=1024;nebulaCanvas.height=512;const ctx=nebulaCanvas.getContext('2d');
 for(let i=0;i<130;i++){const x=rand(i+900)*1024,y=rand(i+1200)*512,r=25+rand(i+1500)*115;const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,`rgba(${130+Math.floor(rand(i+5)*90)},${45+Math.floor(rand(i+8)*60)},${140+Math.floor(rand(i+9)*85)},${.035+rand(i+10)*.11})`);grad.addColorStop(1,'rgba(70,30,100,0)');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);}
 const nebTex=new THREE.CanvasTexture(nebulaCanvas);nebTex.colorSpace=THREE.SRGBColorSpace;
 for(let i=0;i<3;i++){const m=new THREE.MeshBasicMaterial({map:nebTex,transparent:true,opacity:.7-i*.14,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});const p=new THREE.Mesh(new THREE.PlaneGeometry(37,17),m);p.position.set(i===1?2:-2,2.2-i*.8,-23-i*3);group.add(p);}
 // Reference-style tall cloud towers framing the central sky, plus a luminous low horizon bank.
 const banks=[];
 banks.push(addCloudBank(group,{x:-13.2,y:-1.3,z:-5.4,width:10,height:8,depth:3.4,scale:1.8,count:45,seed:8,shadow:0x33234f,light:0xd889b9}));
 banks.push(addCloudBank(group,{x:13.2,y:-.8,z:-5.8,width:9.5,height:7.5,depth:3.2,scale:1.65,count:42,seed:15,shadow:0x34234e,light:0xd98ab8}));
 banks.push(addCloudBank(group,{x:0,y:-5.4,z:-7.2,width:37,height:4.6,depth:4.5,scale:1.15,count:75,seed:23,shadow:0x302449,light:0xc77fae}));
 banks.push(addCloudBank(group,{x:-13,y:-7.2,z:-1.2,width:15,height:3.6,depth:2.7,scale:1.05,count:35,seed:33,shadow:0x30234a,light:0xb979a9}));
 banks.push(addCloudBank(group,{x:13,y:-7.3,z:-1.4,width:14,height:3.6,depth:2.8,scale:1.05,count:34,seed:43,shadow:0x30234a,light:0xc982b1}));
 // Far mountain silhouettes and closer jagged rock edges.
 addRidge(group,{width:52,base:-7.1,amp:3.5,z:-6.3,seed:3.4,jag:.95});
 addRidge(group,{width:47,base:-8.2,amp:2.3,z:-3.4,seed:8.7,jag:1.15});
 addRidge(group,{width:49,base:-9.1,amp:1.45,z:.2,seed:12.4,jag:1.2});
 if(kind==='heaven'){addRockSpire(group,15.2,-6.3,-.1,3.6,44);addRockSpire(group,17.0,-7.1,.5,2.3,61);}
 const lake=addLake(group);
 const flowers=[];
 for(let i=0;i<36;i++){const side=i<20?-1:1;const x=side*(8+rand(i+50)*10);flowers.push(makeFlower(group,x,-10.4+rand(i+80)*1.6,2+rand(i+100)*2,.65+rand(i+130)*1.25,i+10));}
 const firePos=[];for(let i=0;i<90;i++)firePos.push((rand(i+700)-.5)*36,-7.5-rand(i+750)*3,2+rand(i+800)*1.5);
 const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(firePos,3));const fire=new THREE.Points(fg,new THREE.PointsMaterial({color:0xffc2e0,size:.055,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));group.add(fire);
 return {scene,group,moon,stars,farStars,banks,lake,fire,flowers};
}
worlds.entrance=createWorld('entrance');worlds.heaven=createWorld('heaven');worlds.heaven.scene.visible=false;
if(window.__universeWorld==='heaven'){worlds.entrance.scene.visible=false;worlds.heaven.scene.visible=true;active='heaven';}
document.addEventListener('universe:world',e=>{const next=e.detail==='heaven'?'heaven':'entrance';worlds[active].scene.visible=false;active=next;worlds[active].scene.visible=true;});
function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth/innerHeight<.72?51:42;camera.position.z=innerWidth/innerHeight<.72?31:25;camera.updateProjectionMatrix();camera.lookAt(0,-1.1,-4);}
window.addEventListener('resize',resize,{passive:true});resize();
function animate(){requestAnimationFrame(animate);if(document.hidden)return;const t=clock.getElapsedTime(),w=worlds[active];if(!reduceMotion){w.group.rotation.y=Math.sin(t*.035)*.008;w.group.position.y=Math.sin(t*.12)*.035;w.moon.position.y=(active==='entrance'?7.4:7.7)+Math.sin(t*.1)*.035;w.stars.rotation.z=Math.sin(t*.012)*.002;w.farStars.rotation.z=-Math.sin(t*.009)*.0015;w.lake.material.uniforms.uTime.value=t;w.fire.position.y=Math.sin(t*.2)*.06;for(let i=0;i<w.banks.length;i++){w.banks[i].position.x+=Math.sin(t*.025+i)*.0008;}}renderer.render(w.scene,camera);}
animate();
