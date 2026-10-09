'use strict';
// Futbolero – Online-Liga: Freunde gründen eine Liga mit Code, jeder übernimmt eines der neun Teams,
// die übrigen spielt der Computer. Gespielt wird jeder gegen jeden (auf Wunsch mit Rückrunde).
// Spiele gegen ein Computer-Team spielt man allein im Browser und meldet das Ergebnis; Spiele zwischen
// zwei Menschen laufen in einem Online-Raum, das Ergebnis trägt der Server selbst ein. Computer gegen
// Computer wird nach Stärke ausgewürfelt, sobald alle Menschen ihr Spiel des Spieltags gespielt haben.
// Wer mitspielt, bekommt ein geheimes Token (im Browser gespeichert); der Server kennt nur dessen Hash.
const crypto = require('crypto');

const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_LIGEN = 300;
const INAKTIV_TAGE = 120;          // so lange ohne Aktivität bleibt eine Liga gespeichert
const STUFEN = ['leicht', 'normal', 'schwer'];

module.exports = function ligen({ speicher, staerken, teamNamen }){
  const TEAMS = staerken.length;
  const alle = () => speicher.daten.ligen;
  const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
  const zufallsId = () => crypto.randomBytes(8).toString('hex');

  function neuerCode(){
    for (;;){
      let c = '';
      for (let i = 0; i < 5; i++) c += CODE_ZEICHEN[crypto.randomInt(CODE_ZEICHEN.length)];
      if (!alle()[c]) return c;
    }
  }

  function nameFehler(n, was = 'Name'){
    if (typeof n !== 'string') return `${was} fehlt.`;
    n = n.trim();
    if (n.length < 1 || n.length > 16) return `${was}: 1 bis 16 Zeichen.`;
    if (!/^[A-Za-z0-9ÄÖÜäöüß_\-. ]+$/.test(n)) return `${was}: erlaubt sind Buchstaben, Ziffern, Leerzeichen und _ - .`;
    return null;
  }
  function ligaNameFehler(n){
    if (typeof n !== 'string') return 'Der Liga fehlt ein Name.';
    n = n.trim();
    if (n.length < 3 || n.length > 24) return 'Der Liganame muss 3 bis 24 Zeichen lang sein.';
    if (!/^[A-Za-z0-9ÄÖÜäöüß_\-.!' ]+$/.test(n)) return 'Im Liganamen gehen Buchstaben, Ziffern, Leerzeichen und _ - . ! \'';
    return null;
  }

  function einstPruefen(e, alt = {}){
    e = e && typeof e === 'object' ? e : {};
    return {
      groesse:[5, 7].includes(e.groesse) ? e.groesse : alt.groesse ?? 5,
      dauer:[2, 4, 6].includes(e.dauer) ? e.dauer : alt.dauer ?? 4,
      stufe:STUFEN.includes(e.stufe) ? e.stufe : alt.stufe ?? 'normal',
      runden:[1, 2].includes(e.runden) ? e.runden : alt.runden ?? 1
    };
  }

  /* ---------- Spielplan, Ergebnisse, Tabelle ---------- */
  // Kreisverfahren wie in der Karriere: 9 Teams + ein Platz „spielfrei“ = 9 Spieltage
  function spielplan(runden){
    const ids = [...Array(TEAMS).keys()];
    for (let i = ids.length - 1; i > 0; i--){ const j = crypto.randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const plaetze = TEAMS % 2 ? [...ids, -1] : ids;
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
    if (runden === 2) for (const runde of plan.slice()) plan.push(runde.map(([a, b]) => [b, a]));
    return plan;
  }
  const schluessel = (a, b) => `${a}-${b}`;

  function poisson(l){
    const g = Math.exp(-l);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > g && k < 12);
    return k - 1;
  }
  function simulieren(a, b){
    const sa = staerken[a], sb = staerken[b];
    return [poisson(1.45 * Math.exp((sa - sb) * 0.33)), poisson(1.2 * Math.exp((sb - sa) * 0.33))];
  }

  function tabelle(liga){
    const z = [...Array(TEAMS).keys()].map(i => ({ i, sp:0, s:0, u:0, n:0, tore:0, gegen:0, pkt:0 }));
    for (const runde of liga.erg) for (const [k, e] of Object.entries(runde || {})){
      const [a, b] = k.split('-').map(Number), [ta, tb] = e;
      const A = z[a], B = z[b];
      A.sp++; B.sp++; A.tore += ta; A.gegen += tb; B.tore += tb; B.gegen += ta;
      if (ta > tb){ A.s++; B.n++; A.pkt += 3; } else if (tb > ta){ B.s++; A.n++; B.pkt += 3; } else { A.u++; B.u++; A.pkt++; B.pkt++; }
    }
    return z.sort((x, y) => y.pkt - x.pkt || (y.tore - y.gegen) - (x.tore - x.gegen) || y.tore - x.tore || teamNamen[x.i].localeCompare(teamNamen[y.i]));
  }

  const mitgliedVonTeam = (liga, team) => liga.mitglieder.find(m => m.team === team) || null;

  // Sind alle Spiele mit Menschen eingetragen, wird der Rest ausgewürfelt und der nächste Spieltag beginnt
  function weiterPruefen(liga){
    while (liga.phase === 'saison'){
      const runde = liga.plan[liga.spieltag];
      const erg = liga.erg[liga.spieltag] || (liga.erg[liga.spieltag] = {});
      const offen = runde.some(([a, b]) => !erg[schluessel(a, b)] && (mitgliedVonTeam(liga, a) || mitgliedVonTeam(liga, b)));
      if (offen) return;
      for (const [a, b] of runde) if (!erg[schluessel(a, b)]) erg[schluessel(a, b)] = [...simulieren(a, b), 'c'];
      liga.spieltag++;
      if (liga.spieltag >= liga.plan.length) saisonEnde(liga);
    }
  }
  function saisonEnde(liga){
    liga.phase = 'pause';
    const tab = tabelle(liga);
    const meister = tab[0].i, m = mitgliedVonTeam(liga, meister);
    const plaetze = {};
    for (const x of liga.mitglieder) plaetze[x.id] = tab.findIndex(z => z.i === x.team) + 1;
    let torjaeger = null;
    for (const [id, n] of Object.entries(liga.tj)){
      const x = liga.mitglieder.find(y => y.id === id);
      if (x && n > 0 && (!torjaeger || n > torjaeger.tore)) torjaeger = { name:x.name, tore:n };
    }
    liga.historie.push({ saison:liga.saison, meister, name:m ? m.name : null, plaetze, torjaeger });
    if (liga.historie.length > 30) liga.historie.shift();
  }

  /* ---------- Ansicht für den Browser (ohne Token-Hashes) ---------- */
  function ansicht(liga, ich){
    return {
      code:liga.code, name:liga.name, leiter:liga.leiter, einst:liga.einst, phase:liga.phase, saison:liga.saison,
      spieltag:liga.spieltag, plan:liga.plan, erg:liga.erg, tj:liga.tj, historie:liga.historie, ver:liga.ver,
      mitglieder:liga.mitglieder.map(m => ({ id:m.id, name:m.name, team:m.team })),
      ich:ich ? ich.id : null
    };
  }
  function mitgliedAusToken(liga, token){
    if (typeof token !== 'string' || token.length < 20) return null;
    const h = hash(token);
    return liga.mitglieder.find(m => m.th === h) || null;
  }
  function geaendert(liga){
    liga.ver = (liga.ver || 0) + 1;
    liga.aktiv = Date.now();
    speicher.geaendert();
  }
  function ligaHolen(code){
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    return alle()[c] || null;
  }

  function aufraeumen(){
    const grenze = Date.now() - INAKTIV_TAGE * 86_400_000;
    let weg = 0;
    for (const [c, l] of Object.entries(alle())) if ((l.aktiv || 0) < grenze){ delete alle()[c]; weg++; }
    if (weg) speicher.geaendert();
  }
  setInterval(aufraeumen, 6 * 3600_000).unref();

  /* ---------- API: POST /api/liga mit { t:…, … } ---------- */
  function api(m){
    if (!m || typeof m !== 'object') return { fehler:'Ungültige Anfrage.' };
    const f = text => ({ fehler:text });
    if (m.t === 'neu'){
      const fl = ligaNameFehler(m.name) || nameFehler(m.spieler, 'Dein Name');
      if (fl) return f(fl);
      if (Object.keys(alle()).length >= MAX_LIGEN) return f('Gerade gibt es zu viele Ligen. Frag den Spieleentwickler.');
      const team = Number.isInteger(m.team) && m.team >= 0 && m.team < TEAMS ? m.team : 0;
      const token = crypto.randomBytes(24).toString('base64url');
      const ich = { id:zufallsId(), name:m.spieler.trim(), team, th:hash(token) };
      const liga = { code:neuerCode(), name:m.name.trim().replace(/\s+/g, ' '), erstellt:Date.now(), aktiv:Date.now(), leiter:ich.id,
        einst:einstPruefen(m.einst), phase:'anmeldung', saison:1, spieltag:0, plan:[], erg:[], mitglieder:[ich], tj:{}, historie:[], ver:0 };
      alle()[liga.code] = liga;
      geaendert(liga);
      return { ok:true, token, liga:ansicht(liga, ich) };
    }
    const liga = ligaHolen(m.code);
    if (!liga) return f('Diese Liga gibt es nicht (mehr). Stimmt der Code?');
    const ich = mitgliedAusToken(liga, m.token);
    switch (m.t){
      case 'ansehen':
        return { ok:true, liga:ansicht(liga, ich) };
      case 'beitreten': {
        if (ich) return { ok:true, liga:ansicht(liga, ich) };
        const fl = nameFehler(m.spieler, 'Dein Name');
        if (fl) return f(fl);
        const name = m.spieler.trim();
        if (liga.mitglieder.some(x => x.name.toLowerCase() === name.toLowerCase())) return f('Diesen Namen gibt es in der Liga schon.');
        if (!Number.isInteger(m.team) || m.team < 0 || m.team >= TEAMS) return f('Such dir ein Team aus.');
        if (mitgliedVonTeam(liga, m.team)) return f(`Die ${teamNamen[m.team]} hat schon jemand.`);
        const token = crypto.randomBytes(24).toString('base64url');
        const neu = { id:zufallsId(), name, team:m.team, th:hash(token) };
        liga.mitglieder.push(neu);
        // Wer mitten in der Saison kommt, übernimmt ein Computer-Team mit allen bisherigen Ergebnissen
        geaendert(liga);
        return { ok:true, token, liga:ansicht(liga, neu) };
      }
    }
    if (!ich) return f('Du bist in dieser Liga nicht dabei.');
    const leiter = liga.leiter === ich.id;
    switch (m.t){
      case 'team': {
        if (liga.phase !== 'anmeldung') return f('Das Team kann man nur vor dem Saisonstart wechseln.');
        if (!Number.isInteger(m.team) || m.team < 0 || m.team >= TEAMS) return f('Unbekanntes Team.');
        const besetzt = mitgliedVonTeam(liga, m.team);
        if (besetzt && besetzt !== ich) return f(`Die ${teamNamen[m.team]} hat schon ${besetzt.name}.`);
        ich.team = m.team;
        break;
      }
      case 'einst':
        if (!leiter) return f('Das darf nur, wer die Liga gegründet hat.');
        if (liga.phase === 'saison') return f('Während der Saison bleiben die Regeln gleich.');
        liga.einst = einstPruefen(m.einst, liga.einst);
        break;
      case 'start':
        if (!leiter) return f('Die Saison startet, wer die Liga gegründet hat.');
        if (liga.phase === 'saison') return f('Die Saison läuft schon.');
        if (liga.phase === 'pause'){ liga.saison++; liga.tj = {}; }
        liga.plan = spielplan(liga.einst.runden);
        liga.erg = []; liga.spieltag = 0; liga.phase = 'saison';
        weiterPruefen(liga);
        break;
      case 'ergebnis': {
        // Ein Spiel gegen ein Computer-Team, allein im Browser gespielt
        if (liga.phase !== 'saison' || m.saison !== liga.saison || m.spieltag !== liga.spieltag) return f('Dieser Spieltag ist schon vorbei – das Ergebnis zählt nicht mehr.');
        const paar = liga.plan[liga.spieltag].find(p => p.includes(ich.team));
        if (!paar) return f('Du bist an diesem Spieltag spielfrei.');
        const k = schluessel(paar[0], paar[1]), erg = liga.erg[liga.spieltag] || (liga.erg[liga.spieltag] = {});
        if (erg[k]) return { ok:true, schon:true, liga:ansicht(liga, ich) };
        const gegner = paar[0] === ich.team ? paar[1] : paar[0];
        if (mitgliedVonTeam(liga, gegner)) return f('Gegen einen Menschen spielt ihr online im Ligaraum.');
        const zahl = v => Number.isInteger(v) && v >= 0 && v <= 30 ? v : null;
        const eig = zahl(m.eigene), geg = zahl(m.gegner);
        if (eig == null || geg == null) return f('Das Ergebnis ist ungültig.');
        erg[k] = paar[0] === ich.team ? [eig, geg, m.aufgegeben ? 'a' : 'g'] : [geg, eig, m.aufgegeben ? 'a' : 'g'];
        const tore = Math.min(zahl(m.tore) || 0, eig);
        if (tore) liga.tj[ich.id] = (liga.tj[ich.id] || 0) + tore;
        weiterPruefen(liga);
        break;
      }
      case 'abschliessen': {
        if (!leiter) return f('Den Spieltag schließt, wer die Liga gegründet hat.');
        if (liga.phase !== 'saison') return f('Gerade läuft keine Saison.');
        if (m.spieltag !== liga.spieltag) return { ok:true, liga:ansicht(liga, ich) };
        const erg = liga.erg[liga.spieltag] || (liga.erg[liga.spieltag] = {});
        for (const [a, b] of liga.plan[liga.spieltag]) if (!erg[schluessel(a, b)]) erg[schluessel(a, b)] = [...simulieren(a, b), 'w'];
        weiterPruefen(liga);
        break;
      }
      case 'verlassen': {
        liga.mitglieder.splice(liga.mitglieder.indexOf(ich), 1);
        delete liga.tj[ich.id];
        if (!liga.mitglieder.length){ delete alle()[liga.code]; speicher.geaendert(); return { ok:true, geloescht:true }; }
        if (leiter) liga.leiter = liga.mitglieder[0].id;
        // Fehlt jetzt kein Mensch mehr am Spieltag, geht es weiter
        weiterPruefen(liga);
        geaendert(liga);
        return { ok:true, weg:true };
      }
      default:
        return f('Unbekannte Aktion.');
    }
    geaendert(liga);
    return { ok:true, liga:ansicht(liga, ich) };
  }

  /* ---------- Ligaspiele zwischen zwei Menschen (Online-Raum) ---------- */
  // Wen trifft dieses Mitglied am aktuellen Spieltag, und ist das ein Mensch?
  function direktspiel(code, token){
    const liga = ligaHolen(code);
    if (!liga) return { fehler:'Diese Liga gibt es nicht (mehr).' };
    const ich = mitgliedAusToken(liga, token);
    if (!ich) return { fehler:'Du bist in dieser Liga nicht dabei.' };
    if (liga.phase !== 'saison') return { fehler:'Gerade läuft keine Saison.' };
    const paar = liga.plan[liga.spieltag].find(p => p.includes(ich.team));
    if (!paar) return { fehler:'Du bist an diesem Spieltag spielfrei.' };
    const erg = liga.erg[liga.spieltag] || {};
    if (erg[schluessel(paar[0], paar[1])]) return { fehler:'Euer Spiel an diesem Spieltag ist schon gespielt.' };
    const heim = mitgliedVonTeam(liga, paar[0]), gast = mitgliedVonTeam(liga, paar[1]);
    if (!heim || !gast) return { fehler:'Dein Gegner ist ein Computer-Team – das spielst du allein.' };
    return {
      ich, paar, erwartet:[heim, gast].map(x => ({ id:x.id, name:x.name })),
      key:`l:${liga.code}:${liga.saison}:${liga.spieltag}:${paar[0]}-${paar[1]}`,
      einst:{ heim:paar[0], gast:paar[1], groesse:liga.einst.groesse, dauer:liga.einst.dauer, stufe:liga.einst.stufe },
      info:{ code:liga.code, name:liga.name, saison:liga.saison, spieltag:liga.spieltag, paar }
    };
  }

  // Ergebnis eines Online-Ligaspiels eintragen. tore: [heim, gast], schuetzen: { mitgliedId: Tore }
  function direktspielWerten(info, tore, schuetzen){
    const liga = ligaHolen(info.code);
    if (!liga || liga.phase !== 'saison' || liga.saison !== info.saison || liga.spieltag !== info.spieltag) return { gewertet:false, text:'Der Spieltag ist schon vorbei – das Ergebnis zählt nicht mehr.' };
    const [a, b] = info.paar, k = schluessel(a, b);
    const erg = liga.erg[liga.spieltag] || (liga.erg[liga.spieltag] = {});
    if (erg[k]) return { gewertet:false, text:'Für dieses Spiel steht schon ein Ergebnis in der Tabelle.' };
    erg[k] = [tore[0], tore[1], 'g'];
    for (const [id, n] of Object.entries(schuetzen)){
      if (n > 0 && liga.mitglieder.some(x => x.id === id)) liga.tj[id] = (liga.tj[id] || 0) + n;
    }
    weiterPruefen(liga);
    geaendert(liga);
    return { gewertet:true, text:'Das Ergebnis steht in der Ligatabelle.' };
  }

  return { api, direktspiel, direktspielWerten, aufraeumen };
};
