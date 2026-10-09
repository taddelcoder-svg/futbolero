'use strict';
// Futbolero – KI: Taktik fürs ganze Team (wer geht zum Ball, wer presst, wer läuft sich frei),
// Entscheidungen am Ball (Schuss, Pass, Dribbling) und der Torwart.

function gegnerVon(team){ return spiel.teams[1 - team.idx]; }
function eigenesTorX(team){ return -team.seite * HL; }
function imEigenenStrafraum(p, x = p.x, z = p.z){
  const torX = eigenesTorX(p.team);
  return Math.abs(x - torX) < STRAF.T + 0.3 && Math.abs(z) < STRAF.B / 2 + 0.3 && Math.sign(x || 1) === Math.sign(torX);
}
function kiTempo(p, sprint){
  const pr = p.team.kiProfil;
  return (sprint ? TEMPO.kiSprint : TEMPO.kiLauf) * pr.tempo;
}

// Frühester Punkt, an dem p den (freien) Ball erreicht
// maxHoehe: Empfänger eines hohen Passes warten lieber, bis der Ball auf Brusthöhe ist
function abfangen(p, punkte, reaktion = 0.1, maxHoehe = 2.2){
  const v = kiTempo(p, true);
  for (const q of punkte){
    if (q.y > maxHoehe && !(p.rolle === 'TW' && q.y < 2.6 && imEigenenStrafraum(p, q.x, q.z))) continue;
    const d = Math.hypot(q.x - p.x, q.z - p.z) - 0.55;
    if (d <= v * Math.max(0, q.t - reaktion) || d < 0.2) return { x:q.x, z:q.z, t:q.t };
  }
  const l = punkte[punkte.length - 1] || { x:ball.x, z:ball.z, t:0 };
  return { x:l.x, z:l.z, t:l.t + Math.hypot(l.x - p.x, l.z - p.z) / v };
}

/* ---------- Taktik (alle 0,1 s) ---------- */
function taktik(team){
  const geg = gegnerVon(team);
  const punkte = ballVorhersage(spiel.zeit);
  const b = ball.besitzer;
  const wirHaben = !!b && b.team === team;
  const sieHaben = !!b && b.team !== team;
  const feld = team.spieler.filter(p => p.rolle !== 'TW' && !p.weg);
  const menschen = team.spieler.filter(p => p.st);
  for (const p of team.spieler){ p.auftrag = 'position'; p.markiert = null; }

  if (!b){
    let bester = null;
    for (const p of team.spieler){
      if (p.weg) continue;
      if (p.rolle === 'TW'){
        const a = abfangen(p, punkte, 0.15);
        p.abfang = a;
        if (!imEigenenStrafraum(p, a.x, a.z) || Math.abs(a.x) > HL) continue;
      } else p.abfang = abfangen(p, punkte, 0.1, ball.passZiel === p ? 1.5 : 2.2);
      if (!bester || p.abfang.t < bester.abfang.t) bester = p;
    }
    // Ein Pass für uns: der Empfänger geht hin, außer ein anderer ist klar schneller
    const z = ball.passZiel;
    if (z && z.team === team && (!bester || z.abfang.t < bester.abfang.t + 0.5)) bester = z;
    if (bester && !bester.st && menschen.length){
      // Der schnellste Mensch des Teams: holt er den Ball selbst, oder wechselt er?
      const g = menschen.reduce((a, c) => (c.abfang.t < a.abfang.t ? c : a));
      if (bester.rolle !== 'TW' && g.abfang.t > bester.abfang.t + 0.9 && abstand(g, ball) > 7 && spiel.phase === 'spiel'){ wechseln(g.st, bester); bester = null; }
      else if (bester.rolle !== 'TW' && g.abfang.t < bester.abfang.t + 0.6) bester = null;
    }
    if (bester && !bester.st) bester.auftrag = 'ball';
    // Um einen umkämpften Ball kümmert sich zur Not ein Zweiter
    if (bester){
      const zweiter = feld.filter(p => p !== bester && !p.st).sort((a, c) => a.abfang.t - c.abfang.t)[0];
      const gegT = Math.min(...geg.spieler.filter(o => !o.weg).map(o => abfangen(o, punkte, 0.1).t));
      if (zweiter && zweiter.abfang.t < gegT + 0.3 && zweiter.abfang.t < bester.abfang.t + 0.7 && abstand(zweiter, ball) < 12) zweiter.auftrag = 'ball';
    }
  } else if (wirHaben){
    if (!b.st) b.auftrag = 'fuehren';
  } else if (sieHaben && !b.halten && spiel.phase === 'spiel'){
    const nachAbstand = feld.filter(p => !p.st).sort((a, c) => abstand(a, b) - abstand(c, b));
    const erster = nachAbstand[0], zweiter = nachAbstand[1];
    const menschNah = menschen.some(p => abstand(p, b) < 6.5);
    const doppeln = menschen.some(p => p.st.doppeln);
    if (erster && (!menschNah || doppeln)) erster.auftrag = 'pressen';
    const decker = erster && erster.auftrag === 'pressen' ? zweiter : erster;
    if (decker && abstand(decker, b) < 18) decker.auftrag = 'decken';
  }

  for (const p of feld) p.basis = formationsPunkt(p, team, wirHaben);
  if (!wirHaben) markieren(team, geg);
  else freilaufen(team, geg);
}

