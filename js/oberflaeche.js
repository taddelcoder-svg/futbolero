'use strict';
// Futbolero – Oberfläche: Menü, Pokal, Dialoge (Pause, Halbzeit, Ende), HUD mit Radar und die Hauptschleife.

const $ = id => document.getElementById(id);
const RUNDEN = ['Viertelfinale', 'Halbfinale', 'Finale'];
const pokal = { aktiv:false, runde:0, gegner:[] };
let tippGezeigt = false;

function el(tag, klasse, text){
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
}

// Kleines Trikot als SVG (Farben stammen aus der festen Teamliste)
function trikotSvg(kit){
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'trikot'); svg.setAttribute('aria-hidden', 'true');
  const pfad = document.createElementNS(ns, 'path');
  pfad.setAttribute('d', 'M8 2l-6 4 2.5 4.5L6 10v12h12V10l1.5.5L22 6l-6-4c-.5 2-2 3-4 3s-3.5-1-4-3z');
  pfad.setAttribute('fill', kit.trikot); pfad.setAttribute('stroke', kit.hose); pfad.setAttribute('stroke-width', '1.4'); pfad.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(pfad);
  return svg;
}

/* ---------- Menü ---------- */
function menueEinrichten(){
  for (const gruppe of document.querySelectorAll('.wahl[data-einst]')){
    const name = gruppe.dataset.einst;
    for (const b of gruppe.querySelectorAll('button')){
      b.addEventListener('click', () => {
        Ton.start(); Ton.klick();
        const w = b.dataset.wert;
        einstellungen[name] = /^\d+$/.test(w) ? Number(w) : w;
        speichern();
        menueAktualisieren();
        if (name === 'qualitaet') qualitaetAnwenden();
        if (name === 'groesse' && spiel.modus === 'demo') demoStarten();
      });
    }
  }
  for (const b of document.querySelectorAll('.pfeil[data-team]')){
    b.addEventListener('click', () => {
      Ton.start(); Ton.klick();
      const feld = b.dataset.team, schritt = Number(b.dataset.schritt);
      let i = einstellungen[feld];
      do { i = (i + schritt + TEAMS.length) % TEAMS.length; }
      while (feld === 'gegner' && i === einstellungen.team);
      einstellungen[feld] = i;
      if (einstellungen.team === einstellungen.gegner) einstellungen.gegner = (einstellungen.team + 1) % TEAMS.length;
      speichern();
      menueAktualisieren();
    });
  }
  $('losKnopf').addEventListener('click', () => {
    Ton.start();
    if (einstellungen.modus === 'pokal') pokalStarten();
    else if (einstellungen.modus === 'online') onlineMenue();
    else if (einstellungen.modus === 'ligaonline') ligaOnlineMenue();
    else if (einstellungen.modus === 'liga'){ if (!karriere) karriereNeu(einstellungen.team); ligaZentrale(); }
    else if (einstellungen.modus === 'training') trainingStarten();
    else freundStarten();
  });
  $('karriereNeu').addEventListener('click', () => { Ton.start(); Ton.klick(); $('startEbene').classList.add('aus'); karriereBeendenFragen(); });
  $('pausenknopf').addEventListener('click', () => pauseUmschalten());
  $('tonknopf').addEventListener('click', () => tonUmschalten());
  $('kameraknopf').addEventListener('click', () => kameraUmschalten());
  eingabe.beiPause = pauseUmschalten;
  eingabe.beiTon = tonUmschalten;
  eingabe.beiKamera = kameraUmschalten;
  tonKnopfZeigen();
  menueAktualisieren();
}

function menueAktualisieren(){
  if (einstellungen.team === einstellungen.gegner) einstellungen.gegner = (einstellungen.team + 1) % TEAMS.length;
  for (const gruppe of document.querySelectorAll('.wahl[data-einst]')){
    const w = String(einstellungen[gruppe.dataset.einst]);
    for (const b of gruppe.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.wert === w));
  }
  const zeigeTeam = (ausgabe, t, kit) => {
    ausgabe.textContent = '';
    ausgabe.appendChild(trikotSvg(kit));
    ausgabe.appendChild(el('span', null, t.name));
  };
  const [kitA, kitB] = trikotsWaehlen(TEAMS[einstellungen.team], TEAMS[einstellungen.gegner]);
  zeigeTeam($('teamAnzeige'), TEAMS[einstellungen.team], kitA);
  zeigeTeam($('gegnerAnzeige'), TEAMS[einstellungen.gegner], kitB);
  const modus = einstellungen.modus;
  const zeige = (id, an) => { $(id).style.display = an ? '' : 'none'; };
  const lo = modus === 'ligaonline';   // Online-Liga: Team und Regeln legt die Liga fest
  zeige('gegnerZeile', modus === 'freund' || modus === 'training');
  zeige('arenaZeile', modus === 'freund');
  zeige('extrasZeile', modus === 'freund');
  zeige('uebungZeile', modus === 'training');
  zeige('dauerZeile', modus !== 'training' && !lo);
  zeige('groesseZeile', !lo);
  zeige('stufeZeile', !lo);
  zeige('ligaZeile', modus === 'liga');
  zeige('ligaOnlineZeile', lo);
  zeige('teamZeile', !(modus === 'liga' && karriere) && !lo);
  $('ligaInfo').textContent = ligaInfoText();
  $('karriereNeu').style.display = karriere ? '' : 'none';
  $('losKnopf').textContent = { pokal:'Pokal starten', online:'Online spielen', training:'Training starten', ligaonline:'Zur Online-Liga',
    liga:karriere ? 'Karriere fortsetzen' : 'Karriere starten' }[modus] || 'Anpfiff!';
  const n = Object.keys(meineLigen()).length;
  $('ligaOnlineInfo').textContent = n ? `Du spielst in ${n === 1 ? 'einer Liga' : n + ' Ligen'} mit.` : 'Gründe eine Liga mit Freunden oder tritt mit einem Code bei.';
  const b = $('bilanz');
  b.textContent = '';
  const spiele = bilanz.siege + bilanz.unentschieden + bilanz.niederlagen;
  if (spiele){
    b.appendChild(el('span', null, `Bilanz: ${bilanz.siege} S · ${bilanz.unentschieden} U · ${bilanz.niederlagen} N`));
    b.appendChild(el('span', null, `Tore: ${bilanz.tore}:${bilanz.gegentore}`));
    if (bilanz.pokale) b.appendChild(el('span', null, `🏆 × ${bilanz.pokale}`));
    if (bilanz.meister) b.appendChild(el('span', null, `Meister × ${bilanz.meister}`));
  }
}

