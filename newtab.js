'use strict';

// ---------- Speicher ----------
// In der Extension chrome.storage.local; als normale Datei geöffnet (zum Testen) localStorage.
const hasExt = typeof chrome !== 'undefined' && !!chrome.storage;
const storage = hasExt ? chrome.storage.local : {
  async get(keys) {
    const out = {};
    for (const k of keys) {
      const v = localStorage.getItem('yfstart.' + k);
      if (v) out[k] = JSON.parse(v);
    }
    return out;
  },
  async set(obj) {
    for (const [k, v] of Object.entries(obj)) localStorage.setItem('yfstart.' + k, JSON.stringify(v));
  },
};

// ---------- Konstanten ----------
const gIcon = name => `https://ssl.gstatic.com/images/branding/product/2x/${name}_48dp.png`;
const favicon = url => `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(url)}`;

const GOOGLE_APPS = [
  ['Konto', 'https://myaccount.google.com/'],
  ['Suche', 'https://www.google.com/', gIcon('googleg')],
  ['Gmail', 'https://mail.google.com/mail/', gIcon('gmail_2020q4')],
  ['Drive', 'https://drive.google.com/', gIcon('drive_2020q4')],
  ['Kalender', 'https://calendar.google.com/', gIcon('calendar_2020q4')],
  ['Docs', 'https://docs.google.com/document/', gIcon('docs_2020q4')],
  ['Tabellen', 'https://docs.google.com/spreadsheets/', gIcon('sheets_2020q4')],
  ['Präsentationen', 'https://docs.google.com/presentation/', gIcon('slides_2020q4')],
  ['Formulare', 'https://docs.google.com/forms/', gIcon('forms_2020q4')],
  ['Meet', 'https://meet.google.com/', gIcon('meet_2020q4')],
  ['Chat', 'https://chat.google.com/', gIcon('chat_2020q4')],
  ['Kontakte', 'https://contacts.google.com/', gIcon('contacts_2022')],
  ['Keep', 'https://keep.google.com/', gIcon('keep_2020q4')],
  ['Maps', 'https://maps.google.com/'],
  ['YouTube', 'https://www.youtube.com/'],
  ['Fotos', 'https://photos.google.com/'],
  ['Übersetzer', 'https://translate.google.com/'],
  ['News', 'https://news.google.com/'],
  ['Gemini', 'https://gemini.google.com/'],
  ['Play', 'https://play.google.com/', gIcon('play_prism')],
];

const DEFAULT_SHORTCUTS = [
  { id: 'd1', label: 'YouTube', url: 'https://www.youtube.com/', color: '#ffffff', autoFg: true },
  { id: 'd2', label: 'GitHub', url: 'https://github.com/', color: '#ffffff', autoFg: true },
  { id: 'd3', label: 'Claude', url: 'https://claude.ai/', color: '#ffffff', autoFg: true },
  { id: 'd4', label: 'Drive', url: 'https://drive.google.com/', color: '#ffffff', autoFg: true },
];

// YFRemote-Aktionen: build(param) liefert die WebSocket-Nachricht (siehe RemoteActionHandler im Server).
const mediaKey = key => () => ({ type: 'key', keys: [key] });
const ACTIONS = {
  lock: { name: 'Sperren', icon: 'fa-solid fa-lock', build: () => ({ type: 'lock' }) },
  sleep: { name: 'Energie sparen', icon: 'fa-solid fa-moon', build: () => ({ type: 'sleep' }) },
  displayOff: { name: 'Bildschirm aus', icon: 'fa-solid fa-display', build: () => ({ type: 'displayOff' }) },
  shutdown: { name: 'Herunterfahren', icon: 'fa-solid fa-power-off', confirm: true, build: () => ({ type: 'shutdown' }) },
  restart: { name: 'Neustart', icon: 'fa-solid fa-rotate-right', confirm: true, build: () => ({ type: 'restart' }) },
  playPause: { name: 'Play / Pause', icon: 'fa-solid fa-play', build: mediaKey('MEDIA_PLAY_PAUSE') },
  next: { name: 'Nächster Titel', icon: 'fa-solid fa-forward-step', build: mediaKey('MEDIA_NEXT') },
  prev: { name: 'Vorheriger Titel', icon: 'fa-solid fa-backward-step', build: mediaKey('MEDIA_PREVIOUS') },
  mute: { name: 'Stumm an/aus', icon: 'fa-solid fa-volume-xmark', build: mediaKey('VOLUME_MUTE') },
  volUp: { name: 'Lauter', icon: 'fa-solid fa-volume-high', build: mediaKey('VOLUME_UP') },
  volDown: { name: 'Leiser', icon: 'fa-solid fa-volume-low', build: mediaKey('VOLUME_DOWN') },
  volume: {
    name: 'Lautstärke setzen', icon: 'fa-solid fa-sliders', param: 'Lautstärke (0–100)',
    build: p => {
      const v = Number(p);
      if (p === '' || !Number.isInteger(v) || v < 0 || v > 100) throw new Error('Lautstärke muss eine Zahl von 0 bis 100 sein.');
      return { type: 'volume', volume: v };
    },
  },
  hotkey: {
    name: 'Taste / Tastenkombination', icon: 'fa-solid fa-keyboard', param: 'z. B. CTRL+SHIFT+ESC, WIN+D, F5',
    build: p => {
      const keys = p.split('+').map(k => k.trim().toUpperCase()).filter(Boolean);
      if (!keys.length) throw new Error('Bitte eine Taste angeben.');
      return { type: keys.length === 1 ? 'key' : 'hotkey', keys };
    },
  },
  text: {
    name: 'Text tippen', icon: 'fa-solid fa-i-cursor', param: 'Text',
    build: p => { if (!p) throw new Error('Bitte einen Text angeben.'); return { type: 'text', text: p }; },
  },
  openUrl: {
    name: 'Website öffnen', icon: 'fa-solid fa-globe', param: 'https://…',
    build: p => {
      if (!/^https?:\/\/\S+$/i.test(p)) throw new Error('URL muss mit http:// oder https:// beginnen.');
      return { type: 'launch', url: p };
    },
  },
  openApp: {
    name: 'App starten', icon: 'fa-solid fa-rocket', param: 'App-Name (wie im Startmenü)',
    build: p => { if (!p) throw new Error('Bitte einen App-Namen angeben.'); return { type: 'launch', name: p }; },
  },
};

// ---------- Zustand ----------
const DEFAULT_DESIGN = {
  theme: 'auto', accent: null, bgImage: null, bgDim: 30, size: 'm', shape: 'rounded', tiles: 'plain', animations: true,
  openIn: 'same', screenIn: 'same', // Links bzw. YFRemote-Bildschirm im gleichen oder neuen Tab
  greeting: true, name: '', // „Guten Morgen, <name>“ über der Uhr
};
const state = {
  shortcuts: [], groups: [], pcs: [], weather: { enabled: false, name: '', lat: null, lon: null }, design: { ...DEFAULT_DESIGN },
};
let editing = false;
const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

// ---------- Design ----------
// [id, Name, Vorschau-Hintergrund, Vorschau-Farben]
const THEMES = [
  ['auto', 'System', 'linear-gradient(135deg, #f4f6fb 50%, #17181c 50%)', ['#1a73e8', '#8ab4f8']],
  ['light', 'Hell', '#f4f6fb', ['#1a73e8', '#dde1e8']],
  ['dark', 'Dunkel', '#17181c', ['#8ab4f8', '#2c2f36']],
  ['midnight', 'Mitternacht', '#000', ['#a78bfa', '#1a1a1f']],
  ['paper', 'Papier', '#f4ede2', ['#c2410c', '#e2d5c2']],
  ['aurora', 'Aurora', 'radial-gradient(circle at 30% 30%, #7c3aed, transparent 55%), radial-gradient(circle at 75% 60%, #0d9488, transparent 50%), #0a0f1f', ['#a5b4fc', '#2563eb']],
  ['ocean', 'Ozean', 'linear-gradient(160deg, #0f2027, #2c5364)', ['#67e8f9', '#203a43']],
  ['sunset', 'Abendrot', 'linear-gradient(165deg, #1f1c2c, #4a2a73 40%, #b8466a 78%, #f08a5d)', ['#fdba74', '#b8466a']],
  ['forest', 'Wald', 'linear-gradient(170deg, #0b1a12, #24513a)', ['#86efac', '#163626']],
];

function applyDesign(d) {
  const root = document.documentElement;
  Object.assign(root.dataset, {
    theme: d.theme, size: d.size, shape: d.shape, tiles: d.tiles, anim: d.animations ? 'on' : 'off',
  });
  if (d.accent) {
    root.style.setProperty('--accent', d.accent);
    root.style.setProperty('--on-accent', readableOn(d.accent));
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--on-accent');
  }
  root.classList.toggle('has-bg-image', !!d.bgImage);
  if (d.bgImage) root.style.setProperty('--user-bg', `url("${d.bgImage}")`);
  else root.style.removeProperty('--user-bg');
  root.style.setProperty('--bg-dim', d.bgImage ? d.bgDim / 100 : 0);
  document.querySelectorAll('a[data-follow]').forEach(a => (a.target = d.openIn === 'new' ? '_blank' : ''));
}

// Kopie im localStorage, damit das Design beim Öffnen sofort steht und nichts aufblitzt.
try { applyDesign(state.design = { ...DEFAULT_DESIGN, ...JSON.parse(localStorage.getItem('yfstart.design') || '{}') }); } catch { /* egal */ }

async function load() {
  const d = await storage.get(['shortcuts', 'groups', 'pcs', 'weather', 'design', 'syncOn', 'syncAt']);
  state.groups = Array.isArray(d.groups) ? d.groups : [];
  if (d.weather) state.weather = d.weather;
  state.design = { ...DEFAULT_DESIGN, ...d.design };
  state.shortcuts = Array.isArray(d.shortcuts) ? d.shortcuts : structuredClone(DEFAULT_SHORTCUTS);
  state.pcs = Array.isArray(d.pcs) ? d.pcs : [];
  firstRun = !d.shortcuts;
  syncOn = hasExt && !!d.syncOn;
  syncAt = d.syncAt || 0;
  if (syncOn) {
    const remote = await readSync();
    if (remote && remote.at > syncAt) await takeRemote(remote); // auf einem anderen PC geändert
    else if (!remote || remote.at < syncAt) pushSync(); // hier geändert, aber noch nicht hochgeladen
  }
  applyDesign(state.design);
  // Ältere Einträge mit http://…:5443 reparieren (siehe normalizePcUrl).
  for (const pc of state.pcs) pc.url = normalizePcUrl(pc.url) || pc.url;
}

async function writeLocal() {
  await storage.set({
    shortcuts: state.shortcuts, groups: state.groups, pcs: state.pcs, weather: state.weather, design: state.design, syncAt,
  });
  try { localStorage.setItem('yfstart.design', JSON.stringify(state.design)); } catch { /* Bild zu groß: dann ohne Sofort-Kopie */ }
}

async function save() {
  syncAt = Math.max(Date.now(), syncAt + 1); // nie hinter einen Stand zurück, auch wenn die Uhr eines PCs vorgeht
  await writeLocal();
  pushSync();
}

