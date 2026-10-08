'use strict';
// Futbolero – Spielarten: Halle und Straße (Wände statt Aus), Powerups im Arcade-Modus und das
// Training für Standardsituationen (Freistöße, Elfmeter, Ecken).

/* ---------- Spielfeld ---------- */
const ARENA_NAME = { stadion:'Stadion', halle:'Halle', strasse:'Straße' };

function bodenTextur(art){
  Welt.boeden = Welt.boeden || {};
  if (Welt.boeden[art]) return Welt.boeden[art];
  if (art === 'stadion') return Welt.boeden[art] = Welt.rasen.material.map;
  const breite = FELD.L + 2 * BANDE + 2, tiefe = FELD.B + 2 * BANDE + 2;
  const c = leinwand(1024, 512, (g, w, h) => {
    const mx = x => (x + breite / 2) / breite * w, mz = z => (z + tiefe / 2) / tiefe * h;
    if (art === 'halle'){
      // Hallenboden: blauer Kunststoff, Spielfläche etwas heller, Rand orange
      g.fillStyle = '#c4632b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#25508a'; g.fillRect(mx(-HL), mz(-HB), mx(HL) - mx(-HL), mz(HB) - mz(-HB));
      g.fillStyle = 'rgba(255,255,255,.035)';
      for (let x = mx(-HL); x < mx(HL); x += 22) g.fillRect(x, mz(-HB), 11, mz(HB) - mz(-HB));
    } else {
      // Asphalt mit Flecken und Rissen
      g.fillStyle = '#4a4d52'; g.fillRect(0, 0, w, h);
      const bild = g.getImageData(0, 0, w, h), d = bild.data;
      for (let i = 0; i < d.length; i += 4){ const n = (Math.random() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(bild, 0, 0);
      g.strokeStyle = 'rgba(25,25,28,.32)'; g.lineWidth = 0.8;
      for (let i = 0; i < 18; i++){
        let x = Math.random() * w, y = Math.random() * h;
        g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 4; j++){ x += zufall(-12, 12); y += zufall(-8, 8); g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.08)';
      for (let i = 0; i < 30; i++){ g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, zufall(5, 18), zufall(3, 9), Math.random() * 3, 0, Math.PI * 2); g.fill(); }
    }
  });
  return Welt.boeden[art] = textur(c);
}

// Wände an den Linien: Glas in der Halle, Gitter auf der Straße. Das Tor bleibt offen.
function waendeBauen(art){
  const g = new THREE.Group();
  const H = ARENA.wandH;
  let flaeche;
  if (art === 'halle'){
    flaeche = new THREE.MeshPhongMaterial({ color:0xcfe8ff, transparent:true, opacity:0.13, side:THREE.DoubleSide, depthWrite:false, shininess:90 });
  } else {
    const gitter = leinwand(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = '#d6dbe0'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
    });
    const tex = textur(gitter, true);
    flaeche = new THREE.MeshBasicMaterial({ map:tex, transparent:true, alphaTest:0.3, side:THREE.DoubleSide, depthWrite:false, opacity:0.75 });
    flaeche.userData.wiederholung = 2.2;
  }
  const brett = new THREE.MeshLambertMaterial({ color:art === 'halle' ? 0x1c3f73 : 0x2d5a3a });
  const rahmen = new THREE.MeshLambertMaterial({ color:0x8d969f });
  const BRETT = art === 'halle' ? 0.5 : 0.7;
  // Eine Wandfläche von a nach b (in x/z), von Höhe y0 bis y1
  function wand(ax, az, bx, bz, y0, y1, mitBrett){
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 0.05) return;
    const mat = flaeche.map ? flaeche.clone() : flaeche;
    if (flaeche.map){ mat.map = flaeche.map.clone(); mat.map.needsUpdate = true; mat.map.repeat.set(l * flaeche.userData.wiederholung, (y1 - y0) * flaeche.userData.wiederholung); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, y1 - y0), mat);
    m.position.set((ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    m.renderOrder = 2;
    g.add(m);
    if (mitBrett){
      const b = new THREE.Mesh(new THREE.BoxGeometry(l, BRETT, 0.08), brett);
      b.position.set((ax + bx) / 2, BRETT / 2, (az + bz) / 2);
      b.rotation.y = m.rotation.y;
      b.castShadow = b.receiveShadow = true;
      g.add(b);
    }
    // Pfosten alle paar Meter
    const n = Math.max(1, Math.round(l / 6));
    for (let i = 0; i <= n; i++){
      const t = i / n, p = new THREE.Mesh(new THREE.BoxGeometry(0.08, y1 - y0, 0.08), rahmen);
      p.position.set(ax + (bx - ax) * t, (y0 + y1) / 2, az + (bz - az) * t);
      g.add(p);
    }
  }
  const torZ = TOR.B / 2 + TOR.R * 2;
  wand(-HL, -HB, HL, -HB, 0, H, true);
  wand(-HL, HB, HL, HB, 0, H, true);
  for (const s of [1, -1]){
    wand(s * HL, -HB, s * HL, -torZ, 0, H, true);
    wand(s * HL, torZ, s * HL, HB, 0, H, true);
    wand(s * HL, -torZ, s * HL, torZ, TOR.H + TOR.R * 2, H, false);
  }
  return g;
}

