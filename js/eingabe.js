'use strict';
// Futbolero – Eingabe: Tastatur, Touch (Stick + Knöpfe) und Controller landen in einem gemeinsamen Zustand.
// Knöpfe haben: halten, neu (in diesem Bild gedrückt), los (in diesem Bild losgelassen), dauer, verbraucht.

function neueTaste(){ return { halten:false, neu:false, los:false, dauer:0, verbraucht:false, quellen:new Set() }; }
const eingabe = {
  x:0, z:0, sprint:false, tipp:false,
  tasten:{ pass:neueTaste(), schuss:neueTaste(), heber:neueTaste(), wechsel:neueTaste(), graetsche:neueTaste() },
  beiPause:null, beiTon:null, aktiv:false
};

function druecken(name, quelle){
  const t = eingabe.tasten[name];
  if (!t || t.quellen.has(quelle)) return;
  const war = t.quellen.size > 0;
  t.quellen.add(quelle);
  if (!war){ t.halten = true; t.neu = true; t.dauer = 0; t.verbraucht = false; }
}
function loslassen(name, quelle){
  const t = eingabe.tasten[name];
  if (!t || !t.quellen.delete(quelle)) return;
  if (t.quellen.size === 0){ t.halten = false; t.los = true; }
}
function allesLoslassen(){
  for (const [name, t] of Object.entries(eingabe.tasten)) for (const q of [...t.quellen]) loslassen(name, q);
  tastatur.clear();
  stick.x = stick.z = 0; stick.id = null;
  touchSprint = false;
}

/* ---------- Tastatur ---------- */
const tastatur = new Set();
const TASTEN = {
  Space:'pass', AltLeft:'heber', AltRight:'heber', ControlLeft:'graetsche',
  KeyK:'pass', KeyJ:'schuss', KeyL:'heber', KeyQ:'wechsel', KeyE:'wechsel'
};
const SPIELTASTEN = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', ...Object.keys(TASTEN)]);
addEventListener('keydown', e => {
  Ton.start();
  if (e.code === 'KeyP' || e.code === 'Escape'){ if (!e.repeat && eingabe.beiPause) eingabe.beiPause(); return; }
  if (e.code === 'KeyM' && !e.repeat && eingabe.beiTon){ eingabe.beiTon(); return; }
  if (!eingabe.aktiv) return;
  if (SPIELTASTEN.has(e.code)){
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  tastatur.add(e.code);
  if (TASTEN[e.code] && !e.repeat) druecken(TASTEN[e.code], 'k' + e.code);
});
addEventListener('keyup', e => {
  // Alt allein würde sonst beim Loslassen das Browsermenü öffnen
  if (eingabe.aktiv && SPIELTASTEN.has(e.code)) e.preventDefault();
  tastatur.delete(e.code);
  if (TASTEN[e.code]) loslassen(TASTEN[e.code], 'k' + e.code);
});
addEventListener('blur', allesLoslassen);
document.addEventListener('visibilitychange', () => { if (document.hidden) allesLoslassen(); });

/* ---------- Touch ---------- */
const stick = { id:null, ox:0, oy:0, x:0, z:0 };
let touchSprint = false;
function touchEinrichten(){
  const feld = document.getElementById('stickfeld');
  const st = document.getElementById('stick'), knauf = document.getElementById('knauf');
  const RADIUS = 56;
  const stickRuhe = () => {
    const r = feld.getBoundingClientRect();
    st.style.left = (r.left + Math.min(120, r.width * 0.35)) + 'px';
    st.style.top = (r.bottom - 110) + 'px';
    knauf.style.transform = '';
    st.classList.remove('an', 'sprint');
  };
  stickRuhe();
  addEventListener('resize', stickRuhe);
  feld.addEventListener('pointerdown', e => {
    Ton.start();
    if (stick.id !== null) return;
    stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
    st.style.left = e.clientX + 'px'; st.style.top = e.clientY + 'px';
    st.classList.add('an');
    feld.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  feld.addEventListener('pointermove', e => {
    if (e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const l = Math.hypot(dx, dy);
    if (l > RADIUS){ dx *= RADIUS / l; dy *= RADIUS / l; }
    stick.x = dx / RADIUS; stick.z = dy / RADIUS;
    knauf.style.transform = `translate(${dx}px, ${dy}px)`;
    st.classList.toggle('sprint', Math.hypot(stick.x, stick.z) > 0.96);
  });
  const ende = e => {
    if (e.pointerId !== stick.id) return;
    stick.id = null; stick.x = stick.z = 0;
    stickRuhe();
  };
  feld.addEventListener('pointerup', ende);
  feld.addEventListener('pointercancel', ende);

  for (const k of document.querySelectorAll('.tk')){
    const name = k.dataset.t;
    const an = e => {
      e.preventDefault(); Ton.start();
      k.classList.add('an');
      k.setPointerCapture(e.pointerId);
      if (name === 'sprint') touchSprint = true; else druecken(name, 't' + e.pointerId);
    };
    const aus = e => {
      k.classList.remove('an');
      if (name === 'sprint') touchSprint = false; else loslassen(name, 't' + e.pointerId);
    };
    k.addEventListener('pointerdown', an);
    k.addEventListener('pointerup', aus);
    k.addEventListener('pointercancel', aus);
    k.addEventListener('contextmenu', e => e.preventDefault());
  }
  document.getElementById('spiel').addEventListener('pointerdown', () => { eingabe.tipp = true; Ton.start(); });
}

/* ---------- Maus: linke Taste schießt ---------- */
const leinwandEl = document.getElementById('spiel');
leinwandEl.addEventListener('pointerdown', e => {
  eingabe.tipp = true; Ton.start();
  if (e.pointerType === 'mouse' && e.button === 0 && eingabe.aktiv){ e.preventDefault(); druecken('schuss', 'maus'); }
});
addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) loslassen('schuss', 'maus'); });
leinwandEl.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- Controller ---------- */
const pad = { knoepfe:[], start:false };
function padAbfragen(){
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of pads) if (g && g.connected){ gp = g; break; }
  if (!gp) return null;
  const k = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const belegung = [[0, 'pass'], [1, 'schuss'], [2, 'heber'], [3, 'heber'], [4, 'wechsel']];
  for (const [i, name] of belegung){
    const jetzt = k(i);
    if (jetzt && !pad.knoepfe[i]) druecken(name, 'p' + i);
    if (!jetzt && pad.knoepfe[i]) loslassen(name, 'p' + i);
    pad.knoepfe[i] = jetzt;
  }
  if (k(9) && !pad.start && eingabe.beiPause) eingabe.beiPause();
  pad.start = k(9);
  let x = gp.axes[0] || 0, z = gp.axes[1] || 0;
  if (Math.hypot(x, z) < 0.2){ x = 0; z = 0; }
  if (k(12)) z = -1; if (k(13)) z = 1; if (k(14)) x = -1; if (k(15)) x = 1;
  const sprint = k(5) || k(7) || (gp.buttons[7] && gp.buttons[7].value > 0.3);
  return { x, z, sprint };
}

