'use strict';
// Futbolero – Physik: Ballflug mit Luftwiderstand, Aufsetzer, Rollen, Pfosten und Latte, Netz, Banden.
// Dazu die Rechner, mit denen Spieler und KI Pässe, Heber und Schüsse passend dosieren.

const ball = {
  x:0, y:BALL_R, z:0, vx:0, vy:0, vz:0,
  besitzer:null,      // Spieler, der den Ball am Fuß (oder in den Händen) hat
  zuletzt:null,       // wer ihn zuletzt berührt hat (für Aus und Ecke)
  imTor:0,            // ±1, sobald er durch den Torrahmen ins Netz ist
  passZiel:null, art:null, gespieltZeit:-9, schussVon:null
};
const ROLL_A = 1.7, ROLL_B = 0.055;  // Rollwiderstand: a + b·v (m/s²)
const LUFT = 0.0085;                 // Luftwiderstand: LUFT·v² (m/s²)

function ballSetzen(x, y, z){
  Object.assign(ball, { x, y, z, vx:0, vy:0, vz:0, besitzer:null, imTor:0, passZiel:null, art:null, schussVon:null });
}

function ballSchritt(dt, melde){
  if (ball.besitzer) return;
  const sp = Math.hypot(ball.vx, ball.vy, ball.vz);
  const n = Math.max(1, Math.ceil(sp * dt / 0.07));
  for (let i = 0; i < n; i++) ballTeilschritt(dt / n, melde);
}

function ballTeilschritt(dt, melde){
  const vorX = ball.x, vorY = ball.y, vorZ = ball.z;
  const amBoden = ball.y <= BALL_R + 0.004 && Math.abs(ball.vy) < 0.25;
  if (!amBoden) ball.vy -= GRAV * dt;
  const sp = Math.hypot(ball.vx, ball.vy, ball.vz);
  if (sp > 0){
    const k = Math.max(0, 1 - LUFT * sp * dt);
    ball.vx *= k; ball.vy *= k; ball.vz *= k;
  }
  if (amBoden){
    ball.vy = 0; ball.y = BALL_R;
    const hs = Math.hypot(ball.vx, ball.vz);
    if (hs > 0){
      const neu = Math.max(0, hs - (ROLL_A + ROLL_B * hs) * dt), f = neu / hs;
      ball.vx *= f; ball.vz *= f;
    }
  }
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
  if (ball.y < BALL_R){
    ball.y = BALL_R;
    if (ball.vy < -1.6){
      if (ball.vy < -4) melde('aufsetzer', -ball.vy);
      ball.vy = -ball.vy * 0.5; ball.vx *= 0.86; ball.vz *= 0.86;
    } else ball.vy = 0;
  }
  torKollision(1, vorX, vorY, vorZ, melde);
  torKollision(-1, vorX, vorY, vorZ, melde);
  // Halle und Käfig: Wände direkt an den Linien (nur das Tor ist offen)
  if (ARENA.wand && ball.y < ARENA.wandH){
    const gz = HB - BALL_R, gx = HL - BALL_R;
    if (Math.abs(ball.z) > gz && Math.abs(vorZ) <= gz + 0.05){
      const sz = Math.sign(ball.z);
      ball.z = sz * gz;
      if (ball.vz * sz > 0){ if (Math.abs(ball.vz) > 3) melde('wand', Math.abs(ball.vz)); ball.vz *= -0.72; ball.vx *= 0.94; }
    }
    const torMund = Math.abs(ball.z) < TOR.B / 2 + TOR.R && ball.y < TOR.H + TOR.R;
    if (Math.abs(ball.x) > gx && Math.abs(vorX) <= gx + 0.05 && !torMund && !ball.imTor){
      const sx = Math.sign(ball.x);
      ball.x = sx * gx;
      if (ball.vx * sx > 0){ if (Math.abs(ball.vx) > 3) melde('wand', Math.abs(ball.vx)); ball.vx *= -0.72; ball.vz *= 0.94; }
    }
  }
  // Werbebanden halten den Ball im Stadion
  const bx = HL + BANDE - BALL_R - 0.07, bz = HB + BANDE - BALL_R - 0.07;
  if (ball.y < 0.9 + BALL_R){
    if (Math.abs(ball.x) > bx){ ball.x = Math.sign(ball.x) * bx; if (ball.vx * Math.sign(ball.x) > 0) ball.vx *= -0.3; ball.vz *= 0.7; }
    if (Math.abs(ball.z) > bz){ ball.z = Math.sign(ball.z) * bz; if (ball.vz * Math.sign(ball.z) > 0) ball.vz *= -0.3; ball.vx *= 0.7; }
  } else {
    // Über die Bande in die Zuschauer: dort weich abfangen
    const gx = HL + BANDE + 3, gz = HB + BANDE + 3;
    if (Math.abs(ball.x) > gx){ ball.x = Math.sign(ball.x) * gx; ball.vx *= -0.2; }
    if (Math.abs(ball.z) > gz){ ball.z = Math.sign(ball.z) * gz; ball.vz *= -0.2; }
  }
}

