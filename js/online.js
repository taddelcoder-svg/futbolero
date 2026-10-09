'use strict';
// Futbolero – Online: Räume mit Code, Lobby, Spiel übers Netz, Olympiade.
// Der Gastgeber rechnet das Spiel wie offline und schickt etwa 30-mal pro Sekunde den Spielstand;
// die anderen zeigen ihn leicht verzögert und flüssig interpoliert an und schicken nur ihre Eingaben.

const online = {
  ws:null, rolle:'aus',          // aus, lobby, host, gast
  ich:null, raum:null, host:false, olymp:null, zurueck:null, liga:null,
  staende:[], ev:[], sendeTakt:0, letzteEingabe:'', eingabeZeit:0, schilder:[], ende:null, wegTore:{}
};
const VERZOEGERUNG = 100;        // ms, um die Gäste den Spielstand hinterherzeigen

function istOnline(){ return online.rolle === 'host' || online.rolle === 'gast'; }
function onlineSenden(m){ if (online.ws && online.ws.readyState === 1) online.ws.send(JSON.stringify(m)); }

function onlineVerbinden(ticket){
  return new Promise((ok, nein) => {
    if (online.ws && online.ws.readyState === 1) return ok();
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${ticket ? '?olymp=' + encodeURIComponent(ticket) : ''}`;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return nein(e); }
    online.ws = ws;
    ws.onopen = () => ok();
    ws.onerror = () => nein(new Error('Verbindung fehlgeschlagen'));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onlineNachricht(m); };
    ws.onclose = () => {
      const war = online.rolle;
      online.ws = null;
      if (war !== 'aus'){
        online.rolle = 'aus';
        if (war === 'host' || war === 'gast' || war === 'lobby'){
          const knoepfe = online.liga ? [{ text:'Zurück zur Liga', aktion:() => ligaOnlineZeigen(online.liga) }] : [];
          knoepfe.push({ text:'Zum Menü', zweit:knoepfe.length > 0, aktion:zumMenue });
          dialogZeigen('Verbindung weg', el('p', 'hinweis', 'Die Verbindung zum Server ist abgerissen.'), knoepfe);
        }
      }
    };
  });
}

function onlineTrennen(){
  const ws = online.ws;
  document.documentElement.classList.remove('online');
  online.rolle = 'aus'; online.raum = null; online.ws = null; online.staende = [];
  schilderEntfernen();
  if (ws){ try { ws.close(); } catch (e) { /* schon zu */ } }
}

/* ---------- Menü: Raum erstellen oder beitreten ---------- */
function onlineMenue(fehlerText){
  const inhalt = el('div');
  inhalt.appendChild(el('p', 'hinweis', 'Spielt zusammen oder gegeneinander – jeder steuert einen Spieler, freie Plätze übernimmt der Computer. Der Gastgeber braucht die schnellste Verbindung.'));
  if (fehlerText){ const f = el('p', 'hinweis fehler', fehlerText); inhalt.appendChild(f); }
  const zeile = (label, feld) => { const z = el('div', 'zeile'); z.appendChild(el('span', null, label)); z.appendChild(feld); return z; };
  const name = document.createElement('input');
  name.className = 'feld'; name.maxLength = 16; name.autocomplete = 'nickname'; name.placeholder = 'Spitzname';
  name.value = einstellungen.name || '';
  inhalt.appendChild(zeile('Dein Name', name));
  const code = document.createElement('input');
  code.className = 'feld code'; code.maxLength = 4; code.placeholder = 'ABCD'; code.autocapitalize = 'characters';
  inhalt.appendChild(zeile('Raum-Code', code));
  const nameHolen = () => {
    const n = name.value.trim();
    einstellungen.name = n; speichern();
    return n;
  };
  const los = async (was) => {
    const n = nameHolen();
    if (!n) return onlineMenue('Gib zuerst einen Namen ein.');
    try { await onlineVerbinden(); } catch (e) { return onlineMenue('Der Server ist gerade nicht erreichbar.'); }
    online.rolle = 'lobby';
    if (was === 'neu') onlineSenden({ t:'erstellen', name:n, einst:{ heim:einstellungen.team, gast:einstellungen.gegner, groesse:einstellungen.groesse, dauer:einstellungen.dauer, stufe:einstellungen.stufe } });
    else {
      const c = code.value.trim().toUpperCase();
      if (c.length !== 4) return onlineMenue('Der Raum-Code hat 4 Zeichen.');
      onlineSenden({ t:'beitreten', code:c, name:n });
    }
  };
  $('startEbene').classList.add('aus');
  dialogZeigen('Online spielen', inhalt, [
    { text:'Neuen Raum erstellen', aktion:() => los('neu') },
    { text:'Raum beitreten', zweit:true, aktion:() => los('beitreten') },
    { text:'Zurück', zweit:true, aktion:() => { onlineTrennen(); zumMenue(); } }
  ]);
  code.addEventListener('keydown', e => { if (e.key === 'Enter') los('beitreten'); });
  setTimeout(() => (name.value ? code : name).focus({ preventScroll:true }), 80);
}

/* ---------- Lobby ---------- */
function lobbyZeigen(){
  const r = online.raum;
  if (!r) return;
  const ichHost = r.host === online.ich;
  const inhalt = el('div');
  const fest = !!(r.olymp || r.liga);   // Olympia und Liga: Teams und Regeln stehen schon fest
  if (r.olymp){
    const da = r.mitglieder.map(m => m.name);
    const fehlt = r.olymp.erwartet.filter(n => !da.includes(n));
    inhalt.appendChild(el('p', 'hinweis', fehlt.length
      ? `Warte auf ${fehlt.join(', ')} … Anpfiff spätestens in ${r.olymp.startIn} s.`
      : `Alle da – gleich geht es los.`));
  } else if (r.liga){
    const da = r.mitglieder.map(m => m.name);
    const fehlt = r.liga.erwartet.filter(n => !da.includes(n));
    inhalt.appendChild(el('p', 'hinweis', `${r.liga.name} · ${r.liga.spieltag + 1}. Spieltag`));
    inhalt.appendChild(el('p', 'hinweis', fehlt.length
      ? `Warte auf ${fehlt.join(', ')} … Sag Bescheid, dass es losgeht: In der Liga auf „Zum Ligaspiel“ tippen.`
      : r.liga.startIn != null ? `Beide da – Anpfiff in ${r.liga.startIn} s.` : 'Beide da – gleich geht es los.'));
  } else {
    const c = el('p', 'raumcode');
    c.appendChild(el('span', null, 'Raum-Code'));
    c.appendChild(el('b', null, r.code));
    inhalt.appendChild(c);
    inhalt.appendChild(el('p', 'hinweis', ichHost ? 'Gib deinen Freunden den Code. Du bist Gastgeber und pfeifst an.' : 'Warte, bis der Gastgeber anpfeift.'));
  }
  const [kitA, kitB] = trikotsWaehlen(TEAMS[r.einst.heim], TEAMS[r.einst.gast]);
  const spalten = el('div', 'lobby');
  [[r.einst.heim, kitA, 0], [r.einst.gast, kitB, 1]].forEach(([t, kit, i]) => {
    const sp = el('div', 'lobby-team');
    const kopf = el('div', 'lobby-kopf');
    if (ichHost && !fest){
      const pfeil = (text, schritt) => {
        const b = el('button', 'pfeil', text);
        b.setAttribute('aria-label', schritt < 0 ? 'Voriges Team' : 'Nächstes Team');
        b.addEventListener('click', () => {
          const e = { ...r.einst };
          const feld = i ? 'gast' : 'heim', anders = i ? e.heim : e.gast;
          do { e[feld] = (e[feld] + schritt + TEAMS.length) % TEAMS.length; } while (e[feld] === anders);
          onlineSenden({ t:'einst', einst:e });
        });
        return b;
      };
      kopf.appendChild(pfeil('◀', -1));
    }
    kopf.appendChild(trikotSvg(kit));
    kopf.appendChild(el('b', null, TEAMS[t].name));
    if (ichHost && !fest){
      const b = el('button', 'pfeil', '▶');
      b.setAttribute('aria-label', 'Nächstes Team');
      b.addEventListener('click', () => {
        const e = { ...r.einst };
        const feld = i ? 'gast' : 'heim', anders = i ? e.heim : e.gast;
        do { e[feld] = (e[feld] + 1) % TEAMS.length; } while (e[feld] === anders);
        onlineSenden({ t:'einst', einst:e });
      });
      kopf.appendChild(b);
    }
    sp.appendChild(kopf);
    const liste = el('ul');
    for (const m of r.mitglieder.filter(x => x.team === i)){
      const li = el('li', m.id === online.ich ? 'ich' : null, m.name);
      if (m.id === r.host) li.appendChild(el('small', null, ' · Gastgeber'));
      liste.appendChild(li);
    }
    const frei = r.einst.groesse - 1 - r.mitglieder.filter(x => x.team === i).length;
    if (frei > 0) liste.appendChild(el('li', 'leer', `${frei} × Computer`));
    sp.appendChild(liste);
    const meins = r.mitglieder.find(x => x.id === online.ich);
    if (!fest && meins && meins.team !== i && frei > 0){
      const b = el('button', 'knopf zweit klein', 'Hierhin wechseln');
      b.addEventListener('click', () => onlineSenden({ t:'team', team:i }));
      sp.appendChild(b);
    }
    spalten.appendChild(sp);
  });
  inhalt.appendChild(spalten);
  const stufen = { leicht:'Leicht', normal:'Normal', schwer:'Schwer' };
  if (ichHost && !fest){
    const wahl = (label, feld, werte) => {
      const z = el('div', 'zeile');
      z.appendChild(el('span', null, label));
      const w = el('div', 'wahl');
      for (const [wert, text] of werte){
        const b = el('button', null, text);
        b.setAttribute('aria-pressed', String(r.einst[feld] === wert));
        b.addEventListener('click', () => onlineSenden({ t:'einst', einst:{ ...r.einst, [feld]:wert } }));
        w.appendChild(b);
      }
      z.appendChild(w);
      inhalt.appendChild(z);
    };
    wahl('Spieler', 'groesse', [[5, '5 gegen 5'], [7, '7 gegen 7']]);
    wahl('Spielzeit', 'dauer', [[2, '2 Min.'], [4, '4 Min.'], [6, '6 Min.']]);
    wahl('Computer', 'stufe', Object.entries(stufen));
  } else {
    inhalt.appendChild(el('p', 'hinweis', `${r.einst.groesse} gegen ${r.einst.groesse} · ${r.einst.dauer} Minuten · Computer ${stufen[r.einst.stufe]}`));
  }
  const knoepfe = [];
  if (ichHost && !r.liga) knoepfe.push({ text:'Anpfiff!', aktion:() => onlineSenden({ t:'start' }) });
  if (r.olymp){
    if (online.zurueck) knoepfe.push({ text:'Zurück zur Olympiade', zweit:true, aktion:() => { location.href = online.zurueck; } });
  } else if (r.liga){
    knoepfe.push({ text:'Zurück zur Liga', zweit:true, aktion:() => { const c = r.liga.code; onlineTrennen(); ligaOnlineZeigen(c); } });
  } else knoepfe.push({ text:'Raum verlassen', zweit:true, aktion:() => { onlineTrennen(); zumMenue(); } });
  dialogZeigen(r.olymp ? r.olymp.titel : r.liga ? 'Ligaspiel' : 'Online-Raum', inhalt, knoepfe);
}

/* ---------- Nachrichten vom Server ---------- */
function onlineNachricht(m){
  switch (m.t){
    case 'raum':
      online.raum = m; online.ich = m.ich; online.host = m.host === m.ich;
      if (m.zurueck) online.zurueck = m.zurueck;
      if (online.rolle === 'lobby' && m.phase === 'lobby' && !online.ende) lobbyZeigen();
      break;
    case 'start': return onlineSpielStarten(m);
    case 'e': {
      if (online.rolle !== 'host') return;
      const k = spiel.steuerer.find(x => x.id === m.von);
      if (k) fernAnwenden(k.e, m);
      break;
    }
    case 'z':
      if (online.rolle !== 'gast') return;
      online.staende.push({ zeit:performance.now(), d:m });
      if (online.staende.length > 12) online.staende.shift();
      for (const ev of m.ev || []) effektAbspielen(ev);
      break;
    case 'weg': {
      if (online.rolle !== 'host') return;
      const i = spiel.steuerer.findIndex(x => x.id === m.id);
      if (i < 0) return;
      const k = spiel.steuerer[i];
      online.wegTore[k.id] = k.tore;
      if (k.spieler){ k.spieler.st = null; k.spieler.wx = k.spieler.wz = 0; }
      spiel.steuerer.splice(i, 1);
      for (const t of spiel.teams) t.mensch = spiel.steuerer.some(x => x.team === t);
      meldung('Verbindung weg', `${k.name} spielt jetzt der Computer`);
      break;
    }
    case 'ende': return onlineEnde(m);
    case 'host': return gastgeberWechsel(m);
    case 'fehler':
      if (m.liga && online.liga){
        const code = online.liga;
        onlineTrennen();
        dialogZeigen('Ligaspiel', el('p', 'hinweis', m.text), [{ text:'Zurück zur Liga', aktion:() => ligaOnlineZeigen(code) }]);
      } else if (m.olymp){
        online.rolle = 'aus';
        if (m.zurueck) online.zurueck = m.zurueck;
        dialogZeigen('Olympiade', el('p', 'hinweis', m.text), online.zurueck
          ? [{ text:'Zurück zur Olympiade', aktion:() => { location.href = online.zurueck; } }]
          : [{ text:'Zum Menü', aktion:zumMenue }]);
      } else if (online.rolle === 'lobby' && !online.raum) onlineMenue(m.text);
      else meldung('Hinweis', m.text);
      break;
  }
}

function onlineSpielStarten(m){
  const e = m.einst;
  online.host = m.host === online.ich;
  online.rolle = online.host ? 'host' : 'gast';
  online.staende = []; online.ev = []; online.ende = null; online.wegTore = {};
  $('startEbene').classList.add('aus');
  $('dialogEbene').classList.add('aus');
  if (document.activeElement) document.activeElement.blur();
  spielStarten({ heim:e.heim, gast:e.gast, groesse:e.groesse, stufe:STUFEN[e.stufe], dauer:e.dauer, modus:'online',
    menschen:m.mitglieder, ich:online.ich });
  spiel.gezaehlt = true;
  if (!online.host){ spiel.phase = 'online'; spiel.pause = false; }
  $('hud').classList.add('an');
  eingabe.aktiv = true;
  allesLoslassen();
  Ton.start();
  Ton.stimmungSetzen(0.35);
  schilderBauen();
  document.documentElement.classList.add('online');
  sichtMelden();
}

/* ---------- Gastgeber ---------- */
const r2 = v => Math.round(v * 100) / 100;
function spielstand(){
  const p = [];
  for (const q of spiel.alle){
    p.push(r2(q.x), r2(q.z), r2(q.y), r2(q.dir), r2(q.lauf), r2(q.tempo), r2(q.schussT), r2(q.graetsche), r2(q.hecht), q.hechtSeite,
      r2(q.fallT), r2(q.kopfT), (q.jubel ? 1 : 0) | (q.halten && ball.besitzer === q ? 2 : 0) | (q.einwurf << 2) | (q.weg ? 16 : 0));
  }
  const tg = {};
  for (const k of spiel.steuerer) tg[k.id] = k.tore;
  return {
    t:'z', ph:spiel.phase, u:r2(spiel.uhr), hz:spiel.halbzeit, hd:spiel.halbDauer, ns:r2(spiel.nachspiel),
    to:spiel.teams.map(t => t.tore), se:spiel.teams.map(t => t.seite),
    b:[r2(ball.x), r2(ball.y), r2(ball.z), r2(ball.vx), r2(ball.vz)], bb:ball.besitzer ? spiel.alle.indexOf(ball.besitzer) : -1,
    p, st:spiel.steuerer.map(k => [k.id, k.spieler ? spiel.alle.indexOf(k.spieler) : -1]),
    ts:spiel.torschuetze ? spiel.alle.indexOf(spiel.torschuetze) : -1, tt:spiel.torTeam ? spiel.torTeam.idx : -1, tsd:spiel.torSeite,
    tg, ev:online.ev.splice(0),
    // Für einen Gastgeber-Wechsel: anstehender Standard, Anstoß-Reihenfolge, Tore Ausgestiegener
    na:standardFuerWechsel(), at:[spiel.ersterAnstoss, spiel.anstossTeam], wt:online.wegTore
  };
}
function standardFuerWechsel(){
  const st = spiel.phase === 'aus' ? spiel.naechster : spiel.phase === 'warten' ? spiel.letzterStandard : null;
  return st && st.team ? [st.art, st.team.idx, r2(st.x || 0), r2(st.z || 0)] : null;
}
function onlineHostTakt(dt){
  online.sendeTakt -= dt;
  if (online.sendeTakt > 0) return;
  online.sendeTakt = 1 / 30;
  onlineSenden(spielstand());
}
function onlineHostEnde(){
  const schuetzen = {};
  for (const k of spiel.steuerer) schuetzen[k.id] = k.tore;
  // Wer das Spiel verlassen hat, behält seine Tore
  for (const id in online.wegTore) if (!(id in schuetzen)) schuetzen[id] = online.wegTore[id];
  onlineSenden({ t:'ende', tore:spiel.teams.map(t => t.tore), schuetzen, stat:statistikDaten() });
}

// Geräusche und Meldungen des Gastgebers bei allen anderen abspielen
const EFFEKTE = { s:'schuss', p:'pfiff', pf:'pfosten', n:'netz', j:'jubel', r:'raunen' };
function effekteMitschneiden(){
  for (const [kurz, name] of Object.entries(EFFEKTE)){
    const orig = Ton[name];
    Ton[name] = (...a) => { if (online.rolle === 'host') online.ev.push([kurz, ...a]); return orig(...a); };
  }
  const meldungOrig = meldung;
  meldung = (...a) => { if (online.rolle === 'host') online.ev.push(['m', ...a]); return meldungOrig(...a); };
}
function effektAbspielen(ev){
  const [art, ...a] = ev;
  if (art === 'm') return meldung(...a.map(x => x == null ? undefined : x));
  const name = EFFEKTE[art];
  if (name) Ton[name](...a);
}

/* ---------- Gastgeber-Wechsel ----------
   Der Server bestimmt einen neuen Gastgeber, wenn der alte weg ist oder sein Tab im Hintergrund liegt.
   Wer übernimmt, rechnet ab dem letzten empfangenen Spielstand weiter. */
function gastgeberWechsel(m){
  if (online.rolle !== 'host' && online.rolle !== 'gast') return;
  const ich = m.id === online.ich;
  online.host = ich;
  if (ich && online.rolle === 'gast') gastgeberWerden();
  else if (!ich && online.rolle === 'host'){
    meldung('Neuer Gastgeber', 'Ein Mitspieler rechnet jetzt das Spiel');
    online.rolle = 'gast'; online.staende = []; online.ev = [];
    spiel.phase = 'online'; spiel.pause = false;
  }
  if (m.weg) onlineNachricht({ t:'weg', id:m.weg });
}
function gastgeberWerden(){
  const letzt = online.staende[online.staende.length - 1], d = letzt && letzt.d;
  if (d){
    // Der genaue letzte Stand statt der verzögerten Anzeige
    spiel.alle.forEach((q, i) => { const o = i * 13; q.x = d.p[o]; q.z = d.p[o + 1]; q.y = d.p[o + 2]; q.dir = d.p[o + 3]; });
    [ball.x, ball.y, ball.z, ball.vx, ball.vz] = d.b; ball.vy = 0;
    ball.besitzer = d.bb >= 0 ? spiel.alle[d.bb] : null;
    for (const k of spiel.steuerer) if (d.tg && k.id in d.tg) k.tore = d.tg[k.id];
    if (d.wt) Object.assign(online.wegTore, d.wt);
    if (Array.isArray(d.at)){ spiel.ersterAnstoss = d.at[0]; spiel.anstossTeam = d.at[1]; }
  }
  for (const q of spiel.alle){ q.vx = q.vz = q.wx = q.wz = 0; q.sprungT = 0; }
  meldung('Du bist jetzt Gastgeber', 'Dein Browser rechnet das Spiel – lass diesen Tab vorne');
  online.rolle = 'host'; online.staende = []; online.ev = []; online.sendeTakt = 0;
  spiel.pause = false; spiel.phaseZeit = 0;
  const ph = d ? d.ph : 'spiel';
  if (ph === 'aus' || ph === 'warten' || ((ph === 'pause-halbzeit' || ph === 'halbzeit-online') && spiel.halbzeit === 2)){
    // Standard neu aufstellen (ohne bekannten Standard: Anstoß)
    spiel.naechster = d && Array.isArray(d.na) && spiel.teams[d.na[1]]
      ? { art:d.na[0], team:spiel.teams[d.na[1]], x:d.na[2], z:d.na[3] }
      : { art:'anstoss', team:spiel.teams[spiel.anstossTeam] };
    spiel.phase = 'aus'; spiel.phaseZeit = 1.1;
  } else if (ph === 'tor' || ph === 'wiederholung' || ph === 'warten-anstoss') anstossNachTor();
  else if (ph === 'pause-halbzeit' || ph === 'halbzeit-online') spiel.phase = 'halbzeit-online';
  else if (ph === 'abpfiff' || ph === 'ende') spiel.phase = 'abpfiff';
  else spiel.phase = 'spiel';
}
// Sichtbarkeit an den Server: liegt der Tab des Gastgebers im Hintergrund, übernimmt ein anderer
function sichtMelden(){ if (online.ws) onlineSenden({ t:'sicht', v:!document.hidden }); }
document.addEventListener('visibilitychange', sichtMelden);

/* ---------- Gäste ---------- */
function onlineGastTakt(dt){
  onlineEingabeSenden(dt);
  const st = online.staende;
  if (!st.length) return;
  const jetzt = performance.now() - VERZOEGERUNG;
  let a = st[0], b = st[st.length - 1];
  for (let i = 0; i < st.length - 1; i++){
    if (st[i].zeit <= jetzt && st[i + 1].zeit >= jetzt){ a = st[i]; b = st[i + 1]; break; }
  }
  if (jetzt >= b.zeit) a = b;
  const f = b.zeit > a.zeit ? clamp((jetzt - a.zeit) / (b.zeit - a.zeit), 0, 1) : 1;
  const A = a.d, B = b.d;
  const L = (i, feld) => lerp(A.p[i * 13 + feld], B.p[i * 13 + feld], f);
  spiel.alle.forEach((q, i) => {
    const o = i * 13;
    q.x = L(i, 0); q.z = L(i, 1); q.y = L(i, 2);
    q.dir = A.p[o + 3] + winkelDiff(A.p[o + 3], B.p[o + 3]) * f;
    q.lauf = L(i, 4); q.tempo = L(i, 5); q.schussT = L(i, 6); q.graetsche = L(i, 7); q.hecht = L(i, 8);
    q.hechtSeite = B.p[o + 9]; q.fallT = L(i, 10); q.kopfT = L(i, 11);
    const fl = B.p[o + 12];
    q.jubel = !!(fl & 1); q.halten = !!(fl & 2); q.einwurf = (fl >> 2) & 3; q.weg = !!(fl & 16);
    q.sprungT = 0; q.st = null;
  });
  ball.x = lerp(A.b[0], B.b[0], f); ball.y = lerp(A.b[1], B.b[1], f); ball.z = lerp(A.b[2], B.b[2], f);
  ball.vx = B.b[3]; ball.vz = B.b[4];
  ball.besitzer = B.bb >= 0 ? spiel.alle[B.bb] : null;
  for (const [id, idx] of B.st){
    const k = spiel.steuerer.find(x => x.id === id);
    if (!k) continue;
    k.spieler = idx >= 0 ? spiel.alle[idx] : null;
    if (k.spieler) k.spieler.st = k;
  }
  for (const k of spiel.steuerer) if (!B.st.some(([id]) => id === k.id)) k.spieler = null;
  // Phase, Uhr und Stand
  const ph = B.ph === 'wiederholung' || B.ph === 'warten-anstoss' ? 'tor' : B.ph;
  if (ph !== spiel.phase){
    if (ph === 'tor'){
      spiel.torSeite = B.tsd; spiel.torTeam = spiel.teams[B.tt] || null;
      spiel.torschuetze = spiel.alle[B.ts] || null;
      Fans.jubelTeam = B.tt; Fans.jubelZeit = 5;
      Welt.netzWackeln[B.tsd] = 1.2;
    }
    if (ph === 'warten' || spiel.phase === 'tor') kam.schnitt = true;
    spiel.phase = ph; spiel.phaseZeit = 0;
  }
  spiel.phaseZeit += dt;
  spiel.uhr = B.u; spiel.halbzeit = B.hz; spiel.halbDauer = B.hd; spiel.nachspiel = B.ns;
  B.to.forEach((t, i) => { if (spiel.teams[i].tore !== t){ spiel.teams[i].tore = t; hudStand(); } });
  B.se.forEach((s, i) => { spiel.teams[i].seite = s; });
  // Schussanzeige nur für die eigene Taste
  const t = eingabe.tasten.schuss;
  spiel.ladung = t.halten && ball.besitzer === spiel.gesteuert && spiel.gesteuert ? Math.min(1, t.dauer / 0.85) : 0;
}

function onlineEingabeSenden(dt){
  const e = eingabe, t = e.tasten;
  const d = [], u = [];
  for (const [n, k] of Object.entries(t)){ if (k.neu) d.push(n); if (k.los) u.push([n, r2(k.dauer)]); }
  const x = r2(e.x), z = r2(e.z), sp = e.sprint ? 1 : 0;
  const schluessel = `${x},${z},${sp}`;
  online.eingabeZeit += dt;
  if (!d.length && !u.length && schluessel === online.letzteEingabe && online.eingabeZeit < 0.25) return;
  online.letzteEingabe = schluessel; online.eingabeZeit = 0;
  onlineSenden({ t:'e', x, z, sp, d, u });
}

/* ---------- Namensschilder über den Spielern der Menschen ---------- */
function schilderEntfernen(){
  for (const s of online.schilder) szene.remove(s.sprite);
  online.schilder = [];
}
function schilderBauen(){
  schilderEntfernen();
  for (const k of spiel.steuerer){
    if (k === spiel.ich) continue;
    const kit = k.team.kit;
    const c = leinwand(256, 64, (g, w, h) => {
      g.font = '800 34px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
      const breite = Math.min(w - 8, g.measureText(k.name).width + 28);
      g.fillStyle = 'rgba(11,15,20,.72)';
      g.beginPath(); g.roundRect ? g.roundRect((w - breite) / 2, 10, breite, 44, 10) : g.rect((w - breite) / 2, 10, breite, 44); g.fill();
      g.fillStyle = kit.trikot; g.fillRect((w - breite) / 2 + 8, 22, 6, 20);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(k.name, w / 2 + 6, 33, breite - 24);
    });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(c), depthTest:false, transparent:true, fog:false }));
    sprite.scale.set(3.2, 0.8, 1);
    sprite.renderOrder = 5;
    szene.add(sprite);
    online.schilder.push({ k, sprite });
  }
}
function schilderZeigen(){
  for (const { k, sprite } of online.schilder){
    const p = k.spieler;
    sprite.visible = !!p && spiel.phase !== 'wiederholung' && spiel.steuerer.includes(k);
    if (sprite.visible) sprite.position.set(p.x, 2.75 + (p.y || 0), p.z);
  }
}

/* ---------- Ende ---------- */
function onlineEnde(m){
  const war = online.rolle;
  online.rolle = 'lobby';
  online.ende = m;
  spiel.phase = 'ende';
  if (war === 'gast' || war === 'host'){ m.tore.forEach((t, i) => { if (spiel.teams[i]) spiel.teams[i].tore = t; }); hudStand(); }
  const meins = m.liste.find(x => x.id === online.ich);
  const team = meins ? meins.team : 0;
  const eig = m.tore[team], geg = m.tore[1 - team];
  const titel = m.abgebrochen ? 'Spiel abgebrochen' : eig > geg ? 'Sieg!' : eig < geg ? 'Niederlage' : 'Unentschieden';
  if (eig > geg){ Fans.jubelTeam = team; Fans.jubelZeit = 6; Ton.jubel(0.9); }
  const inhalt = el('div');
  const d = m.stat && Array.isArray(m.stat.teams) && m.stat.teams.length === 2 ? m.stat : null;
  if (d) d.teams.forEach((t, i) => { t.tore = m.tore[i]; });
  if (d || spiel.teams.length) inhalt.appendChild(ergebnisBlock(m.abgebrochen ? (m.liga ? 'Das Spiel wurde abgebrochen.' : 'Das Spiel wurde abgebrochen – der Stand zählt.') : null, d || statistikDaten()));
  const torschuetzen = m.liste.filter(x => m.schuetzen[x.id] > 0).sort((a, b) => m.schuetzen[b.id] - m.schuetzen[a.id]);
  if (torschuetzen.length) inhalt.appendChild(el('p', 'hinweis', 'Eure Tore: ' + torschuetzen.map(x => `${x.name} ${m.schuetzen[x.id]}`).join(' · ')));
  if (m.liga) inhalt.appendChild(el('p', 'hinweis' + (m.liga.gewertet ? '' : ' fehler'), m.liga.text));
  if (d) inhalt.appendChild(statistikBereich(d));
  const knoepfe = [];
  if (online.raum && online.raum.liga){
    const code = online.raum.liga.code;
    knoepfe.push({ text:'Zurück zur Liga', aktion:() => { onlineTrennen(); ligaOnlineZeigen(code); } });
  } else if (online.raum && online.raum.olymp){
    inhalt.appendChild(el('p', 'hinweis', 'Das Ergebnis ist an die Olympiade gemeldet.'));
    if (online.zurueck) knoepfe.push({ text:'Zurück zur Olympiade', aktion:() => { location.href = online.zurueck; } });
  } else {
    knoepfe.push({ text:'Zurück in den Raum', aktion:() => { online.ende = null; schilderEntfernen(); lobbyZeigen(); } });
    knoepfe.push({ text:'Raum verlassen', zweit:true, aktion:() => { onlineTrennen(); zumMenue(); } });
  }
  $('elfer').classList.remove('an');
  dialogZeigen(titel, inhalt, knoepfe);
}

/* ---------- Olympiade: mit Ticket direkt in den Raum der Gruppe ---------- */
const OLYMP_KEY = 'futbolero-olymp';
async function olympiaPruefen(){
  const p = new URLSearchParams(location.search);
  let t = p.get('olymp');
  try { if (t) sessionStorage.setItem(OLYMP_KEY, t); else t = sessionStorage.getItem(OLYMP_KEY); } catch (e) { /* privat */ }
  if (!t) return;
  if (p.has('olymp')) history.replaceState(null, '', location.pathname);
  $('startEbene').classList.add('aus');
  dialogZeigen('Olympiade', el('p', 'hinweis', 'Verbinde mit deiner Gruppe …'), []);
  try { await onlineVerbinden(t); }
  catch (e){ return dialogZeigen('Olympiade', el('p', 'hinweis', 'Der Server ist gerade nicht erreichbar. Lade die Seite gleich nochmal.'), [{ text:'Zum Menü', aktion:zumMenue }]); }
  online.rolle = 'lobby';
  onlineSenden({ t:'olymp', ticket:t });
}
