'use strict';
// Futbolero – Stadion: Renderer, Licht, Rasen, Linien, Tore, Banden, Tribünen mit Publikum, Flutlicht, Ball.
let renderer, szene, kamera, sonne;
const Welt = { ball:null, ballSchatten:null, tore:{}, fans:null, koepfe:null, fanInfo:null, netzWackeln:{ 1:0, '-1':0 } };

function leinwand(w, h, malen){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  // Große Bilder werden Pixel für Pixel berechnet – dafür den Software-Zeichenpfad nehmen (schnelles getImageData)
  malen(c.getContext('2d', w * h >= 262144 ? { willReadFrequently:true } : undefined), w, h);
  return c;
}
function textur(canvas, wiederholen){
  const t = new THREE.CanvasTexture(canvas);
  if (wiederholen){ t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// Weiches Wertrauschen auf einem groben Gitter (u, v in 0..1) – für Rasen, Beton, Asphalt
function rauschGitter(nx, ny){
  const a = new Float32Array((nx + 1) * (ny + 1));
  for (let i = 0; i < a.length; i++) a[i] = Math.random();
  return { nx, ny, a };
}
function rauschLesen(G, u, v){
  const x = Math.min(G.nx - 0.001, Math.max(0, u * G.nx)), y = Math.min(G.ny - 0.001, Math.max(0, v * G.ny));
  const x0 = x | 0, y0 = y | 0;
  let fx = x - x0, fy = y - y0;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const w = G.nx + 1, i = y0 * w + x0;
  return (G.a[i] * (1 - fx) + G.a[i + 1] * fx) * (1 - fy) + (G.a[i + w] * (1 - fx) + G.a[i + w + 1] * fx) * fy;
}
const glaetten = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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
  effekteBauen();
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
  for (const k of Welt.kegel || []){ k.userData.hoch = hoch; k.visible = hoch && ARENA.art === 'stadion'; }
  // Ohne echte Schatten malen die Figuren einen weichen Fleck unter die Füße
  szene.traverse(o => { if (o.userData && o.userData.blob) o.visible = !hoch; });
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
  Welt.hemi = new THREE.HemisphereLight(0xd4e2ff, 0x21402a, 0.66);
  szene.add(Welt.hemi);
  sonne = new THREE.DirectionalLight(0xfff3dc, 0.84);
  sonne.position.set(-22, 60, 28);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(2048, 2048);
  const k = sonne.shadow.camera;
  k.left = -52; k.right = 52; k.top = 42; k.bottom = -42; k.near = 10; k.far = 160;
  sonne.shadow.bias = -0.0004;
  sonne.shadow.normalBias = 0.02;
  szene.add(sonne); szene.add(sonne.target);
  Welt.fuell = new THREE.DirectionalLight(0xc9d8ff, 0.3);
  Welt.fuell.position.set(30, 40, -34);
  szene.add(Welt.fuell);
}

const HIMMEL = {
  stadion:{ oben:0x060b1e, mitte:0x1a2352, rand:0x6a4a7c, unten:0x1d2544 },
  strasse:{ oben:0x1d2b63, mitte:0x8a4b7e, rand:0xffa65e, unten:0x3a2a33 },
  halle:{ oben:0x0d1119, mitte:0x0d1119, rand:0x0d1119, unten:0x0d1119 }
};
function himmelFaerben(art){
  const pal = HIMMEL[art] || HIMMEL.stadion;
  const geo = Welt.himmel.geometry, p = geo.attributes.position, col = geo.attributes.color;
  const oben = new THREE.Color(pal.oben), mitte = new THREE.Color(pal.mitte), rand = new THREE.Color(pal.rand), unten = new THREE.Color(pal.unten), c = new THREE.Color();
  for (let i = 0; i < p.count; i++){
    const y = p.getY(i) / 520;
    if (y < 0) c.copy(unten);
    else if (y < 0.14) c.copy(rand).lerp(mitte, Math.pow(y / 0.14, 0.7));
    else c.copy(mitte).lerp(oben, Math.min(1, (y - 0.14) / 0.55));
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

function himmelBauen(){
  const geo = new THREE.SphereGeometry(520, 32, 16);
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  Welt.himmel = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.BackSide, fog:false, depthWrite:false }));
  szene.add(Welt.himmel);
  himmelFaerben('stadion');
  Welt.himmelTeile = [];
  // Sterne in verschiedenen Größen und Helligkeiten
  const sterne = [], farben = [];
  for (let i = 0; i < 650; i++){
    const a = Math.random() * Math.PI * 2, h = zufall(0.12, 1);
    const r = Math.sqrt(1 - h * h) * 500;
    sterne.push(Math.cos(a) * r, h * 500, Math.sin(a) * r);
    const hell = Math.pow(Math.random(), 2.2) * 0.75 + 0.25, warm = Math.random();
    farben.push(hell, hell * (0.9 + warm * 0.1), hell * (0.8 + (1 - warm) * 0.2));
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sterne, 3));
  sg.setAttribute('color', new THREE.Float32BufferAttribute(farben, 3));
  Welt.sterne = new THREE.Points(sg, new THREE.PointsMaterial({ size:1.7, vertexColors:true, sizeAttenuation:false, fog:false, transparent:true, opacity:0.85, depthWrite:false }));
  szene.add(Welt.sterne);
  Welt.himmelTeile.push(Welt.sterne);

  // Mond mit Hof
  const mond = leinwand(256, 256, (g, w) => {
    const hof = g.createRadialGradient(w / 2, w / 2, 20, w / 2, w / 2, w / 2);
    hof.addColorStop(0, 'rgba(210,225,255,.5)'); hof.addColorStop(0.35, 'rgba(160,185,255,.14)'); hof.addColorStop(1, 'rgba(120,150,255,0)');
    g.fillStyle = hof; g.fillRect(0, 0, w, w);
    const k = g.createRadialGradient(w / 2 - 6, w / 2 - 6, 4, w / 2, w / 2, 34);
    k.addColorStop(0, '#fffdf2'); k.addColorStop(1, '#dfe6f2');
    g.fillStyle = k; g.beginPath(); g.arc(w / 2, w / 2, 32, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(150,160,185,.28)';
    for (const [x, y, r] of [[-10, -8, 8], [9, 6, 10], [-2, 15, 5], [13, -12, 4]]){ g.beginPath(); g.arc(w / 2 + x, w / 2 + y, r, 0, 6.3); g.fill(); }
  });
  Welt.mond = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(mond), fog:false, depthWrite:false, transparent:true }));
  Welt.mond.scale.set(120, 120, 1); Welt.mond.position.set(-250, 230, -380);
  szene.add(Welt.mond);
  Welt.himmelTeile.push(Welt.mond);

  // Wolken: weiche, breite Schleier nahe am Horizont, von der Stadt unten angeleuchtet
  const wolke = leinwand(256, 128, (g, w, h) => {
    for (let i = 0; i < 26; i++){
      const x = zufall(40, w - 40), y = zufall(36, h - 36), r = zufall(22, 48);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  const wolkenTex = new THREE.CanvasTexture(wolke);
  Welt.wolken = [];
  for (let i = 0; i < 9; i++){
    const a = i / 9 * Math.PI * 2 + zufall(-0.2, 0.2), r = 470, h = zufall(40, 130);
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map:wolkenTex, fog:false, depthWrite:false, transparent:true, opacity:0.55, color:0x8f7fb8 }));
    m.scale.set(zufall(260, 380), zufall(80, 130), 1);
    m.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
    szene.add(m); Welt.wolken.push(m); Welt.himmelTeile.push(m);
  }

  // Stadt am Horizont: dunkle Silhouetten mit erleuchteten Fenstern
  const stadt = leinwand(2048, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let x = 0;
    while (x < w){
      const bw = zufall(18, 64), bh = zufall(18, 100);
      g.fillStyle = Math.random() < 0.5 ? '#0b0f1f' : '#10142a';
      g.fillRect(x, h - bh, bw, bh);
      for (let fy = h - bh + 6; fy < h - 6; fy += 8) for (let fx = x + 4; fx < x + bw - 5; fx += 7){
        if (Math.random() < 0.28){ g.fillStyle = Math.random() < 0.8 ? 'rgba(255,214,130,.85)' : 'rgba(170,210,255,.8)'; g.fillRect(fx, fy, 3, 4); }
      }
      x += bw + zufall(0, 6);
    }
  });
  const st = new THREE.CanvasTexture(stadt); st.wrapS = THREE.RepeatWrapping;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(430, 430, 60, 48, 1, true), new THREE.MeshBasicMaterial({ map:st, transparent:true, side:THREE.BackSide, fog:false, depthWrite:false }));
  ring.position.y = 28; ring.geometry.scale(1, 1, 1);
  szene.add(ring);
  Welt.stadtRing = ring; Welt.himmelTeile.push(ring);
}