// Kugel gegen Zylinder-Strecke (Pfosten, Latte)
function streckeStoss(ax, ay, az, bx, by, bz, r, elast, melde){
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const l2 = dx * dx + dy * dy + dz * dz;
  const t = clamp(((ball.x - ax) * dx + (ball.y - ay) * dy + (ball.z - az) * dz) / l2, 0, 1);
  const cx = ax + dx * t, cy = ay + dy * t, cz = az + dz * t;
  let nx = ball.x - cx, ny = ball.y - cy, nz = ball.z - cz;
  const d = Math.hypot(nx, ny, nz), min = r + BALL_R;
  if (d >= min || d < 1e-6) return;
  nx /= d; ny /= d; nz /= d;
  ball.x = cx + nx * min; ball.y = cy + ny * min; ball.z = cz + nz * min;
  const vn = ball.vx * nx + ball.vy * ny + ball.vz * nz;
  if (vn < 0){
    ball.vx -= (1 + elast) * vn * nx; ball.vy -= (1 + elast) * vn * ny; ball.vz -= (1 + elast) * vn * nz;
    ball.vx *= 0.94; ball.vy *= 0.94; ball.vz *= 0.94;
    if (-vn > 2.5) melde('pfosten', -vn);
  }
}

function torKollision(s, vorX, vorY, vorZ, melde){
  if (Math.abs(ball.x - s * HL) > TOR.T + 1 || Math.abs(ball.z) > TOR.B / 2 + 1 || ball.y > TOR.H + 1){
    if (ball.imTor === s && s * ball.x < HL) ball.imTor = 0;
    return;
  }
  const x0 = s * HL, pz = TOR.B / 2 + TOR.R, ph = TOR.H + TOR.R;
  streckeStoss(x0, 0, -pz, x0, ph, -pz, TOR.R, 0.72, melde);
  streckeStoss(x0, 0, pz, x0, ph, pz, TOR.R, 0.72, melde);
  streckeStoss(x0, ph, -pz, x0, ph, pz, TOR.R, 0.72, melde);

  // Durch den Torrahmen?
  if (ball.imTor !== s){
    if (s * vorX <= HL && s * ball.x > HL){
      const t = (HL - s * vorX) / ((s * ball.x - s * vorX) || 1e-6);
      const zc = vorZ + (ball.z - vorZ) * t, yc = vorY + (ball.y - vorY) * t;
      if (Math.abs(zc) < TOR.B / 2 && yc < TOR.H) ball.imTor = s;
    }
  } else if (s * ball.x < HL - 0.02){
    ball.imTor = 0;   // wieder herausgesprungen
  }

  if (ball.imTor === s){
    // Im Netz: weich abbremsen
    const hinten = HL + TOR.T - BALL_R - 0.05;
    if (s * ball.x > hinten){
      ball.x = s * hinten;
      if (s * ball.vx > 0){ if (s * ball.vx > 3) melde('netz', s * ball.vx); ball.vx *= -0.1; ball.vy *= 0.4; ball.vz *= 0.4; }
    }
    const seite = TOR.B / 2 - BALL_R;
    if (s * ball.x > HL && Math.abs(ball.z) > seite){
      ball.z = Math.sign(ball.z) * seite;
      if (ball.vz * Math.sign(ball.z) > 0){ ball.vz *= -0.12; ball.vx *= 0.6; }
    }
    const dach = TOR.H - BALL_R - (s * ball.x - HL) * 0.18;
    if (s * ball.x > HL + 0.05 && ball.y > dach){
      ball.y = dach;
      if (ball.vy > 0){ ball.vy *= -0.1; ball.vx *= 0.7; ball.vz *= 0.7; }
    }
    return;
  }

  // Netz von außen: der Kasten hinter der Linie ist fest
  const ax = s * ball.x;
  if (ax > HL && ax < HL + TOR.T + BALL_R && Math.abs(ball.z) < TOR.B / 2 + BALL_R && ball.y < TOR.H + BALL_R){
    const pHinten = HL + TOR.T + BALL_R - ax;
    const pSeite = TOR.B / 2 + BALL_R - Math.abs(ball.z);
    const pOben = TOR.H + BALL_R - ball.y;
    const m = Math.min(pHinten, pSeite, pOben);
    if (m === pHinten){ ball.x = s * (HL + TOR.T + BALL_R); if (s * ball.vx < 0) ball.vx *= -0.2; }
    else if (m === pSeite){ const sz = Math.sign(ball.z) || 1; ball.z = sz * (TOR.B / 2 + BALL_R); if (ball.vz * sz < 0) ball.vz *= -0.2; }
    else { ball.y = TOR.H + BALL_R; if (ball.vy < 0) ball.vy *= -0.25; }
    ball.vx *= 0.85; ball.vz *= 0.85;
  }
}

