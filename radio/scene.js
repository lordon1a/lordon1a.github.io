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

// Plak etiketi: siyah zemin, ortada çalan şarkının kapağı (yoksa Siyah Bayrak logosu)
const logoImg = new Image();
logoImg.src = 'siyahbayrak-logo.jpg';
let labelTitle = '';
let coverImg = null; // çalan şarkının YouTube kapağı

function drawLabel(title = labelTitle) {
  labelTitle = title;
  const g = labelCanvas.getContext('2d');
  const s = 1024;
  const c = s / 2;
  g.clearRect(0, 0, s, s);
  const grad = g.createRadialGradient(c * 0.8, c * 0.7, 0, c, c, c);
  grad.addColorStop(0, '#1b1b1d');
  grad.addColorStop(1, '#050506');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c, 0, Math.PI * 2);
  g.fill();

  // ince baskı halkaları
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 3;
  for (const r of [c * 0.96, c * 0.9]) {
    g.beginPath();
    g.arc(c, c, r, 0, Math.PI * 2);
    g.stroke();
  }

  // ortada çalan şarkının kapağı; yoksa Siyah Bayrak logosu
  const ir = s * 0.28;
  if (coverImg) {
    g.save();
    g.beginPath();
    g.arc(c, c, ir, 0, Math.PI * 2);
    g.clip();
    // hqdefault 480x360, üst-alt siyah bantlı: ortadaki kareyi kırp
    const side = Math.min(coverImg.width, coverImg.height * 0.75);
    g.drawImage(coverImg, (coverImg.width - side) / 2, (coverImg.height - side) / 2, side, side, c - ir, c - ir, ir * 2, ir * 2);
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(c, c, ir, 0, Math.PI * 2);
    g.stroke();
  } else if (logoImg.complete && logoImg.naturalWidth) {
    const w = s * 0.62;
    const h = w * (logoImg.naturalHeight / logoImg.naturalWidth);
    g.save();
    g.globalCompositeOperation = 'screen';
    g.drawImage(logoImg, c - w / 2, c - h / 2, w, h);
    g.restore();
  }
  circleText(g, 'SUNSHINE RADIO  ·  33⅓ RPM', c, c, s * 0.39, '600 34px "DM Sans", sans-serif', 'rgba(242,242,242,0.75)');

  // çalan şarkı: etiketin alt kenarında dönen yazı
  const t = (title || 'SİYAH BAYRAK').toLocaleUpperCase('tr');
  const short = t.length > 30 ? t.slice(0, 29) + '…' : t;
  g.save();
  g.translate(c, c);
  g.rotate(Math.PI);
  circleText(g, short, 0, 0, s * 0.39, '600 34px "DM Sans", sans-serif', 'rgba(242,242,242,0.8)');
  g.restore();

  g.fillStyle = '#cfcfd2';
  g.beginPath();
  g.arc(c, c, 16, 0, Math.PI * 2);
  g.fill();
  labelTex.needsUpdate = true;
}
logoImg.onload = () => drawLabel();

