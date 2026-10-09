'use strict';
// Futbolero – Online-Liga im Browser: Liga gründen oder mit Code beitreten, Team wählen, Tabelle,
// Spieltag, Torjäger. Spiele gegen Computer-Teams spielt man allein und meldet das Ergebnis; gegen
// Menschen geht es in einen Ligaraum (online.js). Die Ligen selbst liegen auf dem Server (ligen.js),
// im Browser stehen nur Code und das geheime Token je Liga.

const LIGEN_KEY = 'futbolero-ligen-v1';
const LIGA_OFFEN_KEY = 'futbolero-liga-offen';
const ligaOnline = { daten:null, marke:null, laedt:false, spiel:null };
const STUFEN_NAME = { leicht:'Leicht', normal:'Normal', schwer:'Schwer' };

function meineLigen(){ try { return JSON.parse(localStorage.getItem(LIGEN_KEY)) || {}; } catch (e) { return {}; } }
function meineLigenSetzen(code, wert){
  const l = meineLigen();
  if (wert) l[code] = wert; else delete l[code];
  try { localStorage.setItem(LIGEN_KEY, JSON.stringify(l)); } catch (e) { /* privat / voll */ }
}
const ligaToken = code => (meineLigen()[code] || {}).token || null;

async function ligaApi(daten){
  let res;
  try {
    res = await fetch('/api/liga', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(daten), credentials:'same-origin' });
  } catch (e) { throw new Error('Der Server ist gerade nicht erreichbar.'); }
  let j = null;
  try { j = await res.json(); } catch (e) { /* kein JSON */ }
  if (!j) throw new Error('Der Server antwortet gerade nicht richtig.');
  if (j.fehler){ const f = new Error(j.fehler); f.vomServer = true; throw f; }
  return j;
}

function wartenZeigen(titel){ dialogZeigen(titel, el('p', 'hinweis', 'Einen Moment …'), []); }
// Die Anzeige vom letzten Spiel (Stand, Uhr, Knöpfe) gehört nicht hinter die Liga
function hudAus(){ $('hud').classList.remove('an'); $('elfer').classList.remove('an'); }

/* ---------- Einstieg: meine Ligen, gründen, beitreten ---------- */
function ligaOnlineMenue(fehlerText){
  ligaOnline.marke = null;
  $('startEbene').classList.add('aus');
  hudAus();
  const inhalt = el('div');
  inhalt.appendChild(el('p', 'hinweis', 'Spielt eine ganze Saison zusammen: Jeder übernimmt ein Team, die übrigen spielt der Computer. Gegen den Computer spielst du, wann du willst, gegen Freunde online.'));
  if (fehlerText) inhalt.appendChild(el('p', 'hinweis fehler', fehlerText));
  const ligen = Object.entries(meineLigen());
  if (ligen.length){
    inhalt.appendChild(el('h2', 'unterkopf', 'Deine Ligen'));
    const liste = el('div', 'ligaliste');
    for (const [code, l] of ligen){
      const b = el('button', 'knopf zweit klein');
      b.appendChild(el('b', null, l.name || 'Liga'));
      b.appendChild(el('span', null, ` · ${code}${l.team != null && TEAMS[l.team] ? ' · ' + TEAMS[l.team].name : ''}`));
      b.addEventListener('click', () => { Ton.klick(); ligaOnlineZeigen(code); });
      liste.appendChild(b);
    }
    inhalt.appendChild(liste);
  }
  inhalt.appendChild(el('h2', 'unterkopf', 'Einer Liga beitreten'));
  const code = document.createElement('input');
  code.className = 'feld code'; code.maxLength = 5; code.placeholder = 'CODE'; code.autocapitalize = 'characters';
  const z = el('div', 'zeile');
  z.appendChild(el('span', null, 'Liga-Code'));
  z.appendChild(code);
  inhalt.appendChild(z);
  const beitreten = () => {
    const c = code.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 5) return ligaOnlineMenue('Der Liga-Code hat 5 Zeichen.');
    ligaBeitretenDialog(c);
  };
  code.addEventListener('keydown', e => { if (e.key === 'Enter') beitreten(); });
  dialogZeigen('Online-Liga', inhalt, [
    { text:'Liga beitreten', aktion:beitreten },
    { text:'Neue Liga gründen', zweit:true, aktion:() => ligaGruenden() },
    { text:'Zurück zum Menü', zweit:true, aktion:zumMenue }
  ]);
}

