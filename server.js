'use strict';
// Futbolero – Server: liefert das Spiel aus und verbindet Online-Spiele.
// Online rechnet der Browser des Gastgebers das Spiel; der Server leitet die Eingaben der
// Mitspieler an ihn weiter und seinen Spielstand an alle anderen (WebSocket unter /ws).
// Als Disziplin der Olympiade landet eine Gruppe per Ticket automatisch in einem gemeinsamen
// Raum; am Ende meldet der Server die Rangliste (olymp.js).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const zugang = require('./zugang')({ titel:'Futbolero' });
const olymp = require('./olymp')({ spiel:'futbolero' });

const PORT = Number(process.env.PORT) || 10000;
const TEAM_ANZAHL = 9;                 // Anzahl der Teams im Spiel (js/grundlagen.js)
const OLYMP_WARTEN = 60_000;           // so lange wartet ein Olympia-Raum höchstens auf Nachzügler
const MAX_RAEUME = 60;

const SEITEN = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/datenschutz': 'datenschutz.html',
  '/datenschutz.html': 'datenschutz.html'
};
const TYPEN = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.woff2':'font/woff2',
  '.txt':'text/plain; charset=utf-8'
};

function senden(res, datei, cache){
  fs.stat(datei, (fehler, info) => {
    if (fehler || !info.isFile()){
      res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden');
    }
    res.writeHead(200, {
      'Content-Type':TYPEN[path.extname(datei)] || 'application/octet-stream',
      'Cache-Control':cache,
      'X-Content-Type-Options':'nosniff'
    });
    fs.createReadStream(datei).pipe(res);
  });
}
function json(res, status, daten){
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(JSON.stringify(daten));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') return json(res, 200, { ok:true });
  if (url.pathname === '/datenschutz' || url.pathname === '/datenschutz.html') return senden(res, path.join(__dirname, 'datenschutz.html'), 'no-cache');
  // Passwort für Familie und Freunde; ein gültiges Olympia-Ticket im Link ersetzt es (zugang.js)
  if (zugang.pruefen(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD'){
    res.writeHead(405, { 'Content-Type':'text/plain; charset=utf-8', Allow:'GET, HEAD' });
    return res.end('Nicht erlaubt');
  }
  if (SEITEN[url.pathname]) return senden(res, path.join(__dirname, SEITEN[url.pathname]), 'no-cache');

  // Spielcode: bei jedem Aufruf kurz nachfragen, damit Updates sofort ankommen
  const js = /^\/js\/([a-z0-9-]+\.js)$/.exec(url.pathname);
  if (js) return senden(res, path.join(__dirname, 'js', js[1]), 'no-cache');

  // Selbst ausgelieferte Schrift und three.js (keine Verbindung zu Google oder CDNs)
  const vendor = /^\/vendor\/([\w-]+(?:\.[\w-]+)*\.(js|woff2|txt))$/.exec(url.pathname);
  if (vendor) return senden(res, path.join(__dirname, 'vendor', vendor[1]), 'public, max-age=604800');

  res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' });
  res.end('Nicht gefunden');
});

/* ---------- Räume ---------- */
const raeume = new Map();   // Code (oder Olympia-Schlüssel) -> Raum
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function neuerCode(){
  for (;;){
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_ZEICHEN[crypto.randomInt(CODE_ZEICHEN.length)];
    if (!raeume.has(c)) return c;
  }
}
const zufallsId = () => crypto.randomBytes(8).toString('hex');

const STUFEN = ['leicht', 'normal', 'schwer'];
function einstPruefen(e, alt = {}){
  e = e && typeof e === 'object' ? e : {};
  const team = (v, std) => Number.isInteger(v) && v >= 0 && v < TEAM_ANZAHL ? v : std;
  const aus = {
    heim:team(e.heim, alt.heim ?? 0),
    gast:team(e.gast, alt.gast ?? 1),
    groesse:[5, 7].includes(e.groesse) ? e.groesse : alt.groesse ?? 5,
    dauer:[2, 4, 6].includes(e.dauer) ? e.dauer : alt.dauer ?? 4,
    stufe:STUFEN.includes(e.stufe) ? e.stufe : alt.stufe ?? 'normal'
  };
  if (aus.gast === aus.heim) aus.gast = (aus.heim + 1) % TEAM_ANZAHL;
  return aus;
}
const proTeam = raum => raum.einst.groesse - 1;   // der Torwart bleibt beim Computer

function nameFehler(n){
  if (typeof n !== 'string') return 'Name fehlt.';
  n = n.trim();
  if (n.length < 1 || n.length > 16) return 'Der Name muss 1 bis 16 Zeichen lang sein.';
  if (!/^[A-Za-z0-9ÄÖÜäöüß_\-. ]+$/.test(n)) return 'Erlaubt sind Buchstaben, Ziffern, Leerzeichen und _ - .';
  return null;
}

