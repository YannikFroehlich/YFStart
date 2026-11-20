# YFStart

Eigene Seite für „Neuer Tab“ in Chrome:

- Google-Suche mit Vorschlägen, Gmail, Bilder und alle Google-Apps
- Wetter für einen Ort unter der Uhr, ein- und ausschaltbar (⚙ → **Wetter**)
- Shortcuts mit eigenem Text, Icon und Farben, sortierbar per Ziehen
- Schnellzugriff auf PCs mit [YFRemote](https://github.com/YannikFroehlich/YFRemote.Server):
  Sperren, Ausschalten, Medien, Lautstärke, Tastenkombinationen und mehr per Klick
- „🖥 Bildschirm“ öffnet die Bildschirmansicht eines PCs direkt im Vollbild

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

## PC hinzufügen

Auf dem PC muss YFRemote laufen. Auf der Seite ⚙ → **+ PC (YFRemote)**, Name und IP eintragen
(Port 5050 wird ergänzt), die PIN aus dem YFRemote-Tray eingeben und **Koppeln**. Beim ersten
Mal fragt Chrome, ob YFStart auf diese Adresse zugreifen darf.

## Für Änderungen

Bei jeder Änderung, die andere bekommen sollen, `version` in `manifest.json` erhöhen und pushen.
Nur dann erscheint bei den anderen der Update-Hinweis (Prüfung höchstens alle 6 Stunden).

Datenschutz: siehe [PRIVACY.md](PRIVACY.md).