// Spitzname wie bei den Online-Räumen (im Browser gespeichert)
function namensFeld(){
  const name = document.createElement('input');
  name.className = 'feld'; name.maxLength = 16; name.autocomplete = 'nickname'; name.placeholder = 'Spitzname';
  name.value = einstellungen.name || '';
  return name;
}
function zeileMit(label, feld){ const z = el('div', 'zeile'); z.appendChild(el('span', null, label)); z.appendChild(feld); return z; }

// Teamauswahl mit Pfeilen; frei(i) sagt, ob ein Team noch zu haben ist
function teamWahl(start, frei, beiWahl){
  const box = el('div', 'teamwahl');
  const ausgabe = el('output');
  let i = start;
  const zeigen = () => { ausgabe.textContent = ''; ausgabe.appendChild(trikotSvg(TEAMS[i].heim)); ausgabe.appendChild(el('span', null, TEAMS[i].name)); beiWahl(i); };
  const pfeil = (text, schritt, label) => {
    const b = el('button', 'pfeil', text);
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => {
      Ton.klick();
      for (let n = 0; n < TEAMS.length; n++){ i = (i + schritt + TEAMS.length) % TEAMS.length; if (frei(i)) break; }
      zeigen();
    });
    return b;
  };
  if (!frei(i)) for (let n = 0; n < TEAMS.length && !frei(i); n++) i = (i + 1) % TEAMS.length;
  box.appendChild(pfeil('◀', -1, 'Voriges Team'));
  box.appendChild(ausgabe);
  box.appendChild(pfeil('▶', 1, 'Nächstes Team'));
  zeigen();
  return box;
}

function regelWahl(einst, beiAenderung){
  const box = el('div');
  const wahl = (label, feld, werte) => {
    const z = el('div', 'zeile');
    z.appendChild(el('span', null, label));
    const w = el('div', 'wahl');
    for (const [wert, text] of werte){
      const b = el('button', null, text);
      b.setAttribute('aria-pressed', String(einst[feld] === wert));
      b.addEventListener('click', () => {
        Ton.klick();
        einst[feld] = wert;
        for (const x of w.children) x.setAttribute('aria-pressed', String(x === b));
        if (beiAenderung) beiAenderung(einst);
      });
      w.appendChild(b);
    }
    z.appendChild(w);
    box.appendChild(z);
  };
  wahl('Spieler', 'groesse', [[5, '5 gegen 5'], [7, '7 gegen 7']]);
  wahl('Spielzeit', 'dauer', [[2, '2 Min.'], [4, '4 Min.'], [6, '6 Min.']]);
  wahl('Computer', 'stufe', Object.entries(STUFEN_NAME));
  wahl('Runden', 'runden', [[1, 'Hinrunde'], [2, 'Hin und zurück']]);
  return box;
}
const regelText = e => `${e.groesse} gegen ${e.groesse} · ${e.dauer} Min. · Computer ${STUFEN_NAME[e.stufe]} · ${e.runden === 2 ? 'Hin- und Rückrunde' : 'nur Hinrunde'}`;

