'use strict';
// Futbolero – Spielablauf: Mannschaften, Steuerung, Ballkontakte, Zweikämpfe, Regeln und Standards,
// Torjubel, Wiederholung und Kamera.

const spiel = {
  phase:'start',        // start, warten, spiel, aus, tor, wiederholung, pause-halbzeit, abpfiff, halbzeit, ende, elfmeter
  modus:'demo', optionen:null,
  zeit:0, phaseZeit:0, uhr:0, halbzeit:1, halbDauer:120, nachspiel:0,
  teams:[], alle:[], gesteuert:null, standard:null, naechster:null,
  anstossTeam:0, ersterAnstoss:0, kiTakt:0, doppeln:false, ladung:0,
  torschuetze:null, torTeam:null, torSeite:0, torFrame:0, blende:false, pause:false,
  markierung:null
};

/* ---------- Mannschaften ---------- */
function teamBauen(idx, daten, kit, groesse, mensch, stufe){
  const team = { idx, daten, kit, seite:idx === 0 ? 1 : -1, mensch, tore:0, spieler:[],
    stat:{ schuesse:0, aufsTor:0, paesse:0, angekommen:0, besitz:0, paraden:0, ecken:0 } };
  team.kiProfil = profil(mensch ? 1 : stufe);
  team.twProfil = profil(mensch ? Math.max(1.1, stufe * 0.5 + 0.6) : stufe);
  const nummern = { TW:[...NUMMERN.TW], AB:[...NUMMERN.AB], MI:[...NUMMERN.MI], ST:[...NUMMERN.ST] };
  FORMATIONEN[groesse].forEach((form, i) => {
    const nummer = nummern[form.rolle].shift() || 12 + i;
    const figur = figurBauen(kit, nummer, form.rolle === 'TW', kit.torwart);
    szene.add(figur.wurzel);
    team.spieler.push({
      team, idx:i, rolle:form.rolle, form, nummer, figur,
      x:0, z:0, y:0, vx:0, vz:0, wx:0, wz:0, dir:team.seite > 0 ? 0 : Math.PI, tempo:0, lauf:Math.random() * 6,
      sperre:0, betaeubt:0, schussT:0, kopfT:0, sprungT:0, fallT:0,
      graetsche:0, graetscheDir:0, graetscheV:0,
      hecht:0, hechtVz:0, hechtVx:0, hechtSeite:1, hechtHoch:1,
      jubel:false, halten:false, haltZeit:0, einwurf:0, einwurfT:0,
      auftrag:'position', basis:null, abfang:null, blick:null, blickFest:null, markiert:null,
      denk:0, puffer:null, beruehrung:0, letzterPassVon:null, bekommenZeit:-9, standardPlatz:null,
      haltung:{}
    });
  });
  return team;
}

function spielAufraeumen(){
  for (const p of spiel.alle) szene.remove(p.figur.wurzel);
  spiel.alle = []; spiel.teams = [];
}

function spielStarten(opt){
  spielAufraeumen();
  const A = TEAMS[opt.heim], B = TEAMS[opt.gast];
  const kits = trikotsWaehlen(A, B);
  const mensch = opt.modus !== 'demo';
  spiel.teams = [teamBauen(0, A, kits[0], opt.groesse, mensch, 1), teamBauen(1, B, kits[1], opt.groesse, false, opt.stufe)];
  spiel.alle = [...spiel.teams[0].spieler, ...spiel.teams[1].spieler];
  fansEinkleiden(kits[0], kits[1]);
  Object.assign(spiel, {
    modus:opt.modus, optionen:opt, halbzeit:1, uhr:0, nachspiel:0, halbDauer:opt.dauer * 30,
    gesteuert:null, standard:null, naechster:null, elfmeter:null, pause:false, zeit:0, ladung:0, doppeln:false
  });
  aufnahmeStart();
  spiel.ersterAnstoss = spiel.anstossTeam = zufallGanz(2);
  if (typeof hudTeams === 'function') hudTeams();
  standardAufstellen({ art:'anstoss', team:spiel.teams[spiel.anstossTeam] });
}

/* ---------- Steuerung wechseln ---------- */
function wechseln(ziel){
  const team = spiel.teams[0];
  if (!team || !team.mensch) return;
  if (!ziel){
    // Der Spieler, der am schnellsten am Ball ist (Torwart ausgenommen)
    const bx = ball.x + ball.vx * 0.35, bz = ball.z + ball.vz * 0.35;
    let bester = null, bestD = 1e9;
    for (const p of team.spieler){
      if (p.rolle === 'TW' || p === spiel.gesteuert) continue;
      let d = Math.hypot(p.x - bx, p.z - bz);
      // Spieler, die zwischen Ball und eigenem Tor stehen, sind beim Verteidigen wertvoller
      if ((p.x - bx) * team.seite < 0) d -= 2;
      if (d < bestD){ bestD = d; bester = p; }
    }
    ziel = bester;
  }
  if (ziel && ziel !== spiel.gesteuert && ziel.rolle !== 'TW'){
    if (spiel.gesteuert){ spiel.gesteuert.puffer = null; spiel.gesteuert.wx = spiel.gesteuert.wz = 0; }
    spiel.gesteuert = ziel;
  }
}

/* ---------- Ball spielen ---------- */
function ballSpielen(p, vx, vy, vz, art, lautst = 0.6){
  if (p.halten) ball.y = 1.05;
  if (p.einwurf){ ball.y = 2.1; ball.z = clamp(ball.z, -HB + 0.15, HB - 0.15); p.einwurf = 2; p.einwurfT = 0.35; }
  ball.besitzer = null;
  p.halten = false;
  ball.vx = vx; ball.vy = vy; ball.vz = vz;
  ball.zuletzt = p; ball.art = art; ball.gespieltZeit = spiel.zeit;
  ball.passZiel = null; ball.schussVon = null;
  p.sperre = 0.3; p.schussT = 1; p.puffer = null;
  spiel.ladung = 0;
  Ton.schuss(lautst);
}

function schiessen(p, kraft, zielZ, fehler){
  const s = p.team.seite, torX = s * HL;
  kraft = clamp(kraft, 0.15, 1);
  const dx = torX - ball.x;
  const d0 = Math.hypot(dx, zielZ - ball.z);
  const sigma = (0.2 + d0 * 0.02 + kraft * kraft * 0.6) * fehler;
  const zz = zielZ + gauss() * sigma;
  let yZiel = 0.3 + kraft * 1.4 + zufall(-0.15, 0.25) + gauss() * sigma * 0.5;
  if (kraft > 0.92) yZiel += (kraft - 0.92) * 13;
  yZiel = Math.max(0.22, yZiel);
  const v = 14 + kraft * 19;
  const w = schussWinkel(v, Math.hypot(dx, zz - ball.z), yZiel, ball.y);
  const vec = schussVektor(dx, zz - ball.z, v, w);
  ballSpielen(p, vec.vx, vec.vy, vec.vz, 'schuss', 0.5 + kraft * 0.5);
  ball.schussVon = p;
  p.team.stat.schuesse++;
  Fans.aufregung = Math.max(Fans.aufregung, 0.7);
}

