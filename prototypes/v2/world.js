/* hiflora v2 · world.js
   window.FloraWorld: the pannable, painted gut world where the user's community lives.
   Plain JS, no modules. Depends only on the contract APIs: FLORA_ROSTER (optional), FloraCast, FloraApp.

   Layout of this file
     1. utils + constants (niches, fibre map, default community)
     2. scene description (deterministic, seeded) + painters
     3. tile cache (back layer with parallax, main layer), prop sprites, glow sprites
     4. simulation: nourishment, instances, daily-life tasks, cross-feeding errands, division
     5. meals
     6. camera + input
     7. DOM UI (labels, chips, toast, Talk to Flora)
     8. render loop + public API
*/
(function () {
  'use strict';

  /* ======================================================================
     1. Utils + constants
     ====================================================================== */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const hsl = (h, s, l, a) => `hsla(${h},${s}%,${clamp(l, 0, 100)}%,${a == null ? 1 : a})`;
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function mulberry(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // World units: the world is REF_H units tall at zoom 1 and is scaled to fit the viewport height.
  const REF_H = 820;
  const YMIN = -150, YMAX = 950;      // vertical extent of painted world (room for 0.8x zoom)
  const HZ = 372;                     // base of the villi wall / top of the ground
  const MAIN_Y0 = 46;                 // main layer tiles start here (above it only the back layer)
  const BACK_Y1 = HZ + 70;            // back layer ends here
  const MARGIN = 96, NW = 270;        // world margin and niche width
  const WW = MARGIN * 2 + NW * 7;     // world width (~5 phone screens)
  const P = 0.45;                     // back-layer parallax factor
  const UNIT = 52;                    // average character height in world units at scale 1
  const BAND_Y0 = 482, BAND_Y1 = 704; // where residents roam
  const OV = 3;                       // tile overlap in world units (hides seams)

  const NICHES = [
    { id: 'mucus', label: 'Mucus Meadow', accent: '#F29CC4', glow: [255, 190, 224], wall: [338, 50, 67], ground: [214, 150, 196, 0.34], labelY: 372 },
    { id: 'quarry', label: 'Starch Quarry', accent: '#E9DDC4', glow: [255, 238, 210], wall: [350, 40, 66], ground: [240, 226, 196, 0.42], labelY: 330 },
    { id: 'bakery', label: 'Butyrate Bakery', accent: '#F2A94A', glow: [255, 184, 104], wall: [354, 50, 61], ground: [236, 168, 96, 0.2], labelY: 318 },
    { id: 'fields', label: 'Fibre Fields', accent: '#A3CB6E', glow: [255, 218, 146], wall: [348, 46, 62], ground: [118, 170, 70, 0.26], labelY: 318 },
    { id: 'orchard', label: 'Inulin Orchard', accent: '#B99CF0', glow: [232, 196, 255], wall: [338, 44, 64], ground: [104, 164, 96, 0.3], labelY: 292 },
    { id: 'lab', label: 'Alchemy Lab', accent: '#62C7B0', glow: [168, 236, 214], wall: [328, 38, 61], ground: [86, 160, 150, 0.24], labelY: 318 },
    { id: 'springs', label: 'Sulfur Springs', accent: '#BCCC4F', glow: [190, 198, 118], wall: [372, 20, 47], ground: [70, 72, 40, 0.5], labelY: 352 },
  ];
  const NB = {};
  NICHES.forEach((n, i) => {
    n.i = i; n.cx = MARGIN + NW * (i + 0.5); n.x0 = n.cx - NW / 2; n.x1 = n.cx + NW / 2; NB[n.id] = n;
  });

  // Contract niche table (fallback when FloraCast.SPECIES lacks a niche)
  const DEFAULT_NICHE = {
    'a-muciniphila': 'mucus', 'm-gnavus': 'mucus', 'b-thetaiotaomicron': 'mucus',
    'r-bromii': 'quarry', 'b-adolescentis': 'quarry', 'a-rectalis': 'quarry',
    'f-prausnitzii': 'bakery', 'f-duncaniae': 'bakery', 'r-intestinalis': 'bakery', 'a-hadrus': 'bakery', 'a-hallii': 'bakery', 'c-catus': 'bakery',
    's-copri': 'fields', 'b-ovatus': 'fields', 'p-vulgatus': 'fields', 'b-wexlerae': 'fields', 'l-plantarum': 'fields',
    'b-longum': 'orchard', 'b-breve': 'orchard',
    'c-aerofaciens': 'lab', 'e-lenta': 'lab', 'c-minuta': 'lab',
    'b-wadsworthia': 'springs', 'd-piger': 'springs', 'e-coli': 'springs',
  };
  // Typical Western adult community, weighted by realistic relative abundance (~58 residents).
  const DEFAULT_COMMUNITY = {
    'a-muciniphila': 3, 'm-gnavus': 2, 'b-thetaiotaomicron': 3,
    'r-bromii': 3, 'b-adolescentis': 3, 'a-rectalis': 3,
    'f-prausnitzii': 5, 'f-duncaniae': 2, 'r-intestinalis': 2, 'a-hadrus': 2, 'a-hallii': 2, 'c-catus': 1,
    's-copri': 2, 'b-ovatus': 3, 'p-vulgatus': 4, 'b-wexlerae': 3, 'l-plantarum': 1,
    'b-longum': 3, 'b-breve': 2,
    'c-aerofaciens': 2, 'e-lenta': 1, 'c-minuta': 1,
    'b-wadsworthia': 1, 'd-piger': 1, 'e-coli': 2,
  };

  // fibreType -> niches (first niche gets the full share, others 60%)
  const FIBRE_NICHES = {
    'beta-glucan': ['fields'], 'arabinoxylan': ['fields'], 'cellulose': ['fields'],
    'pectin': ['fields', 'bakery'], 'inulin-fos': ['orchard', 'bakery'], 'gos': ['orchard'],
    'resistant-starch': ['quarry'], 'polyphenols': ['lab'],
  };
  const FOOD_COL = {
    'beta-glucan': [246, 202, 104], 'arabinoxylan': [212, 222, 108], 'cellulose': [138, 208, 118],
    'pectin': [246, 132, 96], 'inulin-fos': [214, 186, 255], 'gos': [255, 176, 210],
    'resistant-starch': [246, 240, 222], 'polyphenols': [168, 110, 230],
    'high-fat': [214, 176, 70], 'sugar': [255, 150, 196], 'fermented': [255, 236, 170],
  };

  // Real cross-feeding roles (see roster metabolites / degraderRole)
  const BUTYRATE_MAKERS = new Set(['f-prausnitzii', 'f-duncaniae', 'r-intestinalis', 'a-hadrus', 'a-hallii', 'c-catus', 'a-rectalis']);
  const SCFA_SUPPLIERS = { // species -> what they carry to the Bakery
    'b-longum': ['acetate', 'lactate'], 'b-breve': ['acetate', 'lactate'], 'b-adolescentis': ['acetate', 'lactate'],
    'b-thetaiotaomicron': ['acetate'], 'b-ovatus': ['acetate'], 'p-vulgatus': ['acetate'], 's-copri': ['acetate'],
    'b-wexlerae': ['acetate'], 'l-plantarum': ['lactate'], 'a-muciniphila': ['acetate'], 'm-gnavus': ['acetate', 'lactate'],
  };
  const BACTEROIDES = new Set(['b-thetaiotaomicron', 'b-ovatus', 'p-vulgatus']);

  /* ======================================================================
     2. Scene description + painters
     ====================================================================== */
  const roadY = (x) => 606 + 22 * Math.sin(x * 0.0049 + 0.6) + 8 * Math.sin(x * 0.0131 + 1.3);
  const groundTop = (x) => HZ + 6 + Math.sin(x * 0.012) * 2.5 + Math.sin(x * 0.031 + 1) * 1.5;
  const persp = (y) => lerp(0.7, 1.06, clamp((y - 400) / (BAND_Y1 - 400), 0, 1));

  // Per-niche colour along x (smoothstep between neighbouring niche centres)
  function nicheMix(x, key) {
    const f = clamp((x - MARGIN) / NW - 0.5, 0, NICHES.length - 1);
    const i = Math.floor(f), t = smooth(f - i);
    const a = NICHES[i][key], b = NICHES[Math.min(NICHES.length - 1, i + 1)][key];
    return a.map((v, k) => lerp(v, b[k], t));
  }
  function nicheAtX(x) {
    return NICHES[clamp(Math.floor((x - MARGIN) / NW), 0, NICHES.length - 1)];
  }

  // Landmark anchor points (world units). All static scenery sits in the back band (y < BAND_Y0).
  const L = {};
  (function layout() {
    const c = (id) => NB[id].cx;
    L.pools = [
      { x: c('mucus') - 52, y: 512, rx: 70, ry: 17 },
      { x: c('mucus') + 62, y: 476, rx: 48, ry: 12 },
      { x: c('mucus') + 30, y: 566, rx: 42, ry: 11 },
    ];
    L.colonocytes = [-122, -86, -50].map((d, i) => ({ x: c('bakery') + d, y: HZ + 16, glow: 0.2, lanterns: [], i }));
    L.laneEntry = { x: c('bakery') - 64, y: roadY(c('bakery') - 64) };
    L.crate = { x: c('bakery') + 4, y: 488 };
    L.oven = { x: c('bakery') + 58, y: 452 };
    L.chimney = { x: c('bakery') + 96, y: 362 };
    L.windmill = { x: c('fields') + 92, y: 452, r: 62 };
    L.basket = { x: c('fields') + 42, y: 488 };
    L.trees = [
      { x: c('orchard') - 72, y: 462, s: 1.0 },
      { x: c('orchard') + 30, y: 446, s: 0.82 },
      { x: c('orchard') + 98, y: 470, s: 0.92 },
    ];
    L.cauldron = { x: c('lab') - 46, y: 474 };
    L.labHut = { x: c('lab') + 32, y: 466 };
    L.labChimney = { x: c('lab') + 66, y: 358 };
    L.basins = [
      { x: c('springs') - 18, y: 528, rx: 92, ry: 24 },
      { x: c('springs') + 78, y: 484, rx: 44, ry: 12 },
    ];
    L.vent = { x: c('springs') + 108, y: 462 };
    L.quarry = { x: c('quarry') + 8, y: 466 };
    // Where residents work, per niche
    L.work = {
      mucus: [[L.pools[0].x - 62, 516], [L.pools[0].x + 60, 518], [L.pools[1].x - 44, 484], [L.pools[1].x + 40, 486], [L.pools[2].x - 36, 570], [L.pools[2].x + 36, 572]],
      quarry: [[c('quarry') - 44, 488], [c('quarry') + 4, 486], [c('quarry') + 50, 490], [c('quarry') - 86, 494]],
      bakery: [[c('bakery') + 30, 490], [c('bakery') + 70, 488], [c('bakery') + 112, 494], [c('bakery') + 4, 498], [c('bakery') - 30, 506], [c('bakery') + 50, 520], [c('bakery') + 96, 532]],
      fields: [[c('fields') - 108, 486], [c('fields') - 68, 490], [c('fields') - 26, 486], [c('fields') + 14, 490]],
      orchard: [[c('orchard') - 72, 488], [c('orchard') + 30, 486], [c('orchard') + 98, 490], [c('orchard') - 20, 492]],
      lab: [[c('lab') - 46, 490], [c('lab') + 98, 488], [c('lab') + 30, 486]],
      springs: [[c('springs') - 108, 530], [c('springs') + 72, 532], [c('springs') + 106, 488], [c('springs') + 40, 498]],
    };
    // Homes: mushroom or bubble homes, sorted with the characters
    L.homes = [
      { niche: 'mucus', x: c('mucus') - 104, y: 470, sz: 50, hue: 330, kind: 'bubble' },
      { niche: 'mucus', x: c('mucus') + 118, y: 520, sz: 44, hue: 300, kind: 'bubble' },
      { niche: 'quarry', x: c('quarry') - 114, y: 474, sz: 48, hue: 40, kind: 'mush' },
      { niche: 'quarry', x: c('quarry') + 118, y: 478, sz: 42, hue: 28, kind: 'mush' },
      { niche: 'bakery', x: c('bakery') - 4, y: 452, sz: 38, hue: 22, kind: 'mush' },
      { niche: 'bakery', x: c('bakery') + 128, y: 482, sz: 50, hue: 14, kind: 'mush' },
      { niche: 'fields', x: c('fields') - 126, y: 484, sz: 48, hue: 168, kind: 'mush' },
      { niche: 'fields', x: c('fields') + 132, y: 486, sz: 44, hue: 150, kind: 'mush' },
      { niche: 'orchard', x: c('orchard') - 126, y: 486, sz: 46, hue: 270, kind: 'mush' },
      { niche: 'orchard', x: c('orchard') - 16, y: 470, sz: 36, hue: 286, kind: 'mush' },
      { niche: 'lab', x: c('lab') - 118, y: 482, sz: 46, hue: 186, kind: 'mush' },
      { niche: 'lab', x: c('lab') + 128, y: 480, sz: 40, hue: 300, kind: 'mush' },
      { niche: 'springs', x: c('springs') - 120, y: 478, sz: 42, hue: 66, kind: 'mush', dull: true },
      { niche: 'springs', x: c('springs') + 128, y: 506, sz: 38, hue: 80, kind: 'mush', dull: true },
    ];
    L.lamps = [];
    const blocked = (x, y) => L.pools.concat(L.basins).some((b) => ((x - b.x) / (b.rx + 16)) ** 2 + ((y - b.y) / (b.ry + 14)) ** 2 < 1);
    for (let x = MARGIN + 60; x < WW - MARGIN; x += 232) {
      let y = roadY(x) - 30;
      if (blocked(x, y)) y = roadY(x) + 36; // move to the near side of the road if a pool is in the way
      if (!blocked(x, y)) L.lamps.push({ x, y });
    }
    L.lanePosts = [[-82, 452], [-44, 448], [-90, 530], [-36, 524]].map(([dx, y]) => ({ x: c('bakery') + dx, y }));
  })();

  // ---- generic painted parts -------------------------------------------------
  function villusPath(x, base, w, h) {
    const r = w / 2, p = new Path2D();
    p.moveTo(x - r * 1.3, base);
    p.bezierCurveTo(x - r * 0.9, base - h * 0.3, x - r * 1.04, base - h + r * 1.3, x - r * 0.95, base - h + r);
    p.arc(x, base - h + r, r * 0.95, Math.PI, 0);
    p.bezierCurveTo(x + r * 1.04, base - h + r * 1.3, x + r * 0.9, base - h * 0.3, x + r * 1.3, base);
    p.closePath();
    return p;
  }
  function villus(g, x, base, w, h, c, rnd, gloss) {
    const r = w / 2, p = villusPath(x, base, w, h);
    let gr = g.createLinearGradient(x - r * 1.2, 0, x + r * 1.2, 0);
    gr.addColorStop(0, hsl(c[0], c[1], c[2] + 10)); gr.addColorStop(0.42, hsl(c[0], c[1], c[2] + 3)); gr.addColorStop(1, hsl(c[0] + 4, c[1], c[2] - 14));
    g.fillStyle = gr; g.fill(p);
    g.save(); g.clip(p);
    gr = g.createLinearGradient(0, base - h, 0, base);
    gr.addColorStop(0, 'rgba(255,232,214,0.14)'); gr.addColorStop(1, 'rgba(60,10,30,0.28)');
    g.fillStyle = gr; g.fillRect(x - w, base - h, w * 2, h);
    if (w > 22) {
      for (let i = 0; i < w * 0.45; i++) {
        g.fillStyle = hsl(c[0], c[1], c[2] + 20, 0.14 + rnd() * 0.12);
        g.beginPath(); g.arc(x + (rnd() - 0.5) * r * 1.8, base - rnd() * (h - r * 0.3), 0.8 + rnd() * w * 0.035, 0, TAU); g.fill();
      }
    }
    g.fillStyle = hsl(c[0], c[1], c[2] + 26, 0.26 + gloss * 0.25);
    g.beginPath(); g.ellipse(x - r * 0.38, base - h + r * 0.95, r * 0.22, r * (0.55 + gloss * 0.6), -0.15, 0, TAU); g.fill();
    if (gloss > 0.2) { // glistening mucus coat with drips
      g.strokeStyle = `rgba(255,236,248,${0.35 * gloss})`; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x - r * 0.62, base - h * 0.15); g.quadraticCurveTo(x - r * 0.8, base - h * 0.6, x - r * 0.5, base - h + r * 0.6); g.stroke();
    }
    g.restore();
    if (gloss > 0.2) {
      const n = 1 + ((rnd() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const dx = x + (rnd() - 0.5) * r * 1.4, dy = base - h * (0.25 + rnd() * 0.55), dr = 2 + rnd() * 2.5;
        g.fillStyle = `rgba(255,214,236,${0.55 * gloss})`;
        g.beginPath(); g.moveTo(dx, dy - dr * 2.2); g.quadraticCurveTo(dx + dr, dy - dr * 0.4, dx + dr, dy); g.arc(dx, dy, dr, 0, Math.PI); g.quadraticCurveTo(dx - dr, dy - dr * 0.4, dx, dy - dr * 2.2); g.fill();
        g.fillStyle = `rgba(255,255,255,${0.7 * gloss})`; g.beginPath(); g.arc(dx - dr * 0.35, dy - dr * 0.2, dr * 0.3, 0, TAU); g.fill();
      }
    }
  }
  function softEllipse(g, x, y, rx, ry, col, a) {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.65, rgba(col, a * 0.75)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
  }
  function shadow(g, x, y, rx, ry, a) {
    softEllipse(g, x, y, rx, ry, [40, 14, 24], a == null ? 0.32 : a);
  }

  // ---- homes (prop sprites, drawn at origin, base at y=0) ---------------------
  function paintHome(g, h, rec) {
    const w = h.sz, hh = w * 0.62, x = 0, y = 0, dull = !!h.dull;
    shadow(g, 0, 2, w * 0.7, w * 0.13, 0.35);
    if (h.kind === 'bubble') {
      const r = w * 0.55;
      // stem pad
      g.fillStyle = 'rgba(214,150,196,0.55)'; g.beginPath(); g.ellipse(0, 0, r * 1.02, r * 0.18, 0, 0, TAU); g.fill();
      let gr = g.createRadialGradient(-r * 0.35, -r * 1.05, r * 0.1, 0, -r * 0.62, r * 1.1);
      gr.addColorStop(0, 'rgba(255,248,252,0.85)'); gr.addColorStop(0.45, hsl(h.hue, 70, 86, 0.6)); gr.addColorStop(1, hsl(h.hue, 50, 64, 0.62));
      g.fillStyle = gr; g.beginPath(); g.moveTo(-r, 0); g.bezierCurveTo(-r * 1.08, -r * 1.45, r * 1.08, -r * 1.45, r, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(-r * 0.12, -r * 0.62, r * 0.68, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-r * 0.45, -r * 0.82, r * 0.08, r * 0.14, -0.5, 0, TAU); g.fill();
      // inner door glow
      const dw = w * 0.22, dh = w * 0.34;
      gr = g.createLinearGradient(0, -dh, 0, 0); gr.addColorStop(0, '#ffe7b0'); gr.addColorStop(1, '#f2a35a');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-dw / 2, 0); g.lineTo(-dw / 2, -dh + dw / 2); g.arc(0, -dh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(dw / 2, 0); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,80,110,0.5)'; g.lineWidth = 1; g.stroke();
      rec.windows.push({ x: 0, y: -dh * 0.5, r: dw * 0.8 });
      // tiny bubbles
      g.fillStyle = 'rgba(255,240,250,0.7)';
      [[0.62, -0.95, 0.07], [0.8, -1.22, 0.045], [-0.7, -1.1, 0.05]].forEach(([a, b, c]) => { g.beginPath(); g.arc(a * r, b * r, c * r, 0, TAU); g.fill(); });
      return;
    }
    let gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    gr.addColorStop(0, dull ? '#e6dfcc' : '#fff2e2'); gr.addColorStop(1, dull ? '#a9a28a' : '#d8ae98');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(x - w * 0.42, y); g.lineTo(x - w * 0.45, y - hh * 0.62); g.quadraticCurveTo(x, y - hh * 1.15, x + w * 0.45, y - hh * 0.62); g.lineTo(x + w * 0.42, y); g.closePath(); g.fill();
    const rh = w * 0.5, ry = y - hh * 0.6, sat = dull ? 26 : 62;
    gr = g.createRadialGradient(x - w * 0.15, ry - rh * 0.6, 2, x, ry - rh * 0.3, w * 0.7);
    gr.addColorStop(0, hsl(h.hue, sat + 10, dull ? 66 : 80)); gr.addColorStop(0.6, hsl(h.hue, sat, dull ? 50 : 60)); gr.addColorStop(1, hsl(h.hue, sat - 7, dull ? 34 : 40));
    g.fillStyle = gr; g.beginPath();
    g.moveTo(x - w * 0.64, ry + rh * 0.14);
    g.bezierCurveTo(x - w * 0.6, ry - rh * 1.05, x + w * 0.6, ry - rh * 1.05, x + w * 0.64, ry + rh * 0.14);
    g.quadraticCurveTo(x, ry - rh * 0.1, x - w * 0.64, ry + rh * 0.14); g.fill();
    g.fillStyle = hsl(h.hue, 85, 92, dull ? 0.3 : 0.6);
    [[-0.3, -0.45, 0.07], [0.05, -0.62, 0.09], [0.32, -0.38, 0.06], [-0.08, -0.3, 0.05], [0.42, -0.12, 0.045]].forEach(([dx, dy, r]) => {
      g.beginPath(); g.ellipse(x + dx * w, ry + dy * rh, r * w, r * w * 0.7, 0, 0, TAU); g.fill();
    });
    const dw = w * 0.2, dh = hh * 0.58;
    g.fillStyle = '#7a4a35'; g.beginPath();
    g.moveTo(x - dw / 2, y); g.lineTo(x - dw / 2, y - dh + dw / 2); g.arc(x, y - dh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(x + dw / 2, y); g.closePath(); g.fill();
    g.fillStyle = '#f5c56a'; g.beginPath(); g.arc(x + dw * 0.28, y - dh * 0.42, Math.max(0.8, dw * 0.07), 0, TAU); g.fill();
    for (const side of [-1, 1]) {
      const wx = x + side * w * 0.27, wy = y - hh * 0.5, wr = w * 0.075;
      const wg = g.createRadialGradient(wx, wy, 0, wx, wy, wr);
      wg.addColorStop(0, '#fff1b8'); wg.addColorStop(1, '#f2a94a');
      g.fillStyle = wg; g.beginPath(); g.arc(wx, wy, wr, 0, TAU); g.fill();
      g.strokeStyle = '#6b4a3a'; g.lineWidth = Math.max(0.8, wr * 0.22); g.stroke();
      g.lineWidth = Math.max(0.5, wr * 0.12);
      g.beginPath(); g.moveTo(wx - wr, wy); g.lineTo(wx + wr, wy); g.moveTo(wx, wy - wr); g.lineTo(wx, wy + wr); g.stroke();
      rec.windows.push({ x: wx, y: wy, r: wr });
    }
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      g.fillStyle = hsl(90 + i * 12, dull ? 20 : 40, 34 + i * 6);
      g.beginPath(); g.arc(x + side * (w * 0.38 + i * w * 0.05), y - w * 0.03 - i * w * 0.012, w * (0.07 - i * 0.012), 0, TAU); g.fill();
    }
  }
  function paintLamp(g, rec) {
    const hgt = 62;
    shadow(g, 0, 0, 9, 2.5, 0.35);
    const pw = 2.6;
    const gr = g.createLinearGradient(-pw, 0, pw, 0); gr.addColorStop(0, '#5a7a62'); gr.addColorStop(1, '#22382a');
    g.fillStyle = gr;
    g.fillRect(-pw / 2, -hgt, pw, hgt);
    g.fillRect(-pw * 1.5, -hgt * 0.08, pw * 3, hgt * 0.08);
    g.fillRect(-pw * 1.2, -hgt - pw * 0.6, pw * 2.4, pw * 0.8);
    // little curl
    g.strokeStyle = '#2f4a38'; g.lineWidth = 1.1; g.beginPath(); g.arc(pw * 1.6, -hgt * 0.72, 3, Math.PI * 0.8, Math.PI * 2.1); g.stroke();
    const r = 6.2, gy = -hgt - r * 0.9;
    const lg = g.createRadialGradient(-r * 0.3, gy - r * 0.3, 0, 0, gy, r);
    lg.addColorStop(0, '#fffbe8'); lg.addColorStop(0.7, '#ffd98a'); lg.addColorStop(1, '#f0a854');
    g.fillStyle = lg; g.beginPath(); g.arc(0, gy, r, 0, TAU); g.fill();
    g.fillStyle = '#22382a'; g.beginPath(); g.moveTo(-r * 0.9, gy - r * 0.7); g.quadraticCurveTo(0, gy - r * 1.9, r * 0.9, gy - r * 0.7); g.closePath(); g.fill();
    rec.glow = { x: 0, y: gy, r };
  }

  // ---- landmarks (painted into the main tiles) --------------------------------
  function paintYard(g, n, col) {
    softEllipse(g, n.cx, 500, 132, 30, col, 0.5);
  }
  function paintMucus(g, n) {
    paintYard(g, n, [226, 168, 206]);
    for (const p of L.pools) {
      softEllipse(g, p.x, p.y + 2, p.rx * 1.25, p.ry * 1.6, [176, 96, 150], 0.35);
      const gr = g.createRadialGradient(p.x - p.rx * 0.3, p.y - p.ry * 0.4, 1, p.x, p.y, p.rx);
      gr.addColorStop(0, 'rgba(255,236,246,0.8)'); gr.addColorStop(0.5, 'rgba(244,184,222,0.62)'); gr.addColorStop(1, 'rgba(206,128,186,0.55)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,240,250,0.7)'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(p.x, p.y, p.rx, p.ry, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.ellipse(p.x - p.rx * 0.35, p.y - p.ry * 0.35, p.rx * 0.2, p.ry * 0.16, -0.1, 0, TAU); g.fill();
      // little moss + flowers fringe
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU, fx = p.x + Math.cos(a) * p.rx * 1.08, fy = p.y + Math.sin(a) * p.ry * 1.25;
        g.fillStyle = i % 3 ? 'rgba(136,150,92,0.85)' : '#ffd9ea';
        g.beginPath(); g.arc(fx, fy, i % 3 ? 2.4 : 1.6, 0, TAU); g.fill();
      }
    }
    // a glossy film of mucus pooled along the base of the villi wall
    softEllipse(g, n.cx - 10, HZ + 14, 150, 12, [255, 214, 236], 0.45);
  }
  function crystal(g, x, y, w, h, tilt, tone) {
    g.save(); g.translate(x, y); g.rotate(tilt);
    const pts = [[-w / 2, 0], [-w / 2, -h * 0.62], [0, -h], [w / 2, -h * 0.62], [w / 2, 0]];
    const t = tone || 0;
    // left face
    g.fillStyle = hsl(42, 40, 95 - t); g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h * 0.62); g.lineTo(0, -h); g.lineTo(-w * 0.05, 0); g.closePath(); g.fill();
    // right face
    g.fillStyle = hsl(36, 22, 80 - t); g.beginPath(); g.moveTo(-w * 0.05, 0); g.lineTo(0, -h); g.lineTo(w / 2, -h * 0.62); g.lineTo(w / 2, 0); g.closePath(); g.fill();
    // cool facet + highlights
    g.fillStyle = 'rgba(176,206,236,0.35)'; g.beginPath(); g.moveTo(0, -h); g.lineTo(w / 2, -h * 0.62); g.lineTo(w * 0.18, -h * 0.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w * 0.4, -h * 0.1); g.lineTo(-w * 0.4, -h * 0.58); g.lineTo(-w * 0.04, -h * 0.9); g.stroke();
    g.strokeStyle = 'rgba(120,96,80,0.35)'; g.lineWidth = 0.8; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    g.restore();
  }
  function granule(g, x, y, rx, ry) { // resistant-starch granule, lamellar rings
    shadow(g, x, y + 2, rx * 1.1, ry * 0.3, 0.3);
    const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 1.2, 1, x, y - ry, rx * 1.2);
    gr.addColorStop(0, '#fffdf6'); gr.addColorStop(0.7, '#ece4d2'); gr.addColorStop(1, '#c7bba3');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - ry, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(170,150,120,0.35)'; g.lineWidth = 0.9;
    for (let k = 1; k <= 4; k++) { g.beginPath(); g.ellipse(x + rx * 0.08, y - ry * 0.95, rx * k / 5, ry * k / 5, 0, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(x - rx * 0.42, y - ry * 1.45, rx * 0.18, ry * 0.12, -0.4, 0, TAU); g.fill();
  }
  function paintQuarry(g, n) {
    paintYard(g, n, [246, 232, 204]);
    const q = L.quarry;
    softEllipse(g, q.x, q.y + 4, 110, 22, [214, 196, 168], 0.6);
    // back rock face
    // terraced pale cliff with strata (the quarry face)
    const face = new Path2D();
    face.moveTo(q.x - 104, q.y); face.lineTo(q.x - 98, q.y - 34); face.lineTo(q.x - 72, q.y - 40); face.lineTo(q.x - 64, q.y - 74); face.lineTo(q.x - 20, q.y - 80);
    face.lineTo(q.x + 26, q.y - 96); face.lineTo(q.x + 60, q.y - 70); face.lineTo(q.x + 88, q.y - 64); face.lineTo(q.x + 98, q.y - 28); face.lineTo(q.x + 106, q.y); face.closePath();
    let fg = g.createLinearGradient(q.x - 100, q.y - 96, q.x + 100, q.y);
    fg.addColorStop(0, '#f6eddc'); fg.addColorStop(0.55, '#e3d3b8'); fg.addColorStop(1, '#bfa98c');
    g.fillStyle = fg; g.fill(face);
    g.save(); g.clip(face);
    g.strokeStyle = 'rgba(150,120,90,0.35)'; g.lineWidth = 1.2;
    for (let k = 1; k < 7; k++) { const yy = q.y - k * 14; g.beginPath(); g.moveTo(q.x - 110, yy + 4); g.quadraticCurveTo(q.x, yy - 6, q.x + 110, yy + 2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(q.x - 72, q.y - 76, 52, 3); g.fillRect(q.x - 98, q.y - 36, 26, 3); g.fillRect(q.x + 60, q.y - 68, 28, 3);
    g.fillStyle = 'rgba(120,90,70,0.22)'; g.beginPath(); g.moveTo(q.x + 98, q.y - 28); g.lineTo(q.x + 106, q.y); g.lineTo(q.x + 70, q.y); g.closePath(); g.fill();
    g.restore();
    crystal(g, q.x - 6, q.y - 4, 34, 118, -0.06, 0);
    crystal(g, q.x + 30, q.y, 26, 84, 0.18, 4);
    crystal(g, q.x - 36, q.y, 22, 70, -0.28, 6);
    crystal(g, q.x + 58, q.y + 2, 18, 46, 0.32, 8);
    granule(g, q.x - 70, q.y + 6, 26, 20);
    granule(g, q.x + 78, q.y + 8, 22, 17);
    granule(g, q.x + 12, q.y + 12, 16, 12);
    for (let i = 0; i < 7; i++) crystal(g, q.x - 120 + i * 36, q.y + 18 + (i % 2) * 8, 6, 12 + (i % 3) * 4, (i % 2 ? 0.3 : -0.3), 6);
    // rail + mine cart
    const ry = 492, x0 = n.cx - 128, x1 = n.cx - 40;
    g.strokeStyle = '#7a5a48'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x0, ry); g.lineTo(x1, ry - 4); g.moveTo(x0, ry + 5); g.lineTo(x1, ry + 1); g.stroke();
    g.strokeStyle = '#9b7458'; g.lineWidth = 2.2;
    for (let x = x0 + 4; x < x1; x += 10) { g.beginPath(); g.moveTo(x, ry - 1); g.lineTo(x + 1, ry + 6); g.stroke(); }
    const cx = n.cx - 92, cy = ry - 2;
    g.fillStyle = '#8a5d44'; g.beginPath(); g.moveTo(cx - 17, cy - 20); g.lineTo(cx + 17, cy - 20); g.lineTo(cx + 13, cy - 4); g.lineTo(cx - 13, cy - 4); g.closePath(); g.fill();
    g.fillStyle = '#a8745a'; g.fillRect(cx - 17, cy - 21, 34, 3);
    g.fillStyle = '#3b2a24'; [-8, 8].forEach((d) => { g.beginPath(); g.arc(cx + d, cy - 2, 3.4, 0, TAU); g.fill(); });
    for (let i = 0; i < 5; i++) crystal(g, cx - 10 + i * 5, cy - 19, 5, 8 + (i % 2) * 3, (i - 2) * 0.2, 2);
  }
  function paintColonocyte(g, c) {
    const x = c.x, y = c.y, w = 32, h = 74;
    shadow(g, x, y, 20, 3.5, 0.3);
    const p = new Path2D();
    p.moveTo(x - w / 2, y); p.lineTo(x - w / 2, y - h + w / 2); p.arc(x, y - h + w / 2, w / 2, Math.PI, 0); p.lineTo(x + w / 2, y); p.closePath();
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#f6c0b2'); gr.addColorStop(0.5, '#eaa294'); gr.addColorStop(1, '#c97868');
    g.fillStyle = gr; g.fill(p);
    g.strokeStyle = 'rgba(120,50,50,0.4)'; g.lineWidth = 1.2; g.stroke(p);
    // apical brush border (microvilli) on the roof
    g.strokeStyle = '#f8d4c8'; g.lineWidth = 1.5;
    for (let a = Math.PI * 1.08; a < Math.PI * 1.95; a += 0.16) {
      const bx = x + Math.cos(a) * w / 2, by = y - h + w / 2 + Math.sin(a) * w / 2;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * 4, by + Math.sin(a) * 4); g.stroke();
    }
    // nucleus window frame
    g.fillStyle = '#7e4c52'; g.beginPath(); g.arc(x, y - h * 0.56, 8.4, 0, TAU); g.fill();
    g.fillStyle = '#ffd896'; g.beginPath(); g.arc(x, y - h * 0.56, 6.6, 0, TAU); g.fill();
    g.strokeStyle = '#7e4c52'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 6.6, y - h * 0.56); g.lineTo(x + 6.6, y - h * 0.56); g.moveTo(x, y - h * 0.56 - 6.6); g.lineTo(x, y - h * 0.56 + 6.6); g.stroke();
    // door
    g.fillStyle = '#6f4232'; g.beginPath(); g.moveTo(x - 5.5, y); g.lineTo(x - 5.5, y - 12); g.arc(x, y - 12, 5.5, Math.PI, 0); g.lineTo(x + 5.5, y); g.closePath(); g.fill();
    g.fillStyle = '#f5c56a'; g.beginPath(); g.arc(x + 2.6, y - 7, 0.9, 0, TAU); g.fill();
    // hook for lanterns
    g.strokeStyle = '#4b3530'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(x + w / 2, y - 26); g.lineTo(x + w / 2 + 6, y - 26); g.stroke();
    c.win = { x, y: y - h * 0.56 };
    c.door = { x: x + 1, y: y + 10 };
    c.hook = { x: x + w / 2 + 5, y: y - 24 };
  }
  function paintBakery(g, n) {
    paintYard(g, n, [240, 186, 120]);
    // lantern lane (cobbles) from road to colonocyte houses
    const a = L.laneEntry, b = { x: n.cx - 86, y: HZ + 22 };
    for (let i = 0; i <= 26; i++) {
      const t = i / 26, x = lerp(a.x, b.x, t) + Math.sin(t * 3) * 10, y = lerp(a.y, b.y, t), w = lerp(34, 18, t);
      for (let j = -1; j <= 1; j++) {
        g.fillStyle = hsl(18 + (i * 7 + j * 3) % 10, 22, 62 + ((i + j) % 3) * 4);
        g.beginPath(); g.ellipse(x + j * w * 0.34 + (i % 2) * 2, y, w * 0.16, w * 0.09, 0, 0, TAU); g.fill();
      }
    }
    for (const c of L.colonocytes) paintColonocyte(g, c);
    // lane posts with hanging lantern hooks
    for (const p of L.lanePosts) {
      g.fillStyle = '#5a3c2e'; g.fillRect(p.x - 1.2, p.y - 34, 2.4, 34);
      g.fillRect(p.x - 1.2, p.y - 34, 9, 2);
      g.strokeStyle = '#5a3c2e'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(p.x + 7, p.y - 32); g.lineTo(p.x + 7, p.y - 28); g.stroke();
      p.glow = { x: p.x + 7, y: p.y - 24 };
      g.fillStyle = '#f2a94a'; g.beginPath(); g.ellipse(p.x + 7, p.y - 24, 3, 4, 0, 0, TAU); g.fill();
      shadow(g, p.x, p.y, 6, 1.6, 0.3);
    }
    // the bakery cottage with a loaf roof
    const x = n.cx + 62, y = 470, w = 112, h = 58;
    shadow(g, x, y + 2, 72, 10, 0.35);
    // chimney
    g.fillStyle = '#9c5a44'; g.fillRect(x + 28, y - h - 52, 16, 40);
    g.fillStyle = '#7d4535'; g.fillRect(x + 26, y - h - 56, 20, 6);
    L.chimney.x = x + 36; L.chimney.y = y - h - 58;
    let gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#fff3e0'); gr.addColorStop(1, '#e2bf9c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2 + 3, y - h); g.lineTo(x + w / 2 - 3, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
    g.strokeStyle = '#8a5a40'; g.lineWidth = 2.2; // timber
    g.beginPath(); g.moveTo(x - w / 2 + 2, y - h * 0.55); g.lineTo(x + w / 2 - 2, y - h * 0.55);
    g.moveTo(x - w * 0.18, y - h); g.lineTo(x - w * 0.18, y); g.moveTo(x + w * 0.24, y - h); g.lineTo(x + w * 0.24, y); g.stroke();
    // loaf roof
    const ry = y - h + 4;
    gr = g.createLinearGradient(0, ry - 56, 0, ry);
    gr.addColorStop(0, '#f2b766'); gr.addColorStop(0.55, '#d98a3e'); gr.addColorStop(1, '#a8602c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2 - 10, ry);
    g.bezierCurveTo(x - w / 2 - 14, ry - 66, x + w / 2 + 14, ry - 66, x + w / 2 + 10, ry);
    g.quadraticCurveTo(x, ry + 8, x - w / 2 - 10, ry); g.fill();
    g.strokeStyle = 'rgba(255,230,180,0.75)'; g.lineWidth = 2.4; g.lineCap = 'round';
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 20 - 6, ry - 36 + Math.abs(i) * 6); g.quadraticCurveTo(x + i * 20, ry - 46 + Math.abs(i) * 7, x + i * 20 + 7, ry - 38 + Math.abs(i) * 6); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(x - 22, ry - 40, 30, 8, -0.15, 0, TAU); g.fill();
    // oven window (glow animated live)
    L.oven.x = x - w * 0.36; L.oven.y = y - 20;
    g.fillStyle = '#5c3426'; g.beginPath(); g.moveTo(L.oven.x - 14, y - 6); g.lineTo(L.oven.x - 14, y - 22); g.arc(L.oven.x, y - 22, 14, Math.PI, 0); g.lineTo(L.oven.x + 14, y - 6); g.closePath(); g.fill();
    gr = g.createRadialGradient(L.oven.x, y - 14, 1, L.oven.x, y - 16, 14);
    gr.addColorStop(0, '#fff2b8'); gr.addColorStop(0.6, '#ffae4a'); gr.addColorStop(1, '#d4602a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(L.oven.x - 10, y - 8); g.lineTo(L.oven.x - 10, y - 22); g.arc(L.oven.x, y - 22, 10, Math.PI, 0); g.lineTo(L.oven.x + 10, y - 8); g.closePath(); g.fill();
    // door
    g.fillStyle = '#7a4a35'; g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + 2, y - 26); g.arc(x + 11, y - 26, 9, Math.PI, 0); g.lineTo(x + 20, y); g.closePath(); g.fill();
    g.fillStyle = '#f5c56a'; g.beginPath(); g.arc(x + 16, y - 13, 1.2, 0, TAU); g.fill();
    // round window
    g.fillStyle = '#6b4a3a'; g.beginPath(); g.arc(x + 40, y - 30, 8, 0, TAU); g.fill();
    g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(x + 40, y - 30, 6.4, 0, TAU); g.fill();
    // hanging sign: a lantern emblem
    g.strokeStyle = '#5a3c2e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 4, y - h + 2); g.lineTo(x - 4, y - h + 8); g.moveTo(x - 24, y - h + 2); g.lineTo(x - 24, y - h + 8); g.stroke();
    g.fillStyle = '#fbf3e4'; g.beginPath(); g.roundRect ? g.roundRect(x - 30, y - h + 8, 32, 14, 4) : g.rect(x - 30, y - h + 8, 32, 14); g.fill();
    g.fillStyle = '#f2a94a'; g.beginPath(); g.ellipse(x - 14, y - h + 15, 3.4, 4.6, 0, 0, TAU); g.fill();
    g.fillStyle = '#5a3c2e'; g.fillRect(x - 16, y - h + 9.4, 4, 1.6);
    // flour sacks + lantern bench
    const sx = x + w / 2 - 6;
    [[0, 0], [9, 2], [4, -9]].forEach(([dx, dy]) => {
      g.fillStyle = '#f3e6cf'; g.beginPath(); g.ellipse(sx + dx, y + 6 + dy - 7, 7, 8, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,110,80,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(sx + dx - 3, y + dy - 12); g.lineTo(sx + dx + 3, y + dy - 12); g.stroke();
    });
    // delivery crate (jars drawn live)
    const c = L.crate;
    shadow(g, c.x, c.y + 1, 18, 3);
    g.fillStyle = '#a8744e'; g.fillRect(c.x - 15, c.y - 10, 30, 10);
    g.strokeStyle = '#7a4f34'; g.lineWidth = 1; g.strokeRect(c.x - 15, c.y - 10, 30, 10);
    g.beginPath(); g.moveTo(c.x - 15, c.y - 5); g.lineTo(c.x + 15, c.y - 5); g.stroke();
    // string of lanterns along the eaves (glows live)
    L.eaves = [];
    g.strokeStyle = 'rgba(70,40,30,0.7)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - w / 2 - 6, ry - 2);
    g.quadraticCurveTo(x - w / 4, ry + 10, x, ry + 2); g.quadraticCurveTo(x + w / 4, ry + 10, x + w / 2 + 6, ry - 2); g.stroke();
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6, lx = lerp(x - w / 2 - 6, x + w / 2 + 6, t), ly = ry + 4 + Math.sin(t * Math.PI * 2) * 0 + (1 - Math.abs(Math.cos(t * Math.PI * 2))) * 4;
      g.fillStyle = i % 2 ? '#ffcf7a' : '#f5a64a'; g.beginPath(); g.ellipse(lx, ly + 3, 2.6, 3.4, 0, 0, TAU); g.fill();
      L.eaves.push({ x: lx, y: ly + 3 });
    }
  }
  function stalk(g, x, y, h, kind, sway) {
    g.strokeStyle = kind === 'oat' ? '#b49a4a' : '#9aa84a'; g.lineWidth = 1.2;
    const tx = x + sway, ty = y - h;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sway * 0.2, y - h * 0.6, tx, ty); g.stroke();
    if (kind === 'oat') { // droopy oat spikelets (beta-glucan)
      g.fillStyle = '#f2cf7c';
      for (let i = 0; i < 5; i++) {
        const sx = tx + (i % 2 ? 4 : -4) * (1 - i * 0.12), sy = ty + i * 3.6;
        g.strokeStyle = '#c9a65a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(tx, ty + i * 3); g.lineTo(sx, sy); g.stroke();
        g.beginPath(); g.ellipse(sx, sy + 1.6, 1.5, 2.6, 0, 0, TAU); g.fill();
      }
    } else { // wheat-like ear (arabinoxylan)
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#e3d27a' : '#cfc061';
        g.beginPath(); g.ellipse(tx + (i % 2 ? 1.6 : -1.6), ty + i * 2.6, 1.7, 2.8, i % 2 ? 0.4 : -0.4, 0, TAU); g.fill();
      }
    }
  }
  function cabbage(g, x, y, r) { // leafy cellulose crop
    shadow(g, x, y + 1, r * 1.2, r * 0.3, 0.3);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      g.fillStyle = hsl(96 + i * 4, 44, 40 + i * 4);
      g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.55, y - r * 0.6 + Math.sin(a) * r * 0.35, r * 0.6, r * 0.42, a + Math.PI / 2, 0, TAU); g.fill();
    }
    g.fillStyle = '#b8de8a'; g.beginPath(); g.arc(x, y - r * 0.7, r * 0.45, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(60,100,40,0.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y - r * 1.1); g.lineTo(x, y - r * 0.3); g.stroke();
  }
  function paintFields(g, n) {
    paintYard(g, n, [176, 200, 120]);
    const rnd = mulberry(404);
    const rows = [414, 432, 450, 469];
    rows.forEach((ry, ri) => {
      const x0 = n.cx - 132 + ri * 2, x1 = n.cx + 50 - ri * 4;
      g.fillStyle = '#8a6244'; g.beginPath(); g.ellipse((x0 + x1) / 2, ry + 1, (x1 - x0) / 2 + 8, 4.2, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(60,36,24,0.35)'; g.beginPath(); g.ellipse((x0 + x1) / 2, ry + 2.5, (x1 - x0) / 2 + 6, 2, 0, 0, TAU); g.fill();
      const depth = 0.75 + ri * 0.09;
      for (let x = x0 + 4; x < x1; x += 9 + rnd() * 3) {
        if (ri === 2) { if ((x | 0) % 2 === 0 || rnd() < 0.5) cabbage(g, x, ry + 1, 6.5 * depth); }
        else if (ri === 3) { g.fillStyle = hsl(110 + rnd() * 20, 46, 46); g.beginPath(); g.ellipse(x, ry - 3, 2.6, 4.5, rnd() - 0.5, 0, TAU); g.ellipse(x + 3, ry - 2, 2.2, 3.6, 0.6, 0, TAU); g.fill(); }
        else stalk(g, x, ry + 1, (30 + rnd() * 12) * depth, ri === 0 ? 'oat' : 'wheat', (rnd() - 0.5) * 6);
      }
    });
    // windmill tower (blades are drawn live)
    const m = L.windmill;
    shadow(g, m.x, m.y + 2, 30, 6, 0.35);
    let gr = g.createLinearGradient(m.x - 20, 0, m.x + 20, 0);
    gr.addColorStop(0, '#fff3e2'); gr.addColorStop(1, '#d9b89a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(m.x - 22, m.y); g.lineTo(m.x - 13, m.y - 82); g.lineTo(m.x + 13, m.y - 82); g.lineTo(m.x + 22, m.y); g.closePath(); g.fill();
    g.fillStyle = '#7a4a35'; g.beginPath(); g.moveTo(m.x - 6, m.y); g.lineTo(m.x - 6, m.y - 14); g.arc(m.x, m.y - 14, 6, Math.PI, 0); g.lineTo(m.x + 6, m.y); g.fill();
    g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(m.x, m.y - 46, 4.4, 0, TAU); g.fill();
    gr = g.createLinearGradient(0, m.y - 104, 0, m.y - 80);
    gr.addColorStop(0, '#9fcf86'); gr.addColorStop(1, '#5f8f55');
    g.fillStyle = gr; g.beginPath(); g.moveTo(m.x - 18, m.y - 80); g.quadraticCurveTo(m.x, m.y - 116, m.x + 18, m.y - 80); g.closePath(); g.fill();
    m.hub = { x: m.x, y: m.y - 88 };
    // harvest basket
    const b = L.basket;
    shadow(g, b.x, b.y + 1, 14, 3);
    g.fillStyle = '#b8864f'; g.beginPath(); g.moveTo(b.x - 12, b.y - 12); g.lineTo(b.x + 12, b.y - 12); g.lineTo(b.x + 9, b.y); g.lineTo(b.x - 9, b.y); g.closePath(); g.fill();
    g.strokeStyle = '#8a5f34'; g.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(b.x - 12 + i * 0.8, b.y - 12 + i * 3); g.lineTo(b.x + 12 - i * 0.8, b.y - 12 + i * 3); g.stroke(); }
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#8fcb7a' : '#f2cf7c'; g.beginPath(); g.ellipse(b.x - 8 + i * 4, b.y - 13, 3, 2, (i - 2) * 0.3, 0, TAU); g.fill(); }
    // little fence
    g.strokeStyle = '#a9805c'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(n.cx - 140, 478); g.lineTo(n.cx - 92, 480); g.moveTo(n.cx - 140, 472); g.lineTo(n.cx - 92, 474); g.stroke();
    for (let x = n.cx - 138; x < n.cx - 90; x += 12) { g.beginPath(); g.moveTo(x, 482); g.lineTo(x, 468); g.stroke(); }
  }
  function bulb(g, x, y, s) { // onion/chicory bulb hanging from the canopy
    g.strokeStyle = '#6a8a4a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y - 7 * s); g.lineTo(x, y - 12 * s); g.stroke();
    const gr = g.createRadialGradient(x - 2 * s, y - 2 * s, 0.5, x, y, 7 * s);
    gr.addColorStop(0, '#fff6ff'); gr.addColorStop(0.55, '#e2c9f6'); gr.addColorStop(1, '#a77fcf');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(x, y - 8 * s); g.bezierCurveTo(x + 2 * s, y - 5 * s, x + 6.5 * s, y - 3 * s, x + 6 * s, y + 1.5 * s);
    g.bezierCurveTo(x + 5.5 * s, y + 6 * s, x - 5.5 * s, y + 6 * s, x - 6 * s, y + 1.5 * s);
    g.bezierCurveTo(x - 6.5 * s, y - 3 * s, x - 2 * s, y - 5 * s, x, y - 8 * s); g.fill();
    g.strokeStyle = 'rgba(140,90,180,0.45)'; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y - 7 * s); g.quadraticCurveTo(x + 4 * s, y, x + 1.5 * s, y + 5 * s); g.moveTo(x, y - 7 * s); g.quadraticCurveTo(x - 4 * s, y, x - 1.5 * s, y + 5 * s); g.stroke();
    g.strokeStyle = 'rgba(250,240,220,0.9)'; g.beginPath(); g.moveTo(x - 1, y + 5 * s); g.lineTo(x - 2, y + 7 * s); g.moveTo(x + 1, y + 5 * s); g.lineTo(x + 2, y + 7 * s); g.stroke();
  }
  function paintOrchard(g, n) {
    paintYard(g, n, [150, 196, 120]);
    const rnd = mulberry(77);
    L.bulbs = [];
    for (const t of L.trees) {
      const s = t.s, th = 74 * s, cr = 50 * s;
      shadow(g, t.x, t.y + 2, cr * 0.9, cr * 0.2, 0.32);
      let gr = g.createLinearGradient(t.x - 8 * s, 0, t.x + 8 * s, 0);
      gr.addColorStop(0, '#9a6a4a'); gr.addColorStop(1, '#5e3e2c');
      g.fillStyle = gr; g.beginPath();
      g.moveTo(t.x - 9 * s, t.y); g.quadraticCurveTo(t.x - 4 * s, t.y - th * 0.5, t.x - 6 * s, t.y - th);
      g.lineTo(t.x + 6 * s, t.y - th); g.quadraticCurveTo(t.x + 3 * s, t.y - th * 0.5, t.x + 10 * s, t.y); g.closePath(); g.fill();
      // roots
      g.strokeStyle = '#6e4a34'; g.lineWidth = 2.4 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(t.x - 6 * s, t.y - 2); g.quadraticCurveTo(t.x - 14 * s, t.y, t.x - 18 * s, t.y + 2); g.moveTo(t.x + 7 * s, t.y - 2); g.quadraticCurveTo(t.x + 14 * s, t.y, t.x + 18 * s, t.y + 3); g.stroke();
      const cy = t.y - th - cr * 0.55;
      const blobs = [[0, 0, 1], [-0.62, 0.22, 0.72], [0.62, 0.2, 0.76], [-0.3, -0.42, 0.7], [0.34, -0.38, 0.72], [0, 0.42, 0.7]];
      for (const [bx, by, br] of blobs) {
        gr = g.createRadialGradient(t.x + bx * cr - cr * 0.25 * br, cy + by * cr - cr * 0.3 * br, 1, t.x + bx * cr, cy + by * cr, cr * 0.62 * br);
        gr.addColorStop(0, '#b7df8e'); gr.addColorStop(0.6, '#6fae63'); gr.addColorStop(1, '#3f7a4e');
        g.fillStyle = gr; g.beginPath(); g.arc(t.x + bx * cr, cy + by * cr, cr * 0.62 * br, 0, TAU); g.fill();
      }
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(220,255,190,${0.2 + rnd() * 0.25})`; g.beginPath(); g.arc(t.x + (rnd() - 0.5) * cr * 1.6, cy + (rnd() - 0.6) * cr * 1.1, 1 + rnd() * 2, 0, TAU); g.fill(); }
      const nb = 6;
      for (let i = 0; i < nb; i++) {
        const bx = t.x + (i / (nb - 1) - 0.5) * cr * 1.5 + (rnd() - 0.5) * 6, by = cy + cr * (0.3 + rnd() * 0.45);
        bulb(g, bx, by, s * 1.05);
        L.bulbs.push({ x: bx, y: by, ph: rnd() * TAU });
      }
    }
    // fallen bulbs and chicory flowers
    for (let i = 0; i < 6; i++) bulb(g, n.cx - 110 + i * 40 + rnd() * 10, 478 + rnd() * 6, 0.8);
    for (let i = 0; i < 26; i++) {
      const fx = n.x0 + 20 + rnd() * (NW - 40), fy = 476 + rnd() * 10;
      g.fillStyle = '#9fb6ff';
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.beginPath(); g.ellipse(fx + Math.cos(a) * 2, fy + Math.sin(a) * 1.4, 1.5, 0.9, a, 0, TAU); g.fill(); }
      g.fillStyle = '#fff4c8'; g.beginPath(); g.arc(fx, fy, 0.9, 0, TAU); g.fill();
    }
  }
  function flask(g, x, y, s, col) {
    g.fillStyle = rgba(col, 0.9);
    g.beginPath(); g.moveTo(x - 1.6 * s, y - 9 * s); g.lineTo(x - 1.6 * s, y - 5 * s); g.lineTo(x - 5 * s, y); g.lineTo(x + 5 * s, y); g.lineTo(x + 1.6 * s, y - 5 * s); g.lineTo(x + 1.6 * s, y - 9 * s); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.7; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x - 3 * s, y - 2.5 * s, 1.2 * s, 2 * s);
  }
  function paintLab(g, n) {
    paintYard(g, n, [140, 200, 186]);
    const h = L.labHut, x = h.x, y = h.y, w = 78, hh = 60;
    shadow(g, x, y + 2, 56, 9, 0.35);
    // stone tower
    let gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, '#efe6da'); gr.addColorStop(1, '#a99f94');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w / 2 + 4, y - hh); g.lineTo(x + w / 2 - 4, y - hh); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(110,100,92,0.35)'; g.lineWidth = 0.8;
    for (let r = 1; r < 5; r++) { const yy = y - r * 12; g.beginPath(); g.moveTo(x - w / 2 + r, yy); g.lineTo(x + w / 2 - r, yy); g.stroke(); for (let k = 0; k < 5; k++) { const xx = x - w / 2 + 8 + k * 16 + (r % 2) * 8; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 12); g.stroke(); } }
    // copper dome
    gr = g.createRadialGradient(x - 14, y - hh - 34, 2, x, y - hh - 10, 50);
    gr.addColorStop(0, '#bff0dc'); gr.addColorStop(0.5, '#5fb79e'); gr.addColorStop(1, '#2f7a6a');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2 - 6, y - hh + 2); g.bezierCurveTo(x - w / 2, y - hh - 58, x + w / 2, y - hh - 58, x + w / 2 + 6, y - hh + 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 14, y - hh + 2); g.quadraticCurveTo(x + k * 8, y - hh - 30, x, y - hh - 42); g.stroke(); }
    g.fillStyle = '#e8c27a'; g.beginPath(); g.arc(x, y - hh - 46, 3.2, 0, TAU); g.fill(); g.fillRect(x - 0.8, y - hh - 54, 1.6, 8);
    // telescope
    g.save(); g.translate(x + 18, y - hh - 30); g.rotate(-0.6); g.fillStyle = '#8a6a4a'; g.fillRect(0, -3, 26, 6); g.fillStyle = '#c9a66a'; g.fillRect(22, -4, 5, 8); g.restore();
    // bent chimney pipe
    g.strokeStyle = '#b07a52'; g.lineWidth = 5; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x + 30, y - hh + 4); g.lineTo(x + 30, y - hh - 22); g.quadraticCurveTo(x + 30, y - hh - 30, x + 36, y - hh - 32); g.lineTo(x + 36, y - hh - 52); g.stroke();
    L.labChimney.x = x + 36; L.labChimney.y = y - hh - 54;
    // round windows (glow live) + door
    L.labWins = [{ x: x - 20, y: y - 36 }, { x: x + 20, y: y - 38 }];
    for (const wv of L.labWins) { g.fillStyle = '#4c5a54'; g.beginPath(); g.arc(wv.x, wv.y, 8, 0, TAU); g.fill(); g.fillStyle = '#c9f6e4'; g.beginPath(); g.arc(wv.x, wv.y, 6.4, 0, TAU); g.fill(); }
    g.fillStyle = '#56463e'; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x - 8, y - 18); g.arc(x, y - 18, 8, Math.PI, 0); g.lineTo(x + 8, y); g.closePath(); g.fill();
    // bench with flasks
    const bx = x + 70, by = 476;
    shadow(g, bx, by + 1, 26, 4);
    g.fillStyle = '#9c6c4a'; g.fillRect(bx - 22, by - 14, 44, 4); g.fillRect(bx - 20, by - 10, 3, 10); g.fillRect(bx + 17, by - 10, 3, 10);
    flask(g, bx - 14, by - 14, 1, [176, 110, 226]); flask(g, bx - 2, by - 14, 1.3, [236, 96, 140]); flask(g, bx + 12, by - 14, 0.9, [112, 214, 176]);
    // copper coil from tower to a retort
    g.strokeStyle = '#c98a5a'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x + w / 2 - 4, y - 26); for (let k = 0; k < 5; k++) g.arc(x + w / 2 + 6 + k * 3, y - 24 + k * 2, 3, Math.PI, TAU * 1.1); g.stroke();
    // cauldron on a little fire
    const c = L.cauldron;
    shadow(g, c.x, c.y + 2, 24, 5, 0.38);
    g.fillStyle = '#5a3a2a'; [[-12, 0], [0, 2], [12, 0]].forEach(([dx, dy]) => { g.beginPath(); g.ellipse(c.x + dx, c.y + dy, 5, 2.4, 0, 0, TAU); g.fill(); });
    gr = g.createRadialGradient(c.x - 6, c.y - 18, 2, c.x, c.y - 12, 22);
    gr.addColorStop(0, '#5c5a66'); gr.addColorStop(1, '#1f1d26');
    g.fillStyle = gr; g.beginPath(); g.ellipse(c.x, c.y - 12, 19, 14, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a2830'; g.beginPath(); g.ellipse(c.x, c.y - 24, 20, 5.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#9b5fe0'; g.beginPath(); g.ellipse(c.x, c.y - 24, 16.5, 3.8, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(c.x - 9, c.y - 16, 4, 6, -0.4, 0, TAU); g.fill();
    c.surf = { x: c.x, y: c.y - 24 };
    // polyphenol berry bushes
    for (const [dx, dy] of [[-104, 470], [96, 470]]) {
      const ex = n.cx + dx;
      for (let k = 0; k < 4; k++) { g.fillStyle = hsl(140 + k * 8, 34, 34 + k * 5); g.beginPath(); g.arc(ex + (k - 1.5) * 7, dy - 8 - (k % 2) * 4, 9, 0, TAU); g.fill(); }
      for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#7a3fb4' : '#c0396a'; g.beginPath(); g.arc(ex - 12 + k * 4, dy - 8 - (k % 3) * 4, 2, 0, TAU); g.fill(); }
    }
  }
  function paintSprings(g, n) {
    const rnd = mulberry(909);
    softEllipse(g, n.cx, 510, 150, 60, [60, 62, 40], 0.45);
    // cracks
    g.strokeStyle = 'rgba(40,40,26,0.45)'; g.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      let x = n.x0 + 20 + rnd() * (NW - 20), y = 480 + rnd() * 160; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 18; y += (rnd() - 0.3) * 8; g.lineTo(x, y); }
      g.stroke();
    }
    // rocks with sulfur crust
    const rock = (x, y, rx, ry) => {
      shadow(g, x, y + 2, rx * 1.1, ry * 0.3);
      const gr = g.createRadialGradient(x - rx * 0.3, y - ry * 1.3, 1, x, y - ry * 0.8, rx * 1.2);
      gr.addColorStop(0, '#a3a088'); gr.addColorStop(0.7, '#6d6a56'); gr.addColorStop(1, '#45432f');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - rx, y); g.quadraticCurveTo(x - rx * 1.05, y - ry * 1.4, x - rx * 0.2, y - ry * 1.9); g.quadraticCurveTo(x + rx * 0.8, y - ry * 1.8, x + rx, y); g.closePath(); g.fill();
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(214,214,90,${0.35 + rnd() * 0.3})`; g.beginPath(); g.arc(x + (rnd() - 0.5) * rx * 1.4, y - rnd() * ry * 1.4, 1.5 + rnd() * 3, 0, TAU); g.fill(); }
    };
    rock(n.cx - 70, 452, 34, 28); rock(n.cx + 34, 444, 46, 36); rock(n.cx - 10, 462, 18, 14); rock(n.cx + 96, 470, 20, 18);
    // vent cone
    const v = L.vent;
    g.fillStyle = '#5c5a44'; g.beginPath(); g.moveTo(v.x - 14, v.y + 8); g.lineTo(v.x - 4, v.y - 14); g.lineTo(v.x + 4, v.y - 14); g.lineTo(v.x + 14, v.y + 8); g.closePath(); g.fill();
    g.fillStyle = '#d6d65a'; g.beginPath(); g.ellipse(v.x, v.y - 14, 5, 2, 0, 0, TAU); g.fill();
    v.top = { x: v.x, y: v.y - 15 };
    // basin rims (water drawn live, its size depends on diet)
    for (const b of L.basins) {
      g.fillStyle = '#4c4a32'; g.beginPath(); g.ellipse(b.x, b.y, b.rx + 8, b.ry + 4, 0, 0, TAU); g.fill();
      g.fillStyle = '#6b684a'; g.beginPath(); g.ellipse(b.x, b.y - 1.5, b.rx + 5, b.ry + 2, 0, 0, TAU); g.fill();
      g.fillStyle = '#3e3c28'; g.beginPath(); g.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, TAU); g.fill();
      for (let i = 0; i < 14; i++) { const a = rnd() * TAU; g.fillStyle = 'rgba(214,214,90,0.55)'; g.beginPath(); g.arc(b.x + Math.cos(a) * (b.rx + 4), b.y + Math.sin(a) * (b.ry + 2), 1.4 + rnd() * 1.6, 0, TAU); g.fill(); }
    }
    // dry reeds
    g.strokeStyle = '#8a8456'; g.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const x = n.cx - 130 + rnd() * 40 + (i > 7 ? 200 : 0), y = 500 + rnd() * 30; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - 10, x + (rnd() - 0.5) * 8, y - 18 - rnd() * 8); g.stroke(); }
  }
  const LANDMARKS = { mucus: paintMucus, quarry: paintQuarry, bakery: paintBakery, fields: paintFields, orchard: paintOrchard, lab: paintLab, springs: paintSprings };
  // Paint every landmark once into a throwaway 1x1 canvas so that live-animation anchors
  // (doors, chimneys, windows, hubs) exist before any tile is rendered.
  (function primeGeometry() {
    const g = document.createElement('canvas').getContext('2d');
    for (const n of NICHES) LANDMARKS[n.id](g, n);
  })();

  // ---- scene generation (seeded so tiles agree at their seams) -------------
  let SCENE = null;
  function buildScene(bx0, bx1) {
    const rnd = mulberry(20250917), r = (a, b) => a + rnd() * (b - a);
    const S = { far1: [], far2: [], bokeh: [], wall: [], wallFront: [], edge: [] };
    for (let x = bx0 - 40; x < bx1 + 40; x += r(18, 30)) S.far1.push({ x, w: r(20, 30), h: r(90, 170), l: r(66, 74), hue: r(318, 334), seed: (rnd() * 1e9) | 0 });
    for (let x = bx0 - 40; x < bx1 + 40; x += r(36, 62)) S.far2.push({ x, w: r(30, 42), h: r(130, 230), l: r(58, 64), hue: r(340, 352), seed: (rnd() * 1e9) | 0 });
    for (let i = 0; i < (bx1 - bx0) * 0.06; i++) S.bokeh.push({ x: r(bx0, bx1), y: r(YMIN + 20, HZ - 40), r: r(2, 10), a: r(0.04, 0.15), c: (rnd() * 3) | 0 });
    for (let x = -50; x < WW + 50; x += 0) { const w = r(40, 58); S.wall.push({ x, w, h: r(170, 300), j: r(-5, 5), seed: (rnd() * 1e9) | 0 }); x += w * r(0.95, 1.55); }
    for (let x = -30; x < WW + 30; x += 0) { const w = r(26, 40); S.wallFront.push({ x, w, h: r(64, 130), j: r(-6, 6), seed: (rnd() * 1e9) | 0 }); x += w * r(1.5, 2.8); }
    SCENE = S;
  }

  /* ======================================================================
     3. Tiles, sprites
     ====================================================================== */
  let W = 0, H = 0, DPR = 1, s = 1;            // viewport + base scale (world units -> css px)
  let back = null, main = null;                // tile sets
  let props = [];                              // y-sorted scenery sprites (homes, lamps)
  let glowSpr = {}, puffSpr = {};

  function makeGlow(c) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); gr.addColorStop(0.25, `rgba(${c[0]},${c[1]},${c[2]},0.5)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return cv;
  }
  function makePuff(c) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 48;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.9)`); gr.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},0.45)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return cv;
  }
  function glow(key, c) { return glowSpr[key] || (glowSpr[key] = makeGlow(c)); }
  function initSprites() {
    glow('warm', [255, 222, 160]); glow('amber', [255, 168, 70]); glow('pink', [255, 196, 228]);
    glow('teal', [150, 255, 220]); glow('lilac', [214, 186, 255]); glow('sulfur', [220, 232, 110]); glow('white', [255, 250, 240]);
    puffSpr.cream = makePuff([255, 244, 230]); puffSpr.lilac = makePuff([200, 170, 240]); puffSpr.sulfur = makePuff([196, 200, 130]); puffSpr.mint = makePuff([190, 240, 220]);
  }

  function backRange() {
    const zmin = zoomMin(), Smin = s * zmin, half = W / (2 * Smin);
    return [-(1 - P) * half - 40, P * WW + (1 - P) * half + 40];
  }
  function paintBack(g, x0, x1) {
    const S = SCENE;
    let gr = g.createLinearGradient(0, YMIN, 0, BACK_Y1);
    gr.addColorStop(0, '#1d1030'); gr.addColorStop(0.3, '#3b1846'); gr.addColorStop(0.62, '#8c3d5f'); gr.addColorStop(0.86, '#e08a72'); gr.addColorStop(1, '#f4b07c');
    g.fillStyle = gr; g.fillRect(x0, YMIN, x1 - x0, BACK_Y1 - YMIN);
    // niche glows, painted where the camera will see them (parallax)
    for (const n of NICHES) {
      const gx = n.cx * P, gy = HZ - 70;
      if (gx < x0 - 500 || gx > x1 + 500) continue;
      gr = g.createRadialGradient(gx, gy, 0, gx, gy, 430);
      gr.addColorStop(0, rgba(n.glow, n.id === 'springs' ? 0.45 : 0.72)); gr.addColorStop(0.25, rgba(n.glow, 0.3)); gr.addColorStop(1, rgba(n.glow, 0));
      g.fillStyle = gr; g.fillRect(gx - 430, gy - 430, 860, 860);
      g.save(); g.globalCompositeOperation = 'lighter';
      const rr = mulberry(n.i * 31 + 7);
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (rr() - 0.5) * 2.2, sp = 0.02 + rr() * 0.04, len = 520;
        const rg = g.createRadialGradient(gx, gy, 0, gx, gy, len);
        rg.addColorStop(0, rgba(n.glow, 0.13)); rg.addColorStop(1, rgba(n.glow, 0));
        g.fillStyle = rg; g.beginPath(); g.moveTo(gx, gy);
        g.lineTo(gx + Math.cos(ang - sp) * len, gy + Math.sin(ang - sp) * len); g.lineTo(gx + Math.cos(ang + sp) * len, gy + Math.sin(ang + sp) * len); g.closePath(); g.fill();
      }
      g.restore();
    }
    { // murky green-grey air drifting over the Sulfur Springs end
      const mx = NB.springs.cx * P + 160, my = HZ - 120;
      if (mx - 520 < x1) {
        gr = g.createRadialGradient(mx, my, 0, mx, my, 520);
        gr.addColorStop(0, 'rgba(52,56,30,0.5)'); gr.addColorStop(1, 'rgba(52,56,30,0)');
        g.fillStyle = gr; g.fillRect(mx - 520, my - 520, 1040, 1040);
      }
    }
    g.save(); g.globalCompositeOperation = 'lighter';
    const bc = [[255, 214, 180], [255, 190, 220], [255, 236, 200]];
    for (const b of S.bokeh) { if (b.x < x0 - 12 || b.x > x1 + 12) continue; g.fillStyle = rgba(bc[b.c], b.a); g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); }
    g.restore();
    g.save(); try { g.filter = 'blur(1.2px)'; } catch (e) { /* ignore */ }
    for (const v of S.far1) if (v.x > x0 - 40 && v.x < x1 + 40) villus(g, v.x, HZ - 8, v.w, v.h, [v.hue, 30, v.l], mulberry(v.seed), 0);
    g.restore();
    gr = g.createLinearGradient(0, HZ - 190, 0, HZ);
    gr.addColorStop(0, 'rgba(255,190,170,0)'); gr.addColorStop(1, 'rgba(255,204,176,0.6)');
    g.fillStyle = gr; g.fillRect(x0, HZ - 190, x1 - x0, 190);
    gr = g.createLinearGradient(0, HZ - 60, 0, HZ + 10);
    gr.addColorStop(0, '#d98a86'); gr.addColorStop(1, '#e9a787');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, BACK_Y1);
    for (let x = x0; x <= x1 + 8; x += 8) g.lineTo(x, HZ - 6 - (Math.sin(x * 0.006 + 1) * 0.5 + 0.5) * 34 - (Math.sin(x * 0.019 + 2) * 0.5 + 0.5) * 14);
    g.lineTo(x1, BACK_Y1); g.closePath(); g.fill();
    g.save(); try { g.filter = 'blur(0.6px)'; } catch (e) { /* ignore */ }
    for (const v of S.far2) if (v.x > x0 - 50 && v.x < x1 + 50) villus(g, v.x, HZ + 2, v.w, v.h, [v.hue, 42, v.l], mulberry(v.seed), 0);
    g.restore();
    gr = g.createLinearGradient(0, HZ - 110, 0, HZ + 20);
    gr.addColorStop(0, 'rgba(255,200,170,0)'); gr.addColorStop(1, 'rgba(255,206,172,0.42)');
    g.fillStyle = gr; g.fillRect(x0, HZ - 110, x1 - x0, 180);
  }

  // Grass is generated per 16-unit column cell (seeded), batched into colour buckets.
  const CELL = 16;
  function paintGrass(g, x0, x1) {
    const buckets = new Map();
    const c0 = Math.floor(x0 / CELL) - 1, c1 = Math.ceil(x1 / CELL) + 1;
    for (let ci = c0; ci <= c1; ci++) {
      const rnd = mulberry(ci * 7919 + 1337), cx = ci * CELL;
      const n = nicheAtX(cx + CELL / 2), dens = n.id === 'quarry' ? 0.55 : n.id === 'springs' ? 0.5 : n.id === 'mucus' ? 0.8 : 1;
      const gh = YMAX - HZ, count = (CELL * gh * 0.032 * dens) | 0;
      for (let i = 0; i < count; i++) {
        const p = Math.pow(rnd(), 0.85), y = HZ + 10 + p * gh, x = cx + rnd() * CELL, len = 1.5 + p * 7;
        const ry = roadY(x);
        if (y > ry - 18 && y < ry + 22 && rnd() < 0.85) continue;
        const ci2 = (rnd() * 6) | 0, wb = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
        const key = n.id + ci2 + '|' + wb;
        let b = buckets.get(key);
        if (!b) { b = { p: new Path2D(), n, ci: ci2, wb }; buckets.set(key, b); }
        b.p.moveTo(x, y); b.p.lineTo(x + (rnd() - 0.5) * 3 * p, y - len);
      }
    }
    g.lineCap = 'round';
    for (const b of buckets.values()) {
      const id = b.n.id;
      const hue = id === 'springs' ? 52 + b.ci * 3 : id === 'mucus' ? 70 + b.ci * 6 : id === 'quarry' ? 50 + b.ci * 5 : 58 + b.ci * 7;
      const sat = id === 'springs' ? 22 : id === 'quarry' ? 30 : 46;
      g.strokeStyle = hsl(hue, sat, 36 + b.ci * 3 + (2 - b.wb) * 6, 0.6);
      g.lineWidth = 0.6 + b.wb * 0.45;
      g.stroke(b.p);
    }
  }
  function paintScatter(g, x0, x1) {
    const c0 = Math.floor(x0 / 48) - 1, c1 = Math.ceil(x1 / 48) + 1;
    const leafCols = ['#d9482f', '#e8742c', '#f2a531', '#b8322e', '#e85d3a'];
    for (let ci = c0; ci <= c1; ci++) {
      const rnd = mulberry(ci * 104729 + 99), n = nicheAtX(ci * 48 + 24);
      const nl = n.id === 'springs' ? 1 : n.id === 'mucus' ? 2 : 5;
      for (let i = 0; i < nl; i++) {
        const p = Math.pow(rnd(), 0.7), y = HZ + 120 + p * (YMAX - HZ - 120), x = ci * 48 + rnd() * 48, sz = 2 + p * 4.5;
        g.save(); g.translate(x, y); g.rotate(rnd() * TAU); g.fillStyle = n.id === 'springs' ? '#8a7a4a' : leafCols[(rnd() * leafCols.length) | 0];
        g.beginPath(); g.moveTo(-sz, 0); g.quadraticCurveTo(0, -sz * 0.6, sz, 0); g.quadraticCurveTo(0, sz * 0.6, -sz, 0); g.fill(); g.restore();
      }
      const nf = n.id === 'springs' ? 0 : n.id === 'mucus' || n.id === 'orchard' ? 5 : 3;
      for (let i = 0; i < nf; i++) {
        const p = Math.pow(rnd(), 0.7), y = HZ + 30 + p * (YMAX - HZ - 30), x = ci * 48 + rnd() * 48, sz = 0.8 + p * 1.8;
        const col = n.id === 'mucus' ? '#ffd0e6' : rnd() < 0.5 ? '#fff4ea' : '#ffc6d6';
        g.fillStyle = col;
        for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * sz * 5, y + (rnd() - 0.5) * sz * 2, sz, 0, TAU); g.fill(); }
      }
    }
  }
  function paintRoad(g, x0, x1) {
    const a = Math.max(0, x0 - 20), b = Math.min(WW, x1 + 20);
    g.fillStyle = 'rgba(70,40,40,0.25)'; g.beginPath();
    for (let x = a; x <= b; x += 6) { const y = roadY(x) - 21; x === a ? g.moveTo(x, y) : g.lineTo(x, y); }
    for (let x = b; x >= a; x -= 6) g.lineTo(x, roadY(x) + 27);
    g.closePath(); g.fill();
    g.fillStyle = '#8a6a5c'; g.beginPath();
    for (let x = a; x <= b; x += 6) { const y = roadY(x) - 19; x === a ? g.moveTo(x, y) : g.lineTo(x, y); }
    for (let x = b; x >= a; x -= 6) g.lineTo(x, roadY(x) + 24);
    g.closePath(); g.fill();
    const rows = [[-13, 4.2, 2.2], [-4, 4.8, 2.6], [6, 5.4, 2.9], [17, 6, 3.2]];
    const c0 = Math.floor(a / 11), c1 = Math.ceil(b / 11);
    for (let ci = c0; ci <= c1; ci++) {
      const rnd = mulberry(ci * 3571 + 5);
      rows.forEach(([dy, rx, ry], ri) => {
        const x = ci * 11 + (ri % 2) * 5.5 + (rnd() - 0.5) * 1.5, y = roadY(x) + dy;
        const n = nicheAtX(x), lt = 56 + rnd() * 16 - (n.id === 'springs' ? 16 : 0);
        const sg = g.createLinearGradient(0, y - ry, 0, y + ry);
        sg.addColorStop(0, hsl(10 + rnd() * 14, 20, lt + 8)); sg.addColorStop(1, hsl(10 + rnd() * 14, 18, lt - 14));
        g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, rx * (0.85 + rnd() * 0.25), ry, (rnd() - 0.5) * 0.2, 0, TAU); g.fill();
      });
    }
  }
  function paintTrails(g) {
    for (const n of NICHES) {
      const ex = n.cx + (n.id === 'bakery' ? 30 : -6), ey = roadY(ex);
      g.fillStyle = n.id === 'springs' ? 'rgba(80,76,52,0.5)' : 'rgba(196,150,110,0.42)';
      g.beginPath(); g.moveTo(ex - 18, ey - 16); g.quadraticCurveTo(ex - 10, (ey + 500) / 2, ex - 30, 500); g.lineTo(ex + 30, 500); g.quadraticCurveTo(ex + 10, (ey + 500) / 2, ex + 18, ey - 16); g.closePath(); g.fill();
    }
  }
  function paintMain(g, x0, x1) {
    const S = SCENE;
    // villi wall
    for (const v of S.wall) {
      if (v.x < x0 - 90 || v.x > x1 + 90) continue;
      const c = nicheMix(v.x, 'wall'), gloss = clamp(1 - Math.abs(v.x - NB.mucus.cx) / 200, 0, 1);
      villus(g, v.x, HZ + 8 + v.j * 0.4, v.w, v.h, [c[0] + v.j, c[1], c[2] + v.j * 0.6], mulberry(v.seed), gloss);
    }
    let gr = g.createLinearGradient(0, HZ - 130, 0, HZ + 14);
    gr.addColorStop(0, 'rgba(255,200,172,0)'); gr.addColorStop(1, 'rgba(255,208,176,0.34)');
    g.fillStyle = gr; g.fillRect(x0, HZ - 130, x1 - x0, 144);
    for (const v of S.wallFront) {
      if (v.x < x0 - 70 || v.x > x1 + 70) continue;
      if (Math.abs(v.x - (NB.bakery.cx - 86)) < 60) continue; // room for the colonocyte houses
      const c = nicheMix(v.x, 'wall'), gloss = clamp(1 - Math.abs(v.x - NB.mucus.cx) / 200, 0, 1);
      villus(g, v.x, HZ + 16, v.w, v.h, [c[0] + 4, c[1] + 4, c[2] + 6], mulberry(v.seed), gloss);
    }
    // ground
    const gp = new Path2D();
    gp.moveTo(x0 - 4, YMAX);
    for (let x = x0 - 4; x <= x1 + 10; x += 8) gp.lineTo(x, groundTop(x));
    gp.lineTo(x1 + 10, YMAX); gp.closePath();
    gr = g.createLinearGradient(0, HZ, 0, YMAX);
    gr.addColorStop(0, '#d89e7a'); gr.addColorStop(0.08, '#b89c64'); gr.addColorStop(0.42, '#86803e'); gr.addColorStop(1, '#4b5a28');
    g.fillStyle = gr; g.fill(gp);
    g.save(); g.clip(gp);
    for (const n of NICHES) {
      if (n.x1 + 90 < x0 || n.x0 - 90 > x1) continue;
      const c = n.ground, lg = g.createLinearGradient(n.x0 - 90, 0, n.x1 + 90, 0);
      lg.addColorStop(0, rgba(c, 0)); lg.addColorStop(0.3, rgba(c, c[3])); lg.addColorStop(0.7, rgba(c, c[3])); lg.addColorStop(1, rgba(c, 0));
      g.fillStyle = lg; g.fillRect(Math.max(x0, n.x0 - 90), HZ, Math.min(x1, n.x1 + 90) - Math.max(x0, n.x0 - 90), YMAX - HZ);
    }
    // soft warm light pooled at the wall base
    gr = g.createLinearGradient(0, HZ, 0, HZ + 90);
    gr.addColorStop(0, 'rgba(255,214,170,0.45)'); gr.addColorStop(1, 'rgba(255,214,170,0)');
    g.fillStyle = gr; g.fillRect(x0, HZ, x1 - x0, 90);
    g.restore();
    paintGrass(g, x0, x1);
    paintTrails(g);
    for (const n of NICHES) if (n.x1 + 60 > x0 && n.x0 - 60 < x1) LANDMARKS[n.id](g, n);
    paintRoad(g, x0, x1);
    paintScatter(g, x0, x1);
    // murky haze over the Sulfur Springs corner
    const sp = NB.springs;
    if (sp.x0 - 200 < x1) {
      const hg = g.createLinearGradient(sp.x0 - 140, 0, WW, 0);
      hg.addColorStop(0, 'rgba(70,74,40,0)'); hg.addColorStop(0.45, 'rgba(70,74,40,0.22)'); hg.addColorStop(1, 'rgba(50,52,30,0.4)');
      g.save(); g.globalCompositeOperation = 'source-atop'; // tint only what is painted
      g.fillStyle = hg; g.fillRect(Math.max(x0, sp.x0 - 140), MAIN_Y0, x1 - Math.max(x0, sp.x0 - 140), YMAX - MAIN_Y0);
      g.restore();
    }
    // world ends: tall framing villi
    const ends = [[-10, 1], [WW + 10, -1]];
    for (const [ex, dir] of ends) {
      if (Math.abs(ex - (x0 + x1) / 2) > (x1 - x0) / 2 + 220) continue;
      const rnd = mulberry(ex > 0 ? 5 : 3), dull = dir < 0;
      villus(g, ex + dir * -8, YMAX - 120, 96, 640, dull ? [16, 22, 40] : [348, 46, 48], rnd, dull ? 0 : 0.6);
      villus(g, ex + dir * 80, YMAX - 170, 70, 440, dull ? [24, 20, 46] : [352, 48, 54], rnd, dull ? 0 : 0.6);
      villus(g, ex + dir * 34, YMAX - 30, 90, 300, dull ? [14, 22, 34] : [344, 50, 44], rnd, 0);
    }
  }

  function makeTiles(kind) {
    const isBack = kind === 'back';
    const res = isBack ? Math.min(DPR, 1) : tileRes();      // back layer is soft anyway: 1x
    const k = s * res;                                      // device px per world unit
    const tw = Math.floor(2000 / k) - OV;                   // tile width in units, <= 2048 device px with overlap
    const span = isBack ? backRange() : [0, WW];
    const y0 = isBack ? YMIN : MAIN_Y0, y1 = isBack ? BACK_Y1 : YMAX;
    const tiles = [];
    for (let x = span[0]; x < span[1]; x += tw) tiles.push({ x0: x, w: Math.min(tw, span[1] - x) + OV, cv: null });
    return { kind, k, y0, y1, tiles, painter: isBack ? paintBack : paintMain };
  }
  function renderTile(set, t) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(t.w * set.k); cv.height = Math.ceil((set.y1 - set.y0) * set.k);
    const g = cv.getContext('2d');
    g.setTransform(set.k, 0, 0, set.k, -t.x0 * set.k, -set.y0 * set.k);
    set.painter(g, t.x0, t.x0 + t.w);
    t.cv = cv;
  }
  function tileRes() { return Math.min(2, DPR * Math.max(1, zoomDefault())); }
  function buildPropSprites() {
    props = [];
    const k = s * tileRes();
    const mk = (w, h, ax, ay, fn) => {
      const cv = document.createElement('canvas'); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
      const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, ax * k, ay * k);
      const rec = { cv, w, h, ax, ay, windows: [] }; fn(g, rec); return rec;
    };
    for (const h of L.homes) {
      const w = h.sz * 1.6, hh = h.sz * 1.3;
      const rec = mk(w, hh, w / 2, hh - 6, (g, r) => paintHome(g, h, r));
      props.push({ type: 'home', x: h.x, y: h.y, spr: rec, home: h });
    }
    let lampSpr = null;
    for (const l of L.lamps) {
      if (!lampSpr) lampSpr = mk(28, 84, 14, 80, (g, r) => paintLamp(g, r));
      props.push({ type: 'lamp', x: l.x, y: l.y, spr: lampSpr });
    }
  }
  function freeTiles() {
    for (const set of [back, main]) if (set) for (const t of set.tiles) if (t.cv) { t.cv.width = t.cv.height = 0; t.cv = null; }
  }

  /* ======================================================================
     4. Simulation
     ====================================================================== */
  const state = {
    nour: { mucus: 0.62, quarry: 0.56, bakery: 0.6, fields: 0.6, orchard: 0.52, lab: 0.5, springs: 0.34 },
    springLvl: 0.4, stock: [], starch: [], food: [], parts: [], pops: [],
    millAng: 0, t: 0, divideT: 6, community: null, baseCounts: {}, baseTotal: 0,
  };
  let insts = [], idSeq = 0;
  const DECAY = 0.01 / 20; // 1% per 20 s (prototype speed)

  const castOK = () => !!(window.FloraCast && typeof window.FloraCast.draw === 'function');
  function speciesMeta(id) { return (window.FloraCast && window.FloraCast.SPECIES && window.FloraCast.SPECIES[id]) || null; }
  function nicheOf(id) {
    const m = speciesMeta(id), n = m && m.niche;
    return NB[n] ? n : DEFAULT_NICHE[id] || 'fields';
  }
  function homesOf(niche) { return L.homes.filter((h) => h.niche === niche); }
  function randomSpot(niche) {
    const n = NB[niche];
    let x = n.cx + rand(-NW * 0.44, NW * 0.44), y = rand(BAND_Y0 + 4, BAND_Y1);
    if (niche === 'springs') { // keep out of the deepest basin centre
      const b = L.basins[0];
      if (((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 < 0.7) y = b.y + b.ry + rand(8, 50);
    }
    return [x, y];
  }
  function workSpot(niche) { const w = pick(L.work[niche]); return [w[0] + rand(-8, 8), w[1] + rand(-3, 5)]; }

  function newInst(species, x, y) {
    const niche = nicheOf(species);
    const homes = homesOf(niche);
    const inst = {
      id: 'inst-' + ++idSeq, species, x, y, t: rand(0, 30), phase: rand(0, TAU),
      activity: 'idle', activityT: rand(0, 2), dirX: Math.random() < 0.5 ? -1 : 1,
      mood: 0.55, hungry: false, carrying: null, lift: 0, sqx: 1, sqy: 1, selected: false,
      _w: { niche, home: homes.length ? pick(homes) : null, steps: [], kind: 'idle', hop: rand(0, TAU), jump: 0, born: 0, selT: 0, boost: 0, lane: rand(-6, 6) },
    };
    return inst;
  }
  function normaliseCommunity(comp) {
    const out = {}; let total = 0;
    for (const id in comp) { const v = Math.max(0, Math.round(+comp[id] || 0)); if (v > 0 && (DEFAULT_NICHE[id] || speciesMeta(id))) { out[id] = v; total += v; } }
    const MAX = 90;
    if (total > MAX) { const f = MAX / total; total = 0; for (const id in out) { out[id] = Math.max(1, Math.round(out[id] * f)); total += out[id]; } }
    return { counts: out, total };
  }
  function populate() {
    const { counts, total } = normaliseCommunity(state.community || DEFAULT_COMMUNITY);
    state.baseCounts = counts; state.baseTotal = total;
    insts = []; idSeq = 0;
    for (const id in counts) for (let i = 0; i < counts[id]; i++) {
      const niche = nicheOf(id), [x, y] = randomSpot(niche), inst = newInst(id, x, y);
      // stagger: some start asleep or at work
      const r = Math.random();
      if (r < 0.12 && inst._w.home) { inst.x = inst._w.home.x + rand(-14, 14); inst.y = inst._w.home.y + rand(5, 10); inst._w.steps = [{ do: 'sleep', dur: rand(3, 12) }]; inst._w.kind = 'sleep'; }
      else if (r < 0.4) { const [wx, wy] = workSpot(niche); inst.x = wx; inst.y = wy; inst._w.steps = [{ do: 'work', dur: rand(2, 7) }]; inst._w.kind = 'work'; }
      insts.push(inst);
    }
    if (castOK() && built) castBuild();
  }

  // ---- task planning -------------------------------------------------------
  const go = (x, y, act, carry) => ({ to: [x, y], act: act || 'walk', carry: carry || null });
  const doo = (a, dur, extra) => Object.assign({ do: a, dur }, extra || {});
  const fn = (f) => ({ fn: f });
  const BAKERY_SUPPLY_X = () => L.crate.x;

  function neighbourFor(inst) {
    let best = null, bd = 85;
    for (const o of insts) {
      if (o === inst || o._w.kind !== 'wander' && o._w.kind !== 'idle') continue;
      if (o.activity !== 'idle') continue;
      const d = Math.hypot(o.x - inst.x, (o.y - inst.y) * 1.5);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function plan(inst) {
    const w = inst._w, n = w.niche, sp = inst.species, N = NB[n], nr = state.nour[n];
    const steps = [];
    const away = inst.x < N.x0 - 30 || inst.x > N.x1 + 30;
    // Hungry Bacteroides switch to foraging host mucus (real: they degrade mucin O-glycans when fibre is scarce)
    if (inst.hungry && BACTEROIDES.has(sp)) {
      const p = pick(L.pools), [gx, gy] = [p.x + rand(-p.rx, p.rx) * 0.8, p.y + p.ry + rand(2, 8)];
      w.kind = 'graze';
      w.steps = [go(gx, gy), doo('eat', rand(4, 7)), fn(() => { state.nour.mucus = Math.max(0, state.nour.mucus - 0.004); }), doo('idle', rand(1, 3))];
      return;
    }
    if (away) { const [x, y] = randomSpot(n); w.kind = 'return'; w.steps = [go(x, y), doo('idle', rand(0.5, 2))]; return; }

    const choices = [];
    const add = (wt, k, f) => { if (wt > 0) choices.push([wt, k, f]); };
    const hungry = inst.hungry;
    const busy = clamp(0.6 + nr, 0.6, 1.6);
    add(3, 'wander', () => { const [x, y] = randomSpot(n); return [go(x, y), doo('idle', rand(1.5, 4))]; });
    add(1.2, 'idle', () => [doo('idle', rand(2, 5))]);
    add((hungry ? 1.6 : 3.6) * busy * (n === 'springs' ? 0.5 + state.springLvl : 1), 'work', () => {
      const [x, y] = workSpot(n), list = [go(x, y), doo('work', rand(4, 8))];
      if (sp === 'r-bromii') list.push(fn(() => dropStarch(inst)));
      return list;
    });
    if (w.home) add(hungry ? 1.2 : 0.7, 'sleep', () => { const h = w.home; return [go(h.x + rand(-16, 16), h.y + rand(6, 10)), doo('sleep', rand(6, 12))]; });
    const nb = neighbourFor(inst);
    if (nb) add(1.3, 'social', () => {
      nb._w.steps = [doo('idle', 0.3), doo('wave', 1.8)]; nb._w.kind = 'social'; nb.dirX = inst.x > nb.x ? 1 : -1;
      const tx = nb.x + (inst.x < nb.x ? -26 : 26);
      return [go(tx, nb.y + rand(-3, 3)), fn(() => { inst.dirX = nb.x > inst.x ? 1 : -1; }), doo('wave', 1.8)];
    });
    if (!hungry && nr > 0.3) {
      // cross-feeding errands
      if (sp === 'b-adolescentis' && state.starch.some((b) => !b.claimed)) add(5, 'errand', () => {
        const b = state.starch.find((q) => !q.claimed); b.claimed = inst;
        const scfa = pick(SCFA_SUPPLIERS['b-adolescentis']);
        return [go(b.x, b.y + 2), fn(() => { removeStarch(b); inst.carrying = 'starch'; }), doo('eat', 1.4), fn(() => { inst.carrying = null; }),
          ...toBakery(inst, scfa)];
      });
      else if (SCFA_SUPPLIERS[sp] && sp !== 'b-adolescentis') {
        const far = Math.abs(N.cx - NB.bakery.cx) > NW * 1.6;
        add(sp === 'a-muciniphila' ? 0.4 : far ? 0.8 : 1.1, 'errand', () => {
          const [x, y] = workSpot(n), scfa = pick(SCFA_SUPPLIERS[sp]);
          return [go(x, y), doo('work', rand(2.5, 4)), ...toBakery(inst, scfa)];
        });
      }
      if (BUTYRATE_MAKERS.has(sp)) add((n === 'bakery' ? 1.5 : 0.7) * (state.stock.length ? 1.4 : 0.8), 'errand', () => {
        const house = pick(L.colonocytes), [x, y] = n === 'bakery' ? workSpot('bakery') : workSpot(n);
        return [go(x, y), doo('work', rand(3, 5)), fn(() => { takeStock(); inst.carrying = 'butyrate'; }),
          go(L.laneEntry.x, L.laneEntry.y + 6, 'carry', 'butyrate'), go(house.door.x + rand(-4, 4), house.door.y, 'carry', 'butyrate'),
          doo('idle', 0.7), fn(() => { deliverButyrate(house); inst.carrying = null; }), doo('celebrate', 1.0)];
      });
      if (n === 'lab') add(1.0, 'errand', () => {
        const [x, y] = workSpot('lab'), [x2, y2] = workSpot('lab');
        return [go(x, y), doo('work', rand(3, 5)), fn(() => { inst.carrying = 'flask'; }), go(x2, y2, 'carry', 'flask'), doo('idle', 0.8), fn(() => { inst.carrying = null; })];
      });
      if (n === 'springs') add(0.4 + state.springLvl * 1.6, 'errand', () => {
        const [x, y] = workSpot('springs');
        return [go(x, y), doo('work', rand(2, 4)), fn(() => { inst.carrying = 'sulfide'; }), go(L.vent.x - 10, L.vent.y + 22, 'carry', 'sulfide'), doo('idle', 0.6), fn(() => { inst.carrying = null; ventPuff(); })];
      });
      if (sp === 's-copri' || sp === 'b-ovatus') add(0.9, 'errand', () => {
        const [x, y] = workSpot('fields');
        return [go(x, y), doo('work', rand(3, 5)), fn(() => { inst.carrying = 'leaf'; }), go(L.basket.x + rand(-10, 10), L.basket.y + 6, 'carry', 'leaf'), doo('idle', 0.6), fn(() => { inst.carrying = null; })];
      });
      if (sp === 'a-muciniphila') add(0.9, 'errand', () => {
        const p = pick(L.pools), x = p.x + rand(-p.rx, p.rx) * 0.9, p2 = pick(L.pools);
        return [go(x, p.y + p.ry + 4), doo('work', rand(3, 5)), fn(() => { inst.carrying = 'mucus'; }), go(p2.x + rand(-20, 20), p2.y + p2.ry + 6, 'carry', 'mucus'), doo('idle', 0.6), fn(() => { inst.carrying = null; })];
      });
    }
    let tot = 0; for (const c of choices) tot += c[0];
    let r = Math.random() * tot, ch = choices[0];
    for (const c of choices) { r -= c[0]; if (r <= 0) { ch = c; break; } }
    w.kind = ch[1];
    w.steps = ch[2]();
    void steps;
  }
  function toBakery(inst, scfa) {
    const c = L.crate;
    return [fn(() => { inst.carrying = scfa; }), go(c.x + rand(-14, 14), c.y + rand(8, 14), 'carry', scfa), doo('idle', 0.6),
      fn(() => { inst.carrying = null; deliverScfa(scfa); }), doo('wave', 1.0)];
  }
  function dropStarch(inst) {
    if (state.starch.length >= 10) return;
    const k = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < k; i++) state.starch.push({ x: inst.x + rand(-16, 16), y: inst.y + rand(2, 12), t: 0, ph: rand(0, TAU), claimed: null });
  }
  function removeStarch(b) { const i = state.starch.indexOf(b); if (i >= 0) state.starch.splice(i, 1); }
  function deliverScfa(kind) {
    if (state.stock.length < 8) state.stock.push({ kind, t: 0 });
    state.nour.bakery = clamp(state.nour.bakery + 0.006, 0, 1);
    popAt(L.crate.x, L.crate.y - 16, kind === 'lactate' ? [255, 244, 214] : [255, 214, 232]);
  }
  function takeStock() { if (state.stock.length) state.stock.shift(); }
  function deliverButyrate(house) {
    house.glow = clamp(house.glow + 0.5, 0, 1.2);
    house.lanterns.push({ t: 0, life: 40 });
    if (house.lanterns.length > 3) house.lanterns.shift();
    popAt(house.win.x, house.win.y, [255, 196, 110]);
  }
  function ventPuff() { for (let i = 0; i < 4; i++) spawnPuff(L.vent.top.x + rand(-3, 3), L.vent.top.y, 'sulfur', rand(6, 10), rand(1.8, 3)); }
  function popAt(x, y, c) { state.pops.push({ x, y, c, t: 0 }); }

  // ---- per-frame instance update ---------------------------------------------
  function setAct(inst, a) { if (inst.activity !== a) { inst.activity = a; inst.activityT = 0; } }
  const SPEED = { walk: 30, carry: 27, run: 64 };
  function stepInst(inst, dt) {
    const w = inst._w;
    let guard = 4;
    while (guard-- > 0) {
      let st = w.steps[0];
      if (!st) { plan(inst); st = w.steps[0]; if (!st) return; }
      if (st.fn) { w.steps.shift(); st.fn(inst); continue; }
      if (st.wait != null) { setAct(inst, 'idle'); st.wait -= dt; if (st.wait <= 0) w.steps.shift(); return; }
      if (st.to) {
        if (!st._r) { // route long trips along the road
          st._r = true;
          const tx = st.to[0];
          if (Math.abs(tx - inst.x) > 150) {
            const lane = (tx > inst.x ? 8 : -8) + w.lane * 0.4;
            const seq = [{ to: [inst.x + Math.sign(tx - inst.x) * 20, roadY(inst.x) + lane], act: st.act, carry: st.carry, _r: true },
              { road: tx - Math.sign(tx - inst.x) * 20, lane, act: st.act, carry: st.carry },
              Object.assign({}, st, { _r: true })];
            w.steps.splice(0, 1, ...seq);
            continue;
          }
        }
        if (st.carry) inst.carrying = st.carry;
        const dx = st.to[0] - inst.x, dy = st.to[1] - inst.y, d = Math.hypot(dx, dy);
        const spd = SPEED[st.act] * (inst.hungry ? 0.6 : 1) * (0.78 + 0.22 * persp(inst.y));
        setAct(inst, st.carry ? 'carry' : st.act);
        if (d <= spd * dt || d < 1) { inst.x = st.to[0]; inst.y = st.to[1]; w.steps.shift(); return; }
        inst.x += (dx / d) * spd * dt; inst.y += (dy / d) * spd * dt;
        if (Math.abs(dx) > 2) inst.dirX = dx > 0 ? 1 : -1;
        return;
      }
      if (st.road != null) {
        const dx = st.road - inst.x, spd = SPEED[st.act] * (inst.hungry ? 0.6 : 1);
        if (st.carry) inst.carrying = st.carry;
        setAct(inst, st.carry ? 'carry' : st.act);
        inst.dirX = dx > 0 ? 1 : -1;
        if (Math.abs(dx) <= spd * dt) { inst.x = st.road; w.steps.shift(); return; }
        inst.x += Math.sign(dx) * spd * dt;
        inst.y = lerp(inst.y, roadY(inst.x) + st.lane, Math.min(1, dt * 4));
        return;
      }
      if (st.do) {
        if (st.item && st.item.gone && st.do === 'eat') { w.steps.shift(); continue; }
        setAct(inst, st.do);
        st.t = (st.t || 0) + dt;
        if (st.t >= st.dur) w.steps.shift();
        return;
      }
      w.steps.shift();
    }
  }
  function animate(inst, dt) {
    const w = inst._w, a = inst.activity, at = inst.activityT;
    let lift = 0, sqx = 1, sqy = 1;
    const U = 1; // lift in character units (px at scale 1 of the built unit) -> scaled below
    if (a === 'walk' || a === 'carry' || a === 'run') {
      w.hop += dt * (a === 'run' ? 15 : 10) * (inst.hungry ? 0.7 : 1);
      const hp = Math.abs(Math.sin(w.hop));
      lift = hp * (a === 'run' ? 0.14 : 0.08); sqy = 1 + (hp - 0.5) * 0.08; sqx = 1 - (hp - 0.5) * 0.06;
    } else if (a === 'celebrate') {
      const ph = (at * 1.7 + inst.phase * 0.1) % 1, j = Math.sin(ph * Math.PI);
      lift = j * 0.42; sqy = ph < 0.08 || ph > 0.92 ? 0.86 : 1 + j * 0.06; sqx = 2 - sqy;
    } else if (a === 'wave') {
      lift = Math.abs(Math.sin(at * 6)) * 0.04;
    } else if (a === 'eat') {
      sqy = 1 - Math.abs(Math.sin(at * 9)) * 0.06; sqx = 2 - sqy;
    } else if (a === 'sleep') {
      sqy = 0.96 + Math.sin(at * 1.6 + inst.phase) * 0.025; sqx = 1.03;
    } else if (a === 'work') {
      const k = Math.abs(Math.sin(at * 5 + inst.phase)); sqy = 1 - k * 0.05; sqx = 1 + k * 0.03;
    } else if (a === 'divide') {
      const t = clamp(at / 1.3, 0, 1); sqx = 1 + Math.sin(t * Math.PI) * 0.35 + t * 0.1; sqy = 1 - Math.sin(t * Math.PI) * 0.18;
    }
    if (w.jump > 0) { // tap jump
      w.jump = Math.max(0, w.jump - dt);
      const t = 1 - w.jump / 0.6; lift += Math.sin(t * Math.PI) * 0.55;
      if (t < 0.12 || t > 0.9) { sqy *= 0.9; sqx *= 1.08; }
    }
    if (w.born > 0) { w.born = Math.max(0, w.born - dt); const t = 1 - w.born / 0.6; const e = 1 + Math.sin(t * Math.PI) * 0.18; sqx *= e; sqy *= 2 - e; }
    const k = Math.min(1, dt * 16);
    inst.lift = lerp(inst.lift, lift * builtUnit * U, k);
    inst.sqx = lerp(inst.sqx, sqx, k); inst.sqy = lerp(inst.sqy, sqy, k);
  }
  function separate(dt) {
    const n = insts.length;
    for (let i = 0; i < n; i++) {
      const a = insts[i]; if (a._w.steps[0] && (a._w.steps[0].to || a._w.steps[0].road != null)) continue;
      for (let j = i + 1; j < n; j++) {
        const b = insts[j]; if (b._w.steps[0] && (b._w.steps[0].to || b._w.steps[0].road != null)) continue;
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.8;
        if (dx > 20 || dx < -20 || dy > 20 || dy < -20) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < 18) {
          const push = (18 - d) * dt * 2.2, ux = dx / d, uy = dy / d / 1.8;
          a.x -= ux * push; b.x += ux * push; a.y -= uy * push; b.y += uy * push;
        }
      }
    }
  }
  function nicheMood(nr) { return nr < 0.25 ? 0.12 + nr * 0.4 : clamp(0.5 + (nr - 0.45) * 1.1, 0.45, 0.95); }
  function simulate(dt) {
    state.t += dt;
    const N = state.nour;
    const fibre = (N.quarry + N.bakery + N.fields + N.orchard + N.lab) / 5;
    for (const k in N) {
      // the host keeps secreting mucin; it rebuilds faster when fibre (and butyrate) is plentiful
      if (k === 'mucus') N[k] += (0.62 - N[k]) * dt * (0.003 + 0.012 * fibre);
      else N[k] = Math.max(0, N[k] - DECAY * dt);
    }
    const target = clamp(0.2 + 0.85 * N.springs - 0.5 * Math.max(0, fibre - 0.42), 0.12, 1);
    state.springLvl += (target - state.springLvl) * Math.min(1, dt * 0.35);
    state.millAng += dt * (0.25 + N.fields * 0.9);
    // stock jars age; colonocyte glow decays
    for (const c of L.colonocytes) { c.glow = Math.max(0.15, c.glow - dt * 0.02); for (const l of c.lanterns) l.t += dt; c.lanterns = c.lanterns.filter((l) => l.t < l.life); }
    for (const b of state.starch) b.t += dt;
    for (const inst of insts) {
      const w = inst._w, nr = N[w.niche];
      inst.hungry = nr < 0.25;
      w.boost = Math.max(0, w.boost - dt * 0.04);
      const target = Math.min(1, nicheMood(nr) + w.boost);
      inst.mood += (target - inst.mood) * Math.min(1, dt * 0.8);
      inst.t += dt; inst.activityT += dt;
      stepInst(inst, dt);
      inst.y = clamp(inst.y, HZ + 18, BAND_Y1 + 10);
      inst.x = clamp(inst.x, MARGIN * 0.6, WW - MARGIN * 0.6);
      animate(inst, dt);
      if (w.selT > 0) { w.selT -= dt; if (w.selT <= 0) inst.selected = false; }
      if (castReady && typeof FloraCast.tick === 'function') { try { FloraCast.tick(inst, dt); } catch (e) { castError(e); } }
    }
    separate(dt);
    // binary fission in well-fed niches
    state.divideT -= dt;
    if (state.divideT <= 0) {
      state.divideT = rand(5, 9);
      const cap = Math.min(96, Math.max(state.baseTotal + 14, Math.round(state.baseTotal * 1.3)));
      if (insts.length < cap) {
        for (const n of NICHES) {
          const fed = n.id === 'springs' ? state.springLvl > 0.72 : state.nour[n.id] > 0.72;
          if (!fed || Math.random() > 0.45) continue;
          const pool = insts.filter((i) => i._w.niche === n.id && (i._w.kind === 'wander' || i._w.kind === 'idle') && !i.hungry && countOf(i.species) < (state.baseCounts[i.species] || 1) * 2 + 2);
          if (!pool.length) continue;
          const p = pick(pool);
          p._w.kind = 'divide';
          p._w.steps = [doo('divide', 1.3), fn(() => spawnClone(p)), doo('celebrate', 1.2)];
          break;
        }
      }
    }
    updateFood(dt);
    updateParticles(dt);
  }
  function countOf(sp) { let c = 0; for (const i of insts) if (i.species === sp) c++; return c; }
  function spawnClone(p) {
    const c = newInst(p.species, p.x + 12, p.y + 2);
    p.x -= 8; c.dirX = 1; p.dirX = -1;
    c._w.born = 0.6; p._w.born = 0.6; c.mood = p.mood; c._w.home = p._w.home;
    c._w.steps = [doo('celebrate', 1.2)]; c._w.kind = 'celebrate';
    insts.push(c);
    popAt(p.x + 4, p.y - UNIT * 0.6, [255, 240, 200]);
  }

  /* ======================================================================
     5. Meals
     ====================================================================== */
  function fmtG(g) { const r = Math.round(g * 10) / 10; return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)) + ' g'; }
  function joinNames(arr) { return arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]; }
  function applyMealNow(entry) {
    if (!entry) return;
    const foods = Array.isArray(entry.foods) ? entry.foods : [];
    const boost = {}; const types = {}; let total = 0; let fat = false, sugar = false;
    const add = (n, v, t) => { boost[n] = (boost[n] || 0) + v; (types[n] = types[n] || {})[t] = (types[n][t] || 0) + v; };
    for (const f of foods) {
      const g = Math.max(0, +f.fibreG || 0); total += g;
      const ft = (f.fibreTypes || []).filter((t) => FIBRE_NICHES[t]);
      if (ft.length && g > 0) {
        const per = g / ft.length;
        for (const t of ft) FIBRE_NICHES[t].forEach((n, i) => add(n, per * (i ? 0.6 : 1), t));
      } else if (g > 0) add('fields', g, 'cellulose');
      for (const fl of f.flags || []) {
        if (fl === 'high-fat') { add('springs', 2.6, 'high-fat'); fat = true; }
        if (fl === 'sugar') { add('springs', 1.3, 'sugar'); sugar = true; }
        if (fl === 'fermented') { add('orchard', 0.8, 'fermented'); add('fields', 0.4, 'fermented'); }
      }
    }
    if (!foods.length && +entry.totalFibreG > 0) { total = +entry.totalFibreG; add('fields', total, 'cellulose'); }
    // cross-feeding: fermenting any fibre makes acetate/lactate that also reaches the Bakery
    const fibreBoost = Object.keys(boost).filter((k) => k !== 'springs').reduce((a, k) => a + boost[k], 0);
    if (fibreBoost > 0) add('bakery', fibreBoost * 0.2, Object.keys(types.bakery || {})[0] || 'inulin-fos');
    // high fibre calms the springs
    if (total >= 5 && !fat) state.nour.springs = Math.max(0.05, state.nour.springs - total * 0.012);
    const ranked = Object.keys(boost).sort((a, b) => boost[b] - boost[a]);
    for (const n of ranked) {
      state.nour[n] = clamp(state.nour[n] + Math.min(0.5, boost[n] * 0.065), 0, 1);
      // food items: colour coded by the fibre type that dominates
      const tlist = Object.keys(types[n]).sort((a, b) => types[n][b] - types[n][a]);
      const count = clamp(Math.round(boost[n] * 1.5), 2, 8);
      const items = [];
      for (let i = 0; i < count; i++) {
        const t = tlist[i % tlist.length];
        let [x, y] = n === 'springs' ? [L.basins[0].x + rand(-80, 80), L.basins[0].y + L.basins[0].ry + rand(14, 60)] : randomSpot(n);
        y = clamp(y, BAND_Y0 + 6, BAND_Y1 - 30);
        const it = { x, y, z: -rand(240, 360), vz: 0, type: t, col: FOOD_COL[t] || [255, 230, 180], niche: n, bites: 2, gone: false, landed: false, t: -i * 0.12, scale: 1, eaters: 0 };
        state.food.push(it); items.push(it);
      }
      // residents run to eat, then celebrate
      let resid = insts.filter((i) => i._w.niche === n);
      if (n === 'springs' && sugar && !fat) resid = resid.filter((i) => i.species === 'e-coli').concat(resid.filter((i) => i.species !== 'e-coli'));
      if (n === 'bakery' && !types.bakery['inulin-fos'] && !types.bakery.pectin) { // pure cross-feeding: bakers celebrate deliveries
        for (const r of resid) if (!r.carrying) { r._w.kind = 'meal'; r._w.steps = [{ wait: rand(0.4, 1.4) }, doo('celebrate', rand(1.6, 2.4))]; r._w.boost = 0.3; }
        items.forEach((it) => { it.forBakers = true; });
      }
      resid.sort((a, b) => Math.abs(a.x - items[0].x) - Math.abs(b.x - items[0].x));
      let k = 0;
      for (const r of resid) {
        if (r.carrying) continue;
        const it = items[k % items.length];
        r._w.boost = 0.45; r.hungry = false;
        if (k < items.length * 2) {
          const off = (it.eaters++ % 2 ? 1 : -1) * rand(10, 14);
          r._w.kind = 'meal';
          r._w.steps = [{ wait: rand(0.5, 1.1) }, go(it.x + off, it.y + rand(1, 3), 'run'), fn(() => { r.dirX = it.x > r.x ? 1 : -1; }),
            doo('eat', 1.8, { item: it }), fn(() => biteFood(it)), doo('celebrate', rand(1.8, 2.6))];
        } else {
          r._w.kind = 'meal'; r._w.steps = [{ wait: rand(0.8, 2.2) }, doo('celebrate', rand(1.5, 2.2))];
        }
        k++;
      }
    }
    if (ranked.length) {
      const top = ranked[0];
      focusNiche(top);
    }
    // toast
    const names = foods.map((f) => f.name).filter(Boolean);
    const head = (names.length ? (names.length > 2 ? names.slice(0, 2).join(', ') + ' +' + (names.length - 2) : names.join(' & ')) : 'Your meal') + ' · ' + fmtG(total) + ' fibre';
    const fibreNiches = ranked.filter((n) => n !== 'springs');
    let body;
    if (fibreNiches.length) {
      const topN = fibreNiches.slice(0, fibreNiches.length > 2 && boost[fibreNiches[2]] > boost[fibreNiches[0]] * 0.6 ? 3 : 2).map((n) => NB[n].label);
      body = joinNames(topN) + (topN.length > 1 ? ' are feasting' : ' is feasting');
      if (fat || sugar) body += '. Sulfur Springs stirs';
    } else if (fat || sugar) body = fat ? 'Sulfur Springs is bubbling up' : 'E. coli is snacking at Sulfur Springs';
    else body = 'A light bite. The fibre fields are waiting for more';
    showToast(head, body, NB[ranked[0] || 'fields'].accent);
  }
  function biteFood(it) {
    it.bites -= 1;
    if (it.bites <= 0 && !it.gone) { it.gone = true; popAt(it.x, it.y - 6, it.col); }
  }
  function updateFood(dt) {
    for (const it of state.food) {
      it.t += dt; if (it.t < 0) continue;
      if (!it.landed) {
        it.vz += 900 * dt; it.z += it.vz * dt;
        if (it.z >= 0) { it.z = 0; if (it.vz > 140) it.vz = -it.vz * 0.32; else { it.vz = 0; it.landed = true; } }
      }
      if (it.forBakers && it.landed && !it.gone && it.t > 4) { it.gone = true; popAt(it.x, it.y - 6, it.col); }
      if (it.landed && !it.gone && it.t > 20) { it.gone = true; popAt(it.x, it.y - 6, it.col); }
      if (it.gone) it.scale = Math.max(0, it.scale - dt * 3);
    }
    state.food = state.food.filter((it) => !(it.gone && it.scale <= 0));
  }

  // ---- particles (smoke, steam, bubbles, spores) ------------------------------
  function spawnPuff(x, y, spr, size, life, vx) {
    if (state.parts.length > 160) return;
    state.parts.push({ x, y, spr, size, life, t: 0, vx: vx == null ? rand(-3, 6) : vx, vy: -rand(10, 18) });
  }
  let spores = [];
  function makeSpores() {
    spores = [];
    const n = RM ? 30 : 110;
    for (let i = 0; i < n; i++) spores.push({ x: rand(0, WW), y: rand(60, BAND_Y1), r: rand(0.8, 2.4), vx: rand(-5, 5), vy: rand(-10, -3), ph: rand(0, TAU) });
  }
  const emit = { chimney: 0, lab: 0, steam: 0, bub: 0 };
  function updateParticles(dt) {
    // emitters only spawn while near the camera
    const vx0 = viewX0() - 120, vx1 = viewX1() + 120, near = (x) => x > vx0 && x < vx1;
    if (near(L.chimney.x) && (emit.chimney -= dt) <= 0) { emit.chimney = 0.55; spawnPuff(L.chimney.x + rand(-2, 2), L.chimney.y, 'cream', rand(8, 12), rand(3, 4.5)); }
    if (near(L.labChimney.x) && (emit.lab -= dt) <= 0) { emit.lab = 0.7; spawnPuff(L.labChimney.x, L.labChimney.y, Math.random() < 0.5 ? 'lilac' : 'mint', rand(7, 11), rand(2.6, 4)); }
    if (near(NB.springs.cx) && (emit.steam -= dt) <= 0) {
      emit.steam = lerp(0.9, 0.16, state.springLvl);
      const b = pick(L.basins), lv = 0.35 + 0.65 * state.springLvl;
      spawnPuff(b.x + rand(-b.rx, b.rx) * 0.6 * lv, b.y - 2, 'sulfur', rand(10, 18) * lv, rand(2.5, 4.5), rand(-2, 4));
      if (Math.random() < state.springLvl) spawnPuff(L.vent.top.x, L.vent.top.y, 'sulfur', rand(6, 10), rand(1.5, 2.6));
    }
    for (const p of state.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 0.3; }
    state.parts = state.parts.filter((p) => p.t < p.life);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < 0.9);
    if (!RM) for (const sp of spores) {
      sp.x += (sp.vx + Math.sin(state.t * 0.7 + sp.ph) * 5) * dt; sp.y += sp.vy * dt;
      if (sp.y < 40) { sp.y = BAND_Y1; sp.x = rand(0, WW); }
    }
  }

  /* ======================================================================
     6. Camera + input
     ====================================================================== */
  const cam = { cx: NB.bakery.cx, cy: REF_H / 2, z: 1, vx: 0, vy: 0, fly: null };
  function zoomDefault() { return clamp(W / (NW * 3 * s), 1, 1.45); } // wide screens start a little closer
  function zoomMin() { return clamp(Math.max(0.8, W / (WW * s), H / ((YMAX - YMIN) * s)), 0.5, 1); }
  const ZMAX = 1.6;
  const SS = () => s * cam.z;
  function clampCam() {
    cam.z = clamp(cam.z, zoomMin(), ZMAX);
    const S = SS(), hw = W / (2 * S), hh = H / (2 * S);
    cam.cx = WW <= hw * 2 ? WW / 2 : clamp(cam.cx, hw, WW - hw);
    const y0 = YMIN + hh, y1 = YMAX - hh;
    cam.cy = y0 > y1 ? (YMIN + YMAX) / 2 : clamp(cam.cy, y0, y1);
  }
  const viewX0 = () => cam.cx - W / (2 * SS());
  const viewX1 = () => cam.cx + W / (2 * SS());
  function defaultCy(z) { return REF_H / 2 + (z - 1) * 120; } // zooming in leans towards the ground
  function flyTo(x, z) {
    const tz = z == null ? cam.z : z;
    cam.vx = cam.vy = 0;
    const dist = Math.abs(x - cam.cx) * SS() / Math.max(1, W);
    cam.fly = { x0: cam.cx, y0: cam.cy, z0: cam.z, x1: x, y1: defaultCy(tz), z1: tz, t: 0, dur: RM ? 0.01 : clamp(0.65 + dist * 0.28, 0.65, 1.7) };
  }
  function updateCamera(dt) {
    if (cam.fly) {
      const f = cam.fly; f.t += dt;
      const e = easeInOut(clamp(f.t / f.dur, 0, 1));
      cam.z = lerp(f.z0, f.z1, e); cam.cx = lerp(f.x0, f.x1, e); cam.cy = lerp(f.y0, f.y1, e);
      if (f.t >= f.dur) cam.fly = null;
    } else if (!drag.active && (Math.abs(cam.vx) > 0.5 || Math.abs(cam.vy) > 0.5)) {
      cam.cx += cam.vx * dt; cam.cy += cam.vy * dt;
      const k = Math.exp(-dt * 4.2); cam.vx *= k; cam.vy *= k;
      const before = cam.cx; clampCam(); if (cam.cx !== before) cam.vx = 0;
    }
    clampCam();
  }

  const pointers = new Map();
  const drag = { active: false, moved: false, x0: 0, y0: 0, t0: 0, cx0: 0, cy0: 0, lx: 0, ly: 0, lt: 0, vx: 0, vy: 0, pinch: null };
  function localXY(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function onDown(e) {
    if (e.button != null && e.button > 0) return;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    const [x, y] = localXY(e);
    pointers.set(e.pointerId, [x, y]);
    cam.fly = null; cam.vx = cam.vy = 0;
    if (pointers.size === 1) {
      Object.assign(drag, { active: true, moved: false, x0: x, y0: y, t0: performance.now(), cx0: cam.cx, cy0: cam.cy, lx: x, ly: y, lt: performance.now(), vx: 0, vy: 0, pinch: null });
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      drag.moved = true;
      drag.pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: cam.z, wx: screenToWorldX(mx), wy: screenToWorldY(my) };
    }
    dismissHint();
  }
  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const [x, y] = localXY(e);
    pointers.set(e.pointerId, [x, y]);
    if (drag.pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      cam.z = clamp(drag.pinch.z0 * d / drag.pinch.d0, zoomMin(), ZMAX);
      const S = SS();
      cam.cx = drag.pinch.wx - (mx - W / 2) / S; cam.cy = drag.pinch.wy - (my - H / 2) / S;
      clampCam(); zoomChanged();
      return;
    }
    if (!drag.active) return;
    const dx = x - drag.x0, dy = y - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) {
      const S = SS();
      cam.cx = drag.cx0 - dx / S; cam.cy = drag.cy0 - dy / S; clampCam();
      const now = performance.now(), dtm = Math.max(1, now - drag.lt) / 1000;
      const ivx = -(x - drag.lx) / S / dtm, ivy = -(y - drag.ly) / S / dtm;
      drag.vx = lerp(drag.vx, ivx, 0.35); drag.vy = lerp(drag.vy, ivy, 0.35);
      drag.lx = x; drag.ly = y; drag.lt = now;
    }
  }
  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (drag.pinch) { if (pointers.size < 2) { drag.pinch = null; drag.active = false; } return; }
    if (!drag.active) return;
    drag.active = false;
    const [x, y] = localXY(e);
    if (!drag.moved && performance.now() - drag.t0 < 600 && e.type !== 'pointercancel') { tapAt(x, y); return; }
    if (performance.now() - drag.lt < 90) { cam.vx = clamp(drag.vx, -2400, 2400); cam.vy = clamp(drag.vy, -1200, 1200); }
  }
  function onWheel(e) {
    e.preventDefault();
    cam.fly = null;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
    if (e.ctrlKey) {
      const [x, y] = localXY(e), wx = screenToWorldX(x), wy = screenToWorldY(y);
      cam.z = clamp(cam.z * Math.exp(-e.deltaY * unit * 0.01), zoomMin(), ZMAX);
      const S = SS(); cam.cx = wx - (x - W / 2) / S; cam.cy = wy - (y - H / 2) / S;
      clampCam(); zoomChanged(); return;
    }
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    cam.vx = 0; cam.cx += (d * unit) / SS(); clampCam();
    dismissHint();
  }
  function onKey(e) {
    if (!running) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable) || e.metaKey || e.altKey || e.ctrlKey) return;
    const step = (W * 0.55) / SS();
    if (e.key === 'ArrowRight') { flyTo(clampX(cam.cx + step)); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { flyTo(clampX(cam.cx - step)); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { cam.z = clamp(cam.z * 1.15, zoomMin(), ZMAX); clampCam(); zoomChanged(); }
    else if (e.key === '-' || e.key === '_') { cam.z = clamp(cam.z / 1.15, zoomMin(), ZMAX); clampCam(); zoomChanged(); }
    else return;
    dismissHint();
  }
  function clampX(x) { const hw = W / (2 * SS()); return clamp(x, hw, WW - hw); }
  const screenToWorldX = (x) => cam.cx + (x - W / 2) / SS();
  const screenToWorldY = (y) => cam.cy + (y - H / 2) / SS();
  let zoomTimer = 0;
  function zoomChanged() { clearTimeout(zoomTimer); zoomTimer = setTimeout(() => { if (Math.abs(cam.z / builtZ - 1) > 0.18) castBuild(); }, 350); }

  function charScale(inst) { return persp(inst.y) * cam.z / builtZ; }
  function tapAt(x, y) {
    if (!castReady) return;
    const S = SS(), ox = W / 2 - cam.cx * S, oy = H / 2 - cam.cy * S;
    let hit = null;
    const vis = insts.slice().sort((a, b) => b.y - a.y);
    for (const inst of vis) {
      const sx = inst.x * S + ox, sy = inst.y * S + oy;
      if (sx < -80 || sx > W + 80) continue;
      const sc = charScale(inst);
      let b; try { b = FloraCast.bounds(inst, sc); } catch (e) { b = null; }
      if (!b) b = { w: builtUnit * sc * 0.8, h: builtUnit * sc };
      const lift = (inst.lift || 0) * sc, pad = 6;
      if (x >= sx - b.w / 2 - pad && x <= sx + b.w / 2 + pad && y >= sy - lift - b.h - pad && y <= sy + pad) { hit = inst; break; }
    }
    if (!hit) return; // tapping empty space does nothing
    for (const i of insts) if (i !== hit) i.selected = false;
    hit.selected = true; hit._w.selT = 8;
    hit._w.jump = 0.6;
    hit.dirX = hit.x < cam.cx ? 1 : -1;
    if (hit.carrying) hit._w.steps.unshift(doo('wave', 1.6));
    else { hit._w.kind = 'tapped'; hit._w.steps = [doo('wave', 1.8), doo('idle', 1.2)]; }
    try { if (window.FloraApp && typeof FloraApp.openProfile === 'function') FloraApp.openProfile(hit.species, hit); } catch (e) { console.warn('[FloraWorld] openProfile failed', e); }
  }

  /* ======================================================================
     7. DOM UI
     ====================================================================== */
  let root = null, wrap = null, canvas = null, ctx = null, labelEls = [], chipEls = [], toastEl = null, hintEl = null, talkEl = null, chipRow = null;
  let activeChip = -1, hintGone = false, toastTimer = 0;
  const CSS = `
.fw{position:absolute;inset:0;overflow:hidden;background:#2a1530;font-family:Figtree,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink,#24302A);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.fw canvas.fw-cv{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none}
.fw canvas.fw-cv:active{cursor:grabbing}
.fw-vig{position:absolute;inset:0;pointer-events:none;background:
  radial-gradient(120% 90% at 50% 46%,rgba(20,8,24,0) 52%,rgba(20,8,24,.42) 100%),
  linear-gradient(180deg,rgba(20,10,30,.38) 0,rgba(20,10,30,0) 120px),
  linear-gradient(0deg,rgba(18,10,20,.42) 0,rgba(18,10,20,0) 170px)}
.fw-labels{position:absolute;inset:0;pointer-events:none}
.fw-label{position:absolute;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 14px 8px;border-radius:16px;
  background:rgba(251,248,243,.86);box-shadow:0 6px 22px rgba(36,20,30,.22),inset 0 0 0 1px rgba(255,255,255,.7);opacity:0;transition:opacity .35s ease;white-space:nowrap;will-change:transform}
.fw-label.on{opacity:1}
.fw-label::after{content:"";position:absolute;bottom:-5px;left:50%;width:10px;height:10px;margin-left:-5px;background:inherit;transform:rotate(45deg);border-radius:2px;box-shadow:3px 3px 6px rgba(36,20,30,.08)}
.fw-label b{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;font-size:19px;line-height:1;color:var(--ink,#24302A);letter-spacing:.005em}
.fw-label span{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#6B7A70)}
.fw-label i,.fw-chip i{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dot,#5A7A66);box-shadow:0 0 0 2px rgba(255,255,255,.7)}
.fw-bottom{position:absolute;left:0;right:0;bottom:0;padding:0 max(16px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 14px) max(16px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;align-items:stretch;gap:10px;pointer-events:none}
.fw-talk-row{display:flex;justify-content:flex-end}
.fw-talk{pointer-events:auto;display:inline-flex;align-items:center;gap:9px;height:46px;padding:0 20px 0 7px;border:0;border-radius:999px;cursor:pointer;
  background:var(--sage-deep,#3D5A48);color:var(--paper,#FBF8F3);font:600 15px/1 Figtree,system-ui,sans-serif;letter-spacing:.01em;box-shadow:0 10px 26px rgba(20,30,24,.35),inset 0 1px 0 rgba(255,255,255,.18);transition:transform .15s ease,background .2s}
.fw-talk:hover{background:#34503f}.fw-talk:active{transform:scale(.97)}
.fw-talk:focus-visible,.fw-chip:focus-visible{outline:2px solid var(--paper,#FBF8F3);outline-offset:2px}
.fw-talk canvas{width:34px;height:34px;border-radius:50%;background:var(--sage-soft,#DCE5DD)}
.fw-chips{pointer-events:auto;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:6px;border-radius:999px;margin:0 auto;max-width:100%;
  background:rgba(251,248,243,.72);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);box-shadow:0 10px 30px rgba(30,14,26,.28),inset 0 0 0 1px rgba(255,255,255,.65);scroll-behavior:smooth}
.fw-chips::-webkit-scrollbar{display:none}
.fw-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border:0;border-radius:999px;background:transparent;color:var(--ink,#24302A);
  font:600 13px/1 Figtree,system-ui,sans-serif;cursor:pointer;white-space:nowrap;transition:background .25s,color .25s}
.fw-chip:hover{background:rgba(36,48,42,.06)}
.fw-chip[aria-pressed="true"]{background:var(--ink,#24302A);color:var(--paper,#FBF8F3)}
.fw-chip[aria-pressed="true"] i{box-shadow:0 0 0 2px rgba(255,255,255,.25)}
.fw-toast{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translate(-50%,-14px);opacity:0;pointer-events:none;
  width:min(440px,calc(100% - 32px));box-sizing:border-box;padding:13px 18px 14px;border-radius:20px;background:rgba(251,248,243,.8);-webkit-backdrop-filter:blur(16px) saturate(1.4);backdrop-filter:blur(16px) saturate(1.4);
  box-shadow:0 14px 40px rgba(30,14,26,.3),inset 0 0 0 1px rgba(255,255,255,.7);transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.2,1)}
.fw-toast.on{opacity:1;transform:translate(-50%,0)}
.fw-toast small{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#6B7A70)}
.fw-toast small i{width:7px;height:7px;border-radius:50%;background:var(--dot,#F2A94A)}
.fw-toast p{margin:5px 0 0;font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:22px;line-height:1.15;color:var(--ink,#24302A)}
.fw-hint{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 18px);transform:translateX(-50%);padding:9px 16px;border-radius:999px;background:rgba(251,248,243,.78);
  -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font-size:13px;font-weight:600;color:var(--ink,#24302A);box-shadow:0 8px 24px rgba(30,14,26,.22);pointer-events:none;transition:opacity .6s;white-space:nowrap}
.fw-hint.gone{opacity:0}
@media (min-width:720px){.fw-bottom{flex-direction:row;align-items:center;justify-content:center;gap:12px}.fw-talk-row{order:2;flex:0 0 auto}.fw-chips{order:1;margin:0;flex:0 1 auto;min-width:0}}
@media (prefers-reduced-motion:reduce){.fw-label,.fw-toast,.fw-hint{transition:none}.fw-chips{scroll-behavior:auto}}
`;
  function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function buildDOM() {
    if (!document.getElementById('fw-style')) { const st = el('style'); st.id = 'fw-style'; st.textContent = CSS; document.head.appendChild(st); }
    wrap = el('div', 'fw', root);
    canvas = el('canvas', 'fw-cv', wrap);
    canvas.setAttribute('tabindex', '0'); canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Your gut world. Drag to explore, tap a resident to meet them.');
    ctx = canvas.getContext('2d');
    el('div', 'fw-vig', wrap);
    const labels = el('div', 'fw-labels', wrap);
    labelEls = NICHES.map((n) => {
      const e = el('div', 'fw-label', labels);
      e.innerHTML = `<b></b><span><i></i><em style="font-style:normal"></em></span>`;
      e.querySelector('b').textContent = n.label;
      e.style.setProperty('--dot', n.accent);
      return { e, st: e.querySelector('em'), dot: e.querySelector('i'), x: -1, y: -1, on: false, txt: '' };
    });
    const bottom = el('div', 'fw-bottom', wrap);
    const talkRow = el('div', 'fw-talk-row', bottom);
    talkEl = el('button', 'fw-talk', talkRow);
    talkEl.type = 'button';
    const fc = el('canvas', '', talkEl); fc.width = fc.height = 68; fc.setAttribute('aria-hidden', 'true');
    talkEl.appendChild(document.createTextNode('Talk to Flora'));
    talkEl.addEventListener('click', () => { try { if (window.FloraApp && typeof FloraApp.show === 'function') FloraApp.show('chat'); } catch (e) { console.warn('[FloraWorld] show(chat) failed', e); } });
    talkEl._fc = fc;
    chipRow = el('div', 'fw-chips', bottom);
    chipRow.setAttribute('role', 'toolbar'); chipRow.setAttribute('aria-label', 'Neighbourhoods');
    chipEls = NICHES.map((n) => {
      const b = el('button', 'fw-chip', chipRow); b.type = 'button';
      b.innerHTML = '<i></i>'; b.appendChild(document.createTextNode(n.label));
      b.style.setProperty('--dot', n.accent);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { focusNiche(n.id); dismissHint(); });
      return b;
    });
    toastEl = el('div', 'fw-toast', wrap); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    toastEl.innerHTML = '<small><i></i><span></span></small><p></p>';
    hintEl = el('div', 'fw-hint', wrap); hintEl.textContent = 'Drag to explore · tap a resident to say hi';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('lostpointercapture', (e) => { if (pointers.has(e.pointerId)) onUp(e); });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
  }
  const floraArt = new Image();
  floraArt.onload = () => drawTalkFace();
  floraArt.src = 'art/flora.png';
  function drawTalkFace() {
    const fc = talkEl && talkEl._fc; if (!fc) return;
    const g = fc.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 68, 68);
    if (floraArt.complete && floraArt.naturalWidth) {
      // Crop Flora's face and shoulders from the approved artwork
      const k = floraArt.naturalWidth / 1024;
      g.save(); g.beginPath(); g.arc(34, 34, 34, 0, TAU); g.clip();
      g.drawImage(floraArt, 262 * k, 150 * k, 500 * k, 500 * k, 0, 0, 68, 68);
      g.restore(); return;
    }
    if (window.FloraCast && typeof FloraCast.drawFlora === 'function') {
      try { g.save(); FloraCast.drawFlora(g, 34, 36, 54, { t: state.t, talking: false, mood: 'happy', lookX: 0, lookY: 0 }); g.restore(); return; } catch (e) { /* fall through */ }
    }
    g.fillStyle = '#7fa58a'; g.beginPath(); g.arc(34, 34, 20, 0, TAU); g.fill();
  }
  function dismissHint() { if (!hintGone && hintEl) { hintGone = true; hintEl.classList.add('gone'); } }
  function showToast(head, body, dot) {
    if (!toastEl) { pendingToast = [head, body, dot]; return; }
    toastEl.querySelector('small span').textContent = head;
    toastEl.querySelector('p').textContent = body;
    toastEl.style.setProperty('--dot', dot || '#F2A94A');
    toastEl.classList.add('on'); dismissHint();
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 5600);
  }
  let pendingToast = null;
  function statusOf(n) {
    const v = state.nour[n.id];
    if (n.id === 'springs') { const l = state.springLvl; return l < 0.34 ? ['Quiet', '#9db08a'] : l < 0.66 ? ['Simmering', '#cfc36a'] : ['Bubbling up', '#d9a441']; }
    if (n.id === 'mucus') return v < 0.25 ? ['Thinning', '#e0896f'] : v > 0.5 ? ['Glistening', '#e9a6c9'] : ['Settling', '#d8b5c8'];
    return v >= 0.72 ? ['Feasting', '#7fb36a'] : v >= 0.45 ? ['Content', '#9cbf8a'] : v >= 0.25 ? ['Peckish', '#e2b25a'] : ['Hungry', '#e0896f'];
  }
  let domT = 0;
  function updateDOM(dt) {
    const S = SS(), ox = W / 2 - cam.cx * S, oy = H / 2 - cam.cy * S;
    domT -= dt;
    const doStatus = domT <= 0; if (doStatus) domT = 0.5;
    NICHES.forEach((n, i) => {
      const L2 = labelEls[i];
      const x = Math.round(n.cx * S + ox), y = Math.round(n.labelY * S + oy - 12);
      const on = x > 70 && x < W - 70 && y > 90 && !drag.pinch;
      if (on !== L2.on) { L2.on = on; L2.e.classList.toggle('on', on); }
      if (on && (x !== L2.x || y !== L2.y)) { L2.x = x; L2.y = y; L2.e.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-100%)`; }
      if (doStatus) {
        const [txt, col] = statusOf(n);
        if (txt !== L2.txt) { L2.txt = txt; L2.st.textContent = txt; L2.dot.style.background = col; chipEls[i].querySelector('i').style.background = col; }
      }
    });
    const cur = nicheAtX(cam.fly ? cam.fly.x1 : cam.cx).i;
    if (cur !== activeChip) {
      if (activeChip >= 0) chipEls[activeChip].setAttribute('aria-pressed', 'false');
      activeChip = cur; const c = chipEls[cur]; c.setAttribute('aria-pressed', 'true');
      const r = chipRow, left = c.offsetLeft - (r.clientWidth - c.offsetWidth) / 2;
      if (r.scrollWidth > r.clientWidth) r.scrollTo({ left, behavior: RM ? 'auto' : 'smooth' });
    }
  }

  /* ======================================================================
     8. Rendering + loop
     ====================================================================== */
  let built = false, castReady = false, builtUnit = UNIT, builtZ = 1, castWarned = false, castErrLogged = false;
  function castBuild() {
    if (!castOK()) return;
    builtZ = cam.z; builtUnit = UNIT * s * builtZ;
    try { if (typeof FloraCast.build === 'function') FloraCast.build(builtUnit, DPR); castReady = true; } catch (e) { castError(e); }
    drawTalkFace();
  }
  function castError(e) { if (!castErrLogged) { castErrLogged = true; console.warn('[FloraWorld] FloraCast error', e); } }
  function checkCast() {
    if (castReady) return;
    if (castOK()) {
      // re-resolve niches now that SPECIES is known
      for (const i of insts) { const n = nicheOf(i.species); if (n !== i._w.niche) { i._w.niche = n; const hs = homesOf(n); i._w.home = hs.length ? pick(hs) : null; } }
      castBuild();
    } else if (!castWarned) { castWarned = true; console.warn('[FloraWorld] window.FloraCast is missing: the world renders without residents until it loads.'); }
  }

  function resize() {
    if (!root) return;
    const r = root.getBoundingClientRect();
    const nW = Math.max(1, Math.round(r.width)), nH = Math.max(1, Math.round(r.height));
    const nDPR = Math.min(2, window.devicePixelRatio || 1);
    if (built && nW === W && nH === H && nDPR === DPR) return;
    const prevS = s, wasDefault = !built || Math.abs(cam.z - zoomDefault()) < 0.01;
    W = nW; H = nH; DPR = nDPR;
    s = Math.max(H / REF_H, W / WW);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    freeTiles();
    back = makeTiles('back'); main = makeTiles('main');
    if (!SCENE || prevS !== s) buildScene(...backRange());
    buildPropSprites();
    built = true;
    if (wasDefault) { cam.z = zoomDefault(); cam.cy = defaultCy(cam.z); }
    clampCam();
    if (castOK()) castBuild();
  }
  let resizeTimer = 0;
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 160); }

  function drawTiles(set, offX, S, oy) {
    for (const t of set.tiles) {
      const x = t.x0 * S + offX, w = t.w * S;
      if (x + w < -2 || x > W + 2) continue;
      if (!t.cv) renderTile(set, t);
      ctx.drawImage(t.cv, x, set.y0 * S + oy, t.cv.width / set.k * S, t.cv.height / set.k * S);
    }
  }
  let lazyIdx = 0;
  function lazyBuild() { // pre-render one off-screen tile per frame so panning never stalls
    const all = main.tiles.concat(back.tiles);
    for (let n = 0; n < all.length; n++) {
      const i = (lazyIdx + n) % all.length, t = all[i];
      if (!t.cv) { renderTile(main.tiles.includes(t) ? main : back, t); lazyIdx = i + 1; return; }
    }
  }
  const drawList = [];
  function render() {
    const S = SS();
    let ox = W / 2 - cam.cx * S, oy = H / 2 - cam.cy * S;
    if (Math.abs(cam.z - 1) < 1e-3) { ox = Math.round(ox * DPR) / DPR; oy = Math.round(oy * DPR) / DPR; }
    const T = state.t;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#2a1530'; ctx.fillRect(0, 0, W, H);
    drawTiles(back, W / 2 - cam.cx * P * S, S, oy);
    drawTiles(main, ox, S, oy);
    const x0 = viewX0() - 60, x1 = viewX1() + 60, vis = (x, m) => x > x0 - (m || 0) && x < x1 + (m || 0);
    // ---- world-space live layer (under characters) ----
    ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * ox, DPR * oy);
    if (vis(NB.mucus.cx, 200)) drawMucusFx(T);
    if (vis(NB.quarry.cx, 200)) drawQuarryFx(T);
    if (vis(NB.bakery.cx, 200)) drawBakeryFx(T);
    if (vis(L.windmill.x, 120)) drawWindmill();
    if (vis(NB.lab.cx, 200)) drawLabFx(T);
    if (vis(NB.springs.cx, 220)) drawSpringsFx(T);
    for (const it of state.food) if (it.landed && vis(it.x)) drawFood(it, T);
    // ---- y-sorted characters + props ----
    drawList.length = 0;
    for (const p of props) if (vis(p.x, 40)) drawList.push(p);
    if (castReady) for (const i of insts) if (vis(i.x, 30)) drawList.push(i);
    drawList.sort((a, b) => a.y - b.y);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const d of drawList) {
      const sx = d.x * S + ox, sy = d.y * S + oy;
      if (d.spr) { ctx.drawImage(d.spr.cv, sx - d.spr.ax * S, sy - d.spr.ay * S, d.spr.w * S, d.spr.h * S); continue; }
      ctx.save();
      try { FloraCast.draw(ctx, d, sx, sy, charScale(d)); } catch (e) { castError(e); }
      ctx.restore();
    }
    // ---- glow + air layer ----
    ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * ox, DPR * oy);
    ctx.globalCompositeOperation = 'lighter';
    drawGlows(T, vis);
    ctx.globalCompositeOperation = 'source-over';
    for (const p of state.parts) {
      if (!vis(p.x)) continue;
      const k = p.t / p.life, a = Math.sin(Math.min(1, k) * Math.PI) * (p.spr === 'sulfur' ? 0.5 + state.springLvl * 0.3 : 0.55), r = p.size * (0.7 + k * 1.6);
      ctx.globalAlpha = a; ctx.drawImage(puffSpr[p.spr], p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    for (const it of state.food) if (!it.landed && it.t >= 0 && vis(it.x)) drawFood(it, T);
    for (const p of state.pops) {
      if (!vis(p.x)) continue;
      const k = p.t / 0.9; ctx.strokeStyle = rgba(p.c, 1 - k); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 + k * 16, 0, TAU); ctx.stroke();
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + p.x; ctx.fillStyle = rgba(p.c, 1 - k); ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * (6 + k * 18), p.y + Math.sin(a) * (6 + k * 18) - k * 8, 1.6, 0, TAU); ctx.fill(); }
    }
    ctx.globalCompositeOperation = 'lighter';
    const gs = glowSpr.warm;
    for (const sp of spores) {
      if (!vis(sp.x)) continue;
      const tint = sp.x > NB.springs.x0 - 40 ? glowSpr.sulfur : sp.x < NB.mucus.x1 ? glowSpr.pink : gs;
      ctx.globalAlpha = 0.3 + 0.28 * Math.sin(T * 2 + sp.ph); const r = sp.r * 3.2;
      ctx.drawImage(tint, sp.x - r, sp.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function gl(spr, x, y, r, a) { ctx.globalAlpha = a; ctx.drawImage(spr, x - r, y - r, r * 2, r * 2); }
  function drawGlows(T, vis) {
    for (const p of props) {
      if (!vis(p.x, 40)) continue;
      if (p.type === 'lamp') { const g2 = p.spr.glow, fl = 0.9 + 0.1 * Math.sin(T * 7 + p.x) * Math.sin(T * 3.1); gl(glowSpr.warm, p.x + g2.x, p.y + g2.y, 44 * fl, 0.55); }
      else for (const w of p.spr.windows) gl(p.home.kind === 'bubble' ? glowSpr.pink : glowSpr.warm, p.x + w.x, p.y + w.y, w.r * 5, 0.32 + 0.08 * Math.sin(T * 2 + p.x + w.x));
    }
    if (vis(NB.bakery.cx, 200)) {
      const o = L.oven; gl(glowSpr.amber, o.x, o.y - 4, 30 + Math.sin(T * 5) * 3, 0.55);
      for (const c of L.colonocytes) gl(glowSpr.amber, c.win.x, c.win.y, 14 + c.glow * 22, 0.25 + c.glow * 0.45);
      for (const e of L.eaves) gl(glowSpr.amber, e.x, e.y, 10, 0.5 + 0.15 * Math.sin(T * 3 + e.x));
      for (const p of L.lanePosts) if (p.glow) gl(glowSpr.amber, p.glow.x, p.glow.y, 16, 0.55 + 0.1 * Math.sin(T * 4 + p.x));
      for (const c of L.colonocytes) c.lanterns.forEach((l, i) => gl(glowSpr.amber, c.hook.x + i * 7, c.hook.y + 6 + (i % 2) * 4, 14, Math.min(1, l.t * 2, (l.life - l.t) / 4) * 0.7));
    }
    if (vis(NB.orchard.cx, 220) && L.bulbs) for (const b of L.bulbs) gl(glowSpr.lilac, b.x, b.y, 12, 0.22 + 0.14 * Math.sin(T * 1.6 + b.ph));
    if (vis(NB.lab.cx, 200)) {
      for (const w of L.labWins) gl(glowSpr.teal, w.x, w.y, 22, 0.35 + 0.15 * Math.sin(T * 9 + w.x) * Math.sin(T * 2.3));
      gl(glowSpr.lilac, L.cauldron.x, L.cauldron.y - 26, 30, 0.45);
      gl(glowSpr.amber, L.cauldron.x, L.cauldron.y, 18 + Math.sin(T * 11) * 2, 0.5);
    }
    if (vis(NB.mucus.cx, 200)) for (const p of L.pools) gl(glowSpr.pink, p.x, p.y, p.rx * 1.2, 0.18 + 0.06 * Math.sin(T * 1.3 + p.x));
    if (vis(NB.springs.cx, 220)) for (const b of L.basins) gl(glowSpr.sulfur, b.x, b.y, b.rx * (0.7 + state.springLvl * 0.7), 0.12 + state.springLvl * 0.22);
    if (vis(NB.quarry.cx, 200)) gl(glowSpr.white, L.quarry.x - 6, L.quarry.y - 60, 70, 0.16);
    for (const it of state.food) if (vis(it.x) && it.t >= 0) gl(glow('f' + it.type, it.col), it.x, it.y + it.z - 6, 34 * it.scale, 0.85);
    for (const b of state.starch) if (vis(b.x)) gl(glowSpr.white, b.x, b.y - 3, 9, 0.35 + 0.2 * Math.sin(T * 3 + b.ph));
    ctx.globalAlpha = 1;
  }
  function drawFood(it, T) {
    const x = it.x, y = it.y + it.z - 6, r = 7 * it.scale;
    if (r <= 0.2) return;
    if (it.landed) { ctx.fillStyle = 'rgba(40,14,24,0.25)'; ctx.beginPath(); ctx.ellipse(x, it.y, r * 1.2, r * 0.35, 0, 0, TAU); ctx.fill(); }
    const bob = it.landed ? Math.sin(T * 3 + x) * 0.8 : 0;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4 + bob, 0.4, x, y + bob, r);
    g.addColorStop(0, '#fffdf5'); g.addColorStop(0.45, rgba(it.col, 1)); g.addColorStop(1, rgba(it.col.map((v) => v * 0.7 | 0), 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    if (it.type === 'high-fat') ctx.ellipse(x, y + bob, r * 1.1, r * 0.8, 0, 0, TAU);
    else if (it.type === 'sugar') { ctx.rect(x - r * 0.8, y + bob - r * 0.8, r * 1.6, r * 1.6); }
    else ctx.ellipse(x, y + bob, r * 0.85, r, 0.4, 0, TAU);
    ctx.fill();
  }
  function drawMucusFx(T) {
    const a = 0.25 + state.nour.mucus * 0.5;
    for (const p of L.pools) {
      // moving sheen across the jelly
      const k = (T * 0.18 + p.x * 0.01) % 1, sx = p.x - p.rx + k * p.rx * 2;
      ctx.save(); ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); ctx.clip();
      const g = ctx.createLinearGradient(sx - 18, 0, sx + 18, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,250,253,${a * 0.7})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 18, p.y - p.ry, 36, p.ry * 2);
      ctx.restore();
      for (let i = 0; i < 3; i++) { // slow bubbles
        const ph = (T * 0.35 + i * 0.33 + p.x * 0.013) % 1, bx = p.x + Math.sin(i * 2.1 + p.x) * p.rx * 0.6, by = p.y + Math.cos(i * 1.7) * p.ry * 0.4;
        const br = 1.2 + ph * 2.6;
        ctx.strokeStyle = `rgba(255,240,250,${(1 - ph) * 0.8})`; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(bx, by - ph * 3, br, 0, TAU); ctx.stroke();
      }
    }
  }
  function drawQuarryFx(T) {
    // twinkles on crystal faces
    const q = L.quarry;
    for (let i = 0; i < 5; i++) {
      const ph = (T * 0.5 + i * 0.37) % 1, a = Math.sin(ph * Math.PI);
      const x = q.x - 40 + ((i * 53) % 90), y = q.y - 20 - ((i * 37) % 80), r = 2 + a * 3;
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.9})`; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    }
    for (const b of state.starch) { // starch bits left by R. bromii
      const x = b.x, y = b.y, k = Math.min(1, b.t * 4);
      ctx.fillStyle = 'rgba(40,14,24,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, 4, 1.3, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(x, y - 3.5 * k); ctx.rotate(0.3); ctx.scale(k, k);
      ctx.fillStyle = '#fbf7ee'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 4); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(170,200,236,0.7)'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  function drawBakeryFx(T) {
    const c = L.crate;
    state.stock.forEach((j, i) => { // acetate / lactate jars waiting at the bakery
      const x = c.x - 11 + (i % 4) * 7.3, y = c.y - 10 - Math.floor(i / 4) * 8;
      ctx.fillStyle = j.kind === 'lactate' ? '#fff3d6' : '#ffd7e6'; ctx.beginPath(); ctx.ellipse(x, y - 3.4, 3, 3.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a5d44'; ctx.fillRect(x - 2.2, y - 8.2, 4.4, 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x - 1.6, y - 5, 0.9, 2.4);
    });
    for (const h of L.colonocytes) h.lanterns.forEach((l, i) => {
      const a = Math.min(1, l.t * 2, (l.life - l.t) / 4), x = h.hook.x + i * 7, y = h.hook.y + 6 + (i % 2) * 4;
      ctx.globalAlpha = a; ctx.strokeStyle = '#4b3530'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y - 3); ctx.stroke();
      ctx.fillStyle = '#ffc45e'; ctx.beginPath(); ctx.ellipse(x, y, 2.6, 3.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a3c2e'; ctx.fillRect(x - 1.8, y - 3.8, 3.6, 1);
      ctx.globalAlpha = 1;
    });
  }
  function drawWindmill() {
    const m = L.windmill; if (!m.hub) return;
    ctx.save(); ctx.translate(m.hub.x, m.hub.y); ctx.rotate(state.millAng);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#7a5a44'; ctx.fillRect(-1.2, 0, 2.4, 48);
      ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fillRect(1.2, 12, 11, 34);
      ctx.strokeStyle = 'rgba(122,90,68,0.55)'; ctx.lineWidth = 0.7;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(1.2, 14 + k * 8); ctx.lineTo(12.2, 14 + k * 8); ctx.stroke(); }
    }
    ctx.fillStyle = '#5a3c2e'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawLabFx(T) {
    const s2 = L.cauldron.surf; if (!s2) return;
    for (let i = 0; i < 5; i++) {
      const ph = (T * 0.8 + i * 0.21) % 1, x = s2.x + Math.sin(i * 2.4) * 11, y = s2.y - ph * 14, r = 1.5 + ph * 2.5;
      ctx.fillStyle = i % 2 ? `rgba(196,150,255,${1 - ph})` : `rgba(255,150,200,${1 - ph})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }
  function drawSpringsFx(T) {
    const lv = state.springLvl;
    for (const b of L.basins) {
      const k = 0.35 + 0.65 * lv, rx = b.rx * k, ry = b.ry * k;
      const g = ctx.createRadialGradient(b.x - rx * 0.3, b.y - ry * 0.3, 1, b.x, b.y, rx);
      g.addColorStop(0, `rgba(214,214,120,${0.75})`); g.addColorStop(0.6, 'rgba(150,150,70,0.85)'); g.addColorStop(1, 'rgba(96,96,48,0.9)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.x, b.y, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(240,240,150,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(b.x, b.y, rx * 0.96, ry * 0.9, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
      const nb = 1 + Math.round(lv * 5);
      for (let i = 0; i < nb; i++) {
        const ph = (T * (0.6 + lv * 0.8) + i * 0.29 + b.x * 0.01) % 1, bx = b.x + Math.sin(i * 2.7 + b.x) * rx * 0.6, by = b.y + Math.cos(i * 1.3) * ry * 0.4;
        ctx.fillStyle = `rgba(230,232,140,${(1 - ph) * 0.9})`; ctx.beginPath(); ctx.arc(bx, by - ph * 2, 1 + ph * 2.4, 0, TAU); ctx.fill();
      }
    }
  }

  let running = false, raf = 0, last = 0;
  const perf = { frames: 0, acc: 0, ms: 0, worst: 0 };
  function frame(now) {
    raf = 0;
    if (!running) return;
    const t0 = performance.now();
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    checkCast();
    updateCamera(dt);
    simulate(dt);
    render();
    updateDOM(dt);
    if (performance.now() - t0 < 8) lazyBuild();
    const ms = performance.now() - t0; perf.frames++; perf.acc += ms; perf.worst = Math.max(perf.worst, ms);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || !root || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  let shown = false;
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (shown) start(); });

  /* ======================================================================
     Public API
     ====================================================================== */
  let pendingMeals = [];
  function focusNiche(id) {
    const n = NB[id]; if (!n) return;
    if (!built) { cam.cx = n.cx; return; }
    flyTo(clampX(n.cx));
  }
  const FloraWorld = {
    mount(rootEl) {
      if (root) return;
      root = rootEl;
      if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
      initSprites();
      buildDOM();
      if (!insts.length) populate();
      resize();
      makeSpores();
      if (window.ResizeObserver) new ResizeObserver(onResize).observe(root); else window.addEventListener('resize', onResize);
      checkCast();
      drawTalkFace();
      if (pendingToast) { const p = pendingToast; pendingToast = null; showToast(...p); }
      setTimeout(dismissHint, 6000);
    },
    onShow() {
      shown = true;
      if (!root) return;
      resize();
      start();
      if (pendingMeals.length) { const m = pendingMeals.splice(0); m.forEach(applyMealNow); }
    },
    onHide() { shown = false; stop(); },
    setCommunity(comp) {
      state.community = comp && typeof comp === 'object' ? comp : null;
      populate();
    },
    applyMeal(entry) {
      if (!root) { pendingMeals.push(entry); return; }
      applyMealNow(entry);
    },
    focusNiche,
    NICHES: NICHES.map((n) => ({ id: n.id, label: n.label, accent: n.accent })),
    get _debug() { return { state, insts, cam, perf, L, WW, get s() { return s; }, tiles: () => ({ back: back && back.tiles.length, main: main && main.tiles.length, built: main ? main.tiles.filter((t) => t.cv).length : 0, dims: main && main.tiles.map((t) => t.cv ? t.cv.width + 'x' + t.cv.height : '-') }) }; },
  };
  window.FloraWorld = FloraWorld;
})();