// ---------- Sync über das Google-Konto ----------
// chrome.storage.sync erlaubt höchstens 8 KB pro Eintrag und 100 KB insgesamt. Deshalb liegt alles als
// JSON in Stücken (c0, c1, …) plus meta { at, n, len }. Der neuere Stand gewinnt (at = Zeit der Änderung).
// Nur auf diesem PC bleiben: Kopplungs-Tokens (gelten pro Gerät), Hintergrundbild und hochgeladene Icons (zu groß).
// Gleiche Extension-ID auf allen PCs dank "key" in manifest.json, sonst sieht jeder PC nur seine eigenen Daten.
const SYNC_CHUNK = 2500; // Zeichen; ein Zeichen braucht im Speicher bis zu 3 Byte
let syncOn = false, syncAt = 0, syncTimer = null, syncedJson = '', firstRun = false;
const isDataUrl = v => typeof v === 'string' && v.startsWith('data:');

function syncPayload() {
  const tiles = list => (list || []).map(t => (isDataUrl(t.image) ? { ...t, image: null, localImage: true } : t));
  return {
    shortcuts: tiles(state.shortcuts),
    groups: state.groups.map(g => ({ ...g, shortcuts: tiles(g.shortcuts) })),
    pcs: state.pcs.map(({ token, ...pc }) => ({ ...pc, buttons: tiles(pc.buttons) })),
    weather: state.weather,
    design: { ...state.design, bgImage: null },
  };
}

// Übernimmt einen Stand vom Google-Konto, behält aber, was nur auf diesem PC liegt.
function applySynced(data) {
  const allTiles = s => [...s.shortcuts, ...s.groups.flatMap(g => g.shortcuts), ...s.pcs.flatMap(pc => pc.buttons || [])];
  const images = new Map(allTiles(state).filter(t => isDataUrl(t.image)).map(t => [t.id, t.image]));
  for (const t of allTiles(data)) if (t.localImage && images.has(t.id)) t.image = images.get(t.id);
  const before = new Map(state.pcs.map(pc => [pc.id, pc]));
  state.shortcuts = data.shortcuts;
  state.groups = data.groups;
  state.pcs = data.pcs.map(pc => {
    const old = before.get(pc.id);
    return { ...pc, token: old && old.url === pc.url ? old.token : null };
  });
  if (data.weather) state.weather = data.weather;
  state.design = { ...DEFAULT_DESIGN, ...data.design, bgImage: state.design.bgImage };
}

async function readSync() {
  const all = await chrome.storage.sync.get(null);
  const { meta } = all;
  if (!meta?.n) return null;
  let json = '';
  for (let i = 0; i < meta.n; i++) json += all['c' + i] ?? '';
  if (json.length !== meta.len) return null; // noch nicht alle Stücke angekommen
  try {
    const data = JSON.parse(json);
    if (![data.shortcuts, data.groups, data.pcs].every(Array.isArray)) return null;
    syncedJson = json;
    return { at: meta.at, data };
  } catch {
    return null;
  }
}

async function takeRemote(remote) {
  applySynced(remote.data);
  syncAt = remote.at;
  await writeLocal();
}

function pushSync() {
  if (!syncOn) return;
  clearTimeout(syncTimer);
  // Kurz warten: mehrere Änderungen hintereinander (Ziehen, Klicken) werden ein Schreibvorgang.
  // Chrome erlaubt nur 120 pro Minute. Geht der Tab vorher zu, holt load() das beim nächsten Öffnen nach.
  syncTimer = setTimeout(async () => {
    if (!syncOn) return;
    const json = JSON.stringify(syncPayload());
    if (json === syncedJson) return;
    const chunks = {};
    let n = 0;
    for (let i = 0; i < json.length; n++) {
      let end = i + SYNC_CHUNK;
      const c = json.charCodeAt(end - 1);
      if (c >= 0xd800 && c <= 0xdbff) end--; // Emoji nicht zwischen zwei Stücken teilen
      chunks['c' + n] = json.slice(i, end);
      i = end;
    }
    try {
      const { meta: old } = await chrome.storage.sync.get('meta');
      await chrome.storage.sync.set({ ...chunks, meta: { at: syncAt, n, len: json.length } });
      const extra = [];
      for (let i = n; i < (old?.n ?? 0); i++) extra.push('c' + i);
      if (extra.length) await chrome.storage.sync.remove(extra);
      syncedJson = json;
    } catch (err) {
      toast(/quota/i.test(err.message)
        ? 'Sync: zu viele Daten für das Google-Konto. Die Änderung gilt nur auf diesem PC.'
        : 'Sync fehlgeschlagen: ' + err.message, true);
    }
  }, 800);
}

async function setSync(on) {
  if (!hasExt) return toast('Sync geht nur in der Extension.', true);
  syncOn = on;
  await storage.set({ syncOn });
  if (!on) return toast('Sync aus. Änderungen gelten ab jetzt nur auf diesem PC.');
  let remote = await readSync();
  if (remote && !confirm('Im Google-Konto gibt es schon einen Stand von einem anderen PC.\n\n'
    + 'OK: diesen Stand übernehmen (ersetzt Verknüpfungen, Gruppen, PCs und Einstellungen hier).\n'
    + 'Abbrechen: den Stand von diesem PC hochladen.')) remote = null;
  if (remote) {
    await takeRemote(remote);
    smooth(() => { applyDesign(state.design); render(); });
    renderWeather();
    return toast('Stand vom Google-Konto übernommen.');
  }
  syncedJson = '';
  await save();
  toast('Sync an. Die anderen PCs bekommen diesen Stand, sobald dort Sync an ist.');
}

// Änderung von einem anderen PC (oder einem anderen Tab hier). Nicht mitten im Bearbeiten ersetzen:
// dann gewinnt die nächste Änderung hier, wie bei gleichzeitigen Änderungen auf zwei PCs.
if (hasExt) chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'sync' || !syncOn || editing || document.querySelector('dialog[open]')) return;
  const remote = await readSync();
  if (!remote || remote.at <= syncAt) return;
  await takeRemote(remote);
  smooth(() => { applyDesign(state.design); render(); });
  renderWeather();
});

// ---------- Hilfen ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter(k => k != null && k !== false));
  return el;
}

let toastTimer;
function toast(msg, isError = false, ms = isError ? 5000 : 2500) {
  const t = $('#toast');
  t.replaceChildren(fa(isError ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-check'), msg);
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function readableOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#1f2328';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#1f2328' : '#ffffff';
}

function normalizeLink(raw) {
  const s = raw.trim();
  if (!s) return null;
  try { return new URL(/^[a-z][\w+.-]*:/i.test(s) ? s : 'https://' + s).href; } catch { return null; }
}

// "192.168.1.20" -> "http://192.168.1.20:5050" (YFRemote-Standardport, wenn keiner angegeben ist).
// 5443 ist YFRemotes HTTPS-Port: dort spricht der Server kein HTTP, und HTTPS scheitert in Chrome am
// selbst ausgestellten Zertifikat. HTTP läuft laut YFRemote immer zusätzlich auf 5050, also dorthin.
function normalizePcUrl(raw) {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : 'http://' + s);
    if (!u.port && !/^(https?:\/\/)?[^/]+:\d+/i.test(s)) u.port = '5050';
    if (u.port === '5443') return `http://${u.hostname}:5050`;
    return u.origin;
  } catch { return null; }
}

// ---------- Uhr ----------
function greeting(hour) {
  return hour < 5 ? 'Gute Nacht' : hour < 11 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : hour < 23 ? 'Guten Abend' : 'Gute Nacht';
}

function tick() {
  const now = new Date();
  const { greeting: show, name } = state.design;
  const g = $('#greeting');
  g.hidden = !show;
  g.textContent = show ? greeting(now.getHours()) + (name.trim() ? ', ' + name.trim() : '') : '';
  $('#clock').replaceChildren(
    now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    h('small', {}, now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
  );
}

// ---------- Suche mit Google-Vorschlägen ----------
const q = $('#q');
const suggestBox = $('#suggest');
let suggestions = [];
let selected = -1;
let typed = '';
let suggestCtl;
let suggestTimer;
let calcValue = null; // Ergebnis, wenn der Suchtext eine Rechnung ist (calc.js)

function looksLikeUrl(s) {
  return !/\s/.test(s) && /^(https?:\/\/\S+|localhost(:\d+)?(\/\S*)?|[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?|\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/\S*)?)$/i.test(s);
}

function go(text) {
  const s = text.trim();
  if (!s) return;
  location.href = looksLikeUrl(s)
    ? (/^https?:\/\//i.test(s) ? s : (/^(localhost|\d)/.test(s) ? 'http://' : 'https://') + s)
    : 'https://www.google.com/search?q=' + encodeURIComponent(s);
}

function showSuggest(list) {
  suggestions = list;
  selected = -1;
  const rows = list.map((s, i) => h('li', {
    role: 'option', id: 'sug' + i,
    onmousedown: e => { e.preventDefault(); go(s); },
  }, fa('fa-solid fa-magnifying-glass'), s));
  if (calcValue != null) {
    const shown = calcValue.toLocaleString('de-DE', { maximumFractionDigits: 10 });
    const plain = calcValue.toLocaleString('de-DE', { maximumFractionDigits: 10, useGrouping: false });
    rows.unshift(h('li', {
      class: 'calc', title: 'Klicken kopiert das Ergebnis',
      onmousedown: async e => {
        e.preventDefault();
        await navigator.clipboard.writeText(plain);
        toast(`${plain} kopiert.`);
      },
    }, fa('fa-solid fa-calculator'), h('span', {}, '= ', h('b', {}, shown))));
  }
  suggestBox.replaceChildren(...rows);
  const open = rows.length > 0;
  suggestBox.hidden = !open;
  $('#searchForm').classList.toggle('open', open);
  q.setAttribute('aria-expanded', open);
}

function markSelected() {
  suggestBox.querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', i === selected));
  q.value = selected >= 0 ? suggestions[selected] : typed;
  if (selected >= 0) q.setAttribute('aria-activedescendant', 'sug' + selected);
  else q.removeAttribute('aria-activedescendant');
}

async function loadSuggest() {
  const text = typed;
  suggestCtl?.abort();
  if (!text.trim()) return showSuggest([]);
  suggestCtl = new AbortController();
  try {
    const lang = (navigator.language || 'de').split('-')[0];
    const res = await fetch('https://suggestqueries.google.com/complete/search?client=chrome&ie=utf-8&oe=utf-8&hl='
      + lang + '&q=' + encodeURIComponent(text), { signal: suggestCtl.signal });
    const [, list] = await res.json();
    // Bei Rechnungen schlägt Google selbst „= Ergebnis“ vor; das zeigt schon die Rechner-Zeile.
    const own = calcValue != null ? list.filter(s => !s.startsWith('=')) : list;
    if (typed === text && document.activeElement === q) showSuggest(own.slice(0, 8));
  } catch { /* offline oder abgebrochen: keine Vorschläge */ }
}

q.addEventListener('input', () => {
  typed = q.value;
  calcValue = calc(typed);
  showSuggest(typed.trim() ? suggestions : []); // Ergebnis sofort, Vorschläge kommen gleich
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(loadSuggest, 90);
});
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!suggestions.length) return;
    e.preventDefault();
    const n = suggestions.length + 1; // +1 = eigener Text
    selected = ((selected + 1 + (e.key === 'ArrowDown' ? 1 : -1) + n) % n) - 1;
    markSelected();
  } else if (e.key === 'Escape') {
    showSuggest([]);
  }
});
q.addEventListener('blur', () => setTimeout(() => showSuggest([]), 100));
q.addEventListener('focus', () => { if (q.value) { typed = q.value; loadSuggest(); } });
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); go(q.value); });

