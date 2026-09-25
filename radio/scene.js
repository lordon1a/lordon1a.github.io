// Sunshine Radio — 3D pikap sahnesi.
// Güneş ışığı alan bir oda: pencere, masa, pikap. Işık ve renkler günün vaktine göre değişir.
// app.js ile olaylar üzerinden konuşur:
//   dinler:  radio:track {videoId, title} · radio:playing (bool) · radio:progress (0..1) · radio:pulse (sayı)
//   yollar:  radio:toggle  (plağa tıklanınca)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const root = document.documentElement;
const mobile = matchMedia('(max-width: 900px)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = (hex) => new THREE.Color(hex);

/* ---------------------------------------------------------
   Vakit paletleri
   az: güneşin sağ-sol açısı, el: yüksekliği (radyan)
   --------------------------------------------------------- */
const PHASES = {
  sabah: {
    skyTop: '#8db8f2', skyLow: '#ffd7b0', sea: '#6f8fb8', seaDeep: '#2b4a78', sun: '#fff0cf', sunSize: 1.0,
    light: '#ffd4a0', lightI: 2.7, hemiSky: '#c6dbff', hemiGround: '#7d5b42', hemiI: 0.55,
    wall: '#e8d2ba', lamp: 0, env: 0.4, exposure: 0.85, beam: 0.025, stars: 0, sunY: 0.35,
    az: 0.55, el: 0.3,
  },
  ogle: {
    skyTop: '#3d82e0', skyLow: '#cfe7ff', sea: '#3f86c2', seaDeep: '#0d3d73', sun: '#ffffff', sunSize: 0.8,
    light: '#fff3df', lightI: 3.0, hemiSky: '#dbe9ff', hemiGround: '#8a6a4f', hemiI: 0.6,
    wall: '#ece0d2', lamp: 0, env: 0.45, exposure: 0.85, beam: 0.02, stars: 0, sunY: 0.8,
    az: 0.05, el: 0.62,
  },
  aksam: {
    skyTop: '#3b2150', skyLow: '#ff9147', sea: '#7a3a45', seaDeep: '#1d1026', sun: '#ffb46a', sunSize: 1.25,
    light: '#ff8e45', lightI: 3.6, hemiSky: '#7a5a96', hemiGround: '#3a2018', hemiI: 0.38,
    wall: '#c79b7d', lamp: 8, env: 0.3, exposure: 0.9, beam: 0.11, stars: 0.15, sunY: 0.12,
    az: 0.35, el: 0.36,
  },
  gece: {
    skyTop: '#03050d', skyLow: '#1a2350', sea: '#141b38', seaDeep: '#03050c', sun: '#dfe7ff', sunSize: 0.7,
    light: '#8fa6ff', lightI: 0.7, hemiSky: '#3b4775', hemiGround: '#15121c', hemiI: 0.35,
    wall: '#4a4a60', lamp: 22, env: 0.25, exposure: 1.05, beam: 0.05, stars: 1, sunY: 0.6,
    az: -0.15, el: 0.5,
  },
};
const phaseKey = () => (PHASES[root.dataset.phase] ? root.dataset.phase : 'aksam');

/* ---------------------------------------------------------
   Prosedürel dokular (canvas)
   --------------------------------------------------------- */
function canvasTex(size, draw, { repeat = 1, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

function woodTex(base, dark, light, repeat) {
  return canvasTex(1024, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * s;
      const amp = 4 + Math.random() * 14;
      const freq = 0.002 + Math.random() * 0.006;
      const ph = Math.random() * 10;
      g.strokeStyle = Math.random() < 0.6 ? dark : light;
      g.globalAlpha = 0.05 + Math.random() * 0.18;
      g.lineWidth = 0.6 + Math.random() * 2.6;
      g.beginPath();
      for (let x = 0; x <= s; x += 8) {
        const yy = y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.7 + ph) * amp * 0.25;
        x ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat });
}

// Plak olukları: halka halka parlaklık farkları
const grooveTex = canvasTex(1024, (g, s) => {
  const cx = s / 2;
  g.fillStyle = '#0b0b0d';
  g.fillRect(0, 0, s, s);
  const inner = s * 0.18;
  const outer = s * 0.5;
  const gaps = [0.36, 0.5, 0.63, 0.77, 0.9].map((f) => inner + (outer - inner) * f);
  for (let r = inner; r < outer; r += 1.1) {
    const gap = gaps.some((x) => Math.abs(r - x) < 3);
    const v = gap ? 30 : 14 + Math.random() * 16;
    g.strokeStyle = `rgb(${v},${v},${v + 2})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cx, r, 0, Math.PI * 2);
    g.stroke();
  }
}, { srgb: true });

const grooveRough = canvasTex(1024, (g, s) => {
  const cx = s / 2;
  g.fillStyle = '#777';
  g.fillRect(0, 0, s, s);
  for (let r = s * 0.18; r < s * 0.5; r += 1.3) {
    const v = 70 + Math.random() * 90;
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.arc(cx, cx, r, 0, Math.PI * 2);
    g.stroke();
  }
}, { srgb: false });

const plasterTex = canvasTex(512, (g, s) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) {
    const v = 225 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
}, { repeat: 3 });

/* ---------------------------------------------------------
   Plak etiketi: kapak görseli + dairesel yazı
   --------------------------------------------------------- */
const labelCanvas = document.createElement('canvas');
labelCanvas.width = labelCanvas.height = 1024;
const labelTex = new THREE.CanvasTexture(labelCanvas);
labelTex.colorSpace = THREE.SRGBColorSpace;
labelTex.anisotropy = 8;

function circleText(g, text, cx, cy, r, font, color) {
  g.save();
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let a = -Math.PI / 2 - g.measureText(text).width / r / 2;
  for (const ch of text) {
    const w = g.measureText(ch).width;
    a += w / r / 2;
    g.save();
    g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.rotate(a + Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
    a += w / r / 2;
  }
  g.restore();
}

function drawLabel(img, title) {
  const g = labelCanvas.getContext('2d');
  const s = 1024;
  const c = s / 2;
  g.clearRect(0, 0, s, s);
  const grad = g.createRadialGradient(c, c * 0.8, 0, c, c, c);
  grad.addColorStop(0, '#ffd66b');
  grad.addColorStop(0.7, '#f58a1f');
  grad.addColorStop(1, '#d9531a');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c, 0, Math.PI * 2);
  g.fill();

  // güneş ışınları
  g.save();
  g.translate(c, c);
  for (let i = 0; i < 36; i++) {
    g.rotate((Math.PI * 2) / 36);
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(120,30,0,0.06)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(c, -c * 0.045);
    g.lineTo(c, c * 0.045);
    g.fill();
  }
  g.restore();

  const ir = s * 0.27;
  if (img) {
    g.save();
    g.beginPath();
    g.arc(c, c, ir, 0, Math.PI * 2);
    g.clip();
    // hqdefault 480x360, üst-alt siyah bantlı: ortadaki kareyi kırp
    const side = Math.min(img.width, img.height * 0.75);
    g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, c - ir, c - ir, ir * 2, ir * 2);
    g.restore();
  } else {
    const sg = g.createRadialGradient(c, c, 0, c, c, ir);
    sg.addColorStop(0, '#fff8dc');
    sg.addColorStop(0.55, '#ffc23d');
    sg.addColorStop(1, '#ff8a1c');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(c, c, ir, 0, Math.PI * 2);
    g.fill();
  }
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(60,15,0,0.55)';
  g.beginPath();
  g.arc(c, c, ir, 0, Math.PI * 2);
  g.stroke();

  circleText(g, 'SUNSHINE RADIO  ·  33⅓ RPM  ·  STEREO', c, c, s * 0.405, '700 46px "DM Sans", sans-serif', '#3a1204');
  const t = (title || 'yayın bekleniyor').toUpperCase();
  const short = t.length > 34 ? t.slice(0, 33) + '…' : t;
  g.save();
  g.translate(c, c);
  g.rotate(Math.PI);
  circleText(g, short, 0, 0, s * 0.335, '600 36px "DM Sans", sans-serif', 'rgba(58,18,4,0.85)');
  g.restore();

  g.fillStyle = '#d8d8d8';
  g.beginPath();
  g.arc(c, c, 16, 0, Math.PI * 2);
  g.fill();
  labelTex.needsUpdate = true;
}

let labelToken = 0;
function setTrack(videoId, title) {
  const token = ++labelToken;
  drawLabel(null, title);
  if (!videoId) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { if (token === labelToken) drawLabel(img, title); };
  img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/* ---------------------------------------------------------
   Renderer, kamera, sahne
   --------------------------------------------------------- */
const canvas = document.createElement('canvas');
canvas.className = 'scene-canvas';
canvas.setAttribute('aria-label', 'Pikap sahnesi. Plağa tıklayarak çal / durdur.');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  console.warn('WebGL yok, sahne kapalı', e);
}

if (renderer) {
  document.body.prepend(canvas);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const P = {}; // şu anki (yumuşak geçişli) palet
  for (const [k, v] of Object.entries(PHASES[phaseKey()])) P[k] = typeof v === 'string' ? C(v) : v;

  /* ---------- Işıklar ---------- */
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight(0xffffff, 3);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sunLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.03;
  sunLight.shadow.radius = 4;
  scene.add(sunLight, sunLight.target);

  const lamp = new THREE.PointLight(0xffb36b, 0, 0, 2); // akşam/gece sıcak masa lambası
  lamp.position.set(-4.2, 3.2, 1.8);
  scene.add(lamp);

  /* ---------- Oda: masa, duvar, pencere ---------- */
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    new THREE.MeshStandardMaterial({ map: woodTex('#b98457', '#7a4a28', '#d9a878', 10), roughness: 0.62 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.z = 16.2; // sadece odanın içinde (duvardan öne)
  table.receiveShadow = true;
  scene.add(table);

  const WALL_Z = -3.8;
  const WIN = { x0: -4.6, x1: 2.6, y0: 1.1, y1: 8.5 }; // pencere boşluğu
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: plasterTex, roughness: 0.95 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf6efe6, roughness: 0.5 });
  const wall = new THREE.Group();
  const box = (w, h, d, x, y, z, m = wallMat) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    b.castShadow = true;
    b.receiveShadow = true;
    wall.add(b);
    return b;
  };
  const T = 0.35;
  const W = 60;
  const H = 30;
  box(W, WIN.y0, T, 0, WIN.y0 / 2, WALL_Z);                                             // alt
  box(W, H - WIN.y1, T, 0, WIN.y1 + (H - WIN.y1) / 2, WALL_Z);                          // üst
  box(W / 2 + WIN.x0, WIN.y1 - WIN.y0, T, (WIN.x0 - W / 2) / 2, (WIN.y0 + WIN.y1) / 2, WALL_Z); // sol
  box(W / 2 - WIN.x1, WIN.y1 - WIN.y0, T, (WIN.x1 + W / 2) / 2, (WIN.y0 + WIN.y1) / 2, WALL_Z); // sağ
  // çerçeve ve kayıtlar
  const fw = 0.12;
  const midX = (WIN.x0 + WIN.x1) / 2;
  const midY = WIN.y0 + (WIN.y1 - WIN.y0) * 0.58;
  box(fw, WIN.y1 - WIN.y0, 0.16, midX, (WIN.y0 + WIN.y1) / 2, WALL_Z, frameMat);
  box(WIN.x1 - WIN.x0, fw, 0.16, midX, midY, WALL_Z, frameMat);
  box(WIN.x1 - WIN.x0 + 0.5, 0.14, 0.7, midX, WIN.y0 - 0.02, WALL_Z + 0.25, frameMat); // pervaz
  scene.add(wall);

  /* ---------- Dışarısı: gökyüzü + deniz (pencereden görünen) ---------- */
  const BACK_Z = -22;
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uTop: { value: C('#000') }, uLow: { value: C('#000') }, uSea: { value: C('#000') },
      uDeep: { value: C('#000') }, uSun: { value: C('#fff') }, uSunPos: { value: new THREE.Vector2() },
      uSunR: { value: 1 }, uHorizon: { value: 0 }, uStars: { value: 0 }, uSpan: { value: 10 },
    },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSunR, uHorizon, uStars, uSpan;
      uniform vec3 uTop, uLow, uSea, uDeep, uSun; uniform vec2 uSunPos;
      varying vec2 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 d = vP - uSunPos;
        float dist = length(d) / uSunR;
        vec3 col;
        if (vP.y > uHorizon) {
          float t = clamp((vP.y - uHorizon) / uSpan, 0.0, 1.0);
          col = mix(uLow, uTop, smoothstep(0.0, 0.9, t));
          vec2 sc = floor(vP * 6.0);
          float st = step(0.994, hash(sc)) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(sc) * 50.0));
          col += st * uStars * smoothstep(0.05, 0.3, t);
          // güneş diski + hale (1'in üstü değerler bloom ile parlar)
          col += uSun * smoothstep(1.02, 0.97, dist) * 2.6;
          col += uSun * 0.9 * exp(-dist * 1.1) + uLow * 0.35 * exp(-dist * 0.25);
          // bulut şeritleri
          float c = noise(vec2(vP.x * 0.15 + uTime * 0.01, vP.y * 1.6));
          col = mix(col, mix(col, uLow * 1.2, 0.5), smoothstep(0.55, 0.8, c) * (1.0 - t) * 0.6);
        } else {
          float depth = clamp((uHorizon - vP.y) / (uSpan * 0.6), 0.0, 1.0);
          col = mix(uSea, uDeep, smoothstep(0.0, 0.8, depth));
          float z = min(1.0 / (depth + 0.05), 7.0); // ufukta aşırı sıklaşıp kareli görünmesin
          float dx = (vP.x - uSunPos.x) / uSunR;
          float column = exp(-pow(dx / (0.9 + depth * 2.0), 2.0));
          float w = noise(vec2(dx * z * 1.6, z * 4.0 - uTime * 0.6)) * noise(vec2(dx * 5.0, z * 9.0 + uTime * 0.4));
          col += uSun * column * smoothstep(0.04, 0.6, w) * 1.9 * (1.0 - depth * 0.6);
          col += uLow * 0.5 * exp(-depth * 18.0);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), skyMat);
  sky.position.z = BACK_Z;
  scene.add(sky);

  /* ---------- Işık huzmeleri (pencere camlarından) ---------- */
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: C('#fff') }, uAmount: { value: 0.1 }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmount, uTime; varying vec2 vUv;
      void main(){
        float along = vUv.y;
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float flicker = 0.85 + 0.15 * sin(uTime * 0.7 + vUv.x * 6.0);
        float a = uAmount * pow(1.0 - along, 1.6) * edge * flicker;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
  const beams = new THREE.Group();
  scene.add(beams);
  const panes = [
    [WIN.x0, midX - fw / 2, midY + fw / 2, WIN.y1],
    [midX + fw / 2, WIN.x1, midY + fw / 2, WIN.y1],
    [WIN.x0, midX - fw / 2, WIN.y0, midY - fw / 2],
    [midX + fw / 2, WIN.x1, WIN.y0, midY - fw / 2],
  ];
  function rebuildBeams(dir) {
    beams.clear();
    const L = 16;
    const off = dir.clone().multiplyScalar(-L); // ışık odanın içine doğru ilerler
    for (const [x0, x1, y0, y1] of panes) {
      const a = [new THREE.Vector3(x0, y0, WALL_Z), new THREE.Vector3(x1, y0, WALL_Z), new THREE.Vector3(x1, y1, WALL_Z), new THREE.Vector3(x0, y1, WALL_Z)];
      const b = a.map((v) => v.clone().add(off));
      const pos = [];
      const uv = [];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        pos.push(...a[i].toArray(), ...a[j].toArray(), ...b[j].toArray(), ...a[i].toArray(), ...b[j].toArray(), ...b[i].toArray());
        uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      beams.add(new THREE.Mesh(geo, beamMat));
    }
  }

  /* ---------- Toz zerreleri ---------- */
  const DUST = mobile ? 90 : 200;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos.set([(Math.random() - 0.5) * 12 - 0.5, Math.random() * 6, (Math.random() - 0.5) * 8 - 0.5], i * 3);
    dustSeed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: C('#fff') }, uScale: { value: 1 }, uAmount: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uScale; attribute float aSeed; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.13 + aSeed * 40.0) * 0.6;
        p.y = mod(p.y + uTime * (0.02 + aSeed * 0.05), 6.0);
        p.z += cos(uTime * 0.1 + aSeed * 30.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.6 + aSeed * 1.4) * uScale / -mv.z;
        vA = 0.4 + 0.6 * sin(uTime * (0.8 + aSeed) + aSeed * 20.0) * 0.5 + 0.3;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmount; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor * smoothstep(0.5, 0.0, d) * vA * uAmount, 1.0); }`,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  /* ---------- Pikap ---------- */
  const tt = new THREE.Group();
  scene.add(tt);
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  const walnut = new THREE.MeshPhysicalMaterial({
    map: woodTex('#5a311b', '#2e170b', '#8a5230', 1), roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25,
  });
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9cacf, metalness: 1, roughness: 0.42 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c1c20, metalness: 0.7, roughness: 0.35 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12 });

  const plinth = shadowy(new THREE.Mesh(new RoundedBoxGeometry(5.0, 0.6, 3.8, 4, 0.14), walnut));
  plinth.position.y = 0.42;
  tt.add(plinth);
  const topPlate = shadowy(new THREE.Mesh(new RoundedBoxGeometry(4.8, 0.04, 3.6, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.55, metalness: 0.2 })));
  topPlate.position.y = 0.73;
  tt.add(topPlate);
  for (const [x, z] of [[-2.1, -1.5], [2.1, -1.5], [-2.1, 1.5], [2.1, 1.5]]) {
    const f = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.14, 32), darkMetal));
    f.position.set(x, 0.07, z);
    tt.add(f);
  }

  const PC = new THREE.Vector3(-0.55, 0, 0.05); // tabla merkezi
  const platter = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.66, 0.14, 128), alu));
  platter.position.set(PC.x, 0.82, PC.z);
  tt.add(platter);

  const record = new THREE.Group();
  record.position.set(PC.x, 0.9, PC.z);
  tt.add(record);
  const vinylTop = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: grooveTex, roughnessMap: grooveRough, roughness: 0.62, metalness: 0,
    clearcoat: 0.45, clearcoatRoughness: 0.32, sheen: 0.25, sheenColor: new THREE.Color(0x333340),
  });
  const vinylSide = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 });
  const disc = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.58, 0.03, 160), [vinylSide, vinylTop, vinylSide]));
  record.add(disc);
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.6, 96), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.6 }));
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.017;
  label.receiveShadow = true;
  record.add(label);
  const spindle = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 16), chrome));
  spindle.position.y = 0.08;
  record.add(spindle);

  // Kol: pivot sağ arkada
  const PIV = new THREE.Vector3(1.6, 0, -1.2);
  const armBase = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.16, 48), alu));
  armBase.position.set(PIV.x, 0.83, PIV.z);
  tt.add(armBase);
  const armPost = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 24), chrome));
  armPost.position.set(PIV.x, 1.0, PIV.z);
  tt.add(armPost);

  const armYaw = new THREE.Group();
  armYaw.position.set(PIV.x, 1.13, PIV.z);
  tt.add(armYaw);
  const armLift = new THREE.Group();
  armYaw.add(armLift);
  const ARM_L = 2.55;
  const tube = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, ARM_L, 24), chrome));
  tube.rotation.z = -Math.PI / 2;
  tube.position.x = ARM_L / 2;
  armLift.add(tube);
  const weight = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 40), darkMetal));
  weight.rotation.z = Math.PI / 2;
  weight.position.x = -0.42;
  armLift.add(weight);
  const head = new THREE.Group();
  head.position.x = ARM_L;
  head.rotation.y = 0.35;
  armLift.add(head);
  const shell = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.05, 0.22, 2, 0.02), darkMetal));
  shell.position.set(0.15, -0.03, 0);
  head.add(shell);
  const cart = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0xe8a33a, roughness: 0.4 })));
  cart.position.set(0.13, -0.12, 0);
  head.add(cart);
  const fingerLift = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), chrome));
  fingerLift.rotation.x = Math.PI / 2;
  fingerLift.position.set(0.32, -0.01, 0.16);
  head.add(fingerLift);

  // Kolun, iğneyi plağın belirli bir yarıçapına koyacak açısını bul
  const needleOffset = new THREE.Vector3(0.13, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
  function yawForRadius(r) {
    let best = 0;
    let err = Infinity;
    for (let a = -Math.PI; a < Math.PI; a += 0.002) {
      const tip = new THREE.Vector3(ARM_L, 0, 0).add(needleOffset).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      const x = PIV.x + tip.x - PC.x;
      const z = PIV.z + tip.z - PC.z;
      const e = Math.abs(Math.hypot(x, z) - r);
      // iki çözüm var; plağın ön tarafından geçeni seç
      if (e < err && PIV.z + tip.z > PC.z) { err = e; best = a; }
    }
    return best;
  }
  const YAW_OUT = yawForRadius(1.48);
  const YAW_IN = yawForRadius(0.72);
  const YAW_REST = -Math.PI / 2 - 0.05; // öne doğru park

  // Plak/tabla tıklanabilir
  const clickables = [disc, label, platter];

  /* ---------- Post-processing ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.6, 0.97);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- Durum ---------- */
  const state = { playing: false, progress: 0, spin: 0, yaw: YAW_REST, lift: 0.12, pulse: 0 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const sunDir = new THREE.Vector3();
  let lastBeamKey = '';
  let viewShift = 0;

  function layout() {
    const w = innerWidth;
    const h = innerHeight;
    const chat = document.getElementById('chat');
    const chatW = !mobile && chat && !chat.hidden ? chat.getBoundingClientRect().width : 0;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    viewShift = chatW / 2;
    camera.setViewOffset(w, h, viewShift, mobile ? h * 0.08 : 0, w, h);
    camera.updateProjectionMatrix();
    dustMat.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.05;

    // Dar ekranda pikabın tamamı sığsın diye kamerayı geri çek
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const need = 6.2 / (2 * Math.tan(hfov / 2));
    const dir = CAM_DEFAULT.clone().sub(CAM_LOOK);
    CAM_BASE.copy(CAM_LOOK).add(dir.setLength(Math.max(dir.length(), need)));
  }

  // Pencereden görünen gökyüzü alanını hesapla, güneşi oraya yerleştir
  const ray = new THREE.Raycaster();
  const backPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -BACK_Z);
  function windowView() {
    const pts = [];
    for (const [x, y] of [[WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x0, WIN.y1], [WIN.x1, WIN.y1]]) {
      const dir = new THREE.Vector3(x, y, WALL_Z).sub(camera.position).normalize();
      ray.set(camera.position, dir);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(backPlane, hit)) pts.push(hit);
    }
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  const CAM_DEFAULT = new THREE.Vector3(1.6, 5.2, 9.8);
  const CAM_BASE = CAM_DEFAULT.clone();
  const CAM_LOOK = new THREE.Vector3(-0.4, 1.25, -1.0);

  function applyPalette(dt) {
    const target = PHASES[phaseKey()];
    const k = dt == null ? 1 : Math.min(dt * 1.2, 1);
    for (const [key, v] of Object.entries(target)) {
      if (typeof v === 'string') P[key].lerp(C(v), k);
      else P[key] += (v - P[key]) * k;
    }
    hemi.color.copy(P.hemiSky);
    hemi.groundColor.copy(P.hemiGround);
    hemi.intensity = P.hemiI;
    sunLight.color.copy(P.light);
    sunLight.intensity = P.lightI * (1 + state.pulse * 0.25);
    lamp.intensity = P.lamp;
    wallMat.color.copy(P.wall);
    scene.environmentIntensity = P.env;
    renderer.toneMappingExposure = P.exposure;

    sunDir.set(Math.sin(P.az) * Math.cos(P.el), Math.sin(P.el), -Math.cos(P.az) * Math.cos(P.el)).normalize();
    sunLight.position.copy(sunDir).multiplyScalar(30);
    sunLight.target.position.set(0, 0, 0);
    const beamKey = sunDir.toArray().map((n) => n.toFixed(3)).join();
    if (beamKey !== lastBeamKey) { lastBeamKey = beamKey; rebuildBeams(sunDir); }
    beamMat.uniforms.uColor.value.copy(P.light);
    beamMat.uniforms.uAmount.value = P.beam * (1 + state.pulse * 0.8);
    dustMat.uniforms.uColor.value.copy(P.light).lerp(C('#ffffff'), 0.3);
    dustMat.uniforms.uAmount.value = 0.12 + P.beam * 2;

    const u = skyMat.uniforms;
    u.uTop.value.copy(P.skyTop);
    u.uLow.value.copy(P.skyLow);
    u.uSea.value.copy(P.sea);
    u.uDeep.value.copy(P.seaDeep);
    u.uSun.value.copy(P.sun);
    u.uStars.value = P.stars;
    const v = windowView();
    const span = v.y1 - v.y0;
    u.uHorizon.value = v.y0 + span * 0.3;
    u.uSpan.value = span * 0.8;
    u.uSunR.value = span * 0.09 * P.sunSize;
    u.uSunPos.value.set(v.x0 + (v.x1 - v.x0) * (0.5 + P.az * 0.5), u.uHorizon.value + span * 0.55 * P.sunY + u.uSunR.value * 0.2);
    bloom.strength = 0.42 + state.pulse * 0.2;
  }

  /* ---------- Döngü ---------- */
  let running = false;
  let last = performance.now();
  let time = 0;
  const RPM = (33.333 / 60) * Math.PI * 2;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;

    // plak: çalarken 33⅓ devir, durunca yavaşlar
    const targetSpin = state.playing ? RPM : 0;
    state.spin += (targetSpin - state.spin) * Math.min(dt * (state.playing ? 1.6 : 0.9), 1);
    record.rotation.y -= state.spin * dt;

    // kol: çalarken şarkı ilerledikçe içe kayar, durunca kalkıp park eder
    const onRecord = state.playing || state.progress > 0.001;
    const yawTarget = onRecord ? YAW_OUT + (YAW_IN - YAW_OUT) * state.progress : YAW_REST;
    const liftTarget = state.playing ? 0 : 0.1;
    state.yaw += (yawTarget - state.yaw) * Math.min(dt * 1.4, 1);
    state.lift += (liftTarget - state.lift) * Math.min(dt * 2.2, 1);
    armYaw.rotation.y = state.yaw;
    armLift.rotation.z = state.lift + 0.02;

    state.pulse *= Math.pow(0.15, dt);

    // kamera: yavaş nefes + fare paralaksı
    mouse.x += (mouse.tx - mouse.x) * Math.min(dt * 2, 1);
    mouse.y += (mouse.ty - mouse.y) * Math.min(dt * 2, 1);
    const breathe = reduced ? 0 : 1;
    camera.position.set(
      CAM_BASE.x + mouse.x * 0.8 + Math.sin(time * 0.11) * 0.25 * breathe,
      CAM_BASE.y - mouse.y * 0.4 + Math.sin(time * 0.07) * 0.12 * breathe,
      CAM_BASE.z,
    );
    camera.lookAt(CAM_LOOK);

    applyPalette(dt);
    skyMat.uniforms.uTime.value = time;
    beamMat.uniforms.uTime.value = time;
    dustMat.uniforms.uTime.value = time;

    composer.render(dt);
  }

  function setRunning(on) {
    on = on && !document.hidden;
    if (on === running) return;
    running = on;
    if (on) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  /* ---------- Etkileşim ---------- */
  const pointer = new THREE.Vector2();
  function hitRecord(e) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(clickables, false).length > 0;
  }
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
    if (e.target === canvas) canvas.style.cursor = hitRecord(e) ? 'pointer' : '';
  });
  canvas.addEventListener('click', (e) => { if (hitRecord(e)) dispatchEvent(new CustomEvent('radio:toggle')); });

  addEventListener('radio:track', (e) => { setTrack(e.detail?.videoId, e.detail?.title); state.pulse = 1; });
  addEventListener('radio:playing', (e) => { state.playing = !!e.detail; });
  addEventListener('radio:progress', (e) => { state.progress = Math.min(Math.max(+e.detail || 0, 0), 1); });
  addEventListener('radio:pulse', (e) => { state.pulse = Math.min(state.pulse + (+e.detail || 0.4), 1.5); });

  addEventListener('resize', layout);
  new ResizeObserver(layout).observe(document.body);
  new MutationObserver(layout).observe(document.getElementById('chat'), { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', () => setRunning(true));

  drawLabel(null, '');
  document.fonts?.ready.then(() => { if (labelToken === 0) drawLabel(null, ''); });
  camera.position.copy(CAM_BASE);
  camera.lookAt(CAM_LOOK);
  layout();
  applyPalette();
  setRunning(true);
  requestAnimationFrame(() => root.classList.add('scene-ready'));
}
