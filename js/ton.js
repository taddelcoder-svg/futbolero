'use strict';
// Futbolero – Ton: alles wird im Browser synthetisiert (keine Audiodateien).
const Ton = (() => {
  let ctx = null, master = null, rauschen = null;
  let menge = null, mengeFilter = null, stimmung = 0.2;

  function rauschPuffer(sek){
    const n = Math.floor(ctx.sampleRate * sek), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let braun = 0;
    for (let i = 0; i < n; i++){ const w = Math.random() * 2 - 1; braun = (braun + 0.04 * w) / 1.04; d[i] = w * 0.5 + braun * 3; }
    return b;
  }

  function start(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = einstellungen.ton ? 0.85 : 0;
    master.connect(ctx.destination);
    rauschen = rauschPuffer(3);

    // Zuschauer: gefiltertes Rauschen in zwei Schichten, leicht schwankend
    menge = ctx.createGain(); menge.gain.value = 0.0001; menge.connect(master);
    for (const [freq, q, lautst, lfoF] of [[520, 0.7, 1, 0.13], [1250, 1.6, 0.45, 0.31]]){
      const q1 = ctx.createBufferSource(); q1.buffer = rauschen; q1.loop = true;
      q1.playbackRate.value = zufall(0.9, 1.1);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = lautst;
      const lfo = ctx.createOscillator(); lfo.frequency.value = lfoF;
      const lfoG = ctx.createGain(); lfoG.gain.value = lautst * 0.35;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      q1.connect(f); f.connect(g); g.connect(menge);
      q1.start(); lfo.start();
      if (!mengeFilter) mengeFilter = f;
    }
    stimmungSetzen(stimmung, 1.5);
  }

  function stimmungSetzen(wert, zeit = 0.8){
    stimmung = clamp(wert, 0, 1);
    if (!ctx || !menge) return;
    menge.gain.setTargetAtTime(0.05 + stimmung * 0.2, ctx.currentTime, zeit);
    mengeFilter.frequency.setTargetAtTime(480 + stimmung * 260, ctx.currentTime, zeit);
  }

  function huelle(g, t0, an, spitze, ab){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(spitze, t0 + an);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + an + ab);
  }

  function schuss(staerke = 0.6){
    if (!ctx) return;
    const t = ctx.currentTime, st = clamp(staerke, 0.15, 1);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    huelle(g, t, 0.004, 0.7 * st, 0.13);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.2);
    const n = ctx.createBufferSource(); n.buffer = rauschen;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
    const g2 = ctx.createGain(); huelle(g2, t, 0.002, 0.3 * st, 0.05);
    n.connect(f); f.connect(g2); g2.connect(master); n.start(t, Math.random() * 2, 0.1);
  }

  function pfiff(art = 'kurz'){
    if (!ctx) return;
    const folgen = { kurz:[[0, 0.28]], lang:[[0, 0.95]], zwei:[[0, 0.3], [0.42, 0.95]], drei:[[0, 0.35], [0.5, 0.35], [1.0, 1.1]] }[art] || [[0, 0.3]];
    const t0 = ctx.currentTime + 0.02;
    for (const [ab, dauer] of folgen){
      const t = t0 + ab;
      const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lfoG = ctx.createGain(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2950;
      lfo.frequency.value = 34; lfoG.gain.value = 140;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      g.gain.setValueAtTime(0.16, t + dauer - 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
      o.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + dauer + 0.05); lfo.stop(t + dauer + 0.05);
    }
  }

  function pfosten(){
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [f, l] of [[980, 0.3], [1510, 0.18], [2270, 0.1]]){
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; huelle(g, t, 0.003, l, 0.7);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.8);
    }
  }

  function netz(){
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = rauschen;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); huelle(g, t, 0.01, 0.35, 0.3);
    n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random() * 2, 0.4);
  }

  // Torjubel: die Menge schwillt an und ebbt langsam ab
  function jubel(staerke = 1){
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = rauschen; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(420, t); f.frequency.linearRampToValueAtTime(900, t + 0.6); f.frequency.linearRampToValueAtTime(650, t + 4.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75 * staerke, t + 0.35);
    g.gain.setTargetAtTime(0.0001, t + 1.8, 1.3);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 7);
  }

  function raunen(){
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = rauschen; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(360, t + 1.4);
    const g = ctx.createGain(); huelle(g, t, 0.15, 0.3, 1.4);
    n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 2);
  }

  function klick(){
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 660; huelle(g, t, 0.003, 0.12, 0.07);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.1);
  }

  function anAus(an){
    einstellungen.ton = an; speichern();
    if (master) master.gain.setTargetAtTime(an ? 0.85 : 0, ctx.currentTime, 0.05);
  }

  return { start, schuss, pfiff, pfosten, netz, jubel, raunen, klick, stimmungSetzen, anAus };
})();
