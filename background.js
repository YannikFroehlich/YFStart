'use strict';

// "Bildschirm"-Knopf: öffnet den YFRemote-Client eines PCs im Tab der neuen Tab-Seite, schaltet dort
// auf den Bildschirm-Tab und in Vollbild. Läuft hier im Hintergrund, weil die Tab-Seite beim
// Weiternavigieren verschwindet.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'openScreen' && sender.tab?.id != null && /^https?:\/\//.test(msg.url)) {
    openScreen(sender.tab, msg.url, msg.token, msg.newTab).catch(() => { /* PC offline: Chrome zeigt seine Fehlerseite */ });
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

// Zugriff auf den PC und fullscreen-flag.js hat newtab.js (ensureHostAccess) vorher eingerichtet.
// newTab: in einem neuen Tab neben der Tab-Seite statt in ihr.
async function openScreen(source, url, token, newTab) {
  const tabId = newTab
    ? (await chrome.tabs.create({ url: 'about:blank', index: source.index + 1, openerTabId: source.id })).id
    : source.id;
  let loaded = tabLoaded(tabId, url);
  const tab = await chrome.tabs.update(tabId, { url: url + '#yfstart-fullscreen' });
  // Höchstens zweimal: beim ersten Mal legt showScreenTab evtl. die Kopplung ab und lädt neu.
  for (let attempt = 0; attempt < 2; attempt++) {
    await loaded;
    loaded = tabLoaded(tabId, url);
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId }, func: showScreenTab, args: [token] });
    if (result !== 'reload') break;
  }
  await enterWindowFullscreen(tab.windowId);
}

// Erst fertig, wenn die Seite des PCs geladen ist - nicht schon das about:blank eines neuen Tabs.
function tabLoaded(tabId, urlPrefix) {
  return new Promise(resolve => {
    const listener = (id, info, tab) => {
      if (id !== tabId || info.status !== 'complete' || !tab.url?.startsWith(urlPrefix)) return;
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
