# Futbolero – 3D-Fußball

Arcade-Fußball im Browser (three.js): Flutlichtstadion, 5 gegen 5 oder 7 gegen 7 gegen den Computer.
Dribbeln, flach passen, Heber, Schüsse mit Kraftanzeige, Direktabnahmen, Kopfbälle, Grätschen –
mit Einwurf, Ecke, Abstoß, Halbzeit, Torjubel und Wiederholung.

## Modi

- **Freundschaftsspiel:** eigenes Team und Gegner wählen, Stärke Leicht/Normal/Schwer, 2, 4 oder 6 Minuten.
- **Pokal:** Viertelfinale, Halbfinale, Finale gegen immer stärkere Gegner. Bei Unentschieden gibt es
  Elfmeterschießen – als Schütze mit Fadenkreuz und Kraft, als Torwart wählst du die Ecke.

Einstellungen und Bilanz (Siege, Tore, Pokale) bleiben im Browser gespeichert (`localStorage`).
Es gibt keine Konten und keine Online-Funktionen.

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
npm start
```

Dann http://localhost:10000 öffnen. Es gibt keine Abhängigkeiten außer Node ≥ 18.

## Deployment (Render)

Das `Dockerfile` startet den Node-Server auf `$PORT` (Render: *New → Web Service*, Umgebung Docker).
`/healthz` antwortet mit `{"ok":true}`.

## Aufbau

```
server.js          liefert die Seite, den Spielcode und vendor/ aus
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
  oberflaeche.js   Menü, Pokal, Dialoge, HUD, Hauptschleife
vendor/            three.js r128 (MIT) und Barlow Semi Condensed (SIL OFL) – selbst ausgeliefert
```

Die Werbebanden im Stadion zeigen die anderen Spiele der Swimming-Lions-Sammlung.
