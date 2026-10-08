'use strict';
// Futbolero – Grundlagen: Maße, Hilfsfunktionen, Teams, Stärke-Profile, Speicher.
// Koordinaten: x entlang des Spielfelds (Tore bei x = ±HL), z quer dazu, y nach oben.
// Die Fernsehkamera steht bei +z, rechts auf dem Bildschirm ist also +x.

const FELD = { L:68, B:44 };
const HL = FELD.L / 2, HB = FELD.B / 2;
const TOR = { B:7.32, H:2.44, T:2.0, R:0.07 };        // Breite, Höhe, Tiefe, Pfostenradius
const STRAF = { T:12, B:28 };                          // Strafraum
const TORRAUM = { T:4.5, B:13 };
const ELFER_ABSTAND = 9;
const KREIS = 7;
const BALL_R = 0.2;
const GRAV = 10.5;
const SCHRITT = 1 / 120;                               // Simulationstakt
const BANDE = 4.5;                                     // Abstand der Werbebanden von den Linien

// Spielfeld-Art: Stadion, Halle (Glaswände statt Aus) oder Straße (Käfig mit kleinen Toren)
const ARENA = { art:'stadion', wand:false, wandH:0 };

const TEMPO = { lauf:6.4, sprint:8.7, kiLauf:5.5, kiSprint:8.2 };

/* ---------- Hilfsfunktionen ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const zufall = (a = 0, b = 1) => a + Math.random() * (b - a);
const zufallGanz = n => Math.floor(Math.random() * n);
const zufallAus = liste => liste[zufallGanz(liste.length)];
function gauss(){ let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const abstand = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const abstandXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function winkelDiff(a, b){ let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function glatt(aktuell, ziel, rate, dt){ return aktuell + (ziel - aktuell) * (1 - Math.exp(-rate * dt)); }
// Abstand eines Punkts von der Strecke a→b (nur in x/z) und wie weit entlang (0..1)
function streckenAbstand(px, pz, ax, az, bx, bz){
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return { d:Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}
function farbAbstand(a, b){
  const x = new THREE.Color(a), y = new THREE.Color(b);
  return Math.hypot(x.r - y.r, x.g - y.g, x.b - y.b);
}

/* ---------- Teams ---------- */
// Frei erfundene Tier-Mannschaften, passend zu den anderen Spielen der Sammlung.
const TEAMS = [
  { id:'loewen',    name:'Löwen',     kurz:'LÖW', staerke:3,
    heim:{ trikot:'#f2b705', hose:'#1b1b1b', stutzen:'#f2b705', nummer:'#1b1b1b' },
    ausw:{ trikot:'#1b1b1b', hose:'#1b1b1b', stutzen:'#f2b705', nummer:'#f2b705' } },
  { id:'haie',      name:'Haie',      kurz:'HAI', staerke:3,
    heim:{ trikot:'#1f6fd1', hose:'#ffffff', stutzen:'#1f6fd1', nummer:'#ffffff' },
    ausw:{ trikot:'#eaf2fb', hose:'#1f6fd1', stutzen:'#eaf2fb', nummer:'#1f6fd1' } },
  { id:'adler',     name:'Adler',     kurz:'ADL', staerke:4,
    heim:{ trikot:'#c0272d', hose:'#ffffff', stutzen:'#c0272d', nummer:'#ffffff' },
    ausw:{ trikot:'#ffffff', hose:'#c0272d', stutzen:'#ffffff', nummer:'#c0272d' } },
  { id:'fuechse',   name:'Füchse',    kurz:'FÜC', staerke:2,
    heim:{ trikot:'#ff7a1a', hose:'#2a1a0e', stutzen:'#ff7a1a', nummer:'#2a1a0e' },
    ausw:{ trikot:'#fff4ea', hose:'#ff7a1a', stutzen:'#fff4ea', nummer:'#ff7a1a' } },
  { id:'pinguine',  name:'Pinguine',  kurz:'PIN', staerke:2,
    heim:{ trikot:'#f4f6f8', hose:'#15181d', stutzen:'#15181d', nummer:'#15181d' },
    ausw:{ trikot:'#15181d', hose:'#15181d', stutzen:'#f4f6f8', nummer:'#f4f6f8' } },
  { id:'flamingos', name:'Flamingos', kurz:'FLA', staerke:1,
    heim:{ trikot:'#ff5fa2', hose:'#ffffff', stutzen:'#ff5fa2', nummer:'#ffffff' },
    ausw:{ trikot:'#ffffff', hose:'#ff5fa2', stutzen:'#ffffff', nummer:'#ff5fa2' } },
  { id:'woelfe',    name:'Wölfe',     kurz:'WÖL', staerke:4,
    heim:{ trikot:'#6f7b88', hose:'#23282f', stutzen:'#23282f', nummer:'#ffffff' },
    ausw:{ trikot:'#23282f', hose:'#6f7b88', stutzen:'#6f7b88', nummer:'#c9d1da' } },
  { id:'froesche',  name:'Frösche',   kurz:'FRÖ', staerke:1,
    heim:{ trikot:'#c6f432', hose:'#123d1e', stutzen:'#c6f432', nummer:'#123d1e' },
    ausw:{ trikot:'#123d1e', hose:'#c6f432', stutzen:'#123d1e', nummer:'#c6f432' } },
  { id:'baeren',    name:'Bären',     kurz:'BÄR', staerke:5,
    heim:{ trikot:'#7a4a2a', hose:'#f2e6d8', stutzen:'#7a4a2a', nummer:'#f2e6d8' },
    ausw:{ trikot:'#f2e6d8', hose:'#7a4a2a', stutzen:'#f2e6d8', nummer:'#7a4a2a' } }
];
const TORWART_FARBEN = ['#8e44ad', '#00b8d4', '#e84393', '#2d3436', '#ff9f1a'];

