import { CONFIG } from './config.js';

// Günün vakitleri (renkler style.css ve scene.js içinde)
const PHASES = { sabah: 'sabah', ogle: 'öğle', aksam: 'akşam', gece: 'gece' };
const PHASE_ICON = { sabah: '☀', ogle: '☀', aksam: '☀', gece: '☾' };
const fire = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('radyo.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('radyo.' + k, JSON.stringify(v)); } catch {} },
};
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const count = (o, v) => Object.values(o || {}).filter((x) => x === v).length;

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* =========================================================
   Veri katmanı: Firebase (herkes ortak) ya da yerel demo
   ========================================================= */
async function firebaseBackend(cfg) {
  const V = '10.12.2';
  const [{ initializeApp }, D, A] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
  ]);
  const app = initializeApp(cfg);
  const db = D.getDatabase(app);
  const { user } = await A.signInAnonymously(A.getAuth(app));
  const uid = user.uid;
  const r = (p) => D.ref(db, p);
  let offset = 0;
  D.onValue(r('.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
  const now = () => Date.now() + offset;

  return {
    uid,
    now,
    onState: (cb) => D.onValue(r('state'), (s) => cb(s.val())),
    onQueue: (cb) => D.onValue(r('queue'), (s) => cb(Object.entries(s.val() || {}).map(([id, x]) => ({ id, ...x })))),
    onPresence: (cb) => D.onValue(r('presence'), (s) => cb(s.val() || {})),
    onMods: (cb) => D.onValue(r('mods'), (s) => cb(s.val() || {})),
    onChat(add, del) {
      const q = D.query(r('chat'), D.orderByChild('ts'), D.limitToLast(CONFIG.chatHistory));
      D.onChildAdded(q, (s) => add({ id: s.key, ...s.val() }));
      D.onChildRemoved(q, (s) => del(s.key));
    },
    onReaction(cb) {
      const q = D.query(r('reactions'), D.orderByChild('ts'), D.startAt(now() - 3000));
      D.onChildAdded(q, (s) => cb(s.val()));
    },
    join(profile) {
      const me = r('presence/' + uid);
      D.onValue(r('.info/connected'), (s) => {
        if (!s.val()) return;
        D.onDisconnect(me).remove().then(() => D.set(me, { ...profile, since: D.serverTimestamp() }));
      });
    },
    sendChat: (m) => D.push(r('chat'), { ...m, uid, ts: D.serverTimestamp() }),
    deleteChat: (id) => D.remove(r('chat/' + id)),
    addToQueue: (item) => D.push(r('queue'), { ...item, uid, addedAt: D.serverTimestamp() }),
    removeFromQueue: (id) => D.remove(r('queue/' + id)),
    voteQueue: (id, v) => D.set(r(`queue/${id}/votes/${uid}`), v || null),
    voteSong: (v) => D.set(r(`state/likes/${uid}`), v || null),
    voteSkip: (on) => D.set(r(`state/skips/${uid}`), on || null),
    setDuration: (videoId, d) => D.runTransaction(r('state'), (cur) => {
      if (!cur || cur.videoId !== videoId || cur.duration) return;
      return { ...cur, duration: d };
    }),
    // Sadece şu an çalan hâlâ `expected` ise değiştirir; böylece aynı anda
    // birden çok dinleyici "sonraki şarkı" dese bile tek bir geçiş olur.
    advance: (expected, next) => D.runTransaction(r('state'), (cur) => {
      if ((cur?.videoId ?? null) !== expected) return;
      return next;
    }).then((res) => res.committed),
    react: (emoji) => D.push(r('reactions'), { emoji, ts: D.serverTimestamp() }),
  };
}

function localBackend() {
  const uid = 'demo';
  const data = { state: null, queue: {}, presence: {} };
  const subs = { state: [], queue: [], presence: [], chatAdd: [], chatDel: [], reaction: [] };
  const clone = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
  const emit = (k, v) => queueMicrotask(() => subs[k].forEach((f) => f(v)));
  const emitState = () => emit('state', clone(data.state));
  const emitQueue = () => emit('queue', Object.entries(data.queue).map(([id, x]) => ({ id, ...clone(x) })));
  const setIn = (obj, key, v) => { obj[key] = obj[key] || {}; if (v) obj[key][uid] = v; else delete obj[key][uid]; };
  let n = 0;
  const id = () => 'l' + ++n;
  return {
    uid,
    local: true,
    now: () => Date.now(),
    onState: (cb) => { subs.state.push(cb); emitState(); },
    onQueue: (cb) => { subs.queue.push(cb); emitQueue(); },
    onPresence: (cb) => { subs.presence.push(cb); emit('presence', { ...data.presence }); },
    onMods: (cb) => cb({ [uid]: true }), // demoda sen modsun
    onChat: (add, del) => { subs.chatAdd.push(add); subs.chatDel.push(del); },
    onReaction: (cb) => subs.reaction.push(cb),
    join: (p) => { data.presence[uid] = p; emit('presence', { ...data.presence }); },
    sendChat: (m) => emit('chatAdd', { ...m, id: id(), uid, ts: Date.now() }),
    deleteChat: (i) => emit('chatDel', i),
    addToQueue: (item) => { data.queue[id()] = { ...item, uid, addedAt: Date.now() }; emitQueue(); },
    removeFromQueue: (i) => { delete data.queue[i]; emitQueue(); },
    voteQueue: (i, v) => { if (data.queue[i]) { setIn(data.queue[i], 'votes', v); emitQueue(); } },
    voteSong: (v) => { if (data.state) { setIn(data.state, 'likes', v); emitState(); } },
    voteSkip: (on) => { if (data.state) { setIn(data.state, 'skips', on); emitState(); } },
    setDuration: (vid, d) => { if (data.state?.videoId === vid && !data.state.duration) { data.state.duration = d; emitState(); } },
    advance: async (expected, next) => {
      if ((data.state?.videoId ?? null) !== expected) return false;
      data.state = clone(next);
      emitState();
      return true;
    },
    react: (emoji) => emit('reaction', { emoji, ts: Date.now() }),
  };
}

/* =========================================================
   Uygulama durumu
   ========================================================= */
const S = {
  state: null,
  stateLoaded: false,
  queue: [],
  presence: {},
  mods: {},
  joined: false,
  player: null,
  playerReady: false,
  loadedId: null,
  advancing: false,
  errors: 0,
  lastSent: 0,
  volume: store.get('volume', 70),
  profile: store.get('profile', null),
  phase: store.get('phase', 'auto'), // 'auto' ya da PHASES anahtarlarından biri
};
let B; // backend

const isMod = () => !!S.mods[B.uid];
const listenerCount = () => Math.max(1, Object.keys(S.presence).length);
const skipNeeded = () => Math.max(1, Math.ceil(listenerCount() * CONFIG.skipRatio));
const ytUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

function parseVideoId(text) {
  const t = text.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function fetchTitle(id) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(ytUrl(id))}`);
    const j = await res.json();
    return j.title || id;
  } catch {
    return id;
  }
}

function sortedQueue() {
  return [...S.queue].sort((a, b) => sum(b.votes) - sum(a.votes) || (a.addedAt || 0) - (b.addedAt || 0));
}

function pickNext(exclude) {
  const q = sortedQueue()[0];
  if (q) return { ...q, qid: q.id };
  const list = CONFIG.fallbackPlaylist;
  if (!list.length) return null;
  // Sıralı dönüş: son çalan listeden ise bir sonraki; kuyruk şarkısından sonra kaldığı yerden.
  const here = list.findIndex((x) => x.videoId === exclude);
  const last = typeof S.state?.plIndex === 'number' ? S.state.plIndex : -1;
  const index = ((here >= 0 ? here : last) + 1) % list.length;
  return { ...list[index], by: 'radyo', plIndex: index };
}

async function next(expected) {
  if (S.advancing) return;
  const item = pickNext(expected);
  if (!item && expected === null) return; // çalacak bir şey yok
  S.advancing = true;
  try {
    const carry = typeof item?.plIndex === 'number' ? item.plIndex : S.state?.plIndex;
    const state = item
      ? { videoId: item.videoId, title: item.title || item.videoId, by: item.by || 'anon', startedAt: B.now(), ...(item.note ? { note: item.note } : {}), ...(typeof carry === 'number' ? { plIndex: carry } : {}) }
      : null;
    const ok = await B.advance(expected, state);
    if (ok && item) {
      if (item.qid) B.removeFromQueue(item.qid);
      B.sendChat({ system: true, text: '♪ ' + state.title + (state.note ? ' · 🎧 ' + state.note : '') });
    }
  } catch (e) {
    console.error(e);
  } finally {
    S.advancing = false;
  }
}

/* =========================================================
   YouTube oynatıcı
   ========================================================= */
function loadYouTube() {
  window.onYouTubeIframeAPIReady = () => {
    S.player = new YT.Player('yt', {
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, playsinline: 1, modestbranding: 1 },
      events: {
        onReady: () => {
          S.playerReady = true;
          S.player.setVolume(S.volume);
          sync();
        },
        onStateChange: (e) => {
          const st = S.state;
          fire('radio:playing', e.data === YT.PlayerState.PLAYING);
          if (e.data === YT.PlayerState.PLAYING) {
            S.errors = 0;
            const d = S.player.getDuration();
            if (st && !st.duration && d > 0) B.setDuration(st.videoId, Math.round(d));
          }
          if (e.data === YT.PlayerState.ENDED && st) next(st.videoId);
        },
        onError: () => {
          // Gömülmeye izin vermeyen ya da silinmiş video: sıradakine geç
          if (++S.errors > 5) return toast('Arka arkaya çalınamayan videolar var');
          toast('Bu video çalınamıyor, geçiliyor…');
          if (S.state) next(S.state.videoId);
        },
      },
    });
  };
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.append(s);
}

function elapsed() {
  return S.state ? Math.max(0, (B.now() - S.state.startedAt) / 1000) : 0;
}

function sync() {
  const st = S.state;
  if (!S.playerReady || !S.joined) return;
  if (!st) {
    if (S.loadedId) S.player.stopVideo();
    S.loadedId = null;
    return;
  }
  if (st.duration && elapsed() > st.duration + 3) return next(st.videoId);
  if (S.loadedId !== st.videoId) {
    S.loadedId = st.videoId;
    fire('radio:pulse', 1);
    S.player.loadVideoById({ videoId: st.videoId, startSeconds: elapsed() });
  }
}

// Duraklatma yok: plağa tıklamak yalnızca canlı yayına hizalar.
addEventListener('radio:toggle', () => {
  if (!S.playerReady || !S.state) return toast(S.state ? 'Oynatıcı hazırlanıyor…' : 'Şu an çalan bir şey yok');
  S.player.seekTo(elapsed(), true); // canlı yayına dön
  S.player.playVideo();
});

// Nöbetçi: şarkı varken oynatıcı duraklatılmış kalmasın.
setInterval(() => {
  if (!S.playerReady || !S.joined || !S.state) return;
  if (document.visibilityState !== 'visible') return;
  if (S.player.getPlayerState() === YT.PlayerState.PAUSED) {
    S.player.seekTo(elapsed(), true);
    S.player.playVideo();
  }
}, 3000);

// Pikap kolu şarkının neresinde olduğumuzu göstersin
setInterval(() => {
  const st = S.state;
  const d = st?.duration || (S.playerReady && S.loadedId === st?.videoId ? S.player.getDuration() : 0);
  fire('radio:progress', st && d > 0 ? Math.min(elapsed() / d, 1) : 0);
}, 500);

// Herkes aynı saniyede kalsın diye ara ara kayma düzeltmesi
setInterval(() => {
  if (!S.playerReady || !S.state || S.loadedId !== S.state.videoId) return;
  if (S.player.getPlayerState() !== YT.PlayerState.PLAYING) return;
  const target = elapsed();
  if (Math.abs(S.player.getCurrentTime() - target) > 4) S.player.seekTo(target, true);
}, 8000);

/* =========================================================
   Arayüz
   ========================================================= */
function phaseByClock(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'sabah';
  if (h >= 11 && h < 17) return 'ogle';
  if (h >= 17 && h < 21) return 'aksam';
  return 'gece';
}

function applyPhase() {
  const p = PHASES[S.phase] ? S.phase : phaseByClock();
  document.documentElement.dataset.phase = p;
  $('#phaseBtn').textContent = 'vakit: ' + (S.phase === 'auto' ? `otomatik (${PHASES[p]})` : PHASES[p]);
  document.querySelectorAll('.brand-mark').forEach((m) => { m.textContent = PHASE_ICON[p]; });
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
}
setInterval(applyPhase, 60000);

function renderNow() {
  const st = S.state;
  $('#empty').hidden = !!st;
  $('#live').textContent = st ? 'yayında' : 'sessiz';
  $('#live').classList.toggle('on', !!st);
  const title = $('#title');
  title.textContent = st ? st.title : '—';
  if (st) title.href = ytUrl(st.videoId); else title.removeAttribute('href');
  $('#by').textContent = st ? st.by : '—';
  const noteEl = $('#nowNote');
  noteEl.hidden = !st?.note;
  noteEl.textContent = st?.note ? '🎧 ' + st.note : '';
  if ((st?.videoId || null) !== S.shownId) {
    S.shownId = st?.videoId || null;
    fire('radio:track', { videoId: S.shownId, title: st?.title || '' });
  }
  const mine = st?.likes?.[B.uid];
  $('#up span').textContent = count(st?.likes, 1);
  $('#down span').textContent = count(st?.likes, -1);
  $('#up').classList.toggle('on', mine === 1);
  $('#down').classList.toggle('on', mine === -1);
  renderSkip();
}

function renderSkip() {
  const st = S.state;
  const n = Object.keys(st?.skips || {}).length;
  const need = skipNeeded();
  $('#skip').textContent = `geç ${n}/${need}`;
  $('#skip').classList.toggle('on', !!st?.skips?.[B.uid]);
  if (st && n >= need && S.joined) next(st.videoId);
}

function renderQueue() {
  const q = sortedQueue();
  $('#nextTitle').textContent = q[0] ? q[0].title : 'boş — sen ekle';
  const list = $('#queueList');
  if (!q.length) {
    list.innerHTML = '<li class="queue-empty">Kuyrukta şarkı yok. Link yapıştır, en çok oy alan sıradaki olur.</li>';
    return;
  }
  list.innerHTML = q.map((it) => {
    const mine = it.votes?.[B.uid];
    const canRemove = isMod() || it.uid === B.uid;
    return `<li data-id="${esc(it.id)}">
      <button data-v="1" class="${mine === 1 ? 'on' : ''}" title="yukarı">▲</button>
      <span class="score">${sum(it.votes)}</span>
      <button data-v="-1" class="${mine === -1 ? 'on' : ''}" title="aşağı">▼</button>
      <span class="q-title" title="${esc(it.title)}">${esc(it.title)} <span class="q-by">· ${esc(it.by)}</span>${it.note ? ` <span class="q-note">🎧 ${esc(it.note)}</span>` : ''}</span>
      ${canRemove ? '<button data-del title="kaldır">✕</button>' : ''}
    </li>`;
  }).join('');
}

function renderPresence() {
  const n = Object.keys(S.presence).length;
  $('#listeners').textContent = `${n} dinleyici`;
  $('#chatCount').textContent = `· ${n} KİŞİ`;
  renderSkip();
}

function nickColor(name) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} var(--nick-sat) var(--nick-light))`;
}