function ligaGruenden(fehlerText, vorher = {}){
  const inhalt = el('div');
  if (fehlerText) inhalt.appendChild(el('p', 'hinweis fehler', fehlerText));
  const ligaName = document.createElement('input');
  ligaName.className = 'feld'; ligaName.maxLength = 24; ligaName.placeholder = 'z. B. Pausenhof-Liga';
  ligaName.value = vorher.name || '';
  inhalt.appendChild(zeileMit('Name der Liga', ligaName));
  const name = namensFeld();
  inhalt.appendChild(zeileMit('Dein Name', name));
  let team = vorher.team != null ? vorher.team : einstellungen.team;
  inhalt.appendChild(zeileMit('Dein Team', teamWahl(team, () => true, i => { team = i; })));
  const einst = vorher.einst || { groesse:einstellungen.groesse, dauer:einstellungen.dauer, stufe:einstellungen.stufe, runden:1 };
  inhalt.appendChild(regelWahl(einst));
  const los = async () => {
    const n = name.value.trim();
    einstellungen.name = n; speichern();
    const daten = { name:ligaName.value.trim(), team, einst };
    if (!n) return ligaGruenden('Gib zuerst deinen Namen ein.', daten);
    wartenZeigen('Liga gründen');
    try {
      const j = await ligaApi({ t:'neu', name:daten.name, spieler:n, team, einst });
      meineLigenSetzen(j.liga.code, { token:j.token, name:j.liga.name, team });
      ligaOnlineRendern(j.liga);
    } catch (e) { ligaGruenden(e.message, daten); }
  };
  dialogZeigen('Neue Liga', inhalt, [
    { text:'Liga gründen', aktion:los },
    { text:'Zurück', zweit:true, aktion:() => ligaOnlineMenue() }
  ]);
  setTimeout(() => (ligaName.value ? name : ligaName).focus({ preventScroll:true }), 80);
}

async function ligaBeitretenDialog(code, fehlerText){
  wartenZeigen('Liga beitreten');
  let L;
  try { L = (await ligaApi({ t:'ansehen', code, token:ligaToken(code) })).liga; }
  catch (e) { return ligaOnlineMenue(e.message); }
  if (L.ich) return ligaOnlineRendern(L);
  const belegt = new Map(L.mitglieder.map(m => [m.team, m.name]));
  const inhalt = el('div');
  inhalt.appendChild(el('p', 'hinweis', `${L.name} · ${regelText(L.einst)}`));
  if (fehlerText) inhalt.appendChild(el('p', 'hinweis fehler', fehlerText));
  if (belegt.size >= TEAMS.length){
    inhalt.appendChild(el('p', 'hinweis', 'Alle neun Teams sind schon vergeben.'));
    return dialogZeigen('Liga voll', inhalt, [{ text:'Zurück', aktion:() => ligaOnlineMenue() }]);
  }
  inhalt.appendChild(el('p', 'hinweis klein', 'Schon dabei: ' + L.mitglieder.map(m => `${m.name} (${TEAMS[m.team].name})`).join(' · ')));
  if (L.phase === 'saison') inhalt.appendChild(el('p', 'hinweis klein', `Die Saison läuft schon (${L.spieltag + 1}. Spieltag). Du übernimmst ein Computer-Team mit seinen bisherigen Ergebnissen.`));
  const name = namensFeld();
  inhalt.appendChild(zeileMit('Dein Name', name));
  let team = einstellungen.team;
  inhalt.appendChild(zeileMit('Dein Team', teamWahl(team, i => !belegt.has(i), i => { team = i; })));
  const los = async () => {
    const n = name.value.trim();
    einstellungen.name = n; speichern();
    if (!n) return ligaBeitretenDialog(code, 'Gib zuerst deinen Namen ein.');
    wartenZeigen('Liga beitreten');
    try {
      const j = await ligaApi({ t:'beitreten', code, spieler:n, team });
      meineLigenSetzen(code, { token:j.token, name:j.liga.name, team });
      ligaOnlineRendern(j.liga);
    } catch (e) { ligaBeitretenDialog(code, e.message); }
  };
  dialogZeigen('Liga beitreten', inhalt, [
    { text:'Mitspielen', aktion:los },
    { text:'Zurück', zweit:true, aktion:() => ligaOnlineMenue() }
  ]);
}

