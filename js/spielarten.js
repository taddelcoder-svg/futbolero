'use strict';
// Futbolero – Spielarten: Halle und Straße (Wände statt Aus), Powerups im Arcade-Modus und das
// Training für Standardsituationen (Freistöße, Elfmeter, Ecken).

/* ---------- Spielfeld ---------- */
const ARENA_NAME = { stadion:'Stadion', halle:'Halle', strasse:'Straße' };

function bodenTextur(art){
  Welt.boeden = Welt.boeden || {};
  if (Welt.boeden[art]) return Welt.boeden[art];
  if (art === 'stadion') return Welt.boeden[art] = Welt.grasTextur;
  const breite = FELD.L + 2 * BANDE + 2, tiefe = FELD.B + 2 * BANDE + 2;
  const c = leinwand(2048, 1024, (g, w, h) => {
    const mx = x => (x + breite / 2) / breite * w, mz = z => (z + tiefe / 2) / tiefe * h;
    if (art === 'halle'){
      // Hallenboden: glänzender blauer Kunststoff, Strafräume dunkler, Rand in Orange mit Parkettfugen
      g.fillStyle = '#c4632b'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 26){ g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(x, 0, 2, h); }
      for (let y = 0; y < h; y += 130){ for (let x = (y / 130 & 1) * 13; x < w; x += 26){ g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x, y, 2, 130); } }
      const feld = g.createLinearGradient(0, mz(-HB), 0, mz(HB));
      feld.addColorStop(0, '#234f8c'); feld.addColorStop(0.5, '#2455a0'); feld.addColorStop(1, '#1e4680');
      g.fillStyle = feld; g.fillRect(mx(-HL), mz(-HB), mx(HL) - mx(-HL), mz(HB) - mz(-HB));
      for (const s of [1, -1]){
        g.fillStyle = 'rgba(8,24,60,.28)';
        g.fillRect(Math.min(mx(s * HL), mx(s * (HL - STRAF.T))), mz(-STRAF.B / 2), Math.abs(mx(HL) - mx(HL - STRAF.T)), mz(STRAF.B / 2) - mz(-STRAF.B / 2));
        g.fillStyle = 'rgba(8,24,60,.22)';
        g.fillRect(Math.min(mx(s * HL), mx(s * (HL - TORRAUM.T))), mz(-TORRAUM.B / 2), Math.abs(mx(HL) - mx(HL - TORRAUM.T)), mz(TORRAUM.B / 2) - mz(-TORRAUM.B / 2));
      }
      g.fillStyle = 'rgba(255,255,255,.1)'; g.font = '800 120px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(mx(0), mz(0)); g.rotate(0); g.fillText('FUTBOLERO', 0, 0); g.restore();
      // Feine Kunststoffmaserung
      const bild = g.getImageData(0, 0, w, h), d = bild.data;
      for (let i = 0; i < d.length; i += 4){ const n = (Math.random() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      g.putImageData(bild, 0, 0);
      // Spiegelungen der Hallenlampen auf dem glatten Boden
      for (const lx of [-0.4, -0.2, 0, 0.2, 0.4]) for (const lz of [-0.3, 0.3]){
        const gx = mx(lx * FELD.L), gz = mz(lz * FELD.B);
        const gr = g.createRadialGradient(gx, gz, 0, gx, gz, 120);
        gr.addColorStop(0, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(gx - 120, gz - 120, 240, 240);
      }
    } else {
      // Asphalt mit Flecken, Rissen, Flickstellen, Ölflecken und Kreidezeichnungen
      g.fillStyle = '#4a4d52'; g.fillRect(0, 0, w, h);
      const grob = rauschGitter(24, 14);
      const bild = g.getImageData(0, 0, w, h), d = bild.data;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++){
        const o = (py * w + px) * 4, n = (Math.random() - 0.5) * 30 + (rauschLesen(grob, px / w, py / h) - 0.5) * 22;
        d[o] += n; d[o + 1] += n; d[o + 2] += n * 1.04;
      }
      g.putImageData(bild, 0, 0);
      // Flickstellen: rechteckige, dunklere Asphaltteile
      for (let i = 0; i < 7; i++){
        const x = Math.random() * w, y = Math.random() * h, bw = zufall(60, 200), bh = zufall(30, 90);
        g.fillStyle = 'rgba(20,22,26,.22)'; g.fillRect(x, y, bw, bh);
        g.strokeStyle = 'rgba(10,10,12,.35)'; g.lineWidth = 2; g.strokeRect(x, y, bw, bh);
      }
      g.strokeStyle = 'rgba(18,18,22,.55)'; g.lineWidth = 1.6; g.lineJoin = 'round';
      for (let i = 0; i < 44; i++){
        let x = Math.random() * w, y = Math.random() * h;
        g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 7; j++){ x += zufall(-26, 26); y += zufall(-18, 18); g.lineTo(x, y); }
        g.stroke();
      }
      for (let i = 0; i < 40; i++){
        g.fillStyle = `rgba(0,0,0,${zufall(0.05, 0.13)})`;
        g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, zufall(10, 38), zufall(6, 18), Math.random() * 3, 0, Math.PI * 2); g.fill();
      }
      // Reifenspuren
      g.strokeStyle = 'rgba(15,15,18,.2)'; g.lineWidth = 6;
      for (let i = 0; i < 4; i++){ g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + zufall(-60, 60), w * 0.6, y + zufall(-60, 60), w, y + zufall(-40, 40)); g.stroke(); }
      // Kreide: Himmel-und-Hölle-Kästchen, Sonne, Pfeil (vor allem im Randbereich)
      g.strokeStyle = 'rgba(255,245,200,.5)'; g.lineWidth = 3; g.lineCap = 'round';
      const hx = mx(-HL + 6), hz = mz(HB + 2.4);
      for (let i = 0; i < 5; i++) g.strokeRect(hx + (i % 2) * 20, hz - i * 20, 20, 20);
      g.strokeStyle = 'rgba(255,140,180,.55)';
      g.beginPath(); g.arc(mx(HL - 8), mz(HB + 2.6), 12, 0, 6.3); g.stroke();
      for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4; g.beginPath(); g.moveTo(mx(HL - 8) + Math.cos(a) * 16, mz(HB + 2.6) + Math.sin(a) * 16); g.lineTo(mx(HL - 8) + Math.cos(a) * 26, mz(HB + 2.6) + Math.sin(a) * 26); g.stroke(); }
      // Bordstein / Gehweg um den Käfig
      g.fillStyle = 'rgba(150,150,150,.28)'; g.fillRect(0, 0, w, mz(-HB - 1.6)); g.fillRect(0, mz(HB + 1.6), w, h);
      g.fillRect(0, 0, mx(-HL - 1.6), h); g.fillRect(mx(HL + 1.6), 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.5;
      for (let x = 0; x < w; x += 46){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, mz(-HB - 1.6)); g.moveTo(x, mz(HB + 1.6)); g.lineTo(x, h); g.stroke(); }
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
    // Handlauf oben, Pfosten alle paar Meter
    const schiene = new THREE.Mesh(new THREE.BoxGeometry(l, 0.08, 0.1), rahmen);
    schiene.position.set((ax + bx) / 2, y1, (az + bz) / 2); schiene.rotation.y = m.rotation.y; g.add(schiene);
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