function ago(ts) {
  const m = Math.floor((B.now() - ts) / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return m + ' dk';
  const h = Math.floor(m / 60);
  return h < 24 ? h + ' sa' : Math.floor(h / 24) + ' g';
}

function addMessage(m) {
  const list = $('#messages');
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const li = document.createElement('li');
  li.dataset.id = m.id;
  if (m.system) {
    li.className = 'msg system';
    li.innerHTML = `<span>${esc(m.text)}</span>`;
  } else {
    li.className = 'msg';
    li.innerHTML = `${esc(m.avatar || '🙂')} ${S.mods[m.uid] ? '<span class="badge">MOD</span>' : ''}` +
      `<span class="nick" style="color:${nickColor(m.name)}">${esc(m.name)}:</span> ${esc(m.text)}` +
      `<span class="time" data-ts="${m.ts || B.now()}">${ago(m.ts || B.now())}</span>` +
      (isMod() ? '<button class="del" title="sil">sil</button>' : '');
  }
  list.append(li);
  while (list.children.length > CONFIG.chatHistory) list.firstElementChild.remove();
  if (atBottom || m.uid === B.uid) list.scrollTop = list.scrollHeight;
}
setInterval(() => {
  if (!B) return;
  document.querySelectorAll('.msg .time').forEach((t) => { t.textContent = ago(+t.dataset.ts); });
}, 30000);

function floatEmoji(emoji) {
  const s = document.createElement('span');
  s.textContent = emoji;
  s.style.left = 10 + Math.random() * 80 + '%';
  $('#fx').append(s);
  setTimeout(() => s.remove(), 2500);
}

function renderMe() {
  $('#meAvatar').textContent = S.profile?.avatar || '🙂';
  $('#meName').textContent = S.profile?.name || '';
}

/* ---------- Giriş penceresi ---------- */
function openJoin() {
  const dlg = $('#joinDlg');
  let avatar = S.profile?.avatar || CONFIG.avatars[0];
  $('#joinName').value = S.profile?.name || '';
  const pick = $('#avatarPick');
  pick.innerHTML = CONFIG.avatars.map((a) => `<button type="button" data-a="${a}">${a}</button>`).join('');
  const mark = () => pick.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.a === avatar));
  pick.onclick = (e) => { const b = e.target.closest('button'); if (b) { avatar = b.dataset.a; mark(); } };
  mark();
  $('#demoNote').hidden = !B?.local;
  $('#joinForm').onsubmit = () => {
    const name = $('#joinName').value.trim().slice(0, 20);
    if (!name) return;
    S.profile = { name, avatar };
    store.set('profile', S.profile);
    renderMe();
    if (!S.joined) {
      S.joined = true;
      B.join(S.profile);
      if (S.stateLoaded && !S.state) next(null);
      sync();
      if (S.playerReady) S.player.playVideo();
    }
  };
  dlg.showModal();
}