function demoStarten(){
  const a = zufallGanz(TEAMS.length);
  let b = zufallGanz(TEAMS.length - 1); if (b >= a) b++;
  spielStarten({ heim:a, gast:b, groesse:einstellungen.groesse, stufe:1, dauer:99, modus:'demo' });
}

function zumMenue(){
  if (online.rolle !== 'aus' || online.ws) onlineTrennen();
  try { sessionStorage.removeItem(OLYMP_KEY); } catch (e) { /* privat */ }
  spiel.pause = false;
  pokal.aktiv = false;
  eingabe.aktiv = false;
  WDH.extra = null; WDH.abspielen = null;
  allesLoslassen();
  $('dialogEbene').classList.add('aus');
  $('hud').classList.remove('an');
  $('elfer').classList.remove('an');
  if (fadenkreuz) fadenkreuz.visible = false;
  menueAktualisieren();
  $('startEbene').classList.remove('aus');
  demoStarten();
  setTimeout(() => $('losKnopf').focus({ preventScroll:true }), 50);
}

/* ---------- Spiele starten ---------- */
// extra: arena, powerups, groesse, kader, staerken, gegnerStaerke (Liga) werden durchgereicht
// stufeName und dauer: feste Regeln (Online-Liga) statt der Einstellungen im Menü
function matchStarten({ heim, gast, modus, runde = 0, gegnerStaerke, stufeName, ...extra }){
  const basis = STUFEN[stufeName || einstellungen.stufe];
  const staerke = ((gegnerStaerke != null ? gegnerStaerke : TEAMS[gast].staerke) - 3) * 0.08;
  // Im Training ist der Torwart etwas gnädiger, sonst wird es schnell frustrierend
  const stufe = modus === 'pokal' ? basis + runde * 0.28 + staerke : basis + staerke - (modus === 'training' ? 0.7 : 0);
  const groesse = extra.groesse || einstellungen.groesse, dauer = extra.dauer || einstellungen.dauer;
  $('startEbene').classList.add('aus');
  $('dialogEbene').classList.add('aus');
  if (document.activeElement) document.activeElement.blur();
  spielStarten({ ...extra, heim, gast, groesse, stufe, dauer, modus, runde });
  spiel.gezaehlt = false;
  $('hud').classList.add('an');
  eingabe.aktiv = true;
  allesLoslassen();
  Ton.start();
  Ton.stimmungSetzen(0.35);
  if (!tippGezeigt && !istTouch){
    tippGezeigt = true;
    tippZeigen('Leertaste Pass · Linke Maus Schuss (halten) · Alt Heber · Strg Grätsche · Shift Sprint', 8);
  }
}

function freundStarten(){
  matchStarten({ heim:einstellungen.team, gast:einstellungen.gegner, modus:'freund',
    arena:einstellungen.arena, powerups:einstellungen.powerups === 'an' });
}

function pokalStarten(){
  const andere = TEAMS.map((t, i) => i).filter(i => i !== einstellungen.team);
  for (let i = andere.length - 1; i > 0; i--){ const j = zufallGanz(i + 1); [andere[i], andere[j]] = [andere[j], andere[i]]; }
  pokal.gegner = andere.slice(0, 3).sort((a, b) => TEAMS[a].staerke - TEAMS[b].staerke);
  pokal.aktiv = true; pokal.runde = 0;
  $('startEbene').classList.add('aus');
  pokalRundeZeigen();
}

function pokalRundeZeigen(){
  const inhalt = el('div');
  inhalt.appendChild(el('p', 'hinweis', `${RUNDEN[pokal.runde]} gegen die ${TEAMS[pokal.gegner[pokal.runde]].name}. Bei Unentschieden gibt es Elfmeterschießen.`));
  const baum = el('div', 'baum');
  RUNDEN.forEach((r, i) => {
    const k = el('div', i === pokal.runde ? 'jetzt' : i < pokal.runde ? 'durch' : '');
    k.appendChild(el('small', null, r));
    k.appendChild(document.createTextNode((i < pokal.runde ? '✓ ' : '') + TEAMS[pokal.gegner[i]].name));
    baum.appendChild(k);
  });
  inhalt.appendChild(baum);
  dialogZeigen('Pokal', inhalt, [
    { text:'Anpfiff!', aktion:() => matchStarten({ heim:einstellungen.team, gast:pokal.gegner[pokal.runde], modus:'pokal', runde:pokal.runde }) },
    { text:'Zurück zum Menü', zweit:true, aktion:zumMenue }
  ]);
}

/* ---------- Dialoge ---------- */
function dialogZeigen(titel, inhalt, knoepfe){
  eingabe.aktiv = false;
  allesLoslassen();
  $('dialogTitel').textContent = titel;
  const i = $('dialogInhalt'); i.textContent = ''; if (inhalt) i.appendChild(inhalt);
  const k = $('dialogKnoepfe'); k.textContent = '';
  for (const kn of knoepfe){
    const b = el('button', 'knopf' + (kn.zweit ? ' zweit' : ''), kn.text);
    b.addEventListener('click', () => { Ton.start(); Ton.klick(); kn.aktion(); });
    k.appendChild(b);
  }
  $('dialogEbene').classList.remove('aus');
  setTimeout(() => { const erster = k.querySelector('button'); if (erster) erster.focus({ preventScroll:true }); }, 60);
}
function dialogSchliessen(){
  $('dialogEbene').classList.add('aus');
  if (document.activeElement) document.activeElement.blur();
  eingabe.aktiv = true;
  allesLoslassen();
}

