// link.guldal.me — Three.js arka planı (düz, sade): avatarın arkasında nefes alan bir güneş,
// yavaş dönen ışık huzmeleri, akan sıcak ışık dokusu, süzülen zerreler ve film greni.
// Renkler Sunshine Radio'daki vakitlerle aynı: <html data-phase="sabah|ogle|aksam|gece">.
import * as THREE from 'three';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = (hex) => new THREE.Color(hex);

const PHASES = {
  sabah: { top: '#f3b8a4', low: '#fde7cf', haze: '#ffc9a3', sun: '#fff4dc', glow: '#ffb27a', rays: 0.45, stars: 0, grain: 0.035 },
  ogle:  { top: '#f6c55a', low: '#fff3d6', haze: '#ffe08a', sun: '#ffffff', glow: '#ffcf4a', rays: 0.4, stars: 0, grain: 0.03 },
  aksam: { top: '#2a1233', low: '#e8683a', haze: '#ff8a3d', sun: '#ffd49a', glow: '#ff7a2e', rays: 0.6, stars: 0.1, grain: 0.045 },
  gece:  { top: '#03040b', low: '#161b3d', haze: '#3a4a9a', sun: '#e6ecff', glow: '#7f95ff', rays: 0.22, stars: 1, grain: 0.028 },
};
const phaseKey = () => (PHASES[root.dataset.phase] ? root.dataset.phase : 'aksam');

let renderer;
const canvas = document.createElement('canvas');
canvas.className = 'scene';
canvas.setAttribute('aria-hidden', 'true');
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
} catch (e) {
  console.warn('WebGL yok, düz arka plan kullanılıyor', e);
}