/* ---------- Olaylar ---------- */
function bindUI() {
  const vol = $('#vol');
  vol.value = S.volume;
  $('#volv').textContent = S.volume;
  vol.oninput = () => {
    S.volume = +vol.value;
    $('#volv').textContent = S.volume;
    store.set('volume', S.volume);
    if (S.playerReady) { S.player.setVolume(S.volume); if (S.volume > 0) S.player.unMute(); }
  };

  $('#up').onclick = () => B.voteSong(S.state?.likes?.[B.uid] === 1 ? 0 : 1);
  $('#down').onclick = () => B.voteSong(S.state?.likes?.[B.uid] === -1 ? 0 : -1);

  $('#skip').onclick = () => {
    if (!S.state) return next(null);
    if (isMod()) return next(S.state.videoId); // modlar direkt geçer
    B.voteSkip(!S.state.skips?.[B.uid]);
  };

  $('#share').onclick = () => {
    const text = S.state ? `Şu an ${CONFIG.siteName}'da çalıyor: ${S.state.title}` : CONFIG.siteName;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`, '_blank', 'noopener');
  };

  $('#phaseBtn').onclick = () => {
    const keys = ['auto', ...Object.keys(PHASES)];
    S.phase = keys[(keys.indexOf(S.phase) + 1) % keys.length];
    store.set('phase', S.phase);
    applyPhase();
  };

  $('#queueToggle').onclick = () => {
    const q = $('#queue');
    q.hidden = !q.hidden;
    $('#queueToggle .caret').textContent = q.hidden ? '▾' : '▴';
    if (!q.hidden) $('#addInput').focus();
  };

  $('#addForm').onsubmit = async (e) => {
    e.preventDefault();
    const input = $('#addInput');
    const noteInput = $('#addNote');
    const id = parseVideoId(input.value);
    if (!id) return toast('Geçerli bir YouTube linki değil');
    if (S.queue.some((q) => q.videoId === id) || S.state?.videoId === id) return toast('Bu şarkı zaten listede');
    const note = (noteInput?.value || '').trim().slice(0, 80);
    input.value = '';
    if (noteInput) noteInput.value = '';
    const title = await fetchTitle(id);
    const item = { videoId: id, title, by: S.profile?.name || 'anon', votes: { [B.uid]: 1 } };
    if (note) item.note = note;
    B.addToQueue(item);
    toast('Kuyruğa eklendi ♪');
  };

  $('#queueList').onclick = (e) => {
    const b = e.target.closest('button');
    const li = e.target.closest('li[data-id]');
    if (!b || !li) return;
    if (b.hasAttribute('data-del')) return B.removeFromQueue(li.dataset.id);
    const v = +b.dataset.v;
    const item = S.queue.find((q) => q.id === li.dataset.id);
    B.voteQueue(li.dataset.id, item?.votes?.[B.uid] === v ? 0 : v);
  };

  $('#chatForm').onsubmit = (e) => {
    e.preventDefault();
    const input = $('#chatInput');
    const text = input.value.trim().slice(0, 300);
    if (!text) return;
    if (Date.now() - S.lastSent < 1000) return toast('Biraz yavaş 🙂');
    S.lastSent = Date.now();
    input.value = '';
    B.sendChat({ name: S.profile.name, avatar: S.profile.avatar, text });
  };

  $('#messages').onclick = (e) => {
    const li = e.target.closest('.del') && e.target.closest('li');
    if (li) B.deleteChat(li.dataset.id);
  };

  $('#reacts').innerHTML = CONFIG.reactions.map((r) => `<button type="button">${r}</button>`).join('');
  $('#reacts').onclick = (e) => { const b = e.target.closest('button'); if (b) B.react(b.textContent); };

  $('#editMe').onclick = openJoin;
  $('#chatClose').onclick = () => { $('#chat').hidden = true; $('#chatOpen').hidden = false; };
  $('#chatOpen').onclick = () => { $('#chat').hidden = false; $('#chatOpen').hidden = true; };
}

/* ---------- Başlat ---------- */
async function main() {
  $('#brand').textContent = CONFIG.siteName;
  document.title = CONFIG.siteName;
  applyPhase();
  bindUI();

  try {
    B = CONFIG.firebase?.apiKey ? await firebaseBackend(CONFIG.firebase) : localBackend();
  } catch (e) {
    console.error(e);
    toast('Sunucuya bağlanılamadı, demo modunda açılıyor');
    B = localBackend();
  }

  B.onMods((m) => { S.mods = m; renderQueue(); });
  B.onPresence((p) => { S.presence = p; renderPresence(); });
  B.onQueue((q) => {
    S.queue = q;
    renderQueue();
    if (S.joined && S.stateLoaded && !S.state && q.length) next(null);
  });
  B.onState((st) => {
    S.state = st;
    S.stateLoaded = true;
    renderNow();
    if (S.joined && !st) next(null);
    sync();
  });
  B.onChat(addMessage, (id) => document.querySelector(`.msg[data-id="${CSS.escape(id)}"]`)?.remove());
  B.onReaction((r) => { floatEmoji(r.emoji); fire('radio:pulse', 0.35); });

  renderMe();
  loadYouTube();
  openJoin();
}

main();