// ---------- Google-Apps ----------
const appsBtn = $('#appsBtn');
const appsPanel = $('#appsPanel');
appsPanel.append(...GOOGLE_APPS.map(([name, url, icon], i) =>
  h('a', { class: 'app', href: url, 'data-follow': true, style: `--i:${i}` }, h('img', { src: icon || favicon(url), alt: '' }), name)));
function setApps(open) {
  appsPanel.classList.toggle('open', open);
  appsBtn.setAttribute('aria-expanded', open);
}
appsBtn.addEventListener('click', e => { e.stopPropagation(); setApps(!appsPanel.classList.contains('open')); });
document.addEventListener('click', e => { if (!appsPanel.contains(e.target)) setApps(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setApps(false); });

// ---------- Kacheln ----------
// Icon einer Kachel (t.icon):
//   ""            automatisch: Favicon der Website bzw. Symbol der YFRemote-Aktion
//   "fa:<klassen>" Font-Awesome-Icon, z. B. "fa:fa-brands fa-youtube"
//   "https://…"   Bild-URL; ein hochgeladenes Bild steht in t.image
//   sonst         Emoji oder kurzer Text
const fa = cls => h('i', { class: cls, 'aria-hidden': 'true' });

// Website-Icon: Googles Favicon-Dienst kennt nur Seiten, die Google gecrawlt hat. Für andere (eigene
// Server, Seiten hinter einem Login) liefert er einen grauen 16-px-Globus mit Status 404, den Chrome
// trotzdem als geladen meldet. Dann direkt bei der Seite nachsehen.
function siteIconCandidates(url) {
  let origin;
  try { origin = new URL(url).origin; } catch { return []; }
  return [favicon(url), origin + '/favicon.ico', origin + '/apple-touch-icon.png'];
}

// Lädt die erste Adresse, die ein brauchbares Bild liefert. 16 px und kleiner zählt als Platzhalter.
function loadFirstIcon(img, candidates, onFail) {
  let i = 0;
  const next = () => (i < candidates.length ? (img.src = candidates[i++]) : onFail());
  img.addEventListener('load', () => { if (img.naturalWidth <= 16) next(); });
  img.addEventListener('error', next);
  next();
}
const linkTarget = t => ((t.openIn || state.design.openIn) === 'new' ? '_blank' : null);

// Weicher Übergang beim Umbauen der Seite (View Transitions): Kacheln gleiten an ihren neuen Platz,
// Designwechsel blenden über. Ohne Animationen oder bei "Bewegung reduzieren" sofort.
function smooth(update) {
  const reduce = !state.design.animations || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || document.hidden || !document.startViewTransition) return void update();
  // Abgebrochene Übergänge (z. B. Tab im Hintergrund) sind egal - die Änderung ist trotzdem drin.
  document.startViewTransition(update).ready.catch(() => {});
}
// Eindeutiger Name je Element, damit der Übergang es über das Umbauen hinweg wiedererkennt.
const vtName = (el, id) => { el.style.viewTransitionName = 'vt-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '_'); return el; };

function paintIcon(ic, t, kind) {
  const color = t.color || '#ffffff';
  ic.style.background = color;
  ic.style.color = t.autoFg !== false ? readableOn(color) : (t.fg || '#ffffff');
  const icon = (t.icon || '').trim();
  const letter = (t.label || '?').slice(0, 1).toUpperCase();
  if (icon.startsWith('fa:')) return void ic.replaceChildren(fa(icon.slice(3)));
  const own = t.image || (/^(https?:|data:image\/)/i.test(icon) ? icon : null);
  if (own) {
    const img = h('img', { src: own, alt: '', class: t.imageFill ? 'fill' : null });
    img.addEventListener('error', () => ic.replaceChildren(letter));
    ic.replaceChildren(img);
  } else if (!icon && kind === 'link' && t.url) {
    const img = h('img', { alt: '' });
    ic.replaceChildren(img);
    loadFirstIcon(img, siteIconCandidates(t.url), () => ic.replaceChildren(letter));
  } else if (icon) {
    ic.replaceChildren(icon);
  } else {
    ic.replaceChildren(kind === 'remote' && ACTIONS[t.action] ? fa(ACTIONS[t.action].icon) : letter);
  }
}

function tileEl(t, kind) {
  const ic = h('span', { class: 'ic' });
  paintIcon(ic, t, kind);
  const el = kind === 'link'
    ? h('a', { class: 'tile', href: t.url, title: t.url, target: linkTarget(t) })
    : h('button', { class: 'tile', type: 'button', title: ACTIONS[t.action]?.name });
  el.append(ic, h('span', { class: 'lbl' }, t.label || ''));
  return el;
}

function addTile(onclick) {
  return h('button', { class: 'tile add', type: 'button', onclick },
    h('span', { class: 'ic' }, fa('fa-solid fa-plus')), h('span', { class: 'lbl' }, 'Hinzufügen'));
}

// Drag & Drop zum Sortieren, nur im Bearbeiten-Modus.
let drag = null;
function sortable(el, list, i) {
  el.draggable = true;
  el.addEventListener('dragstart', e => { drag = { list, i }; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  el.addEventListener('dragend', () => { el.classList.remove('dragging'); drag = null; });
  el.addEventListener('dragover', e => { if (drag?.list === list) e.preventDefault(); });
  el.addEventListener('drop', e => {
    e.preventDefault();
    if (drag?.list !== list || drag.i === i) return;
    const [moved] = list.splice(drag.i, 1);
    list.splice(i, 0, moved);
    drag = null;
    save();
    smooth(render);
  });
}

function renderShortcuts() {
  const tiles = state.shortcuts.map((s, i) => {
    const el = vtName(tileEl(s, 'link'), s.id);
    el.style.setProperty('--i', i); // Reihenfolge beim Einblenden
    if (i < 9) el.title = `${s.url}  (Taste ${i + 1})`;
    if (editing) {
      el.addEventListener('click', e => { e.preventDefault(); openTileEditor('link', state.shortcuts, i); });
      sortable(el, state.shortcuts, i);
    }
    return el;
  });
  if (editing) tiles.push(addTile(() => openTileEditor('link', state.shortcuts, -1)));
  $('#shortcuts').replaceChildren(...tiles);
}

function renderPcs() {
  $('#pcs').replaceChildren(...state.pcs.map((pc, pcIndex) => {
    const buttons = pc.buttons.map((b, i) => {
      const el = vtName(tileEl(b, 'remote'), b.id);
      el.style.setProperty('--i', state.shortcuts.length + pcIndex * 3 + i);
      if (editing) {
        el.addEventListener('click', () => openTileEditor('remote', pc.buttons, i, pc));
        sortable(el, pc.buttons, i);
      } else {
        el.addEventListener('click', () => runButton(pc, b, el));
      }
      return el;
    });
    if (editing) buttons.push(addTile(() => openTileEditor('remote', pc.buttons, -1, pc)));
    const screenBtn = h('button', {
      class: 'btn small', type: 'button', title: 'Bildschirm dieses PCs in YFRemote öffnen',
      onclick: e => openScreen(pc, e.ctrlKey || e.metaKey),
    }, fa('fa-solid fa-display'), 'Bildschirm');
    const card = h('div', { class: 'pc' },
      h('div', { class: 'pc-head' },
        h('span', { class: 'dot', 'data-pc': pc.id, title: 'Status wird geprüft…' }),
        h('h3', {}, pc.name),
        h('span', { class: 'host' }, new URL(pc.url).host),
        h('span', { class: 'spacer' }),
        pc.token && !editing && h('button', {
          class: 'btn small', type: 'button', title: 'Datei an den PC schicken (oder Dateien auf diese Karte ziehen)',
          onclick: () => pickFiles(pc),
        }, fa('fa-solid fa-file-arrow-up'), 'Datei'),
        screenBtn,
        editing && h('button', { class: 'btn small', type: 'button', onclick: () => openPcEditor(pcIndex) },
          fa('fa-solid fa-pen'), 'PC bearbeiten'),
      ),
      h('div', { class: 'pc-stats', 'data-pc': pc.id }),
      h('div', { class: 'pc-media', 'data-pc': pc.id }),
      h('div', { class: 'pc-uploads', 'data-pc': pc.id }),
      !pc.token && h('p', { class: 'warn' }, 'Nicht gekoppelt – über ⚙ → „PC bearbeiten“ mit der PIN aus dem YFRemote-Tray koppeln.'),
      buttons.length ? h('div', { class: 'grid' }, buttons) : h('p', { class: 'empty' }, 'Noch keine Buttons – ⚙ drücken und „Hinzufügen“ wählen.'),
    );
    card.style.setProperty('--i', state.shortcuts.length + pcIndex * 3);
    vtName(card, 'pc-' + pc.id);
    previewOnHover(screenBtn, card, pc);
    dropFiles(card, pc);
    paintStats(card.querySelector('.pc-stats'), pcStats.get(pc.id));
    paintMedia(pc);
    return card;
  }));
  checkHealth();
}

// ---------- Live-Anzeige: Auslastung, Musik, Vorschau ----------
const pcStats = new Map(); // PC-ID -> letzte systemStats-Nachricht von YFRemote
const pcMedia = new Map(); // PC-ID -> letzte media-Nachricht (was gerade läuft)
const pcCovers = new Map(); // PC-ID -> { id, url } Albumcover als Blob-URL

// Eine offene Verbindung je PC, solange der Tab sichtbar ist (siehe yfremote-bridge.js).
async function watchPc(pc) {
  if (!pc.token || document.hidden) return;
  try { await callBridge(pc.url, { op: 'watch', token: pc.token }); } catch { /* offline */ }
}

// Ein Wert mit Balken im Hintergrund; über 85 % rot.
function meter(icon, label, percent, title) {
  const el = h('span', { class: 'meter' + (percent > 85 ? ' high' : ''), title }, fa('fa-solid ' + icon), label);
  el.style.setProperty('--v', Math.max(0, Math.min(100, percent)) + '%');
  return el;
}

function paintStats(el, st) {
  if (!el) return;
  if (!st) return void el.replaceChildren();
  const temp = t => (t != null ? `, ${t} °C` : '');
  const gb = mb => (mb / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  el.replaceChildren(...[
    st.cpuLoad != null && meter('fa-microchip', `CPU ${st.cpuLoad} %`, st.cpuLoad, `Prozessor${temp(st.cpuTemperature)}`),
    st.memoryTotalMb > 0 && meter('fa-memory', `RAM ${gb(st.memoryUsedMb)}/${gb(st.memoryTotalMb)} GB`,
      st.memoryUsedMb / st.memoryTotalMb * 100, 'Arbeitsspeicher'),
    st.gpuLoad != null && meter('fa-gauge-high', `GPU ${st.gpuLoad} %`, st.gpuLoad, `Grafikkarte${temp(st.gpuTemperature)}`),
    st.batteryLevel != null && meter(st.batteryCharging ? 'fa-plug-circle-bolt' : 'fa-battery-half',
      `Akku ${st.batteryLevel} %`, st.batteryLevel, st.batteryCharging ? 'Akku, lädt' : 'Akku'),
  ].filter(Boolean));
}

const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// Was gerade auf dem PC läuft, mit Cover und Zurück/Pause/Weiter. Baut nur neu, wenn sich Titel,
// Status oder Cover ändern; die Zeitleiste (jede Sekunde) wird nur verschoben.
function paintMedia(pc) {
  const el = document.querySelector(`.pc-media[data-pc="${pc.id}"]`);
  if (!el) return;
  const m = pcMedia.get(pc.id);
  if (!m?.title) {
    delete el.dataset.key;
    return void el.replaceChildren();
  }
  const cover = pcCovers.get(pc.id);
  const key = [m.title, m.artist, m.playing, cover?.url].join('|');
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    const control = (icon, action, title) => h('button', {
      class: 'iconbtn small', type: 'button', title,
      onclick: async e => {
        const b = e.currentTarget;
        b.classList.add('busy');
        try { await sendAction(pc, ACTIONS[action].build()); } catch (err) { toast(`${pc.name}: ${err.message}`, true); }
        b.classList.remove('busy');
      },
    }, fa('fa-solid ' + icon));
    el.replaceChildren(
      cover ? h('img', { class: 'cover', src: cover.url, alt: '' }) : h('span', { class: 'cover' }, fa('fa-solid fa-music')),
      h('span', { class: 'track' },
        h('b', { title: m.title }, m.title),
        m.artist && h('small', { title: m.artist }, m.artist),
        h('span', { class: 'bar' })),
      control('fa-backward-step', 'prev', 'Vorheriger Titel'),
      control(m.playing ? 'fa-pause' : 'fa-play', 'playPause', m.playing ? 'Pause' : 'Abspielen'),
      control('fa-forward-step', 'next', 'Nächster Titel'),
    );
  }
  const bar = el.querySelector('.bar');
  bar.hidden = !(m.duration > 0);
  bar.style.setProperty('--p', m.duration > 0 ? Math.min(100, (m.position ?? 0) / m.duration * 100) + '%' : '0%');
  bar.title = m.duration > 0 ? `${mmss(m.position ?? 0)} / ${mmss(m.duration)}` : '';
}

async function loadCover(pc, coverId) {
  const old = pcCovers.get(pc.id);
  if (old?.id === coverId) return;
  pcCovers.set(pc.id, { id: coverId, url: null }); // gegen doppeltes Laden
  let url = null;
  try {
    const cover = coverId && await callBridge(pc.url, { op: 'cover', token: pc.token });
    if (cover) url = URL.createObjectURL(new Blob([cover.data], { type: cover.type }));
  } catch { /* ohne Cover */ }
  if (old?.url) URL.revokeObjectURL(old.url);
  pcCovers.set(pc.id, { id: coverId, url });
  paintMedia(pc);
}

addEventListener('message', e => {
  if (!e.data?.yfstart || !('push' in e.data)) return;
  const pc = state.pcs.find(p => new URL(p.url).origin === e.origin);
  if (!pc) return;
  const m = e.data.push;
  if (!m) { // Verbindung zu
    pcStats.delete(pc.id);
    pcMedia.delete(pc.id);
  } else if (m.type === 'systemStats') {
    pcStats.set(pc.id, m);
  } else if (m.type === 'media') {
    pcMedia.set(pc.id, m);
    if (m.title) loadCover(pc, m.coverId ?? null);
  }
  paintStats(document.querySelector(`.pc-stats[data-pc="${pc.id}"]`), pcStats.get(pc.id));
  paintMedia(pc);
});

// Unsichtbarer Tab: Verbindung schließen, damit die PCs nicht umsonst messen. Wieder sichtbar: checkHealth verbindet neu.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return void checkHealth();
  for (const pc of state.pcs) if (bridges.has(pc.url)) callBridge(pc.url, { op: 'unwatch' }).catch(() => {});
});

// ---------- Dateien an einen PC ----------
// Landet auf dem PC im YFRemote-Empfangsordner (Standard: Dokumente\YFRemote).
const MAX_UPLOAD = 2 * 1024 ** 3; // Grenze von YFRemote (FileTransfer:MaxFileSizeBytes)

function pickFiles(pc) {
  const input = h('input', { type: 'file', multiple: true });
  input.addEventListener('change', () => sendFiles(pc, [...input.files]));
  input.click();
}

function dropFiles(card, pc) {
  if (!pc.token || editing) return;
  card.dataset.drop = `Loslassen: an ${pc.name} schicken`;
  const hasFiles = e => e.dataTransfer?.types.includes('Files');
  card.addEventListener('dragover', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    card.classList.add('drop');
  });
  card.addEventListener('dragleave', e => { if (!card.contains(e.relatedTarget)) card.classList.remove('drop'); });
  card.addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    card.classList.remove('drop');
    sendFiles(pc, [...e.dataTransfer.files]);
  });
}