if (renderer) {
  document.body.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10); // piksel koordinatları, y yukarı

  const U = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uSun: { value: new THREE.Vector2() },
    uR: { value: 100 },
    uTop: { value: C('#000') }, uLow: { value: C('#000') }, uHaze: { value: C('#000') },
    uSunC: { value: C('#fff') }, uGlow: { value: C('#fff') },
    uRays: { value: 0.4 }, uStars: { value: 0 }, uGrain: { value: 0.04 },
  };
  const P = {};
  for (const [k, v] of Object.entries(PHASES[phaseKey()])) P[k] = typeof v === 'string' ? C(v) : v;

  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: U,
    depthTest: false,
    depthWrite: false,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime, uR, uRays, uStars, uGrain;
      uniform vec2 uRes, uSun;
      uniform vec3 uTop, uLow, uHaze, uSunC, uGlow;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float f = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) { f += a * noise(p); p = m * p; a *= 0.5; } return f; }
      void main(){
        vec2 fc = gl_FragCoord.xy;
        vec2 uv = fc / uRes;
        float H = uRes.y;
        vec2 d = fc - uSun;
        float dist = length(d) / uR;

        // zemin: yukarıdan aşağı yumuşak geçiş, güneşe doğru ısınır
        vec3 col = mix(uLow, uTop, smoothstep(0.0, 1.0, length((fc - uSun) / H) * 0.9));

        // akan ışık dokusu (alan bükülmüş fbm, çok düşük kontrast)
        vec2 q = fc / H * 1.6;
        vec2 w = vec2(fbm(q + vec2(0.0, uTime * 0.03)), fbm(q + vec2(5.2, 1.3) - uTime * 0.025));
        float flow = fbm(q + w * 1.8 + uTime * 0.015);
        col = mix(col, uHaze, smoothstep(0.35, 0.85, flow) * 0.32);

        // ışık huzmeleri: güneşten dışarı, çok yavaş döner
        float ang = atan(d.y, d.x);
        vec2 dir = vec2(cos(ang), sin(ang));
        float r1 = noise(dir * 5.0 + uTime * 0.04);
        float r2 = noise(dir * 13.0 - uTime * 0.06 + 7.0);
        float rays = pow(r1 * 0.65 + r2 * 0.35, 2.4);
        col += uGlow * rays * smoothstep(0.9, 1.6, dist) * exp(-dist * 0.22) * uRays;

        // güneş: nefes alan hale + yumuşak disk
        float breathe = 1.0 + 0.04 * sin(uTime * 0.8);
        col += uGlow * 0.55 * exp(-dist * 1.1 / breathe);
        col += uGlow * 0.22 * exp(-dist * 0.28);
        col += uSunC * smoothstep(1.02 * breathe, 0.9, dist) * 0.9;

        // gece yıldızları
        vec2 cell = floor(fc / 3.0);
        float hs = hash(cell);
        col += vec3(0.9, 0.93, 1.0) * step(0.9972, hs) * (0.5 + 0.5 * sin(uTime * (1.2 + hs * 3.0) + hs * 80.0)) * uStars * smoothstep(1.4, 3.0, dist);

        // köşe karartması + film greni
        vec2 v = uv - vec2(0.5, 0.6);
        col *= 0.78 + 0.22 * smoothstep(0.95, 0.2, length(v * vec2(1.0, 1.2)));
        col += (hash(fc + fract(uTime) * 91.7) - 0.5) * uGrain;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  bg.frustumCulled = false;
  scene.add(bg);

  /* ---------- süzülen ışık zerreleri ---------- */
  const COUNT = innerWidth < 700 ? 40 : 80;
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) { pos.set([Math.random(), Math.random(), 0], i * 3); seed[i] = Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const motes = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uRes: U.uRes, uGlow: U.uGlow, uDpr: { value: 1 } },
    transparent: true, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uDpr; uniform vec2 uRes; attribute float aSeed; varying float vA;
      void main(){
        vec2 p = position.xy;
        p.y = fract(p.y + uTime * (0.006 + aSeed * 0.012));
        p.x += sin(uTime * 0.2 + aSeed * 40.0) * 0.02;
        vA = sin(p.y * 3.1416) * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 30.0)));
        gl_PointSize = (2.0 + aSeed * 5.0) * uDpr;
        gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uGlow; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(mix(uGlow, vec3(1.0), 0.5) * smoothstep(0.5, 0.0, d) * vA * 0.7, 1.0); }`,
  }));
  motes.frustumCulled = false;
  scene.add(motes);

  /* ---------- yerleşim: güneş avatarın arkasında, fareyi hafifçe izler ---------- */
  const avatar = document.querySelector('.polaroid');
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let dpr = 1;
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.right = innerWidth;
    camera.top = innerHeight;
    camera.updateProjectionMatrix();
    U.uRes.value.set(innerWidth * dpr, innerHeight * dpr);
    motes.material.uniforms.uDpr.value = dpr;
  }
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
  });

  /* ---------- döngü ---------- */
  let running = false;
  let last = performance.now();
  let time = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt * (reduced ? 0.15 : 1);

    const target = PHASES[phaseKey()];
    const k = Math.min(dt * 1.5, 1);
    for (const [key, v] of Object.entries(target)) {
      if (typeof v === 'string') P[key].lerp(C(v), k);
      else P[key] += (v - P[key]) * k;
    }
    U.uTop.value.copy(P.top); U.uLow.value.copy(P.low); U.uHaze.value.copy(P.haze);
    U.uSunC.value.copy(P.sun); U.uGlow.value.copy(P.glow);
    U.uRays.value = P.rays; U.uStars.value = P.stars; U.uGrain.value = P.grain;
    U.uTime.value = time;

    mouse.x += (mouse.tx - mouse.x) * Math.min(dt * 2, 1);
    mouse.y += (mouse.ty - mouse.y) * Math.min(dt * 2, 1);
    const r = avatar.getBoundingClientRect();
    const cx = r.left + r.width / 2 + mouse.x * 18;
    const cy = r.top + r.height / 2 + mouse.y * 12;
    U.uSun.value.set(cx * dpr, (innerHeight - cy) * dpr);
    U.uR.value = r.width * 0.62 * dpr;

    renderer.render(scene, camera);
  }
  function setRunning(on) {
    on = on && !document.hidden;
    if (on === running) return;
    running = on;
    if (on) { last = performance.now(); requestAnimationFrame(frame); }
  }
  addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => setRunning(true));
  layout();
  setRunning(true);
  requestAnimationFrame(() => root.classList.add('scene-ready'));
}