function senden1(ws, m){ if (ws && ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)); }
function anAlle(raum, m, ausser){
  const text = typeof m === 'string' ? m : JSON.stringify(m);
  for (const x of raum.mitglieder.values()) if (x.ws !== ausser) senden1(x.ws, text);
}

function raumZeigen(raum){
  const o = raum.olymp;
  const basis = {
    t:'raum', code:raum.olymp ? null : raum.code, host:raum.host, phase:raum.phase, einst:raum.einst,
    mitglieder:[...raum.mitglieder.values()].map(x => ({ id:x.id, name:x.name, team:x.team })),
    olymp:o ? { titel:o.titel, erwartet:o.erwartet.map(e => e.n), startIn:raum.phase === 'lobby' ? Math.max(0, Math.ceil((o.startAb - Date.now()) / 1000)) : 0 } : null
  };
  for (const x of raum.mitglieder.values()) senden1(x.ws, { ...basis, ich:x.id, zurueck:x.zurueck || null });
  if (o) olympStatus(raum);
}

function raumErstellen(einst, olympInfo){
  const code = olympInfo ? olympInfo.key : neuerCode();
  const raum = { code, olymp:olympInfo || null, host:null, mitglieder:new Map(), einst:einstPruefen(einst), phase:'lobby',
    stand:[0, 0], startListe:[], gewertet:false };
  raeume.set(code, raum);
  return raum;
}

function beitreten(ws, raum, id, name, teamWunsch){
  const n = [0, 0];
  for (const x of raum.mitglieder.values()) n[x.team]++;
  let team = teamWunsch === 0 || teamWunsch === 1 ? teamWunsch : n[0] <= n[1] ? 0 : 1;
  if (n[team] >= proTeam(raum)) team = 1 - team;
  const m = { id, name, team, ws, zurueck:ws.zurueck || null };
  raum.mitglieder.set(id, m);
  if (!raum.host || !raum.mitglieder.has(raum.host)) raum.host = id;
  ws.raum = raum; ws.id = id;
  raumZeigen(raum);
}

function verlassen(ws){
  const raum = ws.raum;
  if (!raum) return;
  ws.raum = null;
  const m = raum.mitglieder.get(ws.id);
  if (!m || m.ws !== ws) return;
  raum.mitglieder.delete(ws.id);
  if (raum.phase === 'spiel'){
    if (raum.host === ws.id){
      // Ohne Gastgeber kann niemand weiterrechnen: das Spiel endet mit dem letzten Stand
      spielEnde(raum, raum.stand, raum.letzteTore || {}, true);
    } else {
      const host = raum.mitglieder.get(raum.host);
      if (host) senden1(host.ws, { t:'weg', id:ws.id });
    }
  }
  if (raum.host === ws.id) raum.host = raum.mitglieder.size ? raum.mitglieder.keys().next().value : null;
  if (!raum.mitglieder.size && (!raum.olymp || raum.phase !== 'lobby' || raum.gewertet)){ raeume.delete(raum.code); return; }
  raumZeigen(raum);
}

function spielStart(raum){
  if (raum.phase !== 'lobby' || !raum.mitglieder.size) return;
  raum.phase = 'spiel';
  raum.stand = [0, 0]; raum.letzteTore = {};
  raum.startListe = [...raum.mitglieder.values()].map(x => ({ id:x.id, name:x.name, team:x.team }));
  anAlle(raum, { t:'start', host:raum.host, einst:raum.einst, mitglieder:raum.startListe });
  raumZeigen(raum);
}

function spielEnde(raum, tore, schuetzen, abgebrochen){
  if (raum.phase !== 'spiel') return;
  raum.phase = 'lobby';
  const t = [Number(tore[0]) || 0, Number(tore[1]) || 0];
  const tor = {};
  for (const s of raum.startListe) tor[s.id] = Math.max(0, Math.min(99, Number(schuetzen[s.id]) || 0));
  anAlle(raum, { t:'ende', tore:t, schuetzen:tor, liste:raum.startListe, abgebrochen:!!abgebrochen });
  if (raum.olymp && !raum.gewertet){
    raum.gewertet = true;
    erledigt.set(raum.code, Date.now());
    olympWerten(raum, t, tor);
  }
  if (!raum.mitglieder.size) raeume.delete(raum.code);
  else raumZeigen(raum);
}