async function sendFiles(pc, files) {
  for (const file of files) {
    if (file.size > MAX_UPLOAD) { toast(`${file.name} ist größer als 2 GB.`, true); continue; }
    const key = uid();
    const row = h('div', { class: 'upload' }, fa('fa-solid fa-file-arrow-up'), h('span', { class: 'name' }, file.name),
      h('span', { class: 'pct' }, '0 %'));
    const slot = () => document.querySelector(`.pc-uploads[data-pc="${pc.id}"]`);
    slot()?.append(row);
    const onProgress = e => {
      if (e.data?.upload !== key) return;
      const pct = e.data.total ? Math.round(e.data.loaded / e.data.total * 100) : 0;
      row.style.setProperty('--p', pct + '%');
      row.querySelector('.pct').textContent = pct + ' %';
    };
    addEventListener('message', onProgress);
    try {
      const saved = await callBridge(pc.url, { op: 'upload', token: pc.token, file, key }, 3600_000);
      toast(`${saved} → ${pc.name}`);
    } catch (err) {
      toast(`${file.name}: ${err.message}`, true);
    } finally {
      removeEventListener('message', onProgress);
      row.remove();
    }
  }
}

// Vorschaubild beim Überfahren von „Bildschirm“: kurz warten (nicht bei jedem Vorbeifahren), dann
// etwa jede Sekunde ein neues Standbild, solange die Maus darauf bleibt. Bewusst nicht dauerhaft:
// YFRemote zeigt am PC an, dass jemand den Bildschirm ansieht.
function previewOnHover(btn, card, pc) {
  let timer = null, pop = null;
  const stop = () => {
    clearTimeout(timer);
    pop?.remove();
    pop = null;
  };
  btn.addEventListener('mouseleave', stop);
  btn.addEventListener('click', stop);
  btn.addEventListener('mouseenter', () => {
    if (!pc.token || editing) return;
    timer = setTimeout(async function frame() {
      if (!pop) card.append(pop = h('div', { class: 'pc-preview' }, h('span', { class: 'msg' }, 'Bild wird geladen…')));
      const mine = pop;
      try {
        const buf = await callBridge(pc.url, { op: 'screen', token: pc.token, width: 640 }, 6000);
        if (pop !== mine) return;
        const img = mine.querySelector('img') ?? h('img', { alt: 'Bildschirm von ' + pc.name });
        const url = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
        img.onload = () => URL.revokeObjectURL(url);
        img.src = url;
        if (!img.isConnected) mine.replaceChildren(img);
      } catch (err) {
        if (pop !== mine) return;
        mine.replaceChildren(h('span', { class: 'msg' }, err.message));
      }
      if (pop === mine) timer = setTimeout(frame, 1000);
    }, 350);
  });
}

// ---------- Gruppen ----------
// Eigene Verknüpfungsbereiche links und rechts neben der Mitte, als kompakte Liste.
function linkRow(s) {
  const ic = h('span', { class: 'ic' });
  paintIcon(ic, s, 'link');
  return h('a', { class: 'link-row', href: s.url, title: s.url, target: linkTarget(s) }, ic, h('span', { class: 'lbl' }, s.label || ''));
}

function groupEl(g, index) {
  const rows = g.shortcuts.map((s, i) => {
    const el = vtName(linkRow(s), s.id);
    if (editing) {
      el.addEventListener('click', e => { e.preventDefault(); openTileEditor('link', g.shortcuts, i); });
      sortable(el, g.shortcuts, i);
    }
    return el;
  });
  if (editing) {
    rows.push(h('button', { class: 'link-row add', type: 'button', onclick: () => openTileEditor('link', g.shortcuts, -1) },
      h('span', { class: 'ic' }, fa('fa-solid fa-plus')), h('span', { class: 'lbl' }, 'Hinzufügen')));
  }
  const open = editing || !g.collapsed;
  const el = h('section', { class: open ? 'group' : 'group collapsed' },
    h('div', { class: 'group-head' },
      h('button', {
        class: 'group-toggle', type: 'button', 'aria-expanded': open, title: 'Ein-/Ausklappen',
        onclick: e => {
          g.collapsed = !g.collapsed;
          el.classList.toggle('collapsed', g.collapsed && !editing);
          e.currentTarget.setAttribute('aria-expanded', !el.classList.contains('collapsed'));
          save();
        },
      }, fa('fa-solid fa-chevron-down'), h('span', {}, g.name)),
      editing && h('button', { class: 'iconbtn small', type: 'button', title: 'Gruppe bearbeiten', onclick: () => openGroupEditor(g) },
        fa('fa-solid fa-pen')),
    ),
    h('div', { class: 'group-body' }, h('div', { class: 'group-list' },
      rows.length ? rows : h('p', { class: 'empty' }, 'Noch leer – ⚙ drücken und „Hinzufügen“ wählen.'))),
  );
  el.style.setProperty('--i', index);
  return vtName(el, 'group-' + g.id);
}

function renderGroups() {
  for (const side of ['left', 'right']) {
    $(`#${side}Groups`).replaceChildren(...state.groups.filter(g => g.side === side).map(groupEl));
  }
}

function render() {
  document.body.classList.toggle('editing', editing);
  $('#editbar').hidden = !editing;
  renderShortcuts();
  renderGroups();
  renderPcs();
}

// ---------- YFRemote ----------
// YFRemote verlangt bei POST /pair und /ws einen Origin-Header mit der Adresse des PCs. Deshalb
// laufen diese Anfragen über yfremote-bridge.js in einem unsichtbaren iframe auf <PC>/health.
const bridges = new Map(); // PC-Adresse -> Promise<iframe>

// Zugriff auf einen PC verlangt die Extension erst beim ersten Koppeln/Steuern
// (optional_host_permissions) statt bei der Installation für alle Webseiten. Mit dem Zugriff werden
// die beiden Scripts für diesen PC angemeldet. Braucht einen Klick des Nutzers, wenn Chrome fragen muss.
const hostPattern = url => { const u = new URL(url); return `${u.protocol}//${u.hostname}/*`; };