/* ---------- Licht und Umgebung je Spielort ---------- */
const STIMMUNG = {
  stadion:{ nebel:0x1d2544, n0:150, n1:360, hemi:[0xd4e2ff, 0x21402a, 0.66], sonne:[0xfff3dc, 0.84, -22, 60, 28], fuell:[0xc9d8ff, 0.3] },
  strasse:{ nebel:0x7a5068, n0:90, n1:300, hemi:[0xffd7b8, 0x3b3040, 0.8], sonne:[0xffb878, 0.98, -38, 36, 26], fuell:[0x9fb4ff, 0.3] },
  halle:{ nebel:0x141a26, n0:140, n1:320, hemi:[0xe4ecff, 0x2a3a55, 0.72], sonne:[0xffffff, 0.46, -10, 60, 14], fuell:[0xdfe9ff, 0.3] }
};
function stimmungSetzen(art){
  const st = STIMMUNG[art] || STIMMUNG.stadion;
  szene.fog.color.setHex(st.nebel); szene.fog.near = st.n0; szene.fog.far = st.n1;
  szene.background.setHex(art === 'halle' ? 0x0d1119 : art === 'strasse' ? 0x3a2a40 : 0x0d1426);
  Welt.hemi.color.setHex(st.hemi[0]); Welt.hemi.groundColor.setHex(st.hemi[1]); Welt.hemi.intensity = st.hemi[2];
  sonne.color.setHex(st.sonne[0]); sonne.intensity = st.sonne[1]; sonne.position.set(st.sonne[2], st.sonne[3], st.sonne[4]);
  Welt.fuell.color.setHex(st.fuell[0]); Welt.fuell.intensity = st.fuell[1];
  himmelFaerben(art);
  const nacht = art === 'stadion';
  Welt.sterne.visible = Welt.mond.visible = nacht;
  Welt.himmel.visible = art !== 'halle';
  for (const w of Welt.wolken) { w.visible = art !== 'halle'; w.material.color.setHex(nacht ? 0x8f7fb8 : 0xffb48a); w.material.opacity = nacht ? 0.55 : 0.7; }
  Welt.stadtRing.visible = art !== 'halle';
  // Maste, Lichtkegel und Tribünen gehören ins Stadion; die Tribünen auch in die Halle
  for (const o of Welt.maste || []) o.visible = nacht;
  for (const k of Welt.kegel || []) k.visible = nacht && !!k.userData.hoch;
  for (const o of Welt.stadionTeile || []) o.visible = art !== 'strasse';
  Welt.rasenRand.visible = art !== 'strasse';
  // Boden: Beton im Stadion, Asphalt auf der Straße, Hallenboden in der Halle
  Welt.boden.material.color.setHex(art === 'strasse' ? 0xb0aeb4 : art === 'halle' ? 0x8c97aa : 0xffffff);
  // Hallenboden glänzt
  if (!Welt.rasenMat){
    Welt.rasenMat = { glatt:Welt.rasen.material, glanz:new THREE.MeshPhongMaterial({ shininess:45, specular:0x1c2638 }) };
  }
  const gewuenscht = art === 'halle' ? Welt.rasenMat.glanz : Welt.rasenMat.glatt;
  if (Welt.rasen.material !== gewuenscht) Welt.rasen.material = gewuenscht;
}