// art: 'flach', 'hoch', 'wurf' (Einwurf), 'flanke'
function passSpielen(p, m, art, fehler = 0.05){
  const vEnde = 7;
  const y0 = p.einwurf ? 2.1 : p.halten ? 1.05 : ball.y;
  let tx = m.x, tz = m.z, v = 10, winkel = 0;
  const vorhalt = m === spiel.gesteuert ? 0.35 : 0.8;
  for (let i = 0; i < 3; i++){
    const d = Math.hypot(tx - ball.x, tz - ball.z);
    let t;
    if (art === 'flach'){ v = clamp(passTempo(d, vEnde), 7, 27); t = rollWeg(v, vEnde).t; }
    else {
      winkel = art === 'wurf' ? 0.3 : art === 'flanke' ? 0.48 : d < 18 ? 0.55 : 0.45;
      v = clamp(heberTempo(d, winkel, y0), 5, art === 'wurf' ? 17 : 30);
      t = flug(v, winkel, y0, 999).t;
    }
    tx = clamp(m.x + m.vx * t * vorhalt, -HL + 0.8, HL - 0.8);
    tz = clamp(m.z + m.vz * t * vorhalt, -HB + 0.8, HB - 0.8);
  }
  const r = Math.atan2(tz - ball.z, tx - ball.x) + gauss() * fehler;
  const vec = schussVektor(Math.cos(r), Math.sin(r), v * (1 + gauss() * fehler * 0.4), winkel);
  ballSpielen(p, vec.vx, vec.vy, vec.vz, 'pass', art === 'flach' ? 0.35 : 0.5);
  ball.passZiel = m;
  p.team.stat.paesse++;
  m.letzterPassVon = p;
  if (p.team.mensch && m.rolle !== 'TW') wechseln(m);
}

function passInDenRaum(p, dx, dz, art){
  const l = Math.hypot(dx, dz) || 1;
  const weite = art === 'flach' ? 14 : 22;
  const tx = clamp(ball.x + dx / l * weite, -HL + 1, HL - 1), tz = clamp(ball.z + dz / l * weite, -HB + 1, HB - 1);
  const d = Math.hypot(tx - ball.x, tz - ball.z);
  let vec;
  if (art === 'flach') vec = schussVektor(tx - ball.x, tz - ball.z, clamp(passTempo(d, 3), 7, 24), 0);
  else vec = schussVektor(tx - ball.x, tz - ball.z, heberTempo(d, 0.55, ball.y), 0.55);
  ballSpielen(p, vec.vx, vec.vy, vec.vz, 'pass', 0.45);
  p.team.stat.paesse++;
  // Den Mitspieler steuern, der am nächsten am Zielpunkt ist
  if (p.team.mensch){
    let bester = null, bestD = 1e9;
    for (const m of p.team.spieler){
      if (m === p || m.rolle === 'TW') continue;
      const dd = Math.hypot(m.x - tx, m.z - tz);
      if (dd < bestD){ bestD = dd; bester = m; }
    }
    if (bester && bestD < 14) wechseln(bester);
  }
}

// Mitspieler in Richtung (dx,dz) für einen Pass aussuchen
function passZielWaehlen(p, dx, dz, nurImStrafraum){
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const geg = gegnerVon(p.team);
  let bester = null, bestW = -1e9;
  for (const m of p.team.spieler){
    if (m === p) continue;
    const mx = m.x - p.x, mz = m.z - p.z, d = Math.hypot(mx, mz);
    if (d < 3 || d > 50) continue;
    if (nurImStrafraum && !(Math.abs(m.x - p.team.seite * HL) < STRAF.T + 2 && Math.abs(m.z) < STRAF.B / 2)) continue;
    const cos = (mx * dx + mz * dz) / d;
    if (cos < 0.45) continue;
    let w = cos * 2.4 - Math.abs(d - 15) / 24;
    if (m.rolle === 'TW') w -= 1.5;
    let spur = 3;
    for (const o of geg.spieler){
      const r = streckenAbstand(o.x, o.z, p.x, p.z, m.x, m.z);
      if (r.t > 0.05 && r.t < 0.95) spur = Math.min(spur, r.d);
    }
    w += spur / 3 * 0.45;
    if (w > bestW){ bestW = w; bester = m; }
  }
  return bester;
}

/* ---------- Mensch am Ball ---------- */
function eingabeRichtung(p){
  const m = Math.hypot(eingabe.x, eingabe.z);
  if (m > 0.2) return [eingabe.x / m, eingabe.z / m];
  return [Math.cos(p.dir), Math.sin(p.dir)];
}

function menschPass(p, art){
  const [dx, dz] = eingabeRichtung(p);
  const m = passZielWaehlen(p, dx, dz);
  if (m) passSpielen(p, m, art, 0.02);
  else passInDenRaum(p, dx, dz, art);
}

function menschSchuss(p, kraft, direkt){
  const m = Math.hypot(eingabe.x, eingabe.z);
  let zielZ;
  const quer = m > 0.25 ? eingabe.z / Math.max(m, 0.6) : 0;
  if (Math.abs(quer) > 0.2) zielZ = clamp(quer, -1, 1) * (TOR.B / 2 - 0.45);
  else zielZ = -Math.sign(p.z || zufall(-1, 1)) * 1.3;
  let fehler = 0.8;
  if (eingabe.sprint) fehler *= 1.15;
  if (direkt) fehler *= 1.2;
  schiessen(p, kraft, zielZ, fehler);
}

function menschAktionen(){
  const p = spiel.gesteuert;
  const t = eingabe.tasten;
  if (!p) return;
  if (t.wechsel.neu) wechseln();
  spiel.doppeln = t.heber.halten && !!ball.besitzer && ball.besitzer.team !== p.team;
  if (ball.besitzer === p){
    if (t.pass.neu){ menschPass(p, 'flach'); return; }
    if (t.heber.neu){ menschPass(p, 'hoch'); return; }
    if (t.schuss.halten && !t.schuss.verbraucht){
      spiel.ladung = Math.min(1, t.schuss.dauer / 0.85);
      if (t.schuss.dauer > 1.05){ t.schuss.verbraucht = true; menschSchuss(p, 1); }
    } else if (t.schuss.los && !t.schuss.verbraucht){
      t.schuss.verbraucht = true;
      menschSchuss(p, Math.min(1, t.schuss.dauer / 0.85));
    }
    return;
  }
  spiel.ladung = 0;
  const frei = !ball.besitzer;
  if (frei && (abstand(p, ball) < 7 || ball.passZiel === p)){
    // Direktabnahme vormerken – bei einem Pass zu mir gilt sie, bis der Ball ankommt
    const bis = spiel.zeit + (ball.passZiel === p ? 3 : 0.6);
    if (t.schuss.neu) p.puffer = { art:'schuss', bis };
    if (t.pass.neu) p.puffer = { art:'pass', bis };
    if (t.heber.neu) p.puffer = { art:'heber', bis };
    if (p.puffer && p.puffer.art === 'schuss' && t.schuss.halten){
      p.puffer.bis = Math.max(p.puffer.bis, spiel.zeit + 0.3);
      spiel.ladung = Math.min(1, t.schuss.dauer / 0.85);
    }
  } else if (ball.besitzer && ball.besitzer.team !== p.team){
    if (t.schuss.neu){ const [dx, dz] = eingabeRichtung(p); graetsche(p, Math.atan2(dz, dx)); }
    if (t.pass.neu) wechseln();
  } else if (t.pass.neu) wechseln();
}