async function ensureHostAccess(url) {
  if (!hasExt) return;
  const pattern = hostPattern(url);
  const granted = await chrome.permissions.contains({ origins: [pattern] })
    || await chrome.permissions.request({ origins: [pattern] });
  if (!granted) throw new Error('Ohne Zugriff auf den PC geht es nicht – bitte in Chrome erlauben.');
  await registerForHost('yfstart-bridge', pattern.replace(/\*$/, 'health'),
    { js: ['yfremote-bridge.js'], allFrames: true, runAt: 'document_start' });
  // fullscreen-flag.js wirkt nur, wenn background.js den Client mit #yfstart-fullscreen öffnet.
  await registerForHost('yfstart-fullscreen', pattern, { js: ['fullscreen-flag.js'], runAt: 'document_start', world: 'MAIN' });
}

async function registerForHost(id, match, options) {
  const [existing] = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (existing?.matches.includes(match)) return;
  const script = { id, matches: [...(existing?.matches ?? []), match], ...options };
  await (existing ? chrome.scripting.updateContentScripts([script]) : chrome.scripting.registerContentScripts([script]));
}

function bridgeFrame(origin) {
  if (!bridges.has(origin)) {
    bridges.set(origin, new Promise(resolve => {
      const frame = h('iframe', { src: origin + '/health', hidden: true });
      frame.addEventListener('load', () => resolve(frame), { once: true });
      document.body.append(frame);
    }));
  }
  return bridges.get(origin);
}

async function callBridge(origin, payload, timeoutMs = 8000) {
  await ensureHostAccess(origin);
  const frame = await bridgeFrame(origin);
  const id = uid();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      // Kein Content-Script geantwortet: PC war beim Laden nicht erreichbar. Frame neu laden lassen.
      removeEventListener('message', onMessage);
      frame.remove();
      bridges.delete(origin);
      reject(new Error('PC nicht erreichbar. Läuft YFRemote, und stimmt die Adresse (Port 5050)?'));
    }, timeoutMs);
    function onMessage(e) {
      if (e.origin !== origin || !e.data?.yfstart || e.data.id !== id) return;
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
    }
    addEventListener('message', onMessage);
    frame.contentWindow.postMessage({ yfstart: true, id, ...payload }, origin);
  });
}

async function checkHealth() {
  await Promise.all(state.pcs.map(async pc => {
    const dot = document.querySelector(`.dot[data-pc="${pc.id}"]`);
    if (hasExt && !await chrome.permissions.contains({ origins: [hostPattern(pc.url)] })) {
      if (dot) Object.assign(dot, { className: 'dot', title: 'Zugriff auf den PC noch nicht erlaubt' });
      // Chrome fragt nur nach einem Klick. Eigener Knopf, damit dafür keine Aktion am PC nötig ist.
      const slot = document.querySelector(`.pc-stats[data-pc="${pc.id}"]`);
      if (slot && pc.token) {
        slot.replaceChildren(h('button', {
          class: 'btn small', type: 'button',
          onclick: async () => {
            try { await ensureHostAccess(pc.url); checkHealth(); } catch (err) { toast(err.message, true); }
          },
        }, fa('fa-solid fa-plug'), 'Verbindung erlauben (Status und Auslastung)'));
      }
      return;
    }
    let online = false;
    try {
      const res = await fetch(new URL('/health', pc.url), { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      online = res.ok;
    } catch { /* offline */ }
    if (online) watchPc(pc);
    if (!dot) return;
    dot.className = 'dot ' + (online ? 'on' : 'off');
    dot.title = online ? 'Online' : 'Nicht erreichbar';
  }));
}

function sendAction(pc, message) {
  return callBridge(pc.url, { op: 'action', token: pc.token, message });
}

// Erledigt background.js: YFRemote-Client öffnen und auf den Bildschirm-Tab schalten.
async function openScreen(pc, forceNewTab = false) {
  if (!hasExt) return void (location.href = pc.url + '/');
  try {
    await ensureHostAccess(pc.url);
  } catch (err) {
    return toast(err.message, true);
  }
  const newTab = forceNewTab || state.design.screenIn === 'new';
  chrome.runtime.sendMessage({ type: 'openScreen', url: pc.url + '/', token: pc.token, newTab });
}

async function runButton(pc, b, el) {
  const action = ACTIONS[b.action];
  if (!action) return toast('Unbekannte Aktion.', true);
  if (!pc.token) return toast(`${pc.name} ist nicht gekoppelt.`, true);
  if (b.confirm && !confirm(`${action.name} auf „${pc.name}“ ausführen?`)) return;
  el.classList.add('busy');
  try {
    await sendAction(pc, action.build(b.param ?? ''));
    toast(`${b.label || action.name} → ${pc.name} ✓`);
  } catch (err) {
    toast(`${pc.name}: ${err.message}`, true);
  } finally {
    el.classList.remove('busy');
  }
}

// ---------- Kachel-Editor ----------
const tileDlg = $('#tileDlg');
const tf = $('#tileForm');
// { kind, list, index, mode: 'auto'|'fa'|'text'|'image', faIcon, image }
let tileCtx = null;

tf.action.append(...Object.entries(ACTIONS).map(([k, a]) => h('option', { value: k }, a.name)));

function tileFromForm() {
  const { mode, faIcon, image } = tileCtx;
  return {
    label: tf.label.value.trim(),
    url: normalizeLink(tf.url.value) || tf.url.value.trim(),
    action: tf.action.value,
    param: tf.param.value,
    confirm: tf.confirm.checked,
    icon: mode === 'fa' && faIcon ? 'fa:' + faIcon
      : mode === 'text' ? tf.iconText.value.trim()
      : mode === 'image' && !image ? tf.iconUrl.value.trim()
      : '',
    image: mode === 'image' ? image : null,
    imageFill: tf.imageFill.checked,
    color: tf.color.value,
    fg: tf.fg.value,
    autoFg: tf.autoFg.checked,
    openIn: tf.openIn.value,
  };
}

function updateTileForm() {
  const { kind, mode } = tileCtx;
  tf.querySelectorAll('[data-kind]').forEach(el => (el.hidden = el.dataset.kind !== kind));
  const action = ACTIONS[tf.action.value];
  $('#paramRow').hidden = kind !== 'remote' || !action.param;
  $('#paramLabel').textContent = action.param || '';
  tf.fg.disabled = tf.autoFg.checked;
  $('#iconModes').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  tf.querySelectorAll('[data-pane]').forEach(p => (p.hidden = p.dataset.pane !== mode));
  $('#autoModeLabel').textContent = kind === 'link' ? 'Website' : 'Automatisch';
  $('#autoHint').textContent = kind === 'link'
    ? 'Nimmt das Icon der Website (Favicon) – passt sich an, wenn die Website ihr Logo ändert.'
    : 'Nimmt das passende Symbol zur gewählten Aktion.';
  $('#preview').replaceChildren(tileEl(tileFromForm(), kind));
  if (mode === 'fa') renderFaSuggestions();
}

function openTileEditor(kind, list, index, pc) {
  const isNew = index < 0;
  const t = isNew
    ? (kind === 'link'
      ? { label: '', url: '', color: '#ffffff', autoFg: true }
      : { label: '', action: 'lock', param: '', color: '#2b5cd6', autoFg: true })
    : list[index];
  const icon = (t.icon || '').trim();
  const mode = icon.startsWith('fa:') ? 'fa'
    : t.image || /^(https?:|data:image\/)/i.test(icon) ? 'image'
    : icon ? 'text' : 'auto';
  tileCtx = { kind, list, index, mode, faIcon: mode === 'fa' ? icon.slice(3) : null, image: t.image || null };
  $('#tileTitle').textContent = (isNew ? 'Neuer ' : '') + (kind === 'link' ? 'Shortcut' : `Button für ${pc.name}`);
  tf.label.value = t.label || '';
  tf.url.value = t.url || '';
  tf.action.value = t.action || 'lock';
  tf.param.value = t.param || '';
  tf.confirm.checked = !!(t.confirm ?? ACTIONS[tf.action.value].confirm);
  tf.iconText.value = mode === 'text' ? icon : '';
  tf.iconUrl.value = mode === 'image' && !t.image ? icon : '';
  tf.imageFill.checked = !!t.imageFill;
  tf.color.value = t.color || '#ffffff';
  tf.fg.value = t.fg || '#ffffff';
  tf.autoFg.checked = t.autoFg !== false;
  tf.openIn.value = t.openIn || '';
  // Bereich: Hauptbereich oder eine der Gruppen; beim Speichern wird die Verknüpfung dorthin verschoben.
  tf.group.replaceChildren(h('option', { value: '' }, 'Hauptbereich'),
    ...state.groups.map(g => h('option', { value: g.id }, `${g.name} (${g.side === 'left' ? 'links' : 'rechts'})`)));
  tf.group.value = state.groups.find(g => g.shortcuts === list)?.id ?? '';
  $('#faSearch').value = '';
  $('#tileDelete').hidden = isNew;
  updateTileForm();
  tileDlg.showModal();
  tf.label.focus();
  loadFaIcons().then(() => { if (tileCtx.mode === 'fa') { renderFaSuggestions(); renderFaGrid(); } });
}

tf.addEventListener('input', e => { if (e.target.id !== 'faSearch') updateTileForm(); });
tf.action.addEventListener('change', () => {
  tf.confirm.checked = !!ACTIONS[tf.action.value].confirm;
  tf.param.value = '';
  updateTileForm();
});
$('#iconModes').addEventListener('click', e => {
  const b = e.target.closest('button[data-mode]');
  if (!b) return;
  tileCtx.mode = b.dataset.mode;
  updateTileForm();
  if (tileCtx.mode === 'fa') loadFaIcons().then(() => { renderFaSuggestions(); renderFaGrid(); });
});
tf.iconUrl.addEventListener('input', () => { tileCtx.image = null; });
$('#iconUpload').addEventListener('click', () => $('#iconFile').click());
$('#iconFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    tileCtx.image = await shrinkImage(file, 128, 'image/png');
    tf.iconUrl.value = '';
    updateTileForm();
  } catch {
    toast('Bild konnte nicht gelesen werden.', true);
  }
});

