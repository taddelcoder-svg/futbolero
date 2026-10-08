'use strict';
// Futbolero – Liga und Karriere: Eine Saison mit allen neun Teams (jeder gegen jeden), Tabelle,
// Münzen für Siege und Tore, Training der Spielerwerte, Transfermarkt mit Stars und eine
// Teamentwicklung der Gegner von Saison zu Saison. Gespeichert wird im Browser.

const KARRIERE_KEY = 'futbolero-karriere-v1';
const SPIELTAGE = 9;                  // 9 Teams: jeder spielt 8-mal, einmal ist man spielfrei
const KADER_MAX = 11;
const PREISGELD = [260, 180, 130, 100, 80, 70, 60, 50, 40];

let karriere = karriereLaden();

function karriereLaden(){
  try {
    const k = JSON.parse(localStorage.getItem(KARRIERE_KEY));
    return k && k.v === 1 && Array.isArray(k.plan) ? k : null;
  } catch (e) { return null; }
}
function karriereSpeichern(){
  try {
    if (karriere) localStorage.setItem(KARRIERE_KEY, JSON.stringify(karriere));
    else localStorage.removeItem(KARRIERE_KEY);
  } catch (e) { /* privat / voll */ }
}

/* ---------- Spielplan und Tabelle ---------- */
// Rundenturnier nach dem Kreisverfahren (10 Plätze, Platz 9 = spielfrei)
function spielplanErstellen(){
  const ids = TEAMS.map((t, i) => i);
  for (let i = ids.length - 1; i > 0; i--){ const j = zufallGanz(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const plaetze = [...ids, -1];
  const n = plaetze.length, plan = [];
  for (let r = 0; r < n - 1; r++){
    const runde = [];
    for (let i = 0; i < n / 2; i++){
      const a = plaetze[i], b = plaetze[n - 1 - i];
      if (a < 0 || b < 0) continue;
      runde.push((r + i) % 2 ? [a, b] : [b, a]);
    }
    plan.push(runde);
    plaetze.splice(1, 0, plaetze.pop());
  }
  return plan;
}

function tabelleBerechnen(k = karriere){
  const zeilen = TEAMS.map((t, i) => ({ i, sp:0, s:0, u:0, n:0, tore:0, gegen:0, pkt:0 }));
  for (const runde of k.ergebnisse) for (const [a, b, ta, tb] of runde){
    const A = zeilen[a], B = zeilen[b];
    A.sp++; B.sp++; A.tore += ta; A.gegen += tb; B.tore += tb; B.gegen += ta;
    if (ta > tb){ A.s++; B.n++; A.pkt += 3; }
    else if (tb > ta){ B.s++; A.n++; B.pkt += 3; }
    else { A.u++; B.u++; A.pkt++; B.pkt++; }
  }
  return zeilen.sort((x, y) => y.pkt - x.pkt || (y.tore - y.gegen) - (x.tore - x.gegen) || y.tore - x.tore || TEAMS[x.i].name.localeCompare(TEAMS[y.i].name));
}

function poisson(l){
  const g = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > g && k < 12);
  return k - 1;
}
// Ein Spiel ohne Menschen: Tore nach Stärke ausgewürfelt, mit kleinem Heimvorteil
function spielSimulieren(a, b){
  const sa = karriere.staerken[a], sb = karriere.staerken[b];
  return [poisson(1.45 * Math.exp((sa - sb) * 0.33)), poisson(1.2 * Math.exp((sb - sa) * 0.33))];
}

/* ---------- Kader ---------- */
function kaderErstellen(teamIdx){
  const t = TEAMS[teamIdx];
  const plaetze = [['TW', 1], ['AB', 4], ['AB', 5], ['AB', 2], ['MI', 8], ['MI', 10], ['ST', 9], ['MI', 6], ['ST', 11], ['AB', 3]];
  return plaetze.map(([rolle, nummer]) => ({ name:nameFuer(t.id, nummer), nummer, rolle, werte:werteFuer(t.id, rolle, nummer, t.staerke), star:false }));
}

// Werte inklusive Training
function trainierteWerte(sp){
  const w = {};
  for (const k of WERTE) w[k] = Math.min(99, sp.werte[k] + (karriere.training[k] || 0) * 2);
  return w;
}

// Die besten Spieler für jeden Platz der Aufstellung
function aufstellung(groesse){
  const frei = karriere.kader.slice();
  const nimm = sp => { frei.splice(frei.indexOf(sp), 1); return sp; };
  const bester = liste => liste.sort((a, b) => gesamtWert(trainierteWerte(b)) - gesamtWert(trainierteWerte(a)))[0];
  return FORMATIONEN[groesse].map(form => {
    let sp = bester(frei.filter(x => x.rolle === form.rolle));
    if (!sp) sp = bester(frei.filter(x => form.rolle === 'TW' || x.rolle !== 'TW'));
    nimm(sp);
    return { name:sp.name, nummer:sp.nummer, werte:trainierteWerte(sp), star:sp.star, ref:sp };
  });
}
function teamStaerke(){
  const a = aufstellung(7);
  return a.reduce((s, x) => s + gesamtWert(x.werte), 0) / a.length;
}

/* ---------- Transfermarkt ---------- */
function angeboteErstellen(){
  const benutzt = new Set(karriere.kader.map(s => s.name));
  const liste = [];
  for (let i = 0; i < 3; i++){
    const rolle = zufallAus(['ST', 'ST', 'MI', 'MI', 'AB', 'TW']);
    let name;
    do { name = zufallAus(STARNAMEN); } while (benutzt.has(name) && benutzt.size < STARNAMEN.length);
    benutzt.add(name);
    let herkunft;
    do { herkunft = zufallGanz(TEAMS.length); } while (herkunft === karriere.team);
    const staerke = clamp(3.3 + karriere.saison * 0.25 + zufall(0, 1.1), 3, 5.4);
    const werte = werteFuer('star' + name + karriere.saison, rolle, 7, staerke);
    const ges = gesamtWert(werte);
    liste.push({ name, rolle, werte, herkunft, preis:Math.max(80, Math.round(((ges - 60) * 13 + 60) / 10) * 10) });
  }
  return liste;
}

function freieNummer(){
  const belegt = new Set(karriere.kader.map(s => s.nummer));
  for (const n of [7, 14, 17, 19, 20, 21, 22, 23, 18, 15, 16, 12, 13, 24, 25, 26, 27, 28, 29, 30]) if (!belegt.has(n)) return n;
  return 31 + karriere.kader.length;
}

function verpflichten(angebot){
  if (karriere.muenzen < angebot.preis) return;
  karriere.muenzen -= angebot.preis;
  let abgang = null;
  if (karriere.kader.length >= KADER_MAX){
    // Der schwächste Spieler auf derselben Position geht (Torhüter bleibt mindestens einer)
    const gleich = karriere.kader.filter(s => s.rolle === angebot.rolle && !(s.rolle === 'TW' && karriere.kader.filter(x => x.rolle === 'TW').length < 2));
    const pool = gleich.length ? gleich : karriere.kader.filter(s => s.rolle !== 'TW');
    abgang = pool.sort((a, b) => gesamtWert(a.werte) - gesamtWert(b.werte))[0];
    karriere.kader.splice(karriere.kader.indexOf(abgang), 1);
  }
  karriere.kader.push({ name:angebot.name, nummer:freieNummer(), rolle:angebot.rolle, werte:angebot.werte, star:true });
  karriere.angebote.splice(karriere.angebote.indexOf(angebot), 1);
  karriereSpeichern();
  return abgang;
}

function trainingsKosten(stufe){ return 40 + stufe * 30; }

/* ---------- Karriere starten, Spieltage, Saisonende ---------- */
function karriereNeu(teamIdx){
  karriere = {
    v:1, team:teamIdx, saison:1, spieltag:0, plan:spielplanErstellen(), ergebnisse:[],
    staerken:TEAMS.map(t => t.staerke), muenzen:150, training:{ tempo:0, schuss:0, pass:0, abwehr:0 },
    kader:kaderErstellen(teamIdx), angebote:[], historie:[], letzte:null
  };
  karriere.angebote = angeboteErstellen();
  karriereSpeichern();
}

function naechstesSpiel(){
  const runde = karriere.plan[karriere.spieltag];
  if (!runde) return null;
  const paar = runde.find(p => p.includes(karriere.team));
  if (!paar) return { frei:true };
  return { paar, gegner:paar[0] === karriere.team ? paar[1] : paar[0], heim:paar[0] === karriere.team };
}

// Spieltag abschließen: eigenes Ergebnis eintragen (oder spielfrei), Rest simulieren, Münzen gutschreiben
function spieltagAbschliessen(eigeneTore, gegnerTore){
  const runde = karriere.plan[karriere.spieltag];
  const ergebnisse = [];
  let lohn = 0, eigenes = null;
  for (const [a, b] of runde){
    if (a === karriere.team || b === karriere.team){
      const ta = a === karriere.team ? eigeneTore : gegnerTore, tb = a === karriere.team ? gegnerTore : eigeneTore;
      ergebnisse.push([a, b, ta, tb]);
      eigenes = [a, b, ta, tb];
      lohn += (eigeneTore > gegnerTore ? 40 : eigeneTore === gegnerTore ? 15 : 5) + eigeneTore * 4;
    } else ergebnisse.push([a, b, ...spielSimulieren(a, b)]);
  }
  if (!eigenes) lohn += 15;   // Spielfrei: Trainingstag
  karriere.ergebnisse.push(ergebnisse);
  karriere.spieltag++;
  karriere.muenzen += lohn;
  karriere.letzte = { spieltag:karriere.spieltag, ergebnisse };
  // Zur Saisonmitte gibt es neue Angebote
  if (karriere.spieltag === 5) karriere.angebote = angeboteErstellen();
  karriereSpeichern();
  return lohn;
}

function neueSaison(){
  const tab = tabelleBerechnen();
  // Teamentwicklung: die Gegner werden von Saison zu Saison etwas stärker oder schwächer
  karriere.staerken = karriere.staerken.map((s, i) => {
    if (i === karriere.team) return s;
    const platz = tab.findIndex(z => z.i === i);
    const trend = platz < 3 ? 0.08 : platz > 5 ? -0.05 : 0;
    return Math.round(clamp(s + trend + zufall(-0.4, 0.45) + karriere.saison * 0.02, 1, 5.6) * 100) / 100;
  });
  karriere.saison++;
  karriere.spieltag = 0;
  karriere.plan = spielplanErstellen();
  karriere.ergebnisse = [];
  karriere.letzte = null;
  karriere.angebote = angeboteErstellen();
  karriereSpeichern();
}

/* ---------- Oberfläche ---------- */
function tabelleElement(hervorheben){
  const t = el('table', 'tabelle');
  const kopf = el('tr');
  for (const h of ['', 'Team', 'Sp', 'S-U-N', 'Tore', 'Pkt']) kopf.appendChild(el('th', null, h));
  t.appendChild(kopf);
  tabelleBerechnen().forEach((z, i) => {
    const tr = el('tr', z.i === karriere.team ? 'ich' : hervorheben && hervorheben.includes(z.i) ? 'gegner' : '');
    tr.appendChild(el('td', null, String(i + 1)));
    const name = el('td', 'name');
    name.appendChild(trikotSvg(TEAMS[z.i].heim));
    name.appendChild(el('span', null, TEAMS[z.i].name));
    tr.appendChild(name);
    tr.appendChild(el('td', null, String(z.sp)));
    tr.appendChild(el('td', null, `${z.s}-${z.u}-${z.n}`));
    tr.appendChild(el('td', null, `${z.tore}:${z.gegen}`));
    tr.appendChild(el('td', 'pkt', String(z.pkt)));
    t.appendChild(tr);
  });
  return t;
}

function ergebnisListe(runde){
  const ul = el('ul', 'ergebnisse');
  for (const [a, b, ta, tb] of runde){
    const li = el('li', a === karriere.team || b === karriere.team ? 'ich' : '');
    li.textContent = `${TEAMS[a].name} ${ta}:${tb} ${TEAMS[b].name}`;
    ul.appendChild(li);
  }
  return ul;
}

function ligaKopf(){
  const k = el('div', 'ligakopf');
  k.appendChild(el('span', null, `Saison ${karriere.saison}`));
  k.appendChild(el('span', null, karriere.spieltag < SPIELTAGE ? `Spieltag ${karriere.spieltag + 1} von ${SPIELTAGE}` : 'Saison beendet'));
  k.appendChild(el('span', 'muenzen', `🪙 ${karriere.muenzen}`));
  return k;
}

function ligaZentrale(){
  pokal.aktiv = false;
  $('startEbene').classList.add('aus');
  if (!karriere) return zumMenue();
  if (karriere.spieltag >= SPIELTAGE) return saisonEnde();
  const inhalt = el('div');
  inhalt.appendChild(ligaKopf());
  const n = naechstesSpiel();
  const eigen = TEAMS[karriere.team];
  if (n.frei) inhalt.appendChild(el('p', 'hinweis', `Die ${eigen.name} sind an diesem Spieltag spielfrei. Die anderen Spiele werden ausgewürfelt, dein Team trainiert (+15 Münzen).`));
  else {
    const g = TEAMS[n.gegner], s = karriere.staerken[n.gegner];
    inhalt.appendChild(el('p', 'hinweis', `${n.heim ? 'Heimspiel' : 'Auswärtsspiel'} gegen die ${g.name} (Stärke ${'★'.repeat(Math.round(s))}${'☆'.repeat(Math.max(0, 5 - Math.round(s)))}). Deine Startelf hat im Schnitt ${Math.round(teamStaerke())}.`));
  }
  inhalt.appendChild(tabelleElement(n.frei ? null : [n.gegner]));
  if (karriere.letzte){
    inhalt.appendChild(el('p', 'hinweis klein', `Ergebnisse vom ${karriere.letzte.spieltag}. Spieltag:`));
    inhalt.appendChild(ergebnisListe(karriere.letzte.ergebnisse));
  }
  const knoepfe = [];
  if (n.frei) knoepfe.push({ text:'Spieltag auswürfeln', aktion:() => { spieltagAbschliessen(0, 0); ligaZentrale(); } });
  else knoepfe.push({ text:'Anpfiff!', aktion:() => ligaSpielStarten(n.gegner) });
  knoepfe.push({ text:'Kader und Training', zweit:true, aktion:ligaKader });
  knoepfe.push({ text:`Transfermarkt (${karriere.angebote.length})`, zweit:true, aktion:ligaTransfers });
  knoepfe.push({ text:'Zurück zum Menü', zweit:true, aktion:zumMenue });
  dialogZeigen('Liga', inhalt, knoepfe);
}

function ligaSpielStarten(gegner){
  const groesse = einstellungen.groesse;
  matchStarten({ heim:karriere.team, gast:gegner, modus:'liga', gegnerStaerke:karriere.staerken[gegner],
    kader:[aufstellung(groesse), null], staerken:[null, karriere.staerken[gegner]] });
}

// Wird nach dem Abpfiff eines Ligaspiels einmal aufgerufen
function ligaSpielGezaehlt(eigene, gegner){
  return spieltagAbschliessen(eigene, gegner);
}

function saisonEnde(){
  const tab = tabelleBerechnen();
  const platz = tab.findIndex(z => z.i === karriere.team) + 1;
  if (!karriere.saisonAbgerechnet){
    karriere.saisonAbgerechnet = true;
    karriere.muenzen += PREISGELD[platz - 1];
    karriere.historie.push({ saison:karriere.saison, platz });
    if (platz === 1){ bilanz.meister++; speichern(); }
    karriereSpeichern();
  }
  const inhalt = el('div');
  if (platz === 1){
    inhalt.appendChild(schaleSvg());
    Fans.jubelTeam = 0; Fans.jubelZeit = 6; Ton.jubel(0.9);
  }
  inhalt.appendChild(el('p', 'hinweis', platz === 1 ? `Die ${TEAMS[karriere.team].name} sind Meister! Preisgeld: ${PREISGELD[0]} Münzen.`
    : `Platz ${platz} in Saison ${karriere.saison}. Preisgeld: ${PREISGELD[platz - 1]} Münzen.`));
  inhalt.appendChild(tabelleElement());
  if (karriere.historie.length > 1){
    inhalt.appendChild(el('p', 'hinweis klein', 'Bisher: ' + karriere.historie.map(h => `Saison ${h.saison}: Platz ${h.platz}`).join(' · ')));
  }
  dialogZeigen(platz === 1 ? 'Meister!' : `Saison ${karriere.saison} vorbei`, inhalt, [
    { text:'Nächste Saison', aktion:() => { karriere.saisonAbgerechnet = false; neueSaison(); ligaZentrale(); } },
    { text:'Zurück zum Menü', zweit:true, aktion:zumMenue }
  ]);
}

function schaleSvg(){
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('class', 'pokal'); svg.setAttribute('aria-hidden', 'true');
  const c = document.createElementNS(ns, 'ellipse');
  c.setAttribute('cx', '32'); c.setAttribute('cy', '34'); c.setAttribute('rx', '27'); c.setAttribute('ry', '22');
  c.setAttribute('fill', '#e8edf2'); c.setAttribute('stroke', '#7d8894'); c.setAttribute('stroke-width', '2.5');
  svg.appendChild(c);
  const i = document.createElementNS(ns, 'ellipse');
  i.setAttribute('cx', '32'); i.setAttribute('cy', '34'); i.setAttribute('rx', '15'); i.setAttribute('ry', '12');
  i.setAttribute('fill', '#ffd84a'); i.setAttribute('stroke', '#7a5a00'); i.setAttribute('stroke-width', '2');
  svg.appendChild(i);
  return svg;
}

function werteZellen(tr, w){
  for (const k of WERTE) tr.appendChild(el('td', 'zahl', String(w[k])));
  tr.appendChild(el('td', 'zahl ges', String(gesamtWert(w))));
}

function ligaKader(){
  const inhalt = el('div');
  inhalt.appendChild(ligaKopf());
  const startelf = new Set(aufstellung(einstellungen.groesse).map(x => x.ref));
  const t = el('table', 'tabelle kader');
  const kopf = el('tr');
  for (const h of ['Nr', 'Name', 'Pos', 'TEM', 'SCH', 'PAS', 'ABW', 'GES']) kopf.appendChild(el('th', null, h));
  t.appendChild(kopf);
  const rang = { TW:0, AB:1, MI:2, ST:3 };
  for (const sp of karriere.kader.slice().sort((a, b) => rang[a.rolle] - rang[b.rolle] || a.nummer - b.nummer)){
    const tr = el('tr', startelf.has(sp) ? 'start' : 'bank');
    tr.appendChild(el('td', null, String(sp.nummer)));
    tr.appendChild(el('td', 'name', sp.name + (sp.star ? ' ★' : '')));
    tr.appendChild(el('td', null, sp.rolle));
    werteZellen(tr, trainierteWerte(sp));
    t.appendChild(tr);
  }
  inhalt.appendChild(t);
  inhalt.appendChild(el('p', 'hinweis klein', `Fett: Startelf bei ${einstellungen.groesse} gegen ${einstellungen.groesse}. Beim Torwart steht ABW fürs Halten.`));
  inhalt.appendChild(el('h2', 'unterkopf', 'Training'));
  const box = el('div', 'trainingsliste');
  for (const k of WERTE){
    const stufe = karriere.training[k] || 0, kosten = trainingsKosten(stufe);
    const zeile = el('div', 'trainingszeile');
    zeile.appendChild(el('span', null, `${WERTE_NAME[k]} · Stufe ${stufe}/10 (+${stufe * 2})`));
    const b = el('button', 'knopf klein', stufe >= 10 ? 'Ausgereizt' : `Trainieren · 🪙 ${kosten}`);
    b.disabled = stufe >= 10 || karriere.muenzen < kosten;
    b.addEventListener('click', () => {
      if (karriere.muenzen < kosten || stufe >= 10) return;
      Ton.klick();
      karriere.muenzen -= kosten;
      karriere.training[k] = stufe + 1;
      karriereSpeichern();
      ligaKader();
    });
    zeile.appendChild(b);
    box.appendChild(zeile);
  }
  inhalt.appendChild(box);
  dialogZeigen('Kader', inhalt, [{ text:'Zurück zur Liga', aktion:ligaZentrale }]);
}

function ligaTransfers(meldungText){
  const inhalt = el('div');
  inhalt.appendChild(ligaKopf());
  if (meldungText) inhalt.appendChild(el('p', 'hinweis', meldungText));
  if (!karriere.angebote.length) inhalt.appendChild(el('p', 'hinweis', 'Gerade keine Angebote. Zur Saisonmitte und zur neuen Saison kommen neue Stars auf den Markt.'));
  for (const a of karriere.angebote){
    const karte = el('div', 'angebot');
    const kopf = el('div', 'angebotkopf');
    kopf.appendChild(el('b', null, `${a.name} ★`));
    kopf.appendChild(el('span', null, `${ROLLEN_NAME[a.rolle]} · kommt von: ${TEAMS[a.herkunft].name}`));
    karte.appendChild(kopf);
    const w = el('div', 'angebotwerte');
    for (const k of WERTE) w.appendChild(el('span', null, `${WERTE_KURZ[k]} ${a.werte[k]}`));
    w.appendChild(el('span', 'ges', `GES ${gesamtWert(a.werte)}`));
    karte.appendChild(w);
    const b = el('button', 'knopf klein', `Verpflichten · 🪙 ${a.preis}`);
    b.disabled = karriere.muenzen < a.preis;
    b.addEventListener('click', () => {
      Ton.klick();
      const abgang = verpflichten(a);
      ligaTransfers(`${a.name} spielt jetzt für die ${TEAMS[karriere.team].name}!` + (abgang ? ` Dafür verlässt ${abgang.name} den Kader.` : ''));
    });
    karte.appendChild(b);
    inhalt.appendChild(karte);
  }
  dialogZeigen('Transfermarkt', inhalt, [{ text:'Zurück zur Liga', aktion:ligaZentrale }]);
}

function karriereBeendenFragen(){
  dialogZeigen('Neue Karriere?', el('p', 'hinweis', `Die laufende Karriere mit den ${TEAMS[karriere.team].name} (Saison ${karriere.saison}) wird gelöscht.`), [
    { text:'Ja, neu anfangen', aktion:() => { karriere = null; karriereSpeichern(); zumMenue(); } },
    { text:'Abbrechen', zweit:true, aktion:zumMenue }
  ]);
}

// Zeile im Hauptmenü
function ligaInfoText(){
  if (!karriere) return 'Wähle dein Team und starte eine Karriere: 9 Teams, Tabelle, Training und Transfers.';
  const tab = tabelleBerechnen(), platz = tab.findIndex(z => z.i === karriere.team) + 1;
  return `${TEAMS[karriere.team].name} · Saison ${karriere.saison} · ${Math.min(karriere.spieltag + 1, SPIELTAGE)}. Spieltag · Platz ${platz} · 🪙 ${karriere.muenzen}`;
}
