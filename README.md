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
  Ozean, Abendrot und Wald; eigene Akzentfarbe, eigenes Hintergrundbild, Kachelgröße, -form und -stil,
  Animationen an/aus
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

Icons: [Font Awesome Free](https://fontawesome.com) 7.3.1 liegt in `vendor/fontawesome`
(Icons CC BY 4.0, Schriften SIL OFL 1.1, Code MIT – siehe `vendor/fontawesome/LICENSE.txt`).
`icons.json` dort ist eine verkürzte Liste aus den Metadaten des Pakets (Name, Stile, Suchbegriffe).
