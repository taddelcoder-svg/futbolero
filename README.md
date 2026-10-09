# Futbolero – 3D-Fußball

Arcade-Fußball im Browser (three.js): Flutlichtstadion, 5 gegen 5 oder 7 gegen 7 gegen den Computer.
Dribbeln, flach passen, Heber, Schüsse mit Kraftanzeige, Direktabnahmen, Kopfbälle, Grätschen –
mit Einwurf, Ecke, Abstoß, Fouls, Karten, Freistoß, Elfmeter, Nachspielzeit, Halbzeit, Torjubel,
Wiederholung und Statistik nach dem Spiel.

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
- **Online-Liga:** Eine Saison mit Freunden. Wer die Liga gründet, legt Name und Regeln fest (5 oder 7 gegen 7,
  Spielzeit, Stärke des Computers, nur Hinrunde oder Hin- und Rückrunde) und bekommt einen fünfstelligen Code.
  Mit dem Code treten die anderen bei und nehmen sich ein freies Team, die übrigen spielt der Computer –
  auch mitten in der Saison kann man noch ein Computer-Team übernehmen. Ist die Saison gestartet, gilt:
  - Gegen ein Computer-Team spielt man allein, wann man will; das Ergebnis geht danach an den Server
    (klappt das nicht, schickt der Browser es beim nächsten Öffnen der Liga nach). Aufgeben zählt 0:3.
  - Gegen ein anderes Mitglied spielt man online: beide tippen auf „Zum Ligaspiel“, sind beide im Raum,
    wird nach fünf Sekunden angepfiffen. Das Ergebnis trägt der Server ein. Bricht das Spiel schon in der
    ersten Halbzeit ab, zählt es nicht und kann neu gespielt werden.
  - Haben alle Menschen ihr Spiel des Spieltags gespielt, werden die Computer-Spiele nach Stärke ausgewürfelt
    und der nächste Spieltag beginnt. Wer die Liga gegründet hat, kann einen Spieltag auch vorher abschließen,
    dann werden fehlende Spiele ausgewürfelt.
  - Tabelle, Spieltage, Torjägerliste der Mitglieder und Meister früherer Saisons sieht jeder in der Liga.
    Am Saisonende startet die Ligaleitung die nächste Saison (die Regeln darf sie vorher ändern).
  Online-Ligaspiele laufen wie Online-Spiele mit neutralen Spielerwerten. Wer welche Liga spielt, merkt sich
  der Browser (Code und ein geheimer Schlüssel je Liga, keine Passwörter).
- **Olympiade:** Disziplin der Swimming-Lions-Olympiade. Mit dem Ticket-Link (`?olymp=…`) landet die
  Gruppe automatisch in einem gemeinsamen Online-Raum, wird auf zwei Teams verteilt und spielt mit den
  Einstellungen der Disziplin. Angepfiffen wird, sobald alle da sind (spätestens nach 60 Sekunden).
  Der Server meldet die Rangliste: Sieg 2, Unentschieden 1, Niederlage 0 (× 100) plus eigene Tore.

## Fouls, Karten und Nachspielzeit

- Wer bei der Grätsche zuerst den Gegner statt den Ball trifft, foult. Dann gibt es Freistoß an der Stelle des
  Fouls, im eigenen Strafraum Elfmeter. Hat das gefoulte Team den Ball trotzdem, läuft das Spiel weiter (Vorteil).
- Von hinten gibt es eher Gelb; wer einen Gegner auf dem Weg zum Tor als letzter Mann umgrätscht (Notbremse),
  sieht oft Rot. Zweimal Gelb ist Gelb-Rot. Wer vom Platz fliegt, fehlt seinem Team bis zum Schluss – bei 5 gegen 5
  höchstens einer pro Team, bei 7 gegen 7 höchstens zwei, danach bleibt es bei Gelb.
