# Datenschutzerklärung für YFStart

Stand: 21. November 2026

YFStart ist eine Chrome-Erweiterung, die die Seite „Neuer Tab“ ersetzt. Der Entwickler betreibt
keinen eigenen Server und erhält keine Daten von Nutzerinnen und Nutzern.

## Was lokal gespeichert wird

Shortcuts, Farben, hochgeladene Icons, eingetragene PCs und deren Kopplungs-Tokens speichert
YFStart im lokalen Speicher von Chrome (`chrome.storage.local`) auf dem eigenen Gerät. Ohne
eingeschalteten Sync (siehe unten) werden diese Daten nicht synchronisiert und an niemanden übertragen. Beim Entfernen der Erweiterung
löscht Chrome sie.

## Was an andere Dienste geht

- **Sync (nur wenn eingeschaltet):** Verknüpfungen, Gruppen, eingetragene PCs (ohne Kopplungs-Tokens),
  Wetter-Ort und Einstellungen (ohne Hintergrundbild und ohne hochgeladene Icons) speichert Chrome über
  `chrome.storage.sync` im eigenen Google-Konto, damit sie auf den anderen eigenen PCs ankommen. Dafür
  gilt die Datenschutzerklärung von Google.
- **Lesezeichen (nur beim Import):** YFStart liest die Lesezeichen erst, wenn „Lesezeichen“ geklickt und
  der Zugriff in Chrome erlaubt wurde, und nur auf dem eigenen Gerät. Übernommen werden nur die
  ausgewählten Links.

- **Google-Suchvorschläge:** Text, der in das Suchfeld getippt wird, geht direkt an
  `suggestqueries.google.com`, um Vorschläge anzuzeigen. Abgeschickte Suchen öffnen
  `www.google.com`. Dafür gilt die Datenschutzerklärung von Google.
- **Wetter (nur wenn eingeschaltet):** Der eingegebene Ortsname geht an
  `geocoding-api.open-meteo.com`, die Koordinaten des Orts an `api.open-meteo.com`.
- **Symbole:** Für Shortcuts ohne eigenes Icon lädt YFStart das Favicon über
  `www.google.com/s2/favicons` mit der Adresse des Shortcuts. Kennt Google die Seite nicht, fragt
  YFStart die Seite selbst nach `/favicon.ico` bzw. `/apple-touch-icon.png`. Die Symbole der Google-Apps kommen
  von `ssl.gstatic.com`.
- **YFRemote-PCs:** Befehle, Kopplungsanfragen (mit der eingegebenen PIN) und Statusabfragen gehen
  nur an die PCs, die selbst eingetragen wurden, in der Regel im eigenen Heimnetz. Zugriff auf
  eine PC-Adresse fragt Chrome beim ersten Benutzen einzeln ab.

## Was YFStart nicht tut

- Keine Analyse-, Tracking- oder Werbedienste.
- Kein Verkauf und keine Weitergabe von Daten.
- Kein nachgeladener Code: Die Erweiterung führt nur den Code aus, der im Paket enthalten ist.

## Kontakt

Fragen zum Datenschutz: über die Support-Angabe im Chrome Web Store.