// Grundposition: Formation, mit dem Ball verschoben
function formationsPunkt(p, team, angriff){
  const s = team.seite;
  const bf = clamp((ball.x * s + HL) / FELD.L, 0, 1);
  const f = p.form;
  let fx = angriff ? f.x * 0.62 + bf * 0.42 + 0.05 : f.x * 0.6 + bf * 0.36 - 0.03;
  if (p.rolle === 'AB') fx = clamp(fx, 0.1, angriff ? 0.6 : 0.42);
  else if (p.rolle === 'MI') fx = clamp(fx, 0.18, angriff ? 0.8 : 0.6);
  else fx = clamp(fx, 0.34, 0.88);
  if (!angriff && p.rolle !== 'ST') fx = Math.min(fx, Math.max(0.07, bf - 0.03));
  const fz = f.z * 0.8 + (ball.z / HB) * (angriff ? 0.22 : 0.36);
  return { x:s * (fx * FELD.L - HL), z:clamp(fz * HB, -HB + 1.5, HB - 1.5) };
}

// Verteidiger stellen sich zwischen gefährliche Gegner und das eigene Tor
function markieren(team, geg){
  const torX = eigenesTorX(team);
  const vergeben = new Set();
  const decker = team.spieler.filter(p => p.rolle !== 'TW' && p.rolle !== 'ST' && p.auftrag === 'position' && !p.st && !p.weg);
  for (const p of decker){
    let bester = null, bestD = 14;
    for (const o of geg.spieler){
      if (o.rolle === 'TW' || o.weg || o === ball.besitzer || vergeben.has(o)) continue;
      const d = Math.hypot(o.x - p.basis.x, o.z - p.basis.z);
      if (d < bestD){ bestD = d; bester = o; }
    }
    if (!bester) continue;
    vergeben.add(bester);
    const dx = torX - bester.x, dz = -bester.z, l = Math.hypot(dx, dz) || 1;
    const nah = clamp(1 - abstand(bester, ball) / 30, 0.35, 0.85);
    p.basis = {
      x:lerp(p.basis.x, bester.x + dx / l * 1.7, nah),
      z:lerp(p.basis.z, bester.z + dz / l * 1.7, nah)
    };
    p.markiert = bester;
  }
}

// Anspielbar sein: aus dem Passweg eines Gegners gehen und Abstand zu Mitspielern halten
function freilaufen(team, geg){
  const b = ball.besitzer;
  const leute = team.spieler.filter(p => p.rolle !== 'TW' && p !== b && !p.weg);
  for (const p of leute){
    for (const o of geg.spieler){
      if (o.weg) continue;
      const r = streckenAbstand(o.x, o.z, b.x, b.z, p.basis.x, p.basis.z);
      if (r.t > 0.1 && r.t < 0.95 && r.d < 1.8){
        const dx = p.basis.x - b.x, dz = p.basis.z - b.z, l = Math.hypot(dx, dz) || 1;
        const seite = ((o.x - b.x) * dz - (o.z - b.z) * dx) > 0 ? 1 : -1;
        p.basis.x += -dz / l * 3.2 * seite;
        p.basis.z = clamp(p.basis.z + dx / l * 3.2 * seite, -HB + 1.5, HB - 1.5);
      }
    }
    // Stürmer starten in die Tiefe, wenn der Ballführer Platz hat
    if (p.rolle === 'ST' && b.x * team.seite > -8){
      p.basis.x = team.seite * Math.min(HL - 7, Math.max(p.basis.x * team.seite, b.x * team.seite + 9));
    }
  }
  for (let i = 0; i < leute.length; i++) for (let j = i + 1; j < leute.length; j++){
    const a = leute[i].basis, c = leute[j].basis;
    const dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz);
    if (d < 6 && d > 0.01){ const k = (6 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; c.x += dx * k; c.z += dz * k; }
  }
}