// Trikots so wählen, dass man die Teams auseinanderhalten kann
function trikotsWaehlen(a, b){
  const kitA = a.heim;
  let kitB = b.heim;
  if (farbAbstand(kitA.trikot, kitB.trikot) < 0.45 || a.id === b.id) kitB = b.ausw;
  const tw = [];
  for (const kit of [kitA, kitB]){
    let beste = TORWART_FARBEN[0], bestAbst = -1;
    for (const f of TORWART_FARBEN){
      if (tw.includes(f)) continue;
      const d = Math.min(farbAbstand(f, kitA.trikot), farbAbstand(f, kitB.trikot), farbAbstand(f, '#1a7d45'));
      if (d > bestAbst){ bestAbst = d; beste = f; }
    }
    tw.push(beste);
  }
  return [{ ...kitA, torwart:tw[0] }, { ...kitB, torwart:tw[1] }];
}

/* ---------- Aufstellungen ----------
   x: 0 = eigene Torlinie, 1 = gegnerische Torlinie; z: -1..1 quer zum Feld. */
const FORMATIONEN = {
  5:[
    { rolle:'TW', x:0.02, z:0 },
    { rolle:'AB', x:0.24, z:-0.42 },
    { rolle:'AB', x:0.24, z:0.42 },
    { rolle:'MI', x:0.44, z:0 },
    { rolle:'ST', x:0.62, z:0.1 }
  ],
  7:[
    { rolle:'TW', x:0.02, z:0 },
    { rolle:'AB', x:0.22, z:-0.55 },
    { rolle:'AB', x:0.2,  z:0 },
    { rolle:'AB', x:0.22, z:0.55 },
    { rolle:'MI', x:0.42, z:-0.4 },
    { rolle:'MI', x:0.42, z:0.4 },
    { rolle:'ST', x:0.64, z:0 }
  ]
};
const NUMMERN = { TW:[1], AB:[4, 5, 2, 3], MI:[8, 10, 6], ST:[9, 11, 7] };

/* ---------- Stärke ----------
   Stufe 0 = Leicht, 1 = Normal, 2 = Schwer. Im Pokal steigt sie pro Runde etwas. */
const STUFEN = { leicht:0, normal:1, schwer:2 };
function profil(stufe){
  const t = clamp(stufe, 0, 2.6);
  const w = (a, b, c) => t <= 1 ? lerp(a, b, t) : lerp(b, c, t - 1);
  return {
    tempo:w(0.86, 0.96, 1.03),        // Laufgeschwindigkeit
    denken:w(0.55, 0.34, 0.2),        // Sekunden zwischen Entscheidungen am Ball
    klau:w(0.8, 1.45, 2.2),           // Balleroberungen pro Sekunde im Zweikampf
    passFehler:w(0.13, 0.07, 0.035),  // Streuung in Radiant
    schussFehler:w(1.45, 1.0, 0.72),
    twReaktion:w(0.32, 0.24, 0.18),
    twTempo:w(4.0, 4.7, 5.15),
    twReich:w(0.9, 1.0, 1.07),
    graetsche:w(0.04, 0.16, 0.34),
    schussLust:w(0.75, 1, 1.2),
    lesen:w(0.2, 0.34, 0.5)           // Elfmeter: Ecke erraten
  };
}

/* ---------- Speicher im Browser ---------- */
const SPEICHER_KEY = 'futbolero-v1';
function speicherLaden(){
  try { return JSON.parse(localStorage.getItem(SPEICHER_KEY)) || {}; } catch (e) { return {}; }
}
const gespeichert = speicherLaden();
const einstellungen = Object.assign({
  modus:'freund', team:0, gegner:1, groesse:5, stufe:'normal', dauer:4, qualitaet:'hoch', ton:true,
  arena:'stadion', powerups:'aus', uebung:'freistoss', kamera:'tv'
}, gespeichert.einstellungen || {});
const bilanz = Object.assign({ siege:0, unentschieden:0, niederlagen:0, tore:0, gegentore:0, pokale:0, meister:0, training:{} }, gespeichert.bilanz || {});
function speichern(){
  try { localStorage.setItem(SPEICHER_KEY, JSON.stringify({ einstellungen, bilanz })); } catch (e) { /* privat / voll */ }
}

const istTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches);
if (istTouch) document.documentElement.classList.add('touch');
