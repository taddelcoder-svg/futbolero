'use strict';
// Futbolero – Spielerfiguren aus einfachen Formen, mit Lauf-, Schuss-, Grätschen-, Hecht- und Jubelhaltung.
// Das Modell schaut nach lokal +z; die Blickrichtung „dir“ im Spiel ist ein Winkel in der x/z-Ebene.

const FIG = {};
function figurGeometrien(){
  if (FIG.rumpf) return;
  FIG.rumpf = new THREE.CylinderGeometry(0.22, 0.18, 0.54, 10); FIG.rumpf.scale(1, 1, 0.62);
  FIG.hose = new THREE.CylinderGeometry(0.19, 0.2, 0.24, 10); FIG.hose.scale(1, 1, 0.7);
  FIG.bein = new THREE.CylinderGeometry(0.075, 0.058, 0.5, 8); FIG.bein.translate(0, -0.25, 0);
  FIG.stutzen = new THREE.CylinderGeometry(0.062, 0.055, 0.44, 8); FIG.stutzen.translate(0, -0.22, 0);
  FIG.schuh = new THREE.BoxGeometry(0.11, 0.08, 0.25); FIG.schuh.translate(0, -0.04, 0.05);
  FIG.arm = new THREE.CylinderGeometry(0.058, 0.05, 0.3, 8); FIG.arm.translate(0, -0.15, 0);
  FIG.unterarm = new THREE.CylinderGeometry(0.046, 0.04, 0.3, 8); FIG.unterarm.translate(0, -0.15, 0);
  FIG.hand = new THREE.SphereGeometry(0.05, 8, 6);
  FIG.handschuh = new THREE.SphereGeometry(0.075, 8, 6);
  FIG.kopf = new THREE.SphereGeometry(0.13, 14, 10);
  FIG.hals = new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8);
  FIG.haare = [
    new THREE.SphereGeometry(0.137, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)
  ];
  FIG.nummer = new THREE.PlaneGeometry(0.24, 0.24);
  FIG.material = {};
}
const HAUT = ['#f1c7a5', '#e0b08a', '#c68a5e', '#8d5a3b', '#5e3a24'];
const HAARFARBEN = ['#1f1611', '#3a2618', '#6b4526', '#b98b4e', '#d9c08c', '#101010'];

function mat(farbe){
  const k = 'm' + farbe;
  if (!FIG.material[k]) FIG.material[k] = new THREE.MeshLambertMaterial({ color:farbe });
  return FIG.material[k];
}

function nummernTextur(n, farbe){
  const c = leinwand(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = farbe;
    g.font = '800 50px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), w / 2, h / 2 + 3);
  });
  return new THREE.MeshLambertMaterial({ map:new THREE.CanvasTexture(c), transparent:true, alphaTest:0.3 });
}

// Baut eine Figur. kit: { trikot, hose, stutzen, nummer }, torwart: eigene Trikotfarbe
function figurBauen(kit, nummer, istTorwart, torwartFarbe){
  figurGeometrien();
  const trikot = mat(istTorwart ? torwartFarbe : kit.trikot);
  const hose = mat(istTorwart ? '#1d2127' : kit.hose);
  const stutzen = mat(istTorwart ? torwartFarbe : kit.stutzen);
  const haut = mat(zufallAus(HAUT));
  const haar = mat(zufallAus(HAARFARBEN));
  const schuh = mat(zufallAus(['#111111', '#f4f4f4', '#ff4d4d', '#2d6cdf', '#ffd84a']));

  const wurzel = new THREE.Group();          // steht auf dem Boden, dreht sich in Blickrichtung
  const koerper = new THREE.Group();         // Drehpunkt in der Hüfte
  koerper.position.y = 0.94;
  wurzel.add(koerper);
  const teile = [];
  const mesh = (geo, m, eltern, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; eltern.add(o); teile.push(o); return o;
  };
  mesh(FIG.hose, hose, koerper, 0, 0.02, 0);
  const oben = new THREE.Group(); oben.position.y = 0.1; koerper.add(oben);   // Oberkörper (kann sich neigen)
  mesh(FIG.rumpf, trikot, oben, 0, 0.3, 0);
  mesh(FIG.hals, haut, oben, 0, 0.61, 0);
  const kopf = mesh(FIG.kopf, haut, oben, 0, 0.74, 0);
  const frisur = mesh(zufallAus(FIG.haare), haar, kopf, 0, 0.02, -0.01);
  frisur.rotation.x = -0.25;
  const nr = new THREE.Mesh(FIG.nummer, nummernTextur(nummer, istTorwart ? '#ffffff' : kit.nummer));
  nr.position.set(0, 0.34, -0.118); nr.rotation.y = Math.PI;
  oben.add(nr);

  const arme = [], beine = [];
  for (const seite of [-1, 1]){
    const schulter = new THREE.Group(); schulter.position.set(seite * 0.25, 0.53, 0); oben.add(schulter);
    mesh(FIG.arm, trikot, schulter);
    const ellbogen = new THREE.Group(); ellbogen.position.y = -0.3; schulter.add(ellbogen);
    mesh(FIG.unterarm, istTorwart ? trikot : haut, ellbogen);
    mesh(istTorwart ? FIG.handschuh : FIG.hand, istTorwart ? mat('#f4f4f4') : haut, ellbogen, 0, -0.32, 0);
    arme.push({ schulter, ellbogen });

    const huefte = new THREE.Group(); huefte.position.set(seite * 0.1, -0.02, 0); koerper.add(huefte);
    mesh(FIG.bein, haut, huefte);
    const knie = new THREE.Group(); knie.position.y = -0.47; huefte.add(knie);
    mesh(FIG.stutzen, stutzen, knie);
    mesh(FIG.schuh, schuh, knie, 0, -0.42, 0);
    beine.push({ huefte, knie });
  }
  return { wurzel, koerper, oben, kopf, arme, beine };
}