function pufferAusfuehren(p){
  const art = p.puffer.art;
  p.puffer = null;
  const t = eingabe.tasten.schuss;
  if (art === 'schuss'){
    const kraft = t.halten ? Math.max(0.35, Math.min(1, t.dauer / 0.85)) : Math.max(0.45, Math.min(1, t.dauer / 0.85));
    t.verbraucht = true;
    menschSchuss(p, kraft, true);
  } else menschPass(p, art === 'heber' ? 'hoch' : 'flach');
}

function menschBewegung(p){
  const mx = eingabe.x, mz = eingabe.z, m = Math.hypot(mx, mz);
  if (m < 0.12){
    // Ein Pass kommt: selbstständig entgegenlaufen
    if (ball.passZiel === p && !ball.besitzer && p.abfang){ laufeZu(p, p.abfang.x, p.abfang.z, TEMPO.lauf, abstand(p, ball) < 3 ? 2 : 0); return; }
    p.wx = 0; p.wz = 0; return;
  }
  const v = (eingabe.sprint ? TEMPO.sprint : TEMPO.lauf) * (ball.besitzer === p ? 0.93 : 1);
  const k = Math.min(1, m) / m;
  p.wx = mx * k * v; p.wz = mz * k * v;
}

/* ---------- Grätsche ---------- */
function graetsche(p, richtung){
  if (p.graetsche > 0 || p.betaeubt > 0 || p.fallT > 0 || p.hecht > 0) return;
  p.graetsche = 0.001; p.graetscheDir = richtung; p.graetscheV = 10.5;
  p.dir = richtung;
}

function graetschTreffer(p){
  if (p.graetsche > 0.72) return;
  const fx = p.x + Math.cos(p.graetscheDir) * 0.8, fz = p.z + Math.sin(p.graetscheDir) * 0.8;
  const c = ball.besitzer;
  if (ball.y < 0.8 && Math.hypot(ball.x - fx, ball.z - fz) < 0.75 && !(c && (c.team === p.team || c.halten)) && p.sperre <= 0){
    if (c){ c.fallT = 0.001; c.sperre = 1.0; }
    ball.besitzer = null;
    const r = p.graetscheDir + zufall(-0.5, 0.5), v = zufall(5, 8);
    ball.vx = Math.cos(r) * v; ball.vz = Math.sin(r) * v; ball.vy = zufall(0, 1.5);
    ball.zuletzt = p; ball.passZiel = null; ball.art = null; ball.gespieltZeit = spiel.zeit;
    p.sperre = 0.3;
    Ton.schuss(0.4);
  }
  for (const o of gegnerVon(p.team).spieler){
    if (o.fallT > 0 || o.hecht > 0 || o.halten) continue;
    if (Math.hypot(o.x - fx, o.z - fz) < 0.6){
      o.fallT = 0.001; o.sperre = 1.0;
      if (ball.besitzer === o){ ball.besitzer = null; ball.vx = o.vx * 0.6; ball.vz = o.vz * 0.6; ball.zuletzt = o; }
    }
  }
}

/* ---------- Ballkontakte ---------- */
function ballKontakte(dt){
  if (ball.besitzer){ zweikaempfe(dt); return; }
  for (const t of spiel.teams){ const tw = t.spieler[0]; if (tw.rolle === 'TW' && torwartParade(tw)) return; }
  let bester = null, bestD = 99, kopf = false;
  for (const p of spiel.alle){
    if (p.sperre > 0 || p.betaeubt > 0 || p.fallT > 0 || p.hecht > 0 || p.graetsche > 0) continue;
    const d = Math.hypot(ball.x - p.x, ball.z - p.z);
    if (d >= bestD) continue;
    if (ball.y < 0.9 && d < 0.62){ bester = p; bestD = d; kopf = false; }
    else if (ball.y >= 0.9 && ball.y < 2.35 && d < 0.52){ bester = p; bestD = d; kopf = true; }
  }
  if (!bester) return;
  if (kopf) kopfball(bester); else annehmen(bester);
}

function annehmen(p){
  const tempo = Math.hypot(ball.vx, ball.vy, ball.vz);
  const vorher = ball.zuletzt;
  // Harte Bälle springen manchmal vom Fuß
  const fremderSchuss = ball.art === 'schuss' && vorher && vorher.team !== p.team;
  if (tempo > 15 && Math.random() < (tempo - 15) / (fremderSchuss ? 12 : 22)){
    const r = Math.atan2(ball.vz, ball.vx) + Math.PI + zufall(-1.3, 1.3), v = tempo * zufall(0.2, 0.4);
    ball.vx = Math.cos(r) * v; ball.vz = Math.sin(r) * v; ball.vy = zufall(0.5, 3);
    ball.zuletzt = p; ball.passZiel = null; ball.art = null; ball.gespieltZeit = spiel.zeit;
    p.sperre = 0.25;
    Ton.schuss(0.3);
    return;
  }
  ball.besitzer = p; ball.zuletzt = p; ball.vy = 0; ball.y = BALL_R;
  if (ball.art === 'pass' && vorher && vorher.team === p.team && vorher !== p) p.team.stat.angekommen++;
  ball.art = null; ball.passZiel = null;
  p.bekommenZeit = spiel.zeit;
  p.denk = Math.min(p.denk, zufall(0.08, 0.22));
  p.beruehrung = 0;
  if (p.team.mensch && p.rolle !== 'TW' && spiel.gesteuert !== p) wechseln(p);
  if (p.puffer && p.puffer.bis > spiel.zeit && p === spiel.gesteuert) pufferAusfuehren(p);
  else p.puffer = null;
}