function toreNeuBauen(){
  for (const s of [1, -1]){
    const t = Welt.tore[s];
    if (t){ szene.remove(t.gruppe); t.gruppe.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    torBauen(s);
  }
}

function arenaSetzen(art){
  if (!ARENA_NAME[art]) art = 'stadion';
  if (ARENA.art === art && Welt.arenaGesetzt) return;
  Welt.arenaGesetzt = true;
  ARENA.art = art;
  ARENA.wand = art !== 'stadion';
  ARENA.wandH = art === 'halle' ? 5 : art === 'strasse' ? 3.6 : 0;
  // Straßenfußball hat kleinere Tore
  const b = art === 'strasse' ? 5 : 7.32, h = art === 'strasse' ? 2.1 : 2.44;
  if (TOR.B !== b || TOR.H !== h){ TOR.B = b; TOR.H = h; toreNeuBauen(); }
  if (Welt.rasen){ Welt.rasen.material.map = bodenTextur(art); Welt.rasen.material.needsUpdate = true; }
  if (Welt.waende){ szene.remove(Welt.waende); Welt.waende = null; }
  if (ARENA.wand){ Welt.waende = waendeBauen(art); szene.add(Welt.waende); }
  // Auf der Straße gibt es keine Tribünen-Zuschauer
  if (Welt.fans){ Welt.fans.visible = Welt.koepfe.visible = art !== 'strasse'; }
}

/* ---------- Powerups (Arcade) ---------- */
const PU_ARTEN = {
  turbo:{ farbe:0xffd84a, name:'Turbo', text:'7 Sekunden schneller', dauer:7 },
  kanone:{ farbe:0xff4d4d, name:'Kanone', text:'Die nächsten 2 Schüsse sind Hämmer', anzahl:2 },
  mauer:{ farbe:0x4da3ff, name:'Krake', text:'10 Sekunden hält der Torwart fast alles', dauer:10 },
  eis:{ farbe:0x9ff3ff, name:'Eis', text:'Der Gegner friert 5 Sekunden ein bisschen ein', dauer:5 }
};
const powerups = { an:false, liste:[], takt:0, geo:null, ring:null };

function powerupsZuruecksetzen(an){
  for (const it of powerups.liste) szene.remove(it.mesh);
  powerups.liste = [];
  powerups.an = an;
  powerups.takt = 5;
  powerupAnzeige();
}

function powerupErzeugen(){
  if (!powerups.geo){
    powerups.geo = new THREE.OctahedronGeometry(0.42, 0);
    powerups.ring = new THREE.RingGeometry(0.55, 0.75, 28).rotateX(-Math.PI / 2);
  }
  const art = zufallAus(Object.keys(PU_ARTEN));
  const farbe = PU_ARTEN[art].farbe;
  const mesh = new THREE.Group();
  const k = new THREE.Mesh(powerups.geo, new THREE.MeshPhongMaterial({ color:farbe, emissive:farbe, emissiveIntensity:0.55, shininess:80 }));
  k.castShadow = true;
  mesh.add(k);
  const r = new THREE.Mesh(powerups.ring, new THREE.MeshBasicMaterial({ color:farbe, transparent:true, opacity:0.7, side:THREE.DoubleSide }));
  r.position.y = 0.03;
  mesh.add(r);
  const x = zufall(-HL + 12, HL - 12), z = zufall(-HB + 4, HB - 4);
  mesh.position.set(x, 0, z);
  szene.add(mesh);
  powerups.liste.push({ art, x, z, zeit:0, mesh, kern:k });
}

function powerupsSchritt(dt){
  if (!powerups.an) return;
  for (const t of spiel.teams){
    t.pu.turbo = Math.max(0, t.pu.turbo - dt);
    t.pu.mauer = Math.max(0, t.pu.mauer - dt);
    t.pu.eis = Math.max(0, t.pu.eis - dt);
  }
  powerups.takt -= dt;
  if (powerups.takt <= 0){ powerups.takt = zufall(8, 13); if (powerups.liste.length < 2) powerupErzeugen(); }
  for (let i = powerups.liste.length - 1; i >= 0; i--){
    const it = powerups.liste[i];
    it.zeit += dt;
    let wer = null;
    for (const p of spiel.alle){
      if (p.rolle === 'TW' || p.fallT > 0) continue;
      if (Math.hypot(p.x - it.x, p.z - it.z) < 1.05){ wer = p; break; }
    }
    if (wer || it.zeit > 16){
      szene.remove(it.mesh);
      powerups.liste.splice(i, 1);
      if (wer) powerupEinsammeln(it.art, wer.team);
    }
  }
  if ((powerups.anzeigeTakt = (powerups.anzeigeTakt || 0) + dt) > 0.25){ powerups.anzeigeTakt = 0; powerupAnzeige(); }
}

function powerupEinsammeln(art, team){
  const a = PU_ARTEN[art];
  if (a.anzahl) team.pu[art] = a.anzahl; else team.pu[art] = a.dauer;
  meldung(a.name + '!', `${team.daten.name}: ${a.text}`);
  Ton.pfosten();
  Fans.aufregung = Math.max(Fans.aufregung, 0.6);
}

function powerupsDarstellen(zeit){
  for (const it of powerups.liste){
    it.kern.position.y = 0.9 + Math.sin(zeit * 3 + it.x) * 0.15;
    it.kern.rotation.y = zeit * 2.2;
    // Kurz vor dem Verschwinden blinken
    it.mesh.visible = it.zeit < 13 || Math.sin(zeit * 18) > 0;
  }
}

function powerupAnzeige(){
  const el = document.getElementById('puAnzeige');
  if (!el) return;
  const teile = [];
  if (powerups.an){
    for (const t of spiel.teams){
      for (const art of Object.keys(PU_ARTEN)){
        const v = t.pu[art];
        if (v > 0) teile.push(`${t.daten.kurz} ${PU_ARTEN[art].name} ${art === 'kanone' ? '×' + v : Math.ceil(v) + ' s'}`);
      }
    }
  }
  const text = teile.join(' · ');
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('an', teile.length > 0);
}

/* ---------- Training: Standardsituationen ---------- */
const UEBUNG_NAME = { freistoss:'Freistöße', elfmeter:'Elfmeter', ecke:'Ecken' };
const training = { art:'freistoss', versuch:0, max:10, zeit:0, schuetze:null };

function trainingStarten(){
  const art = UEBUNG_NAME[einstellungen.uebung] ? einstellungen.uebung : 'freistoss';
  Object.assign(training, { art, versuch:0, max:10, zeit:0, schuetze:null });
  // Freistoß und Elfmeter mit kleinem Team, damit die Mauer passt; bei Ecken die gewählte Größe
  matchStarten({ heim:einstellungen.team, gast:einstellungen.gegner, modus:'training', groesse:art === 'ecke' ? einstellungen.groesse : 5 });
  trainingVersuch();
}

function trainingVersuch(){
  training.versuch++;
  training.zeit = 0;
  const team = spiel.teams[0], s = team.seite;
  const art = training.art;
  if (art === 'ecke') standardAufstellen({ art:'ecke', team, x:s * HL, z:(training.versuch % 2 ? 1 : -1) * HB });
  else if (art === 'elfmeter') standardAufstellen({ art:'elfmeter', team });
  else {
    // Je weiter im Training, desto weiter weg und spitzer
    const t = (training.versuch - 1) / (training.max - 1);
    const weg = zufall(13.5, 16) + t * zufall(3, 8), quer = zufall(-1, 1) * (3 + t * 7);
    standardAufstellen({ art:'freistoss', team, x:s * (HL - weg), z:quer });
  }
  training.schuetze = spiel.standard ? spiel.standard.schuetze : null;
  meldung(`Versuch ${training.versuch} von ${training.max}`, UEBUNG_NAME[art]);
}

// Läuft in jedem Bild, solange trainiert wird
function trainingRahmen(dt){
  const ph = spiel.phase;
  if (ph === 'spiel'){
    training.zeit += dt;
    const team = spiel.teams[0], sch = training.schuetze, b = ball.besitzer;
    const tempo = Math.hypot(ball.vx, ball.vy, ball.vz);
    if (training.art === 'ecke'){
      if (b && b.team !== team) return trainingVersuchEnde(b.rolle === 'TW' ? 'Gehalten!' : 'Geklärt');
      if (training.zeit > 7) return trainingVersuchEnde('Zeit um');
      return;
    }
    if (b && b.rolle === 'TW' && b.team !== team) return trainingVersuchEnde('Gehalten!');
    if (b && b !== sch) return trainingVersuchEnde('Abgeblockt');
    if (ball.zuletzt && ball.zuletzt !== sch && ball.zuletzt.team !== team && training.zeit > 0.2){
      training.abgewehrt = (training.abgewehrt || 0) + dt;
      if (training.abgewehrt > 0.8) return trainingVersuchEnde(ball.zuletzt.rolle === 'TW' ? 'Pariert!' : 'In die Mauer');
    } else training.abgewehrt = 0;
    if ((training.zeit > 1 && tempo < 0.6 && !b) || training.zeit > 4.5) return trainingVersuchEnde('Daneben');
  } else if (ph === 'training-pause'){
    if (spiel.phaseZeit > 1.4) trainingWeiter();
  } else if (ph === 'tor'){
    if (spiel.phaseZeit > 2.2){ highlightSichern(); trainingWeiter(); }
  }
}

function trainingVersuchEnde(text){
  training.abgewehrt = 0;
  if (ball.besitzer){ ball.besitzer.halten = false; ball.besitzer = null; }
  spiel.phase = 'training-pause'; spiel.phaseZeit = 0;
  spiel.ladung = 0;
  meldung(text, `${spiel.teams[0].tore} von ${training.versuch}`);
  if (text !== 'Daneben' && text !== 'Zeit um') Ton.raunen();
}

function trainingWeiter(){
  if (spiel.phase === 'training-weiter') return;
  if (training.versuch >= training.max) return trainingEnde();
  spiel.phase = 'training-weiter';
  umblenden(trainingVersuch);
}

function trainingEnde(){
  spiel.phase = 'ende';
  const treffer = spiel.teams[0].tore, art = training.art;
  const alt = bilanz.training[art] || 0;
  const rekord = treffer > alt;
  if (rekord){ bilanz.training[art] = treffer; speichern(); }
  if (treffer >= 7){ Fans.jubelTeam = 0; Fans.jubelZeit = 5; Ton.jubel(0.8); }
  const inhalt = el('div');
  inhalt.appendChild(el('p', 'grosszahl', `${treffer} / ${training.max}`));
  const urteil = treffer >= 9 ? 'Weltklasse!' : treffer >= 7 ? 'Richtig stark.' : treffer >= 4 ? 'Ordentlich, da geht noch mehr.' : 'Weiter üben!';
  inhalt.appendChild(el('p', 'hinweis', `${UEBUNG_NAME[art]}: ${urteil}` + (rekord ? ' Neuer Rekord!' : alt ? ` Dein Rekord: ${alt}.` : '')));
  const knoepfe = [
    { text:'Nochmal', aktion:trainingStarten },
    { text:'Zum Menü', zweit:true, aktion:zumMenue }
  ];
  if (WDH.highlights.length) knoepfe.splice(1, 0, { text:`Treffer ansehen (${WDH.highlights.length})`, zweit:true, aktion:() => highlightsZeigen(trainingEnde) });
  dialogZeigen('Training vorbei', inhalt, knoepfe);
}
