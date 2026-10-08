'use strict';
// Futbolero – Stadion: Renderer, Licht, Rasen, Linien, Tore, Banden, Tribünen mit Publikum, Flutlicht, Ball.
let renderer, szene, kamera, sonne;
const Welt = { ball:null, ballSchatten:null, tore:{}, fans:null, koepfe:null, fanInfo:null, netzWackeln:{ 1:0, '-1':0 } };

function leinwand(w, h, malen){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  malen(c.getContext('2d'), w, h);
  return c;
}
function textur(canvas, wiederholen){
  const t = new THREE.CanvasTexture(canvas);
  if (wiederholen){ t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function szeneBauen(){
  renderer = new THREE.WebGLRenderer({ canvas:document.getElementById('spiel'), antialias:true, powerPreference:'high-performance' });
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  szene = new THREE.Scene();
  szene.background = new THREE.Color(0x0d1426);
  szene.fog = new THREE.Fog(0x1d2544, 150, 360);
  kamera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.3, 800);
  kamera.position.set(0, 26, HB + 32);
  kamera.lookAt(0, 0, 0);

  lichtBauen();
  himmelBauen();
  rasenBauen();
  linienBauen();
  torBauen(1); torBauen(-1);
  bandenBauen();
  tribuenenBauen();
  flutlichtBauen();
  ballBauen();
  qualitaetAnwenden();
  groesseAnpassen();
  addEventListener('resize', groesseAnpassen);
}

function qualitaetAnwenden(){
  const hoch = einstellungen.qualitaet === 'hoch';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hoch ? 2 : 1));
  if (renderer.shadowMap.enabled !== hoch){
    renderer.shadowMap.enabled = hoch;
    szene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  if (Welt.fans){
    // Im schnellen Modus nur jeden zweiten Zuschauer zeigen
    Welt.fans.count = hoch ? Welt.fanInfo.n : Math.floor(Welt.fanInfo.n / 2);
    Welt.koepfe.count = Welt.fans.count;
  }
  groesseAnpassen();
}

function groesseAnpassen(){
  renderer.setSize(innerWidth, innerHeight, false);
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
}

/* ---------- Licht und Himmel ---------- */
function lichtBauen(){
  szene.add(new THREE.HemisphereLight(0xd4e2ff, 0x21402a, 0.62));
  sonne = new THREE.DirectionalLight(0xfff3dc, 0.82);
  sonne.position.set(-22, 60, 28);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(2048, 2048);
  const k = sonne.shadow.camera;
  k.left = -52; k.right = 52; k.top = 42; k.bottom = -42; k.near = 10; k.far = 160;
  sonne.shadow.bias = -0.0004;
  sonne.shadow.normalBias = 0.02;
  szene.add(sonne); szene.add(sonne.target);
  const fuell = new THREE.DirectionalLight(0xc9d8ff, 0.3);
  fuell.position.set(30, 40, -34);
  szene.add(fuell);
}

function himmelBauen(){
  const geo = new THREE.SphereGeometry(520, 32, 16);
  const farben = [], oben = new THREE.Color(0x060b1e), mitte = new THREE.Color(0x1a2352), rand = new THREE.Color(0x5b3f68), unten = new THREE.Color(0x1d2544);
  const p = geo.attributes.position, c = new THREE.Color();
  for (let i = 0; i < p.count; i++){
    const y = p.getY(i) / 520;
    if (y < 0) c.copy(unten);
    else if (y < 0.12) c.copy(rand).lerp(mitte, y / 0.12);
    else c.copy(mitte).lerp(oben, Math.min(1, (y - 0.12) / 0.5));
    farben.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  szene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false })));
  // Sterne
  const sterne = [];
  for (let i = 0; i < 500; i++){
    const a = Math.random() * Math.PI * 2, h = zufall(0.18, 1);
    const r = Math.sqrt(1 - h * h) * 500;
    sterne.push(Math.cos(a) * r, h * 500, Math.sin(a) * r);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sterne, 3));
  szene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color:0xffffff, size:1.6, sizeAttenuation:false, fog:false, transparent:true, opacity:0.75 })));
}

