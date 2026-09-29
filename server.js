'use strict';
// Futbolero – Server: liefert das Spiel aus. Das Spiel selbst läuft komplett
// im Browser, es gibt keine Datenbank. Einzige Online-Funktion: als Disziplin der
// Olympiade prüft der Server das Ticket und meldet das Ergebnis zurück (olymp.js).
const http = require('http');
const fs = require('fs');
const path = require('path');
const olymp = require('./olymp')({ spiel:'futbolero' });

const PORT = Number(process.env.PORT) || 10000;
const gemeldet = new Set();   // Lauf + Spieler, damit jedes Ticket nur ein Ergebnis meldet

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
function koerperLesen(req){
  return new Promise((ok, nein) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 8000){ nein(new Error('zu groß')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch (e) { nein(e); } });
    req.on('error', nein);
  });
}

// Olympiade: Ticket prüfen (der Browser bekommt nur, was er anzeigen darf) und Ergebnis melden
async function olympAnfrage(req, res, url){
  if (req.method === 'POST' && url.pathname === '/api/olymp'){
    let m;
    try { m = await koerperLesen(req); } catch (e) { return json(res, 400, { fehler:'Anfrage kaputt' }); }
    const t = olymp.ticketPruefen(m.ticket);
    if (!t) return json(res, 403, { fehler:'Das Olympia-Ticket ist ungültig oder abgelaufen.' });
    const schluessel = t.l + ':' + t.s;
    if (m.art === 'start'){
      olymp.da(t, t.s);
      return json(res, 200, { ...olymp.fuerBrowser(t), gemeldet:gemeldet.has(schluessel) });
    }
    if (m.art === 'ergebnis'){
      const tore = Number(m.tore), gegen = Number(m.gegentore);
      if (!Number.isInteger(tore) || !Number.isInteger(gegen) || tore < 0 || gegen < 0 || tore > 99 || gegen > 99) return json(res, 400, { fehler:'Ergebnis unvollständig' });
      if (gemeldet.has(schluessel)) return json(res, 409, { fehler:'Schon gemeldet' });
      gemeldet.add(schluessel);
      // Tordifferenz zählt, bei Gleichstand die Zahl der eigenen Tore
      const ok = await olymp.wertMelden(t, t.s, (tore - gegen) * 100 + tore, `${tore}:${gegen}`);
      if (!ok) gemeldet.delete(schluessel);
      return json(res, ok ? 200 : 502, ok ? { ok:true } : { fehler:'Die Olympiade ist gerade nicht erreichbar.' });
    }
    return json(res, 400, { fehler:'Unbekannte Anfrage' });
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/olymp') return olympAnfrage(req, res, url).then(r => r === null && json(res, 405, { fehler:'Nicht erlaubt' }));
  if (req.method !== 'GET' && req.method !== 'HEAD'){
    res.writeHead(405, { 'Content-Type':'text/plain; charset=utf-8', Allow:'GET, HEAD' });
    return res.end('Nicht erlaubt');
  }
  if (url.pathname === '/healthz'){
    res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
    return res.end('{"ok":true}');
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

server.listen(PORT, () => console.log(`Futbolero läuft auf Port ${PORT}`));

for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
