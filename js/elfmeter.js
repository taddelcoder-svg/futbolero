'use strict';
// Futbolero – Elfmeterschießen, wenn ein Pokalspiel unentschieden endet.
// Geschossen wird immer auf das Tor bei +x. Als Schütze zielst du mit einem Fadenkreuz und hältst
// Schuss für die Kraft. Als Torwart wählst du mit Richtung + Taste, wohin du springst.

let fadenkreuz = null;

function elfmeterStarten(){
  if (!fadenkreuz){
    fadenkreuz = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 28), new THREE.MeshBasicMaterial({ color:0xffd84a, fog:false, depthTest:false, transparent:true }));
    fadenkreuz.rotation.y = -Math.PI / 2;
    fadenkreuz.renderOrder = 10;
    szene.add(fadenkreuz);
  }
  const erster = zufallGanz(2);
  spiel.elfmeter = { dran:erster, erster, ergebnisse:[[], []], nr:[0, 0], zustand:'intro', zeit:0,
    ziel:{ z:0, y:1.1 }, kraft:0, sch:null, tw:null, gewinner:-1, hechtGewaehlt:false, cpu:null, twSprung:null };
  spiel.phase = 'elfmeter'; spiel.phaseZeit = 0;
  for (const k of spiel.steuerer){ if (k.spieler) k.spieler.st = null; k.spieler = null; }
  meldung('Elfmeterschießen', `${spiel.teams[erster].daten.name} fängt an`);
  elfmeterAnzeige();
}

function elfmeterVorbereiten(){
  const E = spiel.elfmeter;
  if (!E) return;
  const schTeam = spiel.teams[E.dran], twTeam = spiel.teams[1 - E.dran];
  schTeam.seite = 1; twTeam.seite = -1;
  const schuetzen = schTeam.spieler.filter(p => p.rolle !== 'TW' && !p.weg).sort((a, b) => ({ ST:0, MI:1, AB:2 }[a.rolle] - { ST:0, MI:1, AB:2 }[b.rolle]));
  const sch = schuetzen[E.nr[E.dran] % schuetzen.length];
  E.nr[E.dran]++;
  const tw = twTeam.spieler[0];
  for (const p of spiel.alle) zustandZuruecksetzen(p);
  // Alle anderen warten am Mittelkreis
  spiel.teams.forEach((t, i) => t.spieler.forEach((p, j) => platz(p, -1 + j * 1.1 - t.spieler.length * 0.3, (i ? 1 : -1) * 2.2, HL, 0)));
  const punkt = HL - ELFER_ABSTAND;
  ballSetzen(punkt, BALL_R, 0);
  platz(sch, punkt - 2.6, -1.4, punkt, 0);
  platz(tw, HL - 0.25, 0, 0, 0);
  sch.blickFest = Math.atan2(1.4, 2.6); tw.blickFest = Math.PI;
  for (const p of spiel.alle) p.standardPlatz = null;
  Object.assign(E, { sch, tw, zustand:'zielen', zeit:0, kraft:0, ziel:{ z:0, y:1.1 }, hechtGewaehlt:false, cpu:null, gehalten:false, ergebnis:null, twSprung:null, frueh:null });
  if (!schTeam.mensch){
    // Computer sucht sich eine Ecke aus
    const pr = schTeam.kiProfil;
    const z = zufallAus([-3.05, -2.4, -1.2, 0, 1.2, 2.4, 3.05]);
    E.cpu = { z, y:zufall(0.3, Math.abs(z) > 2 ? 2.0 : 1.4), kraft:zufall(0.55, 0.88), warten:zufall(1.2, 2), fehler:pr.schussFehler * 0.55 };
  }
  kam.schnitt = true;
  elfmeterAnzeige();
}