/* ---------- Rasen und Linien ---------- */
function rasenBauen(){
  const breite = FELD.L + 2 * BANDE + 2, tiefe = FELD.B + 2 * BANDE + 2;
  const streifen = FELD.L / 14;
  const grob = rauschGitter(34, 22), mittel = rauschGitter(150, 96);
  // Abgenutzte Stellen: Torräume, Anstoßpunkt, Elfmeterpunkte (x, z, rx, rz, Stärke)
  const spuren = [[-HL + 1.6, 0, 3.4, 6.5, 0.95], [HL - 1.6, 0, 3.4, 6.5, 0.95], [0, 0, 2.2, 2.2, 0.7],
    [-HL + ELFER_ABSTAND, 0, 1.6, 1.4, 0.75], [HL - ELFER_ABSTAND, 0, 1.6, 1.4, 0.75]];
  const c = leinwand(2048, 1024, (g, w, h) => {
    const bild = g.createImageData(w, h), d = bild.data;
    for (let py = 0; py < h; py++){
      const zw = -tiefe / 2 + (py + 0.5) / h * tiefe;
      for (let px = 0; px < w; px++){
        const xw = -breite / 2 + (px + 0.5) / w * breite;
        const t = (xw + HL) / streifen, i = Math.floor(t), f = t - i, hell = i & 1;
        // Mähstreifen: zwei Grüntöne, an den Kanten leicht „anliegende Halme“
        let r = hell ? 47 : 36, gr = hell ? 128 : 104, b = hell ? 62 : 50;
        const glanz = 1 + (hell ? 1 : -1) * 0.05 * (f - 0.5);
        const u = px / w, v = py / h;
        const n = (rauschLesen(grob, u, v) - 0.5) * 0.085 + (rauschLesen(mittel, u, v) - 0.5) * 0.09 + (Math.random() - 0.5) * 0.11;
        // Abnutzung (braunes, dünnes Gras)
        let wear = 0;
        for (const [sx, sz, rx, rz, st] of spuren){
          const q = Math.hypot((xw - sx) / rx, (zw - sz) / rz);
          if (q < 1.25) wear = Math.max(wear, (1 - glaetten(0.1, 1.25, q)) * st);
        }
        wear *= 0.55 + rauschLesen(mittel, u, v) * 0.7;
        // Außerhalb des Spielfelds etwas dunkler und gröber
        const aussen = glaetten(0, 2.5, Math.max(Math.abs(xw) - HL - 1, Math.abs(zw) - HB - 1));
        const k = glanz * (1 + n) * (1 - aussen * 0.2);
        r = r * k * (1 - wear * 0.2) + 104 * wear * 0.5; gr = gr * k * (1 - wear * 0.45) + 92 * wear * 0.5; b = b * k * (1 - wear * 0.3) + 52 * wear * 0.4;
        const o = (py * w + px) * 4;
        d[o] = r; d[o + 1] = gr; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    g.putImageData(bild, 0, 0);
  });
  Welt.grasTextur = textur(c);
  const rasen = new THREE.Mesh(
    new THREE.PlaneGeometry(breite, tiefe).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map:Welt.grasTextur })
  );
  rasen.receiveShadow = true;
  szene.add(rasen);
  Welt.rasen = rasen;
  // Weicher Randschatten (Flutlicht lässt die Ränder abfallen)
  const rand = leinwand(256, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, w * 0.62);
    r.addColorStop(0, 'rgba(4,14,10,0)'); r.addColorStop(0.6, 'rgba(4,14,10,.1)'); r.addColorStop(1, 'rgba(4,14,10,.5)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(breite, tiefe).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(rand), transparent:true, depthWrite:false }));
  vig.position.y = 0.006; vig.renderOrder = 1;
  szene.add(vig);
  Welt.rasenRand = vig;
  // Boden rund ums Feld: dunkler Beton mit Struktur
  const beton = leinwand(256, 256, (g, w, h) => {
    g.fillStyle = '#242c30'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++){ const v = (Math.random() * 28) | 0; g.fillStyle = `rgba(${40 + v},${46 + v},${50 + v},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w - 1, h - 1);
  });
  const bt = textur(beton, true); bt.repeat.set(70, 70);
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map:bt }));
  boden.position.y = -0.03;
  boden.receiveShadow = true;
  szene.add(boden);
  Welt.boden = boden;
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
  const weiss = new THREE.MeshPhongMaterial({ color:0xffffff, shininess:90, specular:0x888888 });
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

  // Netz: Rautenmaschen aus feinen Schnüren
  const netzBild = leinwand(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 3.2; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-2, h / 2); g.lineTo(w / 2, -2); g.lineTo(w + 2, h / 2); g.lineTo(w / 2, h + 2); g.lineTo(-2, h / 2);
    g.moveTo(w / 2, -2); g.lineTo(w + 2, h / 2); g.moveTo(-2, h / 2); g.lineTo(w / 2, h + 2);
    g.stroke();
    // Knoten
    g.fillStyle = '#fff';
    for (const [x, y] of [[w / 2, 0], [0, h / 2], [w, h / 2], [w / 2, h]]){ g.beginPath(); g.arc(x, y, 3, 0, 6.3); g.fill(); }
  });
  const tex = textur(netzBild, true);
  const pos = [], uv = [], idx = [];
  const M = 6; // Maschen pro Meter
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
  const netz = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:tex, color:0xeef3f7, transparent:true, alphaTest:0.3, side:THREE.DoubleSide, depthWrite:false, opacity:0.9 }));
  // Zarter Schatten des Netzes auf dem Boden, Fußpunkte der Pfosten
  const fleck = new THREE.Mesh(new THREE.PlaneGeometry(TOR.T + 0.4, TOR.B + 2 * TOR.R + 0.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.2, depthWrite:false }));
  fleck.position.set(s * (HL + TOR.T / 2), 0.012, 0); gruppe.add(fleck);
  for (const t of [1, -1]){
    const fuss = new THREE.Mesh(new THREE.CylinderGeometry(TOR.R * 1.9, TOR.R * 2.2, 0.06, 12), grau);
    fuss.position.set(s * HL, 0.03, t * (TOR.B / 2 + TOR.R)); gruppe.add(fuss);
  }
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
      const v = g.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(255,255,255,.22)'); v.addColorStop(0.45, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(0,0,0,.28)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
      g.fillStyle = fg; g.font = '800 44px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
      g.fillText(text, w / 2, h / 2 + 2);
      g.shadowColor = 'transparent';
      g.fillStyle = fg; g.globalAlpha = 0.55;                                  // Zierleisten links und rechts
      g.fillRect(10, 12, 5, h - 24); g.fillRect(w - 15, 12, 5, h - 24); g.globalAlpha = 1;
    });
    return new THREE.MeshBasicMaterial({ map:textur(c) });
  });
  const dunkel = new THREE.MeshLambertMaterial({ color:0x1b2028 });
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
// Beton-Textur (fein gesprenkelt, Fugen, Schlieren)
function betonTextur(){
  const c = leinwand(256, 256, (g, w, h) => {
    g.fillStyle = '#5b6574'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++){ const v = (Math.random() * 34 - 17) | 0; g.fillStyle = `rgba(${96 + v},${106 + v},${120 + v},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    for (let i = 0; i < 22; i++){ g.fillStyle = 'rgba(30,36,46,.09)'; g.fillRect(Math.random() * w, Math.random() * h * 0.4, zufall(2, 6), zufall(40, 140)); }
    g.fillStyle = 'rgba(22,26,34,.55)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
  });
  const t = textur(c, true);
  return t;
}
// UV nach Fläche (Stufen waagerecht, Wände senkrecht) und Verdunklung nach unten
function betonVorbereiten(geo, hoehe){
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = [], col = [];
  for (let i = 0; i < pos.count; i++){
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.push(z / 4, x / 4); else if (nx > 0.5) uv.push(z / 4, y / 4); else uv.push(x / 4, y / 4);
    const flaeche = ny > 0.5 ? 1 : 0.8;
    const ao = 0.58 + 0.42 * Math.min(1, Math.max(0, y / hoehe));
    col.push(flaeche * ao, flaeche * ao, flaeche * ao * 1.02);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}

function tribuenenBauen(){
  const beton = new THREE.MeshLambertMaterial({ map:betonTextur(), vertexColors:true });
  const dach = new THREE.MeshLambertMaterial({ color:0x2a303a });
  const stahlM = new THREE.MeshLambertMaterial({ color:0x4b5460 });
  const leuchte = new THREE.MeshBasicMaterial({ color:0xfff1c4 });
  const fans = [], sitze = [];
  Welt.stadionTeile = [];
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
    betonVorbereiten(geo, SOCKEL + reihen * STUFE);
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
      // Dachbinder (Säulen und schräge Streben) und Leuchtband: je ein verschmolzenes Teil
      const stahlTeile = [], lampenTeile = [], weiss = [1, 1, 1];
      const platz = (geo, x, y, z, rz = 0) => { geo.rotateZ(rz); geo.translate(x, y, z); return geo; };
      for (let z = -laenge / 2; z <= laenge / 2 + 0.1; z += laenge / 4){
        stahlTeile.push([platz(new THREE.BoxGeometry(0.5, hoehe, 0.5), reihen * TIEFE + 0.5, hoehe / 2, z), weiss]);
        const sl = Math.hypot(reihen * TIEFE * 0.5, 2.6);
        stahlTeile.push([platz(new THREE.BoxGeometry(sl, 0.22, 0.22), reihen * TIEFE * 0.75 - 0.5, hoehe - 1.4, z, -Math.atan2(2.6, reihen * TIEFE * 0.5)), weiss]);
      }
      for (let z = -laenge / 2 + 2; z < laenge / 2; z += 4) lampenTeile.push([platz(new THREE.BoxGeometry(0.35, 0.18, 1.8), -2.8, hoehe - 0.55, z), weiss]);
      g.add(new THREE.Mesh(geoVerbinden(stahlTeile), stahlM));
      g.add(new THREE.Mesh(geoVerbinden(lampenTeile), leuchte));
    }
    // Lokale x-Achse zeigt vom Feld weg
    g.rotation.y = winkel;
    g.position.set(Math.cos(-winkel) * abstand, 0, Math.sin(-winkel) * abstand);
    szene.add(g);
    Welt.stadionTeile.push(g);
    g.updateMatrixWorld(true);
    // Sitzplätze
    const v = new THREE.Vector3();
    for (let r = 0; r < reihen; r++){
      for (let z = -laenge / 2 + 0.4; z < laenge / 2 - 0.3; z += 0.56){
        v.set(r * TIEFE + TIEFE * 0.4, SOCKEL + r * STUFE + 0.02, z);
        v.applyMatrix4(g.matrixWorld);
        sitze.push({ x:v.x, y:v.y, z:v.z, dreh:winkel, ton:Math.floor((z + laenge) / 7) & 1 });
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

  // Klappsitze (ein Zeichenaufruf): Sitzfläche und Lehne, in zwei Blautönen gestreift
  const sitzGeo = geoVerbinden([
    [new THREE.PlaneGeometry(0.4, 0.36).rotateX(-Math.PI / 2).translate(0, 0.17, 0), [1, 1, 1]],
    [new THREE.PlaneGeometry(0.4, 0.34).rotateY(-Math.PI / 2).translate(0.2, 0.36, 0), [0.82, 0.82, 0.82]]
  ]);
  const sitzMat = new THREE.MeshLambertMaterial({ side:THREE.DoubleSide, vertexColors:true });
  const sitzMesh = new THREE.InstancedMesh(sitzGeo, sitzMat, sitze.length);
  const sd = new THREE.Object3D(), sc = [new THREE.Color(0x1f3a78), new THREE.Color(0x3a4a70)];
  sitze.forEach((q, i) => {
    sd.position.set(q.x, q.y, q.z); sd.rotation.set(0, q.dreh, 0); sd.updateMatrix();
    sitzMesh.setMatrixAt(i, sd.matrix); sitzMesh.setColorAt(i, sc[q.ton]);
  });
  szene.add(sitzMesh);
  Welt.stadionTeile.push(sitzMesh);

  // Gemischt durcheinander, damit „jeden zweiten zeigen“ gleichmäßig ausdünnt
  for (let i = fans.length - 1; i > 0; i--){ const j = zufallGanz(i + 1); [fans[i], fans[j]] = [fans[j], fans[i]]; }
  const n = fans.length;
  const rumpf = new THREE.CylinderGeometry(0.27, 0.33, 0.7, 4); rumpf.rotateY(Math.PI / 4); rumpf.scale(1, 1, 0.72);
  const koerper = new THREE.InstancedMesh(rumpf, new THREE.MeshLambertMaterial(), n);
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
    r.addColorStop(0, 'rgba(255,250,230,1)'); r.addColorStop(0.12, 'rgba(255,244,210,.8)'); r.addColorStop(0.3, 'rgba(255,236,190,.28)'); r.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
    // Lichtstrahlen (Sternfilter)
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,240,200,.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(w * 0.04, w / 2); g.lineTo(w * 0.96, w / 2); g.moveTo(w / 2, w * 0.04); g.lineTo(w / 2, w * 0.96); g.stroke();
  });
  const lampen = leinwand(128, 64, (g, w, h) => {
    g.fillStyle = '#232830'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++){
      const gr = g.createRadialGradient(8 + x * 16, 8 + y * 16, 0, 8 + x * 16, 8 + y * 16, 7);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#fffbe8'); gr.addColorStop(1, '#b8a876');
      g.fillStyle = gr; g.beginPath(); g.arc(8 + x * 16, 8 + y * 16, 7, 0, Math.PI * 2); g.fill();
    }
  });
  const gitter = leinwand(64, 64, (g, w, h) => {
    g.fillStyle = '#4a525d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8a95a3'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.moveTo(0, 1); g.lineTo(w, 1); g.moveTo(0, h - 1); g.lineTo(w, h - 1); g.stroke();
  });
  const gt = textur(gitter, true); gt.repeat.set(2, 14);
  const spriteMat = new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(glanz), blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, fog:false });
  const mastMat = new THREE.MeshLambertMaterial({ map:gt });
  const rahmenMat = new THREE.MeshLambertMaterial({ color:0x3d444e });
  const lampMat = new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(lampen) });
  // Lichtkegel: additiv, vom Scheinwerfer zum Rasen hin ausklingend
  const L = 80, kegel = new THREE.ConeGeometry(21, L, 28, 1, true).rotateX(-Math.PI / 2).translate(0, 0, L / 2);
  const kc = [];
  for (let i = 0; i < kegel.attributes.position.count; i++){ const f = kegel.attributes.position.getZ(i) / L; const v = 0.075 * (1 - f) * (1 - f); kc.push(v, v * 0.95, v * 0.8); }
  kegel.setAttribute('color', new THREE.Float32BufferAttribute(kc, 3));
  const kegelMat = new THREE.MeshBasicMaterial({ vertexColors:true, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false, side:THREE.DoubleSide, fog:false });
  Welt.maste = []; Welt.kegel = [];
  for (const s of [1, -1]) for (const t of [1, -1]){
    const x = s * (HL + BANDE + 16), z = t * (HB + BANDE + 18), h = 42;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.95, h, 8), mastMat);
    mast.position.set(x, h / 2, z);
    szene.add(mast);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.6), [rahmenMat, rahmenMat, rahmenMat, rahmenMat, lampMat, rahmenMat]);
    panel.position.set(x, h + 2, z);
    panel.lookAt(0, 0, 0);
    szene.add(panel);
    const rahmen = new THREE.Mesh(new THREE.BoxGeometry(9.5, 5.5, 0.4), rahmenMat);
    rahmen.position.copy(panel.position); rahmen.quaternion.copy(panel.quaternion); rahmen.translateZ(-0.35);
    szene.add(rahmen);
    const sp = new THREE.Sprite(spriteMat);
    sp.scale.set(40, 40, 1);
    sp.position.set(x * 0.985, h + 2, z * 0.985);
    szene.add(sp);
    const kg = new THREE.Mesh(kegel, kegelMat);
    kg.position.copy(panel.position); kg.lookAt(0, 0, 0); kg.renderOrder = 3;
    szene.add(kg);
    Welt.maste.push(mast, panel, rahmen, sp);
    Welt.kegel.push(kg);
  }
}