// Hochgeladene Bilder verkleinern, damit der Speicher klein bleibt.
async function shrinkImage(file, maxSize, type, quality) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
    const c = h('canvas', { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL(type, quality);
  } catch {
    if (file.size > 300_000) throw new Error('too big');
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
}

// ---------- Font-Awesome-Auswahl ----------
// vendor/fontawesome/icons.json: [name, Stile (s=solid, r=regular, b=brands), Suchbegriffe]
let faIcons = null;
const loadFaIcons = () => (faIcons ??= fetch('vendor/fontawesome/icons.json').then(r => r.json()).then(list => (faList = list)).catch(() => []));
let faList = []; // geladene Liste, sobald loadFaIcons fertig ist
const faClass = ([name, styles]) => `${styles.includes('s') ? 'fa-solid' : styles.includes('b') ? 'fa-brands' : 'fa-regular'} fa-${name}`;

// Markenfarben, damit z. B. das YouTube-Icon gleich auf Rot sitzt.
const BRAND_COLORS = {
  youtube: '#ff0000', github: '#181717', spotify: '#1db954', twitch: '#9146ff', discord: '#5865f2', reddit: '#ff4500',
  'x-twitter': '#000000', instagram: '#e4405f', facebook: '#1877f2', linkedin: '#0a66c2', whatsapp: '#25d366',
  amazon: '#ff9900', steam: '#171a21', paypal: '#003087', google: '#4285f4', 'google-drive': '#1fa463',
  'wikipedia-w': '#000000', apple: '#000000', microsoft: '#00a4ef', telegram: '#26a5e4', pinterest: '#e60023',
  tiktok: '#000000', dropbox: '#0061ff', slack: '#4a154b', trello: '#0052cc', figma: '#f24e1e',
  'stack-overflow': '#f58025', gitlab: '#fc6d26', docker: '#2496ed', npm: '#cb3837', python: '#3776ab',
  chrome: '#4285f4', firefox: '#ff7139', soundcloud: '#ff5500', vimeo: '#1ab7ea', ebay: '#e53238',
  claude: '#d97757', openai: '#000000', playstation: '#003791', xbox: '#107c10', mastodon: '#6364ff',
  bluesky: '#1185fe', threads: '#000000', snapchat: '#fffc00', 'google-play': '#01875f', airbnb: '#ff5a5f',
  dribbble: '#ea4c89', behance: '#1769ff', medium: '#000000', patreon: '#ff424d', notion: '#000000',
};

// Begriffe in Adresse oder Name -> passende allgemeine Icons
const KEYWORD_ICONS = [
  [/mail|gmx|web\.de|outlook|posteo|proton/, ['envelope', 'inbox']],
  [/news|zeitung|spiegel|tagesschau|heise|golem|zeit\.de|faz|sz\.de/, ['newspaper', 'rss']],
  [/shop|amazon|ebay|otto|zalando|kaufland|idealo|aliexpress/, ['cart-shopping', 'bag-shopping', 'store']],
  [/bank|sparkasse|volksbank|paypal|finanz|depot|trade|n26|dkb|ing\./, ['building-columns', 'wallet', 'euro-sign']],
  [/map|karte|route|bahn|db\.de|navi/, ['map-location-dot', 'train', 'route']],
  [/music|musik|spotify|soundcloud|radio|deezer/, ['music', 'headphones']],
  [/video|film|netflix|prime|disney|kino|joyn|ard|zdf|serie|youtube/, ['film', 'tv', 'clapperboard']],
  [/drive|cloud|dropbox|onedrive|nextcloud/, ['cloud', 'folder-open']],
  [/calendar|kalender|termin/, ['calendar-days']],
  [/chat|whatsapp|telegram|discord|teams|signal|slack/, ['comments', 'message']],
  [/docs|notion|wiki|confluence|obsidian/, ['file-lines', 'book']],
  [/game|spiel|steam|epic|xbox|playstation|nintendo/, ['gamepad', 'dice']],
  [/weather|wetter/, ['cloud-sun', 'umbrella']],
  [/learn|uni|schule|moodle|ilias|kurs/, ['graduation-cap', 'book-open']],
  [/code|dev|stack|git|localhost|api/, ['code', 'terminal', 'bug']],
  [/\bai\b|claude|gpt|gemini|copilot|perplexity|chat/, ['robot', 'wand-magic-sparkles', 'brain']],
  [/photo|foto|bilder|instagram|flickr/, ['camera', 'image']],
  [/home|haus|smart|router|fritz|nas|server/, ['house', 'server', 'network-wired']],
  [/sport|fitness|strava|kicker/, ['dumbbell', 'futbol']],
  [/rezept|chefkoch|food|essen|lieferando/, ['utensils', 'pizza-slice']],
  [/job|arbeit|work|linkedin|xing/, ['briefcase']],
];
const ACTION_ICONS = {
  lock: ['lock', 'user-lock', 'shield-halved'], sleep: ['moon', 'bed'], displayOff: ['display', 'tv', 'eye-slash'],
  shutdown: ['power-off', 'plug'], restart: ['rotate-right', 'arrows-rotate'], playPause: ['play', 'pause', 'circle-play'],
  next: ['forward-step', 'forward'], prev: ['backward-step', 'backward'], mute: ['volume-xmark', 'volume-off'],
  volUp: ['volume-high', 'plus'], volDown: ['volume-low', 'minus'], volume: ['sliders', 'volume-high'],
  hotkey: ['keyboard', 'desktop', 'window-maximize'], text: ['i-cursor', 'pen', 'keyboard'],
  openUrl: ['globe', 'link'], openApp: ['rocket', 'window-restore', 'gamepad', 'code'],
};
const GENERAL_ICONS = ['globe', 'star', 'bookmark', 'heart', 'house', 'link', 'bolt', 'briefcase'];
// Ohne Suchbegriff zeigt die Auswahl diese Icons statt der alphabetischen Liste (die mit 0-9, A-Z beginnt).
const POPULAR_ICONS = [
  'house', 'star', 'heart', 'bookmark', 'globe', 'link', 'envelope', 'inbox', 'calendar-days', 'clock', 'bell',
  'magnifying-glass', 'gear', 'user', 'users', 'comments', 'message', 'phone', 'video', 'camera', 'image', 'music',
  'headphones', 'film', 'tv', 'gamepad', 'dice', 'book', 'book-open', 'newspaper', 'file-lines', 'folder-open',
  'cloud', 'cloud-sun', 'umbrella', 'map-location-dot', 'location-dot', 'car', 'train', 'plane', 'bicycle',
  'cart-shopping', 'bag-shopping', 'store', 'credit-card', 'wallet', 'building-columns', 'euro-sign', 'chart-line',
  'briefcase', 'graduation-cap', 'code', 'terminal', 'bug', 'server', 'database', 'network-wired', 'wifi',
  'desktop', 'laptop', 'mobile-screen', 'display', 'keyboard', 'robot', 'brain', 'wand-magic-sparkles', 'bolt',
  'fire', 'leaf', 'sun', 'moon', 'mug-hot', 'utensils', 'pizza-slice', 'dumbbell', 'futbol', 'paw', 'gift',
  'lightbulb', 'lock', 'shield-halved', 'key', 'power-off', 'rocket', 'flag', 'trophy', 'crown', 'pen', 'palette',
];

function faSuggestions() {
  const solid = name => 'fa-solid fa-' + name;
  const list = [];
  const { kind } = tileCtx;
  const url = kind === 'link' ? tf.url.value : tf.action.value === 'openUrl' ? tf.param.value : '';
  // Marken aus Adresse und Name, z. B. open.spotify.com -> spotify
  let host = '';
  try { host = new URL(normalizeLink(url) || 'x:').hostname; } catch { /* keine Adresse */ }
  const words = [...host.split('.').slice(0, -1), ...tf.label.value.toLowerCase().split(/[^a-z0-9]+/)]
    .filter(w => w.length > 1 && w !== 'www');
  const flat = s => s.replace(/-/g, '');
  for (const [name, styles] of faList) {
    if (!styles.includes('b')) continue;
    if (words.some(w => flat(name) === flat(w) || name.startsWith(w + '-'))) list.push('fa-brands fa-' + name);
  }
  const text = (host + ' ' + tf.label.value).toLowerCase();
  if (kind === 'remote') list.push(...(ACTION_ICONS[tf.action.value] || []).map(solid));
  for (const [re, names] of KEYWORD_ICONS) if (re.test(text)) list.push(...names.map(solid));
  list.push(...GENERAL_ICONS.map(solid));
  return [...new Set(list)].slice(0, 18);
}

function faButton(cls) {
  return h('button', {
    type: 'button', title: cls.replace(/fa-(solid|regular|brands) fa-/, ''), 'aria-pressed': tileCtx.faIcon === cls,
    onclick: () => pickFa(cls),
  }, fa(cls));
}

function pickFa(cls) {
  tileCtx.faIcon = cls;
  const brand = cls.startsWith('fa-brands') && BRAND_COLORS[cls.slice('fa-brands fa-'.length)];
  if (brand) { tf.color.value = brand; tf.autoFg.checked = true; }
  updateTileForm();
  renderFaGrid();
}

function renderFaSuggestions() {
  $('#faSuggest').replaceChildren(...faSuggestions().map(faButton));
}

function renderFaGrid() {
  const query = $('#faSearch').value.trim().toLowerCase();
  const matches = query
    ? faList.filter(([name, , terms]) => name.includes(query) || terms.includes(query))
      .sort((a, b) => b[0].startsWith(query) - a[0].startsWith(query))
    : POPULAR_ICONS.map(name => [name, 's']);
  $('#faGrid').replaceChildren(...matches.slice(0, 240).map(entry => faButton(faClass(entry))));
}
$('#faSearch').addEventListener('input', () => renderFaGrid());

tf.addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const t = tileFromForm();
  const { kind, list, index } = tileCtx;
  if (kind === 'link') {
    t.url = normalizeLink(tf.url.value);
    if (!t.url) { e.preventDefault(); return toast('Bitte eine gültige URL angeben.', true); }
    if (!t.label) t.label = new URL(t.url).hostname.replace(/^www\./, '');
    delete t.action; delete t.param; delete t.confirm;
  } else {
    try { ACTIONS[t.action].build(t.param); } catch (err) { e.preventDefault(); return toast(err.message, true); }
    if (!t.label) t.label = ACTIONS[t.action].name;
    delete t.url; delete t.openIn;
  }
  const target = kind === 'link' ? (state.groups.find(g => g.id === tf.group.value)?.shortcuts ?? state.shortcuts) : list;
  const item = index < 0 ? { id: uid(), ...t } : { ...list[index], ...t };
  if (target === list && index >= 0) list[index] = item;
  else {
    if (index >= 0) list.splice(index, 1);
    target.push(item);
  }
  save();
  smooth(render);
});

$('#tileDelete').addEventListener('click', () => {
  const { list, index } = tileCtx;
  if (!confirm(`„${list[index].label}“ löschen?`)) return;
  list.splice(index, 1);
  tileDlg.close();
  save();
  smooth(render);
});

// ---------- PC-Editor ----------
const pcDlg = $('#pcDlg');
const pf = $('#pcForm');
let pcCtx = null; // { index, draft }

function openPcEditor(index) {
  const draft = index >= 0 ? { ...state.pcs[index] } : { id: uid(), name: '', url: '', token: null, buttons: [] };
  pcCtx = { index, draft };
  pf.name.value = draft.name;
  pf.url.value = draft.url;
  pf.pin.value = '';
  $('#pcDelete').hidden = index < 0;
  setPairStatus(draft.token ? 'Gekoppelt ✓ – eine PIN ist nur zum erneuten Koppeln nötig.' : 'Noch nicht gekoppelt.');
  pcDlg.showModal();
  pf.name.focus();
}

function setPairStatus(text) { $('#pairStatus').textContent = text; }

$('#pairBtn').addEventListener('click', async () => {
  const url = normalizePcUrl(pf.url.value);
  const pin = pf.pin.value.trim();
  if (!url) return setPairStatus('Bitte zuerst eine gültige Adresse eingeben.');
  if (!/^\d{6}$/.test(pin)) return setPairStatus('Die PIN hat 6 Ziffern (YFRemote-Tray → PIN).');
  pf.url.value = url;
  setPairStatus('Kopple…');
  try {
    const { status, text } = await callBridge(url, { op: 'pair', pin, deviceName: 'YFStart (Chrome)' });
    let body = null;
    try { body = JSON.parse(text); } catch { /* kein JSON, z. B. "Origin not allowed." */ }
    if (body?.success && body.token) {
      pcCtx.draft.token = body.token;
      pcCtx.draft.url = url;
      pf.pin.value = '';
      setPairStatus('Gekoppelt ✓ – jetzt speichern.');
    } else {
      setPairStatus('Koppeln fehlgeschlagen: ' + (body?.error || text || `HTTP ${status}`));
    }
  } catch (err) {
    setPairStatus(err.message);
  }
});