// Pro Bild: Eingaben und Ablauf
function elfmeterRahmen(dt){
  const E = spiel.elfmeter;
  if (!E || spiel.blende) return;
  E.zeit += dt;
  // Abläufe ohne Schütze: Ansage am Anfang, Wechsel zum nächsten Schuss, Ende
  if (E.zustand === 'intro'){ if (E.zeit > 1.4){ E.zustand = 'wechsel'; umblenden(elfmeterVorbereiten); } return; }
  if (E.zustand === 'fertig'){ if (E.zeit > 0.6){ E.zustand = 'aus'; elfmeterEnde(); } return; }
  if (!E.sch || E.zustand === 'wechsel' || E.zustand === 'aus') return;
  const menschSchiesst = E.sch.team.mensch, menschHaelt = E.tw.team.mensch;
  const t = eingabe.tasten;
  // Springen erst, wenn der Schütze anläuft
  if (menschHaelt && !E.hechtGewaehlt && (E.zustand === 'anlauf' || E.zustand === 'flug')){
    if (t.pass.neu || t.schuss.neu || t.heber.neu){
      E.hechtGewaehlt = true;
      const seite = Math.abs(eingabe.x) > 0.3 ? Math.sign(eingabe.x) : 0;
      const hoch = eingabe.z < -0.4;
      elfmeterSprung(E.tw, seite * zufall(2.4, 2.9), hoch);
      E.frueh = E.zustand !== 'flug' ? E.zustand : null;
    }
  }
  if (E.zustand === 'zielen'){
    if (menschSchiesst){
      E.ziel.z = clamp(E.ziel.z + eingabe.x * dt * 4.2 + Math.sin(E.zeit * 2.1) * dt * 0.35, -4.4, 4.4);
      E.ziel.y = clamp(E.ziel.y - eingabe.z * dt * 2.4 + Math.cos(E.zeit * 1.7) * dt * 0.2, 0.25, 3.0);
      if (t.schuss.halten || t.pass.halten || t.heber.halten){
        const d = Math.max(t.schuss.dauer, t.pass.dauer, t.heber.dauer);
        E.kraft = spiel.ladung = Math.min(1, d / 1.0);
      }
      if ((t.schuss.los || t.pass.los || t.heber.los) && E.kraft > 0){ E.zustand = 'anlauf'; E.zeit = 0; spiel.ladung = 0; }
    } else if (E.zeit > E.cpu.warten){ E.zustand = 'anlauf'; E.zeit = 0; }
  }
}

function elfmeterSprung(tw, zielZ, hoch){
  if (!zielZ){ if (hoch) tw.sprungT = 1; return; }
  tw.hecht = 0.001;
  tw.hechtVz = clamp((zielZ - tw.z) / 0.5, -6.2, 6.2);
  tw.hechtVx = -0.6;
  tw.hechtSeite = Math.sign(-Math.cos(tw.dir) * zielZ) || 1;
}

// Pro Simulationsschritt
function elfmeterSim(dt){
  const E = spiel.elfmeter;
  if (!E || !E.sch) return;
  if (E.zustand === 'anlauf'){
    const sch = E.sch;
    const zx = ball.x - 0.55, zz = ball.z - 0.15;
    laufeZu(sch, zx, zz, 6);
    sch.blickFest = 0;
    if (Math.hypot(zx - sch.x, zz - sch.z) < 0.3 || E.zeit > 1.4) elfmeterSchuss();
  }
  for (const p of spiel.alle){ if (p !== E.sch || E.zustand !== 'anlauf'){ p.wx = 0; p.wz = 0; } spielerBewegen(p, dt); }
  ballSchritt(dt, physikMeldung);
  if (E.zustand === 'flug'){
    if (!E.gehalten && torwartParade(E.tw)){ E.gehalten = true; E.gehaltenZeit = E.zeit; }
    if (ball.besitzer === E.tw) dribbeln(dt);
    let ergebnis = null;
    if (ball.imTor === 1 && ball.x > HL + BALL_R) ergebnis = 'tor';
    else if (!ball.imTor && ball.x > HL + BALL_R + 0.3) ergebnis = 'vorbei';
    else if (E.gehalten && E.zeit - E.gehaltenZeit > 0.9) ergebnis = 'gehalten';
    else if (E.zeit > 2.6) ergebnis = E.gehalten ? 'gehalten' : 'vorbei';
    if (ergebnis) elfmeterErgebnis(ergebnis);
  }
  // Der Computer-Torwart springt nach seiner Reaktionszeit
  if (E.twSprung && E.zeit >= E.twSprung.zeit){
    elfmeterSprung(E.tw, E.twSprung.z, E.twSprung.hoch);
    E.twSprung = null;
  }
  if (E.zustand === 'ergebnis' && E.zeit > 1.8){
    const g = elfmeterEntschieden();
    E.zeit = 0;
    if (g >= 0){ E.gewinner = g; E.zustand = 'fertig'; }
    else { E.zustand = 'wechsel'; E.dran = 1 - E.dran; umblenden(elfmeterVorbereiten); }
  }
}

