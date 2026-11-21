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
  const { id, op, token } = e.data;
  const reply = msg => e.source.postMessage({ yfstart: true, id, ...msg }, EXTENSION_ORIGIN);
  const auth = { Authorization: 'Bearer ' + token };
  try {
    if (op === 'pair') {
      const res = await fetch('/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: e.data.pin, deviceName: e.data.deviceName }),
      });
      reply({ result: { status: res.status, text: await res.text() } });
    } else if (op === 'unpair') {
      const res = await fetch('/pair', { method: 'DELETE', headers: auth });
      reply({ result: { status: res.status } });
    } else if (op === 'action') {
      await sendAction(token, e.data.message, id);
      reply({ result: true });
    } else if (op === 'screen') {
      // Ein Standbild für die Vorschau. YFRemote meldet am PC, wenn jemand den Bildschirm ansieht.
      const res = await fetch(`/screen?width=${e.data.width}&quality=60`, { headers: auth, cache: 'no-store' });
      if (!res.ok) throw new Error(SCREEN_ERRORS[res.status] || `Kein Bild (HTTP ${res.status}).`);
      reply({ result: await res.arrayBuffer() });
    } else if (op === 'watch') {
      await watch(token, id, e.source, e.data.stats);
      reply({ result: true });
    } else if (op === 'unwatch') {
      liveSocket?.close();
      reply({ result: true });
    } else if (op === 'cover') {
      // Albumcover zur Medienanzeige; 204 = keins.
      const res = await fetch('/media/cover', { headers: auth, cache: 'no-store' });
      reply({ result: res.status === 200 ? { type: res.headers.get('Content-Type'), data: await res.arrayBuffer() } : null });
    } else if (op === 'upload') {
      reply({ result: await upload(token, e.data.file, e.data.key, e.source) });
    } else if (op === 'clipText') {
      await clipResult(await fetch('/clipboard/text', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: e.data.text }),
      }));
      reply({ result: true });
    } else if (op === 'clipImage') {
      const form = new FormData();
      form.append('image', e.data.blob, 'zwischenablage.png');
      await clipResult(await fetch('/clipboard/image', { method: 'POST', headers: auth, body: form }));
      reply({ result: true });
    } else if (op === 'getClip') {
      // Erst Text, und nur ohne Text das Bild (wie der YFRemote-Client).
      const body = await clipResult(await fetch('/clipboard/text', { headers: auth, cache: 'no-store' }));
      if (body.text) return reply({ result: { text: body.text } });
      const res = await fetch('/clipboard/image', { headers: auth, cache: 'no-store' });
      if (res.status !== 200 && res.status !== 204) await clipResult(res);
      reply({ result: res.status === 200 ? { image: await res.arrayBuffer() } : {} });
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

const CLIP_ERRORS = {
  401: 'Kopplung ungültig – PC neu koppeln.',
  403: 'Dieses Gerät darf die Zwischenablage nicht benutzen.',
  413: 'Zu groß für die Zwischenablage des PCs.',
  422: 'Inhalt der Zwischenablage ist zu groß.',
};

async function clipResult(res) {
  let body = null;
  try { body = await res.json(); } catch { /* keine JSON-Antwort */ }
  if (!res.ok || body?.success === false) throw new Error(CLIP_ERRORS[res.status] || body?.error || `Fehler (HTTP ${res.status}).`);
  return body ?? {};
}

// Live-Verbindung: ein offener WebSocket pro PC. YFRemote schickt darüber von selbst, was gerade
// läuft ("media"), den Ausschalt-Timer ("shutdownTimer") und nach dem Einschalten etwa jede Sekunde
// die Auslastung ("systemStats"). Alles geht an die neue Tab-Seite. Die schließt die Verbindung,
// sobald sie nicht mehr sichtbar ist. stats: Auslastung an (in den Einstellungen eingeblendet).
const PUSHES = ['media', 'systemStats', 'shutdownTimer'];
let liveSocket = null;

function watch(token, requestId, page, stats) {
  if (liveSocket && liveSocket.readyState <= WebSocket.OPEN) {
    // Verbindung steht schon: nur die Auslastung an- oder abschalten.
    const ws = liveSocket;
    const set = () => ws.send(JSON.stringify({ type: 'systemStats', enabled: stats }));
    if (ws.readyState === WebSocket.OPEN) set();
    else ws.addEventListener('open', set, { once: true });
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const ws = liveSocket = new WebSocket(wsUrl(token));
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
        resolve(); // auch ohne Auslastung (älteres YFRemote): Musik und Timer kommen trotzdem
      } else if (PUSHES.includes(m.type)) {
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

// Ein Befehl. Über die Live-Verbindung, wenn sie steht (schnell, z. B. beim Ziehen am
// Lautstärke-Regler), sonst über eine eigene kurze Verbindung.
// requestId kommt von der Extension-Seite: crypto.randomUUID gibt es auf http:// nicht.
function sendAction(token, message, requestId) {
  return new Promise((resolve, reject) => {
    const live = liveSocket?.readyState === WebSocket.OPEN ? liveSocket : null;
    const ws = live ?? new WebSocket(wsUrl(token, true));
    let finished = false;
    const finish = err => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      if (!live) ws.close();
      err ? reject(err) : resolve();
    };
    const timer = setTimeout(() => finish(new Error('Keine Antwort vom PC.')), 6000);
    const onMessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.requestId !== requestId) return; // z. B. die "access"-Begrüßung
      finish(m.success ? null : new Error(m.error || 'Aktion fehlgeschlagen.'));
    };
    ws.addEventListener('message', onMessage);
    const send = () => ws.send(JSON.stringify({ ...message, requestId }));
    if (live) return send();
    ws.onopen = send;
    ws.onerror = () => finish(new Error('Verbindung abgelehnt – Kopplung ungültig? Dann PC neu koppeln.'));
  });
}