pf.addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const url = normalizePcUrl(pf.url.value);
  if (!url) { e.preventDefault(); return setPairStatus('Bitte eine gültige Adresse eingeben, z. B. 192.168.178.20:5050'); }
  const { index, draft } = pcCtx;
  if (draft.token && draft.url && draft.url !== url) draft.token = null; // anderer PC -> neu koppeln
  Object.assign(draft, { name: pf.name.value.trim(), url });
  if (index < 0) state.pcs.push(draft);
  else state.pcs[index] = draft;
  save();
  render();
});

$('#pcDelete').addEventListener('click', async () => {
  const { index } = pcCtx;
  const pc = state.pcs[index];
  if (!confirm(`PC „${pc.name}“ mit allen Buttons entfernen?`)) return;
  if (pc.token) {
    // Kopplung auch auf dem PC aufheben; klappt das nicht (PC aus), bleibt sie dort bis zum Ablauf bestehen.
    callBridge(pc.url, { op: 'unpair', token: pc.token }).catch(() => {});
  }
  state.pcs.splice(index, 1);
  pcDlg.close();
  await save();
  render();
});

// ---------- Bearbeiten, Export, Import ----------
function setEditing(on) { smooth(() => { editing = on; render(); }); }
$('#editBtn').addEventListener('click', () => setEditing(!editing));
$('#doneBtn').addEventListener('click', () => setEditing(false));
$('#addShortcut').addEventListener('click', () => openTileEditor('link', state.shortcuts, -1));
$('#addPc').addEventListener('click', () => openPcEditor(-1));

$('#exportBtn').addEventListener('click', () => {
  // Normal ohne Kopplungs-Tokens: wer die Datei hat, soll die PCs nicht steuern können.
  // Mit Tokens nur auf Nachfrage, z. B. zum Umziehen auf eine neue Installation der Extension.
  const withTokens = state.pcs.some(pc => pc.token) && confirm('Kopplungen mit exportieren?\n\n'
    + 'Nur für einen Umzug, damit du die PCs nicht neu koppeln musst. Wer die Datei hat, kann deine PCs steuern: '
    + 'danach löschen.\n\nOK: mit Kopplungen. Abbrechen: ohne.');
  const data = {
    shortcuts: state.shortcuts, groups: state.groups, weather: state.weather, design: state.design,
    pcs: withTokens ? state.pcs : state.pcs.map(({ token, ...pc }) => pc),
  };
  const a = h('a', {
    href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })),
    download: 'yfstart-backup.json',
  });
  a.click();
  URL.revokeObjectURL(a.href);
  toast(withTokens ? 'Exportiert, mit Kopplungen. Datei nach dem Import löschen.'
    : 'Exportiert (ohne Kopplungen – PCs nach dem Import neu koppeln).');
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.shortcuts) || !Array.isArray(data.pcs)) throw new Error();
    if (!confirm('Aktuelle Shortcuts und PCs durch die Datei ersetzen?')) return;
    state.shortcuts = data.shortcuts;
    state.groups = Array.isArray(data.groups) ? data.groups : [];
    state.pcs = data.pcs.map(pc => ({
      ...pc, token: typeof pc.token === 'string' ? pc.token : null, buttons: Array.isArray(pc.buttons) ? pc.buttons : [],
    }));
    if (data.weather) state.weather = data.weather;
    if (data.design) applyDesign(state.design = { ...DEFAULT_DESIGN, ...data.design });
    await save();
    render();
    renderWeather();
    toast('Importiert.');
  } catch {
    toast('Datei ist kein gültiges YFStart-Backup.', true);
  }
});

// ---------- Start ----------
document.querySelectorAll('#editbar .btn').forEach((b, n) => b.style.setProperty('--n', n));
tick();
setInterval(tick, 1000);
load().then(() => {
  render();
  tick();
  setTimeout(() => document.body.classList.remove('intro'), 1500); // Einblenden nur beim Öffnen
  setInterval(checkHealth, 30_000);
  renderWeather();
  setInterval(renderWeather, 15 * 60_000);
  checkForUpdate();
  // Neue Installation (oder neue Extension-ID nach dem Update auf feste ID): zeigen, wie die Daten zurückkommen.
  if (firstRun) toast('Neu hier? Eigene Daten über ⚙ → Importieren holen oder in ⚙ → Einstellungen Sync einschalten.', false, 9000);
});

// ---------- Wetter ----------
// Open-Meteo: kostenlos, ohne API-Schlüssel, erlaubt Abrufe von jeder Seite (CORS).
// Wetterdaten höchstens alle 30 Minuten neu holen, nicht bei jedem neuen Tab.
const WEATHER_CODES = [ // WMO-Code -> Font-Awesome-Icon, Farbklasse, Text
  [[0], 'sun', 'w-sun', 'Klar'], [[1], 'cloud-sun', 'w-cloud', 'Überwiegend klar'],
  [[2], 'cloud-sun', 'w-cloud', 'Teilweise bewölkt'], [[3], 'cloud', 'w-cloud', 'Bewölkt'],
  [[45, 48], 'smog', 'w-fog', 'Nebel'], [[51, 53, 55, 56, 57], 'cloud-rain', 'w-rain', 'Nieselregen'],
  [[61, 63, 65, 66, 67], 'cloud-showers-heavy', 'w-rain', 'Regen'], [[71, 73, 75, 77], 'snowflake', 'w-snow', 'Schnee'],
  [[80, 81, 82], 'cloud-sun-rain', 'w-rain', 'Regenschauer'], [[85, 86], 'snowflake', 'w-snow', 'Schneeschauer'],
  [[95, 96, 99], 'cloud-bolt', 'w-storm', 'Gewitter'],
];