function kopfball(p){
  p.kopfT = 1; p.sprungT = 1;
  const s = p.team.seite, torX = s * HL;
  const dTor = Math.hypot(torX - p.x, p.z);
  let absicht;
  const fuerMich = ball.passZiel === p && ball.y < 2.2;
  if (p === spiel.gesteuert) absicht = p.puffer && p.puffer.bis > spiel.zeit ? p.puffer.art : ball.y < 1.5 || fuerMich ? 'brust' : 'abpraller';
  else if (dTor < 16) absicht = 'schuss';
  else if (fuerMich) absicht = 'brust';
  else if (Math.abs(p.x - eigenesTorX(p.team)) < 22) absicht = 'klaeren';
  else absicht = ball.y < 1.5 ? 'brust' : 'pass';
  p.puffer = null;
  if (absicht === 'brust'){ p.kopfT = 0; p.sprungT = 0; annehmen(p); return; }
  if (absicht === 'schuss'){
    const tw = gegnerVon(p.team).spieler[0];
    const zz = (tw.z > 0 ? -1 : 1) * zufall(1.2, TOR.B / 2 - 0.4);
    const v = zufall(13, 17);
    const d = Math.hypot(torX - ball.x, zz - ball.z);
    const w = schussWinkel(v, d, zufall(0.3, 1.8), ball.y);
    const vec = schussVektor(torX - ball.x, zz - ball.z, v, w);
    const fehler = (p === spiel.gesteuert ? 0.1 : 0.14) * p.team.kiProfil.schussFehler;
    const r = gauss() * fehler;
    const c = Math.cos(r), sn = Math.sin(r);
    ballSpielen(p, vec.vx * c - vec.vz * sn, vec.vy, vec.vx * sn + vec.vz * c, 'schuss', 0.45);
    ball.schussVon = p;
    p.team.stat.schuesse++;
    return;
  }
  if (absicht === 'pass' || absicht === 'heber'){
    const [dx, dz] = p === spiel.gesteuert ? eingabeRichtung(p) : [s, 0];
    const m = passZielWaehlen(p, dx, dz);
    if (m){ passSpielen(p, m, 'flach', 0.08); return; }
  }
  if (absicht === 'klaeren' || absicht === 'pass' || absicht === 'heber'){
    const r = Math.atan2(zufall(-0.6, 0.6), s);
    const vec = schussVektor(Math.cos(r), Math.sin(r), zufall(11, 15), 0.55);
    ballSpielen(p, vec.vx, vec.vy, vec.vz, null, 0.45);
    return;
  }
  // abpraller: Ball springt vom Kopf in Blickrichtung
  const v = 6;
  ballSpielen(p, Math.cos(p.dir) * v, 2, Math.sin(p.dir) * v, null, 0.35);
}

function zweikaempfe(dt){
  const c = ball.besitzer;
  if (c.halten || c.einwurf) return;
  const stufe = spiel.optionen ? spiel.optionen.stufe : 1;
  for (const q of gegnerVon(c.team).spieler){
    if (q.betaeubt > 0 || q.sperre > 0 || q.graetsche > 0 || q.fallT > 0 || q.hecht > 0) continue;
    const dBall = Math.hypot(q.x - ball.x, q.z - ball.z);
    if (dBall > 0.9) continue;
    let rate = q === spiel.gesteuert ? 2.6 : q.team.kiProfil.klau;
    const zuBall = Math.atan2(ball.z - q.z, ball.x - q.x);
    rate *= Math.cos(winkelDiff(q.dir, zuBall)) > 0.3 ? 1 : 0.45;
    rate *= 1 + Math.hypot(c.vx, c.vz) / 14;
    if (c === spiel.gesteuert) rate *= [0.6, 0.85, 1.05][Math.round(clamp(stufe, 0, 2))];
    if (Math.random() < rate * dt){ eroberung(q, c); return; }
  }
}

function eroberung(q, c){
  c.sperre = 0.55; c.betaeubt = 0.22;
  ball.zuletzt = q; ball.passZiel = null; ball.art = null;
  if (Math.random() < 0.55){
    ball.besitzer = q; q.bekommenZeit = spiel.zeit; q.denk = zufall(0.1, 0.3);
    if (q.team.mensch && q.rolle !== 'TW') wechseln(q);
  } else {
    ball.besitzer = null;
    const r = q.dir + zufall(-0.8, 0.8), v = zufall(3.5, 6);
    ball.vx = Math.cos(r) * v; ball.vz = Math.sin(r) * v; ball.vy = 0;
    ball.gespieltZeit = spiel.zeit;
    q.sperre = 0.12;
  }
  Ton.schuss(0.22);
}

// Ball am Fuß (oder in den Händen, oder über dem Kopf beim Einwurf)
function dribbeln(dt){
  const p = ball.besitzer;
  if (!p) return;
  const fx = Math.cos(p.dir), fz = Math.sin(p.dir);
  if (p.halten || p.einwurf){
    const hoehe = p.einwurf ? 2.2 : 1.05, vor = p.einwurf ? -0.05 : 0.38;
    ball.x = p.x + fx * vor; ball.y = hoehe; ball.z = p.z + fz * vor;
    ball.vx = p.vx; ball.vy = 0; ball.vz = p.vz;
    return;
  }
  const sp = Math.hypot(p.vx, p.vz);
  p.beruehrung += dt * (2 + sp * 1.1);
  const weite = 0.5 + Math.min(1, sp / 8) * (0.16 + 0.18 * Math.max(0, Math.sin(p.beruehrung)));
  const zx = p.x + fx * weite, zz = p.z + fz * weite;
  const k = 1 - Math.exp(-dt * 22);
  const nx = ball.x + (zx - ball.x) * k, nz = ball.z + (zz - ball.z) * k;
  ball.vx = (nx - ball.x) / dt; ball.vz = (nz - ball.z) / dt; ball.vy = 0;
  ball.x = nx; ball.z = nz; ball.y = BALL_R;
}

/* ---------- Spieler bewegen ---------- */
function spielerBewegen(p, dt){
  p.sperre = Math.max(0, p.sperre - dt);
  p.betaeubt = Math.max(0, p.betaeubt - dt);
  p.schussT = Math.max(0, p.schussT - dt / 0.32);
  p.kopfT = Math.max(0, p.kopfT - dt / 0.4);
  p.sprungT = Math.max(0, p.sprungT - dt / 0.5);
  if (p.einwurf === 2){ p.einwurfT -= dt; if (p.einwurfT <= 0) p.einwurf = 0; }
  const bewegen = () => {
    p.x += p.vx * dt; p.z += p.vz * dt;
    p.x = clamp(p.x, -HL - BANDE + 0.8, HL + BANDE - 0.8);
    p.z = clamp(p.z, -HB - BANDE + 0.8, HB + BANDE - 0.8);
  };
  if (p.fallT > 0){
    p.fallT += dt / 1.15;
    if (p.fallT >= 1){ p.fallT = 0; p.betaeubt = 0.1; }
    p.vx *= Math.exp(-dt * 5); p.vz *= Math.exp(-dt * 5);
    bewegen(); p.tempo = 0; return;
  }
  if (p.graetsche > 0){
    p.graetsche += dt / 0.7;
    p.graetscheV = Math.max(0, p.graetscheV - 13 * dt);
    p.vx = Math.cos(p.graetscheDir) * p.graetscheV; p.vz = Math.sin(p.graetscheDir) * p.graetscheV;
    bewegen();
    if (spiel.phase === 'spiel') graetschTreffer(p);
    if (p.graetsche >= 1){ p.graetsche = 0; p.betaeubt = 0.35; }
    p.tempo = 0; return;
  }
  if (p.hecht > 0){
    p.hecht += dt / 0.9;
    // Kurzer Absprung, dann fliegt er zur Seite
    const flug = p.hecht > 0.09 && p.hecht < 0.6;
    p.vz = flug ? p.hechtVz : p.hecht <= 0.09 ? 0 : p.hechtVz * 0.15 * (1 - p.hecht);
    p.vx = flug ? p.hechtVx : 0;
    bewegen();
    if (p.hecht >= 1){ p.hecht = 0; p.betaeubt = 0.45; p.vx = p.vz = 0; }
    p.tempo = 0; return;
  }
  let wx = p.wx, wz = p.wz;
  if (p.betaeubt > 0 || (p.halten && ball.besitzer === p) || p.einwurf === 1){ wx = 0; wz = 0; }
  const ax = wx - p.vx, az = wz - p.vz, l = Math.hypot(ax, az);
  const maxA = ((p.vx * wx + p.vz * wz) < 0 ? 32 : 22) * dt;
  if (l > maxA){ p.vx += ax / l * maxA; p.vz += az / l * maxA; } else { p.vx = wx; p.vz = wz; }
  bewegen();
  const sp = Math.hypot(p.vx, p.vz);
  let zielDir = null;
  if (p.blickFest != null) zielDir = p.blickFest;
  else if (p === spiel.gesteuert && spiel.phase === 'spiel' && Math.hypot(eingabe.x, eingabe.z) > 0.2) zielDir = Math.atan2(eingabe.z, eingabe.x);
  else if (sp > 0.8) zielDir = Math.atan2(p.vz, p.vx);
  else if (p.blick != null) zielDir = p.blick;
  if (zielDir != null){
    const r = (ball.besitzer === p ? 9 : 11) * dt;
    p.dir += clamp(winkelDiff(p.dir, zielDir), -r, r);
  }
  p.lauf += dt * (sp * 1.9 + (sp > 0.3 ? 2.5 : 0));
  p.tempo = sp / 7.5;
}