/* ---------- Ligaansicht ---------- */
async function ligaOnlineZeigen(code, hinweis){
  $('startEbene').classList.add('aus');
  hudAus();
  wartenZeigen('Online-Liga');
  await offenesErgebnisSenden(code);
  try {
    const j = await ligaApi({ t:'ansehen', code, token:ligaToken(code) });
    if (!j.liga.ich){
      meineLigenSetzen(code, null);
      return ligaBeitretenDialog(code);
    }
    ligaOnlineRendern(j.liga, hinweis);
  } catch (e) {
    if (e.vomServer && /gibt es nicht/.test(e.message)) meineLigenSetzen(code, null);
    ligaOnlineMenue(e.message);
  }
}

const ligaIch = L => L.mitglieder.find(m => m.id === L.ich) || null;
const ligaMensch = (L, team) => L.mitglieder.find(m => m.team === team) || null;
const teamMitName = (L, team) => { const m = ligaMensch(L, team); return `${TEAMS[team].name} (${m ? m.name : 'Computer'})`; };

function ligaTabelleBerechnen(L){
  const z = TEAMS.map((t, i) => ({ i, sp:0, s:0, u:0, n:0, tore:0, gegen:0, pkt:0 }));
  for (const runde of L.erg) for (const [k, e] of Object.entries(runde || {})){
    const [a, b] = k.split('-').map(Number), [ta, tb] = e;
    const A = z[a], B = z[b];
    A.sp++; B.sp++; A.tore += ta; A.gegen += tb; B.tore += tb; B.gegen += ta;
    if (ta > tb){ A.s++; B.n++; A.pkt += 3; } else if (tb > ta){ B.s++; A.n++; B.pkt += 3; } else { A.u++; B.u++; A.pkt++; B.pkt++; }
  }
  return z.sort((x, y) => y.pkt - x.pkt || (y.tore - y.gegen) - (x.tore - x.gegen) || y.tore - x.tore || TEAMS[x.i].name.localeCompare(TEAMS[y.i].name));
}

function ligaTabelleElement(L){
  const ich = ligaIch(L);
  const t = el('table', 'tabelle');
  const kopf = el('tr');
  for (const h of ['', 'Team', 'Sp', 'S-U-N', 'Tore', 'Pkt']) kopf.appendChild(el('th', null, h));
  t.appendChild(kopf);
  ligaTabelleBerechnen(L).forEach((z, i) => {
    const m = ligaMensch(L, z.i);
    const tr = el('tr', ich && z.i === ich.team ? 'ich' : m ? 'mensch' : '');
    tr.appendChild(el('td', null, String(i + 1)));
    const name = el('td', 'name');
    name.appendChild(trikotSvg(TEAMS[z.i].heim));
    name.appendChild(el('span', null, TEAMS[z.i].name));
    if (m) name.appendChild(el('small', 'besitzer', m.name));
    tr.appendChild(name);
    tr.appendChild(el('td', null, String(z.sp)));
    tr.appendChild(el('td', null, `${z.s}-${z.u}-${z.n}`));
    tr.appendChild(el('td', null, `${z.tore}:${z.gegen}`));
    tr.appendChild(el('td', 'pkt', String(z.pkt)));
    t.appendChild(tr);
  });
  return t;
}

function spieltagListe(L, idx){
  const ich = ligaIch(L);
  const ul = el('ul', 'ergebnisse spieltag');
  const erg = L.erg[idx] || {};
  for (const [a, b] of L.plan[idx] || []){
    const e = erg[`${a}-${b}`];
    const mensch = ligaMensch(L, a) || ligaMensch(L, b);
    const li = el('li', ich && (a === ich.team || b === ich.team) ? 'ich' : mensch ? 'mensch' : '');
    li.textContent = `${TEAMS[a].name} ${e ? `${e[0]}:${e[1]}` : '–:–'} ${TEAMS[b].name}`;
    if (e && e[2] === 'a') li.appendChild(el('small', null, ' (aufgegeben)'));
    else if (e && e[2] === 'w') li.appendChild(el('small', null, ' (gewürfelt)'));
    else if (!e && mensch) li.appendChild(el('small', null, ' offen'));
    ul.appendChild(li);
  }
  return ul;
}