/* ---------- Rasen und Linien ---------- */
function rasenBauen(){
  const breite = FELD.L + 2 * BANDE + 2, tiefe = FELD.B + 2 * BANDE + 2;
  const streifen = FELD.L / 14;
  const c = leinwand(2048, 1024, (g, w, h) => {
    const bild = g.createImageData(w, h), d = bild.data;
    for (let px = 0; px < w; px++){
      const x = -breite / 2 + (px + 0.5) / w * breite;
      const hell = Math.floor((x + HL) / streifen) & 1;
      const r0 = hell ? 42 : 35, g0 = hell ? 122 : 106, b0 = hell ? 58 : 50;
      for (let py = 0; py < h; py++){
        const n = (Math.random() - 0.5) * 16, i = (py * w + px) * 4;
        d[i] = r0 + n * 0.5; d[i + 1] = g0 + n; d[i + 2] = b0 + n * 0.4; d[i + 3] = 255;
      }
    }
    g.putImageData(bild, 0, 0);
  });
  const rasen = new THREE.Mesh(
    new THREE.PlaneGeometry(breite, tiefe).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map:textur(c) })
  );
  rasen.receiveShadow = true;
  szene.add(rasen);
  Welt.rasen = rasen;
  // Boden rund ums Feld
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color:0x1b2620 }));
  boden.position.y = -0.03;
  szene.add(boden);
}