// Die Halle: Wände, Dach mit Bindern, Hallenlampen
function halleBauen(){
  const g = new THREE.Group();
  const W = 168, D = 150, H = 40;
  const wand = leinwand(512, 256, (c, w, h) => {
    c.fillStyle = '#1b2230'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32){ c.fillStyle = (x / 32) & 1 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.08)'; c.fillRect(x, 0, 32, h); }
    c.fillStyle = '#10151f'; c.fillRect(0, h * 0.72, w, h * 0.28);                         // Sockel
    c.fillStyle = 'rgba(160,200,255,.9)';                                                     // Lichtband (Oberlichter)
    for (let x = 8; x < w; x += 64){ const gr = c.createLinearGradient(0, 40, 0, 74); gr.addColorStop(0, 'rgba(190,220,255,.95)'); gr.addColorStop(1, 'rgba(110,150,210,.8)'); c.fillStyle = gr; c.fillRect(x, 40, 48, 34); }
    c.fillStyle = '#2d3646'; c.fillRect(0, 36, w, 4); c.fillRect(0, 74, w, 4);
    c.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 90; y < h * 0.72; y += 18) c.fillRect(0, y, w, 2);
  });
  const wt = textur(wand, true); wt.repeat.set(5, 1);
  const decke = leinwand(256, 256, (c, w, h) => {
    c.fillStyle = '#0e121a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2b3342'; c.lineWidth = 6;
    for (let i = 0; i <= 4; i++){ c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); }
  });
  const dt = textur(decke, true); dt.repeat.set(10, 10);
  const wm = new THREE.MeshBasicMaterial({ map:wt, side:THREE.BackSide, fog:false });
  const dm = new THREE.MeshBasicMaterial({ map:dt, side:THREE.BackSide, fog:false });
  const huelle = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [wm, wm, dm, wm, wm, wm]);
  huelle.position.set(0, H / 2 - 0.05, -4);
  g.add(huelle);
  // Dachbinder und Lampen
  const stahl = new THREE.MeshLambertMaterial({ color:0x3c4554 });
  for (let x = -60; x <= 60; x += 20){
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, D - 2), stahl); b.position.set(x, H - 3.2, -4); g.add(b);
  }
  const glanz = leinwand(128, 128, (c, w) => {
    const r = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.2, 'rgba(235,242,255,.6)'); r.addColorStop(1, 'rgba(210,225,255,0)');
    c.fillStyle = r; c.fillRect(0, 0, w, w);
  });
  const spriteMat = new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(glanz), blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, fog:false, opacity:0.8 });
  const lampMat = new THREE.MeshBasicMaterial({ color:0xf4f8ff });
  const lampGeo = new THREE.BoxGeometry(7, 0.35, 1.4);
  for (const x of [-48, -24, 0, 24, 48]) for (const z of [-22, 22]){
    const l = new THREE.Mesh(lampGeo, lampMat); l.position.set(x, H - 4.4, z); g.add(l);
    const sp = new THREE.Sprite(spriteMat); sp.scale.set(26, 26, 1); sp.position.set(x, H - 5.4, z); g.add(sp);
  }
  return g;
}