function elfmeterSchuss(){
  const E = spiel.elfmeter, sch = E.sch;
  let zz, yy, kraft, fehler;
  if (E.cpu){
    ({ z:zz, y:yy, kraft, fehler } = E.cpu);
    // Hat der Mensch-Torwart zu früh die Seite verraten? Dann nimmt der Schütze die andere Ecke.
    if (E.hechtGewaehlt && E.frueh && E.tw.hecht > 0 && Math.random() < E.sch.team.kiProfil.lesen * 1.6){
      zz = -Math.sign(E.tw.hechtVz) * zufall(2.2, 3.0);
    }
  } else {
    zz = E.ziel.z; yy = E.ziel.y; kraft = Math.max(0.2, E.kraft); fehler = 0.75;
  }
  const sigma = (0.12 + kraft * kraft * 0.55) * fehler;
  zz += gauss() * sigma;
  yy += gauss() * sigma * 0.6 + (kraft > 0.9 ? (kraft - 0.9) * 12 : 0);
  yy = Math.max(0.22, yy);
  const v = 15 + kraft * 16;
  const d = Math.hypot(HL - ball.x, zz - ball.z);
  const w = schussWinkel(v, d, yy, ball.y);
  const vec = schussVektor(HL - ball.x, zz - ball.z, v, w);
  ballSpielen(sch, vec.vx, vec.vy, vec.vz, 'schuss', 0.6 + kraft * 0.4);
  E.zustand = 'flug'; E.zeit = 0;
  // Computer-Torwart rät eine Ecke
  if (!E.tw.team.mensch){
    const pr = E.tw.team.twProfil;
    const kennt = Math.random() < pr.lesen;
    let seite = kennt ? Math.sign(zz) * (Math.abs(zz) < 0.8 ? 0 : 1) : zufallAus([-1, -1, 0, 1, 1]);
    const verzoegerung = zufall(0.05, 0.14) + (1 - pr.twReich) * 0.3;
    E.twSprung = { zeit:verzoegerung, z:seite * zufall(2.2, 2.9), hoch:yy > 1.6 };
  }
}

function elfmeterErgebnis(art){
  const E = spiel.elfmeter;
  if (E.zustand !== 'flug') return;
  E.zustand = 'ergebnis'; E.zeit = 0;
  const drin = art === 'tor';
  E.ergebnisse[E.dran].push(drin);
  if (drin){
    Ton.jubel(0.8); Welt.netzWackeln[1] = 1.2;
    Fans.jubelTeam = E.dran; Fans.jubelZeit = 2.5;
    meldung('TOR!', E.sch.team.daten.name, 'tor');
  } else {
    Ton.raunen();
    meldung(art === 'gehalten' ? 'Gehalten!' : 'Vorbei!', art === 'gehalten' ? E.tw.team.daten.name : E.sch.team.daten.name);
  }
  elfmeterAnzeige();
}

// −1: weiter, sonst Index des Siegers
function elfmeterEntschieden(){
  const [a, b] = spiel.elfmeter.ergebnisse;
  const ta = a.filter(Boolean).length, tb = b.filter(Boolean).length;
  if (a.length <= 5 && b.length <= 5){
    if (ta + (5 - a.length) < tb) return 1;
    if (tb + (5 - b.length) < ta) return 0;
    if (a.length === 5 && b.length === 5 && ta !== tb) return ta > tb ? 0 : 1;
    return -1;
  }
  if (a.length === b.length && ta !== tb) return ta > tb ? 0 : 1;
  return -1;
}

function elfmeterEnde(){
  const E = spiel.elfmeter;
  if (!E) return;
  if (fadenkreuz) fadenkreuz.visible = false;
  spiel.phase = 'ende';
  if (typeof zeigeEnde === 'function') zeigeEnde();
}

function elfmeterKamera(dt){
  const punkt = HL - ELFER_ABSTAND;
  kameraSetzen(punkt - 7.5, 2.5, 0.4, HL, 1.25, 0, dt, 3);
}

function elfmeterDarstellen(){
  const E = spiel.elfmeter;
  if (!fadenkreuz) return;
  fadenkreuz.visible = !!(E && E.sch && E.sch.team.mensch && E.zustand === 'zielen' && spiel.phase === 'elfmeter');
  if (fadenkreuz.visible) fadenkreuz.position.set(HL - 0.02, E.ziel.y, E.ziel.z);
}

function elfmeterAnzeige(){
  const el = document.getElementById('elfer');
  const E = spiel.elfmeter;
  if (!E || spiel.phase !== 'elfmeter' && spiel.phase !== 'ende'){ el.classList.remove('an'); return; }
  el.classList.add('an');
  el.textContent = '';
  const laenge = Math.max(5, E.ergebnisse[0].length, E.ergebnisse[1].length);
  spiel.teams.forEach((t, i) => {
    const reihe = document.createElement('div'); reihe.className = 'reihe';
    const name = document.createElement('b'); name.textContent = t.daten.kurz; reihe.appendChild(name);
    for (let k = 0; k < laenge; k++){
      const kreis = document.createElement('i');
      const r = E.ergebnisse[i][k];
      if (r === true) kreis.className = 'drin'; else if (r === false) kreis.className = 'vorbei';
      reihe.appendChild(kreis);
    }
    el.appendChild(reihe);
  });
}
