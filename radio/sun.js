// Sunshine teması için Three.js arka planı: gün batımı gökyüzü, canlı güneş, deniz yansıması ve ışık zerreleri.
// Sadece "sunshine" teması seçiliyken çizer; sekme arka plandayken durur.
import * as THREE from 'three';

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.0,a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.03;a*=0.5;}return f;}
`;

// Ekran koordinatlarında ortak değerler (cihaz pikseli, WebGL'de y aşağıdan yukarı)
const shared = {
  uTime: { value: 0 },
  uRes: { value: new THREE.Vector2(1, 1) },
  uSun: { value: new THREE.Vector2(0, 0) },
  uR: { value: 100 },
  uHorizon: { value: 0 },
  uPulse: { value: 0 },
  uEnergy: { value: 0 },
  uSkyLow: { value: new THREE.Vector3() },
  uSkyMid: { value: new THREE.Vector3() },
  uSkyTop: { value: new THREE.Vector3() },
  uSeaFar: { value: new THREE.Vector3() },
  uSeaNear: { value: new THREE.Vector3() },
  uGlow: { value: new THREE.Vector3() },
  uReflect: { value: new THREE.Vector3() },
  uSunC1: { value: new THREE.Vector3() },
  uSunC2: { value: new THREE.Vector3() },
  uSunC3: { value: new THREE.Vector3() },
  uRays: { value: 0 },
  uStars: { value: 0 },
  uVig: { value: 0.6 },
  uCorona: { value: 1 },
};

// Günün vaktine göre renkler: sabah (gün doğumu), öğle, akşam (gün batımı), gece (ay + yıldızlar)
const PALETTES = {
  sabah: {
    uSkyLow: [1.0, 0.74, 0.56], uSkyMid: [0.98, 0.64, 0.66], uSkyTop: [0.42, 0.6, 0.9],
    uSeaFar: [0.62, 0.58, 0.74], uSeaNear: [0.14, 0.22, 0.38], uGlow: [1.0, 0.84, 0.6], uReflect: [1.0, 0.86, 0.62],
    uSunC1: [1.0, 0.52, 0.14], uSunC2: [1.0, 0.8, 0.36], uSunC3: [1.0, 0.98, 0.86],
    uRays: 0.5, uStars: 0, uVig: 0.82, uCorona: 1,
  },
  ogle: {
    uSkyLow: [0.78, 0.9, 0.99], uSkyMid: [0.46, 0.72, 0.96], uSkyTop: [0.14, 0.38, 0.78],
    uSeaFar: [0.4, 0.64, 0.84], uSeaNear: [0.03, 0.2, 0.4], uGlow: [1.0, 0.96, 0.82], uReflect: [1.0, 0.98, 0.9],
    uSunC1: [1.0, 0.72, 0.28], uSunC2: [1.0, 0.92, 0.6], uSunC3: [1.0, 1.0, 0.96],
    uRays: 0.6, uStars: 0, uVig: 0.86, uCorona: 1,
  },
  aksam: {
    uSkyLow: [1.0, 0.58, 0.24], uSkyMid: [0.78, 0.26, 0.28], uSkyTop: [0.13, 0.06, 0.2],
    uSeaFar: [0.42, 0.16, 0.22], uSeaNear: [0.05, 0.03, 0.09], uGlow: [1.0, 0.62, 0.28], uReflect: [1.0, 0.7, 0.36],
    uSunC1: [0.86, 0.24, 0.04], uSunC2: [1.0, 0.6, 0.12], uSunC3: [1.0, 0.95, 0.72],
    uRays: 0.45, uStars: 0.15, uVig: 0.62, uCorona: 1,
  },
  gece: {
    uSkyLow: [0.13, 0.15, 0.3], uSkyMid: [0.06, 0.07, 0.19], uSkyTop: [0.01, 0.015, 0.05],
    uSeaFar: [0.09, 0.11, 0.22], uSeaNear: [0.01, 0.015, 0.04], uGlow: [0.62, 0.72, 0.98], uReflect: [0.78, 0.85, 1.0],
    uSunC1: [0.5, 0.53, 0.62], uSunC2: [0.78, 0.8, 0.87], uSunC3: [0.97, 0.97, 1.0],
    uRays: 0.08, uStars: 1, uVig: 0.7, uCorona: 0.4,
  },
};
const toTarget = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? new THREE.Vector3(...v) : v]));
const TARGETS = Object.fromEntries(Object.entries(PALETTES).map(([k, p]) => [k, toTarget(p)]));

function lerpPalette(target, t) {
  for (const [k, v] of Object.entries(target)) {
    if (typeof v === 'number') shared[k].value += (v - shared[k].value) * t;
    else shared[k].value.lerp(v, t);
  }
}
lerpPalette(TARGETS[document.documentElement.dataset.phase] || TARGETS.aksam, 1);

/* ---------- Gökyüzü + deniz (tam ekran) ---------- */
const skyMat = new THREE.ShaderMaterial({
  uniforms: shared,
  depthTest: false,
  depthWrite: false,
  vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: NOISE + /* glsl */ `
    uniform vec2 uRes, uSun; uniform float uR, uHorizon, uTime, uPulse, uEnergy;
    uniform vec3 uSkyLow, uSkyMid, uSkyTop, uSeaFar, uSeaNear, uGlow, uReflect, uSunC1, uSunC2, uSunC3; uniform float uRays, uStars, uVig, uCorona;
    void main(){
      vec2 fc = gl_FragCoord.xy;
      float H = uRes.y;
      vec3 col;
      vec2 d = fc - uSun;
      float dist = length(d) / uR;
      if (fc.y >= uHorizon) {
        float t = clamp((fc.y - uHorizon) / max(H - uHorizon, 1.0), 0.0, 1.0);
        col = mix(uSkyLow, uSkyMid, smoothstep(0.0, 0.35, t));
        col = mix(col, uSkyTop, smoothstep(0.3, 1.0, t));

        // yıldızlar (gece)
        vec2 cell = floor(fc / 3.0);
        float hs = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        float star = step(0.9965, hs) * (0.55 + 0.45 * sin(uTime * (1.5 + hs * 3.0) + hs * 90.0));
        col += vec3(0.92, 0.94, 1.0) * star * uStars * smoothstep(0.04, 0.35, t) * smoothstep(1.3, 2.5, dist);

        // yumuşak hale
        col += uGlow * 0.55 * exp(-dist * 0.8) * (1.0 + uPulse * 0.6);
        col += mix(uGlow, vec3(1.0), 0.4) * 0.35 * exp(-dist * 2.4);

        // dönen ışınlar
        float ang = atan(d.y, d.x) + uTime * 0.015;
        float r1 = snoise(vec3(cos(ang) * 7.0, sin(ang) * 7.0, uTime * 0.06)) * 0.5 + 0.5;
        float r2 = snoise(vec3(cos(ang) * 17.0, sin(ang) * 17.0, uTime * 0.1)) * 0.5 + 0.5;
        float rays = pow(r1 * 0.7 + r2 * 0.3, 3.0) * smoothstep(0.95, 1.5, dist) * exp(-dist * 0.28);
        col += uGlow * rays * uRays * (1.0 + 0.8 * uEnergy + 0.9 * uPulse);

        // ince bulut şeritleri
        vec2 uv = fc / uRes;
        float c = fbm(vec3(uv.x * 2.5 + uTime * 0.008, uv.y * 14.0, uTime * 0.015));
        float band = smoothstep(0.15, 0.7, c) * smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(0.35, 0.8, t));
        col = mix(col, col * 1.08 + uGlow * 0.07, band * 0.6);
      } else {
        float depth = (uHorizon - fc.y) / max(uHorizon, 1.0);
        col = mix(uSeaFar, uSeaNear, smoothstep(0.0, 0.55, depth));

        // güneşin denizdeki yansıması
        float z = 1.0 / (depth + 0.04);
        float dx = (fc.x - uSun.x) / uR;
        float width = 0.8 + depth * 2.4;
        float column = exp(-pow(dx / width, 2.0));
        float n = snoise(vec3(dx * z * 0.35, z * 1.3 - uTime * 0.35, uTime * 0.25));
        float n2 = snoise(vec3(dx * z * 0.9, z * 3.0 - uTime * 0.6, uTime * 0.4));
        float sparkle = smoothstep(0.25, 0.85, n * 0.6 + n2 * 0.4);
        col += uReflect * column * (0.18 + 1.1 * sparkle) * (1.0 - depth * 0.7) * (1.0 + uPulse * 0.5);
        col += uGlow * 0.3 * exp(-depth * 16.0);
      }
      col += uGlow * 0.3 * exp(-abs(fc.y - uHorizon) / (H * 0.004));

      // köşe karartması, okunabilirlik için
      vec2 q = fc / uRes - vec2(0.5, 0.6);
      col *= uVig + (1.0 - uVig) * smoothstep(1.0, 0.15, length(q * vec2(1.0, 1.3)));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const skyScene = new THREE.Scene();
