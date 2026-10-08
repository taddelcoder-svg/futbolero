'use strict';
// Futbolero – Spielerwerte: Jeder Spieler hat Tempo, Schuss, Pass und Abwehr (beim Torwart: Halten).
// Die Werte hängen von der Stärke des Teams ab (in der Liga von Training und Transfers) und wirken
// sich spürbar, aber nicht übermächtig aus. Online spielen alle mit neutralen Werten.

const WERTE = ['tempo', 'schuss', 'pass', 'abwehr'];
const WERTE_KURZ = { tempo:'TEM', schuss:'SCH', pass:'PAS', abwehr:'ABW' };
const WERTE_NAME = { tempo:'Tempo', schuss:'Schuss', pass:'Passen', abwehr:'Abwehr' };
const ROLLEN_NAME = { TW:'Torwart', AB:'Abwehr', MI:'Mittelfeld', ST:'Sturm' };

const VORNAMEN = ['Leo', 'Mika', 'Jonas', 'Luca', 'Emil', 'Paul', 'Ben', 'Finn', 'Noah', 'Elias', 'Felix', 'Theo', 'Matteo',
  'Malik', 'Milan', 'Nico', 'Tim', 'Ole', 'Pepe', 'Kiko', 'Santi', 'Dani', 'Iker', 'Bruno', 'Hugo', 'Enzo', 'Rafa', 'Toni',
  'Jule', 'Lina', 'Mia', 'Ida', 'Nele', 'Frida', 'Romy', 'Alba', 'Lou', 'Maxi', 'Joscha', 'Yusuf', 'Aras', 'Kalle', 'Vito'];
// Spitznamen für Stars auf dem Transfermarkt
const STARNAMEN = ['El Rayo', 'Turbo-Tom', 'Kralle', 'Der Zauberer', 'Kanonen-Kim', 'Flinke Fee', 'Mauer-Max', 'Dribbel-Dina',
  'Il Capitano', 'Blitz-Bo', 'Die Krake', 'Sprint-Sami', 'Torjäger Jo', 'Kopfball-Kai', 'Samtfuß', 'La Pulga', 'Eisenfuß',
  'Bomber Bea', 'Wirbelwind', 'Der Professor'];

// Kleiner, fester Zufall aus einem Text (gleiche Eingabe → gleiche Zahl)
function hashZahl(text){
  let h = 2166136261;
  for (let i = 0; i < text.length; i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  // Zum Schluss gut durchmischen, sonst ähneln sich Texte, die sich nur im letzten Zeichen unterscheiden
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function gesamtWert(w){ return Math.round((w.tempo + w.schuss + w.pass + w.abwehr) / 4); }

// Grundwerte eines Spielers: Stärke 1..5 ergibt etwa 58..90, dazu Rolle und etwas Streuung
function werteFuer(teamId, rolle, nummer, staerke){
  const basis = 50 + staerke * 8;
  const neigung = { TW:{ tempo:-8, schuss:-14, pass:-4, abwehr:8 }, AB:{ tempo:-2, schuss:-6, pass:0, abwehr:7 },
    MI:{ tempo:2, schuss:0, pass:7, abwehr:-2 }, ST:{ tempo:5, schuss:8, pass:-2, abwehr:-9 } }[rolle];
  const w = {};
  for (const k of WERTE) w[k] = clamp(Math.round(basis + neigung[k] + (hashZahl(teamId + nummer + k) - 0.5) * 14), 30, 95);
  return w;
}
// Innerhalb eines Teams hat jede Rückennummer einen anderen Namen (7 und 43 sind teilerfremd)
function nameFuer(teamId, nummer){
  const L = VORNAMEN.length;
  return VORNAMEN[(Math.floor(hashZahl(teamId) * L) + nummer * 7) % L];
}

// Aus den Werten werden kleine Faktoren für Laufen, Schießen, Passen und Zweikämpfe
function faktorenAus(w, rolle){
  const d = k => (w[k] - 70) / 100;
  return {
    tempo:1 + d('tempo') * 0.16,
    schuss:clamp(1 - d('schuss') * 0.7, 0.72, 1.3),
    pass:clamp(1 - d('pass') * 0.8, 0.7, 1.35),
    abwehr:clamp(1 + d('abwehr') * 1.1, 0.6, 1.45),
    halten:rolle === 'TW' ? clamp(1 + d('abwehr') * 0.3, 0.9, 1.12) : 1
  };
}
const NEUTRAL = { tempo:1, schuss:1, pass:1, abwehr:1, halten:1 };

// Wie stark ein Spieler gerade laufen kann (Werte und aktive Powerups)
function tempoFaktor(p){
  let f = p.f ? p.f.tempo : 1;
  const pu = p.team.pu;
  if (pu){
    if (pu.turbo > 0) f *= 1.22;
    const g = gegnerVon(p.team).pu;
    if (g && g.eis > 0) f *= 0.72;
  }
  return f;
}

/* ---------- Spielerkarte im HUD ---------- */
const karteZustand = { spieler:null, an:false };
function spielerkarteAktualisieren(){
  const el = document.getElementById('spielerkarte');
  const p = spiel.gesteuert;
  const zeigen = !!p && p.werte && !['online', 'demo'].includes(spiel.modus) && ['spiel', 'warten'].includes(spiel.phase) && !WDH.abspielen;
  if (zeigen !== karteZustand.an){ karteZustand.an = zeigen; el.classList.toggle('an', zeigen); }
  if (!zeigen || p === karteZustand.spieler) return;
  karteZustand.spieler = p;
  el.textContent = '';
  const kopf = document.createElement('b');
  kopf.textContent = `${p.nummer} ${p.name}${p.star ? ' ★' : ''}`;
  el.appendChild(kopf);
  for (const k of WERTE){
    const s = document.createElement('span');
    s.textContent = `${WERTE_KURZ[k]} ${p.werte[k]}`;
    el.appendChild(s);
  }
}
