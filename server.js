'use strict';
// Futbolero – Server: liefert das Spiel aus. Das Spiel selbst läuft komplett
// im Browser, es gibt keine Datenbank und keine Online-Funktionen.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 10000;

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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
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
