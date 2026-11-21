# YFStart

Eigene Seite für „Neuer Tab“ in Chrome:

- Google-Suche mit Vorschlägen, Gmail, Bilder und alle Google-Apps
- Wetter für einen Ort unter der Uhr, ein- und ausschaltbar (⚙ → **Wetter**)
- Shortcuts mit eigenem Text und Farben, sortierbar per Ziehen. Als Icon: Icon der Website,
  ein Font-Awesome-Icon (passende werden vorgeschlagen, Marken mit ihrer Farbe), Emoji/Text oder ein Bild
- Eigene Verknüpfungsgruppen links oder rechts neben der Mitte (⚙ → **Gruppe**), einklappbar;
  Verknüpfungen lassen sich im Editor unter „Bereich“ zwischen Hauptbereich und Gruppen verschieben
- Links und den YFRemote-Bildschirm wahlweise im gleichen oder in einem neuen Tab öffnen
  (⚙ → **Einstellungen**, für einzelne Shortcuts auch im Shortcut selbst)
- Designs (⚙ → **Einstellungen**): System, Hell, Dunkel, Mitternacht, Papier und die Verläufe Aurora,
  Ozean, Abendrot und Wald; eigene Akzentfarbe, eigenes Hintergrundbild (abdunkeln, weichzeichnen), Schrift
  (System, Modern, Serif, Mono), Kachelgröße, -form und -stil, Kacheln ohne Beschriftung, Kacheln pro Zeile,
  Animationen an/aus
- Startseite anpassen (⚙ → **Einstellungen** → Startseite): Uhr aus, klein, mittel oder groß, mit Sekunden und
  Datum; Inhalt oben oder weiter unten; Verknüpfungen oder PCs zuerst; Gmail, Bilder und Google-Apps ausblenden;
  Suchmaschine (Google, DuckDuckGo, Bing, Ecosia) und Suchvorschläge an/aus