function pauseUmschalten(){
  // Eine Extra-Wiederholung (Szene, Highlights) bricht Esc nur ab
  if (WDH.extra){ extraEnde(); return; }
  // Online läuft das Spiel für alle weiter
  if (spiel.modus === 'demo' || spiel.modus === 'online') return;
  const offen = !$('dialogEbene').classList.contains('aus');
  if (spiel.pause){ spiel.pause = false; dialogSchliessen(); return; }
  if (offen || ['halbzeit', 'ende'].includes(spiel.phase)) return;
  spiel.pause = true;
  pauseDialog();
}
function pauseDialog(){
  const inhalt = el('p', 'hinweis', `${spiel.teams[0].daten.name} ${spiel.teams[0].tore} : ${spiel.teams[1].tore} ${spiel.teams[1].daten.name}`);
  const knoepfe = [{ text:'Weiter', aktion:() => { spiel.pause = false; dialogSchliessen(); } }];
  if (WDH.gesamt > 60 && spiel.modus !== 'training') knoepfe.push({ text:'Letzte Szene ansehen', zweit:true, aktion:() => extraZeigen([szeneAusschnitt()], pauseDialog) });
  knoepfe.push(aufgebenKnopf());
  dialogZeigen('Pause', inhalt, knoepfe);
}
// In den Ligen zählt Aufgeben 0:3 (in der Pause und zur Halbzeit), sonst geht es zurück ins Menü
function aufgebenKnopf(){
  if (spiel.modus === 'liga' && karriere) return { text:'Aufgeben (zählt 0:3)', zweit:true, aktion:() => { spiel.gezaehlt = true; spieltagAbschliessen(0, 3); ligaZentrale(); } };
  if (spiel.modus === 'ligaonline') return { text:'Aufgeben (zählt 0:3)', zweit:true, aktion:async () => {
    spiel.gezaehlt = true; spiel.pause = false; spiel.phase = 'ende';
    const code = ligaOnline.spiel.code;
    dialogZeigen('Aufgegeben', el('p', 'hinweis', 'Das 0:3 wird an die Liga gemeldet …'), []);
    const r = await ligaErgebnisMelden(0, 3, 0, true);
    ligaOnlineZeigen(code, r.ok ? null : `Das Ergebnis konnte nicht gemeldet werden: ${r.text}`);
  } };
  return { text:'Aufgeben', zweit:true, aktion:zumMenue };
}

// Extra-Wiederholung über dem Dialog: Dialog weg, abspielen, danach „zurueck“ aufrufen
function extraZeigen(ausschnitte, zurueck){
  $('dialogEbene').classList.add('aus');
  if (document.activeElement) document.activeElement.blur();
  allesLoslassen();
  eingabe.aktiv = true;
  tippZeigen('Tippen oder Taste: weiter · C: Blickwinkel', 4);
  // Kurz warten, damit der Tipp zum Überspringen nicht gleich einen Knopf im Dialog trifft
  extraWiederholung(ausschnitte, () => { allesLoslassen(); eingabe.aktiv = false; setTimeout(zurueck, 300); });
}
function highlightsZeigen(zurueck){
  extraZeigen(WDH.highlights.map(h => ({ ...h })), zurueck);
}
function highlightKnopf(zurueck){
  const n = WDH.highlights.length;
  return n ? { text:n === 1 ? 'Tor ansehen' : `Alle ${n} Tore ansehen`, zweit:true, aktion:() => highlightsZeigen(zurueck) } : null;
}

function kameraUmschalten(){
  if (WDH.abspielen){
    WDH.ansicht = (WDH.ansicht + 1) % WDH_ANSICHTEN.length;
    kam.schnitt = true;
    tippZeigen('Wiederholung: ' + WDH_ANSICHTEN[WDH.ansicht], 2);
    return;
  }
  if (!$('hud').classList.contains('an')) return;
  const i = KAMERAS.indexOf(einstellungen.kamera);
  einstellungen.kamera = KAMERAS[(i + 1) % KAMERAS.length];
  speichern();
  kam.schnitt = true;
  let text = 'Kamera: ' + KAMERA_NAME[einstellungen.kamera];
  if (einstellungen.kamera === 'hinten') text += ' (oben = Richtung gegnerisches Tor)';
  tippZeigen(text, 3);
}

function tonUmschalten(){
  Ton.start();
  Ton.anAus(!einstellungen.ton);
  tonKnopfZeigen();
}
function tonKnopfZeigen(){
  const k = $('tonknopf');
  k.setAttribute('aria-label', einstellungen.ton ? 'Ton aus' : 'Ton an');
  k.textContent = '';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M3 7h3l4-4v14l-4-4H3z'); p.setAttribute('fill', 'currentColor');
  svg.appendChild(p);
  const w = document.createElementNS(ns, 'path');
  w.setAttribute('d', einstellungen.ton ? 'M13 6.5a5 5 0 010 7M15.5 4a8.5 8.5 0 010 12' : 'M13 7l5 6M18 7l-5 6');
  w.setAttribute('stroke', 'currentColor'); w.setAttribute('stroke-width', '1.8'); w.setAttribute('fill', 'none'); w.setAttribute('stroke-linecap', 'round');
  svg.appendChild(w);
  k.appendChild(svg);
}

/* ---------- Statistik nach dem Spiel ----------
   Alles, was nach dem Spiel gezeigt wird, steckt in einem einfachen Objekt. Online schickt der Gastgeber
   es mit dem Endstand an alle, damit jeder dieselbe Statistik sieht. */