function linienBauen(){
  const pos = [], idx = [], nor = [];
  const B = 0.12, Y = 0.014;
  function band(punkte, breite = B){
    const start = pos.length / 3;
    for (let i = 0; i < punkte.length; i++){
      const [x, z] = punkte[i];
      const [ax, az] = punkte[Math.max(0, i - 1)], [bx, bz] = punkte[Math.min(punkte.length - 1, i + 1)];
      let tx = bx - ax, tz = bz - az; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz * breite / 2, nz = tx * breite / 2;
      pos.push(x + nx, Y, z + nz, x - nx, Y, z - nz);
      nor.push(0, 1, 0, 0, 1, 0);
      if (i > 0){ const a = start + (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  }
  const strich = (x1, z1, x2, z2) => band([[x1, z1], [x2, z2]]);
  function bogen(cx, cz, r, a0, a1, breite){
    const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r * 3)), p = [];
    for (let i = 0; i <= n; i++){ const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
    band(p, breite);
  }
  const punkt = (x, z) => bogen(x, z, 0.1, 0, Math.PI * 2, 0.2);

  // Außenlinien (etwas überstehend, damit die Ecken geschlossen sind)
  strich(-HL - B / 2, -HB, HL + B / 2, -HB);
  strich(-HL - B / 2, HB, HL + B / 2, HB);
  strich(-HL, -HB, -HL, HB);
  strich(HL, -HB, HL, HB);
  strich(0, -HB, 0, HB);
  bogen(0, 0, KREIS, 0, Math.PI * 2);
  punkt(0, 0);
  for (const s of [1, -1]){
    const x0 = s * HL;
    // Strafraum
    strich(x0, -STRAF.B / 2, x0 - s * STRAF.T, -STRAF.B / 2);
    strich(x0, STRAF.B / 2, x0 - s * STRAF.T, STRAF.B / 2);
    strich(x0 - s * STRAF.T, -STRAF.B / 2 - B / 2, x0 - s * STRAF.T, STRAF.B / 2 + B / 2);
    // Torraum
    strich(x0, -TORRAUM.B / 2, x0 - s * TORRAUM.T, -TORRAUM.B / 2);
    strich(x0, TORRAUM.B / 2, x0 - s * TORRAUM.T, TORRAUM.B / 2);
    strich(x0 - s * TORRAUM.T, -TORRAUM.B / 2 - B / 2, x0 - s * TORRAUM.T, TORRAUM.B / 2 + B / 2);
    // Elfmeterpunkt und Teilkreis
    const ex = x0 - s * ELFER_ABSTAND;
    punkt(ex, 0);
    const r = 6, alpha = Math.acos((STRAF.T - ELFER_ABSTAND) / r);
    if (s > 0) bogen(ex, 0, r, Math.PI - alpha, Math.PI + alpha);
    else bogen(ex, 0, r, -alpha, alpha);
    // Eckbögen
    for (const t of [1, -1]){
      const cz = t * HB;
      const a0 = Math.atan2(-t, 0), a1 = Math.atan2(0, -s);
      let d = winkelDiff(a0, a1);
      bogen(x0, cz, 1, a0, a0 + d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const linien = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color:0xf6f8f4, emissive:0x3a3a3a, side:THREE.DoubleSide }));
  linien.receiveShadow = true;
  szene.add(linien);

  // Eckfahnen
  const stange = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6);
  const fahne = new THREE.PlaneGeometry(0.45, 0.32);
  const weiss = new THREE.MeshLambertMaterial({ color:0xffffff });
  const gelb = new THREE.MeshLambertMaterial({ color:0xffd84a, side:THREE.DoubleSide });
  for (const s of [1, -1]) for (const t of [1, -1]){
    const st = new THREE.Mesh(stange, weiss); st.position.set(s * HL, 0.75, t * HB); st.castShadow = true; szene.add(st);
    const f = new THREE.Mesh(fahne, gelb); f.position.set(s * HL - s * 0.23, 1.33, t * HB); szene.add(f);
  }
}

/* ---------- Tore ---------- */
function torBauen(s){
  const gruppe = new THREE.Group();
  const weiss = new THREE.MeshPhongMaterial({ color:0xffffff, shininess:60 });
  const pfosten = new THREE.CylinderGeometry(TOR.R, TOR.R, TOR.H + TOR.R, 14);
  for (const t of [1, -1]){
    const p = new THREE.Mesh(pfosten, weiss);
    p.position.set(s * HL, (TOR.H + TOR.R) / 2, t * (TOR.B / 2 + TOR.R));
    p.castShadow = true; gruppe.add(p);
  }
  const latte = new THREE.Mesh(new THREE.CylinderGeometry(TOR.R, TOR.R, TOR.B + 4 * TOR.R, 14), weiss);
  latte.rotation.x = Math.PI / 2;
  latte.position.set(s * HL, TOR.H + TOR.R, 0);
  latte.castShadow = true; gruppe.add(latte);

  // Hintere Streben
  const grau = new THREE.MeshLambertMaterial({ color:0x9aa3ad });
  const strebe = (x1, y1, z1, x2, y2, z2) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, a.distanceTo(b), 6), grau);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    gruppe.add(m);
  };
  const xh = s * (HL + TOR.T), hh = TOR.H * 0.85, bz = TOR.B / 2 + TOR.R;
  for (const t of [1, -1]){
    strebe(s * HL, TOR.H, t * bz, xh, hh, t * bz);
    strebe(xh, hh, t * bz, xh, 0, t * bz);
    strebe(s * HL, 0.02, t * bz, xh, 0.02, t * bz);
  }
  strebe(xh, hh, -bz, xh, hh, bz);
  strebe(xh, 0.02, -bz, xh, 0.02, bz);

  // Netz
  const netzBild = leinwand(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 5;
    g.strokeRect(0, 0, w, h);
  });
  const tex = textur(netzBild, true);
  const pos = [], uv = [], idx = [];
  const M = 7; // Maschen pro Meter
  function viereck(a, b, c, d){ // a-b oben, d-c unten, jeweils [x,y,z]
    const s0 = pos.length / 3;
    const breite = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const hoehe = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    pos.push(...a, ...b, ...c, ...d);
    uv.push(0, hoehe * M, breite * M, hoehe * M, breite * M, 0, 0, 0);
    idx.push(s0, s0 + 1, s0 + 2, s0, s0 + 2, s0 + 3);
  }
  const L0 = 0, Lt = s * TOR.T, H = TOR.H, Hb = hh, Z = TOR.B / 2 + TOR.R;
  viereck([L0, H, -Z], [L0, H, Z], [Lt, Hb, Z], [Lt, Hb, -Z]);       // Dach
  viereck([Lt, Hb, -Z], [Lt, Hb, Z], [Lt, 0, Z], [Lt, 0, -Z]);       // Rückwand
  for (const t of [1, -1]) viereck([L0, H, t * Z], [Lt, Hb, t * Z], [Lt, 0, t * Z], [L0, 0, t * Z]); // Seiten
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const netz = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:tex, color:0xe9eef2, transparent:true, alphaTest:0.4, side:THREE.DoubleSide, depthWrite:false, opacity:0.85 }));
  netz.position.x = s * HL;
  gruppe.add(netz);
  szene.add(gruppe);
  Welt.tore[s] = { gruppe, netz };
}

function netzAnimieren(dt){
  for (const s of [1, -1]){
    const w = Welt.netzWackeln[s];
    if (w <= 0){ Welt.tore[s].netz.scale.set(1, 1, 1); continue; }
    Welt.netzWackeln[s] = Math.max(0, w - dt);
    const t = 1.2 - Welt.netzWackeln[s];
    const aus = Math.sin(t * 16) * Math.exp(-t * 3.2) * 0.22;
    Welt.tore[s].netz.scale.set(1 + aus, 1 - aus * 0.15, 1 + aus * 0.1);
  }
}

