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
    } else if (op === 'watchStats') {
      await watchStats(e.data.token, id, e.source);
      reply({ result: true });
    } else if (op === 'unwatchStats') {
      statsSocket?.close();
      reply({ result: true });
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

// Auslastung (CPU, RAM, GPU, Akku): YFRemote schickt sie etwa jede Sekunde, solange die Anzeige an ist.
// Ein offener WebSocket pro PC, die Werte gehen an die neue Tab-Seite. Wird er geschlossen, misst der
// PC nicht mehr (die Tab-Seite schließt ihn, sobald sie nicht mehr sichtbar ist).
let statsSocket = null;

function watchStats(token, requestId, page) {
  if (statsSocket && statsSocket.readyState <= WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const ws = statsSocket = new WebSocket(wsUrl(token));
    const timer = setTimeout(() => { ws.close(); reject(new Error('Keine Antwort vom PC.')); }, 6000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'systemStats', enabled: true, requestId }));
    ws.onmessage = ev => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.requestId === requestId) {
        clearTimeout(timer);
        m.success ? resolve() : (ws.close(), reject(new Error(m.error || 'Keine Auslastung verfügbar.')));
      } else if (m.type === 'systemStats') {
        page.postMessage({ yfstart: true, stats: m }, EXTENSION_ORIGIN);
      }
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (statsSocket === ws) statsSocket = null;
      page.postMessage({ yfstart: true, stats: null }, EXTENSION_ORIGIN);
      reject(new Error('Verbindung abgelehnt.'));
    };
  });
}

function wsUrl(token) {
  const u = new URL('/ws', location.href);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.searchParams.set('token', token);
  return u;
}

// requestId kommt von der Extension-Seite: crypto.randomUUID gibt es auf http:// nicht.
function sendAction(token, message, requestId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(token));
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