async function renderWeather() {
  const el = $('#weather');
  const w = state.weather;
  if (!w.enabled || w.lat == null) return void (el.hidden = true);
  let { weatherCache: cache } = await storage.get(['weatherCache']);
  // Ohne daily.weather_code: Cache von vor der Vorhersage, neu holen.
  const fresh = cache && cache.lat === w.lat && cache.lon === w.lon && !!cache.data.daily.weather_code;
  if (!fresh || Date.now() - cache.at > 30 * 60_000) {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?timezone=auto&forecast_days=6'
        + `&latitude=${w.lat}&longitude=${w.lon}&current=temperature_2m,weather_code,is_day`
        + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
      if (!res.ok) throw new Error();
      cache = { at: Date.now(), lat: w.lat, lon: w.lon, data: await res.json() };
      await storage.set({ weatherCache: cache });
    } catch {
      if (!fresh) return void (el.hidden = true); // offline: sonst den letzten Stand zeigen
    }
  }
  const { current, daily } = cache.data;
  const weatherOf = code => WEATHER_CODES.find(([codes]) => codes.includes(code)) ?? [, 'temperature-half', 'w-cloud', ''];
  let [, icon, tone, text] = weatherOf(current.weather_code);
  if (!current.is_day && current.weather_code <= 2) [icon, tone] = [current.weather_code ? 'cloud-moon' : 'moon', 'w-moon'];
  const max = Math.round(daily.temperature_2m_max[0]), min = Math.round(daily.temperature_2m_min[0]);
  el.href = 'https://www.google.com/search?q=' + encodeURIComponent('Wetter ' + w.name);
  el.title = `Aktualisiert ${new Date(cache.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  el.replaceChildren(
    h('span', { class: 'w-icon' }, fa(`fa-solid fa-${icon} ${tone}`)),
    h('span', { class: 'w-temp' }, `${Math.round(current.temperature_2m)}°`),
    h('span', {}, [w.name, text, `↑ ${max}°  ↓ ${min}°`].filter(Boolean).join(' · ')),
    // Vorhersage: erscheint beim Überfahren (CSS)
    h('span', { class: 'w-forecast' }, h('span', { class: 'w-days' }, daily.time.map((day, i) => {
      const [, dIcon, dTone, dText] = weatherOf(daily.weather_code[i]);
      const rain = daily.precipitation_probability_max?.[i];
      return h('span', { class: 'w-day', title: dText },
        h('span', { class: 'w-name' }, i === 0 ? 'Heute' : i === 1 ? 'Morgen'
          : new Date(day + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')),
        fa(`fa-solid fa-${dIcon} ${dTone}`),
        h('span', { class: 'w-max' }, `${Math.round(daily.temperature_2m_max[i])}°`),
        h('span', { class: 'w-min' }, `${Math.round(daily.temperature_2m_min[i])}°`),
        h('span', { class: 'w-rainp' }, rain ? [fa('fa-solid fa-droplet'), ` ${rain} %`] : ''));
    }))),
  );
  el.hidden = false;
}

const weatherDlg = $('#weatherDlg');
const wf = $('#weatherForm');
let placeDraft = null; // { name, lat, lon } aus der Ortssuche

async function findPlace(query) {
  const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name='
    + encodeURIComponent(query));
  const place = (await res.json()).results?.[0];
  if (!place) throw new Error(`Kein Ort „${query}“ gefunden.`);
  $('#placeStatus').textContent = 'Gefunden: ' + [place.name, place.admin1, place.country].filter(Boolean).join(', ');
  return { name: place.name, lat: place.latitude, lon: place.longitude };
}

$('#weatherBtn').addEventListener('click', () => {
  placeDraft = null;
  wf.enabled.checked = state.weather.enabled;
  wf.place.value = state.weather.name;
  $('#placeStatus').textContent = state.weather.name ? '' : 'Ort eingeben und „Suchen“ klicken.';
  weatherDlg.showModal();
});

$('#placeSearch').addEventListener('click', async () => {
  try {
    placeDraft = await findPlace(wf.place.value.trim());
    wf.place.value = placeDraft.name;
  } catch (err) {
    $('#placeStatus').textContent = err.message.startsWith('Kein Ort') ? err.message : 'Ortssuche nicht erreichbar.';
  }
});

wf.addEventListener('submit', async e => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault(); // erst schließen, wenn der Ort feststeht
  const query = wf.place.value.trim();
  let place = [placeDraft, state.weather].find(p => p?.lat != null && p.name === query) ?? null;
  if (!place && query) {
    try { place = await findPlace(query); } catch (err) { return void ($('#placeStatus').textContent = err.message); }
  }
  if (wf.enabled.checked && !place) return void ($('#placeStatus').textContent = 'Bitte einen Ort eingeben.');
  state.weather = { enabled: wf.enabled.checked, name: place?.name ?? '', lat: place?.lat ?? null, lon: place?.lon ?? null };
  weatherDlg.close();
  await save();
  renderWeather();
});

// ---------- Update-Hinweis ----------
// YFStart wird per git verteilt. Liegt auf GitHub eine höhere Version im Manifest, zeigt die Seite
// einen Hinweis. Höchstens alle 6 Stunden nachsehen, nicht bei jedem neuen Tab.
const MANIFEST_URL = 'https://raw.githubusercontent.com/YannikFroehlich/YFStart/main/manifest.json';

const isNewer = (a, b) => {
  const [x, y] = [a, b].map(v => String(v).split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
};

async function checkForUpdate() {
  if (!hasExt) return;
  const current = chrome.runtime.getManifest().version;
  let { updateCheck } = await storage.get(['updateCheck']);
  if (!updateCheck || Date.now() - updateCheck.at > 6 * 3600_000) {
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
      updateCheck = { at: Date.now(), latest: (await res.json()).version };
      await storage.set({ updateCheck });
    } catch { return; /* offline */ }
  }
  if (!isNewer(updateCheck.latest, current)) return;
  const box = $('#update');
  box.replaceChildren(
    h('span', {}, `Update ${updateCheck.latest} verfügbar: im YFStart-Ordner `, h('code', {}, 'git pull'), ' ausführen, dann'),
    h('button', { class: 'btn small', type: 'button', onclick: () => chrome.runtime.reload() }, 'Neu laden'),
  );
  box.hidden = false;
}

// Abbrechen-Buttons sind type="button", damit Enter im Formular speichert statt abbricht.
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

// ---------- Design-Dialog ----------
// Jede Änderung wirkt sofort als Vorschau. Abbrechen (auch Esc) stellt den Stand von vorher wieder her.
const designDlg = $('#designDlg');
const df = $('#designForm');
let designBefore = null;

function syncDesignForm() {
  const d = state.design;
  $('#themes').querySelectorAll('.theme-card').forEach(c => c.setAttribute('aria-pressed', c.dataset.theme === d.theme));
  df.ownAccent.checked = !!d.accent;
  df.accent.disabled = !d.accent;
  df.accent.value = d.accent || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1a73e8';
  df.bgDim.value = d.bgDim;
  df.bgDim.disabled = !d.bgImage;
  $('#bgClear').disabled = !d.bgImage;
  for (const [seg, key] of [['#sizeSeg', 'size'], ['#shapeSeg', 'shape'], ['#tilesSeg', 'tiles'], ['#openSeg', 'openIn'], ['#screenSeg', 'screenIn']]) {
    $(seg).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.value === d[key]));
  }
  df.animations.checked = d.animations;
  df.greeting.checked = d.greeting;
  df.name.value = d.name;
  df.name.disabled = !d.greeting;
  df.sync.checked = syncOn;
}

function changeDesign(patch) {
  Object.assign(state.design, patch);
  // Design, Größe und Form blenden weich über; Regler (Abdunkeln, Farbe) sofort, sonst ruckelt das Ziehen.
  const instant = 'bgDim' in patch || 'accent' in patch;
  (instant ? f => f() : smooth)(() => {
    applyDesign(state.design);
    if ('openIn' in patch) render(); // Shortcuts übernehmen die neue Öffnen-Einstellung
  });
  syncDesignForm();
  tick();
}

$('#themes').append(...THEMES.map(([id, name, preview, colors]) => h('button', {
  type: 'button', class: 'theme-card', 'data-theme': id, onclick: () => changeDesign({ theme: id }),
}, h('span', { class: 'sw', style: `background:${preview}` }, colors.map(c => h('span', { style: `background:${c}` }))),
  h('span', { class: 'nm' }, name))));

for (const [seg, key] of [['#sizeSeg', 'size'], ['#shapeSeg', 'shape'], ['#tilesSeg', 'tiles'], ['#openSeg', 'openIn'], ['#screenSeg', 'screenIn']]) {
  $(seg).addEventListener('click', e => {
    const b = e.target.closest('button[data-value]');
    if (b) changeDesign({ [key]: b.dataset.value });
  });
}
df.ownAccent.addEventListener('change', () => changeDesign({ accent: df.ownAccent.checked ? df.accent.value : null }));
df.accent.addEventListener('input', () => changeDesign({ accent: df.accent.value }));
df.bgDim.addEventListener('input', () => changeDesign({ bgDim: Number(df.bgDim.value) }));
df.animations.addEventListener('change', () => changeDesign({ animations: df.animations.checked }));
df.greeting.addEventListener('change', () => changeDesign({ greeting: df.greeting.checked }));
df.name.addEventListener('input', () => { Object.assign(state.design, { name: df.name.value }); tick(); });
$('#bgUpload').addEventListener('click', () => $('#bgFile').click());
$('#bgFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    changeDesign({ bgImage: await shrinkImage(file, 2560, 'image/jpeg', 0.85) });
  } catch {
    toast('Bild konnte nicht gelesen werden.', true);
  }
});
$('#bgClear').addEventListener('click', () => changeDesign({ bgImage: null }));
$('#designReset').addEventListener('click', () => changeDesign({ ...DEFAULT_DESIGN }));

$('#designBtn').addEventListener('click', () => {
  designBefore = structuredClone(state.design);
  syncDesignForm();
  designDlg.showModal();
});
$('#designCancel').addEventListener('click', () => designDlg.close());
designDlg.addEventListener('close', () => {
  if (designDlg.returnValue === 'ok') {
    save();
    if (df.sync.checked !== syncOn) setSync(df.sync.checked);
  } else {
    state.design = designBefore;
    applyDesign(state.design);
    render();
    tick();
  }
  designDlg.returnValue = '';
});

// ---------- Gruppen-Dialog ----------
const groupDlg = $('#groupDlg');
const gf = $('#groupForm');
let groupCtx = null; // { group (null = neu), side }

function syncSideSeg() {
  $('#sideSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.value === groupCtx.side));
}

function openGroupEditor(group) {
  groupCtx = { group, side: group?.side ?? 'right' };
  $('#groupTitle').textContent = group ? 'Gruppe bearbeiten' : 'Neue Gruppe';
  gf.name.value = group?.name ?? '';
  $('#groupDelete').hidden = !group;
  syncSideSeg();
  groupDlg.showModal();
  gf.name.focus();
}

$('#addGroup').addEventListener('click', () => openGroupEditor(null));
$('#sideSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-value]');
  if (!b) return;
  groupCtx.side = b.dataset.value;
  syncSideSeg();
});
gf.addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const name = gf.name.value.trim();
  if (!name) { e.preventDefault(); return; }
  if (groupCtx.group) Object.assign(groupCtx.group, { name, side: groupCtx.side });
  else state.groups.push({ id: uid(), name, side: groupCtx.side, collapsed: false, shortcuts: [] });
  save();
  smooth(render);
});
$('#groupDelete').addEventListener('click', () => {
  const { group } = groupCtx;
  const n = group.shortcuts.length;
  if (!confirm(`Gruppe „${group.name}“${n ? ` mit ${n} Verknüpfung${n === 1 ? '' : 'en'}` : ''} löschen?`)) return;
  state.groups.splice(state.groups.indexOf(group), 1);
  groupDlg.close();
  save();
  smooth(render);
});

// ---------- Lesezeichen-Import ----------
// Zugriff auf die Lesezeichen fragt Chrome erst beim ersten Klick ab (optional_permissions).
const bmDlg = $('#bookmarkDlg');
const bf = $('#bookmarkForm');
let bmFolders = []; // [{ title, depth, links: [{ title, url }] }]

$('#bookmarkBtn').addEventListener('click', async () => {
  if (!hasExt) return toast('Lesezeichen gehen nur in der Extension.', true);
  if (!await chrome.permissions.request({ permissions: ['bookmarks'] })) {
    return toast('Ohne Zugriff auf die Lesezeichen geht es nicht.', true);
  }
  const [root] = await chrome.bookmarks.getTree();
  bmFolders = [];
  (function walk(node, depth) {
    for (const n of node.children ?? []) {
      if (n.url) continue;
      const links = (n.children ?? []).filter(c => /^https?:/i.test(c.url ?? '')).map(c => ({ title: c.title, url: c.url }));
      bmFolders.push({ title: n.title || 'Ohne Namen', depth, links });
      walk(n, depth + 1);
    }
  })(root, 0);
  bf.folder.replaceChildren(...bmFolders.map((f, i) =>
    h('option', { value: i }, ' '.repeat(f.depth) + `${f.title} (${f.links.length})`)));
  bf.folder.value = Math.max(0, bmFolders.findIndex(f => f.links.length));
  bf.target.replaceChildren(
    h('option', { value: '' }, 'Hauptbereich'),
    ...state.groups.map(g => h('option', { value: g.id }, `Gruppe „${g.name}“`)),
    h('option', { value: 'new-left' }, 'Neue Gruppe links (Name des Ordners)'),
    h('option', { value: 'new-right' }, 'Neue Gruppe rechts (Name des Ordners)'),
  );
  showBookmarkFolder();
  bmDlg.showModal();
});

function showBookmarkFolder() {
  const links = bmFolders[bf.folder.value]?.links ?? [];
  $('#bmList').replaceChildren(...(links.length
    ? links.map((l, i) => {
      const img = h('img', { alt: '' });
      loadFirstIcon(img, siteIconCandidates(l.url), () => img.replaceWith(fa('fa-solid fa-globe')));
      return h('label', { class: 'check bm' },
        h('input', { type: 'checkbox', checked: true, value: i }), img, h('span', { title: l.url }, l.title || l.url));
    })
    : [h('p', { class: 'muted' }, 'In diesem Ordner liegen keine Links.')]));
}

bf.folder.addEventListener('change', showBookmarkFolder);
$('#bmAll').addEventListener('click', () => $('#bmList').querySelectorAll('input').forEach(c => (c.checked = true)));
$('#bmNone').addEventListener('click', () => $('#bmList').querySelectorAll('input').forEach(c => (c.checked = false)));

bf.addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const folder = bmFolders[bf.folder.value];
  const picked = [...$('#bmList').querySelectorAll('input:checked')].map(c => folder.links[c.value]);
  if (!picked.length) { e.preventDefault(); return toast('Keine Lesezeichen ausgewählt.', true); }
  let list;
  if (bf.target.value.startsWith('new-')) {
    const group = { id: uid(), name: folder.title.slice(0, 40), side: bf.target.value.slice(4), collapsed: false, shortcuts: [] };
    state.groups.push(group);
    list = group.shortcuts;
  } else {
    list = state.groups.find(g => g.id === bf.target.value)?.shortcuts ?? state.shortcuts;
  }
  const have = new Set(list.map(s => s.url));
  const added = picked.filter(l => !have.has(l.url)).map(l => ({
    id: uid(), label: (l.title || new URL(l.url).hostname.replace(/^www\./, '')).slice(0, 40),
    url: l.url, color: '#ffffff', autoFg: true,
  }));
  list.push(...added);
  save();
  smooth(render);
  const skipped = picked.length - added.length;
  toast(`${added.length} Verknüpfung${added.length === 1 ? '' : 'en'} übernommen`
    + (skipped ? `, ${skipped} gab es schon.` : '.'));
});

// ---------- Tastenkürzel ----------
// /  springt in die Suche, Esc verlässt sie.
// 1–9 öffnet Verknüpfung 1–9 im Hauptbereich, mit Umschalt im neuen Tab. (Strg+1–9 wechselt in Chrome die Tabs.)
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || document.querySelector('dialog[open]')) return;
  if (e.target === q) {
    if (e.key === 'Escape' && suggestBox.hidden) q.blur();
    return;
  }
  if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === '/') {
    e.preventDefault();
    q.focus();
    return;
  }
  const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
  const s = n && !editing && state.shortcuts[n - 1];
  if (!s) return;
  e.preventDefault();
  if (e.shiftKey || linkTarget(s)) window.open(s.url, '_blank');
  else location.href = s.url;
});