function torjaegerElement(L){
  const liste = Object.entries(L.tj || {}).map(([id, n]) => ({ m:L.mitglieder.find(x => x.id === id), n })).filter(x => x.m && x.n > 0)
    .sort((a, b) => b.n - a.n).slice(0, 6);
  if (!liste.length) return null;
  const p = el('p', 'hinweis klein');
  p.textContent = 'Torjäger: ' + liste.map((x, i) => `${i + 1}. ${x.m.name} ${x.n}`).join(' · ');
  return p;
}

// Mein Spiel am aktuellen Spieltag: { paar, gegner, heim, ergebnis, mensch } oder null (spielfrei)
function meinSpiel(L){
  const ich = ligaIch(L);
  if (!ich || L.phase !== 'saison') return null;
  const paar = (L.plan[L.spieltag] || []).find(p => p.includes(ich.team));
  if (!paar) return null;
  const gegner = paar[0] === ich.team ? paar[1] : paar[0];
  const e = (L.erg[L.spieltag] || {})[`${paar[0]}-${paar[1]}`] || null;
  return { paar, gegner, heim:paar[0] === ich.team, ergebnis:e, mensch:ligaMensch(L, gegner) };
}

function ligaOnlineRendern(L, hinweis){
  ligaOnline.daten = L;
  const ich = ligaIch(L), leiter = L.leiter === L.ich;
  meineLigenSetzen(L.code, { ...(meineLigen()[L.code] || {}), name:L.name, team:ich ? ich.team : null });
  const inhalt = el('div');
  const kopf = el('div', 'ligakopf');
  kopf.appendChild(el('span', null, L.name));
  kopf.appendChild(el('span', null, L.phase === 'saison' ? `Saison ${L.saison} · ${L.spieltag + 1}. von ${L.plan.length} Spieltagen` : `Saison ${L.saison}`));
  kopf.appendChild(el('span', 'muenzen', `Code ${L.code}`));
  inhalt.appendChild(kopf);
  if (hinweis) inhalt.appendChild(el('p', 'hinweis', hinweis));
  const knoepfe = [];

  if (L.phase === 'anmeldung'){
    const c = el('p', 'raumcode');
    c.appendChild(el('span', null, 'Liga-Code'));
    c.appendChild(el('b', null, L.code));
    inhalt.appendChild(c);
    inhalt.appendChild(el('p', 'hinweis', `Gib den Code an deine Freunde weiter. ${L.mitglieder.length} von 9 Teams sind vergeben, den Rest spielt der Computer.`));
    const ul = el('ul', 'ergebnisse mitglieder');
    for (const m of L.mitglieder){
      const li = el('li', m.id === L.ich ? 'ich' : '', `${m.name} · ${TEAMS[m.team].name}`);
      if (m.id === L.leiter) li.appendChild(el('small', null, ' · Ligaleitung'));
      ul.appendChild(li);
    }
    inhalt.appendChild(ul);
    if (ich){
      const belegt = new Set(L.mitglieder.filter(m => m !== ich).map(m => m.team));
      let gewaehlt = ich.team;
      inhalt.appendChild(zeileMit('Dein Team', teamWahl(ich.team, i => !belegt.has(i), i => {
        if (i === gewaehlt) return;
        gewaehlt = i;
        ligaAktion({ t:'team', team:i });
      })));
    }
    if (leiter){
      const einst = { ...L.einst };
      inhalt.appendChild(regelWahl(einst, e => ligaAktion({ t:'einst', einst:e }, true)));
      knoepfe.push({ text:'Saison starten', aktion:() => ligaAktion({ t:'start' }) });
    } else {
      inhalt.appendChild(el('p', 'hinweis', regelText(L.einst)));
      inhalt.appendChild(el('p', 'hinweis klein', 'Die Saison startet, wer die Liga gegründet hat.'));
    }
  } else if (L.phase === 'saison'){
    const s = meinSpiel(L);
    const karte = el('div', 'angebot meinspiel');
    if (!ich) karte.appendChild(el('b', null, 'Du spielst in dieser Liga nicht mit.'));
    else if (!s){
      karte.appendChild(el('b', null, `Die ${TEAMS[ich.team].name} sind an diesem Spieltag spielfrei.`));
      karte.appendChild(el('span', null, 'Sobald alle anderen gespielt haben, geht es weiter.'));
    } else {
      const titel = `${s.heim ? 'Heimspiel' : 'Auswärtsspiel'} gegen ${teamMitName(L, s.gegner)}`;
      karte.appendChild(el('b', null, titel));
      if (s.ergebnis){
        const [ta, tb] = s.ergebnis;
        karte.appendChild(el('span', null, `Gespielt: ${TEAMS[s.paar[0]].name} ${ta}:${tb} ${TEAMS[s.paar[1]].name}. Jetzt sind die anderen dran.`));
      } else if (s.mensch){
        karte.appendChild(el('span', null, `Ihr spielt online gegeneinander. Wenn ihr beide im Ligaraum seid, geht es los.`));
        knoepfe.push({ text:'Zum Ligaspiel', aktion:() => ligaRaumBetreten(L.code) });
      } else {
        karte.appendChild(el('span', null, `Gegen den Computer (${STUFEN_NAME[L.einst.stufe]}), ${L.einst.groesse} gegen ${L.einst.groesse}, ${L.einst.dauer} Minuten. Spiel, wann du Zeit hast.`));
        knoepfe.push({ text:'Anpfiff!', aktion:() => ligaOnlineSpielen(L, s.gegner) });
      }
    }
    inhalt.appendChild(karte);
    // Wer muss am Spieltag noch spielen?
    const erg = L.erg[L.spieltag] || {};
    const offen = [];
    for (const [a, b] of L.plan[L.spieltag] || []){
      if (erg[`${a}-${b}`]) continue;
      for (const t of [a, b]){ const m = ligaMensch(L, t); if (m && !offen.includes(m.name)) offen.push(m.name); }
    }
    if (offen.length) inhalt.appendChild(el('p', 'hinweis klein', `Noch nicht gespielt: ${offen.join(', ')}`));
    inhalt.appendChild(ligaTabelleElement(L));
    inhalt.appendChild(el('p', 'hinweis klein', `${L.spieltag + 1}. Spieltag:`));
    inhalt.appendChild(spieltagListe(L, L.spieltag));
    if (L.spieltag > 0){
      inhalt.appendChild(el('p', 'hinweis klein', `${L.spieltag}. Spieltag:`));
      inhalt.appendChild(spieltagListe(L, L.spieltag - 1));
    }
    const tj = torjaegerElement(L);
    if (tj) inhalt.appendChild(tj);
    if (leiter) knoepfe.push({ text:'Spieltag abschließen', zweit:true, aktion:() => ligaAbschliessenFragen(L, offen) });
  } else {
    // Saison vorbei
    const h = L.historie[L.historie.length - 1];
    if (h){
      inhalt.appendChild(schaleSvg());
      const meister = h.name ? `${TEAMS[h.meister].name} mit ${h.name}` : `${TEAMS[h.meister].name} (Computer)`;
      inhalt.appendChild(el('p', 'hinweis', `Meister der Saison ${h.saison}: ${meister}!` + (h.torjaeger ? ` Torjäger: ${h.torjaeger.name} mit ${h.torjaeger.tore} Toren.` : '')));
      if (ich && h.plaetze && h.plaetze[ich.id] === 1 && !ligaOnline.gefeiert){ ligaOnline.gefeiert = true; Fans.jubelTeam = 0; Fans.jubelZeit = 6; Ton.jubel(0.9); }
    }
    inhalt.appendChild(ligaTabelleElement(L));
    const tj = torjaegerElement(L);
    if (tj) inhalt.appendChild(tj);
    if (L.historie.length > 1){
      inhalt.appendChild(el('p', 'hinweis klein', 'Bisherige Meister: ' + L.historie.map(x => `Saison ${x.saison}: ${TEAMS[x.meister].name}${x.name ? ' (' + x.name + ')' : ''}`).join(' · ')));
    }
    if (leiter){
      const einst = { ...L.einst };
      inhalt.appendChild(regelWahl(einst, e => ligaAktion({ t:'einst', einst:e }, true)));
      knoepfe.push({ text:'Nächste Saison starten', aktion:() => ligaAktion({ t:'start' }) });
    } else inhalt.appendChild(el('p', 'hinweis klein', 'Die nächste Saison startet, wer die Liga gegründet hat.'));
  }
  if (L.phase !== 'anmeldung'){
    const mit = el('p', 'hinweis klein', 'Dabei: ' + L.mitglieder.map(m => `${m.name} (${TEAMS[m.team].name})`).join(' · ') + ` · Code ${L.code} · ${regelText(L.einst)}`);
    inhalt.appendChild(mit);
  }
  knoepfe.push({ text:'Andere Ligen', zweit:true, aktion:() => ligaOnlineMenue() });
  knoepfe.push({ text:'Liga verlassen', zweit:true, aktion:() => ligaVerlassenFragen(L) });
  const scroll = $('dialogEbene').querySelector('.karte');
  const pos = ligaOnline.marke && $('dialogInhalt').firstChild === ligaOnline.marke ? scroll.scrollTop : 0;
  dialogZeigen(L.phase === 'anmeldung' ? 'Neue Liga' : 'Online-Liga', inhalt, knoepfe);
  scroll.scrollTop = pos;
  ligaOnline.marke = inhalt;
}

