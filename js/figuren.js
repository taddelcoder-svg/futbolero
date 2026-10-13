'use strict';
// Futbolero – Spielerfiguren aus einfachen Formen, mit Lauf-, Schuss-, Grätschen-, Hecht- und Jubelhaltung.
// Das Modell schaut nach lokal +z; die Blickrichtung „dir“ im Spiel ist ein Winkel in der x/z-Ebene.

const FIG = {};
// Mehrere Geometrien zu einer verschmelzen; jede bekommt eine Eckfarbe (wird mit der Materialfarbe malgenommen)
function geoVerbinden(teile){
  const pos = [], nor = [], col = [];
  for (const [g, farbe] of teile){
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array);
    for (let i = 0; i < n.attributes.position.count; i++) col.push(farbe[0], farbe[1], farbe[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
// Teile mit Zonenmarke verschmelzen: zone 0 → untere, zone 1 → obere Farbe der Zwei-Farben-Textur (siehe zweiFarben)
function zonenVerbinden(teile){
  const pos = [], nor = [], uv = [];
  for (const [g, zone] of teile){
    const n = g.index ? g.toNonIndexed() : g;
    pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array);
    for (let i = 0; i < n.attributes.position.count; i++) uv.push(0.5, zone ? 0.75 : 0.25);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}
// Material aus zwei Farben (2×2-Pixel-Textur, ohne Filter): spart Meshes, weil zwei Farben in einem Teil sitzen
function zweiFarben(unten, oben){
  const k = 'zf' + unten + oben;
  if (FIG.material[k]) return FIG.material[k];
  const a = new THREE.Color(unten), b = new THREE.Color(oben);
  const px = c => [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255];
  const data = new Uint8Array([...px(a), ...px(a), ...px(b), ...px(b)]);
  const t = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return FIG.material[k] = new THREE.MeshLambertMaterial({ map:t });
}
function figurGeometrien(){
  if (FIG.rumpf) return;
  FIG.rumpf = new THREE.CylinderGeometry(0.235, 0.185, 0.56, 14, 1); FIG.rumpf.scale(1, 1, 0.6);
  FIG.hose = new THREE.CylinderGeometry(0.2, 0.215, 0.2, 12); FIG.hose.scale(1, 1, 0.7);
  // Bein: Hosenbein (oben) und Haut (unten); Stutzen mit Bund (oben); Arm mit Schulter; Unterarm mit Hand
  const hosenbein = new THREE.CylinderGeometry(0.098, 0.112, 0.25, 9); hosenbein.translate(0, -0.09, 0);
  const haut = new THREE.CylinderGeometry(0.072, 0.056, 0.5, 8); haut.translate(0, -0.25, 0);
  FIG.bein = zonenVerbinden([[haut, 0], [hosenbein, 1]]);
  const stutzen = new THREE.CylinderGeometry(0.063, 0.054, 0.44, 8); stutzen.translate(0, -0.22, 0);
  const bund = new THREE.CylinderGeometry(0.066, 0.064, 0.05, 8); bund.translate(0, -0.1, 0);
  FIG.stutzen = zonenVerbinden([[stutzen, 0], [bund, 1]]);
  FIG.knie = new THREE.SphereGeometry(0.062, 8, 6);
  // Schuh: Schaft (Ellipsoid, helle Eckfarbe) plus dunkle Sohle in einem Stück
  const schaft = new THREE.SphereGeometry(0.5, 10, 7); schaft.scale(0.115, 0.085, 0.29); schaft.translate(0, 0.045, 0.06);
  const sohle = new THREE.BoxGeometry(0.118, 0.022, 0.29); sohle.translate(0, 0.011, 0.06);
  FIG.schuh = geoVerbinden([[schaft, [1, 1, 1]], [sohle, [0.12, 0.12, 0.13]]]); FIG.schuh.translate(0, -0.085, 0);
  const arm = new THREE.CylinderGeometry(0.062, 0.054, 0.3, 8); arm.translate(0, -0.15, 0);
  FIG.arm = geoVerbinden([[arm, [1, 1, 1]], [new THREE.SphereGeometry(0.074, 8, 6), [1, 1, 1]]]);
  const unterarm = new THREE.CylinderGeometry(0.046, 0.04, 0.3, 8); unterarm.translate(0, -0.15, 0);
  FIG.unterarm = zonenVerbinden([[unterarm, 1], [new THREE.SphereGeometry(0.05, 8, 6).translate(0, -0.32, 0), 0]]);
  FIG.unterarmTW = zonenVerbinden([[unterarm, 1], [new THREE.SphereGeometry(0.078, 8, 6).translate(0, -0.32, 0), 0]]);
  FIG.kopf = new THREE.SphereGeometry(0.135, 16, 12);
  FIG.hals = new THREE.CylinderGeometry(0.05, 0.058, 0.1, 8);
  FIG.haare = [
    new THREE.SphereGeometry(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.SphereGeometry(0.145, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)
  ];
  FIG.nummer = new THREE.PlaneGeometry(0.26, 0.26);
  FIG.blob = new THREE.PlaneGeometry(1.15, 1.15).rotateX(-Math.PI / 2);
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
    g.font = '800 50px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // Heller Rand, damit die Nummer auf jedem Trikot lesbar bleibt
    g.lineJoin = 'round'; g.lineWidth = 5;
    g.strokeStyle = farbAbstand(farbe, '#000000') < 0.6 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.45)';
    g.strokeText(String(n), w / 2, h / 2 + 3);
    g.fillStyle = farbe;
    g.fillText(String(n), w / 2, h / 2 + 3);
  });
  return new THREE.MeshLambertMaterial({ map:new THREE.CanvasTexture(c), transparent:true, alphaTest:0.3 });
}

// Trikotstoff: Verlauf, feines Gewebe, Muster je nach Mannschaft (Streifen, Ringe, Brustband), Kragen und Saum.
// Der Zylinder-Rumpf hat die Naht vorn in der Mitte (u = 0 / 1), das Bild ist dort symmetrisch.
function trikotStoff(farbe, akzent, torwart){
  const k = 'trikot' + farbe + akzent + (torwart ? 'T' : '');
  if (FIG.material[k]) return FIG.material[k];
  let hash = 0; for (const ch of farbe + akzent) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const muster = torwart ? 3 : hash % 4;
  const hell = new THREE.Color(farbe).offsetHSL(0, 0, 0.05).getStyle(), dunkel = new THREE.Color(farbe).offsetHSL(0, 0, -0.07).getStyle();
  const c = leinwand(128, 128, (g, w, h) => {
    g.fillStyle = farbe; g.fillRect(0, 0, w, h);
    if (muster === 0){            // senkrechte Streifen im Ton
      for (let x = 0; x <= w; x += 16){ g.fillStyle = dunkel; g.fillRect(x - 4, 0, 8, h); }
    } else if (muster === 1){     // Ringe
      for (let y = 6; y < h; y += 28){ g.fillStyle = dunkel; g.fillRect(0, y, w, 14); }
    } else if (muster === 2){     // Brustband in der Zweitfarbe
      g.fillStyle = akzent; g.globalAlpha = 0.92; g.fillRect(0, 40, w, 18); g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 58, w, 2);
    }
    // Gewebe-Rauschen
    for (let i = 0; i < 900; i++){ g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    // Licht- und Schattenverlauf: seitlich dunkler, oben etwas heller
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, 'rgba(255,255,255,.14)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,.16)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    const sg = g.createLinearGradient(0, 0, w, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.25, 'rgba(0,0,0,.14)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(0.75, 'rgba(0,0,0,.14)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    // Saum unten, Kragen oben (v = 1 ist oben)
    g.fillStyle = akzent; g.globalAlpha = 0.85; g.fillRect(0, h - 7, w, 7); g.globalAlpha = 1;
    g.fillStyle = akzent; g.fillRect(0, 0, w, 9);
    // V-Ausschnitt vorn (Mitte und, wegen der Naht, auch an den Rändern)
    g.fillStyle = akzent;
    for (const cx of [0, w]){ g.beginPath(); g.moveTo(cx - 13, 0); g.lineTo(cx + 13, 0); g.lineTo(cx, 22); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (const cx of [0, w]){ g.beginPath(); g.moveTo(cx - 8, 0); g.lineTo(cx + 8, 0); g.lineTo(cx, 14); g.closePath(); g.fill(); }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return FIG.material[k] = new THREE.MeshLambertMaterial({ map:t });
}

// Kopf mit aufgemaltem Gesicht (Augen, Brauen, Mund) – spart eigene Teile; das Gesicht liegt bei u = 0.25 (+z)
function kopfMaterial(hautfarbe){
  const k = 'kopf' + hautfarbe;
  if (FIG.material[k]) return FIG.material[k];
  const c = leinwand(256, 128, (g, w, h) => {
    g.fillStyle = hautfarbe; g.fillRect(0, 0, w, h);
    const fx = w * 0.25;
    const dunkler = new THREE.Color(hautfarbe).offsetHSL(0, 0, -0.14).getStyle();
    g.fillStyle = 'rgba(255,80,80,.12)';                            // Wangen
    for (const s of [-1, 1]){ g.beginPath(); g.ellipse(fx + s * 17, h * 0.62, 8, 5, 0, 0, 6.3); g.fill(); }
    for (const s of [-1, 1]){
      g.fillStyle = '#f7f4ee'; g.beginPath(); g.ellipse(fx + s * 11, h * 0.55, 7, 5, 0, 0, 6.3); g.fill();
      g.fillStyle = '#2a2018'; g.beginPath(); g.arc(fx + s * 11 + 1, h * 0.55, 3.8, 0, 6.3); g.fill();
      g.strokeStyle = 'rgba(30,20,12,.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(fx + s * 4, h * 0.45); g.lineTo(fx + s * 19, h * 0.44); g.stroke();
    }
    g.fillStyle = dunkler; g.beginPath(); g.ellipse(fx, h * 0.64, 2.6, 3, 0, 0, 6.3); g.fill();      // Nase
    g.strokeStyle = 'rgba(110,40,36,.85)'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(fx - 6, h * 0.74); g.quadraticCurveTo(fx, h * 0.78, fx + 6, h * 0.74); g.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
  return FIG.material[k] = new THREE.MeshLambertMaterial({ map:t });
}

// Weicher Schatten unter den Füßen – nur im schnellen Modus sichtbar (dort gibt es keine echten Schatten)
function blobMaterial(){
  if (FIG.blobMat) return FIG.blobMat;
  const c = leinwand(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(0.55, 'rgba(0,0,0,.28)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  return FIG.blobMat = new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false });
}
function schuhMaterial(farbe){
  const k = 'schuh' + farbe;
  if (!FIG.material[k]) FIG.material[k] = new THREE.MeshLambertMaterial({ color:farbe, vertexColors:true });
  return FIG.material[k];
}

// Baut eine Figur. kit: { trikot, hose, stutzen, nummer }, torwart: eigene Trikotfarbe
function figurBauen(kit, nummer, istTorwart, torwartFarbe){
  figurGeometrien();
  const trikotFarbe = istTorwart ? torwartFarbe : kit.trikot;
  const akzent = istTorwart ? '#ffffff' : kit.nummer;
  const trikot = mat(trikotFarbe);
  const stoff = trikotStoff(trikotFarbe, akzent, istTorwart);
  const hose = mat(istTorwart ? '#1d2127' : kit.hose);
  const hautFarbe = zufallAus(HAUT);
  const beinMat = zweiFarben(hautFarbe, istTorwart ? '#1d2127' : kit.hose);
  const stutzenMat = zweiFarben(istTorwart ? torwartFarbe : kit.stutzen, istTorwart ? '#ffffff' : kit.nummer);
  const unterarmMat = istTorwart ? zweiFarben('#f4f4f4', torwartFarbe) : zweiFarben(hautFarbe, hautFarbe);
  const haut = mat(hautFarbe);
  const kopfMat = kopfMaterial(hautFarbe);
  const haar = mat(zufallAus(HAARFARBEN));
  const schuh = schuhMaterial(zufallAus(['#161616', '#f4f4f4', '#ff4d4d', '#2d6cdf', '#ffd84a', '#35d07f']));

  const wurzel = new THREE.Group();          // steht auf dem Boden, dreht sich in Blickrichtung
  const koerper = new THREE.Group();         // Drehpunkt in der Hüfte
  koerper.position.y = 0.94;
  wurzel.add(koerper);
  const teile = [];
  const mesh = (geo, m, eltern, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; eltern.add(o); teile.push(o); return o;
  };
  const blob = new THREE.Mesh(FIG.blob, blobMaterial());
  blob.position.y = 0.025; blob.userData.blob = true; blob.visible = renderer.shadowMap.enabled === false;
  wurzel.add(blob);
  mesh(FIG.hose, hose, koerper, 0, 0.02, 0);
  const oben = new THREE.Group(); oben.position.y = 0.1; koerper.add(oben);   // Oberkörper (kann sich neigen)
  mesh(FIG.rumpf, (stoff), oben, 0, 0.3, 0);
  mesh(FIG.hals, haut, oben, 0, 0.62, 0);
  const kopf = mesh(FIG.kopf, kopfMat, oben, 0, 0.75, 0);
  const frisur = mesh(zufallAus(FIG.haare), haar, kopf, 0, 0.02, -0.01);
  frisur.rotation.x = -0.25;
  const nr = new THREE.Mesh(FIG.nummer, nummernTextur(nummer, istTorwart ? '#ffffff' : kit.nummer));
  nr.position.set(0, 0.34, -0.142); nr.rotation.y = Math.PI;
  oben.add(nr);

  const arme = [], beine = [];
  for (const seite of [-1, 1]){
    const schulter = new THREE.Group(); schulter.position.set(seite * 0.255, 0.54, 0); oben.add(schulter);
    mesh(FIG.arm, trikot, schulter);
    const ellbogen = new THREE.Group(); ellbogen.position.y = -0.3; schulter.add(ellbogen);
    mesh(istTorwart ? FIG.unterarmTW : FIG.unterarm, unterarmMat, ellbogen);
    arme.push({ schulter, ellbogen });

    const huefte = new THREE.Group(); huefte.position.set(seite * 0.1, -0.02, 0); koerper.add(huefte);
    mesh(FIG.bein, beinMat, huefte);
    const knie = new THREE.Group(); knie.position.y = -0.47; huefte.add(knie);
    mesh(FIG.stutzen, stutzenMat, knie);
    const fuss = mesh(FIG.schuh, schuh, knie, 0, -0.42, 0);
    beine.push({ huefte, knie, fuss });
  }
  return { wurzel, koerper, oben, kopf, arme, beine, blob };
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
  for (const b of f.beine){ b.huefte.rotation.set(0, 0, 0); b.knie.rotation.set(0, 0, 0); b.fuss.rotation.set(0, 0, 0); }
  f.kopf.rotation.set(0, 0, 0);
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
  // Lebendigerer Lauf: Schultern gegen die Hüfte verdrehen, Hüfte wiegt, Füße rollen ab, Kopf bleibt ruhig
  O.rotation.y = sn * a * 0.2; K.rotation.y = -sn * a * 0.08; K.rotation.z = Math.cos(p) * a * 0.035;
  bL.fuss.rotation.x = bL.knie.rotation.x * 0.45 - Math.max(0, sn) * a * 0.25;
  bR.fuss.rotation.x = bR.knie.rotation.x * 0.45 - Math.max(0, -sn) * a * 0.25;
  f.kopf.rotation.y = -O.rotation.y * 0.8; f.kopf.rotation.x = -O.rotation.x * 0.7;
  if (tempo < 0.08){
    const atem = Math.sin(zeit * 2.2 + (h.x + h.z)) * 0.02;
    O.rotation.x = 0.04 + atem; O.rotation.y = 0; K.rotation.y = 0; K.rotation.z = 0; f.kopf.rotation.y = Math.sin(zeit * 0.7 + h.x) * 0.35; f.kopf.rotation.x = 0;
    aL.ellbogen.rotation.x = aR.ellbogen.rotation.x = -0.25;
  }

  if (h.schussT > 0){
    // 1 → 0: ausholen, dann durchziehen (rechtes Bein)
    const k = 1 - clamp(h.schussT, 0, 1);
    const w = k < 0.35 ? lerp(0, 1.0, k / 0.35) : lerp(1.0, -1.5, Math.min(1, (k - 0.35) / 0.4));
    bR.huefte.rotation.x = w; bR.fuss.rotation.x = k > 0.35 ? 0.55 : -0.2;
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
