import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* A LITTLE UNIVERSE — two independent, animated 3D night landscapes.
   Clouds are shaded 3D volumes (ray-marched inside box volumes), not spheres
   and not a flattened screenshot. Mountains, moon, water and flowers are meshes. */
const canvas = document.querySelector('#worldCanvas');
if (!canvas) throw new Error('Missing #worldCanvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 180);
camera.position.set(0, .5, 25);
camera.lookAt(0, -1.15, -4.5);
const clock = new THREE.Clock();
const worlds = {};
let activeWorld = 'entrance';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const tempV = new THREE.Vector3();

function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return v - Math.floor(v); }
function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128,128,1,128,128,126);
  g.addColorStop(0,'rgba(255,230,248,.8)'); g.addColorStop(.16,'rgba(255,174,222,.34)');
  g.addColorStop(.48,'rgba(187,113,207,.12)'); g.addColorStop(1,'rgba(120,75,170,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const glowTexture = makeGlowTexture();

function addStarField(parent, count, width, height, zNear, zFar, size, opacity, seed) {
  const positions = new Float32Array(count*3), colors = new Float32Array(count*3), sizes = new Float32Array(count);
  for (let i=0;i<count;i++) {
    positions[i*3]=(hash(i+seed)-.5)*width;
    positions[i*3+1]=(hash(i+seed+400)-.5)*height;
    positions[i*3+2]=zNear+hash(i+seed+900)*(zFar-zNear);
    const pink=hash(i+seed+1300);
    colors[i*3]=.78+pink*.22; colors[i*3+1]=.68+pink*.18; colors[i*3+2]=.88+pink*.12;
    sizes[i]=size*(.55+hash(i+seed+1700)*1.2);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  const mat=new THREE.PointsMaterial({size,sizeAttenuation:true,vertexColors:true,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  const points=new THREE.Points(geo,mat); parent.add(points); return points;
}

// A spherical moon with a physically shaded terminator; the directional light
// creates the fine crescent visible in the supplied reference.
function addCrescentMoon(parent, x, y, radius, seed) {
  const holder=new THREE.Group(); holder.position.set(x,y,-9); parent.add(holder);
  const moonMat=new THREE.MeshStandardMaterial({color:0xffe4ee,roughness:.92,metalness:0,emissive:0x6e344d,emissiveIntensity:.12});
  const moon=new THREE.Mesh(new THREE.SphereGeometry(radius,96,72),moonMat); holder.add(moon);
  const light=new THREE.DirectionalLight(0xffc3dc,4.2); light.position.set(4.8,.55,1.45); holder.add(light);
  const fill=new THREE.AmbientLight(0x30213f,.2); holder.add(fill);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color:0xffb9dc,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));
  halo.scale.set(radius*7.5,radius*7.5,1); halo.position.z=-.3; holder.add(halo);
  // Fine surface mottling catches light without making the moon look like a flat icon.
  const flecks=new THREE.Group(); holder.add(flecks);
  for(let i=0;i<18;i++){
    const a=hash(seed+i)*Math.PI*2, b=(hash(seed+i+40)-.5)*1.4;
    const rr=radius*(.12+hash(seed+i+80)*.32);
    const dot=new THREE.Mesh(new THREE.SphereGeometry(rr,.0+8,6),new THREE.MeshBasicMaterial({color:0xffeaf3,transparent:true,opacity:.025+hash(seed+i+120)*.035,depthWrite:false}));
    dot.position.set(Math.cos(a)*radius*.45,Math.sin(a)*radius*.45+b*radius*.18,radius*.87); flecks.add(dot);
  }
  return holder;
}

// 3D cloud-volume shader. Each cloud bank is a real box volume; a short
// ray-march samples 3D fractal density and produces soft lit billows and wisps.
const cloudVertex = `
  varying vec3 vLocal;
  void main(){ vLocal=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
`;
const cloudFragment = `
  precision highp float;
  varying vec3 vLocal;
  uniform vec3 uCameraLocal;
  uniform float uTime;
  uniform vec3 uShadow;
  uniform vec3 uLight;
  uniform float uSeed;
  float hash31(vec3 p){ p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
  float noise3(vec3 x){
    vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){ float v=0.0,a=.56; mat3 m=mat3(1.6,1.2,0.0,-1.2,1.6,0.0,0.0,0.0,1.7); for(int i=0;i<3;i++){v+=noise3(p)*a;p=m*p+vec3(1.7,2.1,1.3);a*=.52;} return v; }
  void main(){
    vec3 ro=uCameraLocal; vec3 rd=normalize(vLocal-ro);
    // The fragment is on the near box face; march through the volume.
    float t=0.0, alpha=0.0; vec3 accum=vec3(0.0);
    for(int i=0;i<24;i++){
      vec3 p=vLocal+rd*t;
      if(abs(p.x)>.501||abs(p.y)>.501||abs(p.z)>.501) break;
      vec3 q=p*vec3(2.15,2.6,2.0)+vec3(uSeed,uSeed*.37,uTime*.012);
      float broad=fbm(q*.72);
      float detail=noise3(q*2.1+vec3(3.2,1.7,4.1));
      float envelope=1.0-smoothstep(.24,.53,abs(p.x)*.83+abs(p.y)*.95);
      float density=smoothstep(.39,.68,broad*.77+detail*.23)*envelope;
      density*=smoothstep(-.50,-.28,p.y)*(.78+.22*smoothstep(.15,.5,p.y));
      float stepAlpha=density*.105;
      vec3 lit=mix(uShadow,uLight,smoothstep(.42,.82,broad+detail*.22));
      lit+=uLight*.18*smoothstep(.48,.78,detail);
      accum+=(1.0-alpha)*lit*stepAlpha;
      alpha+=(1.0-alpha)*stepAlpha;
      t+=.043;
      if(alpha>.94) break;
    }
    if(alpha<.012) discard;
    gl_FragColor=vec4(accum,alpha*.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
function addCloudVolume(parent, cfg) {
  const geo=new THREE.BoxGeometry(1,1,1,1,1,1);
  const mat=new THREE.ShaderMaterial({
    uniforms:{uCameraLocal:{value:new THREE.Vector3(0,0,25)},uTime:{value:0},uShadow:{value:new THREE.Color(cfg.shadow)},uLight:{value:new THREE.Color(cfg.light)},uSeed:{value:cfg.seed}},
    vertexShader:cloudVertex,fragmentShader:cloudFragment,transparent:true,depthWrite:false,side:THREE.FrontSide,blending:THREE.NormalBlending
  });
  const mesh=new THREE.Mesh(geo,mat); mesh.position.set(cfg.x,cfg.y,cfg.z); mesh.scale.set(cfg.w,cfg.h,cfg.d); mesh.renderOrder=2; parent.add(mesh); return mesh;
}

function makeRidgeGeometry(width, segments, base, amplitude, seed, depth) {
  const pos=[], colors=[], indices=[]; const dark=new THREE.Color(0x17132f), mid=new THREE.Color(0x49385f), light=new THREE.Color(0x82608b);
  const heights=[];
  for(let i=0;i<=segments;i++){
    const u=i/segments, x=(u-.5)*width;
    const n=Math.sin(u*13.7+seed)*.44+Math.sin(u*29.1+seed*1.8)*.25+Math.sin(u*5.3+seed*2.7)*.31;
    const edge=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.32);
    const y=base+Math.max(0,n+.17)*amplitude*edge;
    heights.push(y);
    pos.push(x,y,0,x,base-7,0);
    const shade=THREE.MathUtils.clamp((y-base)/Math.max(1,amplitude),0,1);
    const c0=dark.clone().lerp(mid,shade*.9),c1=dark.clone().lerp(light,shade*.48);
    colors.push(c0.r,c0.g,c0.b,c1.r,c1.g,c1.b);
    if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function addMountain(parent,cfg){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(makeRidgeGeometry(cfg.width,300,cfg.base,cfg.amp,cfg.seed),material);mesh.position.z=cfg.z;parent.add(mesh);return mesh;
}
function addSpire(parent,x,y,z,scale,seed){
  const group=new THREE.Group();group.position.set(x,y,z);parent.add(group);
  for(let i=0;i<5;i++){
    const h=scale*(.7+hash(seed+i)*.65),r=scale*(.16+hash(seed+i+20)*.12);
    const rock=new THREE.Mesh(new THREE.ConeGeometry(r,h,5,2),new THREE.MeshStandardMaterial({color:i%2?0x392b50:0x59436b,roughness:1,flatShading:true}));
    rock.position.set((hash(seed+i+40)-.5)*scale*.4,h*.42,(hash(seed+i+60)-.5)*scale*.28);rock.rotation.z=(hash(seed+i+80)-.5)*.18;group.add(rock);
  }
  return group;
}

function addWater(parent){
  const geometry=new THREE.PlaneGeometry(54,19,1,1);
  const material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime;
      void main(){float y=vUv.y;float ripple=sin(vUv.x*210.0+uTime*1.1+sin(y*22.0))*0.5+0.5;
      float fine=pow(ripple,18.0)*(.12+.38*exp(-pow((vUv.x-.52)*18.0,2.0)));
      float reflection=exp(-pow((vUv.x-.52)*19.0,2.0))*smoothstep(.05,.85,y);
      float wave=sin(y*105.0+uTime*1.5+sin(vUv.x*13.0))*0.5+.5;
      vec3 col=mix(vec3(.025,.022,.075),vec3(.15,.075,.19),smoothstep(0.0,.8,y));
      col+=vec3(.52,.22,.42)*fine;col+=vec3(.62,.30,.49)*reflection*wave*.18;
      col+=vec3(.25,.13,.31)*pow(wave,9.0)*.10;
      gl_FragColor=vec4(col,1.0);}`,
    depthWrite:true});
  const water=new THREE.Mesh(geometry,material);water.rotation.x=-Math.PI/2;water.position.set(0,-9.05,-1.6);parent.add(water);return water;
}
function addFlower(parent,x,y,z,scale,seed){
  const plant=new THREE.Group();plant.position.set(x,y,z);plant.scale.setScalar(scale);parent.add(plant);
  const stemMat=new THREE.MeshStandardMaterial({color:0x293c39,roughness:1});
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.025,1.05,6),stemMat);stem.position.y=.52;stem.rotation.z=(hash(seed)-.5)*.28;plant.add(stem);
  for(let j=0;j<2;j++){
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(.16,10,7),new THREE.MeshStandardMaterial({color:0x354d48,roughness:1}));
    leaf.scale.set(1.4,.42,.35);leaf.position.set(j?-.12:.13,.32+j*.16,0);leaf.rotation.z=j?-.45:.45;plant.add(leaf);
  }
  const flower=new THREE.Group();flower.position.y=1.04;plant.add(flower);
  const petalMat=new THREE.MeshStandardMaterial({color:hash(seed+5)>.5?0xf5b5d9:0xd99acb,roughness:.82,side:THREE.DoubleSide,emissive:0x572b4b,emissiveIntensity:.12});
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;const petal=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),petalMat);
    petal.scale.set(.55,1.65,.42);petal.position.set(Math.cos(a)*.16,Math.sin(a)*.16,0);petal.rotation.z=-a;flower.add(petal);
  }
  const centre=new THREE.Mesh(new THREE.SphereGeometry(.075,12,8),new THREE.MeshStandardMaterial({color:0xffd6a8,emissive:0x7c4961,emissiveIntensity:.24}));flower.add(centre);
  return plant;
}