/* ---------- Olympiade ---------- */
// Wertung: Sieg 2, Unentschieden 1, Niederlage 0 (× 100), dazu die eigenen Tore
function olympWerten(raum, tore, schuetzen){
  const namen = ['Niederlage', 'Unentschieden', 'Sieg'];
  const rang = raum.startListe.map(s => {
    const eig = tore[s.team], geg = tore[1 - s.team];
    const erg = eig > geg ? 2 : eig === geg ? 1 : 0;
    const n = schuetzen[s.id] || 0;
    return { s:s.id, wert:erg * 100 + n, text:`${namen[erg]} ${eig}:${geg}${n ? `, ${n} ${n === 1 ? 'Tor' : 'Tore'}` : ''}` };
  }).sort((a, b) => b.wert - a.wert);
  olymp.rangMelden(raum.olymp.t, rang);
}
// Wer ist da, läuft es schon? Nur bei Änderungen melden, sonst alle 20 s als Lebenszeichen
function olympStatus(raum){
  const o = raum.olymp;
  if (!o || raum.gewertet) return;
  const drin = [...raum.mitglieder.keys()], phase = raum.phase === 'lobby' ? 'warten' : 'laeuft';
  const schluessel = drin.join(',') + '|' + phase;
  if (schluessel === o.letzterStatus && Date.now() - o.statusZeit < 20_000) return;
  o.letzterStatus = schluessel; o.statusZeit = Date.now();
  olymp.status(o.t, drin, phase);
}
// Schon gespielte Olympia-Läufe (Lauf + Gruppe), damit niemand eine Disziplin zweimal spielt
const erledigt = new Map();
setInterval(() => { const j = Date.now(); for (const [k, t] of erledigt) if (j - t > 12 * 3600_000) erledigt.delete(k); }, 600_000).unref();
function olympBeitreten(ws, ticket){
  const t = olymp.ticketPruefen(ticket);
  if (!t) return senden1(ws, { t:'fehler', text:'Das Olympia-Ticket ist ungültig oder abgelaufen.', olymp:true });
  const key = `o:${t.l}:${t.g}`;
  let raum = raeume.get(key);
  if ((raum && raum.gewertet) || erledigt.has(key)) return senden1(ws, { t:'fehler', text:'Diese Disziplin ist schon gespielt.', olymp:true, zurueck:t.z || null });
  if (!raum){
    if (raeume.size >= MAX_RAEUME) return senden1(ws, { t:'fehler', text:'Gerade sind zu viele Spiele offen.' });
    // Alle Gruppen eines Laufs spielen mit denselben Teams
    let h = 0;
    for (const z of String(t.l)) h = (h * 31 + z.charCodeAt(0)) >>> 0;
    const heim = h % TEAM_ANZAHL;
    raum = raumErstellen({ ...t.c, heim, gast:(heim + 1 + (h >> 8) % (TEAM_ANZAHL - 1)) % TEAM_ANZAHL },
      { key, t, erwartet:t.m.slice(0, 14), titel:t.ti || 'Olympiade', startAb:Date.now() + OLYMP_WARTEN });
  }
  if (raum.phase !== 'lobby') return senden1(ws, { t:'fehler', text:'Das Spiel deiner Gruppe läuft schon.', olymp:true, zurueck:t.z || null });
  // Dieselbe Person nochmal (neu geladen): alte Verbindung ersetzen
  const alt = raum.mitglieder.get(t.s);
  if (alt && alt.ws !== ws){ alt.ws.raum = null; raum.mitglieder.delete(t.s); try { alt.ws.close(4002, 'ersetzt'); } catch (e) { /* weg */ } }
  // Teams abwechselnd in der Reihenfolge der Olympia-Gruppe
  const i = raum.olymp.erwartet.findIndex(e => e.s === t.s);
  ws.zurueck = t.z || null;
  beitreten(ws, raum, t.s, String(t.n || 'Spieler').slice(0, 16), i >= 0 ? i % 2 : undefined);
  // Alle da? Dann gleich los
  const alle = raum.olymp.erwartet.every(e => raum.mitglieder.has(e.s));
  if (alle) raum.olymp.startAb = Math.min(raum.olymp.startAb, Date.now() + 4000);
}
setInterval(() => {
  const jetzt = Date.now();
  for (const raum of raeume.values()){
    if (!raum.olymp || raum.phase !== 'lobby' || raum.gewertet) continue;
    if (raum.mitglieder.size && jetzt >= raum.olymp.startAb) spielStart(raum);
    else if (raum.mitglieder.size) raumZeigen(raum);
    else if (jetzt > raum.olymp.startAb + 10 * 60_000) raeume.delete(raum.code);
  }
}, 1000).unref();