function spielerNote(p, sieger){
  const ps = p.ps, team = p.team;
  let n = 6;
  n += ps.tore * 1.1 + ps.vorlagen * 0.7 + ps.aufsTor * 0.12 - Math.max(0, ps.schuesse - ps.aufsTor) * 0.05;
  n += ps.eroberungen * 0.14;
  if (ps.paesse >= 3) n += (ps.angekommen / ps.paesse - 0.7) * 1.6;
  n -= ps.fouls * 0.2 + p.gelb * 0.3 + (p.weg ? 1.5 : 0);
  const gegentore = gegnerVon(team).tore;
  if (p.rolle === 'TW') n += Math.min(ps.paraden, 10) * 0.2 - gegentore * 0.5 + (gegentore === 0 ? 0.5 : 0);
  else if (p.rolle === 'AB') n += gegentore === 0 ? 0.4 : -gegentore * 0.12;
  n += sieger === team.idx ? 0.4 : sieger === -1 ? 0 : -0.3;
  return clamp(Math.round(n * 10) / 10, 1, 10);
}

function statistikDaten(){
  const [a, b] = spiel.teams;
  const gesamt = a.stat.besitz + b.stat.besitz || 1;
  const sieger = a.tore > b.tore ? 0 : b.tore > a.tore ? 1 : -1;
  let sds = null;
  const spieler = spiel.teams.map(t => t.spieler.map(p => {
    const ps = p.ps, note = spielerNote(p, sieger);
    const zeile = { nr:p.nummer, name:p.name, rolle:p.rolle, tore:ps.tore, vorl:ps.vorlagen, sch:ps.schuesse,
      pa:ps.paesse, pq:ps.paesse ? Math.round(ps.angekommen / ps.paesse * 100) : -1, erob:ps.eroberungen, par:ps.paraden,
      fouls:ps.fouls, karte:p.weg ? 'rot' : p.gelb ? 'gelb' : '', note };
    if (!sds || note > sds.note || (note === sds.note && t.idx === sieger)) sds = { team:t.idx, nr:p.nummer, name:p.name, note };
    return zeile;
  }));
  return {
    teams:spiel.teams.map(t => ({ name:t.daten.name, kurz:t.daten.kurz, farbe:t.kit.trikot, rand:t.kit.hose, tore:t.tore,
      s:{ ...t.stat, besitz:Math.round(t.stat.besitz / gesamt * 100) } })),
    tore:spiel.torliste.slice(0, 40), karten:spiel.karten.slice(0, 30), spieler, sds
  };
}

// Kleines Trikot aus den Farben im Statistik-Objekt
const farbeOk = (c, std = '#8a96a3') => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : std;
function trikotAus(t){ return trikotSvg({ trikot:farbeOk(t.farbe), hose:farbeOk(t.rand, '#20262e') }); }

function torschuetzenText(d, idx){
  const nachName = new Map();
  for (const t of d.tore){
    if (t.team !== idx) continue;
    const name = (t.mensch || t.name) + (t.eigentor ? ' (ET)' : '');
    if (!nachName.has(name)) nachName.set(name, []);
    nachName.get(name).push(t.min);
  }
  return [...nachName].map(([n, m]) => `${n} ${m.join(', ')}`).join(' · ');
}

function ergebnisBlock(zusatz, d = statistikDaten()){
  const e = el('div', 'ergebnis');
  const seite = (t, i) => {
    const s = el('div', 'seite');
    s.appendChild(trikotAus(t)); s.appendChild(el('span', null, t.name));
    const torText = torschuetzenText(d, i);
    if (torText) s.appendChild(el('small', 'torschuetzen', torText));
    return s;
  };
  e.appendChild(seite(d.teams[0], 0));
  e.appendChild(el('span', 'stand', `${d.teams[0].tore} : ${d.teams[1].tore}`));
  e.appendChild(seite(d.teams[1], 1));
  const w = el('div');
  w.appendChild(e);
  if (zusatz) w.appendChild(el('p', 'hinweis', zusatz));
  return w;
}

function kartenSymbol(art){ return el('i', 'mini-karte ' + (art === 'gelb' ? 'gelb' : 'rot')); }
const NOTE_TEXT = n => n.toFixed(1).replace('.', ',');

function statistikBereich(d = statistikDaten()){
  const box = el('div', 'statbox');
  if (d.sds){
    const sds = el('p', 'sds');
    sds.appendChild(el('b', null, 'Spieler des Spiels'));
    sds.appendChild(el('span', null, `${d.sds.nr} ${d.sds.name} · ${d.teams[d.sds.team].name} · Note ${NOTE_TEXT(d.sds.note)}`));
    box.appendChild(sds);
  }
  const reiter = el('div', 'wahl reiter');
  const inhalt = el('div');
  const ansichten = [['Spiel', () => teamStatistik(d)], ['Spieler', () => spielerStatistik(d, statistikBereich.team || 0)]];
  const zeigen = i => {
    statistikBereich.reiter = i;
    [...reiter.children].forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    inhalt.textContent = '';
    inhalt.appendChild(ansichten[i][1]());
  };
  ansichten.forEach(([name], i) => {
    const b = el('button', null, name);
    b.addEventListener('click', () => { Ton.klick(); zeigen(i); });
    reiter.appendChild(b);
  });
  box.appendChild(reiter);
  box.appendChild(inhalt);
  zeigen(statistikBereich.reiter || 0);
  return box;
}