/* ---------- Steuerung eines KI-Feldspielers (jeder Schritt) ---------- */
function kiFeldspieler(p, dt){
  const b = ball.besitzer;
  let zx = p.basis ? p.basis.x : p.x, zz = p.basis ? p.basis.z : p.z, sprint = false, mindest = 0;
  p.blick = Math.atan2(ball.z - p.z, ball.x - p.x);
  switch (p.auftrag){
    case 'fuehren':
      if (b === p) return kiBallfuehrer(p, dt);
      break;
    case 'ball': {
      const a = p.abfang || { x:ball.x, z:ball.z };
      const d = abstand(p, ball);
      if (d < 2.5 && ball.y < 1){ zx = ball.x + ball.vx * 0.12; zz = ball.z + ball.vz * 0.12; }
      else { zx = a.x; zz = a.z; }
      sprint = true;
      mindest = Math.hypot(ball.vx, ball.vz) + 1.5;
      break;
    }
    case 'pressen': {
      if (!b) break;
      // Von der Torseite her anlaufen
      const torX = eigenesTorX(p.team);
      const dx = torX - b.x, dz = -b.z, l = Math.hypot(dx, dz) || 1;
      const d = abstand(p, b);
      const vor = d > 3 ? 0.9 : 0.25;
      zx = ball.x + b.vx * 0.25 + dx / l * vor; zz = ball.z + b.vz * 0.25 + dz / l * vor;
      sprint = d > 2.5;
      mindest = Math.hypot(b.vx, b.vz) * 0.95;
      // Grätsche, wenn es passt. Liegt der Gegner näher als der Ball (von hinten), wäre es meist ein Foul –
      // das trauen sich die Computerspieler nur selten
      const pr = p.team.kiProfil;
      const sauber = abstand(p, ball) < d - 0.15 ? 1 : 0.25;
      if (d < 2.3 && d > 0.9 && Math.random() < pr.graetsche * dt * 1.4 * sauber && Math.cos(winkelDiff(p.dir, Math.atan2(ball.z - p.z, ball.x - p.x))) > 0.85){
        graetsche(p, Math.atan2(ball.z + b.vz * 0.15 - p.z, ball.x + b.vx * 0.15 - p.x));
        return;
      }
      break;
    }
    case 'decken': {
      if (!b) break;
      const torX = eigenesTorX(p.team);
      const dx = torX - b.x, dz = -b.z, l = Math.hypot(dx, dz) || 1;
      const weg = Math.min(6, l * 0.4);
      zx = b.x + dx / l * weg; zz = b.z + dz / l * weg;
      sprint = abstand(p, { x:zx, z:zz }) > 4;
      break;
    }
    default: {
      const d = Math.hypot(zx - p.x, zz - p.z);
      // Hinter dem Ball zurücksprinten, wenn der Gegner kontert
      sprint = d > 9 || (b && b.team !== p.team && (p.x - ball.x) * p.team.seite > 3 && d > 4);
    }
  }
  laufeZu(p, zx, zz, kiTempo(p, sprint), mindest);
}

// Zum Punkt laufen und dort abbremsen. „mindest“: nicht langsamer werden (zum Ball- oder Gegnerjagen)
function laufeZu(p, zx, zz, tempo, mindest = 0){
  const dx = zx - p.x, dz = zz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.25 && !mindest){ p.wx = 0; p.wz = 0; return; }
  if (d < 0.05){ p.wx = 0; p.wz = 0; return; }
  const v = Math.min(tempo, Math.max(mindest, d * 2.4));
  p.wx = dx / d * v; p.wz = dz / d * v;
}

