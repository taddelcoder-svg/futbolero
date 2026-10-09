'use strict';
// Futbolero – Speicher für die Online-Ligen.
// Mit SUPABASE_URL und SUPABASE_SERVICE_KEY liegt alles als eine JSON-Zeile in der Supabase-Tabelle
// „futbolero_speicher“ (siehe supabase_setup.sql) und übersteht Deploys auf Render. Ohne diese Variablen
// landet es in einer Datei in DATA_DIR – auf Render ohne Persistent Disk ist die nach jedem Deploy leer.
const fs = require('fs');
const path = require('path');

module.exports = function speicher(leer){
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
  const DATEI = path.join(DATA_DIR, 'futbolero.json');
  const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const KEY = process.env.SUPABASE_SERVICE_KEY || '';
  const MIT_SUPABASE = !!(URL_ && KEY);
  const TABELLE = `${URL_}/rest/v1/futbolero_speicher`;
  const kopf = { apikey:KEY, Authorization:'Bearer ' + KEY };

  const s = { daten:leer(), art:MIT_SUPABASE ? 'Supabase' : DATEI };

  s.laden = async function(){
    if (!MIT_SUPABASE){
      try { s.daten = Object.assign(leer(), JSON.parse(fs.readFileSync(DATEI, 'utf8'))); } catch (e) { /* noch keine Daten */ }
      return;
    }
    // Ohne geladene Daten nicht starten: sonst würde das erste Speichern alle Ligen überschreiben
    for (let versuch = 1; ; versuch++){
      try {
        const res = await fetch(`${TABELLE}?id=eq.haupt&select=daten`, { headers:kopf });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const zeilen = await res.json();
        s.daten = Object.assign(leer(), zeilen[0] && zeilen[0].daten);
        console.log('Ligen aus Supabase geladen.');
        return;
      } catch (e) {
        console.error(`Laden aus Supabase fehlgeschlagen (Versuch ${versuch}):`, e.message);
        if (versuch >= 5) throw e;
        await new Promise(ok => setTimeout(ok, 2000 * versuch));
      }
    }
  };

  async function schreiben(){
    const inhalt = JSON.stringify(s.daten);
    if (!MIT_SUPABASE){
      fs.mkdirSync(DATA_DIR, { recursive:true });
      fs.writeFileSync(DATEI + '.tmp', inhalt);
      fs.renameSync(DATEI + '.tmp', DATEI);
      return;
    }
    const res = await fetch(TABELLE, {
      method:'POST',
      headers:{ ...kopf, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
      body:`{"id":"haupt","daten":${inhalt},"geaendert_am":"${new Date().toISOString()}"}`
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  let timer = null, laeuft = Promise.resolve();
  s.sichern = function(){
    clearTimeout(timer); timer = null;
    laeuft = laeuft.then(schreiben).catch(e => { console.error('Speichern fehlgeschlagen:', e.message); timer = setTimeout(s.sichern, 10_000); });
    return laeuft;
  };
  // Änderungen sammeln und kurz darauf in einem Rutsch schreiben
  s.geaendert = function(){ if (!timer) timer = setTimeout(s.sichern, 1000); };
  s.offen = () => !!timer;
  s.fertig = () => laeuft;
  return s;
};