function abstossen(){
  const a = spiel.alle;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++){
    const p = a[i], q = a[j];
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.7 && d > 1e-4){
      const k = (0.7 - d) / 2 / d;
      p.x -= dx * k; p.z -= dz * k; q.x += dx * k; q.z += dz * k;
    }
  }
}

/* ---------- KI je nach Phase ---------- */
function kiSchritt(dt){
  const ph = spiel.phase;
  if (ph === 'spiel'){
    spiel.kiTakt -= dt;
    if (spiel.kiTakt <= 0){ spiel.kiTakt = 0.1; for (const t of spiel.teams) taktik(t); }
    for (const p of spiel.alle){
      if (p === spiel.gesteuert) continue;
      if (p.rolle === 'TW') kiTorwart(p, dt); else kiFeldspieler(p, dt);
    }
    return;
  }
  if (ph === 'warten'){
    for (const p of spiel.alle){
      if (spiel.standard && p === spiel.standard.schuetze){ p.wx = p.wz = 0; continue; }
      p.blick = Math.atan2(ball.z - p.z, ball.x - p.x);
      if (p.standardPlatz) laufeZu(p, p.standardPlatz.x, p.standardPlatz.z, TEMPO.kiLauf);
    }
    return;
  }
  if (ph === 'aus'){
    spiel.kiTakt -= dt;
    if (spiel.kiTakt <= 0){
      spiel.kiTakt = 0.2;
      for (const t of spiel.teams) for (const p of t.spieler) if (p.rolle !== 'TW') p.basis = formationsPunkt(p, t, false);
    }
    for (const p of spiel.alle){
      p.blick = Math.atan2(ball.z - p.z, ball.x - p.x);
      if (p.rolle === 'TW' || !p.basis){ p.wx *= 0.9; p.wz *= 0.9; continue; }
      laufeZu(p, p.basis.x, p.basis.z, TEMPO.kiLauf * 0.6);
    }
    return;
  }
  if (ph === 'tor'){ jubelSteuerung(); return; }
  for (const p of spiel.alle){ p.wx = 0; p.wz = 0; }
}

function jubelSteuerung(){
  const s = spiel.torSeite, held = spiel.torschuetze;
  const ziel = held ? { x:s * (HL - 4), z:clamp(held.z * 0.5 + 10, -HB + 3, HB - 2) } : { x:0, z:0 };
  for (const p of spiel.alle){
    if (p.team === spiel.torTeam){
      if (p === held){ laufeZu(p, ziel.x, ziel.z, TEMPO.kiSprint * 0.9); p.jubel = spiel.phaseZeit > 0.4; }
      else if (p.rolle !== 'TW' && held){ laufeZu(p, held.x - s * 1.2, held.z + (p.idx % 2 ? 1.2 : -1.2), TEMPO.kiSprint * 0.85); p.jubel = spiel.phaseZeit > 1.2 && abstand(p, held) < 3; }
      else { p.wx = p.wz = 0; }
    } else {
      p.wx *= 0.9; p.wz *= 0.9;
      if (p.rolle !== 'TW' && p.basis) laufeZu(p, p.basis.x, p.basis.z, 2);
    }
    p.blick = held ? Math.atan2(held.z - p.z, held.x - p.x) : p.blick;
  }
}

/* ---------- Simulation ---------- */
function simSchritt(dt){
  spiel.zeit += dt;
  const ph = spiel.phase;
  if (ph === 'elfmeter'){ elfmeterSim(dt); return; }
  if (!['spiel', 'warten', 'aus', 'tor', 'pause-halbzeit', 'abpfiff'].includes(ph)) return;
  if (ph === 'spiel'){
    spiel.uhr += dt;
    if (spiel.gesteuert) menschBewegung(spiel.gesteuert);
  }
  kiSchritt(dt);
  for (const p of spiel.alle) spielerBewegen(p, dt);
  abstossen();
  if (ph === 'spiel') ballKontakte(dt);
  // Beim Standard bleibt der Ball auf dem Punkt liegen (nur beim Einwurf hält ihn der Spieler)
  if (ph !== 'warten' || (ball.besitzer && ball.besitzer.einwurf)) dribbeln(dt);
  ballSchritt(dt, physikMeldung);
  if (ph === 'spiel'){
    if (ball.besitzer) ball.besitzer.team.stat.besitz += dt;
    regelnPruefen();
    zeitPruefen(dt);
  } else if (ph === 'aus' || ph === 'tor'){
    // Ball bleibt in der Nähe des Felds
    if (ph === 'aus' && !ball.imTor){ ball.vx *= 0.99; ball.vz *= 0.99; }
  }
  if (++spiel.takt % 2 === 0) aufnehmen();
}
spiel.takt = 0;

function physikMeldung(art, staerke){
  if (art === 'pfosten'){
    Ton.pfosten(); Ton.raunen();
    Fans.aufregung = 1;
  } else if (art === 'netz'){ Ton.netz(); }
  else if (art === 'aufsetzer'){ Ton.schuss(Math.min(0.25, staerke / 40)); }
}

/* ---------- Regeln ---------- */
function regelnPruefen(){
  if (ball.imTor && Math.abs(ball.x) > HL + BALL_R) return torGefallen(ball.imTor);
  const letzter = ball.zuletzt ? ball.zuletzt.team : spiel.teams[0];
  if (Math.abs(ball.z) > HB + BALL_R){
    const team = gegnerVon(letzter);
    return ausGeben('einwurf', team, clamp(ball.x, -HL + 1, HL - 1), Math.sign(ball.z) * HB);
  }
  if (Math.abs(ball.x) > HL + BALL_R && !ball.imTor){
    const s = Math.sign(ball.x);
    const verteidiger = spiel.teams.find(t => t.seite === -s);
    const schuss = ball.art === 'schuss';
    if (letzter === verteidiger) return ausGeben('ecke', gegnerVon(verteidiger), s * HL, Math.sign(ball.z || 1) * HB, schuss);
    return ausGeben('abstoss', verteidiger, s * HL, Math.sign(ball.z || 1) * HB, schuss);
  }
}

