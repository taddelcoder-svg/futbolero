'use strict';
// Futbolero – Effekte: Staub und Grasfetzen beim Laufen und Grätschen, Schussspur, Funken am Pfosten,
// Konfetti und Feuerwerk beim Torjubel. Alles läuft über drei kleine Partikel-Pools (je ein Zeichenaufruf).
// Die Effekte lesen nur Positionen aus der Szene (Ball, Figuren) – die Spiellogik bleibt unberührt.

const FX = { staub:null, glanz:null, gras:null, dichte:1, ball:null, jubelAlt:0, regen:0, regenX:0, regenZ:0, regenFarben:null, feuer:0, takt:0 };

function partikelPool(kapazitaet, additiv, hart){
  const n = kapazitaet;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), farbe = new Float32Array(n * 4), groesse = new Float32Array(n), winkel = new Float32Array(n);
  const attr = (a, s, name) => { const b = new THREE.BufferAttribute(a, s); b.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, b); return b; };
  const aPos = attr(pos, 3, 'position'), aCol = attr(farbe, 4, 'col'), aSize = attr(groesse, 1, 'size'), aAng = attr(winkel, 1, 'ang');
  const mat = new THREE.ShaderMaterial({
    uniforms:{ uScale:{ value:600 }, uHart:{ value:hart ? 1 : 0 } },
    vertexShader:`
      attribute vec4 col; attribute float size; attribute float ang;
      uniform float uScale; varying vec4 vC; varying float vA;
      void main(){
        vC = col; vA = ang;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size * uScale / max(0.1, -mv.z), 0.0, 120.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader:`
      uniform float uHart; varying vec4 vC; varying float vA;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float a;
        if (uHart > 0.5){
          float c = cos(vA), s = sin(vA);
          p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
          a = step(abs(p.x), 0.46) * step(abs(p.y), 0.3);
        } else {
          a = smoothstep(0.5, 0.08, length(p));
        }
        if (a < 0.01) discard;
        gl_FragColor = vec4(vC.rgb, vC.a * a);
      }`,
    transparent:true, depthWrite:false, fog:false,
    blending:additiv ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const punkte = new THREE.Points(geo, mat);
  punkte.frustumCulled = false;
  punkte.renderOrder = 5;
  szene.add(punkte);
  const P = {
    n, punkte, mat, cursor:0, lebend:0, hart,
    leben:new Float32Array(n), max:new Float32Array(n), vx:new Float32Array(n), vy:new Float32Array(n), vz:new Float32Array(n),
    s0:new Float32Array(n), s1:new Float32Array(n), r:new Float32Array(n), g:new Float32Array(n), b:new Float32Array(n), a:new Float32Array(n),
    grav:new Float32Array(n), drag:new Float32Array(n), spin:new Float32Array(n), schweb:new Float32Array(n),
    neu(x, y, z, vx, vy, vz, leben, s0, s1, r, g, b, a, grav = 0, drag = 0, spin = 0, schweb = 0){
      const i = P.cursor; P.cursor = (i + 1) % n;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz; P.leben[i] = P.max[i] = leben; P.s0[i] = s0; P.s1[i] = s1;
      P.r[i] = r; P.g[i] = g; P.b[i] = b; P.a[i] = a; P.grav[i] = grav; P.drag[i] = drag; P.spin[i] = spin; P.schweb[i] = schweb;
      winkel[i] = hart ? Math.random() * 6.28 : 0;
    },
    schritt(dt, zeit){
      let lebend = 0;
      for (let i = 0; i < n; i++){
        if (P.leben[i] <= 0){ if (groesse[i] !== 0){ groesse[i] = 0; farbe[i * 4 + 3] = 0; } continue; }
        P.leben[i] -= dt;
        const t = 1 - Math.max(0, P.leben[i]) / P.max[i];
        P.vy[i] -= P.grav[i] * dt;
        if (P.drag[i] > 0){ const k = Math.exp(-P.drag[i] * dt); P.vx[i] *= k; P.vy[i] *= k; P.vz[i] *= k; }
        let y = pos[i * 3 + 1] + P.vy[i] * dt;
        if (y < 0.03 && P.grav[i] > 0){ y = 0.03; P.vx[i] = P.vy[i] = P.vz[i] = 0; P.schweb[i] = 0; P.spin[i] = 0; if (hart) P.leben[i] -= dt * 1.5; }
        pos[i * 3] += P.vx[i] * dt + (P.schweb[i] ? Math.sin(zeit * 3 + winkel[i] * 5) * P.schweb[i] * dt : 0);
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] += P.vz[i] * dt + (P.schweb[i] ? Math.cos(zeit * 2.6 + winkel[i] * 3) * P.schweb[i] * dt : 0);
        winkel[i] += P.spin[i] * dt;
        let s = P.s0[i] + (P.s1[i] - P.s0[i]) * t;
        if (hart && P.spin[i] !== 0) s *= 0.45 + 0.55 * Math.abs(Math.cos(winkel[i] * 1.7));
        groesse[i] = s;
        const f = hart ? Math.min(1, t * 12) * Math.min(1, (1 - t) / 0.25) : Math.min(1, t * 9) * (1 - t) * (1 - t) * 1.6;
        farbe[i * 4] = P.r[i]; farbe[i * 4 + 1] = P.g[i]; farbe[i * 4 + 2] = P.b[i]; farbe[i * 4 + 3] = P.a[i] * Math.min(1, f);
        lebend++;
      }
      if (lebend || P.lebend){
        aPos.needsUpdate = aCol.needsUpdate = aSize.needsUpdate = aAng.needsUpdate = true;
      }
      P.lebend = lebend;
    }
  };
  return P;
}

function effekteBauen(){
  FX.staub = partikelPool(360, false, false);
  FX.glanz = partikelPool(520, true, false);
  FX.gras = partikelPool(520, false, true);
  // Funken, wenn der Ball Pfosten oder Latte trifft
  const orig = Ton.pfosten;
  Ton.pfosten = (...a) => { try { funkenSprueher(Welt.ball.position.x, Welt.ball.position.y, Welt.ball.position.z, 16, 0xfff2c4); } catch (e) { /* Effekt ist nur Zierde */ } return orig(...a); };
}

const rnd = (a, b) => a + Math.random() * (b - a);
const farbeRGB = (() => { const c = new THREE.Color(); return hex => { c.set(hex); return [c.r, c.g, c.b]; }; })();

// Untergrund-Farbe für Staub je nach Spielort
function staubFarbe(){
  if (ARENA.art === 'strasse') return [0.72, 0.68, 0.6];
  if (ARENA.art === 'halle') return [0.85, 0.88, 0.95];
  return [0.64, 0.78, 0.5];
}

function funkenSprueher(x, y, z, anzahl, farbe){
  const [r, g, b] = farbeRGB(farbe);
  const n = Math.round(anzahl * FX.dichte);
  for (let i = 0; i < n; i++){
    const a = rnd(0, 6.28), e = rnd(-0.3, 1), v = rnd(2, 7);
    FX.glanz.neu(x, y, z, Math.cos(a) * v * (1 - e * 0.3), 2 + e * 4, Math.sin(a) * v * (1 - e * 0.3), rnd(0.25, 0.55), 0.22, 0.05, r, g, b, 0.9, 9, 0.6);
  }
  FX.glanz.neu(x, y, z, 0, 0, 0, 0.18, 1.1, 1.6, r, g, b, 0.55);
}

function feuerwerk(x, y, z, farbe){
  const [r, g, b] = farbeRGB(farbe);
  const n = Math.round(46 * FX.dichte);
  for (let i = 0; i < n; i++){
    const u = rnd(-1, 1), a = rnd(0, 6.28), q = Math.sqrt(1 - u * u), v = rnd(8, 12);
    FX.glanz.neu(x, y, z, Math.cos(a) * q * v, u * v, Math.sin(a) * q * v, rnd(1.2, 1.9), 0.9, 0.18, r, g, b, 0.95, 4.2, 1.5);
  }
  FX.glanz.neu(x, y, z, 0, 0, 0, 0.35, 4, 9, 1, 0.95, 0.8, 0.5);
}

function konfettiStreuen(cx, cz, anzahl, farben, breite = 16, hoehe = 11){
  const n = Math.round(anzahl * FX.dichte);
  for (let i = 0; i < n; i++){
    const f = farben[(Math.random() * farben.length) | 0];
    FX.gras.neu(cx + rnd(-breite, breite), rnd(hoehe * 0.7, hoehe), cz + rnd(-breite * 0.7, breite * 0.7),
      rnd(-1, 1), rnd(-1.5, 0.5), rnd(-1, 1), rnd(3.5, 5.5), 0.34, 0.34, f[0], f[1], f[2], 1, 2.2, 0.9, rnd(4, 9), rnd(0.8, 2));
  }
}

// Konfettikanone am Spielfeldrand: schießt eine Fontäne schräg nach oben ins Feld
function konfettiKanone(x, z, richtung, farben){
  const n = Math.round(46 * FX.dichte);
  for (let i = 0; i < n; i++){
    const f = farben[(Math.random() * farben.length) | 0];
    FX.gras.neu(x + rnd(-0.4, 0.4), 0.6, z, rnd(-3, 3), rnd(11, 19), richtung * rnd(1, 6), rnd(2.6, 4.2), 0.3, 0.3, f[0], f[1], f[2], 1, 8, 0.7, rnd(5, 11), rnd(0.5, 1.4));
  }
  FX.glanz.neu(x, 0.8, z, 0, 0, 0, 0.3, 1.5, 3.2, 1, 0.9, 0.6, 0.5);
}

function effekteSchritt(dt, zeit){
  if (!FX.staub || !(dt > 0)) return;
  const hoch = einstellungen.qualitaet === 'hoch';
  FX.dichte = hoch ? 1 : 0.5;
  const scale = innerHeight * 0.5 / Math.tan(kamera.fov * Math.PI / 360);
  FX.staub.mat.uniforms.uScale.value = FX.glanz.mat.uniforms.uScale.value = FX.gras.mat.uniforms.uScale.value = scale * (renderer.getPixelRatio() || 1);

  const bp = Welt.ball.position;
  const sf = staubFarbe();
  // Ball: Schussspur, Tritte, Aufsetzer
  const B = FX.ball;
  if (B){
    const dx = bp.x - B.x, dy = bp.y - B.y, dz = bp.z - B.z, dist = Math.hypot(dx, dy, dz), v = dist / dt;
    if (dist < 4){
      if (v > 13 && FX.dichte){
        const heftig = Math.min(1, (v - 13) / 14);
        const k = Math.min(12, Math.max(1, Math.ceil(dist / 0.3)));
        for (let i = 0; i < k; i++){
          const t = (i + Math.random()) / k;
          FX.glanz.neu(B.x + dx * t, B.y + dy * t, B.z + dz * t, 0, 0, 0, 0.32, 0.6 + heftig * 0.3, 0.08, 1, 0.97 - heftig * 0.12, 0.85 - heftig * 0.2, 0.55 + heftig * 0.3);
        }
      }
      // Tritt: der Ball wird plötzlich viel schneller, nah am Boden
      if (v - B.v > 8 && bp.y < 0.6 && ARENA.art !== 'halle') staubWolke(bp.x, 0.08, bp.z, dx / dt, dz / dt, 5, sf);
      // Aufsetzer
      if (B.vy < -3.5 && bp.y < BALL_R + 0.04 && ARENA.art !== 'halle') staubWolke(bp.x, 0.08, bp.z, 0, 0, 6, sf);
      B.vy = dy / dt;
    } else B.vy = 0;
    B.v = dist < 4 ? v : 0;
    B.x = bp.x; B.y = bp.y; B.z = bp.z;
  } else FX.ball = { x:bp.x, y:bp.y, z:bp.z, v:0, vy:0 };

  // Figuren: Staubwölkchen unter schnellen Füßen, Grassoden beim Grätschen
  FX.takt += dt;
  const alle = spiel.alle || [];
  for (const p of alle){
    const w = p.figur.wurzel.position;
    let f = p.fx;
    if (!f){ p.fx = f = { x:w.x, z:w.z, zeit:0 }; continue; }
    const vx = (w.x - f.x) / dt, vz = (w.z - f.z) / dt, sp = Math.hypot(vx, vz);
    const teleport = Math.hypot(w.x - f.x, w.z - f.z) > 2;
    f.x = w.x; f.z = w.z;
    if (teleport || !p.figur.wurzel.visible || w.y > 0.1) continue;
    const graetsche = p.graetsche > 0 && sp > 3;
    if (graetsche || sp > 4.2){
      f.zeit -= dt;
      if (f.zeit <= 0){
        f.zeit = graetsche ? 0.035 : 0.13 / Math.min(2, sp / 5);
        if (ARENA.art !== 'halle') staubWolke(w.x - vx * 0.03, 0.06, w.z - vz * 0.03, vx * 0.15, vz * 0.15, graetsche ? 3 : 1, sf, graetsche ? 1.7 : 1);
      }
    }
  }

  // Jubel: Konfetti und Feuerwerk, sobald der Jubel neu startet
  if (Fans.jubelZeit > FX.jubelAlt + 1.5){
    const team = spiel.teams && spiel.teams[Fans.jubelTeam];
    const kit = team && team.kit;
    const farben = [farbeRGB(kit ? kit.trikot : '#ffd84a'), farbeRGB(kit ? kit.hose : '#ffffff'), farbeRGB('#ffffff'), farbeRGB('#ffd84a'), farbeRGB(kit ? kit.stutzen : '#ff5fa2')];
    FX.regenFarben = farben;
    FX.regenX = Math.abs(bp.x) > HL - 16 ? Math.sign(bp.x) * (HL - 10) : 0;
    FX.regenZ = clamp(bp.z, -8, 8);
    FX.regen = 2.6;
    FX.feuer = ARENA.art === 'halle' ? 0 : 2.2;
    FX.feuerFarben = [kit ? kit.trikot : '#ffd84a', '#ffffff', '#ffd84a'];
    konfettiStreuen(FX.regenX, FX.regenZ, 70, farben, 14, 9);
    if (ARENA.art !== 'strasse') for (const z of [-HB + 1, HB - 1]) konfettiKanone(FX.regenX, z, -Math.sign(z), farben);
  }
  FX.jubelAlt = Fans.jubelZeit;
  if (FX.regen > 0){
    FX.regen -= dt;
    konfettiStreuen(FX.regenX, FX.regenZ, 52 * dt, FX.regenFarben, 17, 12);
  }
  if (FX.feuer > 0){
    const vor = FX.feuer; FX.feuer -= dt;
    if (Math.floor(vor / 0.45) !== Math.floor(FX.feuer / 0.45)){
      feuerwerk(FX.regenX * 0.5 + rnd(-24, 24), rnd(11, 19), rnd(-16, 6), zufallAus(FX.feuerFarben));
    }
  }

  FX.staub.schritt(dt, zeit); FX.glanz.schritt(dt, zeit); FX.gras.schritt(dt, zeit);
}

// Eine kleine Staubwolke samt Grasfetzen (nur im Stadion)
function staubWolke(x, y, z, vx, vz, anzahl, farbe, groesse = 1){
  const n = Math.max(1, Math.round(anzahl * FX.dichte));
  for (let i = 0; i < n; i++){
    FX.staub.neu(x + rnd(-0.15, 0.15), y, z + rnd(-0.15, 0.15), vx * 0.12 + rnd(-0.5, 0.5), rnd(0.3, 1.1), vz * 0.12 + rnd(-0.5, 0.5),
      rnd(0.45, 0.85), 0.28 * groesse, 0.95 * groesse, farbe[0], farbe[1], farbe[2], 0.3, 0.2, 1.4);
  }
  if (ARENA.art === 'stadion' && anzahl >= 3){
    const m = Math.max(1, Math.round(anzahl * 0.8 * FX.dichte));
    for (let i = 0; i < m; i++){
      FX.gras.neu(x, y + 0.1, z, vx * 0.25 + rnd(-1.4, 1.4), rnd(1.6, 3.6), vz * 0.25 + rnd(-1.4, 1.4), rnd(0.5, 0.9), 0.09, 0.07, 0.2, rnd(0.45, 0.62), 0.16, 1, 11, 0.3, rnd(5, 12));
    }
  }
}