/* ---------- Werbebanden ---------- */
const WERBUNG = [
  ['FUTBOLERO', '#0b0f14', '#ffd84a'],
  ['SWIMMING LIONS', '#13315c', '#7fd6e0'],
  ['LÖWEN-KART', '#ff9a1a', '#1b1b1b'],
  ['BLAUE STUNDE', '#1553a8', '#ffffff'],
  ['IRON HORIZON', '#2b2b2b', '#d9a16a'],
  ['WELTREICHE', '#c0392b', '#ffffff'],
  ['OLYMPIADE', '#e6b422', '#1b1b1b'],
  ['LIFESIM', '#f6c343', '#13315c'],
  ['WELTENBUMMLER', '#1f6fd1', '#ffffff']
];
function bandenBauen(){
  const mats = WERBUNG.map(([text, bg, fg]) => {
    const c = leinwand(512, 64, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.font = '800 44px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2);
    });
    return new THREE.MeshBasicMaterial({ map:textur(c) });
  });
  const dunkel = new THREE.MeshLambertMaterial({ color:0x15191f });
  const LAENGE = 8, H = 0.9;
  const geo = new THREE.BoxGeometry(LAENGE, H, 0.12);
  let n = 0;
  function reihe(von, bis, fest, entlangX, blickDrehung){
    const anzahl = Math.round((bis - von) / LAENGE);
    const l = (bis - von) / anzahl;
    for (let i = 0; i < anzahl; i++){
      const m = new THREE.Mesh(geo, [dunkel, dunkel, dunkel, dunkel, mats[n++ % mats.length], dunkel]);
      const mitte = von + l * (i + 0.5);
      if (entlangX) m.position.set(mitte, H / 2, fest); else m.position.set(fest, H / 2, mitte);
      m.scale.x = l / LAENGE;
      m.rotation.y = blickDrehung;
      szene.add(m);
    }
  }
  const ax = HL + BANDE, az = HB + BANDE;
  reihe(-ax, ax, -az, true, 0);             // gegenüber, schaut nach +z
  reihe(-ax, ax, az, true, Math.PI);        // Kameraseite
  reihe(-az, az, ax, false, -Math.PI / 2);  // rechts hinter dem Tor
  reihe(-az, az, -ax, false, Math.PI / 2);  // links hinter dem Tor
}