function ausGeben(art, team, x, z, danebenGeschossen){
  if (ball.besitzer){ ball.besitzer.halten = false; ball.besitzer = null; }
  spiel.phase = 'aus'; spiel.phaseZeit = 0;
  spiel.naechster = { art, team, x, z };
  spiel.ladung = 0;
  if (art === 'ecke') team.stat.ecken++;
  if (danebenGeschossen) Ton.raunen();
  Ton.pfiff('kurz');
  const texte = { einwurf:'Einwurf', ecke:'Ecke', abstoss:'Abstoß' };
  meldung(texte[art], team.daten.name);
}

function torGefallen(s){
  const team = spiel.teams.find(t => t.seite === s);
  const letzter = ball.zuletzt;
  const eigentor = !!letzter && letzter.team !== team;
  team.tore++;
  if (!eigentor) team.stat.aufsTor++;
  spiel.phase = 'tor'; spiel.phaseZeit = 0;
  spiel.torSeite = s; spiel.torTeam = team;
  let held = eigentor || !letzter ? null : letzter;
  if (!held){
    const kandidaten = team.spieler.filter(p => p.rolle !== 'TW');
    held = kandidaten.sort((a, b) => abstand(a, ball) - abstand(b, ball))[0];
  }
  spiel.torschuetze = held;
  spiel.torFrame = WDH.gesamt;
  spiel.anstossTeam = gegnerVon(team).idx;
  ball.besitzer = null;
  Welt.netzWackeln[s] = 1.2;
  Ton.netz();
  Ton.jubel(team.mensch || spiel.modus === 'demo' ? 1 : 0.7);
  Fans.jubelTeam = team.idx; Fans.jubelZeit = 5;
  const unter = eigentor ? 'Eigentor' : `${team.daten.name} · Nr. ${held.nummer}`;
  meldung('TOR!', unter, 'tor');
  if (typeof hudStand === 'function') hudStand();
}

function zeitPruefen(dt){
  if (spiel.modus === 'demo') return;
  if (spiel.uhr < spiel.halbDauer) return;
  // Kurz nachspielen lassen, solange es vor einem Tor brennt
  const gefahr = Math.abs(ball.x) > HL - 20 && spiel.nachspiel < 7;
  if (gefahr){ spiel.nachspiel += dt; return; }
  if (ball.besitzer){ ball.besitzer.halten = false; ball.besitzer = null; }
  spiel.ladung = 0;
  if (spiel.halbzeit === 1){
    spiel.phase = 'pause-halbzeit'; spiel.phaseZeit = 0;
    Ton.pfiff('zwei');
    meldung('Halbzeit', `${spiel.teams[0].tore} : ${spiel.teams[1].tore}`);
  } else {
    spiel.phase = 'abpfiff'; spiel.phaseZeit = 0;
    Ton.pfiff('drei');
    meldung('Abpfiff', `${spiel.teams[0].tore} : ${spiel.teams[1].tore}`);
  }
}

function zweiteHalbzeit(){
  for (const t of spiel.teams) t.seite *= -1;
  spiel.halbzeit = 2; spiel.uhr = 0; spiel.nachspiel = 0;
  spiel.anstossTeam = 1 - spiel.ersterAnstoss;
  umblenden(() => standardAufstellen({ art:'anstoss', team:spiel.teams[spiel.anstossTeam] }));
}

/* ---------- Standards ---------- */
function umblenden(fn){
  if (spiel.blende) return;
  spiel.blende = true;
  const el = document.getElementById('blende');
  el.classList.add('an');
  setTimeout(() => {
    fn();
    setTimeout(() => { el.classList.remove('an'); spiel.blende = false; }, 60);
  }, 270);
}

function zustandZuruecksetzen(p){
  Object.assign(p, { vx:0, vz:0, wx:0, wz:0, sperre:0, betaeubt:0, schussT:0, kopfT:0, sprungT:0, fallT:0,
    graetsche:0, hecht:0, jubel:false, halten:false, einwurf:0, puffer:null, blickFest:null, auftrag:'position' });
}

function platz(p, x, z, blickX, blickZ){
  p.x = x; p.z = z;
  p.dir = Math.atan2(blickZ - z, blickX - x);
  p.standardPlatz = { x, z };
}

