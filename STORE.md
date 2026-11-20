# Chrome Web Store: Veröffentlichen und Aktualisieren

YFStart wird als **nicht gelisteter** Eintrag veröffentlicht: Er taucht in keiner Suche auf,
installieren kann ihn nur, wer den Link hat. Chrome aktualisiert installierte Kopien selbst.

## Paket bauen

Die Version in `manifest.json` muss bei jedem Upload höher sein als die letzte. Dann im Repo:

```bash
git archive --format=zip -o yfstart.zip HEAD
```

`git archive` nimmt den letzten Commit, ohne die in `.gitattributes` ausgeschlossenen Dateien
(Store-Texte, Screenshots, `.claude/`). Vorher committen, sonst fehlen die Änderungen.

## Erstes Veröffentlichen

1. Entwicklerkonto anlegen: <https://chrome.google.com/webstore/devconsole> (einmalig 5 US-Dollar).
2. „Neuer Artikel“ → `yfstart.zip` hochladen.
3. Die Felder unten ausfüllen, Screenshot `store/screenshot.png` und Icon `icons/128.png` hochladen.
4. Unter „Vertrieb“ die Sichtbarkeit **Nicht gelistet** wählen.
5. „Zur Überprüfung einreichen“. Die erste Prüfung dauert meist einige Tage.
6. Nach der Freigabe den Link aus dem Dashboard an andere weitergeben.

Wer bisher die entpackte Version nutzt: Shortcuts und PCs vorher über **Exportieren** sichern, die
entpackte Version in `chrome://extensions` entfernen, die Store-Version installieren und dort
**Importieren**. Die Store-Version hat eine andere ID und damit einen eigenen Speicher. PCs danach
neu koppeln.

## Update veröffentlichen

1. `version` in `manifest.json` erhöhen (z. B. `1.3.0` → `1.4.0`), committen.
2. Paket bauen (siehe oben).
3. Dashboard → YFStart → „Paket“ → „Neues Paket hochladen“ → einreichen.

Nach der Freigabe holt Chrome das Update bei allen Nutzern automatisch, meist innerhalb weniger
Stunden.

## Felder im Dashboard

**Name:** YFStart

**Kurzbeschreibung** (kommt aus `manifest.json`):
Neuer Tab mit Google-Suche, Google-Apps, eigenen Shortcuts und Schnellzugriff auf YFRemote-PCs.

**Beschreibung:**

> YFStart ersetzt die Seite „Neuer Tab“ durch eine eigene Startseite.
>
> • Google-Suche mit Vorschlägen, direkte Eingabe von Adressen
> • Gmail, Bilder und ein Menü mit allen Google-Apps
> • Eigene Shortcuts: Text, Adresse, Icon (Emoji, Bild oder automatisch), Hintergrund- und
>   Schriftfarbe, Reihenfolge per Ziehen
> • YFRemote: PCs mit PIN koppeln und per Klick sperren, ausschalten, neu starten, Medien steuern,
>   Lautstärke setzen, Tastenkombinationen senden, Text tippen, Webseiten oder Apps öffnen
> • „Bildschirm“: öffnet die Bildschirmansicht eines PCs direkt im Vollbild
> • Export und Import der Einstellungen
>
> Alle Einstellungen bleiben lokal im Browser. Für die Steuerung muss YFRemote auf dem jeweiligen
> PC laufen.

**Kategorie:** Tools · **Sprache:** Deutsch

**Datenschutzerklärung (URL):** <https://github.com/YannikFroehlich/YFStart/blob/main/PRIVACY.md>

**Startseite / Support (URL):** <https://github.com/YannikFroehlich/YFStart>

### Tab „Datenschutz“

**Einzelner Zweck:**
Ersetzt die Seite „Neuer Tab“ durch eine konfigurierbare Startseite mit Google-Suche, Shortcuts und
Schnellzugriff auf eigene PCs mit YFRemote.

**Begründung der Berechtigungen:**

- `storage`: Speichert Shortcuts, PCs und Kopplungen lokal.
- `scripting`: Meldet für selbst eingetragene PCs zwei mitgelieferte Scripts an und schaltet den
  YFRemote-Client eines PCs auf die Bildschirmansicht. YFRemote akzeptiert Befehle nur mit dem
  Origin des PCs, deshalb laufen sie über ein mitgeliefertes Script auf der Seite des PCs.
- Hostberechtigung `https://suggestqueries.google.com/*`: Lädt die Google-Suchvorschläge.
- Optionale Hostberechtigungen `http://*/*`, `https://*/*`: Werden nur für die Adresse eines
  selbst eingetragenen PCs angefragt, beim ersten Koppeln oder Steuern. Die Adressen sind
  beliebige Geräte im Heimnetz und lassen sich nicht vorab festlegen.

**Remote-Code:** Nein, es wird kein Code nachgeladen.

**Datennutzung:** Keine der Datenkategorien ankreuzen: Der Entwickler erhebt und empfängt keine
Daten. Suchtext geht direkt an Google, Befehle nur an die eigenen PCs (siehe `PRIVACY.md`).
Alle drei Bestätigungen (kein Verkauf, keine zweckfremde Nutzung, keine Kreditwürdigkeit) setzen.
