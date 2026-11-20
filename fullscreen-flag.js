'use strict';

// Läuft im YFRemote-Client (Seitenkontext, vor dessen eigenem Code), aber nur, wenn YFStart ihn mit
// #yfstart-fullscreen geöffnet hat.
// Echtes Element-Vollbild verlangt einen Klick des Nutzers; ein Klick per Script wird abgelehnt.
// Meldet die Seite "kein Element-Vollbild", nutzt YFRemote seinen Ersatzmodus (Bild füllt die Seite
// per CSS, gedacht fürs iPhone), und der geht auch per Script. Das Chrome-Fenster selbst schaltet
// background.js in Vollbild.
if (location.hash.includes('yfstart-fullscreen')) {
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true });
}
