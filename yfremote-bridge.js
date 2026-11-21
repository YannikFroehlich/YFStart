'use strict';

// Brücke zu YFRemote. Läuft als Content-Script in einem unsichtbaren iframe, das die neue Tab-Seite
// auf http://<PC>:5050/health öffnet.
// YFRemote nimmt POST /pair und den WebSocket-Handshake auf /ws nur an, wenn der Origin-Header der
// eigenen Adresse des PCs entspricht. Von der Extension-Seite aus wäre das chrome-extension://…,
// und Chrome erlaubt nicht, den Origin eines WebSocket-Handshakes umzuschreiben. Anfragen aus diesem
// Frame tragen dagegen den Origin des PCs.
// Antwortet nur auf Nachrichten der eigenen Extension-Seite.
const EXTENSION_ORIGIN = 'chrome-extension://' + chrome.runtime.id;

window.addEventListener('message', async e => {
  if (e.origin !== EXTENSION_ORIGIN || !e.data?.yfstart) return;
  const { id, op } = e.data;
  const reply = msg => e.source.postMessage({ yfstart: true, id, ...msg }, EXTENSION_ORIGIN);
  try {
    if (op === 'pair') {
      const res = await fetch('/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: e.data.pin, deviceName: e.data.deviceName }),
      });
      reply({ result: { status: res.status, text: await res.text() } });
    } else if (op === 'unpair') {
      const res = await fetch('/pair', { method: 'DELETE', headers: { Authorization: 'Bearer ' + e.data.token } });
      reply({ result: { status: res.status } });
    } else if (op === 'action') {
      await sendAction(e.data.token, e.data.message, id);
      reply({ result: true });
    } else if (op === 'screen') {
      // Ein Standbild für die Vorschau. YFRemote meldet am PC, wenn jemand den Bildschirm ansieht.
      const res = await fetch(`/screen?width=${e.data.width}&quality=60`, {
        headers: { Authorization: 'Bearer ' + e.data.token }, cache: 'no-store',
      });
      if (!res.ok) throw new Error(SCREEN_ERRORS[res.status] || `Kein Bild (HTTP ${res.status}).`);
      reply({ result: await res.arrayBuffer() });
    } else if (op === 'watch') {
      await watch(e.data.token, id, e.source, e.data.stats, e.data.media);
      reply({ result: true });
    } else if (op === 'unwatch') {
      liveSocket?.close();
      reply({ result: true });
    } else if (op === 'cover') {
      // Albumcover zur Medienanzeige; 204 = keins.
      const res = await fetch('/media/cover', { headers: { Authorization: 'Bearer ' + e.data.token }, cache: 'no-store' });
      reply({ result: res.status === 200 ? { type: res.headers.get('Content-Type'), data: await res.arrayBuffer() } : null });
    } else if (op === 'upload') {
      reply({ result: await upload(e.data.token, e.data.file, e.data.key, e.source) });
    }
  } catch (err) {
    reply({ error: err.message });
  }
});

const SCREEN_ERRORS = {
  401: 'Kopplung ungültig – PC neu koppeln.',
  403: 'Dieses Gerät darf den Bildschirm nicht sehen.',
  501: 'Dieser PC kann keinen Bildschirm übertragen.',
  503: 'Gerade nicht möglich (Sperrbildschirm oder Admin-Abfrage).',
};

// Live-Anzeige: ein offener WebSocket pro PC. YFRemote schickt darüber von selbst, was gerade läuft
// ("media", bei jeder Änderung) und nach dem Einschalten etwa jede Sekunde die Auslastung
// ("systemStats"). Beides geht an die neue Tab-Seite. Die schließt die Verbindung, sobald sie nicht mehr
// sichtbar ist; dann misst der PC nicht mehr.
// stats/media: was in den Einstellungen eingeblendet ist. Ohne Medienanzeige verbindet sich die Brücke
// mit background=1, dann fragt YFRemote den Medienstatus gar nicht erst ab.
let liveSocket = null, liveMedia = null;

function watch(token, requestId, page, stats, media) {
  if (liveSocket && liveSocket.readyState <= WebSocket.OPEN && liveMedia === media) {
    // Gleiche Verbindung, nur die Auslastung an- oder abschalten.
    const ws = liveSocket;
    const set = () => ws.send(JSON.stringify({ type: 'systemStats', enabled: stats }));
    if (ws.readyState === WebSocket.OPEN) set();
    else ws.addEventListener('open', set, { once: true });
    return Promise.resolve();
  }
  liveSocket?.close();
  liveMedia = media;
  return new Promise((resolve, reject) => {
    const ws = liveSocket = new WebSocket(wsUrl(token, !media));
    const timer = setTimeout(() => { ws.close(); reject(new Error('Keine Antwort vom PC.')); }, 6000);
    ws.onopen = () => {
      if (stats) return ws.send(JSON.stringify({ type: 'systemStats', enabled: true, requestId }));
      clearTimeout(timer);
      resolve();
    };
    ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.requestId === requestId) {
        clearTimeout(timer);
        resolve(); // ohne Auslastung (älteres YFRemote, Linux ohne Sensoren) bleibt die Medienanzeige
      } else if (m.type === 'systemStats' || m.type === 'media') {
        page.postMessage({ yfstart: true, push: m }, EXTENSION_ORIGIN);
      }
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (liveSocket === ws) liveSocket = null;
      page.postMessage({ yfstart: true, push: null }, EXTENSION_ORIGIN);
      reject(new Error('Verbindung abgelehnt.'));
    };
  });
}

// Datei an den PC (POST /files, multipart). XMLHttpRequest statt fetch, weil nur das den
// Upload-Fortschritt meldet. Fortschritt als eigene Nachricht, die Antwort kommt am Ende.
const UPLOAD_ERRORS = {
  401: 'Kopplung ungültig – PC neu koppeln.',
  403: 'Dieses Gerät darf keine Dateien schicken.',
  413: 'Datei ist zu groß für den PC.',
};

function upload(token, file, key, page) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/files');
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.upload.onprogress = ev => page.postMessage({ yfstart: true, upload: key, loaded: ev.loaded, total: ev.total }, EXTENSION_ORIGIN);
    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* keine JSON-Antwort */ }
      if (xhr.status === 200 && body?.success) resolve(body.fileName);
      else reject(new Error(UPLOAD_ERRORS[xhr.status] || body?.error || `Fehler beim Senden (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Verbindung zum PC abgebrochen.'));
    const form = new FormData();
    form.append('file', file, file.name);
    xhr.send(form);
  });
}

function wsUrl(token, background = false) {
  const u = new URL('/ws', location.href);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.searchParams.set('token', token);
  if (background) u.searchParams.set('background', '1'); // ohne Medienstatus und Datei-Angebote
  return u;
}

// requestId kommt von der Extension-Seite: crypto.randomUUID gibt es auf http:// nicht.
function sendAction(token, message, requestId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(token, true)); // nur ein Befehl, kein Medienstatus nötig
    let finished = false;
    const finish = err => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ws.close();
      err ? reject(err) : resolve();
    };
    const timer = setTimeout(() => finish(new Error('Keine Antwort vom PC.')), 6000);
    ws.onopen = () => ws.send(JSON.stringify({ ...message, requestId }));
    ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.requestId !== requestId) return; // z. B. die "access"-Begrüßung
      finish(m.success ? null : new Error(m.error || 'Aktion fehlgeschlagen.'));
    };
    ws.onerror = () => finish(new Error('Verbindung abgelehnt – Kopplung ungültig? Dann PC neu koppeln.'));
  });
}