/* ---------- WebSocket ---------- */
const wss = new WebSocketServer({ server, path:'/ws', maxPayload:16_384, verifyClient:({ req }) => zugang.hatZugang(req) || olympTicketImLink(req) });
// Wer per Olympia-Ticket kommt, hat das Passwort-Cookie schon beim Laden der Seite bekommen;
// ohne Cookie (z. B. blockiert) reicht das Ticket in der WebSocket-Adresse.
function olympTicketImLink(req){
  const t = new URL(req.url, 'http://x').searchParams.get('olymp');
  return !!(t && olymp.ticketPruefen(t));
}

wss.on('connection', ws => {
  ws.lebt = true;
  ws.id = zufallsId();
  ws.on('pong', () => { ws.lebt = true; });
  ws.on('message', roh => {
    let m;
    try { m = JSON.parse(roh); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const raum = ws.raum;
    const fehler = text => senden1(ws, { t:'fehler', text });
    switch (m.t){
      case 'erstellen': {
        if (raum) verlassen(ws);
        const f = nameFehler(m.name); if (f) return fehler(f);
        if (raeume.size >= MAX_RAEUME) return fehler('Gerade sind zu viele Spiele offen. Versuch es später nochmal.');
        const neu = raumErstellen(m.einst);
        ws.id = zufallsId();
        return beitreten(ws, neu, ws.id, m.name.trim(), 0);
      }
      case 'beitreten': {
        if (raum) verlassen(ws);
        const f = nameFehler(m.name); if (f) return fehler(f);
        const ziel = raeume.get(String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4));
        if (!ziel || ziel.olymp) return fehler('Diesen Raum gibt es nicht. Stimmt der Code?');
        if (ziel.phase !== 'lobby') return fehler('In diesem Raum läuft gerade ein Spiel.');
        if (ziel.mitglieder.size >= proTeam(ziel) * 2) return fehler('Der Raum ist voll.');
        const name = m.name.trim();
        if ([...ziel.mitglieder.values()].some(x => x.name.toLowerCase() === name.toLowerCase())) return fehler('Diesen Namen gibt es im Raum schon.');
        ws.id = zufallsId();
        return beitreten(ws, ziel, ws.id, name);
      }
      case 'olymp':
        if (raum) verlassen(ws);
        return olympBeitreten(ws, m.ticket);
      case 'verlassen':
        return verlassen(ws);
    }
    if (!raum) return;
    const ich = raum.mitglieder.get(ws.id);
    if (!ich || ich.ws !== ws) return;
    const istHost = raum.host === ws.id;
    switch (m.t){
      case 'team': {
        if (raum.phase !== 'lobby' || raum.olymp || (m.team !== 0 && m.team !== 1) || m.team === ich.team) return;
        const n = [...raum.mitglieder.values()].filter(x => x.team === m.team).length;
        if (n >= proTeam(raum)) return fehler('In diesem Team ist kein Platz mehr.');
        ich.team = m.team;
        return raumZeigen(raum);
      }
      case 'einst': {
        if (!istHost || raum.phase !== 'lobby' || raum.olymp) return;
        raum.einst = einstPruefen(m.einst, raum.einst);
        // Bei kleineren Teams müssen eventuell Leute wechseln
        const n = [0, 0];
        for (const x of raum.mitglieder.values()){
          if (n[x.team] >= proTeam(raum)) x.team = 1 - x.team;
          n[x.team]++;
        }
        return raumZeigen(raum);
      }
      case 'start':
        if (istHost) spielStart(raum);
        return;
      case 'e':
        // Eingabe eines Mitspielers an den Gastgeber
        if (raum.phase !== 'spiel' || istHost) return;
        return senden1((raum.mitglieder.get(raum.host) || {}).ws, JSON.stringify({ ...m, von:ws.id }));
      case 'z':
        // Spielstand des Gastgebers an alle anderen
        if (raum.phase !== 'spiel' || !istHost) return;
        if (Array.isArray(m.to)) raum.stand = [Number(m.to[0]) || 0, Number(m.to[1]) || 0];
        if (m.tg && typeof m.tg === 'object') raum.letzteTore = m.tg;
        return anAlle(raum, roh.toString(), ws);
      case 'ende':
        if (!istHost) return;
        return spielEnde(raum, Array.isArray(m.tore) ? m.tore : raum.stand, m.schuetzen && typeof m.schuetzen === 'object' ? m.schuetzen : {}, false);
    }
  });
  ws.on('close', () => verlassen(ws));
});
setInterval(() => {
  for (const ws of wss.clients){ if (!ws.lebt){ ws.terminate(); continue; } ws.lebt = false; try { ws.ping(); } catch (e) { /* weg */ } }
}, 25_000).unref();

server.listen(PORT, () => console.log(`Futbolero läuft auf Port ${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