/* ---------- Pro Bild ---------- */
function eingabeRahmen(dt){
  for (const t of Object.values(eingabe.tasten)) if (t.halten) t.dauer += dt;
  let kx = 0, kz = 0;
  if (tastatur.has('KeyA') || tastatur.has('ArrowLeft')) kx -= 1;
  if (tastatur.has('KeyD') || tastatur.has('ArrowRight')) kx += 1;
  if (tastatur.has('KeyW') || tastatur.has('ArrowUp')) kz -= 1;
  if (tastatur.has('KeyS') || tastatur.has('ArrowDown')) kz += 1;
  const kl = Math.hypot(kx, kz);
  if (kl > 0){ kx /= kl; kz /= kl; }
  const p = padAbfragen();
  const quellen = [[kx, kz], [stick.x, stick.z], p ? [p.x, p.z] : [0, 0]];
  let bx = 0, bz = 0, bl = 0;
  for (const [x, z] of quellen){ const l = Math.hypot(x, z); if (l > bl){ bl = l; bx = x; bz = z; } }
  eingabe.x = bx; eingabe.z = bz;
  eingabe.sprint = tastatur.has('ShiftLeft') || tastatur.has('ShiftRight') || touchSprint || Math.hypot(stick.x, stick.z) > 0.96 || !!(p && p.sprint);
}
function eingabeRahmenEnde(){
  for (const t of Object.values(eingabe.tasten)){ t.neu = false; t.los = false; }
  eingabe.tipp = false;
}

/* ---------- Eingaben von Mitspielern übers Netz ----------
   Der Gastgeber führt für jeden Mitspieler so ein Objekt. Gedrückt (d) und losgelassen (u, mit
   Haltedauer) kommen einzeln an, damit auch ein kurzes Antippen nicht verloren geht. */
function fernEingabe(){
  return { x:0, z:0, sprint:false, tipp:false, tasten:{ pass:neueTaste(), schuss:neueTaste(), heber:neueTaste(), wechsel:neueTaste(), graetsche:neueTaste() } };
}
function fernAnwenden(e, m){
  const zahl = v => Number.isFinite(v) ? v : 0;
  const x = clamp(zahl(m.x), -1, 1), z = clamp(zahl(m.z), -1, 1), l = Math.hypot(x, z);
  e.x = l > 1 ? x / l : x; e.z = l > 1 ? z / l : z;
  e.sprint = !!m.sp;
  for (const n of Array.isArray(m.d) ? m.d : []){
    const t = e.tasten[n];
    if (t && !t.halten){ t.halten = true; t.neu = true; t.dauer = 0; t.verbraucht = false; }
  }
  for (const u of Array.isArray(m.u) ? m.u : []){
    const t = Array.isArray(u) && e.tasten[u[0]];
    if (t && (t.halten || t.neu)){ t.halten = false; t.los = true; if (Number.isFinite(u[1])) t.dauer = clamp(u[1], 0, 5); }
  }
}
function fernRahmen(e, dt){ for (const t of Object.values(e.tasten)) if (t.halten) t.dauer += dt; }
function fernRahmenEnde(e){ for (const t of Object.values(e.tasten)){ t.neu = false; t.los = false; } }