let labelToken = 0;
function setTrack(videoId, title) {
  const token = ++labelToken;
  coverImg = null;
  drawLabel(title || '');
  if (!videoId) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => { if (token === labelToken) { coverImg = img; drawLabel(); } };
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
  const WIN = { x0: -3.75, x1: 1.5, y0: 1.1, y1: 8.5 }; // pencere boşluğu
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
      uSunR: { value: 1 }, uHorizon: { value: 0 }, uStars: { value: 0 }, uSpan: { value: 10 }, uViewX: { value: new THREE.Vector2(-5, 5) },
    },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSunR, uHorizon, uStars, uSpan;
      uniform vec3 uTop, uLow, uSea, uDeep, uSun; uniform vec2 uSunPos, uViewX;
      varying vec2 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float f = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) { f += a * noise(p); p = m * p; a *= 0.5; } return f; }
      // Yatayda uzamış dalgalar + ince kırışıklar
      float waves(vec2 p){
        return fbm(vec2(p.x * 0.7, p.y * 2.2) + vec2(uTime * 0.04, -uTime * 0.32))
             + 0.45 * fbm(vec2(p.x * 1.9 + p.y * 0.6, p.y * 4.3) + vec2(-uTime * 0.08, -uTime * 0.55));
      }
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
          // Perspektifli dalga alanı: normal → gökyüzü yansıması (fresnel) + güneş parıltısı
          float depth = clamp((uHorizon - vP.y) / (uSpan * 0.6), 0.0, 1.0);
          float z = min(1.0 / (depth + 0.035), 26.0);
          vec2 p = vec2((vP.x - uSunPos.x) / uSpan * z * 3.2, z * 1.1);
          float e = 0.035;
          float h0 = waves(p);
          float hx = waves(p + vec2(e, 0.0)) - h0;
          float hz = waves(p + vec2(0.0, e)) - h0;
          float detail = smoothstep(0.0, 0.3, depth) * 0.85 + 0.15; // ufukta düzleşsin, kıpırdamasın
          vec3 N = normalize(vec3(-hx / e * 0.22 * detail, 1.0, -hz / e * 0.22 * detail));
          vec3 V = normalize(vec3((vP.x - uSunPos.x) / uSpan * 1.4, -(0.015 + depth * 0.55), 1.0));
          vec3 R = reflect(V, N);
          vec3 S = normalize(vec3(0.0, max((uSunPos.y - uHorizon) / uSpan * 1.4, 0.02), 1.0));
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
          vec3 water = mix(uSea, uDeep, smoothstep(0.0, 0.9, depth));
          vec3 skyR = mix(uLow, uTop, clamp(R.y * 2.5, 0.0, 1.0));
          col = mix(water, skyR, fres);
          float rs = max(dot(R, S), 0.0);
          col += uSun * (pow(rs, 900.0) * 7.0 + pow(rs, 90.0) * 0.5);
          col = mix(col, uLow * 0.85, exp(-depth * 22.0) * 0.6); // ufuk pusu
        }

        // uzaktaki adalar (pusla birlikte)
        float vw = uViewX.y - uViewX.x;
        vec3 haze = mix(uDeep, uLow, 0.3);
        float x1 = (vP.x - (uViewX.x + vw * 0.2)) / (vw * 0.2);
        float x2 = (vP.x - (uViewX.x + vw * 0.36)) / (vw * 0.1);
        float hill = max(pow(max(1.0 - abs(x1), 0.0), 1.5) * (0.85 + 0.3 * noise(vec2(vP.x * 2.0, 1.0))), 0.6 * pow(max(1.0 - abs(x2), 0.0), 1.3));
        if (vP.y >= uHorizon && vP.y < uHorizon + hill * uSpan * 0.07) col = mix(col, haze, 0.85);


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

  // Piyano siyahı gövde, siyah fırçalanmış metal üst plaka
  const pianoBlack = new THREE.MeshPhysicalMaterial({ color: 0x08080a, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  const brushedTex = canvasTex(512, (g, s) => {
    g.fillStyle = '#808080';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) {
      const v = 100 + Math.random() * 60;
      g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
      g.beginPath();
      const y = Math.random() * s;
      g.moveTo(0, y);
      g.lineTo(s, y + (Math.random() - 0.5) * 2);
      g.stroke();
    }
  }, { srgb: false });
  const alu = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.9, roughness: 0.38 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c1c20, metalness: 0.7, roughness: 0.35 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12 });

  const plinth = shadowy(new THREE.Mesh(new RoundedBoxGeometry(5.0, 0.6, 3.8, 4, 0.14), pianoBlack));
  plinth.position.y = 0.42;
  tt.add(plinth);
  const topPlate = shadowy(new THREE.Mesh(new RoundedBoxGeometry(4.8, 0.04, 3.6, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0x151518, roughness: 0.5, roughnessMap: brushedTex, metalness: 0.75 })));
  topPlate.position.y = 0.73;
  tt.add(topPlate);
  for (const [x, z] of [[-2.1, -1.5], [2.1, -1.5], [-2.1, 1.5], [2.1, 1.5]]) {
    const f = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.14, 32), chrome));
    f.position.set(x, 0.07, z);
    tt.add(f);
  }

  const PC = new THREE.Vector3(-0.55, 0, 0.05); // tabla merkezi
  const strobeTex = canvasTex(1024, (g, s) => {
    g.fillStyle = '#1a1a1d';
    g.fillRect(0, 0, s, s);
    const rows = [[0.22, 180], [0.5, 184], [0.78, 188]];
    for (const [y, n] of rows) {
      for (let i = 0; i < n; i++) {
        g.fillStyle = '#b9bcc4';
        g.fillRect((i / n) * s, y * s - 26, (s / n) * 0.5, 52);
      }
    }
  });
  strobeTex.wrapS = THREE.RepeatWrapping;
  const platterSide = new THREE.MeshStandardMaterial({ map: strobeTex, metalness: 0.85, roughness: 0.3 });
  const platter = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1.66, 1.66, 0.14, 128), [platterSide, alu, alu]));
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
  const weight = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 40), chrome));
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

  /* ---------- Pikap ayrıntıları ---------- */
  const TOP = 0.755; // üst plakanın yüzeyi
  const btnMat = new THREE.MeshPhysicalMaterial({ color: 0x1c1c20, roughness: 0.3, clearcoat: 0.8, metalness: 0.3 });
  const textTex = (text, w, h, font, color = '#e8e8ea') => canvasTex(512, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = color;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, s / 2, s / 2);
  });
  const printed = (text, w, x, z, font, rotY = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshStandardMaterial({ map: textTex(text, w, w, font), transparent: true, roughness: 0.6, depthWrite: false }));
    m.rotation.set(-Math.PI / 2, 0, rotY);
    m.position.set(x, TOP + 0.003, z);
    tt.add(m);
    return m;
  };

  // start/stop ve 33/45 düğmeleri (sol ön)
  const startBtn = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.06, 0.42, 2, 0.03), btnMat));
  startBtn.position.set(-2.05, TOP + 0.02, 1.45);
  tt.add(startBtn);
  printed('START · STOP', 0.6, -2.05, 1.45 + 0.002, '600 44px "DM Mono", monospace').position.y = TOP + 0.055;
  for (const [i, t] of [[0, '33'], [1, '45']]) {
    const b = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 32), btnMat));
    b.position.set(-1.55 + i * 0.3, TOP + 0.02, 1.52);
    tt.add(b);
    printed(t, 0.24, -1.55 + i * 0.3, 1.52, '700 150px "DM Sans", sans-serif').position.y = TOP + 0.047;
  }
  // hız ışığı (çalarken kırmızı yanar)
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), ledMat);
  led.position.set(-1.55, TOP + 0.02, 1.3);
  tt.add(led);

  // pitch sürgüsü (sağ ön)
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 1.05), new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.9 }));
  slot.position.set(2.15, TOP + 0.002, 0.75);
  tt.add(slot);
  const fader = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.1, 0.16, 2, 0.03), chrome));
  fader.position.set(2.15, TOP + 0.05, 0.72);
  tt.add(fader);
  for (let i = 0; i <= 8; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(i % 4 ? 0.06 : 0.12, 0.004, 0.012), new THREE.MeshStandardMaterial({ color: 0xcfcfd2, roughness: 0.5 }));
    tick.position.set(2.32, TOP + 0.003, 0.28 + i * 0.118);
    tt.add(tick);
  }

  // kol yuvası (park yeri), kaldırma kolu, anti-skate düğmesi
  const rest = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 16), chrome));
  rest.position.set(PIV.x, TOP + 0.18, 1.1);
  tt.add(rest);
  const restCup = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.06, 0.12, 2, 0.02), btnMat));
  restCup.position.set(PIV.x, TOP + 0.37, 1.1);
  tt.add(restCup);
  const cueBase = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), btnMat));
  cueBase.position.set(PIV.x + 0.5, TOP + 0.07, -0.55);
  tt.add(cueBase);
  const cueLever = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 8), chrome));
  cueLever.position.set(PIV.x + 0.5, TOP + 0.18, -0.42);
  cueLever.rotation.x = 1.1;
  tt.add(cueLever);
  const skate = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 32), chrome));
  skate.position.set(PIV.x + 0.55, TOP + 0.04, -1.45);
  tt.add(skate);

  // iğne lambası (açılır ışık) — ucu sıcak yanar
  const tlPost = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 24), chrome));
  tlPost.position.set(-2.15, TOP + 0.17, -1.5);
  tt.add(tlPost);
  const tlTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 2.2 }));
  tlTip.position.set(-2.15, TOP + 0.36, -1.5);
  tt.add(tlTip);
  const tlLight = new THREE.SpotLight(0xffe2b0, 3, 4, 0.5, 0.6, 2);
  tlLight.position.copy(tlTip.position);
  tlLight.target.position.set(PC.x - 0.4, TOP, PC.z - 0.6);
  tt.add(tlLight, tlLight.target);

  // arka kapak menteşeleri
  for (const x of [-1.6, 1.6]) {
    const hinge = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.14, 0.12, 2, 0.03), btnMat));
    hinge.position.set(x, TOP + 0.08, -1.93);
    tt.add(hinge);
  }


  /* ---------- Duvarda kanla çizilmiş gülen yüz (Red John imzası) ---------- */
  const tickers = []; // her karede çağrılan küçük animasyonlar

  // Görsel: radio/redjohn.png (saydam arka planlı). Değiştirmek için aynı adla yeni bir PNG koy.
  const SMILEY_ASPECT = 522 / 704;
  const smileyTex = new THREE.TextureLoader().load('redjohn.png');
  smileyTex.colorSpace = THREE.SRGBColorSpace;
  smileyTex.anisotropy = 8;

  const smiley = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4 * SMILEY_ASPECT, 2.4),
    new THREE.MeshPhysicalMaterial({
      map: smileyTex, transparent: true, depthWrite: false, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3,
      polygonOffset: true, polygonOffsetFactor: -2,
    }),
  );
  smiley.position.set(3.2, 2.95, WALL_Z + T / 2 + 0.005);
  smiley.receiveShadow = true;
  scene.add(smiley);

  /* ---------- Masadaki figürler ---------- */
  const lathe = (pts, mat, seg = 64) => shadowy(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat));

  // Çay fincanı ve tabağı (Jane'in çayı), üstünde buhar
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf7f3ec, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.3 });
  const tea = new THREE.Group();
  tea.position.set(3.05, 0, 1.55);
  tea.rotation.y = -0.6;
  scene.add(tea);
  tea.add(lathe([[0, 0], [0.5, 0], [0.56, 0.05], [0.52, 0.065], [0.22, 0.035], [0, 0.035]], porcelain));
  const cup = lathe([[0, 0.035], [0.17, 0.035], [0.19, 0.06], [0.3, 0.3], [0.33, 0.42], [0.31, 0.42], [0.28, 0.31], [0.17, 0.08], [0, 0.08]], porcelain);
  tea.add(cup);
  const rim = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.008, 8, 64), gold));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.42;
  tea.add(rim);
  const teaTop = new THREE.Mesh(new THREE.CircleGeometry(0.29, 48), new THREE.MeshPhysicalMaterial({ color: 0x7a3d12, roughness: 0.1, clearcoat: 1 }));
  teaTop.rotation.x = -Math.PI / 2;
  teaTop.position.y = 0.36;
  tea.add(teaTop);
  const handle = shadowy(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 12, 32, Math.PI * 1.3), porcelain));
  handle.position.set(0.34, 0.25, 0);
  handle.rotation.z = -Math.PI * 0.65;
  tea.add(handle);
  const steamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main(){
        float y = vUv.y;
        float x = vUv.x - 0.5 - sin(y * 6.0 - uTime * 1.2) * 0.12 * y - sin(y * 13.0 - uTime * 2.0) * 0.04;
        float wisp = exp(-pow(x / (0.05 + y * 0.12), 2.0));
        float a = wisp * smoothstep(0.0, 0.15, y) * (1.0 - smoothstep(0.5, 1.0, y)) * 0.22;
        gl_FragColor = vec4(vec3(1.0), a);
      }`,
  });
  const steam = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.1), steamMat);
  steam.position.set(tea.position.x, 0.95, tea.position.z);
  scene.add(steam);
  tickers.push((t) => { steamMat.uniforms.uTime.value = t; steam.quaternion.copy(camera.quaternion); });

  // Sukulent saksısı
  const plant = new THREE.Group();
  plant.position.set(-3.75, 0, -1.9);
  scene.add(plant);
  plant.add(lathe([[0, 0], [0.3, 0], [0.4, 0.55], [0.46, 0.56], [0.46, 0.66], [0.41, 0.66], [0.38, 0.6], [0, 0.6]], new THREE.MeshStandardMaterial({ color: 0xc0643a, roughness: 0.85 })));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.39, 32), new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.61;
  plant.add(soil);
  const leafGeo = new THREE.SphereGeometry(1, 16, 12);
  leafGeo.translate(0, 0, 1);
  const leafMats = ['#6f9c6a', '#86b07a', '#9cc28c'].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.45, clearcoat: 0.3, sheen: 0.5, sheenColor: new THREE.Color('#d8f0c8') }));
  [[10, 0.28, 0.35], [8, 0.22, 0.7], [6, 0.15, 1.05], [4, 0.1, 1.3]].forEach(([n, len, tilt], ring) => {
    for (let i = 0; i < n; i++) {
      const leaf = shadowy(new THREE.Mesh(leafGeo, leafMats[ring % 3]));
      leaf.scale.set(0.07, 0.035, len);
      leaf.position.y = 0.64 + ring * 0.03;
      leaf.rotation.order = 'YXZ';
      leaf.rotation.y = (i / n) * Math.PI * 2 + ring * 0.4;
      leaf.rotation.x = -tilt * 0.5;
      plant.add(leaf);
    }
  });

  // Üst üste plak kapakları
  const sleeveArt = [
    (g, s) => { g.fillStyle = '#f2c14e'; g.fillRect(0, 0, s, s); g.fillStyle = '#e4572e'; for (let i = 0; i < 6; i++) g.fillRect(0, s * 0.55 + i * 34, s, 18); g.fillStyle = '#fff4d6'; g.beginPath(); g.arc(s / 2, s * 0.42, s * 0.22, 0, Math.PI * 2); g.fill(); },
    (g, s) => { g.fillStyle = '#1f3a5f'; g.fillRect(0, 0, s, s); g.strokeStyle = '#8ecae6'; g.lineWidth = 10; for (let i = 1; i < 8; i++) { g.beginPath(); g.arc(s * 0.3, s * 0.7, i * 50, 0, Math.PI * 2); g.stroke(); } },
    null, // en üstte: Siyah Bayrak
  ];
  const coverTex = new THREE.TextureLoader().load('siyahbayrak-cover.jpg');
  coverTex.colorSpace = THREE.SRGBColorSpace;
  coverTex.anisotropy = 8;
  const sleeves = new THREE.Group();
  sleeves.position.set(3.4, 0, -1.55);
  scene.add(sleeves);
  sleeveArt.forEach((art, i) => {
    const top = new THREE.MeshStandardMaterial({ map: art ? canvasTex(512, art) : coverTex, roughness: 0.7 });
    const edge = new THREE.MeshStandardMaterial({ color: art ? 0xd9cfc0 : 0x0a0a0a, roughness: 0.8 });
    const sl = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.035, 1.35), [edge, edge, top, edge, edge, edge]));
    sl.position.y = 0.02 + i * 0.037;
    sl.rotation.y = [0.25, -0.1, 0.12][i];
    sleeves.add(sl);
  });

  // Duvara dayalı Siyah Bayrak kapağı, içinden plak hafifçe çıkmış
  const lean = new THREE.Group();
  lean.position.set(3.9, 0, WALL_Z + T / 2 + 0.28);
  lean.rotation.set(-0.16, -0.08, 0);
  scene.add(lean);
  const sleeveBlack = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.75 });
  const leanSleeve = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.03), [sleeveBlack, sleeveBlack, sleeveBlack, sleeveBlack, new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.7 }), sleeveBlack]));
  leanSleeve.position.y = 0.75;
  lean.add(leanSleeve);
  const leanDisc = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.02, 96), new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.4, clearcoat: 0.8 })));
  leanDisc.rotation.x = Math.PI / 2;
  leanDisc.position.set(0.55, 0.78, -0.03);
  lean.add(leanDisc);


  // Duvarda asılı siyah bayrak (rüzgârsız odada hafifçe dalgalanır)
  const flagLogo = new THREE.TextureLoader().load('siyahbayrak-logo.jpg');
  flagLogo.colorSpace = THREE.SRGBColorSpace;
  flagLogo.anisotropy = 8;
  const FLAG_W = 3.1;
  const FLAG_H = FLAG_W * (640 / 1024) + 0.3;
  const flagGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, 40, 20);
  const flagBase = flagGeo.attributes.position.array.slice();
  const flagMat = new THREE.MeshStandardMaterial({ map: flagLogo, color: 0x5a5a5a, roughness: 0.95, side: THREE.DoubleSide }); // siyah kumaş ışıkta turuncuya kaçmasın
  flagLogo.repeat.set(1, 1);
  const flag = shadowy(new THREE.Mesh(flagGeo, flagMat));
  flag.position.set(-5.45, 2.6, WALL_Z + T / 2 + 0.12);
  scene.add(flag);
  const rod = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, FLAG_W + 0.4, 12), chrome));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(flag.position.x, flag.position.y + FLAG_H / 2 + 0.02, flag.position.z);
  scene.add(rod);
  tickers.push((t) => {
    const p = flagGeo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = flagBase[i];
      const y = flagBase[i + 1];
      const hang = (FLAG_H / 2 - y) / FLAG_H; // üstten uzaklık: tepede sabit
      p[i + 2] = hang * (Math.sin(x * 1.8 + t * 1.1) * 0.08 + Math.sin(x * 5.0 - t * 1.7 + y) * 0.02);
    }
    flagGeo.attributes.position.needsUpdate = true;
    flagGeo.computeVertexNormals();
  });

  // Lastik ördek
  const duckMat = new THREE.MeshPhysicalMaterial({ color: 0xffcf33, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const duck = new THREE.Group();
  duck.position.set(-3.55, 0, -0.35);
  duck.rotation.y = -1.1; // yüzü kameraya dönük
  scene.add(duck);
  const dBody = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), duckMat));
  dBody.scale.set(1.25, 0.8, 1);
  dBody.position.y = 0.24;
  duck.add(dBody);
  const dTail = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 16), duckMat));
  dTail.position.set(-0.36, 0.36, 0);
  dTail.rotation.z = 0.9;
  duck.add(dTail);
  const dHead = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), duckMat));
  dHead.position.set(0.2, 0.55, 0);
  duck.add(dHead);
  const beak = shadowy(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, roughness: 0.35, clearcoat: 0.6 })));
  beak.scale.set(1.4, 0.45, 1);
  beak.position.set(0.37, 0.51, 0);
  duck.add(beak);
  for (const z of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }));
    eye.position.set(0.3, 0.6, z);
    duck.add(eye);
  }
  let duckBounce = 0;
  addEventListener('radio:pulse', () => { duckBounce = 1; });
  tickers.push((t, dt) => {
    duckBounce *= Math.pow(0.05, dt);
    duck.position.y = Math.abs(Math.sin(t * 9)) * 0.12 * duckBounce;
    duck.rotation.z = Math.sin(t * 2) * 0.03 + Math.sin(t * 9) * 0.08 * duckBounce;
  });

  /* ---------- Masaya kazınmış "11" ---------- */
  const carveTex = canvasTex(512, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 300px Georgia, serif';
    g.save();
    g.translate(s / 2, s / 2);
    g.rotate(-0.08);
    g.scale(0.9, 1);
    // açık kenar (ışık alan oyuk kenarı)
    g.fillStyle = 'rgba(235,190,140,0.55)';
    g.fillText('11', -5, -5);
    // oyuğun karanlık içi, bıçak izi gibi hafif titrek
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(${55 + i * 6},${28 + i * 3},${12 + i * 2},0.5)`;
      g.fillText('11', (Math.random() - 0.5) * 4 + 2, (Math.random() - 0.5) * 4 + 3);
    }
    g.restore();
    // birkaç çizik
    g.strokeStyle = 'rgba(60,30,12,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const x = s * 0.2 + Math.random() * s * 0.6;
      const y = s * 0.78 + Math.random() * s * 0.12;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + Math.random() * 40, y + (Math.random() - 0.5) * 8);
      g.stroke();
    }
  });
  carveTex.wrapS = carveTex.wrapT = THREE.ClampToEdgeWrapping;
  const carve = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.05),
    new THREE.MeshStandardMaterial({ map: carveTex, transparent: true, opacity: 0.8, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  carve.rotation.x = -Math.PI / 2;
  carve.rotation.z = 0.3;
  carve.position.set(-3.3, 0.002, 1.2);
  carve.receiveShadow = true;
  scene.add(carve);

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
    const need = (mobile ? 8.4 : 6.2) / (2 * Math.tan(hfov / 2)); // mobilde figürler de sığsın
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
    u.uViewX.value.set(v.x0, v.x1);
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
    ledMat.emissiveIntensity = state.playing ? 4 : 0.15;
    skyMat.uniforms.uTime.value = time;
    for (const f of tickers) f(time, dt);
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

  drawLabel('');
  document.fonts?.ready.then(() => drawLabel());
  camera.position.copy(CAM_BASE);
  camera.lookAt(CAM_LOOK);
  layout();
  applyPalette();
  setRunning(true);
  requestAnimationFrame(() => root.classList.add('scene-ready'));
}