function teamStatistik(d){
  const [a, b] = d.teams.map(t => t.s);
  const quote = s => s.paesse ? Math.round(s.angekommen / s.paesse * 100) : 0;
  const zeilen = [
    ['Ballbesitz', a.besitz, b.besitz, ' %'],
    ['Schüsse', a.schuesse, b.schuesse],
    ['Aufs Tor', a.aufsTor, b.aufsTor],
    ['Pässe', a.paesse, b.paesse],
    ['Passquote', quote(a), quote(b), ' %'],
    ['Balleroberungen', a.zweikaempfe, b.zweikaempfe],
    ['Ecken', a.ecken, b.ecken],
    ['Paraden', a.paraden, b.paraden],
    ['Fouls', a.fouls, b.fouls],
    ['Gelbe Karten', a.gelb, b.gelb],
    ['Rote Karten', a.rot, b.rot]
  ];
  const w = el('div', 'statistik');
  for (const [name, x, y, einheit = ''] of zeilen){
    if (name === 'Rote Karten' && !x && !y) continue;
    const z = el('div', 'statzeile');
    z.appendChild(el('span', null, x + einheit));
    z.appendChild(el('span', null, name));
    z.appendChild(el('span', null, y + einheit));
    const balken = el('div', 'statbalken');
    const summe = x + y;
    const l = el('i'), r = el('i');
    l.style.width = (summe ? x / summe * 100 : 50) + '%'; l.style.background = farbeOk(d.teams[0].farbe);
    r.style.width = (summe ? y / summe * 100 : 50) + '%'; r.style.background = farbeOk(d.teams[1].farbe);
    if (!summe){ l.style.opacity = r.style.opacity = '.25'; }
    balken.appendChild(l); balken.appendChild(r);
    z.appendChild(balken);
    w.appendChild(z);
  }
  if (d.karten.length){
    const k = el('p', 'hinweis klein kartenliste');
    k.appendChild(el('span', null, 'Karten: '));
    d.karten.forEach((c, i) => {
      if (i) k.appendChild(document.createTextNode(' · '));
      k.appendChild(kartenSymbol(c.art === 'gelb' ? 'gelb' : 'rot'));
      k.appendChild(document.createTextNode(`${c.name} (${d.teams[c.team].kurz}) ${c.min}${c.art === 'gelbrot' ? ' Gelb-Rot' : ''}`));
    });
    w.appendChild(k);
  }
  return w;
}

function spielerStatistik(d, teamIdx){
  const w = el('div');
  const wahl = el('div', 'wahl teamreiter');
  d.teams.forEach((t, i) => {
    const b = el('button');
    b.appendChild(trikotAus(t)); b.appendChild(el('span', null, t.name));
    b.setAttribute('aria-pressed', String(i === teamIdx));
    b.addEventListener('click', () => { Ton.klick(); statistikBereich.team = i; w.replaceWith(spielerStatistik(d, i)); });
    wahl.appendChild(b);
  });
  w.appendChild(wahl);
  const t = el('table', 'tabelle spielerstat');
  const kopf = el('tr');
  for (const [h, titel] of [['Nr', 'Rückennummer'], ['Name', ''], ['Pos', 'Position'], ['T', 'Tore'], ['V', 'Vorlagen'], ['Sch', 'Schüsse'], ['Pässe', 'Pässe und Passquote'], ['Erob', 'Balleroberungen'], ['Note', 'Bewertung von 1 bis 10']]){
    const th = el('th', null, h);
    if (titel) th.title = titel;
    kopf.appendChild(th);
  }
  t.appendChild(kopf);
  const rang = { TW:0, AB:1, MI:2, ST:3 };
  for (const sp of d.spieler[teamIdx].slice().sort((a, b) => rang[a.rolle] - rang[b.rolle] || a.nr - b.nr)){
    const tr = el('tr', d.sds && d.sds.team === teamIdx && d.sds.nr === sp.nr ? 'ich' : '');
    tr.appendChild(el('td', null, String(sp.nr)));
    const name = el('td', 'name');
    name.appendChild(el('span', null, sp.name));
    if (sp.karte) name.appendChild(kartenSymbol(sp.karte));
    tr.appendChild(name);
    tr.appendChild(el('td', null, sp.rolle));
    tr.appendChild(el('td', null, sp.tore ? String(sp.tore) : '–'));
    tr.appendChild(el('td', null, sp.vorl ? String(sp.vorl) : '–'));
    tr.appendChild(el('td', null, sp.rolle === 'TW' ? `${sp.par} P` : String(sp.sch)));
    tr.appendChild(el('td', null, sp.pa ? `${sp.pa} · ${sp.pq} %` : '–'));
    tr.appendChild(el('td', null, String(sp.erob)));
    tr.appendChild(el('td', 'pkt note' + (sp.note >= 8 ? ' gut' : sp.note < 5 ? ' schwach' : ''), NOTE_TEXT(sp.note)));
    t.appendChild(tr);
  }
  w.appendChild(t);
  w.appendChild(el('p', 'hinweis klein', 'T Tore · V Vorlagen · Sch Schüsse (beim Torwart P = Paraden) · Erob Balleroberungen · Note von 1 bis 10'));
  return w;
}

function zeigeHalbzeit(){
  const inhalt = ergebnisBlock();
  inhalt.appendChild(statistikBereich());
  const knoepfe = [{ text:'Zweite Halbzeit', aktion:() => { dialogSchliessen(); zweiteHalbzeit(); } }];
  const h = highlightKnopf(zeigeHalbzeit);
  if (h) knoepfe.push(h);
  knoepfe.push(aufgebenKnopf());
  dialogZeigen('Halbzeit', inhalt, knoepfe);
}

function spielEndeEntscheiden(){
  const [a, b] = spiel.teams;
  if (spiel.modus === 'online'){ spiel.phase = 'ende'; onlineHostEnde(); return; }
  if (spiel.modus === 'pokal' && a.tore === b.tore && !spiel.elfmeter){ elfmeterStarten(); return; }
  spiel.phase = 'ende';
  zeigeEnde();
}