function addNebula(parent, seed){
  // A procedural shader sky nebula, kept behind the true 3D foreground.
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uSeed:{value:seed}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uSeed;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.0),f.x),f.y);}
      float fb(vec2 p){float v=0.0,a=.55;for(int i=0;i<5;i++){v+=n(p)*a;p=p*2.03+vec2(13.2,7.1);a*=.5;}return v;}
      void main(){vec2 p=vUv;float cloud=fb(p*vec2(8.0,4.0)+vec2(uTime*.003,uSeed));float band=exp(-pow((p.x-.73+sin(p.y*8.0)*.06)*3.1,2.0));float glow=smoothstep(.47,.78,cloud)*band;float haze=smoothstep(.58,.82,fb(p*vec2(13.0,6.0)+uSeed+2.0))*band*.45;vec3 c=mix(vec3(.30,.12,.49),vec3(.78,.27,.63),glow);gl_FragColor=vec4(c,glow*.36+haze*.18);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(48,25),material);mesh.position.set(0,2.0,-36);parent.add(mesh);return mesh;
}

function createWorld(kind){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x100b25);scene.fog=new THREE.FogExp2(0x211333,.0068);
  const root=new THREE.Group();scene.add(root);
  scene.add(new THREE.AmbientLight(0x9582b2,.78));
  const moonLight=new THREE.PointLight(0xb68bcf,24,48,2);moonLight.position.set(0,5,-5);scene.add(moonLight);
  const horizonLight=new THREE.PointLight(0xd58ab9,32,42,2);horizonLight.position.set(-1.5,-6,5);scene.add(horizonLight);
  const nebula=addNebula(root,kind==='entrance'?4.1:8.7);
  const farStars=addStarField(root,900,70,40,-42,-68,.052,.62,kind==='entrance'?21:121);
  const stars=addStarField(root,1700,49,29,-12,-38,.075,.92,kind==='entrance'?71:171);
  const moon=addCrescentMoon(root,kind==='entrance'?6.0:6.4,kind==='entrance'?5.6:6.0,kind==='entrance'?1.24:1.34,kind==='entrance'?3:9);
  // Large, irregular cloud banks form the tall left/right walls and low horizon.
  const clouds=[];
  const cloudSets=kind==='entrance' ? [
    {x:-12.4,y:-2.4,z:-7,w:13,h:12,d:8,seed:2,shadow:0x382548,light:0xd98ab7},
    {x:12.2,y:-2.2,z:-8,w:12,h:11,d:8,seed:8,shadow:0x352347,light:0xd18ab9},
    {x:-1,y:-7.2,z:-8,w:38,h:7.2,d:7,seed:14,shadow:0x30213f,light:0xc981b0},
    {x:-14,y:-7.8,z:0,w:13,h:5.5,d:5,seed:20,shadow:0x3b294d,light:0xe3a0c6}
  ] : [
    {x:-13.2,y:-1.9,z:-7,w:13.5,h:12,d:8,seed:31,shadow:0x382548,light:0xd98ab7},
    {x:13.0,y:-1.4,z:-8,w:13,h:11.5,d:8,seed:38,shadow:0x352347,light:0xd18ab9},
    {x:0,y:-7.1,z:-8,w:39,h:7.5,d:7,seed:45,shadow:0x30213f,light:0xc981b0},
    {x:-14,y:-8.0,z:0,w:13,h:5.8,d:5,seed:52,shadow:0x3b294d,light:0xe3a0c6}
  ];
  for(const cfg of cloudSets) clouds.push(addCloudVolume(root,cfg));
  // Multiple sculpted mountain ridges create visible parallax depth.
  const mountains=[];
  mountains.push(addMountain(root,{width:52,base:-7.8,amp:3.0,seed:7.1,z:-10}));
  mountains.push(addMountain(root,{width:49,base:-8.7,amp:2.0,seed:12.7,z:-5}));
  mountains.push(addMountain(root,{width:46,base:-9.5,amp:1.2,seed:19.4,z:-1.8}));
  if(kind==='heaven'){
    addSpire(root,15.4,-6.4,-.5,3.8,47); addSpire(root,17.1,-7.1,.1,2.7,63);
    addSpire(root,-18,-7.3,-.2,2.1,77);
  } else {
    addSpire(root,-17,-7.2,-.4,2.4,82); addSpire(root,17.5,-7.3,.0,2.0,91);
  }
  const water=addWater(root);
  const flowers=[];
  for(let i=0;i<56;i++){
    const side=i<34?-1:1;const x=side*(7.5+hash(i+110)*12.5);
    const y=-10.0+hash(i+150)*1.7;const z=.8+hash(i+190)*3.4;
    flowers.push(addFlower(root,x,y,z,.58+hash(i+230)*1.15,i+300));
  }
  // Foreground silhouettes give the scene a real near plane and scale.
  const grassMat=new THREE.MeshStandardMaterial({color:0x293442,roughness:1});
  for(let i=0;i<44;i++){
    const x=(hash(i+400)-.5)*42, h=.35+hash(i+450)*1.15;
    const blade=new THREE.Mesh(new THREE.ConeGeometry(.045,h,4),grassMat);
    blade.position.set(x,-10.1+h*.35,2.2+hash(i+500)*2.0);blade.rotation.z=(hash(i+550)-.5)*.45;root.add(blade);
  }
  const firePositions=[];
  for(let i=0;i<80;i++)firePositions.push((hash(i+700)-.5)*38,-7.7-hash(i+750)*2.4,1.2+hash(i+800)*1.8);
  const fireGeo=new THREE.BufferGeometry();fireGeo.setAttribute('position',new THREE.Float32BufferAttribute(firePositions,3));
  const fire=new THREE.Points(fireGeo,new THREE.PointsMaterial({color:0xffc6e5,size:.055,transparent:true,opacity:.56,blending:THREE.AdditiveBlending,depthWrite:false}));root.add(fire);
  return {scene,root,moon,stars,farStars,nebula,clouds,water,fire,flowers,mountains};
}