// Aktion an den Server, danach neu zeichnen. still: ohne „Einen Moment“ (z. B. beim Umstellen der Regeln)
async function ligaAktion(daten, still){
  const L = ligaOnline.daten;
  if (!L) return;
  if (!still) wartenZeigen('Online-Liga');
  try {
    const j = await ligaApi({ ...daten, code:L.code, token:ligaToken(L.code) });
    if (j.liga){ if (!still || j.liga.ver !== L.ver) ligaOnlineRendern(j.liga); }
    else ligaOnlineMenue();
  } catch (e) {
    if (still){ tippZeigen(e.message, 4); ligaOnlineZeigen(L.code); }
    else ligaOnlineZeigen(L.code, e.message);
  }
}

function ligaAbschliessenFragen(L, offen){
  const text = offen.length ? `Noch nicht gespielt haben: ${offen.join(', ')}. Ihre Spiele werden nach Stärke ausgewürfelt.` : 'Die restlichen Spiele werden ausgewürfelt.';
  dialogZeigen('Spieltag abschließen?', el('p', 'hinweis', text), [
    { text:'Ja, abschließen', aktion:() => ligaAktion({ t:'abschliessen', spieltag:L.spieltag }) },
    { text:'Abbrechen', zweit:true, aktion:() => ligaOnlineRendern(L) }
  ]);
}