const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
sky.frustumCulled = false;
skyScene.add(sky);
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

/* ---------- 3B sahne ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0, 12);

const sunGroup = new THREE.Group();
scene.add(sunGroup);

const sunMat = new THREE.ShaderMaterial({
  uniforms: shared,
  vertexShader: /* glsl */ `
    varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
    void main(){
      vPos = position;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalMatrix * normal;
      vView = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: NOISE + /* glsl */ `
    uniform float uTime, uPulse, uHorizon;
    uniform vec3 uSkyLow, uSkyMid, uSkyTop, uSeaFar, uSeaNear, uGlow, uReflect, uSunC1, uSunC2, uSunC3; uniform float uRays, uStars, uVig, uCorona;
    varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
    void main(){
      if (gl_FragCoord.y < uHorizon) discard;
      vec3 p = normalize(vPos);
      float n = fbm(p * 2.6 + vec3(0.0, uTime * 0.04, uTime * 0.03));
      float n2 = fbm(p * 8.0 + vec3(uTime * 0.07, 0.0, -uTime * 0.05));
      float cells = 1.0 - abs(snoise(p * 16.0 + uTime * 0.12));
      float heat = 0.55 + 0.4 * n + 0.18 * n2 + 0.12 * cells;
      vec3 col = mix(uSunC1, uSunC2, smoothstep(0.25, 0.65, heat));
      col = mix(col, uSunC3, smoothstep(0.7, 1.1, heat));
      float facing = max(dot(normalize(vNormal), normalize(vView)), 0.0);
      col = mix(uSunC1 * 1.1, col, smoothstep(0.0, 0.55, facing));
      col *= 1.05 + uPulse * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), sunMat);