/* ---------- Ball ---------- */
function ballBauen(){
  // Klassisches Muster: schwarze Fünfecke an den Ecken eines Ikosaeders, weiche Kanten, Nähte, leichtes Leder
  const phi = (1 + Math.sqrt(5)) / 2;
  const ecken = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]]
    .map(v => { const l = Math.hypot(...v); return v.map(k => k / l); });
  const c = leinwand(1024, 512, (g, w, h) => {
    const bild = g.createImageData(w, h), d = bild.data;
    for (let py = 0; py < h; py++){
      const lat = (0.5 - (py + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let px = 0; px < w; px++){
        const lon = ((px + 0.5) / w) * Math.PI * 2;
        const x = -Math.cos(lon) * cl, y = sl, z = Math.sin(lon) * cl;
        let d1 = -2, d2 = -2;
        for (const e of ecken){
          const a = x * e[0] + y * e[1] + z * e[2];
          if (a > d1){ d2 = d1; d1 = a; } else if (a > d2) d2 = a;
        }
        const a1 = Math.acos(Math.min(1, d1)), a2 = Math.acos(Math.min(1, d2));
        const pent = 1 - glaetten(0.315, 0.355, a1);                    // Fünfeck (weich)
        const naht = (1 - glaetten(0.0, 0.05, a2 - a1)) * glaetten(0.42, 0.5, a1); // Naht zwischen Sechsecken
        const rand = 1 - glaetten(0.0, 0.03, Math.abs(a1 - 0.34));       // Naht um das Fünfeck
        let v = 246 - (0.62 - Math.min(0.62, a1)) * 14;                   // Sechsecke wölben sich leicht
        v = v * (1 - naht * 0.32) * (1 - rand * 0.25 * (1 - pent));
        v = v * (1 - pent) + 26 * pent;
        v += (Math.random() - 0.5) * 6;
        const o = (py * w + px) * 4;
        d[o] = v; d[o + 1] = v; d[o + 2] = v * 1.01; d[o + 3] = 255;
      }
    }
    g.putImageData(bild, 0, 0);
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 36, 24), new THREE.MeshPhongMaterial({ map:textur(c), shininess:70, specular:0x555555 }));
  ball.castShadow = true;
  ball.scale.setScalar(1.18);    // optisch etwas größer, damit man ihn aus der Fernsehkamera gut sieht (Physik bleibt)
  szene.add(ball);
  Welt.ball = ball;
  const schatten = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.35, depthWrite:false }));
  schatten.position.y = 0.02;
  szene.add(schatten);
  Welt.ballSchatten = schatten;
}