function ligaVerlassenFragen(L){
  const allein = L.mitglieder.length <= 1;
  dialogZeigen('Liga verlassen?', el('p', 'hinweis', allein ? 'Du bist als Letzter in der Liga – sie wird dann gelöscht.'
    : `Die ${TEAMS[ligaIch(L).team].name} spielt dann der Computer weiter. Zurück kommst du nur als neues Mitglied.`), [
    { text:'Ja, verlassen', aktion:async () => {
      try { await ligaApi({ t:'verlassen', code:L.code, token:ligaToken(L.code) }); } catch (e) { /* trotzdem vergessen */ }
      meineLigenSetzen(L.code, null);
      ligaOnlineMenue();
    } },
    { text:'Abbrechen', zweit:true, aktion:() => ligaOnlineRendern(L) }
  ]);
}

// Solange die Ligaansicht offen ist, alle paar Sekunden nachsehen, ob sich etwas getan hat
setInterval(async () => {
  const L = ligaOnline.daten;
  if (!L || ligaOnline.laedt || !ligaOnline.marke || $('dialogInhalt').firstChild !== ligaOnline.marke || $('dialogEbene').classList.contains('aus') || document.hidden) return;
  ligaOnline.laedt = true;
  try {
    const j = await ligaApi({ t:'ansehen', code:L.code, token:ligaToken(L.code) });
    if (j.liga.ver !== L.ver && $('dialogInhalt').firstChild === ligaOnline.marke) ligaOnlineRendern(j.liga);
  } catch (e) { /* nächstes Mal */ }
  ligaOnline.laedt = false;
}, 8000);