function standardAufstellen({ art, team, x = 0, z = 0 }){
  const geg = gegnerVon(team), s = team.seite;
  for (const p of spiel.alle) zustandZuruecksetzen(p);
  ball.imTor = 0; ball.passZiel = null; ball.art = null; ball.zuletzt = null;
  let schuetze = null;
  const sz = Math.sign(z) || 1;
  const feld = t => t.spieler.filter(p => p.rolle !== 'TW');

  if (art === 'anstoss'){
    ballSetzen(0, BALL_R, 0);
    for (const t of spiel.teams){
      for (const p of t.spieler){
        const fx = Math.min(0.46, p.form.x * 0.72);
        let px = t.seite * (fx * FELD.L - HL), pz = p.form.z * HB * 0.75;
        if (t !== team && Math.hypot(px, pz) < KREIS + 0.8){ const l = Math.hypot(px, pz) || 1; px = px / l * (KREIS + 0.8); pz = pz / l * (KREIS + 0.8); }
        platz(p, px, pz, 0, 0);
      }
    }
    const f = feld(team);
    schuetze = f.find(p => p.rolle === 'ST') || f[f.length - 1];
    platz(schuetze, -s * 0.6, 0, 0, 0);
    const neben = f.find(p => p.rolle === 'MI' && p !== schuetze) || f.find(p => p !== schuetze);
    if (neben) platz(neben, -s * 1.2, 4, 0, 0);
  } else {
    // Ball liegt am Ausführungsort, danach richten sich die anderen
    let bx = x, bz = z;
    if (art === 'einwurf'){ bx = x; bz = sz * (HB + 0.25); }
    else if (art === 'ecke'){ bx = x - Math.sign(x) * 0.35; bz = sz * (HB - 0.35); }
    else if (art === 'abstoss'){ bx = eigenesTorX(team) + s * 3.5; bz = sz * 3; }
    ballSetzen(bx, BALL_R, bz);
    for (const t of spiel.teams) for (const p of t.spieler){
      if (p.rolle === 'TW'){ platz(p, eigenesTorX(t) + t.seite * 0.8, 0, bx, bz); continue; }
      const b = formationsPunkt(p, t, t === team);
      platz(p, b.x, b.z, bx, bz);
    }
    if (art === 'einwurf'){
      schuetze = feld(team).sort((a, b) => Math.hypot(a.x - bx, a.z - bz) - Math.hypot(b.x - bx, b.z - bz))[0];
      platz(schuetze, bx, sz * (HB + 0.35), bx, 0);
      schuetze.dir = -sz * Math.PI / 2;
      schuetze.einwurf = 1;
    } else if (art === 'ecke'){
      const torX = s * HL;
      const angreifer = feld(team).sort((a, b) => ({ ST:0, MI:1, AB:2 }[a.rolle] - { ST:0, MI:1, AB:2 }[b.rolle]));
      schuetze = angreifer.find(p => p.rolle === 'MI') || angreifer[angreifer.length - 1];
      const zx = torX - s * 8, rl = Math.hypot(zx - bx, bz) || 1;
      platz(schuetze, bx - (zx - bx) / rl * 0.65, bz + bz / rl * 0.65, zx, 0);
      const plaetze = [[6.5, -1.5], [9.5, 2], [11.5, -3.8], [5, 3.5], [8, -5]];
      const rest = angreifer.filter(p => p !== schuetze);
      const imStrafraum = rest.slice(0, Math.min(4, rest.length - 1 || 1));
      imStrafraum.forEach((p, i) => platz(p, torX - s * plaetze[i][0], sz * plaetze[i][1], bx, bz));
      rest.slice(imStrafraum.length).forEach((p, i) => platz(p, torX - s * 24, (i % 2 ? 1 : -1) * 6, bx, bz));
      // Verteidiger decken die Leute im Strafraum
      const vert = feld(geg);
      imStrafraum.forEach((a, i) => { if (vert[i]) platz(vert[i], a.x + s * 1, a.z + zufall(-0.4, 0.4), bx, bz); });
      vert.slice(imStrafraum.length).forEach((p, i) => {
        if (i === 0) platz(p, torX - s * 1.2, sz * (TOR.B / 2 - 0.6), bx, bz);
        else platz(p, torX - s * (STRAF.T + 1.5), (i % 2 ? 1 : -1) * 4, bx, bz);
      });
      platz(geg.spieler[0], torX - s * 0.5, sz * 0.4, bx, bz);
    } else if (art === 'abstoss'){
      schuetze = team.spieler[0];
      platz(schuetze, bx - s * 0.7, bz, 0, 0);
      const torX = eigenesTorX(team);
      for (const p of feld(geg)){
        if (Math.abs(p.x - torX) < STRAF.T + 1.5 && Math.abs(p.z) < STRAF.B / 2 + 1.5) platz(p, torX + s * (STRAF.T + 2), p.z, bx, bz);
      }
    }
    // Gegner halten Abstand zum Ausführenden
    for (const p of geg.spieler){
      const d = Math.hypot(p.x - bx, p.z - bz);
      if (d < 4 && p.rolle !== 'TW'){ const l = d || 1; platz(p, bx + (p.x - bx) / l * 4, clamp(bz + (p.z - bz) / l * 4, -HB + 0.5, HB - 0.5), bx, bz); }
    }
  }
  for (const p of spiel.alle){ p.basis = { x:p.x, z:p.z }; }
  ball.besitzer = schuetze;
  schuetze.standardPlatz = null;
  spiel.standard = { art, team, schuetze, zeit:0 };
  spiel.phase = 'warten'; spiel.phaseZeit = 0;
  if (schuetze.einwurf) dribbeln(0.016);
  if (team.mensch && schuetze.rolle !== 'TW') spiel.gesteuert = schuetze;
  else if (spiel.teams[0].mensch && (!spiel.gesteuert || spiel.gesteuert.rolle === 'TW')) spiel.gesteuert = feld(spiel.teams[0]).find(p => p.rolle === 'ST') || feld(spiel.teams[0])[0];
  if (spiel.gesteuert && !spiel.teams[0].mensch) spiel.gesteuert = null;
  if (art === 'anstoss') meldung('Anstoß', team.daten.name);
  kam.schnitt = true;
}

// Wartet auf die Ausführung (Mensch: Taste, KI: kurze Pause)
function standardWarten(dt){
  const st = spiel.standard;
  if (!st || spiel.blende) return;
  st.zeit += dt;
  const p = st.schuetze;
  const mensch = p === spiel.gesteuert;
  if (mensch){
    // Zielen: der Ausführende dreht sich in Eingaberichtung
    const m = Math.hypot(eingabe.x, eingabe.z);
    if (m > 0.2){
      let r = Math.atan2(eingabe.z, eingabe.x);
      if (st.art === 'einwurf'){ const innen = -Math.sign(p.z) * Math.PI / 2; r = innen + clamp(winkelDiff(innen, r), -1.3, 1.3); }
      p.blickFest = r;
    }
    const t = eingabe.tasten;
    const aktion = t.pass.neu ? 'pass' : t.heber.neu ? 'heber' : t.schuss.neu ? 'schuss' : null;
    if (aktion) return standardAusfuehren(aktion);
    if (st.zeit > 8) return standardAusfuehren('auto');
  } else if (st.zeit > (st.art === 'anstoss' ? 1.4 : 1.1)){
    return standardAusfuehren('auto');
  }
}

function standardAusfuehren(aktion){
  const st = spiel.standard, p = st.schuetze, team = p.team;
  const mensch = p === spiel.gesteuert && aktion !== 'auto';
  const [rx, rz] = mensch ? eingabeRichtung(p) : [team.seite, 0];
  spiel.standard = null;
  spiel.phase = 'spiel'; spiel.phaseZeit = 0;
  for (const q of spiel.alle){ q.blickFest = null; q.standardPlatz = null; }
  const mitspieler = team.spieler.filter(q => q !== p && q.rolle !== 'TW');
  const naechster = mitspieler.sort((a, b) => abstand(a, p) - abstand(b, p))[0];
  if (st.art === 'anstoss'){
    Ton.pfiff('kurz');
    const m = mensch ? passZielWaehlen(p, rx, rz) || naechster : naechster;
    passSpielen(p, m, 'flach', 0.02);
  } else if (st.art === 'einwurf'){
    let m = mensch && aktion === 'pass' ? passZielWaehlen(p, rx, rz) : null;
    if (!mensch){
      const kandidaten = team.spieler.filter(q => q !== p && q.rolle !== 'TW' && abstand(q, p) < 22);
      m = zufallAus(kandidaten.length ? kandidaten : [naechster]);
    }
    if (m) passSpielen(p, m, 'wurf', 0.04);
    else {
      const weite = aktion === 'pass' ? 9 : 17;
      const tx = clamp(ball.x + rx * weite, -HL + 1, HL - 1), tz = clamp(ball.z + rz * weite, -HB + 1, HB - 1);
      const d = Math.hypot(tx - ball.x, tz - ball.z);
      const vec = schussVektor(tx - ball.x, tz - ball.z, Math.min(17, heberTempo(d, 0.3, 2.1)), 0.3);
      ballSpielen(p, vec.vx, vec.vy, vec.vz, 'pass', 0.3);
    }
  } else if (st.art === 'ecke'){
    if (aktion === 'pass') passSpielen(p, mensch ? passZielWaehlen(p, rx, rz) || naechster : naechster, 'flach', 0.03);
    else {
      let m = mensch ? passZielWaehlen(p, rx, rz, true) : null;
      if (!m){
        const drin = mitspieler.filter(q => Math.abs(q.x - team.seite * HL) < STRAF.T && Math.abs(q.z) < STRAF.B / 2);
        m = zufallAus(drin.length ? drin : mitspieler);
      }
      passSpielen(p, m, 'flanke', mensch ? 0.03 : 0.06);
    }
  } else {
    // Abstoß: der Torwart spielt zum freiesten Mitspieler
    p.haltZeit = 99;
    torwartAbspielen(p, 0);
  }
  p.sperre = 0.5;
}