sunGroup.add(sunMesh);

const coronaMat = new THREE.ShaderMaterial({
  uniforms: shared,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: NOISE + /* glsl */ `
    uniform float uTime, uPulse, uEnergy, uHorizon;
    uniform vec3 uSkyLow, uSkyMid, uSkyTop, uSeaFar, uSeaNear, uGlow, uReflect, uSunC1, uSunC2, uSunC3; uniform float uRays, uStars, uVig, uCorona;
    varying vec2 vUv;
    void main(){
      if (gl_FragCoord.y < uHorizon) discard;
      vec2 p = (vUv - 0.5) * 2.0;           // güneşin kenarı d = 0.4'te
      float d = length(p);
      float a = atan(p.y, p.x);
      float flame = fbm(vec3(cos(a) * 2.5, sin(a) * 2.5, uTime * 0.18 - d * 2.0)) * 0.5 + 0.5;
      float edge = max(d - 0.4, 0.0);
      float reach = 0.35 + 0.9 * flame + 0.35 * uEnergy + 0.6 * uPulse;
      float glow = exp(-edge * 9.0 / reach) * smoothstep(0.36, 0.41, d);
      glow *= 1.0 - smoothstep(0.75, 1.0, d);
      vec3 col = mix(uSunC1 * 1.15, mix(uGlow, vec3(1.0), 0.3), exp(-edge * 12.0));
      gl_FragColor = vec4(col * glow * 1.1 * uCorona, 1.0);
    }`,
});
const corona = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), coronaMat); // 5 birim = 2.5R yarıçap
corona.position.z = -0.02;
sunGroup.add(corona);