/* ---------- Am Ball ---------- */
function kiBallfuehrer(p, dt){
  if (p.rolle === 'TW') return torwartAbspielen(p, dt);
  const pr = p.team.kiProfil;
  p.denk -= dt;
  if (p.denk <= 0){
    p.denk = pr.denken * zufall(0.7, 1.3);
    const e = entscheiden(p);
    if (e.art === 'schuss'){ kiSchuss(p); return; }
    if (e.art === 'pass'){ passSpielen(p, e.ziel, e.hoch ? 'hoch' : 'flach', pr.passFehler); return; }
  }
  const r = dribbelRichtung(p);
  const frei = freiraum(p);
  const v = kiTempo(p, frei > 0.55) * 0.95;
  p.wx = Math.cos(r) * v; p.wz = Math.sin(r) * v;
  p.blick = null;
}

function entscheiden(p){
  const team = p.team, s = team.seite, pr = team.kiProfil, geg = gegnerVon(team);
  const torX = s * HL;
  const dTor = Math.hypot(torX - p.x, p.z);
  let druck = 99;
  for (const o of geg.spieler) druck = Math.min(druck, abstand(o, p));
  // Schuss?
  if (dTor < 28 && p.x * s > 0){
    const w1 = Math.atan2(-TOR.B / 2 - p.z, torX - p.x), w2 = Math.atan2(TOR.B / 2 - p.z, torX - p.x);
    const sicht = Math.abs(winkelDiff(w1, w2));
    let schuss = clamp((28 - dTor) / 18, 0, 1) * clamp(sicht / 0.32, 0.15, 1) * pr.schussLust;
    if (dTor < 12) schuss += 0.3;
    if (druck < 1.8) schuss *= 1.15;
    // Blockt jemand direkt die Schussbahn?
    for (const o of geg.spieler){
      if (o.rolle === 'TW') continue;
      const r = streckenAbstand(o.x, o.z, p.x, p.z, torX, 0);
      if (r.d < 0.9 && r.t > 0.03 && r.t < 0.8) schuss *= 0.45;
    }
    if (schuss > 0.62 || Math.random() < schuss * 0.4) return { art:'schuss' };
  }
  // Pass?
  let bester = null;
  for (const m of team.spieler){
    if (m === p || m.weg) continue;
    const w = passWert(p, m, geg);
    if (w && (!bester || w.wert > bester.wert)) bester = w;
  }
  const frei = freiraum(p);
  if (bester && (bester.wert > frei * 0.85 + 0.12 || (druck < 2.1 && bester.wert > 0.02))) return { art:'pass', ziel:bester.m, hoch:bester.hoch };
  return { art:'dribbel' };
}

function passWert(p, m, geg){
  const s = p.team.seite;
  const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz);
  if (d < 5 || d > 40) return null;
  let frei = 6, spur = 4;
  for (const o of geg.spieler){
    frei = Math.min(frei, abstand(o, m));
    const r = streckenAbstand(o.x, o.z, p.x, p.z, m.x, m.z);
    if (r.t > 0.04 && r.t < 0.97) spur = Math.min(spur, r.d + r.t * 0.8);
  }
  const flach = spur > 1.75;
  const hoch = !flach && d > 14 && frei > 3.8;
  if (!flach && !hoch) return null;
  const fort = (m.x - p.x) * s;
  const torNaehe = clamp((m.x * s - (HL - 26)) / 26, 0, 1);
  let wert = fort / 25 * 0.5 + frei / 6 * 0.35 + torNaehe * 0.3 - (hoch ? 0.2 : 0) - Math.max(0, d - 25) / 40;
  if (m.rolle === 'TW') wert -= 0.6;
  if (m === p.letzterPassVon && spiel.zeit - p.bekommenZeit < 2) wert -= 0.2;
  return { m, wert, hoch };
}

// Wie viel Platz ist vor mir in Richtung Tor? (0..1)
function freiraum(p){
  const s = p.team.seite, geg = gegnerVon(p.team);
  let min = 10;
  for (const o of geg.spieler){
    const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.01) return 0;
    if (dx * s / d > 0.3) min = Math.min(min, d);
  }
  return min / 10;
}