/* ---------- Tribünen mit Publikum ---------- */
function tribuenenBauen(){
  const beton = new THREE.MeshLambertMaterial({ color:0x39414d });
  const dach = new THREE.MeshLambertMaterial({ color:0x20252d });
  const leuchte = new THREE.MeshBasicMaterial({ color:0xfff1c4 });
  const fans = [];
  const TIEFE = 0.85, STUFE = 0.48, SOCKEL = 1.6;

  // Eine Tribüne: Stufenprofil entlang „laenge“, beginnt „abstand“ vom Mittelpunkt in Richtung „dir“
  function tribuene(laenge, reihen, abstand, winkel, mitDach){
    const form = new THREE.Shape();
    form.moveTo(0, 0);
    form.lineTo(0, SOCKEL);
    for (let r = 0; r < reihen; r++){
      form.lineTo(r * TIEFE, SOCKEL + r * STUFE);
      form.lineTo((r + 1) * TIEFE, SOCKEL + r * STUFE);
    }
    form.lineTo(reihen * TIEFE, 0);
    form.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(form, { depth:laenge, bevelEnabled:false });
    geo.translate(0, 0, -laenge / 2);
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, beton);
    m.receiveShadow = true;
    g.add(m);
    if (mitDach){
      const hoehe = SOCKEL + reihen * STUFE + 5;
      const d = new THREE.Mesh(new THREE.BoxGeometry(reihen * TIEFE + 4, 0.5, laenge + 2), dach);
      d.position.set(reihen * TIEFE / 2 - 1, hoehe, 0);
      g.add(d);
      const kante = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, laenge + 2), leuchte);
      kante.position.set(-3, hoehe - 0.3, 0);
      g.add(kante);
      for (let z = -laenge / 2; z <= laenge / 2 + 0.1; z += laenge / 4){
        const saeule = new THREE.Mesh(new THREE.BoxGeometry(0.5, hoehe, 0.5), dach);
        saeule.position.set(reihen * TIEFE + 0.5, hoehe / 2, z);
        g.add(saeule);
      }
    }
    // Lokale x-Achse zeigt vom Feld weg
    g.rotation.y = winkel;
    g.position.set(Math.cos(-winkel) * abstand, 0, Math.sin(-winkel) * abstand);
    szene.add(g);
    g.updateMatrixWorld(true);
    // Sitzplätze
    const v = new THREE.Vector3();
    for (let r = 0; r < reihen; r++){
      for (let z = -laenge / 2 + 0.4; z < laenge / 2 - 0.3; z += 0.56){
        if (Math.random() < 0.13) continue;
        v.set(r * TIEFE + TIEFE * 0.55 + zufall(-0.08, 0.08), SOCKEL + r * STUFE, z + zufall(-0.1, 0.1));
        v.applyMatrix4(g.matrixWorld);
        fans.push({ x:v.x, y:v.y, z:v.z, dreh:winkel });
      }
    }
  }
  const ax = HL + BANDE + 2.5, az = HB + BANDE + 2.5;
  tribuene(FELD.L + 2 * BANDE + 14, 22, az, Math.PI / 2, true);     // gegenüber (−z)
  tribuene(FELD.L + 2 * BANDE + 14, 9, az, -Math.PI / 2, false);    // Kameraseite (+z)
  tribuene(FELD.B + 2 * BANDE + 2, 16, ax, 0, true);                // hinter dem rechten Tor (+x)
  tribuene(FELD.B + 2 * BANDE + 2, 16, ax, Math.PI, true);          // hinter dem linken Tor (−x)

  // Gemischt durcheinander, damit „jeden zweiten zeigen“ gleichmäßig ausdünnt
  for (let i = fans.length - 1; i > 0; i--){ const j = zufallGanz(i + 1); [fans[i], fans[j]] = [fans[j], fans[i]]; }
  const n = fans.length;
  const koerper = new THREE.InstancedMesh(new THREE.BoxGeometry(0.44, 0.7, 0.32), new THREE.MeshLambertMaterial(), n);
  const koepfe = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshLambertMaterial(), n);
  const info = { n, x:new Float32Array(n), y:new Float32Array(n), z:new Float32Array(n), dreh:new Float32Array(n), team:new Int8Array(n), phase:new Float32Array(n) };
  const haut = ['#f1c7a5', '#d9a47c', '#a86b45', '#6b4128', '#f6d8c2'].map(f => new THREE.Color(f));
  const dummy = new THREE.Object3D();
  fans.forEach((f, i) => {
    info.x[i] = f.x; info.y[i] = f.y; info.z[i] = f.z; info.dreh[i] = f.dreh;
    info.team[i] = Math.random() < 0.46 ? 0 : Math.random() < 0.85 ? 1 : -1;
    info.phase[i] = Math.random() * Math.PI * 2;
    dummy.position.set(f.x, f.y + 0.35, f.z); dummy.rotation.set(0, f.dreh, 0); dummy.updateMatrix();
    koerper.setMatrixAt(i, dummy.matrix);
    dummy.position.y = f.y + 0.84; dummy.updateMatrix();
    koepfe.setMatrixAt(i, dummy.matrix);
    koepfe.setColorAt(i, zufallAus(haut));
    koerper.setColorAt(i, new THREE.Color(0x888888));
  });
  Welt.fans = koerper; Welt.koepfe = koepfe; Welt.fanInfo = info;
  Welt.fanDummy = dummy;
  szene.add(koerper); szene.add(koepfe);
}

// Publikum in den Farben der beiden Teams einkleiden
function fansEinkleiden(kitA, kitB){
  const info = Welt.fanInfo, c = new THREE.Color();
  const neutral = ['#d8d8d8', '#3b4452', '#8a5a44', '#2e5c8a', '#6b6b6b'];
  for (let i = 0; i < info.n; i++){
    const t = info.team[i];
    if (t === 0) c.set(Math.random() < 0.75 ? kitA.trikot : kitA.hose);
    else if (t === 1) c.set(Math.random() < 0.75 ? kitB.trikot : kitB.hose);
    else c.set(zufallAus(neutral));
    c.offsetHSL(0, 0, zufall(-0.06, 0.04));
    Welt.fans.setColorAt(i, c);
  }
  Welt.fans.instanceColor.needsUpdate = true;
}