// Haltung aus dem Zustand „h“ setzen. h: { x, y, z, dreh, lauf, tempo, schussT, graetscheT, hechtT, hechtSeite,
// jubel, halten, einwurf, fallT, kopfT } – dieselben Felder speichert die Wiederholung.
function haltungSetzen(f, h, zeit){
  f.wurzel.position.set(h.x, h.y || 0, h.z);
  f.wurzel.rotation.set(0, Math.PI / 2 - h.dreh, 0);
  const K = f.koerper, O = f.oben, [aL, aR] = f.arme, [bL, bR] = f.beine;
  // Grundhaltung
  K.position.set(0, 0.94, 0); K.rotation.set(0, 0, 0); O.rotation.set(0, 0, 0);
  for (const a of f.arme){ a.schulter.rotation.set(0, 0, 0); a.ellbogen.rotation.set(0, 0, 0); }
  for (const b of f.beine){ b.huefte.rotation.set(0, 0, 0); b.knie.rotation.set(0, 0, 0); }
  aL.schulter.rotation.z = -0.12; aR.schulter.rotation.z = 0.12;

  if (h.hechtT > 0){
    // Torwart fliegt zur Seite (Seite +1 = lokal +x)
    const t = clamp(h.hechtT, 0, 1), s = h.hechtSeite || 1;
    const flug = Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5);
    K.rotation.z = -s * flug * 1.35;
    K.position.y = 0.94 - flug * 0.45 + Math.sin(t * Math.PI) * 0.35;
    K.position.x = s * flug * 0.5;
    for (const a of f.arme){ a.schulter.rotation.x = -2.9 * flug; a.schulter.rotation.z = s * 0.2; }
    bL.huefte.rotation.x = -0.3 * flug; bR.huefte.rotation.x = 0.25 * flug; bL.knie.rotation.x = 0.5;
    return;
  }
  if (h.graetscheT > 0){
    const t = clamp(h.graetscheT, 0, 1);
    const tief = Math.sin(Math.min(1, t * 3) * Math.PI * 0.5);
    K.position.y = 0.94 - tief * 0.62;
    K.rotation.x = -tief * 1.05;
    bR.huefte.rotation.x = -1.35 * tief; bL.huefte.rotation.x = -0.4 * tief; bL.knie.rotation.x = 1.1 * tief;
    aL.schulter.rotation.x = 0.6 * tief; aR.schulter.rotation.x = 0.6 * tief;
    aL.schulter.rotation.z = -0.9 * tief; aR.schulter.rotation.z = 0.9 * tief;
    return;
  }
  if (h.fallT > 0){
    const t = clamp(h.fallT, 0, 1);
    const unten = Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) * (t < 0.75 ? 1 : (1 - t) * 4);
    K.position.y = 0.94 - unten * 0.7;
    K.rotation.x = unten * 1.3;
    aL.schulter.rotation.x = -1.4 * unten; aR.schulter.rotation.x = -1.2 * unten;
    bL.knie.rotation.x = 0.9 * unten; bR.knie.rotation.x = 0.5 * unten;
    return;
  }

  const tempo = clamp(h.tempo || 0, 0, 1.3);
  const p = h.lauf || 0, a = Math.min(1, tempo) * 0.85;
  const sn = Math.sin(p);
  bL.huefte.rotation.x = sn * a; bR.huefte.rotation.x = -sn * a;
  bL.knie.rotation.x = Math.max(0, -Math.cos(p)) * a * 1.25 + 0.05;
  bR.knie.rotation.x = Math.max(0, Math.cos(p)) * a * 1.25 + 0.05;
  aL.schulter.rotation.x = -sn * a * 0.9; aR.schulter.rotation.x = sn * a * 0.9;
  aL.ellbogen.rotation.x = -0.4 - a * 0.7; aR.ellbogen.rotation.x = -0.4 - a * 0.7;
  K.position.y = 0.94 + Math.abs(Math.cos(p)) * 0.06 * a - 0.03 * a;
  O.rotation.x = 0.1 + tempo * 0.16;
  if (tempo < 0.08){
    const atem = Math.sin(zeit * 2.2 + (h.x + h.z)) * 0.02;
    O.rotation.x = 0.04 + atem;
    aL.ellbogen.rotation.x = aR.ellbogen.rotation.x = -0.25;
  }

  if (h.schussT > 0){
    // 1 → 0: ausholen, dann durchziehen (rechtes Bein)
    const k = 1 - clamp(h.schussT, 0, 1);
    const w = k < 0.35 ? lerp(0, 1.0, k / 0.35) : lerp(1.0, -1.5, Math.min(1, (k - 0.35) / 0.4));
    bR.huefte.rotation.x = w;
    bR.knie.rotation.x = k < 0.35 ? 1.2 * k / 0.35 : Math.max(0, 1.2 - (k - 0.35) * 5);
    bL.huefte.rotation.x = 0.15; bL.knie.rotation.x = 0.2;
    aL.schulter.rotation.z = -0.9; aR.schulter.rotation.z = 0.5; aL.schulter.rotation.x = -0.4;
    O.rotation.x = k < 0.35 ? -0.1 : 0.25;
  }
  if (h.kopfT > 0){
    const k = clamp(h.kopfT, 0, 1);
    O.rotation.x = -0.4 + (1 - k) * 0.8;
    aL.schulter.rotation.z = -0.8; aR.schulter.rotation.z = 0.8;
  }
  if (h.halten){
    aL.schulter.rotation.x = aR.schulter.rotation.x = -1.2;
    aL.ellbogen.rotation.x = aR.ellbogen.rotation.x = -0.9;
    aL.schulter.rotation.z = 0.25; aR.schulter.rotation.z = -0.25;
  }
  if (h.einwurf){
    aL.schulter.rotation.x = aR.schulter.rotation.x = h.einwurf > 1 ? -2.2 : 3.0;
    aL.ellbogen.rotation.x = aR.ellbogen.rotation.x = -0.6;
  }
  if (h.jubel){
    aL.schulter.rotation.x = aR.schulter.rotation.x = 3.0;
    aL.schulter.rotation.z = -0.35; aR.schulter.rotation.z = 0.35;
    aL.ellbogen.rotation.x = aR.ellbogen.rotation.x = 0;
  }
}

/* ---------- Markierungen: gesteuerter Spieler, Passempfänger ---------- */
function markierungenBauen(){
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0xffd84a, transparent:true, opacity:0.9, depthWrite:false }));
  ring.position.y = 0.02;
  const pfeil = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 3).rotateX(Math.PI),
    new THREE.MeshBasicMaterial({ color:0xffd84a, fog:false }));
  const richtung = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 3).rotateX(Math.PI / 2).rotateY(0),
    new THREE.MeshBasicMaterial({ color:0xffd84a, transparent:true, opacity:0.85, depthWrite:false }));
  richtung.scale.y = 0.2;
  const empfaenger = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, depthWrite:false }));
  empfaenger.position.y = 0.02;
  szene.add(ring, pfeil, richtung, empfaenger);
  return { ring, pfeil, richtung, empfaenger };
}