/* ---------- Spielen ---------- */
// Gegen ein Computer-Team: allein im Browser, das eigene Team ist immer links (wie in der Karriere)
function ligaOnlineSpielen(L, gegner){
  const ich = ligaIch(L);
  ligaOnline.marke = null;
  ligaOnline.spiel = { code:L.code, saison:L.saison, spieltag:L.spieltag, gemeldet:false };
  matchStarten({ heim:ich.team, gast:gegner, modus:'ligaonline', stufeName:L.einst.stufe, groesse:L.einst.groesse, dauer:L.einst.dauer });
}

// Gegen einen Menschen: in den Ligaraum, der Server bringt beide zusammen
async function ligaRaumBetreten(code){
  ligaOnline.marke = null;
  hudAus();
  dialogZeigen('Ligaspiel', el('p', 'hinweis', 'Verbinde mit dem Ligaraum …'), []);
  try { await onlineVerbinden(); }
  catch (e){ return ligaOnlineZeigen(code, 'Der Server ist gerade nicht erreichbar.'); }
  online.rolle = 'lobby'; online.liga = code; online.ende = null;
  onlineSenden({ t:'liga', code, token:ligaToken(code) });
}

// Ergebnis eines Spiels gegen den Computer melden. Klappt es nicht, bleibt es gemerkt und wird beim
// nächsten Öffnen der Liga nachgeschickt.
async function ligaErgebnisMelden(eigene, gegner, tore, aufgegeben){
  const s = ligaOnline.spiel;
  if (!s || s.gemeldet) return { ok:true };
  s.gemeldet = true;
  const offen = { code:s.code, saison:s.saison, spieltag:s.spieltag, eigene, gegner, tore, aufgegeben:!!aufgegeben };
  try { localStorage.setItem(LIGA_OFFEN_KEY, JSON.stringify(offen)); } catch (e) { /* privat */ }
  return offenesErgebnisSenden(s.code);
}
async function offenesErgebnisSenden(code){
  let o = null;
  try { o = JSON.parse(localStorage.getItem(LIGA_OFFEN_KEY)); } catch (e) { /* nichts */ }
  if (!o || o.code !== code) return { ok:true };
  try {
    await ligaApi({ t:'ergebnis', code, token:ligaToken(code), saison:o.saison, spieltag:o.spieltag, eigene:o.eigene, gegner:o.gegner, tore:o.tore, aufgegeben:o.aufgegeben });
    localStorage.removeItem(LIGA_OFFEN_KEY);
    return { ok:true };
  } catch (e) {
    // Vom Server abgelehnt (z. B. Spieltag schon vorbei): nicht ewig weiter versuchen
    if (e.vomServer) try { localStorage.removeItem(LIGA_OFFEN_KEY); } catch (x) { /* privat */ }
    return { ok:false, text:e.message, nochmal:!e.vomServer };
  }
}