const Fans = { jubelTeam:-1, jubelZeit:0, aufregung:0, bild:0 };
function fansAnimieren(dt){
  Fans.jubelZeit = Math.max(0, Fans.jubelZeit - dt);
  const aktiv = Fans.jubelZeit > 0 || Fans.aufregung > 0.25;
  if (!aktiv && !Fans.warAktiv) return;
  // Nur jedes zweite Bild neu berechnen – spart bei vielen Zuschauern Zeit
  if (++Fans.bild % 2) return;
  Fans.warAktiv = aktiv;
  const info = Welt.fanInfo, d = Welt.fanDummy, t = performance.now() / 1000;
  const n = Welt.fans.count;
  for (let i = 0; i < n; i++){
    let hub = 0;
    if (Fans.jubelZeit > 0 && (info.team[i] === Fans.jubelTeam || (info.team[i] === -1 && i % 3 === 0))){
      hub = Math.max(0, Math.sin(t * 9 + info.phase[i])) * 0.45 * Math.min(1, Fans.jubelZeit);
    } else if (Fans.aufregung > 0.25){
      hub = Math.max(0, Math.sin(t * 5 + info.phase[i])) * 0.12 * Fans.aufregung;
    }
    d.position.set(info.x[i], info.y[i] + 0.35 + hub, info.z[i]); d.rotation.set(0, info.dreh[i], 0); d.updateMatrix();
    Welt.fans.setMatrixAt(i, d.matrix);
    d.position.y = info.y[i] + 0.84 + hub; d.updateMatrix();
    Welt.koepfe.setMatrixAt(i, d.matrix);
  }
  Welt.fans.instanceMatrix.needsUpdate = true;
  Welt.koepfe.instanceMatrix.needsUpdate = true;
}

/* ---------- Flutlicht ---------- */
function flutlichtBauen(){
  const glanz = leinwand(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,250,230,1)'); r.addColorStop(0.2, 'rgba(255,240,200,.55)'); r.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const lampen = leinwand(128, 64, (g, w, h) => {
    g.fillStyle = '#2a2f36'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++){
      g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(8 + x * 16, 8 + y * 16, 6, 0, Math.PI * 2); g.fill();
    }
  });
  const spriteMat = new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(glanz), blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, fog:false });
  const mastMat = new THREE.MeshLambertMaterial({ color:0x5d6672 });
  const lampMat = new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(lampen) });
  for (const s of [1, -1]) for (const t of [1, -1]){
    const x = s * (HL + BANDE + 16), z = t * (HB + BANDE + 18), h = 42;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, h, 8), mastMat);
    mast.position.set(x, h / 2, z);
    szene.add(mast);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.6), [mastMat, mastMat, mastMat, mastMat, lampMat, mastMat]);
    panel.position.set(x, h + 2, z);
    panel.lookAt(0, 0, 0);
    szene.add(panel);
    const sp = new THREE.Sprite(spriteMat);
    sp.scale.set(34, 34, 1);
    sp.position.set(x * 0.985, h + 2, z * 0.985);
    szene.add(sp);
  }
}

/* ---------- Ball ---------- */
function ballBauen(){
  // Klassisches Muster: schwarze Fünfecke an den Ecken eines Ikosaeders
  const phi = (1 + Math.sqrt(5)) / 2;
  const ecken = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]]
    .map(v => { const l = Math.hypot(...v); return v.map(k => k / l); });
  const c = leinwand(512, 256, (g, w, h) => {
    const bild = g.createImageData(w, h), d = bild.data;
    for (let py = 0; py < h; py++){
      const lat = (0.5 - (py + 0.5) / h) * Math.PI;
      for (let px = 0; px < w; px++){
        const lon = ((px + 0.5) / w) * Math.PI * 2;
        const x = -Math.cos(lon) * Math.cos(lat), y = Math.sin(lat), z = Math.sin(lon) * Math.cos(lat);
        let a1 = 9, a2 = 9;
        for (const e of ecken){
          const a = Math.acos(clamp(x * e[0] + y * e[1] + z * e[2], -1, 1));
          if (a < a1){ a2 = a1; a1 = a; } else if (a < a2) a2 = a;
        }
        let v = 245;
        if (a1 < 0.34) v = 22;
        else if (a2 - a1 < 0.035 && a1 > 0.5) v = 150;
        else if (Math.abs(a1 - 0.34) < 0.02) v = 120;
        const i = (py * w + px) * 4;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
    }
    g.putImageData(bild, 0, 0);
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), new THREE.MeshPhongMaterial({ map:textur(c), shininess:45, specular:0x333333 }));
  ball.castShadow = true;
  szene.add(ball);
  Welt.ball = ball;
  const schatten = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.35, depthWrite:false }));
  schatten.position.y = 0.02;
  szene.add(schatten);
  Welt.ballSchatten = schatten;
}
