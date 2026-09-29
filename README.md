# Futbolero – 3D-Fußball

Arcade-Fußball im Browser (three.js): Flutlichtstadion, 5 gegen 5 oder 7 gegen 7 gegen den Computer.
Dribbeln, flach passen, Heber, Schüsse mit Kraftanzeige, Direktabnahmen, Kopfbälle, Grätschen –
mit Einwurf, Ecke, Abstoß, Halbzeit, Torjubel und Wiederholung.

## Modi

- **Freundschaftsspiel:** eigenes Team und Gegner wählen, Stärke Leicht/Normal/Schwer, 2, 4 oder 6 Minuten.
- **Pokal:** Viertelfinale, Halbfinale, Finale gegen immer stärkere Gegner. Bei Unentschieden gibt es
  Elfmeterschießen – als Schütze mit Fadenkreuz und Kraft, als Torwart wählst du die Ecke.

- **Online:** Raum erstellen, Code weitergeben, bis zu 12 Leute spielen zusammen oder gegeneinander.
  Jeder steuert einen Feldspieler, freie Plätze und die Torhüter übernimmt der Computer.
- **Olympiade:** Disziplin der Swimming-Lions-Olympiade. Mit dem Ticket-Link (`?olymp=…`) landet die
  Gruppe automatisch in einem gemeinsamen Online-Raum, wird auf zwei Teams verteilt und spielt mit den
  Einstellungen der Disziplin. Angepfiffen wird, sobald alle da sind (spätestens nach 60 Sekunden).
  Der Server meldet die Rangliste: Sieg 2, Unentschieden 1, Niederlage 0 (× 100) plus eigene Tore.

## So funktioniert Online

Der Browser des Gastgebers rechnet das Spiel wie im Einzelspieler. Die anderen schicken nur ihre
Eingaben (über den Server an den Gastgeber) und bekommen etwa 30-mal pro Sekunde den Spielstand, den
sie 100 ms verzögert und interpoliert anzeigen. Verlässt ein Mitspieler das Spiel, übernimmt der
Computer; verlässt der Gastgeber es, endet das Spiel mit dem aktuellen Stand.

Einstellungen und Bilanz (Siege, Tore, Pokale) bleiben im Browser gespeichert (`localStorage`).
Es gibt keine Konten. Für Online-Spiele wählt man einen Spitznamen.

## Steuerung

- **Tastatur:** Laufen mit WASD oder Pfeiltasten, Shift sprinten.
  Mit Ball: K Pass, J oder Leertaste Schuss (halten = fester), L Heber.
  Ohne Ball: K oder Q Spieler wechseln, J Grätsche, L Mitspieler presst mit (halten).
  P oder Esc Pause, M Ton.
- **Touch:** links wischen zum Laufen (ganz ausgelenkt = Sprint), rechts Knöpfe für Schuss, Pass, Heber und Sprint.
  Ohne Ball werden daraus Grätsche, Wechsel und Doppeln.
- **Controller:** linker Stick laufen, A Pass, B Schuss, X Heber, RT/RB Sprint, LB Wechsel, Start Pause.

Wer den Schuss-Knopf drückt, während ein Pass unterwegs ist, schießt direkt.

## Lokal starten

```bash
npm install
npm start
```

Dann http://localhost:10000 öffnen. Einzige Abhängigkeit ist `ws` (`npm install`), Node ≥ 18.

## Deployment (Render)

Das `Dockerfile` startet den Node-Server auf `$PORT` (Render: *New → Web Service*, Umgebung Docker).
`/healthz` antwortet mit `{"ok":true}`.

Umgebungsvariable `ZUGANG_PASSWORT`: das gemeinsame Passwort für Familie und Freunde (`zugang.js`,
wie bei den anderen Spielen). Ohne sie bleibt die Seite auf Render gesperrt, lokal ist sie offen.
Es muss dasselbe sein wie bei der Olympiade, denn daraus wird auch der Schlüssel für die Tickets abgeleitet. `olymp.js` ist die Vorlage aus
`olympiade/geteilt/`; bei Änderungen dort hierher kopieren.

## Aufbau

```
server.js          liefert die Seite aus, Online-Räume und Olympia (WebSocket /ws)
zugang.js          Passwortschutz (Vorlage aus olympiade/geteilt/)
olymp.js           Olympia-Anbindung (Vorlage aus olympiade/geteilt/)
index.html         Oberfläche und Styles
datenschutz.html   Datenschutzerklärung
js/
  grundlagen.js    Maße, Teams, Aufstellungen, Stärke-Profile, Speicher
  ton.js           Geräusche und Stadion-Atmosphäre (Web Audio, keine Dateien)
  stadion.js       Rasen, Linien, Tore, Banden, Tribünen mit Publikum, Flutlicht, Ball
  figuren.js       Spielerfiguren und ihre Haltungen
  physik.js        Ballflug, Pfosten, Netz, Pass- und Schussrechner
  ki.js            Taktik, Entscheidungen am Ball, Torwart
  eingabe.js       Tastatur, Touch, Controller
  spiel.js         Spielablauf, Regeln, Standards, Wiederholung, Kamera
  elfmeter.js      Elfmeterschießen
  online.js        Online-Räume, Lobby, Spielstand senden und anzeigen
  oberflaeche.js   Menü, Pokal, Dialoge, HUD, Hauptschleife
vendor/            three.js r128 (MIT) und Barlow Semi Condensed (SIL OFL) – selbst ausgeliefert
```

Die Werbebanden im Stadion zeigen die anderen Spiele der Swimming-Lions-Sammlung.