/* ---------- Vorhersage (ohne Pfosten und Netz) ---------- */
const vorhersage = { punkte:[], zeit:-1 };
function ballVorhersage(jetzt, dauer = 3, dt = 0.05){
  if (vorhersage.zeit === jetzt) return vorhersage.punkte;
  const p = vorhersage.punkte; p.length = 0;
  let x = ball.x, y = ball.y, z = ball.z, vx = ball.vx, vy = ball.vy, vz = ball.vz;
  if (ball.besitzer){
    const b = ball.besitzer;
    for (let t = dt; t <= dauer + 1e-6; t += dt) p.push({ t, x:ball.x + b.vx * Math.min(t, 1), y:BALL_R, z:ball.z + b.vz * Math.min(t, 1) });
  } else {
    for (let t = dt; t <= dauer + 1e-6; t += dt){
      const boden = y <= BALL_R + 0.004 && Math.abs(vy) < 0.25;
      if (!boden) vy -= GRAV * dt;
      const sp = Math.hypot(vx, vy, vz), k = Math.max(0, 1 - LUFT * sp * dt);
      vx *= k; vy *= k; vz *= k;
      if (boden){
        vy = 0; y = BALL_R;
        const hs = Math.hypot(vx, vz);
        if (hs > 0){ const f = Math.max(0, hs - (ROLL_A + ROLL_B * hs) * dt) / hs; vx *= f; vz *= f; }
      }
      x += vx * dt; y += vy * dt; z += vz * dt;
      if (y < BALL_R){ y = BALL_R; vy = vy < -1.6 ? -vy * 0.5 : 0; vx *= 0.86; vz *= 0.86; }
      p.push({ t, x, y, z });
    }
  }
  vorhersage.zeit = jetzt;
  return p;
}

/* ---------- Dosierung ---------- */
// Rollstrecke, bis der Ball von v0 auf vEnde abgebremst ist
function rollWeg(v0, vEnde){
  let v = v0, s = 0, t = 0;
  const h = 1 / 60;
  while (v > vEnde && t < 10){ v -= (ROLL_A + ROLL_B * v + LUFT * v * v) * h; s += Math.max(v, 0) * h; t += h; }
  return { s, t };
}
// Anfangstempo für einen flachen Pass über d Meter, der mit etwa vEnde ankommt
function passTempo(d, vEnde = 5){
  let lo = vEnde, hi = 36;
  for (let i = 0; i < 18; i++){ const m = (lo + hi) / 2; if (rollWeg(m, vEnde).s < d) lo = m; else hi = m; }
  return hi;
}
// Flug in der Ebene (Strecke s, Höhe y) mit Luftwiderstand
function flug(v, winkel, y0, d){
  let vs = v * Math.cos(winkel), vy = v * Math.sin(winkel), s = 0, y = y0, t = 0;
  const h = 1 / 90;
  while (s < d && t < 6){
    const sp = Math.hypot(vs, vy), k = Math.max(0, 1 - LUFT * sp * h);
    vs *= k; vy = vy * k - GRAV * h;
    s += vs * h; y += vy * h; t += h;
    if (y < BALL_R && vy < 0) return { gelandet:true, s, y:BALL_R, t };
  }
  return { gelandet:false, s, y, t };
}
// Heber: Tempo, damit der Ball bei gegebenem Winkel nach d Metern landet
function heberTempo(d, winkel, y0 = BALL_R){
  let lo = 3, hi = 40;
  for (let i = 0; i < 18; i++){ const m = (lo + hi) / 2; const f = flug(m, winkel, y0, 999); if (f.s < d) lo = m; else hi = m; }
  return hi;
}
// Schuss: flachster Abschusswinkel, mit dem der Ball bei Tempo v nach d Metern die Höhe yZiel hat
function schussWinkel(v, d, yZiel, y0 = BALL_R){
  let lo = -0.12, hi = 0.9;
  for (let i = 0; i < 18; i++){
    const m = (lo + hi) / 2, f = flug(v, m, y0, d);
    const y = f.gelandet ? BALL_R - (d - f.s) * 0.05 : f.y;
    if (y < yZiel) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
// Tempo-Vektor aus Richtung (dx,dz), Tempo und Abschusswinkel
function schussVektor(dx, dz, v, winkel){
  const l = Math.hypot(dx, dz) || 1;
  const vh = v * Math.cos(winkel);
  return { vx:dx / l * vh, vy:v * Math.sin(winkel), vz:dz / l * vh };
}