worlds.entrance=createWorld('entrance');
worlds.heaven=createWorld('heaven');
worlds.heaven.scene.visible=false;
if(window.__universeWorld==='heaven'){worlds.entrance.scene.visible=false;worlds.heaven.scene.visible=true;activeWorld='heaven';}

document.addEventListener('universe:world',event=>{
  const next=event.detail==='heaven'?'heaven':'entrance';
  if(next===activeWorld)return;
  worlds[activeWorld].scene.visible=false; activeWorld=next; worlds[activeWorld].scene.visible=true;
});

function resize(){
  const w=innerWidth,h=innerHeight,aspect=w/h;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(w,h,false);
  camera.aspect=aspect;
  camera.fov=aspect<.68?56:aspect<1?49:43;
  camera.position.set(0,.35,aspect<.68?32:aspect<1?29:25);
  camera.updateProjectionMatrix();camera.lookAt(0,-1.15,-4.5);
  for(const world of Object.values(worlds)){
    const moonX=aspect<.68?3.9:aspect<1?4.9:(world===worlds.entrance?6.0:6.4);
    world.moon.position.x=moonX;
    for(const cloud of world.clouds){tempV.copy(camera.position);cloud.worldToLocal(tempV);cloud.material.uniforms.uCameraLocal.value.copy(tempV);}
  }
}
window.addEventListener('resize',resize,{passive:true});resize();

