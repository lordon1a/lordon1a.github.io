import { PROFILE, LINKS } from './links.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('link.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('link.' + k, JSON.stringify(v)); } catch {} },
};

// Tek renkli ikonlar (currentColor). "#0000" delikleri kartın rengini gösterir.
const HOLE = 'var(--tile-bg)';
const ICONS = {
  radio: `<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1" opacity=".6"/><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="1" style="fill:${HOLE}"/>`,
  youtube: `<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="M10 9l5 3-5 3z" style="fill:${HOLE}"/>`,
  x: '<path d="M4 4h4.5l11.5 16h-4.5z" fill="currentColor"/><path d="M19.5 4l-6.6 7.4M4.5 20l6.6-7.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/>',
  github: '<path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>',
  spotify: `<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M6.5 9.3c3.8-1.1 7.6-.8 11 1M7.2 12.6c3.1-.8 6.2-.5 8.9 1M7.9 15.7c2.4-.6 4.7-.4 6.8.8" fill="none" style="stroke:${HOLE}" stroke-width="1.7" stroke-linecap="round"/>`,
  discord: `<path fill="currentColor" d="M19.5 5.5A16 16 0 0 0 15.6 4l-.5 1a14 14 0 0 0-6.2 0l-.5-1a16 16 0 0 0-3.9 1.5C2 9.3 1.4 13 1.7 16.6A16 16 0 0 0 6.5 19l1-1.6a10 10 0 0 1-1.6-.8l.4-.3a11 11 0 0 0 11.4 0l.4.3a10 10 0 0 1-1.6.8l1 1.6a16 16 0 0 0 4.8-2.4c.4-4.2-.6-7.9-2.8-11.1z"/><ellipse cx="9" cy="12.5" rx="1.6" ry="1.8" style="fill:${HOLE}"/><ellipse cx="15" cy="12.5" rx="1.6" ry="1.8" style="fill:${HOLE}"/>`,
  tiktok: '<path fill="currentColor" d="M14 3h3a4.5 4.5 0 0 0 4 4v3a7.5 7.5 0 0 1-4-1.2V15a6 6 0 1 1-6-6h.5v3.2H11A2.8 2.8 0 1 0 14 15z"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

function render() {
  $('#eyebrow').textContent = PROFILE.eyebrow;
  $('#name').textContent = PROFILE.name;
  $('#tagline').textContent = PROFILE.tagline;
  document.title = `${PROFILE.name} · Linkler`;
  if (PROFILE.avatar) $('#avatar').innerHTML = `<img src="${esc(PROFILE.avatar)}" alt="${esc(PROFILE.name)}">`;

  $('#links').innerHTML = LINKS.filter((l) => l.url).map((l, i) => {
    const url = l.icon === 'mail' && !l.url.startsWith('mailto:') ? `mailto:${l.url}` : l.url;
    const external = /^https?:/.test(url);
    return `<a class="card${l.featured ? ' featured' : ''}" href="${esc(url)}" ${external ? 'target="_blank" rel="noopener"' : ''} style="--i:${i}">
      <span class="tile"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[l.icon] || ICONS.link}</svg></span>
      <span class="text">
        <span class="title">${esc(l.title)}${l.handle ? ` <span class="sep">·</span> ${esc(l.handle)}` : ''}${l.featured ? ' <span class="live">canlı</span>' : ''}</span>
        <span class="desc">${esc(l.desc)}</span>
      </span>
      <span class="arrow" aria-hidden="true">↗</span>
    </a>`;
  }).join('');
}

/* ---------- Günün vakti (radyodakiyle aynı) ---------- */
const PHASES = { sabah: 'sabah', ogle: 'öğle', aksam: 'akşam', gece: 'gece' };
const THEME_COLOR = { sabah: '#f3b8a4', ogle: '#f6c55a', aksam: '#2a1233', gece: '#03040b' };
let chosen = store.get('phase', 'auto');

function phaseByClock() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'sabah';
  if (h >= 11 && h < 17) return 'ogle';
  if (h >= 17 && h < 21) return 'aksam';
  return 'gece';
}

function applyPhase() {
  const p = PHASES[chosen] ? chosen : phaseByClock();
  document.documentElement.dataset.phase = p;
  $('meta[name="theme-color"]').content = THEME_COLOR[p];
  $('#phaseBtn').textContent = (p === 'gece' ? '☾ ' : '☀ ') + (chosen === 'auto' ? `${PHASES[p]} · otomatik` : PHASES[p]);
  $('#clock').textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

$('#phaseBtn').onclick = () => {
  const keys = ['auto', ...Object.keys(PHASES)];
  chosen = keys[(keys.indexOf(chosen) + 1) % keys.length];
  store.set('phase', chosen);
  applyPhase();
};

let toastTimer;
addEventListener('link:toast', (e) => {
  const t = $('#toast');
  t.textContent = e.detail;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
});

render();
applyPhase();
setInterval(applyPhase, 30000);