- Die Computerspieler grätschen meist sauber von vorn, ab und zu aber auch mal ungestüm.
- Freistoß nah am Tor: Mauer aus zwei oder drei Spielern, Schuss halten = fester, Heber über die Mauer, Pass zum
  Mitspieler. Weiter weg wird der Freistoß wie ein Einwurf ausgeführt (Pass, Heber oder Schuss in Richtung).
  Elfmeter: Richtung = Ecke, Schuss halten = fester, Heber = Lupfer; alle anderen warten am Strafraum.
- Nach 45 Minuten zeigt die Tafel die Nachspielzeit: eine knappe Minute plus das, was Tore, Fouls, Karten und
  Elfmeter gekostet haben (1 bis 6 Minuten). Die Uhr läuft dann als 45+1', 45+2' … weiter. Ein Angriff vor dem
  Tor darf noch ein paar Sekunden zu Ende gespielt werden.

## Statistik nach dem Spiel

Zur Halbzeit und am Ende: Torschützen mit Minute unter dem Ergebnis, der Spieler des Spiels und zwei Reiter.
„Spiel“ vergleicht beide Teams mit Balken (Ballbesitz, Schüsse, aufs Tor, Pässe, Passquote, Balleroberungen, Ecken,
Paraden, Fouls, Karten, dazu die Karten mit Minute). „Spieler“ zeigt für jedes Team Tore, Vorlagen, Schüsse
(beim Torwart Paraden), Pässe mit Quote, Balleroberungen, Karten und eine Note von 1 bis 10. Online schickt der
Gastgeber die Statistik am Ende an alle.

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
Es gibt keine Konten. Für Online-Spiele und Online-Ligen wählt man einen Spitznamen.

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

### Speicher für die Online-Ligen: Supabase

Die Online-Ligen müssen Deploys und Neustarts überleben. Dafür speichert der Server sie in Supabase (wie bei
Blaue Stunde, es kann dasselbe Supabase-Projekt sein):

1. In Supabase unter **SQL Editor** den Inhalt von `supabase_setup.sql` ausführen (legt `futbolero_speicher` an).
2. In Render beim Dienst unter **Environment** eintragen:
   - `SUPABASE_URL`: die Projekt-URL, z. B. `https://xyz.supabase.co`
   - `SUPABASE_SERVICE_KEY`: der `service_role`-Schlüssel (Supabase → Project Settings → API). Er ist geheim und
     gehört nie ins Repo oder in den Browser.

Ohne diese beiden Variablen nutzt der Server eine JSON-Datei in `DATA_DIR` (Standard: `data/` neben `server.js`).
Auf Render ist die ohne Persistent Disk nach jedem Deploy leer – dann sind alle Ligen weg.
Es muss dasselbe sein wie bei der Olympiade, denn daraus wird auch der Schlüssel für die Tickets abgeleitet. `olymp.js` ist die Vorlage aus
`olympiade/geteilt/`; bei Änderungen dort hierher kopieren.

## Aufbau

```
server.js          liefert die Seite aus, Online-Räume, Ligaräume und Olympia (WebSocket /ws), Liga-API (/api/liga)
ligen.js           Online-Ligen: Mitglieder, Spielplan, Ergebnisse, Tabelle, Torjäger, Saisons
speicher.js        dauerhafter Speicher der Ligen (Supabase oder JSON-Datei)
supabase_setup.sql Tabelle für den Speicher in Supabase
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
  spiel.js         Spielablauf, Regeln, Fouls und Karten, Standards, Nachspielzeit, Wiederholung, Kamera
  spielarten.js    Halle und Straße, Powerups, Training für Standardsituationen
  elfmeter.js      Elfmeterschießen
  online.js        Online-Räume, Lobby, Spielstand senden und anzeigen
  liga.js          Liga und Karriere: Spielplan, Tabelle, Kader, Training, Transfermarkt
  ligaonline.js    Online-Liga: gründen, beitreten, Tabelle, Spieltag, Ergebnisse melden
  oberflaeche.js   Menü, Pokal, Dialoge, Statistik, HUD, Hauptschleife
vendor/            three.js r128 (MIT) und Barlow Semi Condensed (SIL OFL) – selbst ausgeliefert
```

Die Werbebanden im Stadion zeigen die anderen Spiele der Swimming-Lions-Sammlung.