// Die Straße: Graffiti-Wand, Mietshäuser mit erleuchteten Fenstern, Laternen, parkende Autos, Bäume
function fassadeTextur(w, h, farbe){
  return leinwand(256, 512, (c, cw, ch) => {
    c.fillStyle = farbe; c.fillRect(0, 0, cw, ch);
    const nx = Math.max(3, Math.round(w / 3.2)), ny = Math.max(4, Math.round(h / 3.4));
    for (let i = 0; i < 1800; i++){ c.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; c.fillRect(Math.random() * cw, Math.random() * ch, 3, 2); }
    const fw = cw / nx, fh = ch / ny;
    for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx; x++){
      const px = x * fw + fw * 0.22, py = y * fh + fh * 0.18, bw = fw * 0.56, bh = fh * 0.58;
      const an = Math.random() < 0.42;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(px - 2, py - 2, bw + 4, bh + 4);
      if (an){ const gr = c.createLinearGradient(0, py, 0, py + bh); gr.addColorStop(0, '#ffd98a'); gr.addColorStop(1, '#f2a94e'); c.fillStyle = gr; }
      else c.fillStyle = Math.random() < 0.5 ? '#2a3350' : '#35405f';
      c.fillRect(px, py, bw, bh);
      if (an && Math.random() < 0.5){ c.fillStyle = 'rgba(20,20,30,.45)'; c.fillRect(px, py, bw * 0.5, bh); }
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(px + bw / 2 - 1, py, 2, bh);
      c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(px - 3, py + bh + 2, bw + 6, 3);       // Fensterbank
    }
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, ch - fh, cw, fh);                            // Erdgeschoss dunkler
  });
}
function graffitiTextur(){
  return leinwand(1024, 256, (g, w, h) => {
    g.fillStyle = '#756f66'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16){ g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(0, y, w, 2); for (let x = (y / 16 & 1) * 32; x < w; x += 64){ g.fillRect(x, y, 2, 16); } }
    for (let i = 0; i < 2500; i++){ g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const tag = (text, x, y, size, f1, f2, dreh) => {
      g.save(); g.translate(x, y); g.rotate(dreh);
      g.font = `800 ${size}px "Barlow Semi Condensed", "Arial Narrow", Arial, sans-serif`;
      g.lineWidth = size * 0.2; g.strokeStyle = '#161616'; g.strokeText(text, 6, 7);
      g.lineWidth = size * 0.13; g.strokeStyle = '#fff'; g.strokeText(text, 0, 0);
      const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, f1); gr.addColorStop(1, f2);
      g.fillStyle = gr; g.fillText(text, 0, 0);
      g.restore();
    };
    tag('FUTBOLERO', 300, 120, 128, '#ffe14d', '#ff7a1a', -0.04);
    tag('LÖWEN', 760, 78, 72, '#7ff0ff', '#2a7fff', 0.05);
    tag('GOAL!', 820, 190, 64, '#ff6fb1', '#a02bff', -0.06);
    g.fillStyle = '#ffd84a'; g.beginPath(); for (let i = 0; i < 10; i++){ const a = i * Math.PI / 5 - Math.PI / 2, r = i & 1 ? 12 : 28; g.lineTo(80 + Math.cos(a) * r, 60 + Math.sin(a) * r); } g.closePath(); g.fill();
    g.strokeStyle = '#161616'; g.lineWidth = 3; g.stroke();
    // Tropfen
    for (let i = 0; i < 18; i++){ g.strokeStyle = ['#ffe14d', '#ff7a1a', '#2a7fff', '#ff6fb1'][i & 3]; g.lineWidth = 3; const x = 120 + i * 48 + zufall(-10, 10); g.beginPath(); g.moveTo(x, 190); g.lineTo(x, 190 + zufall(10, 50)); g.stroke(); }
  });
}
function strasseBauen(){
  const g = new THREE.Group();
  // Graffiti-Wand hinter dem Käfig (gegenüber der Kamera) und niedrigere Mauer an den Seiten
  const gt = new THREE.CanvasTexture(graffitiTextur()); gt.anisotropy = 4;
  const wandMat = new THREE.MeshLambertMaterial({ map:gt });
  gt.wrapS = THREE.RepeatWrapping; gt.repeat.set(4.5, 1);
  const wand = new THREE.Mesh(new THREE.BoxGeometry(110, 6, 0.8), wandMat);
  wand.position.set(0, 3, -HB - BANDE - 8); g.add(wand);
  const kappe = new THREE.Mesh(new THREE.BoxGeometry(110.4, 0.4, 1.2), new THREE.MeshLambertMaterial({ color:0x8f8a82 }));
  kappe.position.set(0, 6.2, -HB - BANDE - 8); g.add(kappe);
  // Mietshäuser dahinter und an den Seiten
  const farben = ['#8c4a3a', '#a8774f', '#6e6f78', '#9b8b6e', '#7d4b4b', '#5f6d7d'];
  const haus = (x, z, w, hoehe, tiefe, drehung) => {
    const f = fassadeTextur(w, hoehe, farben[(Math.random() * farben.length) | 0]);
    const t = new THREE.CanvasTexture(f); t.anisotropy = 4;
    const front = new THREE.MeshLambertMaterial({ map:t }), seite = new THREE.MeshLambertMaterial({ color:0x4a4448 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hoehe, tiefe), [seite, seite, seite, seite, front, front]);
    m.position.set(x, hoehe / 2, z); m.rotation.y = drehung; g.add(m);
    const dachbau = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.8, tiefe * 0.4), seite);
    dachbau.position.set(x, hoehe + 0.9, z); dachbau.rotation.y = drehung; g.add(dachbau);
  };
  let x = -64;
  while (x < 62){ const w = zufall(14, 22); haus(x + w / 2, -HB - BANDE - 22, w, zufall(22, 36), 14, 0); x += w + zufall(0, 2); }
  let z = -HB - BANDE - 4;
  while (z < HB + BANDE + 30){ const w = zufall(14, 22); haus(-HL - BANDE - 26, z + w / 2, w, zufall(20, 34), 14, Math.PI / 2); haus(HL + BANDE + 26, z + w / 2, w, zufall(20, 34), 14, -Math.PI / 2); z += w + zufall(0, 2); }
  // Laternen mit warmem Schein
  const mast = new THREE.MeshLambertMaterial({ color:0x2c3138 });
  const lichtTex = leinwand(128, 128, (c, w) => {
    const r = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.18, 'rgba(255,200,120,.6)'); r.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = r; c.fillRect(0, 0, w, w);
  });
  const lichtMat = new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(lichtTex), blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, fog:false });
  const kopfMat = new THREE.MeshBasicMaterial({ color:0xffeab0 });
  for (const [lx, lz] of [[-26, -HB - BANDE - 3], [26, -HB - BANDE - 3], [-HL - BANDE - 4, -10], [HL + BANDE + 4, 10], [-26, HB + BANDE + 3], [26, HB + BANDE + 3]]){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 8.5, 8), mast); p.position.set(lx, 4.25, lz); g.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), mast); arm.position.set(lx + (lx < 0 ? 0.9 : -0.9), 8.5, lz); g.add(arm);
    const kopf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.45), kopfMat); kopf.position.set(lx + (lx < 0 ? 1.7 : -1.7), 8.4, lz); g.add(kopf);
    const sp = new THREE.Sprite(lichtMat); sp.scale.set(16, 16, 1); sp.position.set(lx + (lx < 0 ? 1.7 : -1.7), 8.2, lz); g.add(sp);
  }
  // Parkende Autos und Container
  const rad = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12).rotateX(Math.PI / 2);
  const radMat = new THREE.MeshLambertMaterial({ color:0x15171a }), glas = new THREE.MeshLambertMaterial({ color:0x2a3a52 });
  const lichtRot = new THREE.MeshBasicMaterial({ color:0xff4040 }), lichtWeiss = new THREE.MeshBasicMaterial({ color:0xfff4d0 });
  const auto = (ax, az, farbe, dreh) => {
    const a = new THREE.Group();
    const lack = new THREE.MeshPhongMaterial({ color:farbe, shininess:70, specular:0x555555 });
    const k = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.8, 1.8), lack); k.position.y = 0.7; a.add(k);
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.64), glas); d.position.set(-0.1, 1.4, 0); a.add(d);
    const dd = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.7), lack); dd.position.set(-0.1, 1.78, 0); a.add(dd);
    for (const [wx, wz] of [[1.35, 0.9], [1.35, -0.9], [-1.35, 0.9], [-1.35, -0.9]]){ const r = new THREE.Mesh(rad, radMat); r.position.set(wx, 0.34, wz); a.add(r); }
    for (const sz of [0.6, -0.6]){
      const sf = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.34), lichtWeiss); sf.position.set(2.1, 0.8, sz); a.add(sf);
      const sr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.34), lichtRot); sr.position.set(-2.1, 0.8, sz); a.add(sr);
    }
    a.position.set(ax, 0, az); a.rotation.y = dreh; a.traverse(o => { o.castShadow = false; }); g.add(a);
  };
  auto(-34, -HB - BANDE - 13, 0xc0392b, 0.04); auto(-8, -HB - BANDE - 13, 0x2e86de, -0.02); auto(40, -HB - BANDE - 13, 0xf1c40f, 0.03);
  auto(-HL - BANDE - 12, 14, 0x27ae60, Math.PI / 2 + 0.05); auto(HL + BANDE + 12, -14, 0xecf0f1, Math.PI / 2 - 0.04);
  // Bäume
  const stamm = new THREE.MeshLambertMaterial({ color:0x4b3426 }), laub = [new THREE.MeshLambertMaterial({ color:0x3f7d3a }), new THREE.MeshLambertMaterial({ color:0x4f8f3d })];
  const krone = new THREE.IcosahedronGeometry(1, 1), stammGeo = new THREE.CylinderGeometry(0.22, 0.32, 3.4, 8);
  for (const [tx, tz] of [[-46, -HB - BANDE - 11], [-16, -HB - BANDE - 11], [16, -HB - BANDE - 11], [48, -HB - BANDE - 11], [-HL - BANDE - 9, -24], [HL + BANDE + 9, 26]]){
    const s = new THREE.Mesh(stammGeo, stamm); s.position.set(tx, 1.7, tz); g.add(s);
    for (let i = 0; i < 3; i++){
      const k = new THREE.Mesh(krone, laub[i & 1]); const r = zufall(1.8, 2.7);
      k.scale.set(r, r * 0.85, r); k.position.set(tx + zufall(-1.2, 1.2), 4.4 + i * 0.8, tz + zufall(-1.2, 1.2)); g.add(k);
    }
  }
  return g;
}

function umgebungHolen(art){
  Welt.umgebung = Welt.umgebung || {};
  if (art !== 'halle' && art !== 'strasse') return null;
  if (!Welt.umgebung[art]){
    Welt.umgebung[art] = art === 'halle' ? halleBauen() : strasseBauen();
    szene.add(Welt.umgebung[art]);
  }
  return Welt.umgebung[art];
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
  stimmungSetzen(art);
  if (Welt.rasen){ Welt.rasen.material.map = bodenTextur(art); Welt.rasen.material.needsUpdate = true; }
  if (Welt.waende){ szene.remove(Welt.waende); Welt.waende = null; }
  if (ARENA.wand){ Welt.waende = waendeBauen(art); szene.add(Welt.waende); }
  for (const k of ['halle', 'strasse']){ const u = umgebungHolen(art === k ? k : null); if (Welt.umgebung && Welt.umgebung[k]) Welt.umgebung[k].visible = art === k; }
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
