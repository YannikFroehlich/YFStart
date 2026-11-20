'use strict';

// "Bildschirm"-Knopf: öffnet den YFRemote-Client eines PCs im Tab der neuen Tab-Seite, schaltet dort
// auf den Bildschirm-Tab und in Vollbild. Läuft hier im Hintergrund, weil die Tab-Seite beim
// Weiternavigieren verschwindet.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'openScreen' && sender.tab?.id != null && /^https?:\/\//.test(msg.url)) {
    openScreen(sender.tab.id, msg.url, msg.token).catch(() => { /* PC offline: Chrome zeigt seine Fehlerseite */ });
  } else if (msg?.type === 'exitWindowFullscreen' && sender.tab) {
    exitWindowFullscreen(sender.tab.windowId);
  }
});

// Fenstergröße von vorher in storage.session, weil der Service Worker zwischendurch beendet wird.
async function enterWindowFullscreen(windowId) {
  const win = await chrome.windows.get(windowId);
  if (win.state === 'fullscreen') return;
  await chrome.storage.session.set({ ['windowState' + windowId]: win.state });
  await chrome.windows.update(windowId, { state: 'fullscreen' });
}

async function exitWindowFullscreen(windowId) {
  const key = 'windowState' + windowId;
  const { [key]: previous } = await chrome.storage.session.get(key);
  if (!previous) return; // nicht von YFStart ins Vollbild gesetzt
  await chrome.storage.session.remove(key);
  await chrome.windows.update(windowId, { state: previous });
}

async function openScreen(tabId, url, token) {
  await allowScriptFullscreen(url);
  let loaded = tabLoaded(tabId);
  const tab = await chrome.tabs.update(tabId, { url: url + '#yfstart-fullscreen' });
  // Höchstens zweimal: beim ersten Mal legt showScreenTab evtl. die Kopplung ab und lädt neu.
  for (let attempt = 0; attempt < 2; attempt++) {
    await loaded;
    loaded = tabLoaded(tabId);
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId }, func: showScreenTab, args: [token] });
    if (result !== 'reload') break;
  }
  await enterWindowFullscreen(tab.windowId);
}

// fullscreen-flag.js früh in die Seiten dieses PCs laden (wirkt nur mit #yfstart-fullscreen).
async function allowScriptFullscreen(url) {
  const { protocol, hostname } = new URL(url);
  const match = `${protocol}//${hostname}/*`;
  const [existing] = await chrome.scripting.getRegisteredContentScripts({ ids: ['yfstart-fullscreen'] });
  if (existing?.matches.includes(match)) return;
  const script = {
    id: 'yfstart-fullscreen',
    matches: [...(existing?.matches ?? []), match],
    js: ['fullscreen-flag.js'],
    runAt: 'document_start',
    world: 'MAIN',
  };
  await (existing ? chrome.scripting.updateContentScripts([script]) : chrome.scripting.registerContentScripts([script]));
}

function tabLoaded(tabId) {
  return new Promise(resolve => {
    const listener = (id, info) => {
      if (id !== tabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Läuft im YFRemote-Client. Ohne eigene Kopplung bekommt er die von YFStart (gleiches Gerät), damit
// nicht zweimal gekoppelt werden muss. Tab und Vollbild-Schalter erkennt das Script an ihren Icons,
// nicht an der Beschriftung, die je nach Sprache wechselt.
function showScreenTab(token) {
  const TOKEN_KEY = 'yfremote.pairingToken';
  const SCREEN_TAB_ICON = 'M3 4h18a1 1 0 0 1 1 1v11';
  const FULLSCREEN_ICON = 'M5 5h6v2H7v4H5V5Z';
  if (token && !localStorage.getItem(TOKEN_KEY)) {
    localStorage.setItem(TOKEN_KEY, token);
    location.reload();
    return 'reload';
  }
  const withIcon = (selector, icon) => [...document.querySelectorAll(selector)]
    .find(el => el.querySelector('path')?.getAttribute('d')?.startsWith(icon));
  const started = Date.now();
  let tabClicked = false;
  const timer = setInterval(() => {
    if (!tabClicked) {
      const tab = withIcon('[role="tab"]', SCREEN_TAB_ICON);
      if (tab) { tab.click(); tabClicked = true; }
    } else {
      const toggle = withIcon('[role="switch"]', FULLSCREEN_ICON);
      if (toggle) {
        clearInterval(timer);
        if (toggle.getAttribute('aria-checked') !== 'true') toggle.click();
        followFullscreen();
      }
    }
    if (Date.now() - started > 15000) clearInterval(timer); // Tab ausgeblendet oder nicht gekoppelt
  }, 200);
  return 'waiting';

  // Endet YFRemotes Vollbild (Schalter aus oder Bildschirm-Tab verlassen), soll auch das
  // Chrome-Fenster das Vollbild verlassen - sonst wirkt der Vollbild-Schalter kaputt.
  function followFullscreen() {
    const isOn = () => withIcon('[role="switch"]', FULLSCREEN_ICON)?.getAttribute('aria-checked') === 'true';
    let wasOn = isOn(); // der Klick kann den Schalter schon umgestellt haben
    const observer = new MutationObserver(() => {
      const on = isOn();
      if (on) {
        wasOn = true;
      } else if (wasOn) {
        observer.disconnect();
        chrome.runtime.sendMessage({ type: 'exitWindowFullscreen' });
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-checked'] });
  }
}