/* ---------- Wiederholung ---------- */
const WDH = { laenge:9 * 60, felder:15, daten:null, gesamt:0, abspielen:null };
function aufnahmeStart(){
  WDH.stride = 7 + spiel.alle.length * WDH.felder;
  WDH.daten = new Float32Array(WDH.laenge * WDH.stride);
  WDH.gesamt = 0;
}
function aufnehmen(){
  if (!WDH.daten || spiel.phase === 'wiederholung') return;
  const d = WDH.daten, o = (WDH.gesamt % WDH.laenge) * WDH.stride, q = Welt.ball.quaternion;
  d[o] = ball.x; d[o + 1] = ball.y; d[o + 2] = ball.z; d[o + 3] = q.x; d[o + 4] = q.y; d[o + 5] = q.z; d[o + 6] = q.w;
  let i = o + 7;
  for (const p of spiel.alle){
    d[i] = p.x; d[i + 1] = p.y; d[i + 2] = p.z; d[i + 3] = p.dir; d[i + 4] = p.lauf; d[i + 5] = p.tempo;
    d[i + 6] = p.schussT; d[i + 7] = p.graetsche; d[i + 8] = p.hecht; d[i + 9] = p.hechtSeite; d[i + 10] = p.fallT;
    d[i + 11] = p.kopfT; d[i + 12] = p.jubel ? 1 : 0; d[i + 13] = p.halten ? 1 : 0; d[i + 14] = p.einwurf;
    i += WDH.felder;
  }
  WDH.gesamt++;
}
function wiederholungStarten(){
  const von = Math.max(WDH.gesamt - WDH.laenge + 1, spiel.torFrame - Math.round(3.6 * 60));
  const bis = Math.min(WDH.gesamt - 1, spiel.torFrame + Math.round(0.9 * 60));
  if (bis - von < 30){ return anstossNachTor(); }
  WDH.abspielen = { pos:von, von, bis };
  spiel.phase = 'wiederholung'; spiel.phaseZeit = 0;
  kam.schnitt = true;
}
function wiederholungSchritt(dt){
  const w = WDH.abspielen;
  w.pos += dt * 60 * 0.62;
  const weiter = eingabe.tasten.pass.neu || eingabe.tasten.schuss.neu || eingabe.tasten.heber.neu || eingabe.tipp;
  if (w.pos >= w.bis || (spiel.phaseZeit > 0.4 && weiter)){
    WDH.abspielen = null;
    anstossNachTor();
  }
}
function anstossNachTor(){
  spiel.phase = 'warten-anstoss';
  for (const p of spiel.alle) p.jubel = false;
  umblenden(() => standardAufstellen({ art:'anstoss', team:spiel.teams[spiel.anstossTeam] }));
}
// Einen aufgenommenen Moment auf Figuren und Ball legen
function wiederholungZeigen(zeit){
  const w = WDH.abspielen;
  if (!w) return null;
  const f = Math.min(Math.floor(w.pos), w.bis), o = (f % WDH.laenge) * WDH.stride, d = WDH.daten;
  Welt.ball.position.set(d[o], d[o + 1], d[o + 2]);
  Welt.ball.quaternion.set(d[o + 3], d[o + 4], d[o + 5], d[o + 6]);
  let i = o + 7;
  for (const p of spiel.alle){
    const h = p.haltung;
    h.x = d[i]; h.y = d[i + 1]; h.z = d[i + 2]; h.dreh = d[i + 3]; h.lauf = d[i + 4]; h.tempo = d[i + 5];
    h.schussT = d[i + 6]; h.graetscheT = d[i + 7]; h.hechtT = d[i + 8]; h.hechtSeite = d[i + 9]; h.fallT = d[i + 10];
    h.kopfT = d[i + 11]; h.jubel = d[i + 12] > 0; h.halten = d[i + 13] > 0; h.einwurf = d[i + 14];
    haltungSetzen(p.figur, h, zeit);
    i += WDH.felder;
  }
  return { x:d[o], y:d[o + 1], z:d[o + 2] };
}

/* ---------- Kamera ---------- */
const kam = { x:0, z:0, zx:0, zy:0, zz:0, px:0, py:26, pz:HB + 32, winkel:0, schnitt:true };
function kameraSetzen(px, py, pz, zx, zy, zz, dt, rate){
  if (kam.schnitt || !dt){ kam.px = px; kam.py = py; kam.pz = pz; kam.zx = zx; kam.zy = zy; kam.zz = zz; kam.schnitt = false; }
  else {
    kam.px = glatt(kam.px, px, rate, dt); kam.py = glatt(kam.py, py, rate, dt); kam.pz = glatt(kam.pz, pz, rate, dt);
    kam.zx = glatt(kam.zx, zx, rate * 1.4, dt); kam.zy = glatt(kam.zy, zy, rate * 1.4, dt); kam.zz = glatt(kam.zz, zz, rate * 1.4, dt);
  }
  kamera.position.set(kam.px, kam.py, kam.pz);
  kamera.lookAt(kam.zx, kam.zy, kam.zz);
}
function kameraSchritt(dt, wdhBall){
  const aspekt = innerWidth / innerHeight;
  if (spiel.phase === 'wiederholung' && wdhBall){
    const s = spiel.torSeite;
    const seite = wdhBall.z > 0 ? -1 : 1;
    kameraSetzen(s * (HL + 7), 3.4, seite * 9, wdhBall.x * 0.6 + s * HL * 0.4, 1, wdhBall.z * 0.7, dt, 3);
    return;
  }
  if (spiel.phase === 'tor' && spiel.torschuetze && spiel.phaseZeit > 0.6){
    const h = spiel.torschuetze;
    kameraSetzen(h.x - spiel.torSeite * 3, 5.5, h.z + 11, h.x, 1.1, h.z, dt, 1.6);
    return;
  }
  if (spiel.phase === 'elfmeter' && spiel.elfmeter){ elfmeterKamera(dt); return; }
  if (spiel.phase === 'start'){
    kam.winkel += dt * 0.05;
    kameraSetzen(Math.sin(kam.winkel) * 30, 24, HB + 30 + Math.cos(kam.winkel) * 6, ball.x * 0.5, 0, ball.z * 0.3, dt, 1);
    return;
  }
  // Fernsehkamera von der Seitenlinie
  const b = ball.besitzer;
  const zielX = clamp(ball.x + (b ? b.vx * 0.5 : ball.vx * 0.25), -HL + 9, HL - 9);
  const zielZ = clamp(ball.z, -HB + 4, HB - 4);
  let weit = 1;
  if (aspekt < 1.35) weit = 1 + (1.35 - aspekt) * 0.85;
  if (aspekt > 2.1) weit = 0.92;
  const hoehe = 16.5 * weit, weg = HB + 16.5 * weit;
  kameraSetzen(zielX, hoehe, weg + zielZ * 0.2, zielX, 0, zielZ * 0.78 - 1, dt, 2.4);
}
kam.schnitt = true;
