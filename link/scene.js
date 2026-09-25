// link.guldal.me — Three.js arka planı (düz, 3D değil): gökyüzü, avatarın arkasından doğan güneş,
// dalgalı deniz, uzak adalar, gece yıldızlar ve denizde sallanan bir lastik ördek.
// Renkler Sunshine Radio'daki vakitlerle aynı: <html data-phase="sabah|ogle|aksam|gece">.
import * as THREE from 'three';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const C = (hex) => new THREE.Color(hex);

const PHASES = {
  sabah: { top: '#7fb0f0', low: '#ffd2a8', sea: '#6f8fb8', deep: '#22406b', sun: '#fff0cf', glow: '#ffc58a', rays: 0.35, stars: 0 },
  ogle:  { top: '#2f78da', low: '#cfe7ff', sea: '#3f86c2', deep: '#0b3a6e', sun: '#ffffff', glow: '#fff1c8', rays: 0.3, stars: 0 },
  aksam: { top: '#3b2150', low: '#ff9147', sea: '#7a3a45', deep: '#1a0e22', sun: '#ffb46a', glow: '#ff8a3d', rays: 0.55, stars: 0.12 },
  gece:  { top: '#03050d', low: '#1a2350', sea: '#141b38', deep: '#02030a', sun: '#dfe7ff', glow: '#8fa6ff', rays: 0.08, stars: 1 },
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
    uHorizon: { value: 300 },
    uTop: { value: C('#000') }, uLow: { value: C('#000') }, uSea: { value: C('#000') }, uDeep: { value: C('#000') },
    uSunC: { value: C('#fff') }, uGlow: { value: C('#fff') },
    uRays: { value: 0.4 }, uStars: { value: 0 },
  };
  const P = {};
  for (const [k, v] of Object.entries(PHASES[phaseKey()])) P[k] = typeof v === 'string' ? C(v) : v;

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: U,
    depthTest: false,
    depthWrite: false,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
      uniform float uTime, uR, uHorizon, uRays, uStars;
      uniform vec2 uRes, uSun;
      uniform vec3 uTop, uLow, uSea, uDeep, uSunC, uGlow;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float f = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++) { f += a * noise(p); p = m * p; a *= 0.5; } return f; }
      float waves(vec2 p){
        return fbm(vec2(p.x * 0.7, p.y * 2.2) + vec2(uTime * 0.04, -uTime * 0.32))
             + 0.45 * fbm(vec2(p.x * 1.9 + p.y * 0.6, p.y * 4.3) + vec2(-uTime * 0.08, -uTime * 0.55));
      }
      void main(){
        vec2 fc = gl_FragCoord.xy;
        float H = uRes.y;
        vec2 d = fc - uSun;
        float dist = length(d) / uR;
        vec3 col;
        if (fc.y >= uHorizon) {
          float t = clamp((fc.y - uHorizon) / max(H - uHorizon, 1.0), 0.0, 1.0);
          col = mix(uLow, uTop, smoothstep(0.0, 0.85, t));
          // yıldızlar
          vec2 cell = floor(fc / 3.0);
          float hs = hash(cell);
          col += vec3(0.9, 0.93, 1.0) * step(0.9975, hs) * (0.55 + 0.45 * sin(uTime * (1.5 + hs * 3.0) + hs * 90.0)) * uStars * smoothstep(0.05, 0.3, t);
          // güneş: disk + hale + dönen ışınlar
          col += uSunC * smoothstep(1.015, 0.985, dist) * 1.2;
          col += uGlow * 0.55 * exp(-dist * 0.9) + uGlow * 0.25 * exp(-dist * 0.25);
          float ang = atan(d.y, d.x) + uTime * 0.012;
          float r1 = noise(vec2(cos(ang), sin(ang)) * 9.0 + uTime * 0.05);
          float r2 = noise(vec2(cos(ang), sin(ang)) * 23.0 - uTime * 0.07);
          col += uGlow * pow(r1 * 0.7 + r2 * 0.3, 3.0) * smoothstep(1.0, 1.5, dist) * exp(-dist * 0.3) * uRays;
          // ince bulut şeritleri
          vec2 uv = fc / uRes;
          float c = fbm(vec2(uv.x * 2.2 + uTime * 0.006, uv.y * 11.0));
          col = mix(col, col * 1.06 + uGlow * 0.08, smoothstep(0.55, 0.85, c) * (1.0 - t) * 0.7);
        } else {
          // deniz: perspektifli dalga normali → gökyüzü yansıması + güneş parıltısı
          float depth = clamp((uHorizon - fc.y) / max(uHorizon, 1.0), 0.0, 1.0);
          float z = min(1.0 / (depth + 0.035), 26.0);
          float zz = z + 2.5; // yakındaki dalgalar da ince kalsın
          vec2 p = vec2((fc.x - uSun.x) / H * zz * 3.2, zz * 1.1);
          float e = 0.035;
          float h0 = waves(p);
          float hx = waves(p + vec2(e, 0.0)) - h0;
          float hz = waves(p + vec2(0.0, e)) - h0;
          float detail = smoothstep(0.0, 0.3, depth) * 0.85 + 0.15;
          vec3 N = normalize(vec3(-hx / e * 0.22 * detail, 1.0, -hz / e * 0.22 * detail));
          vec3 V = normalize(vec3((fc.x - uSun.x) / H * 1.4, -(0.015 + depth * 0.55), 1.0));
          vec3 R = reflect(V, N);
          vec3 S = normalize(vec3(0.0, max((uSun.y - uHorizon) / H * 1.4, 0.02), 1.0));
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-V, N), 0.0), 5.0);
          vec3 water = mix(uSea, uDeep, smoothstep(0.0, 0.9, depth));
          col = mix(water, mix(uLow, uTop, clamp(R.y * 2.5, 0.0, 1.0)), fres);
          float rs = max(dot(R, S), 0.0);
          col += uSunC * (pow(rs, 900.0) * 5.0 + pow(rs, 90.0) * 0.45);
          col = mix(col, uLow * 0.85, exp(-depth * 22.0) * 0.6);
        }
        // uzak adalar (sol tarafta, pusla)
        float wx = fc.x / uRes.x;
        float x1 = (wx - 0.16) / 0.13;
        float x2 = (wx - 0.3) / 0.07;
        float hill = max(pow(max(1.0 - abs(x1), 0.0), 1.5) * (0.85 + 0.3 * noise(vec2(fc.x * 0.02, 1.0))), 0.55 * pow(max(1.0 - abs(x2), 0.0), 1.3));
        if (fc.y >= uHorizon && fc.y < uHorizon + hill * H * 0.045) col = mix(col, mix(uDeep, uLow, 0.35), 0.85);
        // köşeleri hafif karart, yazılar okunaklı kalsın
        vec2 q = fc / uRes - vec2(0.5, 0.55);
        col *= 0.8 + 0.2 * smoothstep(0.95, 0.2, length(q * vec2(1.0, 1.2)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  /* ---------- Lastik ördek ---------- */
  function duckCanvas(reflection) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.lineWidth = 7;
    g.strokeStyle = '#2b1a0a';
    g.lineJoin = 'round';
    const body = g.createRadialGradient(110, 150, 10, 128, 170, 110);
    body.addColorStop(0, '#fff2a0');
    body.addColorStop(0.6, '#ffd02e');
    body.addColorStop(1, '#f0a818');
    // gövde
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(40, 150);
    g.quadraticCurveTo(20, 110, 52, 118); // kuyruk
    g.quadraticCurveTo(70, 132, 96, 130);
    g.quadraticCurveTo(150, 128, 196, 150);
    g.quadraticCurveTo(222, 170, 200, 202);
    g.quadraticCurveTo(170, 226, 110, 224);
    g.quadraticCurveTo(52, 222, 40, 150);
    g.fill();
    g.stroke();
    // kanat
    g.beginPath();
    g.moveTo(92, 168);
    g.quadraticCurveTo(128, 150, 158, 176);
    g.quadraticCurveTo(128, 200, 92, 168);
    g.fillStyle = '#f5b91f';
    g.fill();
    g.stroke();
    // kafa
    g.fillStyle = body;
    g.beginPath();
    g.arc(170, 96, 46, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // gaga
    g.fillStyle = '#ff7a1a';
    g.beginPath();
    g.moveTo(206, 100);
    g.quadraticCurveTo(250, 98, 242, 118);
    g.quadraticCurveTo(222, 130, 204, 118);
    g.closePath();
    g.fill();
    g.stroke();
    // göz
    g.fillStyle = '#2b1a0a';
    g.beginPath();
    g.arc(184, 84, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(187, 81, 3, 0, Math.PI * 2);
    g.fill();
    // parlama
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(160, 86, 26, Math.PI * 1.1, Math.PI * 1.45);
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const duckTex = duckCanvas();
  const duck = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: duckTex, transparent: true, depthTest: false }));
  const duckShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: duckTex, transparent: true, opacity: 0.22, color: 0x221a30, depthTest: false }));
  scene.add(duckShadow, duck);
  const DUCK = { x: 0, y: 0, size: 80, hop: 0 };

  /* ---------- Yerleşim: güneş avatarın arkasında, ufuk hemen altında ---------- */
  const avatar = document.querySelector('.polaroid');
  let dpr = 1;
  function layout() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = innerWidth;
    const h = innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.right = w;
    camera.top = h;
    camera.updateProjectionMatrix();
    U.uRes.value.set(w * dpr, h * dpr);
    const mobile = w < 700;
    DUCK.size = mobile ? 50 : 92;
  }

  function place() {
    const r = avatar.getBoundingClientRect();
    const h = innerHeight;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const R = r.width * 0.64;
    const horizon = r.bottom + 18;
    U.uSun.value.set(cx * dpr, (h - cy) * dpr);
    U.uR.value = R * dpr;
    U.uHorizon.value = Math.max(0, (h - horizon) * dpr);
    // ördek: ufkun altında, deniz üstünde
    const seaTop = h - horizon;
    if (innerWidth < 700) {
      // mobilde: solda, ufkun hemen altında (kartların üstünde kalsın)
      DUCK.x = innerWidth * 0.13;
      DUCK.y = seaTop - DUCK.size * 0.75;
    } else {
      DUCK.x = innerWidth * 0.83;
      DUCK.y = Math.max(40, seaTop * 0.55);
    }
  }

  /* ---------- Vak! ---------- */
  let audio;
  function quack() {
    try {
      audio = audio || new AudioContext();
      const now = audio.currentTime;
      for (const [start, f0] of [[0, 820], [0.2, 760]]) {
        const osc = audio.createOscillator();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f0, now + start);
        osc.frequency.exponentialRampToValueAtTime(f0 * 0.45, now + start + 0.16);
        filter.type = 'bandpass';
        filter.frequency.value = 1300;
        filter.Q.value = 3;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.17);
        osc.connect(filter).connect(gain).connect(audio.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.2);
      }
    } catch {}
    DUCK.hop = 1;
    dispatchEvent(new CustomEvent('link:toast', { detail: 'vak! 🦆' }));
  }
  const onDuck = (e) => {
    const h = innerHeight;
    const dx = e.clientX - DUCK.x;
    const dy = (h - e.clientY) - DUCK.y;
    return Math.hypot(dx, dy) < DUCK.size * 0.5;
  };
  addEventListener('click', (e) => { if (!e.target.closest('a, button') && onDuck(e)) quack(); });
  addEventListener('pointermove', (e) => {
    document.body.style.cursor = !e.target.closest('a, button') && onDuck(e) ? 'pointer' : '';
  });

  /* ---------- Döngü ---------- */
  let running = false;
  let last = performance.now();
  let time = 0;
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt * (reduced ? 0.2 : 1);

    const target = PHASES[phaseKey()];
    const k = Math.min(dt * 1.5, 1);
    for (const [key, v] of Object.entries(target)) {
      if (typeof v === 'string') P[key].lerp(C(v), k);
      else P[key] += (v - P[key]) * k;
    }
    U.uTop.value.copy(P.top); U.uLow.value.copy(P.low); U.uSea.value.copy(P.sea); U.uDeep.value.copy(P.deep);
    U.uSunC.value.copy(P.sun); U.uGlow.value.copy(P.glow);
    U.uRays.value = P.rays; U.uStars.value = P.stars;
    U.uTime.value = time;

    place();
    DUCK.hop *= Math.pow(0.04, dt);
    const bob = Math.sin(time * 1.6) * 4 + Math.abs(Math.sin(time * 14)) * 26 * DUCK.hop;
    duck.position.set(DUCK.x, DUCK.y + bob, 1);
    duck.scale.set(DUCK.size, DUCK.size, 1);
    duck.rotation.z = Math.sin(time * 1.25) * 0.07;
    duckShadow.position.set(DUCK.x, DUCK.y - DUCK.size * 0.62 - bob * 0.3, 0.5);
    duckShadow.scale.set(DUCK.size, -DUCK.size * 0.55, 1);
    duckShadow.rotation.z = -duck.rotation.z;

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