function dribbelRichtung(p){
  const s = p.team.seite, geg = gegnerVon(p.team);
  const zx = s * HL, zz = clamp(p.z * 0.55, -5, 5);
  let ax = zx - p.x, az = zz - p.z;
  const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  let rx = ax, rz = az;
  for (const o of geg.spieler){
    const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
    if (d > 7 || d < 0.01) continue;
    const vor = (dx * ax + dz * az) / d;
    if (vor < -0.2) continue;
    const k = (7 - d) / 7 * 1.6;
    // Seitlich am Gegner vorbei
    const seite = (ax * dz - az * dx) > 0 ? 1 : -1;
    rx += -dx / d * k * 0.5 + az * seite * k;
    rz += -dz / d * k * 0.5 - ax * seite * k;
  }
  if (Math.abs(p.z) > HB - 4) rz -= Math.sign(p.z) * 1.2;
  if (p.x * s > HL - 3) rx -= s * 1.5;
  return Math.atan2(rz, rx);
}

function kiSchuss(p){
  const s = p.team.seite, tw = gegnerVon(p.team).spieler[0];
  const torX = s * HL, dTor = Math.hypot(torX - p.x, p.z);
  // In die Ecke, die weiter vom Torwart weg ist
  const seite = tw.z > p.z * 0.25 ? -1 : 1;
  const zz = seite * (TOR.B / 2 - zufall(0.45, 1.2));
  const kraft = dTor > 17 ? zufall(0.72, 0.95) : zufall(0.45, 0.85);
  schiessen(p, kraft, zz, p.team.kiProfil.schussFehler);
}

/* ---------- Torwart ---------- */
function kiTorwart(p, dt){
  const team = p.team, pr = team.twProfil;
  const torX = eigenesTorX(team), s = team.seite;
  p.blick = Math.atan2(ball.z - p.z, ball.x - p.x);
  if (ball.besitzer === p) return torwartAbspielen(p, dt);
  if (p.hecht > 0){ p.wx = 0; p.wz = 0; return; }

  // Kommt ein Schuss?
  if (!ball.besitzer && spiel.phase === 'spiel'){
    const vx = ball.vx;
    if (vx * -s > 3.5){
      const t = (torX - ball.x) / vx;
      if (t > 0 && t < 2.2){
        const zc = ball.z + ball.vz * t;
        const yc = ball.y + ball.vy * t - 0.5 * GRAV * t * t;
        if (Math.abs(zc) < TOR.B / 2 + 1 && yc < TOR.H + 0.8 && Math.hypot(ball.vx, ball.vz) > 7){
          if (spiel.zeit - ball.gespieltZeit < pr.twReaktion){ p.wx = 0; p.wz = 0; return; }
          const tk = Math.max(0.01, (p.x - ball.x) / vx);
          const zk = ball.z + ball.vz * tk;
          let yk = ball.y + ball.vy * tk - 0.5 * GRAV * tk * tk;
          if (yk < BALL_R) yk = BALL_R;
          const dz = zk - p.z;
          if (Math.abs(dz) > 0.75 && tk < 0.85){ hechten(p, dz, yk, tk, pr); return; }
          laufeZu(p, p.x, clamp(zk, -TOR.B / 2, TOR.B / 2), pr.twTempo);
          return;
        }
      }
    }
  }
  // Freier Ball im Strafraum: rauskommen
  if (p.auftrag === 'ball' && p.abfang){
    laufeZu(p, p.abfang.x, p.abfang.z, pr.twTempo * 1.1, Math.hypot(ball.vx, ball.vz) + 1);
    return;
  }
  // Allein vor dem Tor: dem Stürmer entgegen
  const b = ball.besitzer;
  if (b && b.team !== team && !b.halten){
    const d = Math.hypot(b.x - torX, b.z);
    const verteidigerVorn = team.spieler.some(m => m !== p && Math.hypot(m.x - torX, m.z) < d - 1 && abstand(m, b) < 3);
    if (d < 10 && !verteidigerVorn){
      laufeZu(p, ball.x, ball.z, pr.twTempo);
      if (abstand(p, ball) < 1.1 && Math.random() < pr.twTempo * 0.12 * dt * 6){
        b.sperre = 0.7; b.betaeubt = 0.2;
        fangen(p);
      }
      return;
    }
  }
  // Grundstellung: auf der Linie zwischen Ball und Tormitte
  const dx = ball.x - torX, dz = ball.z, d = Math.hypot(dx, dz) || 1;
  const raus = ball.x * s < 0 ? clamp(0.8 + (30 - d) * 0.09, 0.8, 3.4) : 0.9;
  const zx = torX + dx / d * raus;
  const zz = clamp(dz / d * raus, -TOR.B / 2 + 0.5, TOR.B / 2 - 0.5);
  laufeZu(p, zx, zz, Math.min(pr.twTempo, 5));
}

