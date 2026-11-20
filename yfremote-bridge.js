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
    }
  } catch (err) {
    reply({ error: err.message });
  }
});

// requestId kommt von der Extension-Seite: crypto.randomUUID gibt es auf http:// nicht.
function sendAction(token, message, requestId) {
  return new Promise((resolve, reject) => {
    const u = new URL('/ws', location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.searchParams.set('token', token);
    const ws = new WebSocket(u);
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
