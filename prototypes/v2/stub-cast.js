/* hiflora v2 · stub-cast.js — TEST STUB ONLY for dev-world.html.
   Implements the FloraCast contract API with simple coloured blobs so world.js can be developed
   before the real cast.js exists. world.js must never depend on this file. */
(function () {
  'use strict';
  if (window.FloraCast) return;
  const TAU = Math.PI * 2;
  const PHYLA = {
    bacillota: { name: 'Bacillota', old: 'Firmicutes', h: 18, s: 80, l: 66, chip: '#f2905f' },
    bacteroidota: { name: 'Bacteroidota', old: 'Bacteroidetes', h: 168, s: 50, l: 60, chip: '#62c7b0' },
    actinomycetota: { name: 'Actinomycetota', old: 'Actinobacteria', h: 268, s: 58, l: 74, chip: '#b99cf0' },
    pseudomonadota: { name: 'Pseudomonadota', old: 'Proteobacteria', h: 205, s: 70, l: 66, chip: '#6fb6ea' },
    verrucomicrobiota: { name: 'Verrucomicrobiota', old: 'Verrucomicrobia', h: 336, s: 72, l: 77, chip: '#f59cbd' },
    desulfobacterota: { name: 'Desulfobacterota', old: 'sulfur reducers', h: 68, s: 62, l: 58, chip: '#bccc4f' },
  };
  const NICHE = {
    mucus: ['a-muciniphila', 'm-gnavus', 'b-thetaiotaomicron'],
    quarry: ['r-bromii', 'b-adolescentis', 'a-rectalis'],
    bakery: ['f-prausnitzii', 'f-duncaniae', 'r-intestinalis', 'a-hadrus', 'a-hallii', 'c-catus'],
    fields: ['s-copri', 'b-ovatus', 'p-vulgatus', 'b-wexlerae', 'l-plantarum'],
    orchard: ['b-longum', 'b-breve'],
    lab: ['c-aerofaciens', 'e-lenta', 'c-minuta'],
    springs: ['b-wadsworthia', 'd-piger', 'e-coli'],
  };
  const STYLE = { mucus: 'tinker', quarry: 'mine', bakery: 'bake', fields: 'farm', orchard: 'nurse', lab: 'brew', springs: 'puff' };
  const roster = (window.FLORA_ROSTER && window.FLORA_ROSTER.species) || {};
  const SPECIES = {};
  let k = 0;
  for (const niche in NICHE) for (const id of NICHE[niche]) {
    const r = roster[id] || {};
    SPECIES[id] = {
      nick: (r.genus || id).slice(0, 4), phylumKey: r.phylumKey || 'bacillota', niche,
      workStyle: id === 'a-muciniphila' ? 'rake' : STYLE[niche], scaleHint: 0.85 + ((k++ * 37) % 40) / 100,
    };
  }
  const CARRY = { butyrate: '#f5b14a', lactate: '#fff3d6', acetate: '#ffd7e6', starch: '#f4f0e2', mucus: '#f5c8e4', sulfide: '#d8e070', leaf: '#8fcb7a', flask: '#b59cf0' };
  let U = 50;
  function col(inst, dl) {
    const sp = SPECIES[inst.species] || SPECIES['f-prausnitzii'], p = PHYLA[sp.phylumKey];
    const shift = ((inst.species.charCodeAt(0) * 7 + inst.species.length * 13) % 24) - 12;
    return `hsl(${p.h + shift},${p.s}%,${p.l + (dl || 0)}%)`;
  }
  function build(unit) { U = unit; }
  function tick(inst, dt) {
    const c = inst._c || (inst._c = { blink: 2 + Math.random() * 3 });
    c.blink -= dt; if (c.blink < -0.12) c.blink = 2 + Math.random() * 4;
  }
  function draw(g, inst, sx, sy, scale) {
    const sp = SPECIES[inst.species] || {}, hs = sp.scaleHint || 1;
    const h = U * scale * hs, w = h * 0.78, lift = (inst.lift || 0) * scale;
    const sqx = inst.sqx || 1, sqy = inst.sqy || 1;
    g.fillStyle = 'rgba(30,10,20,0.28)';
    g.beginPath(); g.ellipse(sx, sy, w * 0.42, h * 0.08, 0, 0, TAU); g.fill();
    const cy = sy - lift - h * 0.5 * sqy;
    g.fillStyle = col(inst, inst.activity === 'sleep' ? -12 : 0);
    g.beginPath(); g.ellipse(sx, cy, w * 0.5 * sqx, h * 0.5 * sqy, 0, 0, TAU); g.fill();
    if (inst.selected) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    // eyes
    const ex = w * 0.16, ey = cy - h * 0.08, er = Math.max(1.2, h * 0.07), d = (inst.dirX || 0) * w * 0.08;
    const closed = inst.activity === 'sleep' || (inst._c && inst._c.blink < 0);
    g.fillStyle = '#2a1a22'; g.strokeStyle = '#2a1a22'; g.lineWidth = Math.max(1, h * 0.03);
    for (const s of [-1, 1]) {
      g.beginPath();
      if (closed) { g.moveTo(sx + d + s * ex - er, ey); g.lineTo(sx + d + s * ex + er, ey); g.stroke(); }
      else if (inst.hungry) { g.ellipse(sx + d + s * ex, ey + er * 0.3, er, er * 0.6, 0, 0, TAU); g.fill(); }
      else { g.arc(sx + d + s * ex, ey, er, 0, TAU); g.fill(); }
    }
    g.beginPath();
    if (inst.hungry) g.arc(sx + d, ey + h * 0.2, h * 0.06, Math.PI * 1.15, Math.PI * 1.85);
    else g.arc(sx + d, ey + h * 0.09, h * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    if (inst.carrying) {
      g.fillStyle = CARRY[inst.carrying] || '#fff';
      g.beginPath(); g.arc(sx + w * 0.42 * (inst.dirX >= 0 ? 1 : -1), cy - h * 0.05, h * 0.16, 0, TAU); g.fill();
    }
    if (inst.activity === 'work') {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.font = `${Math.max(8, h * 0.22)}px sans-serif`; g.textAlign = 'center';
      g.fillText(sp.workStyle || 'work', sx, sy - lift - h * 1.08);
    }
  }
  function bounds(inst, scale) {
    const sp = SPECIES[inst.species] || {}, h = U * scale * (sp.scaleHint || 1);
    return { w: h * 0.78, h };
  }
  function drawPortrait(g, id, cx, cy, size) { draw(g, { species: id, dirX: 0 }, cx, cy + size / 2, size / U); }
  function drawFlora(g, cx, cy, size) {
    g.fillStyle = '#7fa58a'; g.beginPath(); g.arc(cx, cy, size / 2, 0, TAU); g.fill();
    g.fillStyle = '#24302A';
    g.beginPath(); g.arc(cx - size * 0.14, cy - size * 0.04, size * 0.05, 0, TAU); g.arc(cx + size * 0.14, cy - size * 0.04, size * 0.05, 0, TAU); g.fill();
  }
  window.FloraCast = { PHYLA, SPECIES, build, tick, draw, bounds, drawPortrait, drawFlora, __stub: true };
})();