function hechten(p, dz, yk, tk, pr){
  if (p.hecht > 0 || p.betaeubt > 0) return;
  p.hecht = 0.001;
  const v = clamp(dz / Math.max(0.28, tk + 0.1), -pr.twTempo, pr.twTempo);
  p.hechtVz = v;
  p.hechtVx = (ball.x - p.x) > 0 ? 0.6 : -0.6;
  // Welche Seite ist das aus Sicht des Torwarts? (lokal +x)
  const rechtsX = Math.sin(p.dir), rechtsZ = -Math.cos(p.dir);
  p.hechtSeite = Math.sign(rechtsZ * dz + rechtsX * 0) || 1;
  p.hechtHoch = yk;
}

// Hat der Torwart den Ball? Prüft Reichweite im Stand und im Flug.
function torwartParade(p){
  if (ball.besitzer || ball.imTor || p.sperre > 0 || p.fallT > 0) return false;
  if (!imEigenenStrafraum(p)) return false;
  const pr = p.team.twProfil;
  // Spielerwert „Halten“ und Powerup „Krake“ vergrößern die Reichweite
  const reich = pr.twReich * p.f.halten * (p.team.pu.mauer > 0 ? 1.7 : 1);
  const dx = ball.x - p.x;
  if (Math.abs(dx) > 0.7) return false;
  const seitlich = ball.z - p.z, hoehe = ball.y;
  let ok;
  if (p.hecht > 0){
    const richtig = Math.sign(seitlich) === Math.sign(p.hechtVz) || Math.abs(seitlich) < 0.6;
    ok = richtig && Math.abs(seitlich) < reich + 0.35 && hoehe < 2.55;
  } else {
    ok = Math.abs(seitlich) < 0.62 * reich + 0.12 && hoehe < 2.35;
  }
  if (!ok) return false;
  const tempo = Math.hypot(ball.vx, ball.vy, ball.vz);
  const zentral = Math.abs(seitlich) < 0.55 && hoehe < 1.9;
  if ((tempo < 12 + reich * 6 && zentral) || tempo < 10) fangen(p);
  else abwehren(p, seitlich);
  if (ball.art === 'schuss' && ball.schussVon && ball.schussVon.team !== p.team){ ball.schussVon.team.stat.aufsTor++; ball.schussVon.ps.aufsTor++; }
  ball.art = null;
  p.team.stat.paraden++; p.ps.paraden++;
  return true;
}

function fangen(p){
  ball.besitzer = p; ball.zuletzt = p; ball.passZiel = null;
  ball.vx = ball.vy = ball.vz = 0;
  p.halten = true; p.haltZeit = 0; p.denk = 0;
  Ton.schuss(0.2);
}

function abwehren(p, seitlich){
  const s = p.team.seite;
  const sz = Math.sign(seitlich) || (Math.random() < 0.5 ? 1 : -1);
  ball.vx = s * zufall(3, 7.5);
  ball.vz = sz * zufall(3, 7);
  ball.vy = zufall(1.5, 5);
  ball.zuletzt = p; ball.passZiel = null;
  p.sperre = 0.45;
  Ton.schuss(0.45);
  Fans.aufregung = 1;
  Ton.raunen();
}

function torwartAbspielen(p, dt){
  p.wx = 0; p.wz = 0;
  p.haltZeit = (p.haltZeit || 0) + dt;
  if (p.haltZeit < (p.halten ? 1.3 : 0.35)) return;
  const geg = gegnerVon(p.team);
  let bester = null;
  for (const m of p.team.spieler){
    if (m === p || m.weg) continue;
    const d = abstand(m, p);
    if (d < 6 || d > 42) continue;
    let frei = 8;
    for (const o of geg.spieler) frei = Math.min(frei, abstand(o, m));
    const w = frei / 8 + (m.x - p.x) * p.team.seite / 60 + zufall(0, 0.15);
    if (!bester || w > bester.w) bester = { m, w, d };
  }
  if (!bester) return;
  const hoch = bester.d > 24 || Math.random() < 0.2;
  p.halten = false;
  passSpielen(p, bester.m, hoch ? 'hoch' : 'flach', 0.05);
}