- Schnellzugriff auf PCs mit [YFRemote](https://github.com/YannikFroehlich/YFRemote.Server):
  Sperren, Ausschalten, Medien, Lautstärke, Tastenkombinationen und mehr per Klick
- „🖥 Bildschirm“ öffnet die Bildschirmansicht eines PCs direkt im Vollbild
- Live-Auslastung pro PC (CPU, RAM, GPU, Akku), solange der Tab sichtbar ist; Vorschaubild des Bildschirms
  beim Überfahren von „Bildschirm“ (YFRemote zeigt am PC an, dass jemand zusieht)
- Was gerade auf einem PC läuft (Titel, Interpret, Cover, Zeitleiste) mit Zurück, Pause und Weiter
- Musikanzeige mit Lautstärke-Regler und Stumm; Klick auf die Zeitleiste spult dorthin (wenn die App das kann)
- Menü „…“ auf der PC-Karte: eigene Zwischenablage an den PC schicken oder die des PCs holen (Text oder Bild),
  Ausschalt-Timer (15 Min. bis 2 Std.) mit Countdown und Abbrechen auf der Karte
- Abläufe: ein Button mit mehreren Schritten nacheinander, z. B. Lautstärke 30, 1 s warten, Bildschirm öffnen
- „Alle PCs“: ab zwei gekoppelten PCs eine eigene Karte, deren Buttons auf allen PCs gleichzeitig laufen
- Dateien an einen PC schicken: auf die PC-Karte ziehen oder „Datei“ klicken; sie landen im
  YFRemote-Empfangsordner (Standard: `Dokumente\YFRemote`)
- Tastenkürzel: `/` springt in die Suche, `1` bis `9` öffnet die Verknüpfungen im Hauptbereich
  (mit Umschalt im neuen Tab), `Esc` verlässt die Suche
- Rechner in der Suche: `17*23`, `(2+3)^2`, `wurzel(2)` zeigen das Ergebnis schon beim Tippen, Klick kopiert es
- Wettervorhersage für sechs Tage beim Überfahren des Wetters
- Begrüßung nach Tageszeit über der Uhr, optional mit Namen (⚙ → **Einstellungen**)
- Auslastung, Musikanzeige, Vorschaubild, Datei senden, Zwischenablage, Timer, Rechner und Tastenkürzel lassen sich unter
  ⚙ → **Einstellungen** einzeln ein- und ausblenden
- Sync über das Google-Konto (⚙ → **Einstellungen** → Synchronisieren): Verknüpfungen, Gruppen, PCs,
  Wetter und Einstellungen sind auf allen PCs gleich. Kopplungen, Hintergrundbild und hochgeladene Icons
  bleiben auf dem jeweiligen PC. Braucht in Chrome die Synchronisierung mit „Erweiterungen“.
- Gruppen aus einer Datei hinzufügen: ⚙ → **Importieren** mit einer Datei, die nur `{ "groups": [...] }` enthält,
  hängt die Gruppen an, statt alles zu ersetzen
- Lesezeichen importieren (⚙ → **Lesezeichen**): einen Ordner wählen, Links abhaken, in den Hauptbereich,
  eine Gruppe oder eine neue Gruppe mit dem Namen des Ordners übernehmen

## Installieren

1. Repo klonen, zum Beispiel nach `Dokumente`:
   ```bash
   git clone https://github.com/YannikFroehlich/YFStart.git
   ```
2. In Chrome `chrome://extensions` öffnen und oben rechts den **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** und den Ordner `YFStart` wählen.
4. Neuen Tab öffnen. Fragt Chrome, ob die Änderung bleiben soll: **Beibehalten**.

Den Ordner danach nicht verschieben oder löschen, Chrome lädt die Erweiterung direkt von dort.

## Aktualisieren

Gibt es auf GitHub eine neue Version, zeigt die Seite oben links einen Hinweis. Dann im Ordner
`YFStart`:

```bash
git pull
```

und im Hinweis auf **Neu laden** klicken (oder in `chrome://extensions` bei YFStart auf ⟳).
Shortcuts, PCs und Kopplungen bleiben dabei erhalten.

**Einmalig beim Update von einer Version vor 1.11:** Ab 1.11 hat YFStart eine feste Extension-ID (`key` in
`manifest.json`), damit der Sync zwischen PCs funktioniert. Chrome sieht danach eine neue Extension, die
bisherigen Daten erscheinen nicht mehr. Deshalb vor dem `git pull` auf 1.11 erst auf 1.10 aktualisieren,
dort ⚙ → **Exportieren** (bei der Frage nach Kopplungen **OK**), danach auf 1.11 ⚙ → **Importieren** und die
Datei löschen. Steht YFStart danach zweimal in `chrome://extensions`, den Eintrag mit Fehler entfernen.

## PC hinzufügen

Auf dem PC muss YFRemote laufen. Auf der Seite ⚙ → **+ PC (YFRemote)**, Name und IP eintragen
(bei reiner IP wird `http://` und Port 5050 ergänzt; für HTTPS z. B. `https://192.168.178.20:5443`, das braucht
ein Zertifikat, dem Chrome vertraut), die PIN aus dem YFRemote-Tray eingeben und **Koppeln**. Beim ersten
Mal fragt Chrome, ob YFStart auf diese Adresse zugreifen darf.

## Für Änderungen

Bei jeder Änderung, die andere bekommen sollen, `version` in `manifest.json` erhöhen und pushen.
Nur dann erscheint bei den anderen der Update-Hinweis (Prüfung höchstens alle 6 Stunden).

Datenschutz: siehe [PRIVACY.md](PRIVACY.md).

Icons: [Font Awesome Free](https://fontawesome.com) 7.3.1 liegt in `vendor/fontawesome`
(Icons CC BY 4.0, Schriften SIL OFL 1.1, Code MIT – siehe `vendor/fontawesome/LICENSE.txt`).
`icons.json` dort ist eine verkürzte Liste aus den Metadaten des Pakets (Name, Stile, Suchbegriffe).
