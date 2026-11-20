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
const favicon = url => `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;

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
  lock: { name: 'Sperren', icon: '🔒', build: () => ({ type: 'lock' }) },
  sleep: { name: 'Energie sparen', icon: '🌙', build: () => ({ type: 'sleep' }) },
  displayOff: { name: 'Bildschirm aus', icon: '🖥️', build: () => ({ type: 'displayOff' }) },
  shutdown: { name: 'Herunterfahren', icon: '⏻', confirm: true, build: () => ({ type: 'shutdown' }) },
  restart: { name: 'Neustart', icon: '🔄', confirm: true, build: () => ({ type: 'restart' }) },
  playPause: { name: 'Play / Pause', icon: '⏯️', build: mediaKey('MEDIA_PLAY_PAUSE') },
  next: { name: 'Nächster Titel', icon: '⏭️', build: mediaKey('MEDIA_NEXT') },
  prev: { name: 'Vorheriger Titel', icon: '⏮️', build: mediaKey('MEDIA_PREVIOUS') },
  mute: { name: 'Stumm an/aus', icon: '🔇', build: mediaKey('VOLUME_MUTE') },
  volUp: { name: 'Lauter', icon: '🔊', build: mediaKey('VOLUME_UP') },
  volDown: { name: 'Leiser', icon: '🔉', build: mediaKey('VOLUME_DOWN') },
  volume: {
    name: 'Lautstärke setzen', icon: '🔈', param: 'Lautstärke (0–100)',
    build: p => {
      const v = Number(p);
      if (p === '' || !Number.isInteger(v) || v < 0 || v > 100) throw new Error('Lautstärke muss eine Zahl von 0 bis 100 sein.');
      return { type: 'volume', volume: v };
    },
  },
  hotkey: {
    name: 'Taste / Tastenkombination', icon: '⌨️', param: 'z. B. CTRL+SHIFT+ESC, WIN+D, F5',
    build: p => {
      const keys = p.split('+').map(k => k.trim().toUpperCase()).filter(Boolean);
      if (!keys.length) throw new Error('Bitte eine Taste angeben.');
      return { type: keys.length === 1 ? 'key' : 'hotkey', keys };
    },
  },
  text: {
    name: 'Text tippen', icon: '✍️', param: 'Text',
    build: p => { if (!p) throw new Error('Bitte einen Text angeben.'); return { type: 'text', text: p }; },
  },
  openUrl: {
    name: 'Website öffnen', icon: '🌐', param: 'https://…',
    build: p => {
      if (!/^https?:\/\/\S+$/i.test(p)) throw new Error('URL muss mit http:// oder https:// beginnen.');
      return { type: 'launch', url: p };
    },
  },
  openApp: {
    name: 'App starten', icon: '🚀', param: 'App-Name (wie im Startmenü)',
    build: p => { if (!p) throw new Error('Bitte einen App-Namen angeben.'); return { type: 'launch', name: p }; },
  },
};

// ---------- Zustand ----------
const state = { shortcuts: [], pcs: [] };
let editing = false;
const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

async function load() {
  const d = await storage.get(['shortcuts', 'pcs']);
  state.shortcuts = Array.isArray(d.shortcuts) ? d.shortcuts : structuredClone(DEFAULT_SHORTCUTS);
  state.pcs = Array.isArray(d.pcs) ? d.pcs : [];
  // Ältere Einträge mit http://…:5443 reparieren (siehe normalizePcUrl).
  for (const pc of state.pcs) pc.url = normalizePcUrl(pc.url) || pc.url;
}

async function save() {
  await storage.set({ shortcuts: state.shortcuts, pcs: state.pcs });
}

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
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), isError ? 5000 : 2500);
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
function tick() {
  const now = new Date();
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
  suggestBox.replaceChildren(...list.map((s, i) => h('li', {
    role: 'option', id: 'sug' + i,
    onmousedown: e => { e.preventDefault(); go(s); },
  }, s)));
  const open = list.length > 0;
  suggestBox.hidden = !open;
  $('#searchForm').classList.toggle('open', open);
  q.setAttribute('aria-expanded', open);
}

function markSelected() {
  [...suggestBox.children].forEach((li, i) => li.setAttribute('aria-selected', i === selected));
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
    if (typed === text && document.activeElement === q) showSuggest(list.slice(0, 8));
  } catch { /* offline oder abgebrochen: keine Vorschläge */ }
}

q.addEventListener('input', () => {
  typed = q.value;
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
appsPanel.append(...GOOGLE_APPS.map(([name, url, icon]) =>
  h('a', { class: 'app', href: url }, h('img', { src: icon || favicon(url), alt: '' }), name)));
function setApps(open) {
  appsPanel.hidden = !open;
  appsBtn.setAttribute('aria-expanded', open);
}
appsBtn.addEventListener('click', e => { e.stopPropagation(); setApps(appsPanel.hidden); });
document.addEventListener('click', e => { if (!appsPanel.contains(e.target)) setApps(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setApps(false); });

// ---------- Kacheln ----------
function paintIcon(ic, t, kind) {
  const color = t.color || '#ffffff';
  ic.style.background = color;
  ic.style.color = t.autoFg !== false ? readableOn(color) : (t.fg || '#ffffff');
  const icon = (t.icon || '').trim();
  const letter = (t.label || '?').slice(0, 1).toUpperCase();
  const src = t.image
    || (/^(https?:|data:image\/)/i.test(icon) ? icon : null)
    || (!icon && kind === 'link' && t.url ? favicon(t.url) : null);
  if (src) {
    const img = h('img', { src, alt: '' });
    img.addEventListener('error', () => ic.replaceChildren(letter));
    ic.replaceChildren(img);
  } else {
    ic.replaceChildren(icon || (kind === 'remote' ? ACTIONS[t.action]?.icon : letter) || letter);
  }
}

function tileEl(t, kind) {
  const ic = h('span', { class: 'ic' });
  paintIcon(ic, t, kind);
  const el = kind === 'link'
    ? h('a', { class: 'tile', href: t.url, title: t.url })
    : h('button', { class: 'tile', type: 'button', title: ACTIONS[t.action]?.name });
  el.append(ic, h('span', { class: 'lbl' }, t.label || ''));
  return el;
}

function addTile(onclick) {
  return h('button', { class: 'tile add', type: 'button', onclick },
    h('span', { class: 'ic' }, '+'), h('span', { class: 'lbl' }, 'Hinzufügen'));
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
    render();
  });
}

function renderShortcuts() {
  const tiles = state.shortcuts.map((s, i) => {
    const el = tileEl(s, 'link');
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
      const el = tileEl(b, 'remote');
      if (editing) {
        el.addEventListener('click', () => openTileEditor('remote', pc.buttons, i, pc));
        sortable(el, pc.buttons, i);
      } else {
        el.addEventListener('click', () => runButton(pc, b, el));
      }
      return el;
    });
    if (editing) buttons.push(addTile(() => openTileEditor('remote', pc.buttons, -1, pc)));
    return h('div', { class: 'pc' },
      h('div', { class: 'pc-head' },
        h('span', { class: 'dot', 'data-pc': pc.id, title: 'Status wird geprüft…' }),
        h('h3', {}, pc.name),
        h('span', { class: 'host' }, new URL(pc.url).host),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small', type: 'button', title: 'Bildschirm dieses PCs in YFRemote öffnen', onclick: () => openScreen(pc) }, '🖥 Bildschirm'),
        editing && h('button', { class: 'btn small', type: 'button', onclick: () => openPcEditor(pcIndex) }, '✎ PC bearbeiten'),
      ),
      !pc.token && h('p', { class: 'warn' }, 'Nicht gekoppelt – über ⚙ → „PC bearbeiten“ mit der PIN aus dem YFRemote-Tray koppeln.'),
      buttons.length ? h('div', { class: 'grid' }, buttons) : h('p', { class: 'empty' }, 'Noch keine Buttons – ⚙ drücken und „Hinzufügen“ wählen.'),
    );
  }));
  checkHealth();
}

function render() {
  document.body.classList.toggle('editing', editing);
  $('#editbar').hidden = !editing;
  renderShortcuts();
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
      if (dot) Object.assign(dot, { className: 'dot', title: 'Zugriff noch nicht erlaubt – einmal auf einen Button klicken' });
      return;
    }
    let online = false;
    try {
      const res = await fetch(new URL('/health', pc.url), { cache: 'no-store', signal: AbortSignal.timeout(2500) });
      online = res.ok;
    } catch { /* offline */ }
    if (!dot) return;
    dot.className = 'dot ' + (online ? 'on' : 'off');
    dot.title = online ? 'Online' : 'Nicht erreichbar';
  }));
}

function sendAction(pc, message) {
  return callBridge(pc.url, { op: 'action', token: pc.token, message });
}

// Erledigt background.js: YFRemote-Client öffnen und auf den Bildschirm-Tab schalten.
async function openScreen(pc) {
  if (!hasExt) return void (location.href = pc.url + '/');
  try {
    await ensureHostAccess(pc.url);
  } catch (err) {
    return toast(err.message, true);
  }
  chrome.runtime.sendMessage({ type: 'openScreen', url: pc.url + '/', token: pc.token });
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
let tileCtx = null; // { kind, list, index, image }

tf.action.append(...Object.entries(ACTIONS).map(([k, a]) => h('option', { value: k }, `${a.icon}  ${a.name}`)));

function tileFromForm() {
  return {
    label: tf.label.value.trim(),
    url: normalizeLink(tf.url.value) || tf.url.value.trim(),
    action: tf.action.value,
    param: tf.param.value,
    confirm: tf.confirm.checked,
    icon: tf.icon.value.trim(),
    image: tileCtx.image || null,
    color: tf.color.value,
    fg: tf.fg.value,
    autoFg: tf.autoFg.checked,
  };
}

function updateTileForm() {
  const kind = tileCtx.kind;
  tf.querySelectorAll('[data-kind]').forEach(el => (el.hidden = el.dataset.kind !== kind));
  const action = ACTIONS[tf.action.value];
  $('#paramRow').hidden = kind !== 'remote' || !action.param;
  $('#paramLabel').textContent = action.param || '';
  tf.fg.disabled = tf.autoFg.checked;
  tf.icon.placeholder = tileCtx.image ? 'Hochgeladenes Bild (Text hier ersetzt es)' : 'Emoji, Text oder Bild-URL – leer = automatisch';
  $('#preview').replaceChildren(tileEl(tileFromForm(), kind));
}

function openTileEditor(kind, list, index, pc) {
  const isNew = index < 0;
  const t = isNew
    ? (kind === 'link'
      ? { label: '', url: '', color: '#ffffff', autoFg: true }
      : { label: '', action: 'lock', param: '', color: '#2b5cd6', autoFg: true })
    : list[index];
  tileCtx = { kind, list, index, image: t.image || null };
  $('#tileTitle').textContent = (isNew ? 'Neuer ' : '') + (kind === 'link' ? 'Shortcut' : `Button für ${pc.name}`);
  tf.label.value = t.label || '';
  tf.url.value = t.url || '';
  tf.action.value = t.action || 'lock';
  tf.param.value = t.param || '';
  tf.confirm.checked = !!(t.confirm ?? ACTIONS[tf.action.value].confirm);
  tf.icon.value = t.icon || '';
  tf.color.value = t.color || '#ffffff';
  tf.fg.value = t.fg || '#ffffff';
  tf.autoFg.checked = t.autoFg !== false;
  $('#tileDelete').hidden = isNew;
  updateTileForm();
  tileDlg.showModal();
  tf.label.focus();
}

tf.addEventListener('input', updateTileForm);
tf.action.addEventListener('change', () => {
  tf.confirm.checked = !!ACTIONS[tf.action.value].confirm;
  tf.param.value = '';
  updateTileForm();
});
tf.icon.addEventListener('input', () => { if (tf.icon.value) tileCtx.image = null; });
$('#iconUpload').addEventListener('click', () => $('#iconFile').click());
$('#iconClear').addEventListener('click', () => { tf.icon.value = ''; tileCtx.image = null; updateTileForm(); });
$('#iconFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    tileCtx.image = await shrinkImage(file);
    tf.icon.value = '';
    updateTileForm();
  } catch {
    toast('Bild konnte nicht gelesen werden.', true);
  }
});

// Hochgeladene Bilder auf max. 128 px verkleinern, damit der Speicher klein bleibt.
async function shrinkImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 128 / Math.max(bmp.width, bmp.height));
    const c = h('canvas', { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
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
    delete t.url;
  }
  if (index < 0) list.push({ id: uid(), ...t });
  else list[index] = { ...list[index], ...t };
  save();
  render();
});

$('#tileDelete').addEventListener('click', () => {
  const { list, index } = tileCtx;
  if (!confirm(`„${list[index].label}“ löschen?`)) return;
  list.splice(index, 1);
  tileDlg.close();
  save();
  render();
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
function setEditing(on) { editing = on; render(); }
$('#editBtn').addEventListener('click', () => setEditing(!editing));
$('#doneBtn').addEventListener('click', () => setEditing(false));
$('#addShortcut').addEventListener('click', () => openTileEditor('link', state.shortcuts, -1));
$('#addPc').addEventListener('click', () => openPcEditor(-1));

$('#exportBtn').addEventListener('click', () => {
  // Ohne Kopplungs-Tokens: wer die Datei hat, soll die PCs nicht steuern können.
  const data = { shortcuts: state.shortcuts, pcs: state.pcs.map(({ token, ...pc }) => pc) };
  const a = h('a', {
    href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })),
    download: 'yfstart-backup.json',
  });
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exportiert (ohne Kopplungen – PCs nach dem Import neu koppeln).');
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
    state.pcs = data.pcs.map(pc => ({ ...pc, token: null, buttons: Array.isArray(pc.buttons) ? pc.buttons : [] }));
    await save();
    render();
    toast('Importiert.');
  } catch {
    toast('Datei ist kein gültiges YFStart-Backup.', true);
  }
});

// ---------- Start ----------
tick();
setInterval(tick, 1000);
load().then(() => {
  render();
  setInterval(checkHealth, 30_000);
  checkForUpdate();
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
