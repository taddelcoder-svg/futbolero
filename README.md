# Futbolero – 3D-Fußball

Arcade-Fußball im Browser (three.js): Flutlichtstadion, 5 gegen 5 oder 7 gegen 7 gegen den Computer.
Dribbeln, flach passen, Heber, Schüsse mit Kraftanzeige, Direktabnahmen, Kopfbälle, Grätschen –
mit Einwurf, Ecke, Abstoß, Halbzeit, Torjubel und Wiederholung.

## Modi

- **Freundschaftsspiel:** eigenes Team und Gegner wählen, Stärke Leicht/Normal/Schwer, 2, 4 oder 6 Minuten.
  Dazu das Spielfeld:
  - **Stadion:** wie gewohnt mit Aus, Ecken und Einwurf.
  - **Halle:** Glaswände direkt an den Linien, der Ball prallt ab, es gibt kein Aus.
  - **Straße:** Käfig mit Gitter, Asphalt, kleinere Tore und keine Zuschauer.
  Mit **Powerups** (Arcade) tauchen auf dem Feld Symbole auf. Wer drüberläuft, holt sie fürs Team:
  Turbo (schneller), Kanone (zwei harte, genaue Schüsse), Krake (Torwart hält fast alles) und Eis
  (Gegner langsamer).
- **Pokal:** Viertelfinale, Halbfinale, Finale gegen immer stärkere Gegner. Bei Unentschieden gibt es
  Elfmeterschießen – als Schütze mit Fadenkreuz und Kraft, als Torwart wählst du die Ecke.
- **Liga (Karriere):** Saison mit allen neun Teams, jeder gegen jeden. Deine Spiele spielst du selbst,
  die anderen werden nach Stärke ausgewürfelt; dazu Tabelle und Ergebnisse vom letzten Spieltag.
  Für Siege, Unentschieden und Tore gibt es Münzen, am Saisonende Preisgeld nach Platz. Mit Münzen
  trainierst du Tempo, Schuss, Passen und Abwehr (bis Stufe 10) oder holst Stars vom Transfermarkt
  (neue Angebote zur Saisonmitte und jeder neuen Saison). Die Gegner entwickeln sich von Saison zu
  Saison weiter. Aufgeben in der Liga zählt 0:3.
- **Training:** Standardsituationen üben, je 10 Versuche: Freistöße mit Mauer (werden immer weiter
  und spitzer), Elfmeter oder Ecken. Schuss halten = fester, Heber = Bogenlampe über die Mauer.
  Der beste Wert pro Übung wird gespeichert.
- **Online:** Raum erstellen, Code weitergeben, bis zu 12 Leute spielen zusammen oder gegeneinander.
  Jeder steuert einen Feldspieler, freie Plätze und die Torhüter übernimmt der Computer.
- **Olympiade:** Disziplin der Swimming-Lions-Olympiade. Mit dem Ticket-Link (`?olymp=…`) landet die
  Gruppe automatisch in einem gemeinsamen Online-Raum, wird auf zwei Teams verteilt und spielt mit den
  Einstellungen der Disziplin. Angepfiffen wird, sobald alle da sind (spätestens nach 60 Sekunden).
  Der Server meldet die Rangliste: Sieg 2, Unentschieden 1, Niederlage 0 (× 100) plus eigene Tore.

## Spielerwerte

Jeder Spieler hat Tempo, Schuss, Passen und Abwehr (beim Torwart steht Abwehr fürs Halten). Die Werte
kommen aus der Stärke des Teams und machen Spieler spürbar, aber nicht übermächtig schneller,
genauer oder zweikampfstärker. Oben links steht, wen du gerade steuerst und was er kann. Online spielen
alle mit neutralen Werten, damit es fair bleibt.

## Kamera und Wiederholungen

- **C** (oder der Kamera-Knopf oben rechts) wechselt die Kamera: Fernsehen, Nah dran, Hinter dem Spieler
  (dann zeigt „oben“ zum gegnerischen Tor) und Von oben.
- Jedes Tor wird wiederholt, abwechselnd hinter dem Tor, seitlich und von oben. **C** wechselt den
  Blickwinkel auch während der Wiederholung.
- Zur Halbzeit und am Ende kannst du dir alle Tore des Spiels noch einmal ansehen.
- In der Pause zeigt „Letzte Szene ansehen“ die letzten Sekunden.

## So funktioniert Online

Der Browser des Gastgebers rechnet das Spiel wie im Einzelspieler. Die anderen schicken nur ihre
Eingaben (über den Server an den Gastgeber) und bekommen etwa 30-mal pro Sekunde den Spielstand, den
sie 100 ms verzögert und interpoliert anzeigen. Verlässt ein Mitspieler das Spiel, übernimmt der
Computer; verlässt der Gastgeber es, endet das Spiel mit dem aktuellen Stand.

Einstellungen und Bilanz (Siege, Tore, Pokale, Meisterschaften, Trainingsrekorde) und die Liga-Karriere
bleiben im Browser gespeichert (`localStorage`).
Es gibt keine Konten. Für Online-Spiele wählt man einen Spitznamen.

## Steuerung

- **Tastatur:** Laufen mit WASD oder Pfeiltasten, Shift sprinten.
  Mit Ball: Leertaste Pass, linke Maustaste Schuss (halten = fester), Alt Heber.
  Ohne Ball: Strg links Grätsche, Leertaste oder Q Spieler wechseln, Alt Mitspieler presst mit (halten).
  K, J und L gehen weiterhin für Pass, Schuss und Heber.
  P oder Esc Pause, M Ton, C Kamera.
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
  werte.js         Spielerwerte, Namen, Spielerkarte im HUD
  ton.js           Geräusche und Stadion-Atmosphäre (Web Audio, keine Dateien)
  stadion.js       Rasen, Linien, Tore, Banden, Tribünen mit Publikum, Flutlicht, Ball
  figuren.js       Spielerfiguren und ihre Haltungen
  physik.js        Ballflug, Pfosten, Netz, Pass- und Schussrechner
  ki.js            Taktik, Entscheidungen am Ball, Torwart
  eingabe.js       Tastatur, Touch, Controller
  spiel.js         Spielablauf, Regeln, Standards, Wiederholung, Kamera
  spielarten.js    Halle und Straße, Powerups, Training für Standardsituationen
  elfmeter.js      Elfmeterschießen
  online.js        Online-Räume, Lobby, Spielstand senden und anzeigen
  liga.js          Liga und Karriere: Spielplan, Tabelle, Kader, Training, Transfermarkt
  oberflaeche.js   Menü, Pokal, Dialoge, HUD, Hauptschleife
vendor/            three.js r128 (MIT) und Barlow Semi Condensed (SIL OFL) – selbst ausgeliefert
```

Die Werbebanden im Stadion zeigen die anderen Spiele der Swimming-Lions-Sammlung.