function animate(){
  requestAnimationFrame(animate);
  if(document.hidden)return;
  const t=clock.getElapsedTime(),world=worlds[activeWorld];
  if(!reduceMotion){
    world.root.rotation.y=Math.sin(t*.025)*.008;
    world.root.position.y=Math.sin(t*.11)*.035;
    world.moon.position.y=(activeWorld==='entrance'?5.6:6.0)+Math.sin(t*.09)*.025;
    world.stars.rotation.z=Math.sin(t*.013)*.002;
    world.farStars.rotation.z=-Math.sin(t*.009)*.0014;
    world.nebula.material.uniforms.uTime.value=t;
    world.water.material.uniforms.uTime.value=t;
    world.fire.position.y=Math.sin(t*.17)*.055;
    for(let i=0;i<world.clouds.length;i++){
      const cloud=world.clouds[i];cloud.position.x+=Math.sin(t*.018+i*1.7)*.00045;
      cloud.material.uniforms.uTime.value=t+i*8;
      tempV.copy(camera.position);cloud.worldToLocal(tempV);cloud.material.uniforms.uCameraLocal.value.copy(tempV);
    }
    for(let i=0;i<world.flowers.length;i++){
      const flower=world.flowers[i];flower.rotation.z=Math.sin(t*.55+i*.8)*.018;
    }
  }
  renderer.render(world.scene,camera);
}
animate();