function zeigeEnde(){
  const [a, b] = spiel.teams;
  let sieger = a.tore > b.tore ? 0 : b.tore > a.tore ? 1 : -1;
  const E = spiel.elfmeter;
  let zusatz = null;
  if (E && E.gewinner >= 0){
    sieger = E.gewinner;
    zusatz = `Im Elfmeterschießen ${E.ergebnisse[0].filter(Boolean).length} : ${E.ergebnisse[1].filter(Boolean).length}`;
  }
  const pokalsieg = spiel.modus === 'pokal' && sieger === 0 && pokal.runde === 2;
  if (!spiel.gezaehlt){
    spiel.gezaehlt = true;
    if (sieger === 0) bilanz.siege++; else if (sieger === 1) bilanz.niederlagen++; else bilanz.unentschieden++;
    bilanz.tore += a.tore; bilanz.gegentore += b.tore;
    if (pokalsieg) bilanz.pokale++;
    speichern();
    spiel.ligaLohn = spiel.modus === 'liga' && karriere ? ligaSpielGezaehlt(a.tore, b.tore) : 0;
    if (spiel.modus === 'ligaonline'){
      spiel.ligaStatus = 'Das Ergebnis wird an die Liga gemeldet …';
      ligaErgebnisMelden(a.tore, b.tore, spiel.ich ? spiel.ich.tore : 0).then(r => {
        spiel.ligaStatus = r.ok ? 'Das Ergebnis steht in der Ligatabelle.'
          : `Das Ergebnis konnte nicht gemeldet werden: ${r.text}` + (r.nochmal ? ' Es wird beim nächsten Öffnen der Liga nachgeschickt.' : '');
        const st = document.getElementById('ligaStatus');
        if (st) st.textContent = spiel.ligaStatus;
      });
    }
  }
  if (spiel.modus === 'liga' && spiel.ligaLohn) zusatz = (zusatz ? zusatz + ' · ' : '') + `+${spiel.ligaLohn} Münzen`;
  if (sieger === 0){ Fans.jubelTeam = 0; Fans.jubelZeit = 6; Ton.jubel(0.9); }
  const inhalt = el('div');
  if (pokalsieg){
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('class', 'pokal'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M18 6h28v10c0 10-6 17-14 18-8-1-14-8-14-18zM18 10H8c0 9 5 14 11 15M46 10h10c0 9-5 14-11 15M28 34h8v10h-8zM20 46h24l2 10H18z');
    p.setAttribute('fill', '#ffd84a'); p.setAttribute('stroke', '#7a5a00'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
    inhalt.appendChild(svg);
  }
  inhalt.appendChild(ergebnisBlock(zusatz));
  if (spiel.modus === 'ligaonline'){ const st = el('p', 'hinweis', spiel.ligaStatus); st.id = 'ligaStatus'; inhalt.appendChild(st); }
  inhalt.appendChild(statistikBereich());
  let titel = sieger === 0 ? 'Sieg!' : sieger === 1 ? 'Niederlage' : 'Unentschieden';
  const knoepfe = [];
  if (spiel.modus === 'pokal'){
    if (pokalsieg) titel = 'Pokalsieger!';
    else if (sieger === 0){
      titel = `Weiter ins ${RUNDEN[pokal.runde + 1]}!`;
      knoepfe.push({ text:'Weiter', aktion:() => { pokal.runde++; pokalRundeZeigen(); } });
    } else titel = 'Ausgeschieden';
    knoepfe.push({ text:'Zum Menü', zweit:knoepfe.length > 0, aktion:zumMenue });
  } else if (spiel.modus === 'liga'){
    knoepfe.push({ text:'Weiter zur Tabelle', aktion:ligaZentrale });
  } else if (spiel.modus === 'ligaonline'){
    knoepfe.push({ text:'Weiter zur Liga', aktion:() => ligaOnlineZeigen(ligaOnline.spiel.code) });
  } else {
    knoepfe.push({ text:'Nochmal', aktion:freundStarten });
    knoepfe.push({ text:'Zum Menü', zweit:true, aktion:zumMenue });
  }
  const h = highlightKnopf(zeigeEnde);
  if (h) knoepfe.splice(Math.min(1, knoepfe.length), 0, h);
  $('elfer').classList.remove('an');
  dialogZeigen(titel, inhalt, knoepfe);
}

/* ---------- HUD ---------- */
function hudTeams(){
  const [a, b] = spiel.teams;
  $('kurzHeim').textContent = a.daten.kurz; $('kurzGast').textContent = b.daten.kurz;
  $('chipHeim').style.background = a.kit.trikot; $('chipGast').style.background = b.kit.trikot;
  hudStand();
}
function hudStand(){
  $('toreHeim').textContent = spiel.teams[0].tore;
  $('toreGast').textContent = spiel.teams[1].tore;
}
function meldung(titel, unter, klasse){
  const m = $('meldung');
  m.querySelector('b').textContent = titel;
  m.querySelector('span').textContent = unter || '';
  m.className = 'meldung';
  void m.offsetWidth;
  m.className = 'meldung zeigen' + (klasse ? ' ' + klasse : '');
}
let tippTimer = null;
function tippZeigen(text, sek){
  const t = $('tipp');
  t.textContent = text; t.classList.add('an');
  clearTimeout(tippTimer);
  tippTimer = setTimeout(() => t.classList.remove('an'), sek * 1000);
}

const hud = { minute:-1, nachspiel:'', ladung:-1, labels:'' };
function hudAktualisieren(){
  if (!spiel.teams.length) return;
  spielerkarteAktualisieren();
  if (spiel.modus === 'training'){
    const t = `${training.versuch}/${training.max}`;
    if (hud.minute !== t){ hud.minute = t; $('uhr').textContent = t; $('nachspiel').textContent = ''; hud.nachspiel = ''; }
  } else {
  const min = spielMinute().text;
  if (min !== hud.minute && spiel.modus !== 'demo'){ hud.minute = min; $('uhr').textContent = min; }
  const n = spiel.nachspiel > 0 ? '+' + spiel.nachspiel : '';
  if (n !== hud.nachspiel){ hud.nachspiel = n; $('nachspiel').textContent = n; }
  }
  const l = Math.round(spiel.ladung * 100);
  if (l !== hud.ladung){
    hud.ladung = l;
    $('kraft').classList.toggle('an', l > 1);
    $('kraftFuell').style.width = l + '%';
  }
  radarZeichnen();
  if (istTouch) touchBeschriften();
}

function touchBeschriften(){
  const p = spiel.gesteuert;
  let l;
  if (spiel.phase === 'elfmeter' && spiel.elfmeter && spiel.elfmeter.tw && spiel.elfmeter.tw.team.mensch) l = ['Springen', 'Springen', 'Springen'];
  else if (p && ball.besitzer && ball.besitzer.team !== p.team) l = ['Grätsche', 'Wechsel', 'Doppeln'];
  else if (p && ball.besitzer && ball.besitzer !== p) l = ['Schuss', 'Wechsel', 'Heber'];
  else l = ['Schuss', 'Pass', 'Heber'];
  const key = l.join();
  if (key === hud.labels) return;
  hud.labels = key;
  const k = document.querySelectorAll('.tk');
  k[0].textContent = l[0]; k[1].textContent = l[1]; k[2].textContent = l[2];
}

const radar = { ctx:null };
function radarZeichnen(){
  if (!radar.ctx) radar.ctx = $('radar').getContext('2d');
  const g = radar.ctx, W = 352, H = 228, R = 10;
  const sx = x => R + (x + HL) / FELD.L * (W - 2 * R), sz = z => R + (z + HB) / FELD.B * (H - 2 * R);
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(8,30,18,.86)';
  g.beginPath(); g.roundRect ? g.roundRect(0, 0, W, H, 12) : g.rect(0, 0, W, H); g.fill();
  g.strokeStyle = 'rgba(244,247,242,.55)'; g.lineWidth = 2;
  g.strokeRect(sx(-HL), sz(-HB), sx(HL) - sx(-HL), sz(HB) - sz(-HB));
  g.beginPath(); g.moveTo(sx(0), sz(-HB)); g.lineTo(sx(0), sz(HB)); g.stroke();
  g.beginPath(); g.arc(sx(0), sz(0), KREIS / FELD.L * (W - 2 * R), 0, Math.PI * 2); g.stroke();
  for (const s of [1, -1]){
    const x0 = sx(s * HL), x1 = sx(s * (HL - STRAF.T));
    g.strokeRect(Math.min(x0, x1), sz(-STRAF.B / 2), Math.abs(x1 - x0), sz(STRAF.B / 2) - sz(-STRAF.B / 2));
  }
  for (const t of spiel.teams){
    for (const p of t.spieler){
      g.fillStyle = p.rolle === 'TW' ? t.kit.torwart : t.kit.trikot;
      g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2;
      g.beginPath(); g.arc(sx(p.x), sz(p.z), p === spiel.gesteuert ? 9 : 7, 0, Math.PI * 2); g.fill(); g.stroke();
      if (p === spiel.gesteuert){ g.strokeStyle = '#ffd84a'; g.lineWidth = 3; g.beginPath(); g.arc(sx(p.x), sz(p.z), 12, 0, Math.PI * 2); g.stroke(); }
    }
  }
  g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2;
  g.beginPath(); g.arc(sx(ball.x), sz(ball.z), 5, 0, Math.PI * 2); g.fill(); g.stroke();
}

/* ---------- Darstellung ---------- */
const rollAchse = new THREE.Vector3(), rollDreh = new THREE.Quaternion();
let empfaengerTakt = 0, empfaengerVorschau = null;
function darstellen(dt){
  const zeit = performance.now() / 1000;
  let wdhBall = null;
  if (WDH.abspielen) wdhBall = wiederholungZeigen(zeit);
  else {
    for (const p of spiel.alle){
      const h = p.haltung;
      p.figur.wurzel.visible = !p.weg;
      let y = 0;
      if (p.sprungT > 0) y = Math.sin((1 - p.sprungT) * Math.PI) * 0.42;
      if (p.jubel) y = Math.abs(Math.sin(zeit * 7 + p.idx)) * 0.35;
      p.y = y;
      h.x = p.x; h.y = y; h.z = p.z; h.dreh = p.dir; h.lauf = p.lauf; h.tempo = p.tempo;
      h.schussT = p.schussT; h.graetscheT = p.graetsche; h.hechtT = p.hecht; h.hechtSeite = p.hechtSeite;
      h.fallT = p.fallT; h.kopfT = p.kopfT; h.jubel = p.jubel; h.halten = p.halten && ball.besitzer === p; h.einwurf = p.einwurf;
      haltungSetzen(p.figur, h, zeit);
    }
    Welt.ball.position.set(ball.x, ball.y, ball.z);
    const v = Math.hypot(ball.vx, ball.vz);
    const gehalten = ball.besitzer && (ball.besitzer.halten || ball.besitzer.einwurf);
    if (v > 0.05 && !gehalten && !spiel.pause){
      rollAchse.set(ball.vz / v, 0, -ball.vx / v);
      rollDreh.setFromAxisAngle(rollAchse, v * dt / BALL_R);
      Welt.ball.quaternion.premultiply(rollDreh);
    }
  }
  const bp = Welt.ball.position;
  Welt.ballSchatten.position.set(bp.x, 0.02, bp.z);
  const hoehe = Math.max(0, bp.y - BALL_R);
  Welt.ballSchatten.scale.setScalar(1 + hoehe * 0.2);
  Welt.ballSchatten.material.opacity = 0.4 / (1 + hoehe * 0.7);
  markierungenZeigen(zeit, dt);
  kameraSchritt(dt, wdhBall);
  netzAnimieren(dt);
  // Stimmung: je näher der Ball an einem Tor, desto lauter
  const naehe = clamp(1 - (HL - Math.abs(ball.x)) / 24, 0, 1) * (Math.abs(ball.z) < STRAF.B / 2 + 4 ? 1 : 0.5);
  Fans.aufregung = Math.max(Fans.aufregung - dt * 0.35, spiel.phase === 'spiel' ? naehe * 0.55 : 0);
  if ((spiel.stimmungTakt = (spiel.stimmungTakt || 0) + dt) > 0.4){
    spiel.stimmungTakt = 0;
    Ton.stimmungSetzen(spiel.modus === 'demo' ? 0.12 : 0.22 + Fans.aufregung * 0.6);
  }
  fansAnimieren(dt);
  powerupsDarstellen(zeit);
  elfmeterDarstellen();
  hudAktualisieren();
  $('wdh').classList.toggle('an', !!WDH.abspielen);
  $('radar').classList.toggle('weg', !!WDH.abspielen || spiel.phase === 'elfmeter');
}

function markierungenZeigen(zeit, dt){
  const m = spiel.markierung;
  const p = spiel.gesteuert;
  const sichtbar = !!p && ['spiel', 'warten'].includes(spiel.phase) && spiel.modus !== 'demo';
  m.ring.visible = m.pfeil.visible = m.richtung.visible = sichtbar;
  m.empfaenger.visible = false;
  if (!sichtbar) return;
  m.ring.position.set(p.x, 0.02, p.z);
  m.pfeil.position.set(p.x, 2.45 + Math.sin(zeit * 5) * 0.08 + p.y, p.z);
  m.richtung.position.set(p.x + Math.cos(p.dir) * 0.95, 0.03, p.z + Math.sin(p.dir) * 0.95);
  m.richtung.rotation.y = Math.PI / 2 - p.dir;
  // Wer bekäme den Pass?
  let ziel = null;
  if (ball.passZiel && ball.passZiel.team === p.team && ball.passZiel !== p) ziel = ball.passZiel;
  else if (ball.besitzer === p && spiel.phase === 'spiel'){
    empfaengerTakt -= dt;
    if (empfaengerTakt <= 0){ empfaengerTakt = 0.1; const [dx, dz] = eingabeRichtung(p); empfaengerVorschau = passZielWaehlen(p, dx, dz); }
    ziel = empfaengerVorschau;
  }
  if (ziel){ m.empfaenger.visible = true; m.empfaenger.position.set(ziel.x, 0.02, ziel.z); }
}

/* ---------- Hauptschleife ---------- */
function rahmen(dt){
  spiel.phaseZeit += dt;
  const ph = spiel.phase;
  if (spiel.modus === 'training'){
    if (ph === 'spiel'){ for (const k of spiel.steuerer) if (k.spieler) menschAktionen(k); }
    else if (ph === 'warten') standardWarten(dt);
    trainingRahmen(dt);
    return;
  }
  if (ph === 'spiel'){ for (const k of spiel.steuerer) if (k.spieler) menschAktionen(k); }
  else if (ph === 'warten') standardWarten(dt);
  else if (ph === 'aus'){ if (spiel.phaseZeit > ((spiel.naechster && spiel.naechster.warte) || 1.1)) umblenden(() => standardAufstellen(spiel.naechster)); }
  else if (ph === 'tor'){ if (spiel.phaseZeit > 3.3){ if (spiel.modus === 'demo' || spiel.modus === 'online') anstossNachTor(); else wiederholungStarten(); } }
  else if (ph === 'wiederholung') wiederholungSchritt(dt);
  else if (ph === 'pause-halbzeit'){
    if (spiel.phaseZeit > 2.2){
      // Online wartet niemand auf einen Knopf: nach kurzer Pause geht es weiter
      if (spiel.modus === 'online'){ spiel.phase = 'halbzeit-online'; spiel.phaseZeit = 0; meldung('Halbzeit', 'Gleich geht es weiter'); }
      else { spiel.phase = 'halbzeit'; zeigeHalbzeit(); }
    }
  }
  else if (ph === 'halbzeit-online'){ if (spiel.phaseZeit > 4) zweiteHalbzeit(); }
  else if (ph === 'abpfiff'){ if (spiel.phaseZeit > 2.4) spielEndeEntscheiden(); }
  else if (ph === 'elfmeter') elfmeterRahmen(dt);
}

let letzte = performance.now(), akku = 0;
function schleife(jetzt){
  requestAnimationFrame(schleife);
  takt(jetzt, true);
}
// Ein Bild: Eingaben, Spiellogik (außer bei Online-Gästen, die nur anzeigen), Darstellung
function takt(jetzt, zeichnen){
  // Ein Gastgeber im Hintergrund-Tab bekommt selten Takte – dann größere Schritte nachholen
  const dt = clamp((jetzt - letzte) / 1000, 0, zeichnen ? 0.1 : 1);
  letzte = jetzt;
  eingabeRahmen(dt);
  for (const k of spiel.steuerer) if (k.e !== eingabe) fernRahmen(k.e, dt);
  if (WDH.extra) extraSchritt(dt);
  if (online.rolle === 'gast') onlineGastTakt(dt);
  else if (!spiel.pause && !WDH.extra){
    rahmen(dt);
    akku += dt;
    let n = 0;
    const max = zeichnen ? 14 : 130;
    while (akku >= SCHRITT && n < max){ simSchritt(SCHRITT); akku -= SCHRITT; n++; }
    if (n >= max) akku = 0;
    if (online.rolle === 'host') onlineHostTakt(dt);
  }
  if (zeichnen){
    darstellen(spiel.pause ? 0 : dt);
    schilderZeigen();
    renderer.render(szene, kamera);
  }
  eingabeRahmenEnde();
  for (const k of spiel.steuerer) if (k.e !== eingabe) fernRahmenEnde(k.e);
}
// Online darf das Spiel nicht stehen bleiben, wenn der Gastgeber den Tab wechselt
setInterval(() => { if (document.hidden && online.rolle === 'host') takt(performance.now(), false); }, 100);

async function starten(){
  try {
    await Promise.race([
      Promise.all(['600', '700', '800'].map(w => document.fonts.load(`${w} 40px "Barlow Semi Condensed"`))),
      new Promise(ok => setTimeout(ok, 1500))
    ]);
  } catch (e) { /* ohne Schrift weiter */ }
  szeneBauen();
  spiel.markierung = markierungenBauen();
  if (istTouch) touchEinrichten();
  menueEinrichten();
  effekteMitschneiden();
  demoStarten();
  requestAnimationFrame(schleife);
  olympiaPruefen();
  window.__futbolero = { spiel, ball, eingabe, einstellungen, matchStarten, zumMenue, simSchritt, TEAMS };
}
starten();