/* ---------- Işık zerreleri ---------- */
const COUNT = 260;
const pos = new Float32Array(COUNT * 3);
const seed = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  pos[i * 3] = (Math.random() - 0.5) * 22;
  pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
  pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
  seed[i] = Math.random();
}
const motesGeo = new THREE.BufferGeometry();
motesGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
motesGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
const motes = new THREE.Points(motesGeo, new THREE.ShaderMaterial({
  uniforms: { ...shared, uScale: { value: 1 } },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    uniform float uTime, uScale, uEnergy; attribute float aSeed; varying float vAlpha;
    void main(){
      vec3 p = position;
      p.y = mod(p.y + 6.0 + uTime * (0.08 + aSeed * 0.18) * (1.0 + uEnergy * 0.6), 12.0) - 6.0;
      p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.4;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = (4.0 + aSeed * 10.0) * uScale / -mv.z;
      vAlpha = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 30.0))) * smoothstep(6.0, 3.0, abs(p.y));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uGlow; varying float vAlpha;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(uGlow * a * vAlpha * 0.9, 1.0);
    }`,
}));
scene.add(motes);

/* ---------- Kurulum ---------- */
const canvas = document.createElement('canvas');
canvas.className = 'sun-canvas';
canvas.setAttribute('aria-hidden', 'true');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  console.warn('WebGL yok, düz arka plan kullanılıyor', e);
}

if (renderer) {
  renderer.autoClear = false;
  document.body.prepend(canvas);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.stage');
  const layout = { x: 0, y: 0, r: 100 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let dpr = 1;
  let running = false;
  let clockTime = 0;
  let last = performance.now();
  let pulse = 0;
  let energy = 0;
  let targetEnergy = 0;

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    shared.uRes.value.set(w * dpr, h * dpr);
    motes.material.uniforms.uScale.value = h * dpr * 0.035;

    // Güneş, kartın üstündeki boşlukta dursun
    const rect = stage.getBoundingClientRect();
    const mobile = w < 900;
    layout.x = rect.left + rect.width / 2;
    layout.r = mobile ? Math.min(w * 0.2, h * 0.09) : Math.max(55, Math.min(h * 0.1, w * 0.08, 130));
    layout.y = mobile ? h * 0.15 : h * 0.17;

    // Ekran konumunu z=0 düzlemindeki dünya konumuna çevir (paralaks yokken)
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    sunGroup.position.set((layout.x / w * 2 - 1) * halfW, (1 - layout.y / h * 2) * halfH, 0);
    sunGroup.scale.setScalar(layout.r / h * 2 * halfH);
  }

  const v = new THREE.Vector3();
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clockTime += dt * (reduced ? 0.15 : 1);
    pulse *= Math.pow(0.12, dt);
    energy += (targetEnergy - energy) * Math.min(dt * 1.5, 1);
    lerpPalette(TARGETS[document.documentElement.dataset.phase] || TARGETS.aksam, Math.min(dt * 1.2, 1));

    mouse.x += (mouse.tx - mouse.x) * Math.min(dt * 2, 1);
    mouse.y += (mouse.ty - mouse.y) * Math.min(dt * 2, 1);
    camera.position.x = mouse.x * 0.35;
    camera.position.y = -mouse.y * 0.2;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    sunMesh.rotation.y = clockTime * 0.03;
    sunMesh.rotation.x = 0.25;
    corona.quaternion.copy(camera.quaternion);

    // Gökyüzü shader'ı güneşin ekrandaki yerini bilsin
    sunGroup.getWorldPosition(v).project(camera);
    const W = shared.uRes.value.x;
    const H = shared.uRes.value.y;
    const sx = (v.x * 0.5 + 0.5) * W;
    const sy = (v.y * 0.5 + 0.5) * H;
    const r = layout.r * dpr;
    shared.uSun.value.set(sx, sy);
    shared.uR.value = r;
    shared.uHorizon.value = sy - r * 0.45;
    shared.uTime.value = clockTime;
    shared.uPulse.value = pulse;
    shared.uEnergy.value = energy;

    renderer.clear();
    renderer.render(skyScene, orthoCam);
    renderer.render(scene, camera);
  }

  function setRunning(on) {
    on = on && !document.hidden;
    canvas.hidden = !on;
    if (on === running) return;
    running = on;
    if (on) {
      last = performance.now();
      resize();
      requestAnimationFrame(frame);
    }
  }

  const isSunshine = () => document.documentElement.dataset.theme === 'sunshine';
  new MutationObserver(() => setRunning(isSunshine()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => setRunning(isSunshine()));
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(stage);
  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / innerWidth * 2 - 1;
    mouse.ty = e.clientY / innerHeight * 2 - 1;
  });

  // app.js'ten gelen olaylar: emoji tepkisi, şarkı değişimi, çalma durumu
  addEventListener('radio:pulse', (e) => { pulse = Math.min(pulse + (e.detail || 0.5), 1.5); });
  addEventListener('radio:playing', (e) => { targetEnergy = e.detail ? 1 : 0; });

  setRunning(isSunshine());
}
