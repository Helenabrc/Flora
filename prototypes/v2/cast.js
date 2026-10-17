/* hiflora v2 — cast.js
   window.FloraCast: the animated gut-bacteria cast and Flora, the host.
   Design system (real biology, see roster.js):
     phylum  -> colour family
     family  -> a shared trait (grabber nubs, flagella, tool belt, Y body, lab gear, jelly coat ...)
     species -> body silhouette from real cell morphology + one signature item + fur texture + eye style
   Furry bodies are pre-rendered once per species in build(); faces, props and poses are drawn live.
   Geometry is in "units": 1 unit = the height of an average character at scale 1 (FloraCast.build(unit)).
   Body frame: x right (the facing direction), y down, body bottom at y = 0, ground at y = FOOT.
   draw() already applies each species' natural size; SPECIES[id].scaleHint is informational
   (≈ the species' height in units) and must NOT be multiplied in again. */
(function () {
  'use strict';
  const TAU = Math.PI * 2, PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const eio = (t) => t * t * (3 - 2 * t);
  const ein = (t) => t * t;
  const hsl = (h, s, l, a) => (a == null
    ? 'hsl(' + h.toFixed(1) + ',' + clamp(s, 0, 100).toFixed(1) + '%,' + clamp(l, 0, 100).toFixed(1) + '%)'
    : 'hsla(' + h.toFixed(1) + ',' + clamp(s, 0, 100).toFixed(1) + '%,' + clamp(l, 0, 100).toFixed(1) + '%,' + a + ')');
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hstr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function hslHex(h, s, l) {
    s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
    const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  const FOOT = 0.05;          // feet height below the body
  const INK = '#2b1d26';
  const MOUTH = '#6e2a3c';
  const TONGUE = '#ff8fa3';

  /* ---------------- phyla ---------------- */
  const PHYLA = {
    bacillota: { name: 'Bacillota', old: 'Firmicutes', h: 18, s: 80, l: 66 },
    bacteroidota: { name: 'Bacteroidota', old: 'Bacteroidetes', h: 168, s: 50, l: 60 },
    actinomycetota: { name: 'Actinomycetota', old: 'Actinobacteria', h: 268, s: 58, l: 74 },
    pseudomonadota: { name: 'Pseudomonadota', old: 'Proteobacteria', h: 205, s: 70, l: 66 },
    verrucomicrobiota: { name: 'Verrucomicrobiota', old: 'Verrucomicrobia', h: 336, s: 72, l: 77 },
    desulfobacterota: { name: 'Desulfobacterota', old: 'Sulfur reducers', h: 68, s: 62, l: 58 },
  };
  for (const k in PHYLA) PHYLA[k].chip = hslHex(PHYLA[k].h, PHYLA[k].s, PHYLA[k].l);

  /* ---------------- path helpers (all subpaths clockwise, so nonzero fill = union) ---------------- */
  function pE(p, cx, cy, rx, ry, rot) { rot = rot || 0; p.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); p.ellipse(cx, cy, rx, ry, rot, 0, TAU); }
  function pC(p, x1, y1, r1, x2, y2, r2) { // tapered capsule
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1e-6, a = Math.atan2(dy, dx);
    const phi = Math.asin(clamp((r1 - r2) / d, -0.999, 0.999));
    p.moveTo(x2 + r2 * Math.cos(a - PI / 2 + phi), y2 + r2 * Math.sin(a - PI / 2 + phi));
    p.arc(x2, y2, r2, a - PI / 2 + phi, a + PI / 2 - phi);
    p.arc(x1, y1, r1, a + PI / 2 - phi, a + PI * 1.5 + phi);
    p.closePath();
  }
  function pRR(p, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    p.moveTo(x + r, y); p.arc(x + w - r, y + r, r, -PI / 2, 0); p.arc(x + w - r, y + h - r, r, 0, PI / 2);
    p.arc(x + r, y + h - r, r, PI / 2, PI); p.arc(x + r, y + r, r, PI, PI * 1.5); p.closePath();
  }
  function pTube(p, pts) { for (let i = 0; i < pts.length - 1; i++) pC(p, pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]); }

  /* live drawing helpers */
  function fe(g, x, y, rx, ry, rot, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, TAU); g.fill(); }
  function fc(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, Math.abs(r), 0, TAU); g.fill(); }
  function ln(g, x1, y1, x2, y2, w, col) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  function rr(g, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function rrf(g, x, y, w, h, r, col) { rr(g, x, y, w, h, r); g.fillStyle = col; g.fill(); }
  function spark(g, x, y, r, col) {
    if (col) g.fillStyle = col;
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
  }
  function wave(g, x, y, ang, len, amp, k, ph) { // adds a wavy polyline to the current path
    const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx; g.moveTo(x, y);
    for (let j = 1; j <= 14; j++) { const u = j / 14, w = Math.sin(u * k - ph) * amp * Math.min(1, u * 2.2); g.lineTo(x + dx * len * u + px * w, y + dy * len * u + py * w); }
  }
  function puffCloud(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.arc(x + r * 0.8, y + r * 0.2, r * 0.72, 0, TAU); g.arc(x - r * 0.8, y + r * 0.25, r * 0.66, 0, TAU); g.arc(x + r * 0.15, y - r * 0.55, r * 0.6, 0, TAU); g.fill(); }

  /* ---------------- body silhouettes (real cell morphology) ---------------- */
  // each returns geometry: path, ext (generous bbox), face{x,y,s}, top{x,y}, sh{cx,x,y}, belt y, feet[], back{x,y}
  const BODY = {
    rod(o) { // bacillus: a soft bean / pill
      const w = o.w, h = o.h, p = new Path2D(); pRR(p, -w / 2, -h, w, h, o.r == null ? w * 0.46 : o.r);
      return { path: p, ext: [-w / 2, -h, w / 2, 0], face: { x: 0.02, y: -h * 0.6, s: o.fs || Math.min(1.1, w / 0.68) }, top: { x: 0, y: -h },
        sh: { cx: 0, x: w / 2 - 0.035, y: -h * 0.36 }, belt: -h * 0.27, feet: [-w * 0.25, w * 0.25], back: { x: -w / 2 + 0.05, y: -h * 0.32 } };
    },
    curved(o) { // slightly curved rod (Faecalibacterium)
      const w = o.w, h = o.h, r = w / 2, N = 7, pts = [];
      const xAt = (u) => -o.bend * Math.sin(PI * u);
      for (let i = 0; i <= N; i++) { const u = i / N; pts.push([xAt(u), -r - u * (h - 2 * r), r]); }
      const p = new Path2D(); pTube(p, pts);
      return { path: p, ext: [-r - o.bend, -h, r, 0], face: { x: xAt(0.62) + 0.05, y: -h * 0.6, s: o.fs || 1 }, top: { x: xAt(1), y: -h },
        sh: { cx: xAt(0.36), x: r - 0.03, y: -h * 0.36 }, belt: -h * 0.27, feet: [-w * 0.24, w * 0.26], back: { x: xAt(0.3) - r + 0.05, y: -h * 0.32 } };
    },
    diplo(o) { // diplococcus: twin buns stacked
      const r1 = o.r1, r2 = o.r2, p = new Path2D(), cy2 = -2 * r1 - r2 + o.ov;
      pE(p, 0, -r1, r1 * 1.04, r1); pE(p, 0, cy2, r2 * 1.03, r2);
      return { path: p, ext: [-r1 * 1.05, cy2 - r2, r1 * 1.05, 0], face: { x: 0.02, y: cy2 + r2 * 0.12, s: o.fs || 0.92 }, top: { x: 0, y: cy2 - r2 },
        sh: { cx: 0, x: r1 * 0.92, y: -r1 * 1.25 }, belt: null, feet: [-r1 * 0.48, r1 * 0.48], back: { x: -r1 * 0.9, y: -r1 } };
    },
    oval(o) {
      const w = o.w, h = o.h, p = new Path2D(); pE(p, 0, -h / 2, w / 2, h / 2);
      return { path: p, ext: [-w / 2, -h, w / 2, 0], face: { x: 0.02, y: -h * 0.56, s: o.fs || 1.02 }, top: { x: 0, y: -h },
        sh: { cx: 0, x: w / 2 - 0.05, y: -h * 0.36 }, belt: -h * 0.3, feet: [-w * 0.25, w * 0.25], back: { x: -w / 2 + 0.04, y: -h * 0.4 } };
    },
    egg(o) { // ovatus: wide bottom, narrow top
      const p = new Path2D(); pC(p, 0, -o.rb, o.rb, 0, -(o.h - o.rt), o.rt);
      return { path: p, ext: [-o.rb, -o.h, o.rb, 0], face: { x: 0.02, y: -o.h * 0.56, s: o.fs || 0.95 }, top: { x: 0, y: -o.h },
        sh: { cx: 0, x: o.rb * 0.92, y: -o.rb * 1.0 }, belt: -o.rb * 0.62, feet: [-o.rb * 0.5, o.rb * 0.5], back: { x: -o.rb * 0.9, y: -o.rb } };
    },
    spindle(o) { // fusiform: tapered at both ends
      const h = o.h, r = o.r, b = o.bend || 0, p = new Path2D();
      pC(p, 0, -0.19, 0.19, b, -h * 0.5, r); pC(p, b, -h * 0.5, r, -b * 0.5, -h + 0.1, 0.1);
      return { path: p, ext: [-r - 0.05, -h, r + 0.05, 0], face: { x: b + 0.03, y: -h * 0.52, s: o.fs || 1 }, top: { x: -b * 0.5, y: -h },
        sh: { cx: b * 0.6, x: r - 0.06, y: -h * 0.36 }, belt: null, feet: [-0.12, 0.12], back: { x: -r * 0.8, y: -h * 0.45 } };
    },
    bifid(o) { // Bifidobacterium: Y-shaped, forked top
      const w = o.w, h = o.h, p = new Path2D(); pRR(p, -w / 2, -h, w, h, w * 0.48);
      const fr = o.fr || 0.1;
      pC(p, -w * 0.16, -h + 0.14, w * 0.27, -o.spread, -h - o.fl, fr);
      pC(p, w * 0.16, -h + 0.14, w * 0.27, o.spread, -h - o.fl, fr);
      return { path: p, ext: [-Math.max(w / 2, o.spread + fr), -h - o.fl - fr, Math.max(w / 2, o.spread + fr), 0], face: { x: 0.02, y: -h * 0.55, s: o.fs || Math.min(1.05, w / 0.62) },
        top: { x: 0, y: -h - 0.02 }, tips: [[-o.spread, -h - o.fl], [o.spread, -h - o.fl]],
        sh: { cx: 0, x: w / 2 - 0.04, y: -h * 0.34 }, belt: -h * 0.26, feet: [-w * 0.25, w * 0.25], back: { x: -w / 2 + 0.05, y: -h * 0.35 } };
    },
    chain(o) { // coccus chain, caterpillar style (head first)
      const p = new Path2D(), B = o.balls;
      for (let i = B.length - 1; i >= 0; i--) pE(p, B[i][0], B[i][1], B[i][2] * 1.02, B[i][2]);
      const H = B[0];
      return { path: p, ext: [B[B.length - 1][0] - B[B.length - 1][2], H[1] - H[2], H[0] + H[2], 0], face: { x: H[0] + 0.05, y: H[1] - 0.02, s: o.fs || 0.95 },
        top: { x: H[0], y: H[1] - H[2] }, sh: { cx: H[0] - 0.04, x: H[2] * 0.86, y: H[1] + 0.1 }, belt: null, head: H,
        feet: [H[0] - 0.14, H[0] + 0.16, B[1][0] - 0.04, B[2] ? B[2][0] : B[1][0] + 0.1], back: { x: B[B.length - 1][0] - B[B.length - 1][2] * 0.8, y: B[B.length - 1][1] } };
    },
    vchain(o) { // lean chain of short rods stacked
      const p = new Path2D(), n = o.n, w = o.w, sh = o.sh, step = sh * 0.88;
      const tops = [];
      for (let i = 0; i < n; i++) { const y = -sh - i * step; const ww = w * (i === n - 1 ? 1.06 : 0.94 - i * 0.03); pRR(p, -ww / 2, y, ww, sh, ww * 0.5); tops.push(y); }
      const topY = tops[n - 1];
      return { path: p, ext: [-w * 0.6, topY, w * 0.6, 0], face: { x: 0.02, y: topY + sh * 0.52, s: o.fs || 0.8 }, top: { x: 0, y: topY },
        sh: { cx: 0, x: w / 2 - 0.04, y: tops[1] + sh * 0.35 }, belt: null, feet: [-w * 0.22, w * 0.22], back: { x: -w / 2 + 0.04, y: tops[1] + sh * 0.5 } };
    },
    blob(o) { // pleomorphic
      const p = new Path2D(); for (const c of o.parts) pE(p, c[0], c[1], c[2] * (c[3] || 1), c[2]);
      return { path: p, ext: [-0.6, -1.05, 0.6, 0], face: { x: 0.04, y: -0.5, s: o.fs || 0.98 }, top: { x: -0.06, y: o.topY },
        sh: { cx: 0, x: 0.36, y: -0.33 }, belt: null, feet: [-0.18, 0.18], back: { x: -0.38, y: -0.4 } };
    },
    comma(o) { // vibrio: comma body with a curled tail
      const p = new Path2D(); pTube(p, o.pts);
      const H = o.pts[0];
      return { path: p, ext: [-0.7, H[1] - H[2], H[0] + H[2], 0.05], face: { x: H[0] + 0.05, y: H[1] + 0.02, s: o.fs || 0.92 }, top: { x: H[0], y: H[1] - H[2] },
        sh: { cx: H[0] - 0.02, x: H[2] * 0.9, y: H[1] + H[2] * 0.62 }, belt: null, feet: [-0.08, 0.2], back: { x: o.pts[o.pts.length - 1][0], y: o.pts[o.pts.length - 1][1] }, head: H };
    },
  };

  /* ---------------- mask analysis (inside test, outward flow field, edges, row widths) ---------------- */
  let SCR = null;
  function analyse(geo, S) {
    const pad = 0.14, e = geo.ext, x0 = e[0] - pad, y0 = e[1] - pad, x1 = e[2] + pad, y1 = e[3] + pad;
    const W = Math.ceil((x1 - x0) * S), H = Math.ceil((y1 - y0) * S);
    if (!SCR) SCR = mk(8, 8);
    SCR.width = W; SCR.height = H;
    const g = SCR.getContext('2d', { willReadFrequently: true });
    g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S); g.fillStyle = '#000'; g.fill(geo.path);
    const d = g.getImageData(0, 0, W, H).data;
    const m = new Uint8Array(W * H), f0 = new Float32Array(W * H);
    let cnt = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    const rmin = new Float32Array(H).fill(1e9), rmax = new Float32Array(H).fill(-1e9);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (d[i * 4 + 3] > 127) {
        m[i] = 1; f0[i] = 1; cnt++;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        if (x < rmin[y]) rmin[y] = x; if (x > rmax[y]) rmax[y] = x;
      }
    }
    let f = blur(f0, W, H, Math.max(2, Math.round(S * 0.07))); f = blur(f, W, H, Math.max(2, Math.round(S * 0.07)));
    const edges = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (!m[i]) continue;
      if (m[i - 1] && m[i + 1] && m[i - W] && m[i + W]) continue;
      let gx = f[i + 1] - f[i - 1], gy = f[i + W] - f[i - W]; const gm = Math.hypot(gx, gy) || 1;
      edges.push(x0 + (x + 0.5) / S, y0 + (y + 0.5) / S, -gx / gm, -gy / gm);
    }
    const M = {
      S, x0, y0, W, H, m, f, edges: new Float32Array(edges), ne: edges.length / 4,
      area: cnt / (S * S), perim: edges.length / 4 / S,
      bbox: [x0 + bx0 / S, y0 + by0 / S, x0 + (bx1 + 1) / S, y0 + (by1 + 1) / S],
      inside(x, y) { const px = ((x - x0) * S) | 0, py = ((y - y0) * S) | 0; return px >= 0 && py >= 0 && px < W && py < H && m[py * W + px] === 1; },
      grad(x, y, out) {
        const px = clamp(((x - x0) * S) | 0, 1, W - 2), py = clamp(((y - y0) * S) | 0, 1, H - 2), i = py * W + px;
        out[0] = f[i + 1] - f[i - 1]; out[1] = f[i + W] - f[i - W];
      },
      half(y, cx) { // half-width of the body at height y (around cx)
        const py = clamp(((y - y0) * S) | 0, 0, H - 1); if (rmax[py] < rmin[py]) return 0.05;
        const a = x0 + rmin[py] / S, b = x0 + (rmax[py] + 1) / S; cx = cx || 0; return Math.max(0.03, Math.min(cx - a, b - cx));
      },
      span(y) { const py = clamp(((y - y0) * S) | 0, 0, H - 1); return rmax[py] < rmin[py] ? [0, 0] : [x0 + rmin[py] / S, x0 + (rmax[py] + 1) / S]; },
    };
    return M;
  }
  function blur(src, W, H, r) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
    for (let y = 0; y < H; y++) {
      const o = y * W; let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[o + clamp(x, 0, W - 1)];
      for (let x = 0; x < W; x++) { tmp[o + x] = acc / n; acc += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
      for (let y = 0; y < H; y++) { out[y * W + x] = acc / n; acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; }
    }
    return out;
  }

  /* ---------------- fur ---------------- */
  // counts are per unit² (interior) or per unit of perimeter (edge/rim); widths and lengths in units
  const FUR = {
    plush: { down: 0.5, jit: 1.0, passes: [{ n: 1500, len: [0.06, 0.13], w: 0.026, a: 0.55, dl: -10 }, { n: 1200, len: [0.045, 0.09], w: 0.018, a: 0.5, dl: 7 }], edge: 130, eLen: [0.04, 0.12], rim: 80, rLen: [0.03, 0.08] },
    fluffy: { down: 0.4, jit: 1.1, curl: 0.35, passes: [{ n: 1400, len: [0.07, 0.14], w: 0.028, a: 0.55, dl: -9 }, { n: 1200, len: [0.05, 0.1], w: 0.019, a: 0.5, dl: 8 }], edge: 170, eLen: [0.06, 0.16], rim: 100, rLen: [0.04, 0.1] },
    velvet: { down: 0.3, jit: 0.8, passes: [{ n: 2300, len: [0.022, 0.045], w: 0.02, a: 0.5, dl: -7 }, { n: 1800, len: [0.018, 0.035], w: 0.015, a: 0.45, dl: 8 }], edge: 190, eLen: [0.015, 0.04], rim: 110, rLen: [0.012, 0.035], gloss: 0.12 },
    shaggy: { down: 0.75, jit: 1.2, curl: 0.6, passes: [{ n: 1000, len: [0.08, 0.16], w: 0.03, a: 0.55, dl: -12 }, { n: 900, len: [0.07, 0.14], w: 0.022, a: 0.5, dl: 8 }], edge: 140, eLen: [0.06, 0.15], rim: 70, rLen: [0.04, 0.11] },
    sleek: { down: 1.7, jit: 0.3, passes: [{ n: 1000, len: [0.08, 0.16], w: 0.018, a: 0.38, dl: -6 }, { n: 800, len: [0.06, 0.12], w: 0.013, a: 0.38, dl: 9 }], edge: 80, eLen: [0.015, 0.045], rim: 100, rLen: [0.015, 0.045], gloss: 0.3 },
    jelly: { jelly: true, down: 0.3, jit: 0.8, passes: [{ n: 700, len: [0.02, 0.04], w: 0.014, a: 0.28, dl: 9 }], edge: 0, rim: 70, rLen: [0.01, 0.03], gloss: 0.4, glow: 0.3 },
    flora: { down: 0.45, jit: 0.9, curl: 0.3, passes: [{ n: 9000, len: [0.03, 0.06], w: 0.009, a: 0.5, dl: -9 }, { n: 8000, len: [0.022, 0.045], w: 0.0065, a: 0.5, dl: 8 }], edge: 900, eLen: [0.02, 0.055], rim: 600, rLen: [0.012, 0.035], glow: 0.09, gloss: 0.16 },
  };

  function bkAdd(m, L, hj, x1, y1, x2, y2, qx, qy) {
    const q = Math.round(L / 3), key = q * 8 + hj; let p = m.get(key);
    if (!p) { p = new Path2D(); p._L = q * 3; p._hj = hj; m.set(key, p); }
    p.moveTo(x1, y1); if (qx === undefined) p.lineTo(x2, y2); else p.quadraticCurveTo(qx, qy, x2, y2);
  }
  function bkFlush(g, m, h, s, a, w) { g.lineWidth = w; for (const p of m.values()) { g.strokeStyle = hsl(h + (p._hj - 1) * 5, s, p._L, a); g.stroke(p); } }

  const GRD = [0, 0];
  function paintFur(g, path, M, h, s, l, fur, rnd, k, dens, deco, geo) {
    const bb = M.bbox, cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, hw = (bb[2] - bb[0]) / 2, hh = (bb[3] - bb[1]) / 2;
    g.lineCap = 'round';
    // soft halo, like light through fur
    g.save(); g.shadowColor = hsl(h, s, 88, fur.jelly ? 0.75 : 0.55); g.shadowBlur = (fur.glow || 0.16) * k; g.fillStyle = hsl(h, s, l - 4); g.fill(path); g.restore();
    const gr = g.createRadialGradient(cx - hw * 0.35, cy - hh * 0.45, 0.01, cx, cy, Math.max(hw, hh) * 1.2);
    gr.addColorStop(0, hsl(h, s, l + 14)); gr.addColorStop(0.55, hsl(h, s, l)); gr.addColorStop(1, hsl(h + 6, s, l - 18));
    g.fillStyle = gr; g.fill(path);
    g.save(); g.clip(path);
    if (deco && deco.under) deco.under(g, M, h, s, l, rnd, geo);
    for (const ps of fur.passes) {
      const n = Math.round(M.area * ps.n * dens), bk = new Map();
      for (let i = 0; i < n; i++) {
        const x = bb[0] + rnd() * (bb[2] - bb[0]), y = bb[1] + rnd() * (bb[3] - bb[1]);
        if (!M.inside(x, y)) continue;
        M.grad(x, y, GRD); let dx = -GRD[0], dy = -GRD[1]; const gm = Math.hypot(dx, dy);
        if (gm < 0.004) { dx = 0; dy = 1; } else { dx /= gm; dy /= gm; }
        dy += fur.down; let m2 = Math.hypot(dx, dy) || 1; dx /= m2; dy /= m2;
        const nz = (rnd() - 0.5) * fur.jit, cs = Math.cos(nz), sn = Math.sin(nz);
        const ux = dx * cs - dy * sn, uy = dx * sn + dy * cs, L = lerp(ps.len[0], ps.len[1], rnd());
        const shade = -(x - cx) / hw * 0.35 - (y - cy) / hh * 0.65;
        const LL = l + ps.dl + shade * 13 + (rnd() - 0.5) * 12;
        if (fur.curl) { const c = (rnd() - 0.5) * fur.curl * L; bkAdd(bk, LL, (rnd() * 3) | 0, x, y, x + ux * L, y + uy * L, x + ux * L * 0.5 - uy * c, y + uy * L * 0.5 + ux * c); }
        else bkAdd(bk, LL, (rnd() * 3) | 0, x, y, x + ux * L, y + uy * L);
      }
      bkFlush(g, bk, h, s, ps.a, ps.w);
    }
    const lg = g.createLinearGradient(0, bb[1], 0, bb[3]);
    lg.addColorStop(0, 'rgba(255,255,255,0.14)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, hsl(h + 12, s, 18, 0.36));
    g.fillStyle = lg; g.fillRect(bb[0] - 1, bb[1] - 1, bb[2] - bb[0] + 2, bb[3] - bb[1] + 2);
    if (fur.gloss) {
      const sg = g.createRadialGradient(cx - hw * 0.3, bb[1] + hh * 0.42, 0, cx - hw * 0.3, bb[1] + hh * 0.42, hw * 0.7);
      sg.addColorStop(0, 'rgba(255,255,255,' + fur.gloss + ')'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg; g.fillRect(bb[0] - 1, bb[1] - 1, bb[2] - bb[0] + 2, bb[3] - bb[1] + 2);
    }
    if (deco && deco.over) deco.over(g, M, h, s, l, rnd, geo);
    g.restore();
    // edge fur + backlit rim
    const E = M.edges;
    if (fur.edge) {
      const n = Math.round(M.perim * fur.edge * dens), bk = new Map();
      for (let i = 0; i < n; i++) {
        const j = ((rnd() * M.ne) | 0) * 4, nx = E[j + 2], ny = E[j + 3], top = Math.max(0, -ny);
        if (ny > 0.75 && rnd() < 0.7) continue; // less fur under the feet
        const st = rnd() * 0.035, sx = E[j] - nx * st, sy = E[j + 1] - ny * st;
        const ang = Math.atan2(ny, nx) + (rnd() - 0.5) * 0.8 + 0.25 * nx * 0, L = lerp(fur.eLen[0], fur.eLen[1], rnd()) * (0.75 + 0.6 * top);
        const ex = sx + Math.cos(ang) * L, ey = sy + Math.sin(ang) * L + L * 0.25 * fur.down;
        const LL = l + 4 + top * 10 + (rnd() - 0.5) * 12 - (ny > 0.3 ? 10 : 0);
        if (fur.curl) { const c = (rnd() - 0.5) * fur.curl * L; bkAdd(bk, LL, (rnd() * 3) | 0, sx, sy, ex, ey, (sx + ex) / 2 - Math.sin(ang) * c, (sy + ey) / 2 + Math.cos(ang) * c); }
        else bkAdd(bk, LL, (rnd() * 3) | 0, sx, sy, ex, ey);
      }
      bkFlush(g, bk, h, s, 0.6, (fur.passes[0].w) * 0.95);
    }
    if (fur.rim) {
      const n = Math.round(M.perim * fur.rim * dens), bk = new Map();
      for (let i = 0; i < n; i++) {
        const j = ((rnd() * M.ne) | 0) * 4, nx = E[j + 2], ny = E[j + 3], top = Math.max(0, -ny);
        if (ny > 0.4) continue;
        const st = rnd() * 0.02, sx = E[j] - nx * st, sy = E[j + 1] - ny * st, ang = Math.atan2(ny, nx) + (rnd() - 0.5) * 0.6, L = lerp(fur.rLen[0], fur.rLen[1], rnd());
        bkAdd(bk, Math.round((0.18 + top * 0.3) * 10) * 3, (rnd() * 3) | 0, sx, sy, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L);
      }
      // rim: key encodes alpha level; draw as near-white strokes
      g.lineWidth = fur.passes[0].w * 0.7;
      for (const p of bk.values()) { g.strokeStyle = hsl(h, s - 10, 92, (p._L / 30).toFixed(2)); g.stroke(p); }
    }
    if (deco && deco.post) deco.post(g, M, h, s, l, rnd, geo);
  }

  /* baked decorations */
  const DECO = {
    belly(g, M, h, s, l, rnd, geo) { const b = M.bbox, cx = (b[0] + b[2]) / 2 + 0.02, w = (b[2] - b[0]); const y = geo.bellyY != null ? geo.bellyY : b[3] - (b[3] - b[1]) * 0.28; fe(g, cx, y, w * 0.3, (b[3] - b[1]) * 0.2, 0, hsl(h - 4, s - 10, l + 16, 0.45)); },
    stripes(g, M, h, s, l) {
      const b = M.bbox; g.strokeStyle = hsl(h + 4, s, l - 22, 0.55); g.lineWidth = 0.06;
      for (let i = 0; i < 4; i++) { const y = b[1] + 0.2 + i * 0.17; g.beginPath(); g.moveTo(b[0] - 0.05, y + 0.03); g.quadraticCurveTo(0, y + 0.1, b[2] + 0.05, y - 0.02); g.stroke(); }
    },
    cowspots(g, M, h, s, l, rnd) {
      const b = M.bbox; const spots = [[-0.18, 0.35, 0.09], [0.16, 0.6, 0.08], [-0.1, 0.8, 0.07], [0.2, 0.2, 0.06], [-0.24, 0.62, 0.05]];
      for (const sp of spots) { const x = sp[0], y = b[1] + (b[3] - b[1]) * sp[1]; g.fillStyle = 'rgba(255,250,236,0.62)'; g.beginPath(); g.arc(x, y, sp[2], 0, TAU); g.arc(x + sp[2] * 0.7, y + sp[2] * 0.3, sp[2] * 0.7, 0, TAU); g.arc(x - sp[2] * 0.5, y + sp[2] * 0.6, sp[2] * 0.6, 0, TAU); g.fill(); }
    },
    nubs(g, M, h, s, l, rnd, geo) { // Oscillospiraceae: little fibre-grabbing amylosome nubs on the outline
      const b = M.bbox, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, E = M.edges, want = geo.nubAngles || [-2.6, -2.05, -1.1, -0.55, 0.15, 2.95, 2.35];
      for (const a of want) {
        let best = -1, bd = 9;
        for (let j = 0; j < M.ne; j++) { const x = E[j * 4] - cx, y = (E[j * 4 + 1] - cy) * 0.8, d = Math.abs(Math.atan2(Math.sin(Math.atan2(y, x) - a), Math.cos(Math.atan2(y, x) - a))); if (d < bd) { bd = d; best = j; } }
        if (best < 0) continue;
        const x = E[best * 4], y = E[best * 4 + 1], nx = E[best * 4 + 2], ny = E[best * 4 + 3];
        const tx = x + nx * 0.075, ty = y + ny * 0.075;
        g.strokeStyle = hsl(h + 4, s, l - 8); g.lineWidth = 0.026; g.beginPath(); g.moveTo(x - nx * 0.01, y - ny * 0.01); g.lineTo(tx, ty); g.stroke();
        fc(g, tx, ty, 0.034, hsl(h - 6, s - 5, l + 14)); fc(g, tx - 0.01, ty - 0.012, 0.012, 'rgba(255,255,255,0.75)');
      }
    },
    freckles(g, M, h, s, l, rnd, geo) {
      const f = geo.face, gap = 0.15 * f.s; g.fillStyle = hsl(h + 8, s, l - 22, 0.6);
      for (const sd of [-1, 1]) for (const d of [[-0.03, 0], [0.025, -0.02], [0.03, 0.025], [-0.01, 0.03]]) { g.beginPath(); g.arc(f.x + sd * (gap * 1.35) + d[0], f.y + 0.1 * f.s + d[1], 0.011, 0, TAU); g.fill(); }
    },
    leafprint(g, M, h, s, l) {
      const b = M.bbox, leaf = (x, y, r, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -r); g.quadraticCurveTo(r * 0.7, 0, 0, r); g.quadraticCurveTo(-r * 0.7, 0, 0, -r); g.fill(); g.restore(); };
      g.fillStyle = hsl(h - 25, s + 10, l + 10, 0.42);
      leaf(-0.2, b[3] - 0.25, 0.07, 0.6); leaf(0.18, b[3] - 0.4, 0.06, -0.5); leaf(-0.08, b[3] - 0.12, 0.05, 1.2);
    },
    jellycoat(g, M, h, s, l, rnd, geo) { // Akkermansiaceae mucin coat
      const c = geo.coat; g.save();
      g.fillStyle = hsl(h, 80, 93, 0.26); g.fill(c);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.022; g.stroke(c);
      g.clip(c);
      const b = M.bbox, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, hw = (b[2] - b[0]) / 2 + 0.09, hh = (b[3] - b[1]) / 2 + 0.09;
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.035; g.beginPath(); g.ellipse(cx, cy, hw * 0.86, hh * 0.86, 0, PI * 1.12, PI * 1.42); g.stroke();
      g.lineWidth = 0.02; g.beginPath(); g.ellipse(cx, cy, hw * 0.86, hh * 0.86, 0, PI * 1.5, PI * 1.58); g.stroke();
      for (let i = 0; i < 7; i++) { const a = rnd() * TAU, r = 0.55 + rnd() * 0.4; g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.01; g.beginPath(); g.arc(cx + Math.cos(a) * hw * r, cy + Math.sin(a) * hh * r, 0.012 + rnd() * 0.02, 0, TAU); g.stroke(); }
      g.restore();
    },
  };

  /* ---------------- shared sprites (glow, blush) ---------------- */
  let GLOW = null, BLUSH = null, GREENGLOW = null;
  function makeGlow(r, g0, b0) {
    const c = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + r + ',' + g0 + ',' + b0 + ',1)'); gr.addColorStop(0.3, 'rgba(' + r + ',' + g0 + ',' + b0 + ',0.5)'); gr.addColorStop(1, 'rgba(' + r + ',' + g0 + ',' + b0 + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  }
  function makeShared() {
    GLOW = makeGlow(255, 196, 92); GREENGLOW = makeGlow(214, 232, 120);
    BLUSH = mk(64, 64); const g = BLUSH.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,105,140,0.75)'); gr.addColorStop(0.55, 'rgba(255,120,150,0.3)'); gr.addColorStop(1, 'rgba(255,130,160,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  function glow(g, img, x, y, r, a) { g.globalAlpha = a; g.drawImage(img, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; }

  /* ---------------- hats & signature items (live) ---------------- */
  const HAT = {
    toque(g, sp, P, t) { // chef hat
      const T = sp.geo.top; g.save(); g.translate(T.x + 0.02, T.y + 0.07); g.rotate(-0.1 + Math.sin(t * 1.3) * 0.03);
      rrf(g, -0.16, -0.13, 0.32, 0.13, 0.04, '#ece4d8');
      fc(g, -0.12, -0.21, 0.11, '#f1ebe1'); fc(g, 0.12, -0.21, 0.11, '#f1ebe1'); fc(g, 0, -0.28, 0.13, '#fbf8f3'); fc(g, -0.07, -0.19, 0.09, '#fdfbf7'); fc(g, 0.08, -0.2, 0.09, '#fdfbf7');
      fc(g, -0.04, -0.33, 0.04, 'rgba(255,255,255,0.9)');
      g.strokeStyle = 'rgba(160,140,120,0.35)'; g.lineWidth = 0.012; for (const x of [-0.08, 0, 0.08]) { g.beginPath(); g.moveTo(x, -0.12); g.lineTo(x, -0.02); g.stroke(); }
      g.restore();
    },
    helmet(g, sp, P, t) { // miner helmet with headlamp
      const T = sp.geo.top; g.save(); g.translate(T.x, T.y + 0.1);
      g.fillStyle = '#f2c230'; g.beginPath(); g.ellipse(0, 0, 0.26, 0.2, 0, PI, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-0.08, -0.11, 0.08, 0.04, -0.4, 0, TAU); g.fill();
      ln(g, 0, -0.2, 0, -0.02, 0.025, '#d9a51c');
      fe(g, 0.02, 0.0, 0.31, 0.05, 0, '#dba21f');
      rrf(g, 0.13, -0.13, 0.1, 0.09, 0.03, '#6b6f78');
      fc(g, 0.2, -0.085, 0.04, '#fff7d6');
      glow(g, GLOW, 0.22, -0.085, 0.16 + Math.sin(t * 3) * 0.01, 0.75);
      g.restore();
    },
    rose(g, sp, P, t) {
      const T = sp.geo.top; g.save(); g.translate(T.x + 0.12, T.y + 0.14); g.rotate(0.3 + Math.sin(t * 1.6) * 0.06);
      fe(g, -0.08, 0.04, 0.06, 0.026, -0.5, '#5aa564'); fe(g, 0.08, 0.05, 0.06, 0.026, 0.5, '#4d9658');
      fc(g, 0, 0, 0.075, '#d9466b'); fc(g, 0.015, -0.01, 0.052, '#ec6585');
      g.strokeStyle = '#b8324f'; g.lineWidth = 0.014; g.beginPath(); g.arc(0.01, -0.005, 0.03, 0.4, PI * 1.6); g.stroke(); g.beginPath(); g.arc(0.012, 0, 0.055, PI * 1.1, PI * 1.9); g.stroke();
      g.restore();
    },
    headband(g, sp, P, t) {
      const T = sp.geo.top, y = T.y + 0.17, hw = sp.geo.M.half(y, T.x) + 0.012;
      g.strokeStyle = '#f25a5f'; g.lineWidth = 0.085; g.beginPath(); g.moveTo(T.x - hw, y + 0.01); g.quadraticCurveTo(T.x, y + 0.06, T.x + hw, y + 0.01); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 0.022; g.beginPath(); g.moveTo(T.x - hw, y + 0.01); g.quadraticCurveTo(T.x, y + 0.06, T.x + hw, y + 0.01); g.stroke();
      // knot ribbons at the back
      g.strokeStyle = '#e04b52'; g.lineWidth = 0.045; const sw = Math.sin(t * 6) * 0.03;
      g.beginPath(); g.moveTo(T.x - hw, y + 0.01); g.quadraticCurveTo(T.x - hw - 0.1, y - 0.02 + sw, T.x - hw - 0.18, y + 0.05 + sw); g.stroke();
      g.beginPath(); g.moveTo(T.x - hw, y + 0.02); g.quadraticCurveTo(T.x - hw - 0.08, y + 0.08 - sw, T.x - hw - 0.15, y + 0.13 - sw); g.stroke();
    },
    catears(g, sp, P, t) {
      const H = sp.geo.head, tw = Math.sin(t * 0.9 + 1) > 0.97 ? 0.12 : 0;
      for (const sd of [-1, 1]) {
        const a = -PI / 2 + sd * 0.62, bx = H[0] + Math.cos(a) * H[2] * 0.88, by = H[1] + Math.sin(a) * H[2] * 0.88;
        g.save(); g.translate(bx, by); g.rotate(sd * 0.45 + (sd > 0 ? tw : 0));
        g.fillStyle = hsl(sp.col.h + 4, sp.col.s, sp.col.l - 6); g.beginPath(); g.moveTo(-0.1, 0.05); g.quadraticCurveTo(-0.04, -0.17, 0.0, -0.2); g.quadraticCurveTo(0.05, -0.17, 0.1, 0.05); g.closePath(); g.fill();
        g.fillStyle = '#ffb3c4'; g.beginPath(); g.moveTo(-0.055, 0.03); g.quadraticCurveTo(-0.02, -0.11, 0.0, -0.13); g.quadraticCurveTo(0.025, -0.11, 0.055, 0.03); g.closePath(); g.fill();
        g.restore();
      }
    },
    cowlick(g, sp, P, t) { // a tiny curled flagellum on top (Lachnospiraceae)
      const T = sp.geo.top; g.strokeStyle = hsl(sp.col.h, sp.col.s, sp.col.l - 4); g.lineWidth = 0.035;
      const sw = Math.sin(t * 2.5) * 0.03; g.beginPath(); g.moveTo(T.x, T.y + 0.04); g.quadraticCurveTo(T.x + 0.02 + sw, T.y - 0.12, T.x + 0.1 + sw, T.y - 0.1); g.quadraticCurveTo(T.x + 0.15 + sw, T.y - 0.05, T.x + 0.09 + sw, T.y - 0.04); g.stroke();
    },
    horns(g, sp, P, t) {
      const T = sp.geo.top;
      for (const sd of [-1, 1]) {
        g.save(); g.translate(T.x + sd * 0.17, T.y + 0.07); g.rotate(sd * 0.35);
        g.fillStyle = '#fff1d8'; g.beginPath(); g.moveTo(-0.05, 0.03); g.quadraticCurveTo(-0.04, -0.09, sd * 0.03, -0.14); g.quadraticCurveTo(0.03, -0.06, 0.05, 0.03); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(200,170,130,0.6)'; g.lineWidth = 0.01; g.beginPath(); g.moveTo(-0.04, -0.01); g.lineTo(0.04, -0.015); g.moveTo(-0.03, -0.05); g.lineTo(0.03, -0.055); g.stroke();
        g.restore();
      }
    },
    crown(g, sp, P, t) {
      const T = sp.geo.top; g.save(); g.translate(T.x + 0.02, T.y + 0.035); g.rotate(0.12);
      g.fillStyle = '#f5c84c'; g.beginPath(); g.moveTo(-0.11, 0); g.lineTo(-0.12, -0.11); g.lineTo(-0.055, -0.05); g.lineTo(0, -0.13); g.lineTo(0.055, -0.05); g.lineTo(0.12, -0.11); g.lineTo(0.11, 0); g.closePath(); g.fill();
      rrf(g, -0.115, -0.035, 0.23, 0.045, 0.015, '#e5ad2e');
      fc(g, 0, -0.013, 0.017, '#f2709a'); fc(g, -0.065, -0.013, 0.012, '#6ec3ef'); fc(g, 0.065, -0.013, 0.012, '#6ec3ef');
      fc(g, 0, -0.135, 0.016, '#fff4cf'); fc(g, -0.12, -0.115, 0.013, '#fff4cf'); fc(g, 0.12, -0.115, 0.013, '#fff4cf');
      g.restore();
    },
    sprout(g, sp, P, t) {
      const T = sp.geo.top, sw = Math.sin(t * 2.2) * 0.05; g.save(); g.translate(T.x, T.y + 0.03); g.rotate(sw);
      ln(g, 0, 0, 0, -0.14, 0.025, '#4f9a4a');
      g.fillStyle = '#7cc46a'; g.beginPath(); g.ellipse(-0.075, -0.15, 0.08, 0.04, 0.45, 0, TAU); g.fill();
      g.fillStyle = '#5eaa52'; g.beginPath(); g.ellipse(0.075, -0.17, 0.085, 0.042, -0.5, 0, TAU); g.fill();
      g.restore();
    },
    eggshell(g, sp, P, t) {
      const T = sp.geo.top; g.save(); g.translate(T.x, T.y + 0.075); g.rotate(-0.12);
      g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(0, 0, 0.22, 0.17, 0, PI, TAU);
      for (let i = 0; i <= 8; i++) g.lineTo(0.22 - i * 0.055, i % 2 ? 0.045 : 0.0);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(214,196,160,0.45)'; g.beginPath(); g.ellipse(0.08, -0.05, 0.1, 0.07, 0, 0, TAU); g.fill();
      fc(g, -0.06, -0.1, 0.014, 'rgba(180,150,110,0.5)'); fc(g, 0.05, -0.12, 0.01, 'rgba(180,150,110,0.5)'); fc(g, -0.12, -0.04, 0.01, 'rgba(180,150,110,0.5)');
      fe(g, -0.09, -0.1, 0.04, 0.02, -0.6, 'rgba(255,255,255,0.9)');
      g.restore();
    },
    cap(g, sp, P, t) { // plain baseball cap: the "common" one
      const T = sp.geo.top; g.save(); g.translate(T.x, T.y + 0.09);
      fe(g, 0.17, 0.0, 0.17, 0.045, 0.06, '#2d4f6b');
      g.fillStyle = '#3c6a8c'; g.beginPath(); g.ellipse(0, 0, 0.25, 0.19, 0, PI, TAU); g.fill();
      fc(g, 0, -0.19, 0.022, '#2d4f6b');
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.012; g.beginPath(); g.moveTo(0, -0.19); g.quadraticCurveTo(0.09, -0.12, 0.12, 0); g.stroke();
      fe(g, -0.1, -0.11, 0.06, 0.025, -0.5, 'rgba(255,255,255,0.25)');
      g.restore();
    },
    strawhat(g, sp, P, t) {
      const T = sp.geo.top; g.save(); g.translate(T.x, T.y + 0.09); g.rotate(-0.06 + Math.sin(t * 1.1) * 0.02);
      fe(g, 0, 0, 0.42, 0.085, 0, '#e2b75a');
      g.strokeStyle = 'rgba(160,110,40,0.35)'; g.lineWidth = 0.008; g.beginPath(); g.ellipse(0, 0, 0.34, 0.065, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(0, 0, 0.27, 0.05, 0, 0, TAU); g.stroke();
      g.fillStyle = '#efcd78'; g.beginPath(); g.ellipse(0, -0.01, 0.2, 0.17, 0, PI, TAU); g.fill();
      g.strokeStyle = '#5f9b55'; g.lineWidth = 0.045; g.beginPath(); g.ellipse(0, -0.01, 0.2, 0.04, 0, PI * 1.02, PI * 1.98); g.stroke();
      g.fillStyle = '#7bbd62'; g.beginPath(); g.ellipse(0.14, -0.07, 0.07, 0.03, -0.7, 0, TAU); g.fill(); g.fillStyle = '#5ea653'; g.beginPath(); g.ellipse(0.17, -0.11, 0.055, 0.024, -1.2, 0, TAU); g.fill();
      fe(g, -0.08, -0.12, 0.05, 0.02, -0.4, 'rgba(255,255,255,0.35)');
      g.restore();
    },
    blossoms(g, sp, P, t) { // b-longum: little blossoms on each fork tip
      for (const tp of sp.geo.tips) {
        const x = tp[0], y = tp[1] - 0.04, r = 0.045, rot = t * 0.4;
        g.fillStyle = '#fff1f4'; for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.72, 0, TAU); g.fill(); }
        fc(g, x, y, r * 0.55, '#ffcf5a');
      }
    },
    headphones(g, sp, P, t) {
      const F = sp.geo.face, y = F.y - 0.02, hw = sp.geo.M.half(y) + 0.015, bop = Math.sin(t * 7) * 0.01;
      g.strokeStyle = '#3a3550'; g.lineWidth = 0.04; g.beginPath(); g.ellipse(0, y, hw, hw * 1.25 + 0.05, 0, PI * 1.03, PI * 1.97); g.stroke();
      for (const sd of [-1, 1]) { rrf(g, sd * hw - 0.055, y - 0.085 + bop, 0.11, 0.17, 0.05, '#3a3550'); rrf(g, sd * hw - 0.042, y - 0.07 + bop, 0.084, 0.14, 0.04, '#78dcc4'); }
    },
    bib(g, sp, P, t) {
      const F = sp.geo.face, y = F.y + 0.2; g.fillStyle = '#fffaf3';
      g.beginPath(); g.moveTo(-0.17, y); g.quadraticCurveTo(0, y + 0.03, 0.17, y); g.arc(0, y, 0.17, 0, PI); g.fill();
      g.fillStyle = '#ffd1dc'; for (let i = -2; i <= 2; i++) fc(g, i * 0.06, y + 0.04 + (2 - Math.abs(i)) * 0.03, 0.014, '#ffd1dc');
    },
    goggles(g, sp, P, t) {
      const T = sp.geo.top, y = T.y + 0.15, hw = sp.geo.M.half(y) + 0.01;
      g.strokeStyle = '#5a4636'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(-hw, y + 0.02); g.quadraticCurveTo(0, y + 0.05, hw, y + 0.02); g.stroke();
      for (const sd of [-1, 1]) { fc(g, sd * 0.095 + 0.02, y, 0.085, '#c9a14a'); fc(g, sd * 0.095 + 0.02, y, 0.062, '#9fe5f2'); fe(g, sd * 0.095 + 0.0, y - 0.02, 0.025, 0.014, -0.6, 'rgba(255,255,255,0.9)'); }
    },
    wizard(g, sp, P, t) {
      const T = sp.geo.top; g.save(); g.translate(T.x, T.y + 0.08); g.rotate(-0.08);
      const sw = Math.sin(t * 1.2) * 0.04;
      g.fillStyle = '#5a46a8'; g.beginPath(); g.moveTo(-0.2, -0.01); g.quadraticCurveTo(-0.07, -0.25, -0.02 + sw, -0.48); g.quadraticCurveTo(0.06 + sw, -0.5, 0.16 + sw, -0.43); g.quadraticCurveTo(0.06, -0.38, 0.2, -0.01); g.closePath(); g.fill();
      fe(g, 0, 0, 0.32, 0.065, 0, '#4a3990');
      g.strokeStyle = '#f5c84c'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(-0.19, -0.04); g.quadraticCurveTo(0, -0.0, 0.19, -0.04); g.stroke();
      spark(g, -0.05, -0.2, 0.035, '#ffe58a'); spark(g, 0.07, -0.32, 0.025, '#ffe58a'); fc(g, 0.04, -0.12, 0.012, '#ffe58a');
      g.restore();
    },
    bile(g, sp, P, t) {
      const T = sp.geo.top, b = 1 + Math.sin(t * 3) * 0.06; g.save(); g.translate(T.x + 0.02, T.y + 0.02); g.scale(1 / b, b);
      g.fillStyle = '#c9da55'; g.beginPath(); g.moveTo(0, -0.2); g.quadraticCurveTo(0.09, -0.08, 0.08, -0.04); g.arc(0, -0.04, 0.08, 0, PI); g.quadraticCurveTo(-0.09, -0.08, 0, -0.2); g.fill();
      fe(g, -0.03, -0.07, 0.018, 0.03, -0.3, 'rgba(255,255,255,0.85)');
      g.restore();
    },
    sunhat(g, sp, P, t) {
      const T = sp.geo.top; g.save(); g.translate(T.x, T.y + 0.02); g.rotate(-0.1 + Math.sin(t * 1.4) * 0.025);
      g.fillStyle = '#fbe6cd'; g.beginPath(); g.ellipse(0, 0, 0.42, 0.09, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,150,110,0.35)'; g.lineWidth = 0.01; g.beginPath(); g.ellipse(0, 0.0, 0.33, 0.065, 0, 0, PI); g.stroke();
      g.fillStyle = '#f7d9b8'; g.beginPath(); g.ellipse(0, -0.01, 0.2, 0.15, 0, PI, TAU); g.fill();
      g.strokeStyle = '#ec7fa0'; g.lineWidth = 0.04; g.beginPath(); g.ellipse(0, -0.012, 0.2, 0.035, 0, PI * 1.03, PI * 1.97); g.stroke();
      const fx = 0.15, fy = -0.06; g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.arc(fx + Math.cos(a) * 0.035, fy + Math.sin(a) * 0.035, 0.028, 0, TAU); g.fill(); }
      fc(g, fx, fy, 0.022, '#ffcc4d');
      g.restore();
    },
  };

  /* front-of-body items */
  const FRONT = {
    belt(g, sp, P, t) { // Bacteroidaceae: Swiss-army toolbelt of PULs
      const y = sp.geo.belt, hw = sp.geo.M.half(y) + 0.008, big = sp.beltSize || 1;
      g.strokeStyle = '#7a5236'; g.lineWidth = 0.07; g.beginPath(); g.moveTo(-hw, y); g.quadraticCurveTo(0, y + 0.07, hw, y); g.stroke();
      rrf(g, -0.04, y + 0.005, 0.08, 0.06, 0.012, '#e7c35a'); rrf(g, -0.022, y + 0.02, 0.044, 0.03, 0.006, '#7a5236');
      const pouch = (x, c) => { rrf(g, x - 0.045, y + 0.01, 0.09, 0.1, 0.025, c); ln(g, x - 0.04, y + 0.035, x + 0.04, y + 0.035, 0.01, 'rgba(0,0,0,0.2)'); };
      if (big >= 1) { // wrench + screwdriver poking out
        ln(g, hw * 0.62, y + 0.02, hw * 0.62 + 0.03, y - 0.12, 0.022, '#aab4be'); g.strokeStyle = '#aab4be'; g.lineWidth = 0.02; g.beginPath(); g.arc(hw * 0.62 + 0.035, y - 0.14, 0.028, PI * 0.2, PI * 1.6); g.stroke();
        ln(g, -hw * 0.62, y + 0.02, -hw * 0.66, y - 0.08, 0.012, '#c0c7cf'); ln(g, -hw * 0.62, y + 0.03, -hw * 0.63, y - 0.03, 0.03, '#e05a4f');
        pouch(hw * 0.62, '#946546'); pouch(-hw * 0.62, '#8a5c3d');
      }
      if (big >= 0.6) pouch(hw * 0.25 + 0.06, sp.beltPouch || '#a5734f');
    },
    scarf(g, sp, P, t) {
      const F = sp.geo.face, y = F.y + 0.21, hw = sp.geo.M.half(y) + 0.02, sw = Math.sin(t * 3 + 1) * 0.02;
      g.strokeStyle = '#e8546a'; g.lineWidth = 0.08; g.beginPath(); g.moveTo(-hw, y); g.quadraticCurveTo(0, y + 0.06, hw, y); g.stroke();
      g.strokeStyle = '#fff2e2'; g.lineWidth = 0.02; for (const o of [-0.02, 0.02]) { g.beginPath(); g.moveTo(-hw, y + o); g.quadraticCurveTo(0, y + 0.06 + o, hw, y + o); g.stroke(); }
      g.fillStyle = '#e8546a'; g.save(); g.translate(-hw * 0.55, y + 0.03); g.rotate(0.15 + sw); rrf(g, -0.04, 0, 0.08, 0.2, 0.025, '#e04a61'); rrf(g, -0.04, 0.06, 0.08, 0.02, 0.005, '#fff2e2'); rrf(g, -0.04, 0.12, 0.08, 0.02, 0.005, '#fff2e2');
      for (const fx of [-0.03, -0.01, 0.01, 0.03]) ln(g, fx, 0.2, fx, 0.235, 0.012, '#e04a61');
      g.restore();
    },
    apron(g, sp, P, t) {
      const y = sp.geo.face.y + 0.2, b = -0.06, hw = 0.2;
      rrf(g, -hw, y, hw * 2, b - y, 0.07, 'rgba(255,251,244,0.95)');
      rrf(g, -0.08, y + (b - y) * 0.45, 0.16, 0.09, 0.03, 'rgba(232,120,110,0.85)');
      ln(g, -hw + 0.04, y + 0.02, -hw + 0.0, y - 0.1, 0.025, 'rgba(255,251,244,0.95)'); ln(g, hw - 0.04, y + 0.02, hw, y - 0.1, 0.025, 'rgba(255,251,244,0.95)');
    },
    badge(g, sp, P, t) { // recycler badge + basket straps
      const y = sp.geo.sh.y, hw = sp.geo.M.half(y - 0.1);
      g.strokeStyle = '#8c6239'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-hw * 0.6, y - 0.16); g.quadraticCurveTo(-hw * 0.3, y + 0.05, -hw * 0.2, y + 0.25); g.stroke();
      g.beginPath(); g.moveTo(hw * 0.75, y - 0.17); g.quadraticCurveTo(hw * 0.75, y + 0.05, hw * 0.55, y + 0.24); g.stroke();
      const bx = 0.12, by = y + 0.12; fc(g, bx, by, 0.065, '#5fb26b');
      g.strokeStyle = '#fff'; g.lineWidth = 0.014; for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + t * 0.6; g.beginPath(); g.arc(bx, by, 0.035, a, a + 1.5); g.stroke(); fc(g, bx + Math.cos(a + 1.5) * 0.035, by + Math.sin(a + 1.5) * 0.035, 0.012, '#fff'); }
    },
  };

  /* behind-the-body items: flagella, tails, hair, basket */
  const BACK = {
    hair(g, sp, P, t) { // Roseburia: many flowing flagella like long hair
      const T = sp.geo.top, c = sp.col, sp0 = sp.speed || 1;
      g.strokeStyle = hsl(c.h - 6, c.s, c.l + 6, 0.85); g.lineWidth = 0.045; g.beginPath();
      for (let i = 0; i < 7; i++) { const sx = T.x - 0.05 + i * 0.02, sy = T.y + 0.1 + i * 0.07; wave(g, sx, sy, 2.45 + i * 0.09, 0.5 + (i % 3) * 0.1, 0.05, 9, t * 6 * sp0 + i * 0.8); }
      g.stroke();
      g.strokeStyle = hsl(c.h - 6, c.s, c.l + 22, 0.7); g.lineWidth = 0.016; g.stroke();
    },
    tail2(g, sp, P, t) { // a-rectalis: two flagella behind
      const B = sp.geo.back, c = sp.col; g.strokeStyle = hsl(c.h, c.s, c.l + 10, 0.8); g.lineWidth = 0.032; g.beginPath();
      wave(g, B.x, B.y, 2.75, 0.62, 0.07, 11, t * 10); wave(g, B.x + 0.02, B.y + 0.12, 3.05, 0.55, 0.06, 11, t * 10 + 1.5); g.stroke();
    },
    tail1(g, sp, P, t) {
      const B = sp.geo.back, c = sp.col; g.strokeStyle = hsl(c.h, c.s, c.l + 8, 0.75); g.lineWidth = 0.028; g.beginPath();
      wave(g, B.x, B.y, 2.9, 0.42, 0.05, 10, t * 7); g.stroke();
    },
    basket(g, sp, P, t) {
      const B = sp.geo.back, T = sp.geo.top, x = B.x - 0.08, y = T.y + 0.18;
      rrf(g, x - 0.04, y - 0.06, 0.07, 0.07, 0.025, '#fffaf0'); rrf(g, x - 0.035, y - 0.085, 0.06, 0.03, 0.01, '#e8a73d');
      rrf(g, x + 0.04, y - 0.04, 0.06, 0.06, 0.02, '#fff6e6'); rrf(g, x + 0.045, y - 0.06, 0.05, 0.025, 0.01, '#5fb26b');
      rrf(g, x - 0.12, y, 0.3, 0.32, 0.05, '#c9975a');
      g.strokeStyle = 'rgba(120,80,40,0.45)'; g.lineWidth = 0.014;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x - 0.12, y + i * 0.064); g.lineTo(x + 0.18, y + i * 0.064); g.stroke(); }
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x - 0.12 + i * 0.06, y); g.lineTo(x - 0.12 + i * 0.06, y + 0.32); g.stroke(); }
      rrf(g, x - 0.135, y - 0.015, 0.33, 0.045, 0.02, '#b07f45');
    },
    cattail(g, sp, P, t) {
      const B = sp.geo.back, c = sp.col; g.strokeStyle = hsl(c.h + 4, c.s, c.l - 4); g.lineWidth = 0.05;
      const sw = Math.sin(t * 2.4) * 0.08; g.beginPath(); g.moveTo(B.x + 0.04, B.y); g.bezierCurveTo(B.x - 0.15, B.y + 0.05, B.x - 0.2 + sw, B.y - 0.25, B.x - 0.08 + sw, B.y - 0.32); g.stroke();
      g.strokeStyle = hsl(c.h, c.s, c.l + 12); g.lineWidth = 0.05; g.beginPath(); g.moveTo(B.x - 0.08 + sw, B.y - 0.32); g.lineTo(B.x - 0.05 + sw, B.y - 0.34); g.stroke();
    },
    devtail(g, sp, P, t) { // m-gnavus: cheeky little tail with a heart tip
      const B = sp.geo.back, c = sp.col, sw = Math.sin(t * 3.3) * 0.06, ex = B.x - 0.22, ey = B.y - 0.22 + sw;
      g.strokeStyle = hsl(c.h + 6, c.s, c.l - 14); g.lineWidth = 0.032; g.beginPath(); g.moveTo(B.x + 0.04, B.y + 0.1); g.bezierCurveTo(B.x - 0.2, B.y + 0.18, B.x - 0.25, B.y - 0.05, ex, ey); g.stroke();
      g.save(); g.translate(ex, ey); g.rotate(-0.6 + sw); g.fillStyle = hsl(c.h + 6, c.s, c.l - 14);
      g.beginPath(); g.moveTo(0, 0.04); g.bezierCurveTo(-0.08, -0.02, -0.04, -0.08, 0, -0.035); g.bezierCurveTo(0.04, -0.08, 0.08, -0.02, 0, 0.04); g.fill(); g.restore();
    },
    peri(g, sp, P, t) { // E. coli: peritrichous flagella all around
      const c = sp.col, M = sp.geo.M, b = M.bbox, cx = 0, cy = (b[1] + b[3]) / 2, hw = (b[2] - b[0]) / 2, hh = (b[3] - b[1]) / 2;
      const spd = P.fast ? 22 : 12;
      g.strokeStyle = hsl(c.h, c.s, c.l + 14, 0.8); g.lineWidth = 0.026; g.beginPath();
      const angs = [-2.5, -1.95, -1.25, -0.6, 0.2, 2.6, 3.1, 2.0];
      for (let i = 0; i < angs.length; i++) { const a = angs[i]; const sx = cx + Math.cos(a) * hw * 0.85, sy = cy + Math.sin(a) * hh * 0.85; wave(g, sx, sy, a + (a > 1 ? 0.25 : -0.25), 0.42 + (i % 3) * 0.08, 0.05, 12, t * spd + i); }
      g.stroke();
    },
    polar(g, sp, P, t) { // d-piger: one polar flagellum from the tail tip
      const B = sp.geo.back, c = sp.col; g.strokeStyle = hsl(c.h, c.s, c.l + 10, 0.85); g.lineWidth = 0.03; g.beginPath();
      wave(g, B.x, B.y, 3.5, 0.5, 0.06, 10, t * 5); g.stroke();
    },
  };

  /* face extras that move with the face */
  const FX_FACE = {
    whiskers(g, sp, fx, fy, er, gap) { g.strokeStyle = 'rgba(80,50,60,0.55)'; g.lineWidth = er * 0.1; for (const sd of [-1, 1]) for (const d of [-0.25, 0.15]) { g.beginPath(); g.moveTo(fx + sd * gap * 1.25, fy + er * 1.35 + d * er); g.lineTo(fx + sd * (gap * 1.25 + er * 1.3), fy + er * 1.2 + d * er * 2); g.stroke(); } },
    glasses(g, sp, fx, fy, er, gap) {
      for (const sd of [-1, 1]) { const x = fx + sd * gap; fc(g, x, fy, er * 1.45, 'rgba(255,255,255,0.16)'); g.strokeStyle = '#5b3b2e'; g.lineWidth = er * 0.24; g.beginPath(); g.arc(x, fy, er * 1.45, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(fx - gap + er * 1.45, fy - er * 0.2); g.quadraticCurveTo(fx, fy - er * 0.7, fx + gap - er * 1.45, fy - er * 0.2); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = er * 0.16; for (const sd of [-1, 1]) { g.beginPath(); g.arc(fx + sd * gap, fy, er * 1.15, PI * 1.15, PI * 1.4); g.stroke(); }
    },
    wheat(g, sp, fx, fy, er, gap, P, t) {
      if (P.mouth) return; const mx = fx + er * 0.5, my = fy + er * 1.7, sw = Math.sin(t * 2) * 0.02;
      ln(g, mx, my, mx + 0.2, my - 0.1 + sw, 0.012, '#d8b04c');
      g.fillStyle = '#e6c25c'; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(mx + 0.13 + i * 0.025, my - 0.065 - i * 0.012 + sw, 0.018, 0.009, -0.5, 0, TAU); g.fill(); }
    },
    pipe(g, sp, fx, fy, er, gap, P) {
      if (P.mouth === 2 || P.mouth === 1 || P.hold === 'eat') return; const mx = fx + er * 0.55, my = fy + er * 1.65;
      ln(g, mx, my, mx + 0.11, my + 0.04, 0.022, '#7b4e2f'); rrf(g, mx + 0.09, my - 0.015, 0.06, 0.075, 0.018, '#8f5c37'); fe(g, mx + 0.12, my - 0.01, 0.028, 0.01, 0, '#4a2e1c');
    },
    pacifier(g, sp, fx, fy, er, gap, P) {
      if (P.mouth === 1 || P.mouth === 2 || P.hold === 'bottle' || P.hold === 'eat') return; const mx = fx + er * 0.15, my = fy + er * 1.65;
      fe(g, mx, my, er * 0.75, er * 0.5, 0, '#ff9fb8'); fc(g, mx, my, er * 0.22, '#ffd36b');
      g.strokeStyle = '#ff9fb8'; g.lineWidth = er * 0.16; g.beginPath(); g.arc(mx, my + er * 0.5, er * 0.32, 0, PI); g.stroke();
    },
  };

  /* ---------------- species ---------------- */
  // eye: 'round' | 'lash' | 'sparkle' | 'wide' | 'sleepy' | 'lazy' | 'baby' | 'cheeky' | 'content'
  // mouth: 'smile' | 'cat' | 'grin' | 'open' | 'smirk'
  const DEF = [
    ['f-prausnitzii', { nick: 'Faye', ph: 'bacillota', niche: 'bakery', work: 'bake', tool: 'whisk', idle: 'lantern', body: ['curved', { w: 0.7, h: 1.0, bend: 0.09 }], dh: 0, dl: 0, fur: 'plush', deco: ['belly', '|nubs'], eye: 'round', mouth: 'smile', head: ['toque'], hatH: 0.36,
      look: 'Curved rod in soft coral plush with grabber nubs; chef toque; carries a glowing butyrate lantern.' }],
    ['f-duncaniae', { nick: 'Dani', ph: 'bacillota', niche: 'bakery', work: 'bake', tool: 'knead', body: ['rod', { w: 0.66, h: 0.88, r: 0.3 }], dh: 9, dl: 4, fur: 'plush', deco: ['belly', '|freckles', '|nubs'], eye: 'sparkle', mouth: 'smile', front: ['scarf'], hatH: 0,
      look: "Faye's twin: straight peachy rod with grabber nubs, freckles and a knitted striped scarf." }],
    ['r-bromii', { nick: 'Rumi', ph: 'bacillota', niche: 'quarry', work: 'mine', tool: 'pickaxe', idle: 'pickrest', body: ['diplo', { r1: 0.37, r2: 0.33, ov: 0.12 }], dh: -9, dl: -2, fur: 'velvet', deco: ['|nubs'], eye: 'round', mouth: 'smile', head: ['helmet'], hatH: 0.24,
      look: 'Diplococcus twin buns in velvet coral-red with grabber nubs; miner helmet with a headlamp and a pickaxe.' }],
    ['r-intestinalis', { nick: 'Rosie', ph: 'bacillota', niche: 'bakery', work: 'bake', tool: 'sieve', body: ['spindle', { r: 0.36, h: 1.08, bend: 0.03 }], dh: -14, dl: 2, fur: 'shaggy', deco: ['belly'], eye: 'lash', mouth: 'smile', back: ['hair'], head: ['rose'], hatH: 0.05,
      look: 'Pink-coral spindle, shaggy, with long flowing flagella like hair and a rose; sifts fibre.' }],
    ['a-rectalis', { nick: 'Rex', ph: 'bacillota', niche: 'quarry', work: 'mine', tool: 'shovel', body: ['rod', { w: 0.62, h: 1.0, r: 0.3 }], dh: 6, dl: -4, fur: 'sleek', deco: [], eye: 'wide', mouth: 'smile', back: ['tail2'], head: ['headband'], hatH: 0,
      look: 'Sleek orange rod with twin flagella tail and a red-and-white sporty headband; digs with a shovel.' }],
    ['a-hadrus', { nick: 'Hadley', ph: 'bacillota', niche: 'bakery', work: 'bake', tool: 'rollpin', body: ['rod', { w: 0.8, h: 0.9, r: 0.36 }], dh: 13, dl: -1, fur: 'plush', deco: ['stripes'], eye: 'round', mouth: 'open', back: ['tail1'], front: ['apron'], hatH: 0,
      look: 'Chunky tiger-striped apricot rod with a short flagellum and a baker apron; rolls dough.' }],
    ['a-hallii', { nick: 'Hallie', ph: 'bacillota', niche: 'bakery', work: 'recycle', tool: 'collect', body: ['rod', { w: 0.56, h: 1.06, r: 0.28 }], dh: 15, dl: 7, fur: 'plush', deco: ['belly'], eye: 'content', mouth: 'smile', back: ['basket', 'tail1'], front: ['badge'], hatH: 0,
      look: 'Slim light-apricot rod with a woven recycling backpack full of lactate jars and a recycle badge.' }],
    ['c-catus', { nick: 'Kit', ph: 'bacillota', niche: 'bakery', work: 'brew', tool: 'ladle', body: ['chain', { balls: [[0.18, -0.36, 0.36], [-0.32, -0.27, 0.27], [-0.64, -0.2, 0.2]] }], dh: -4, dl: 6, fur: 'fluffy', deco: [], eye: 'round', mouth: 'cat', back: ['cattail'], head: ['catears'], faceX: ['whiskers'], hatH: 0.14,
      look: 'Fluffy coccus chain (a caterpillar of three balls) with cat ears, whiskers, a cat-mouth and a tail.' }],
    ['b-wexlerae', { nick: 'Lexi', ph: 'bacillota', niche: 'fields', work: 'mop', tool: 'mop', body: ['oval', { w: 0.8, h: 0.9 }], dh: 10, dl: 8, fur: 'sleek', deco: ['belly'], eye: 'round', mouth: 'smile', head: ['cowlick'], faceX: ['glasses'], hatH: 0.1,
      look: 'Smooth, glossy pale-peach oval with round glasses and a curly flagellum cowlick; mops up hydrogen.' }],
    ['m-gnavus', { nick: 'Gus', ph: 'bacillota', niche: 'mucus', work: 'nibble', tool: 'nibble', body: ['oval', { w: 0.78, h: 0.78, fs: 1.0 }], dh: -15, dl: -7, fur: 'shaggy', deco: [], eye: 'cheeky', mouth: 'grin', back: ['devtail'], head: ['horns'], hatH: 0.12,
      look: 'Shaggy deep-coral coccobacillus with little horns, a heart-tipped tail and a cheeky fanged grin; nibbles mucus.' }],
    ['c-minuta', { nick: 'Minnie', ph: 'bacillota', niche: 'lab', work: 'brew', tool: 'testtube', body: ['vchain', { n: 3, w: 0.44, sh: 0.44, fs: 0.82 }], dh: 4, dl: 9, fur: 'sleek', deco: [], eye: 'sparkle', mouth: 'smile', head: ['crown'], fx: 'twinkle', hatH: 0.12,
      look: 'Tall, lean chain of three pale cells with a tiny crown and heritable sparkles.' }],
    ['l-plantarum', { nick: 'Pip', ph: 'bacillota', niche: 'fields', work: 'ferment', tool: 'shakejar', idle: 'jar', body: ['rod', { w: 0.6, h: 0.84, r: 0.29 }], dh: 17, dl: 9, fur: 'velvet', deco: ['cowspots'], eye: 'round', mouth: 'open', head: ['sprout'], hatH: 0.18,
      look: 'Sunny velvet rod with cream dairy spots, a sprout on top and a tiny pickle jar.' }],
    ['b-thetaiotaomicron', { nick: 'Theo', ph: 'bacteroidota', niche: 'mucus', work: 'tinker', tool: 'wrench', body: ['rod', { w: 0.82, h: 1.0, r: 0.38 }], dh: 0, dl: 0, fur: 'plush', deco: ['belly'], eye: 'round', mouth: 'smile', front: ['belt'], beltSize: 1, hatH: 0,
      look: 'Big teal rod with a Swiss-army tool belt (wrench, screwdriver, pouches); tinkers with gears.' }],
    ['b-ovatus', { nick: 'Ovie', ph: 'bacteroidota', niche: 'fields', work: 'tinker', tool: 'hammer', body: ['egg', { rb: 0.4, rt: 0.27, h: 0.96 }], dh: 12, dl: 6, fur: 'velvet', deco: ['belly'], eye: 'sparkle', mouth: 'smile', head: ['eggshell'], front: ['belt'], beltSize: 0.6, beltPouch: '#6f9a5a', hatH: 0.1,
      look: 'Egg-shaped mint velvet body wearing a cracked eggshell cap and a small tool belt; cracks tough nuts.' }],
    ['p-vulgatus', { nick: 'Vee', ph: 'bacteroidota', niche: 'fields', work: 'tinker', tool: 'screwdriver', body: ['rod', { w: 0.7, h: 0.9, r: 0.32 }], dh: -9, dl: -3, fur: 'plush', deco: [], eye: 'round', mouth: 'smile', head: ['cap'], front: ['belt'], beltSize: 0.6, hatH: 0.14,
      look: 'Everyday teal rod in a plain blue baseball cap with a simple tool pouch.' }],
    ['s-copri', { nick: 'Cobi', ph: 'bacteroidota', niche: 'fields', work: 'farm', tool: 'hoe', body: ['rod', { w: 0.68, h: 1.08, r: 0.31 }], dh: -16, dl: 1, fur: 'shaggy', deco: ['leafprint'], eye: 'round', mouth: 'smile', head: ['strawhat'], faceX: ['wheat'], hatH: 0.2,
      look: 'Tall, shaggy green-teal rod with leaf prints, a straw farmer hat and a wheat stalk; works a hoe.' }],
    ['b-longum', { nick: 'Lola', ph: 'actinomycetota', niche: 'orchard', work: 'nurse', tool: 'watering', body: ['bifid', { w: 0.6, h: 0.86, fl: 0.36, spread: 0.27 }], dh: 0, dl: 0, fur: 'plush', deco: ['belly'], eye: 'lash', mouth: 'smile', head: ['blossoms'], hatH: 0.05,
      look: 'Long lilac Y with blossoms on each fork tip; tends seedlings with a watering can.' }],
    ['b-adolescentis', { nick: 'Addy', ph: 'actinomycetota', niche: 'quarry', work: 'mine', tool: 'jackhammer', body: ['bifid', { w: 0.64, h: 0.74, fl: 0.28, spread: 0.29 }], dh: -15, dl: -3, fur: 'shaggy', deco: [], eye: 'wide', mouth: 'open', head: ['headphones'], fx: 'notes', hatH: 0,
      look: 'Shaggy violet teen Y wearing mint headphones (music notes float up); breaks starch with a jackhammer.' }],
    ['b-breve', { nick: 'Bree', ph: 'actinomycetota', niche: 'orchard', work: 'nurse', tool: 'bottle', body: ['bifid', { w: 0.62, h: 0.52, fl: 0.16, spread: 0.19, fr: 0.09, fs: 0.95 }], dh: 14, dl: 5, fur: 'fluffy', deco: [], eye: 'baby', mouth: 'smile', head: ['bib'], faceX: ['pacifier'], hatH: 0,
      look: 'Small, chubby pink-lilac baby Y with huge eyes, a pacifier and a bib; sips a milk bottle.' }],
    ['c-aerofaciens', { nick: 'Aero', ph: 'actinomycetota', niche: 'lab', work: 'brew', tool: 'flask', idle: 'flask', body: ['rod', { w: 0.76, h: 0.72, r: 0.3 }], dh: -18, dl: -5, fur: 'velvet', deco: [], eye: 'round', mouth: 'open', head: ['goggles'], hatH: 0,
      look: 'Short, wide periwinkle velvet rod with brass alchemist goggles and a bubbling flask.' }],
    ['e-lenta', { nick: 'Ellie', ph: 'actinomycetota', niche: 'lab', work: 'brew', tool: 'mortar', body: ['rod', { w: 0.68, h: 0.8, r: 0.32 }], dh: 10, dl: -9, fur: 'plush', deco: ['belly'], eye: 'sleepy', mouth: 'smile', head: ['wizard'], hatH: 0.5,
      look: 'Short purple rod with slow sleepy eyes and a starry wizard hat; grinds remedies in a mortar.' }],
    ['e-coli', { nick: 'Esco', ph: 'pseudomonadota', niche: 'springs', work: 'sprint', tool: 'jumprope', body: ['rod', { w: 0.6, h: 0.96, r: 0.3 }], dh: 0, dl: 0, fur: 'sleek', deco: [], eye: 'wide', mouth: 'open', back: ['peri'], sneakers: true, hatH: 0,
      look: 'Sleek sky-blue rod with many wavy flagella all around and sneakers; skips rope.' }],
    ['b-wadsworthia', { nick: 'Wadsy', ph: 'desulfobacterota', niche: 'springs', work: 'puff', tool: 'puff', body: ['blob', { parts: [[0, -0.42, 0.4, 1.05], [0.2, -0.62, 0.27], [-0.24, -0.33, 0.26], [-0.13, -0.74, 0.22], [0.27, -0.26, 0.2]], topY: -0.95 }], dh: -6, dl: 0, fur: 'shaggy', deco: [], eye: 'content', mouth: 'smirk', head: ['bile'], fx: 'puffs', hatH: 0.12,
      look: 'Lumpy pleomorphic chartreuse blob with a bile drop on top and drifting sulfur puffs.' }],
    ['d-piger', { nick: 'Piper', ph: 'desulfobacterota', niche: 'springs', work: 'puff', tool: 'puff', body: ['comma', { pts: [[0.06, -0.66, 0.33], [0.02, -0.38, 0.3], [-0.12, -0.17, 0.19], [-0.32, -0.12, 0.13], [-0.47, -0.21, 0.08]] }], dh: 12, dl: -3, fur: 'velvet', deco: [], eye: 'lazy', mouth: 'smile', back: ['polar'], faceX: ['pipe'], fx: 'bubbles', hatH: 0,
      look: 'Comma-shaped lime vibrio with one polar flagellum, lazy half-lidded eyes and a bubble pipe blowing sulfur bubbles.' }],
    ['a-muciniphila', { nick: 'Akki', ph: 'verrucomicrobiota', niche: 'mucus', work: 'rake', tool: 'rake', body: ['oval', { w: 0.8, h: 0.84 }], coat: 0.085, dh: 0, dl: 0, fur: 'jelly', deco: ['belly', '|jellycoat'], eye: 'sparkle', mouth: 'smile', head: ['sunhat'], hatH: 0.1,
      look: 'Pink oval wrapped in a translucent jelly mucin coat, in a gardener sun hat; rakes the mucus meadow.' }],
  ];

  const SPX = {};       // internal species records
  const SPECIES = {};   // public
  for (const [id, o] of DEF) {
    const ph = PHYLA[o.ph];
    const h = ph.h + o.dh, s = ph.s, l = ph.l + o.dl;
    const geo = BODY[o.body[0]](o.body[1]);
    if (o.coat) { const c = new Path2D(), b = o.body[1]; pE(c, 0, -b.h / 2, b.w / 2 + o.coat, b.h / 2 + o.coat); geo.coat = c; }
    const sp = Object.assign({}, o, { id, geo, seed: hstr(id),
      col: { h, s, l, arm: hsl(h + 3, s, l - 9), armHi: hsl(h, s, l + 8), foot: hsl(h + 6, s - 5, l - 22), footHi: hsl(h, s, l - 6), tint: hsla2(h, l) },
      blinkPer: 3.1 + (hstr(id) % 1000) / 1000 * 2.2 });
    SPX[id] = sp;
  }
  function hsla2(h, l) { return hsl(h, 55, clamp(l - 30, 25, 60), 0.6); }

  /* ---------------- pose ---------------- */
  const P = { bob: 0, tilt: 0, sx: 1, sy: 1, jx: 0, aR: 0.35, aL: 0.35, lx: 0, ly: 0, eyes: 0, mouth: 0, fL: 0, fR: 0, hold: null, v: 0, at: 0, fast: false, zzz: false, party: false, hRx: 0, hRy: 0, hLx: 0, hLy: 0, work: false };
  const ARM = 0.13;
  const WORK = {
    pickaxe(a, t) { const c = (a * 1.3) % 1; P.aR = c < 0.62 ? lerp(0.5, 2.9, eio(c / 0.62)) : lerp(2.9, 0.75, ein((c - 0.62) / 0.38)); P.aL = 0.7; P.tilt = c < 0.62 ? -0.06 * eio(c / 0.62) : 0.09; P.v = c; P.eyes = c > 0.85 ? 3 : 0; },
    hammer(a, t) { const c = (a * 1.8) % 1; P.aR = c < 0.6 ? lerp(0.6, 2.6, eio(c / 0.6)) : lerp(2.6, 0.9, ein((c - 0.6) / 0.4)); P.aL = 0.9; P.tilt = c < 0.6 ? -0.04 : 0.08; P.v = c; P.eyes = c > 0.88 ? 3 : 0; },
    hoe(a, t) { const c = (a * 1.1) % 1; P.aR = c < 0.6 ? lerp(0.7, 2.7, eio(c / 0.6)) : lerp(2.7, 0.9, ein((c - 0.6) / 0.4)); P.aL = 1.1; P.tilt = c < 0.6 ? -0.05 : 0.1; P.v = c; },
    shovel(a, t) { const c = (a * 1.1) % 1; P.aR = 0.9 + 0.45 * Math.sin(c * TAU); P.aL = 1.1 + 0.3 * Math.sin(c * TAU); P.tilt = 0.06 + 0.06 * Math.sin(c * TAU); P.v = c; },
    jackhammer(a, t) { P.aR = 1.35; P.aL = 1.5; P.jx = Math.sin(t * 95) * 0.01; P.bob = Math.abs(Math.sin(t * 47)) * 0.012; P.v = a; P.eyes = (a % 1.6) < 0.9 ? 3 : 2; P.mouth = 1; },
    whisk(a, t) { P.aR = 1.15 + 0.22 * Math.sin(a * 11); P.aL = 1.0; P.v = a; P.lx = 0.5; },
    knead(a, t) { const k = Math.sin(a * 6); P.aR = 1.45 + 0.25 * k; P.aL = 1.3 + 0.25 * k; P.tilt = 0.05 + 0.04 * k; P.bob = -0.01 * k; P.v = a; },
    rollpin(a, t) { const k = Math.sin(a * 4); P.aR = 1.45 + 0.18 * k; P.aL = 1.25 + 0.18 * k; P.tilt = 0.06 + 0.03 * k; P.v = a; },
    sieve(a, t) { P.aR = 1.4; P.aL = 1.2; P.jx = Math.sin(a * 22) * 0.012; P.v = a; },
    collect(a, t) { const c = (a * 0.6) % 1; if (c < 0.35) { P.aR = lerp(1.0, 0.25, eio(c / 0.35)); P.tilt = 0.22 * eio(c / 0.35); } else if (c < 0.7) { const u = eio((c - 0.35) / 0.35); P.aR = lerp(0.25, 3.0, u); P.tilt = lerp(0.22, -0.08, u); } else { P.aR = lerp(3.0, 1.0, eio((c - 0.7) / 0.3)); P.tilt = lerp(-0.08, 0, (c - 0.7) / 0.3); } P.aL = 0.6; P.v = c; P.ly = 0.6; },
    ladle(a, t) { P.aR = 1.25 + 0.18 * Math.sin(a * 4); P.aL = 0.7; P.v = a; P.tilt = 0.05; },
    rake(a, t) { const k = Math.sin(a * 3.2); P.aR = 1.05 + 0.2 * k; P.aL = 1.2 + 0.2 * k; P.tilt = 0.08 + 0.04 * k; P.v = a; },
    nibble(a, t) { P.aR = 2.2; P.aL = 2.2; P.mouth = 2; P.v = a; P.eyes = (a % 1.4) < 0.7 ? 2 : 0; },
    wrench(a, t) { P.aR = 1.4 + 0.3 * Math.sin(a * 5); P.aL = 0.9; P.v = a; P.lx = 0.6; },
    screwdriver(a, t) { P.aR = 1.45 + 0.1 * Math.sin(a * 9); P.aL = 1.0; P.v = a; P.lx = 0.6; },
    mop(a, t) { const k = Math.sin(a * 3.4); P.aR = 1.0 + 0.25 * k; P.aL = 1.15 + 0.25 * k; P.tilt = 0.05 * k + 0.04; P.v = a; },
    shakejar(a, t) { P.aR = 1.6; P.aL = 1.6; P.v = a; P.bob = Math.abs(Math.sin(a * 14)) * 0.02; P.eyes = 2; P.mouth = 1; },
    watering(a, t) { P.aR = 1.5 + 0.15 * Math.sin(a * 2); P.aL = 0.6; P.v = a; P.ly = 0.5; P.tilt = 0.04; },
    bottle(a, t) { P.aR = 2.05; P.aL = 1.9; P.v = a; P.eyes = 1; P.mouth = 0; P.sy *= 1 + Math.sin(a * 5) * 0.015; },
    flask(a, t) { P.aR = 2.2 + 0.12 * Math.sin(a * 6); P.aL = 0.9; P.v = a; P.ly = -0.7; P.lx = 0.4; },
    mortar(a, t) { P.aR = 1.3 + 0.15 * Math.sin(a * 5); P.aL = 1.2; P.v = a; P.ly = 0.5; },
    testtube(a, t) { P.aR = 2.6 + 0.08 * Math.sin(a * 2); P.aL = 0.6; P.v = a; P.ly = -1; P.lx = 0.5; P.mouth = 1; },
    jumprope(a, t) { const ph = a * 7.5; P.v = ph; P.aR = 0.8 + 0.25 * Math.sin(ph); P.aL = 0.8 + 0.25 * Math.sin(ph); const up = Math.max(0, Math.cos(ph)); P.bob = 0.13 * up * up; P.fL = P.fR = 0.03 * up; P.mouth = 1; },
    puff(a, t) { const k = Math.sin(a * 2.6); P.sx *= 1 + 0.06 * k; P.sy *= 1 + 0.05 * k; P.eyes = k < -0.2 ? 1 : 0; P.mouth = k < -0.2 ? 3 : 0; P.v = a; P.aR = 0.5 + 0.2 * k; P.aL = 0.5 + 0.2 * k; },
  };

  function pose(sp, inst) {
    const t = inst.t || 0, ph = inst.phase || 0, act = inst.activity || 'idle', at = inst.activityT || 0;
    const br = Math.sin(t * 2.1 + ph) * 0.022;
    P.bob = 0; P.tilt = 0; P.sx = 1 + br; P.sy = 1 - br; P.jx = 0; P.v = 0; P.at = at; P.fast = false; P.zzz = false; P.party = false; P.work = false;
    P.aR = 0.32 + Math.sin(t * 1.7 + ph) * 0.06; P.aL = 0.32 + Math.sin(t * 1.7 + ph + 1) * 0.06;
    P.lx = clamp(Math.sin(t * 0.37 + ph * 3) * 1.8, -1, 1) * 0.55; P.ly = 0.1 + Math.sin(t * 0.23 + ph) * 0.15;
    P.eyes = 0; P.mouth = 0; P.fL = 0; P.fR = 0; P.hold = sp.idle || null;
    switch (act) {
      case 'walk': case 'run': {
        const run = act === 'run', w = t * (run ? 15 : 9.5) + ph, s = Math.sin(w);
        P.bob = Math.abs(s) * (run ? 0.075 : 0.04); P.fL = Math.max(0, s) * (run ? 0.08 : 0.055); P.fR = Math.max(0, -s) * (run ? 0.08 : 0.055);
        P.aR = (run ? 0.75 : 0.35) + s * (run ? 0.55 : 0.32); P.aL = (run ? 0.75 : 0.35) - s * (run ? 0.55 : 0.32);
        P.tilt = run ? 0.12 : 0.04; P.lx = 0.75; P.ly = run ? 0 : 0.1; P.sx = 1 - Math.abs(s) * 0.03; P.sy = 1 + Math.abs(s) * 0.03; P.fast = run;
        if (run) { P.mouth = 1; P.hold = null; } else if (P.hold === 'pickrest' || P.hold === 'jar' || P.hold === 'flask') P.aR = 0.9;
        break;
      }
      case 'work': { P.hold = sp.tool; P.work = true; P.lx = 0.55; P.ly = 0.35; const f = WORK[sp.tool]; if (f) f(at, t); break; }
      case 'carry': P.aR = 1.3 + Math.sin(t * 3 + ph) * 0.06; P.aL = 1.3 + Math.sin(t * 3 + ph) * 0.06; P.hold = 'carry'; P.lx = 0.5; P.ly = 0.2;
        { const w = t * 9 + ph, s = Math.sin(w); P.bob = Math.abs(s) * 0.03; P.fL = Math.max(0, s) * 0.04; P.fR = Math.max(0, -s) * 0.04; }
        break;
      case 'eat': P.aR = 2.05; P.aL = 2.05; P.hold = 'eat'; P.mouth = 2; P.eyes = (at % 1.2) < 0.6 ? 2 : 0; P.lx = 0.2; P.ly = 0.4; P.bob = Math.abs(Math.sin(at * 8)) * 0.012; break;
      case 'sleep': P.eyes = 1; P.mouth = 4; P.sy = 0.93 + Math.sin(t * 1.6) * 0.03; P.sx = 1.05 - Math.sin(t * 1.6) * 0.02; P.tilt = 0.09; P.aR = 0.12; P.aL = 0.12; P.zzz = true; P.hold = null; break;
      case 'celebrate': P.aR = 2.6 + Math.sin(t * 14) * 0.28; P.aL = 2.6 + Math.sin(t * 14 + 1.6) * 0.28; P.bob = Math.abs(Math.sin(at * 7)) * 0.1; P.eyes = 2; P.mouth = 1; P.party = true; P.hold = null; P.lx = 0; P.ly = -0.2; break;
      case 'wave': P.aR = 2.55 + Math.sin(t * 12) * 0.38; P.aL = 0.4; P.eyes = (at % 2.2) < 1.1 ? 2 : 0; P.mouth = 1; P.lx = 0.05; P.ly = 0; P.hold = null; P.tilt = -0.04; break;
      case 'divide': P.hold = null; break;
    }
    if (inst.hungry && act !== 'sleep' && act !== 'eat') { if (P.mouth !== 2) P.mouth = 3; if (P.eyes === 2) P.eyes = 0; }
    else if (P.mouth === 0 && (inst.mood || 0.5) > 0.82 && act === 'idle') P.mouth = 1;
    // hands
    const S = sp.geo.sh;
    P.hRx = S.cx + S.x + ARM * Math.sin(P.aR); P.hRy = S.y + ARM * Math.cos(P.aR);
    P.hLx = S.cx - S.x - ARM * Math.sin(P.aL); P.hLy = S.y + ARM * Math.cos(P.aL);
    return P;
  }

  /* ---------------- props held in hands / work scenes ---------------- */
  const G0 = FOOT; // ground y in body frame
  function armDir(a) { return Math.atan2(Math.cos(a), Math.sin(a)); }
  function crystal(g, x, y, s) {
    g.fillStyle = '#e9f3ff'; g.beginPath(); g.moveTo(x - 0.1 * s, y); g.lineTo(x - 0.07 * s, y - 0.13 * s); g.lineTo(x - 0.01 * s, y - 0.2 * s); g.lineTo(x + 0.06 * s, y - 0.12 * s); g.lineTo(x + 0.1 * s, y); g.closePath(); g.fill();
    g.fillStyle = '#c6dcf5'; g.beginPath(); g.moveTo(x - 0.01 * s, y - 0.2 * s); g.lineTo(x + 0.06 * s, y - 0.12 * s); g.lineTo(x + 0.1 * s, y); g.lineTo(x + 0.01 * s, y); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 0.06 * s, y - 0.11 * s); g.lineTo(x - 0.02 * s, y - 0.16 * s); g.lineTo(x - 0.03 * s, y - 0.05 * s); g.closePath(); g.fill();
  }
  function chips(g, x, y, u, col) { if (u > 1) return; g.fillStyle = col; for (let i = 0; i < 4; i++) { const a = -PI / 2 + (i - 1.5) * 0.6; fc(g, x + Math.cos(a) * u * 0.22, y + Math.sin(a) * u * 0.22 + u * u * 0.12, 0.018 * (1 - u), col); } }
  function counter(g) { rrf(g, -0.02, -0.4, 0.68, 0.06, 0.02, '#c08a55'); rrf(g, -0.02, -0.4, 0.68, 0.02, 0.01, '#d9a46c'); ln(g, 0.06, -0.35, 0.06, G0, 0.04, '#a87445'); ln(g, 0.58, -0.35, 0.58, G0, 0.04, '#a87445'); }
  function lantern(g, x, y, t, big) {
    const s = big ? 1.25 : 1; g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = '#7a5a3a'; g.lineWidth = 0.014; g.beginPath(); g.arc(0, 0.01, 0.035, PI, TAU); g.stroke();
    glow(g, GLOW, 0, 0.1, 0.2 + Math.sin(t * 4) * 0.015, 0.7);
    rrf(g, -0.045, 0.03, 0.09, 0.025, 0.008, '#8a6440'); rrf(g, -0.04, 0.05, 0.08, 0.1, 0.03, '#ffbe4d'); fc(g, 0, 0.1, 0.028, '#fff2c4');
    rrf(g, -0.045, 0.145, 0.09, 0.022, 0.008, '#8a6440');
    g.restore();
  }
  function jar(g, x, y, s, t, shake) {
    g.save(); g.translate(x, y); g.scale(s, s);
    rrf(g, -0.065, -0.07, 0.13, 0.16, 0.035, 'rgba(225,245,250,0.85)');
    rrf(g, -0.055, -0.02, 0.11, 0.1, 0.03, 'rgba(214,226,120,0.75)');
    g.save(); g.rotate(0.4 + (shake ? Math.sin(t * 20) * 0.4 : 0)); fe(g, 0, 0.02, 0.022, 0.055, 0, '#6fae4c'); fc(g, -0.006, 0.0, 0.006, '#9fd27b'); g.restore();
    rrf(g, -0.07, -0.1, 0.14, 0.04, 0.012, '#e35d5d'); fc(g, -0.035, -0.08, 0.008, '#fff'); fc(g, 0.0, -0.08, 0.008, '#fff'); fc(g, 0.035, -0.08, 0.008, '#fff');
    fe(g, -0.035, -0.03, 0.012, 0.035, 0, 'rgba(255,255,255,0.7)');
    g.restore();
  }
  function flask(g, x, y, s, t, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    g.fillStyle = 'rgba(230,248,255,0.85)'; g.beginPath(); g.moveTo(-0.025, -0.11); g.lineTo(-0.025, -0.05); g.lineTo(-0.085, 0.06); g.quadraticCurveTo(-0.09, 0.08, -0.07, 0.08); g.lineTo(0.07, 0.08); g.quadraticCurveTo(0.09, 0.08, 0.085, 0.06); g.lineTo(0.025, -0.05); g.lineTo(0.025, -0.11); g.closePath(); g.fill();
    const hue = (t * 40) % 360;
    g.fillStyle = hsl(150 + Math.sin(t) * 40, 70, 62, 0.9); g.beginPath(); g.moveTo(-0.055, 0.01); g.lineTo(-0.085, 0.06); g.quadraticCurveTo(-0.09, 0.08, -0.07, 0.08); g.lineTo(0.07, 0.08); g.quadraticCurveTo(0.09, 0.08, 0.085, 0.06); g.lineTo(0.055, 0.01); g.closePath(); g.fill();
    rrf(g, -0.032, -0.13, 0.064, 0.025, 0.008, '#b68a5a');
    fe(g, -0.04, 0.02, 0.008, 0.03, 0.5, 'rgba(255,255,255,0.8)');
    for (let i = 0; i < 3; i++) { const u = (t * 0.9 + i / 3) % 1; fc(g, Math.sin(u * 8 + i) * 0.02, -0.13 - u * 0.2, 0.012 + u * 0.012, hsl(150 + Math.sin(t) * 40, 70, 80, (1 - u) * 0.85)); }
    void hue; g.restore();
  }
  function pickaxeAt(g, hx, hy, ang, len) {
    const ux = Math.cos(ang), uy = Math.sin(ang), ex = hx + ux * len, ey = hy + uy * len, px = -uy, py = ux;
    ln(g, hx - ux * 0.06, hy - uy * 0.06, ex, ey, 0.045, '#9b6a3f');
    g.strokeStyle = '#8d98a6'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(ex + px * 0.16 - ux * 0.06, ey + py * 0.16 - uy * 0.06); g.quadraticCurveTo(ex + ux * 0.04, ey + uy * 0.04, ex - px * 0.16 - ux * 0.06, ey - py * 0.16 - uy * 0.06); g.stroke();
    g.strokeStyle = '#c3ccd6'; g.lineWidth = 0.016; g.beginPath(); g.moveTo(ex + px * 0.12 - ux * 0.03, ey + py * 0.12 - uy * 0.03); g.quadraticCurveTo(ex + ux * 0.05, ey + uy * 0.05, ex - px * 0.05, ey - py * 0.05); g.stroke();
  }
  function gear(g, x, y, r, rot, col) {
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr2 = i % 2 ? r : r * 1.25; g.lineTo(Math.cos(a - 0.1) * rr2, Math.sin(a - 0.1) * rr2); g.lineTo(Math.cos(a + 0.1) * rr2, Math.sin(a + 0.1) * rr2); }
    g.closePath(); g.fill(); fc(g, 0, 0, r * 0.4, '#5d6b78'); g.restore();
  }
  function bubbles(g, x, y, t, rate, n, col, rise, spread) {
    g.strokeStyle = col; g.lineWidth = 0.012;
    for (let i = 0; i < n; i++) { const u = (t * rate + i / n) % 1; const bx = x + Math.sin(u * 7 + i * 2) * spread, by = y - u * rise, r = 0.02 + u * 0.025; g.globalAlpha = 1 - u; g.beginPath(); g.arc(bx, by, r, 0, TAU); g.stroke(); fc(g, bx - r * 0.35, by - r * 0.35, r * 0.25, col); }
    g.globalAlpha = 1;
  }
  function puffs(g, x, y, t, rate, n, rise) {
    for (let i = 0; i < n; i++) { const u = (t * rate + i / n) % 1; puffCloud(g, x + Math.sin(u * 5 + i * 1.7) * 0.07 + u * 0.08, y - u * rise, 0.035 + u * 0.06, 'rgba(206,222,104,' + ((1 - u) * 0.55).toFixed(3) + ')'); }
  }
  function seedling(g, x, y, s, t) {
    g.save(); g.translate(x, y); g.scale(s, s); fe(g, 0, 0, 0.1, 0.025, 0, '#9c7350');
    const sw = Math.sin(t * 2) * 0.05; g.rotate(sw); ln(g, 0, 0, 0, -0.12, 0.022, '#5ea653');
    fe(g, -0.05, -0.12, 0.055, 0.025, 0.4, '#7cc46a'); fe(g, 0.05, -0.14, 0.055, 0.025, -0.4, '#6bb85c'); g.restore();
  }
  function carryItem(g, kind, x, y, t) {
    switch (kind) {
      case 'butyrate': lantern(g, x, y - 0.1, t, true); break;
      case 'lactate': g.save(); g.translate(x, y); rrf(g, -0.07, -0.08, 0.14, 0.15, 0.04, '#fffaf0'); rrf(g, -0.07, -0.11, 0.14, 0.04, 0.012, '#e8a73d'); fe(g, -0.035, -0.03, 0.012, 0.03, 0, 'rgba(255,255,255,0.9)'); rrf(g, -0.04, -0.02, 0.08, 0.05, 0.01, 'rgba(240,200,120,0.6)'); g.restore(); break;
      case 'acetate': g.save(); g.translate(x, y); g.fillStyle = '#9fd5f5'; g.beginPath(); g.moveTo(0, -0.13); g.quadraticCurveTo(0.09, -0.02, 0.07, 0.03); g.arc(0, 0.03, 0.07, 0, PI); g.quadraticCurveTo(-0.09, -0.02, 0, -0.13); g.fill(); fe(g, -0.025, 0.0, 0.015, 0.03, -0.3, 'rgba(255,255,255,0.85)'); g.restore(); break;
      case 'starch': crystal(g, x, y + 0.08, 0.85); break;
      case 'mucus': fe(g, x, y, 0.1, 0.08, 0, 'rgba(255,190,220,0.7)'); fe(g, x - 0.03, y - 0.03, 0.03, 0.018, -0.4, 'rgba(255,255,255,0.85)'); break;
      case 'sulfide': puffCloud(g, x, y, 0.07, 'rgba(206,222,104,0.85)'); fc(g, x - 0.03, y - 0.03, 0.015, 'rgba(255,255,255,0.6)'); break;
      case 'leaf': g.save(); g.translate(x, y); g.rotate(-0.5 + Math.sin(t * 3) * 0.1); g.fillStyle = '#6bbd5c'; g.beginPath(); g.moveTo(0, -0.13); g.quadraticCurveTo(0.1, -0.02, 0, 0.11); g.quadraticCurveTo(-0.1, -0.02, 0, -0.13); g.fill(); ln(g, 0, -0.1, 0, 0.12, 0.012, '#4e9a45'); g.restore(); break;
      case 'flask': flask(g, x, y, 1.1, t, 0); break;
      default: fc(g, x, y, 0.07, '#ffd27a');
    }
  }

  const HOLD = {
    lantern(g, sp, t) { lantern(g, P.hRx + 0.01, P.hRy - 0.02, t); },
    jar(g, sp, t) { jar(g, P.hRx + 0.02, P.hRy - 0.03, 0.75, t, false); },
    flask(g, sp, t) { flask(g, P.hRx + 0.02, P.hRy - 0.05, P.work ? 1.2 : 0.85, t, P.work ? Math.sin(t * 6) * 0.25 : 0.1); },
    pickrest(g, sp, t) { pickaxeAt(g, P.hRx, P.hRy, -1.15, 0.36); },
    pickaxe(g, sp, t) {
      const c = P.v; crystal(g, sp.geo.sh.cx + 0.66, G0, 1);
      if (c > 0.93 || c < 0.12) chips(g, sp.geo.sh.cx + 0.6, G0 - 0.12, c > 0.5 ? (c - 0.93) * 4 : c * 5 + 0.28, '#ffffff');
      pickaxeAt(g, P.hRx, P.hRy, armDir(P.aR) - 0.2, 0.36);
    },
    hammer(g, sp, t) {
      const c = P.v, nx = sp.geo.sh.cx + 0.56; fe(g, nx, G0 - 0.05, 0.08, 0.06, 0, '#a7743f'); g.strokeStyle = '#7b5228'; g.lineWidth = 0.012; g.beginPath(); g.moveTo(nx, G0 - 0.11); g.lineTo(nx + 0.01, G0 - 0.05); g.lineTo(nx - 0.01, G0); g.stroke();
      if (c > 0.95 || c < 0.15) chips(g, nx, G0 - 0.1, c > 0.5 ? (c - 0.95) * 4 : c * 5 + 0.2, '#c99a62');
      const ang = armDir(P.aR) - 0.15, ux = Math.cos(ang), uy = Math.sin(ang), ex = P.hRx + ux * 0.26, ey = P.hRy + uy * 0.26;
      ln(g, P.hRx - ux * 0.04, P.hRy - uy * 0.04, ex, ey, 0.035, '#a8774a');
      g.save(); g.translate(ex, ey); g.rotate(ang); rrf(g, -0.04, -0.08, 0.08, 0.16, 0.02, '#7f8b98'); rrf(g, -0.03, -0.075, 0.025, 0.15, 0.01, '#a9b4c0'); g.restore();
    },
    hoe(g, sp, t) {
      const c = P.v, gx = sp.geo.sh.cx + 0.62; fe(g, gx, G0, 0.16, 0.04, 0, '#8d6444'); seedling(g, gx + 0.18, G0, 0.6 + 0.4 * ss(0.1, 0.5, (P.at * 0.25) % 1), t);
      if (c > 0.95 || c < 0.15) chips(g, gx, G0 - 0.04, c > 0.5 ? (c - 0.95) * 4 : c * 5 + 0.2, '#8d6444');
      const ang = armDir(P.aR) - 0.2, ux = Math.cos(ang), uy = Math.sin(ang), ex = P.hRx + ux * 0.42, ey = P.hRy + uy * 0.42, px = -uy, py = ux;
      ln(g, P.hRx - ux * 0.06, P.hRy - uy * 0.06, ex, ey, 0.04, '#a8774a');
      ln(g, ex, ey, ex - px * 0.12 + ux * 0.02, ey - py * 0.12 + uy * 0.02, 0.06, '#8d98a6');
    },
    shovel(g, sp, t) {
      const gx = sp.geo.sh.cx + 0.64; g.fillStyle = '#e8eef8'; g.beginPath(); g.ellipse(gx + 0.06, G0, 0.18, 0.1, 0, PI, TAU); g.fill(); crystal(g, gx + 0.12, G0 - 0.02, 0.6);
      const ang = 1.0 + 0.3 * Math.sin(P.v * TAU), ux = Math.cos(ang), uy = Math.sin(ang), ex = P.hRx + ux * 0.4, ey = P.hRy + uy * 0.4;
      ln(g, P.hRx - ux * 0.1, P.hRy - uy * 0.1, ex, ey, 0.04, '#a8774a'); ln(g, P.hRx - ux * 0.13 - uy * 0.04, P.hRy - uy * 0.13 + ux * 0.04, P.hRx - ux * 0.13 + uy * 0.04, P.hRy - uy * 0.13 - ux * 0.04, 0.03, '#7a5236');
      g.save(); g.translate(ex, ey); g.rotate(ang - PI / 2); rrf(g, -0.07, 0, 0.14, 0.13, 0.05, '#8d98a6'); fc(g, 0, 0.07, 0.03, '#f4f8ff'); g.restore();
    },
    jackhammer(g, sp, t) {
      const x = sp.geo.sh.cx + sp.geo.sh.x + 0.16, top = sp.geo.sh.y + 0.0;
      crystal(g, x + 0.03, G0 + 0.01, 0.8);
      rrf(g, x - 0.05, top, 0.1, G0 - 0.12 - top, 0.03, '#f0b13c'); rrf(g, x - 0.035, top + 0.03, 0.03, G0 - 0.18 - top, 0.01, 'rgba(255,255,255,0.35)');
      ln(g, x - 0.1, top + 0.02, x + 0.1, top + 0.02, 0.035, '#3a3f48'); ln(g, x, G0 - 0.12, x, G0 - 0.02, 0.025, '#8d98a6');
      if ((t * 12) % 1 < 0.5) chips(g, x + 0.02, G0 - 0.05, (t * 6) % 1, '#ffffff');
    },
    whisk(g, sp, t) {
      const bx = sp.geo.sh.cx + 0.2, by = sp.geo.sh.y + 0.24;
      fe(g, bx, by - 0.01, 0.2, 0.06, 0, '#f6dfb4'); // batter
      const wx = bx + Math.cos(P.v * 11) * 0.07, wy = by - 0.02 + Math.sin(P.v * 11) * 0.02;
      ln(g, P.hRx, P.hRy, wx, wy - 0.02, 0.025, '#a8774a');
      g.strokeStyle = '#b9c3cd'; g.lineWidth = 0.012; for (const w of [0.025, 0.045]) { g.beginPath(); g.ellipse(wx, wy - 0.02, w, 0.06, 0, PI * 0.1, PI * 0.9); g.stroke(); }
      g.fillStyle = '#e9e1d6'; g.beginPath(); g.ellipse(bx, by, 0.21, 0.065, 0, 0, PI); g.lineTo(bx + 0.18, by + 0.12); g.quadraticCurveTo(bx, by + 0.2, bx - 0.18, by + 0.12); g.closePath(); g.fill();
      fe(g, bx - 0.09, by + 0.07, 0.03, 0.016, 0.3, 'rgba(255,255,255,0.6)'); ln(g, bx - 0.15, by + 0.1, bx + 0.15, by + 0.1, 0.014, '#8fb9c9');
      // butyrate sparks rising from the bowl
      for (let i = 0; i < 2; i++) { const u = (t * 0.7 + i * 0.5) % 1; glow(g, GLOW, bx + Math.sin(u * 6 + i) * 0.06, by - 0.05 - u * 0.35, 0.05, (1 - u) * 0.9); }
    },
    knead(g, sp, t) {
      counter(g); const k = Math.sin(P.v * 6), dx = 0.32;
      fe(g, dx, -0.46, 0.15 + 0.03 * k, 0.07 - 0.02 * k, 0, '#f7e2b8'); fe(g, dx - 0.04, -0.49, 0.05, 0.02, -0.2, 'rgba(255,255,255,0.6)');
      for (let i = 0; i < 3; i++) fc(g, dx - 0.15 + i * 0.07, -0.43 + (i % 2) * 0.01, 0.008, 'rgba(255,255,255,0.8)');
    },
    rollpin(g, sp, t) {
      counter(g); fe(g, 0.32, -0.42, 0.24, 0.025, 0, '#f7e2b8');
      const px = 0.3 + 0.1 * Math.sin(P.v * 4); rrf(g, px - 0.15, -0.5, 0.3, 0.06, 0.03, '#d9a46c'); ln(g, px - 0.2, -0.47, px - 0.15, -0.47, 0.03, '#a87445'); ln(g, px + 0.15, -0.47, px + 0.2, -0.47, 0.03, '#a87445');
    },
    sieve(g, sp, t) {
      const x = P.hRx + 0.06, y = P.hRy + 0.02;
      for (let i = 0; i < 6; i++) { const u = (t * 1.6 + i / 6) % 1; fc(g, x - 0.1 + ((i * 37) % 20) / 100, y + 0.05 + u * (G0 - y - 0.05), 0.01, 'rgba(255,250,235,' + (1 - u) + ')'); }
      fe(g, x, y, 0.16, 0.06, 0, 'rgba(240,235,225,0.55)'); g.strokeStyle = 'rgba(150,140,130,0.5)'; g.lineWidth = 0.006;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x + i * 0.04, y - 0.05); g.lineTo(x + i * 0.04, y + 0.05); g.stroke(); }
      g.strokeStyle = '#c99a5b'; g.lineWidth = 0.03; g.beginPath(); g.ellipse(x, y, 0.16, 0.06, 0, 0, TAU); g.stroke(); fe(g, x + 0.02, y - 0.015, 0.08, 0.025, 0, 'rgba(255,248,230,0.95)');
    },
    collect(g, sp, t) {
      const c = P.v; for (let i = 0; i < 2; i++) { const dx = sp.geo.sh.cx + 0.5 + i * 0.18; if (i === 0 && c > 0.3) continue; drop(g, dx, G0 - 0.04, 0.8); }
      if (c > 0.3 && c < 0.72) drop(g, P.hRx, P.hRy - 0.02, 0.9);
    },
    ladle(g, sp, t) {
      const px = sp.geo.sh.cx + sp.geo.sh.x + 0.33, py = G0 - 0.16;
      for (let i = 0; i < 3; i++) { const u = (t * 0.5 + i / 3) % 1; g.strokeStyle = 'rgba(255,255,255,' + ((1 - u) * 0.6).toFixed(2) + ')'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(px - 0.05 + i * 0.05, py - 0.1 - u * 0.3); g.quadraticCurveTo(px + 0.03 + i * 0.05, py - 0.18 - u * 0.3, px - 0.03 + i * 0.05, py - 0.26 - u * 0.3); g.stroke(); }
      fe(g, px, py, 0.17, 0.045, 0, '#3d3644'); fe(g, px, py + 0.005, 0.15, 0.035, 0, '#f4a85a');
      const lx = px + Math.cos(P.v * 4) * 0.07, ly = py + Math.sin(P.v * 4) * 0.015; ln(g, P.hRx, P.hRy, lx, ly - 0.02, 0.022, '#c0c7cf');
      g.fillStyle = '#4b4553'; g.beginPath(); g.moveTo(px - 0.17, py); g.quadraticCurveTo(px - 0.17, py + 0.2, px, py + 0.2); g.quadraticCurveTo(px + 0.17, py + 0.2, px + 0.17, py); g.closePath(); g.fill();
      fe(g, px - 0.08, py + 0.07, 0.03, 0.05, 0.3, 'rgba(255,255,255,0.18)'); ln(g, px - 0.1, py + 0.2, px - 0.12, G0, 0.03, '#3d3644'); ln(g, px + 0.1, py + 0.2, px + 0.12, G0, 0.03, '#3d3644');
    },
    rake(g, sp, t) {
      const gx = sp.geo.sh.cx + 0.55 + 0.12 * Math.sin(P.v * 3.2);
      for (let i = 0; i < 3; i++) { const bx = sp.geo.sh.cx + 0.4 + i * 0.16; fe(g, bx, G0 - 0.01, 0.045, 0.025, 0, 'rgba(255,180,210,0.75)'); fc(g, bx - 0.012, G0 - 0.02, 0.008, 'rgba(255,255,255,0.8)'); }
      ln(g, P.hRx - 0.05, P.hRy - 0.05, gx, G0 - 0.04, 0.035, '#b07f45');
      ln(g, gx - 0.11, G0 - 0.04, gx + 0.11, G0 - 0.04, 0.03, '#7e8a96');
      g.strokeStyle = '#7e8a96'; g.lineWidth = 0.016; g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(gx + i * 0.05, G0 - 0.04); g.lineTo(gx + i * 0.05, G0 + 0.01); } g.stroke();
    },
    nibble(g, sp, t) {
      const F = sp.geo.face, s = 0.85 + 0.15 * Math.sin(P.v * 3), x = F.x + 0.1, y = F.y + 0.22;
      fe(g, x, y, 0.12 * s, 0.09 * s, 0, 'rgba(255,190,225,0.82)'); fc(g, x - 0.12 * s, y - 0.02, 0.03, 'rgba(255,190,225,0.82)'); fe(g, x - 0.04, y - 0.035, 0.03, 0.016, -0.4, 'rgba(255,255,255,0.9)');
      g.fillStyle = 'rgba(255,255,255,0.0)';
    },
    wrench(g, sp, t) {
      const gx = sp.geo.sh.cx + sp.geo.sh.x + 0.32, gy = sp.geo.sh.y + 0.02; gear(g, gx, gy, 0.1, P.v * 1.6, '#9aa7b4'); gear(g, gx + 0.09, gy + 0.15, 0.06, -P.v * 2.7, '#e7c35a');
      ln(g, P.hRx, P.hRy, gx - 0.05, gy, 0.032, '#aab4be'); g.strokeStyle = '#aab4be'; g.lineWidth = 0.028; g.beginPath(); g.arc(gx - 0.05, gy, 0.035, -0.9, 0.9); g.stroke();
      if ((P.v * 1.3) % 1 < 0.15) { spark(g, gx + 0.08, gy - 0.1, 0.03, '#ffe27a'); spark(g, gx + 0.13, gy - 0.04, 0.02, '#ffe27a'); }
    },
    screwdriver(g, sp, t) {
      const gx = sp.geo.sh.cx + sp.geo.sh.x + 0.3, gy = sp.geo.sh.y + 0.02; gear(g, gx, gy, 0.09, P.v * 3, '#9aa7b4');
      ln(g, P.hRx, P.hRy, gx - 0.02, gy, 0.014, '#c0c7cf'); ln(g, P.hRx - 0.03, P.hRy, P.hRx + 0.05, P.hRy, 0.04, '#e05a4f');
    },
    mop(g, sp, t) {
      const gx = sp.geo.sh.cx + 0.5 + 0.15 * Math.sin(P.v * 3.4); bubbles(g, gx, G0 - 0.08, t, 0.8, 4, 'rgba(170,215,255,0.9)', 0.4, 0.08);
      ln(g, P.hRx - 0.06, P.hRy - 0.06, gx, G0 - 0.06, 0.03, '#7aa7c7');
      g.strokeStyle = '#f4ecdc'; g.lineWidth = 0.025; g.beginPath(); for (let i = -3; i <= 3; i++) { g.moveTo(gx, G0 - 0.07); g.quadraticCurveTo(gx + i * 0.03, G0 - 0.03, gx + i * 0.04 + Math.sin(t * 8 + i) * 0.01, G0 + 0.01); } g.stroke();
    },
    shakejar(g, sp, t) { jar(g, (P.hRx + P.hLx) / 2 + 0.06, (P.hRy + P.hLy) / 2 - 0.06 + Math.sin(P.v * 18) * 0.04, 1.15, t, true); },
    watering(g, sp, t) {
      const sx = sp.geo.sh.cx + 0.62; seedling(g, sx, G0, 0.8 + 0.25 * Math.sin(P.v * 0.8), t);
      const x = P.hRx + 0.05, y = P.hRy; g.save(); g.translate(x, y); g.rotate(0.35 + 0.1 * Math.sin(P.v * 2));
      rrf(g, -0.07, -0.06, 0.14, 0.11, 0.035, '#86c2ae'); ln(g, 0.06, 0.0, 0.17, -0.06, 0.022, '#86c2ae'); fe(g, 0.18, -0.065, 0.02, 0.03, 0.5, '#6aa894'); g.strokeStyle = '#6aa894'; g.lineWidth = 0.016; g.beginPath(); g.arc(-0.04, -0.06, 0.05, PI, PI * 1.8); g.stroke();
      g.restore();
      for (let i = 0; i < 4; i++) { const u = (t * 1.8 + i / 4) % 1; fe(g, x + 0.17 + u * 0.06, y + 0.04 + u * (G0 - y - 0.12), 0.01, 0.018, 0, 'rgba(140,200,255,' + (1 - u * 0.6) + ')'); }
    },
    bottle(g, sp, t) {
      const F = sp.geo.face, mx = F.x + 0.03, my = F.y + 0.14; g.save(); g.translate(mx + 0.02, my); g.rotate(-0.85);
      rrf(g, 0.03, -0.045, 0.2, 0.09, 0.04, 'rgba(240,250,255,0.9)'); rrf(g, 0.09, -0.04, 0.13, 0.08, 0.035, '#fffaf0'); rrf(g, 0.0, -0.05, 0.05, 0.1, 0.02, '#ffc2d1'); fe(g, -0.01, 0, 0.03, 0.025, 0, '#f6d29a');
      g.restore();
    },
    flaskWork(g, sp, t) { },
    mortar(g, sp, t) {
      const bx = sp.geo.sh.cx + 0.22, by = sp.geo.sh.y + 0.24; for (let i = 0; i < 3; i++) { const u = (t * 0.8 + i / 3) % 1; spark(g, bx + Math.sin(i * 2 + u * 4) * 0.1, by - 0.06 - u * 0.3, 0.025 * (1 - u), 'rgba(214,170,255,' + (1 - u) + ')'); }
      fe(g, bx, by - 0.01, 0.15, 0.04, 0, '#6f6a78'); fe(g, bx, by - 0.005, 0.12, 0.028, 0, '#cbb6f0');
      const px = bx + Math.cos(P.v * 5) * 0.05; ln(g, P.hRx, P.hRy, px, by - 0.02, 0.04, '#d8d2dc');
      g.fillStyle = '#9b95a5'; g.beginPath(); g.moveTo(bx - 0.15, by); g.quadraticCurveTo(bx - 0.14, by + 0.15, bx, by + 0.15); g.quadraticCurveTo(bx + 0.14, by + 0.15, bx + 0.15, by); g.closePath(); g.fill();
      fe(g, bx - 0.07, by + 0.05, 0.02, 0.04, 0.4, 'rgba(255,255,255,0.25)');
    },
    testtube(g, sp, t) {
      const x = P.hRx, y = P.hRy - 0.04; g.save(); g.translate(x, y); g.rotate(0.25);
      rrf(g, -0.03, -0.18, 0.06, 0.22, 0.03, 'rgba(235,250,255,0.85)'); rrf(g, -0.026, -0.06, 0.052, 0.095, 0.026, hsl(320 + Math.sin(t * 2) * 30, 75, 68)); ln(g, -0.04, -0.18, 0.04, -0.18, 0.016, '#c8d2dc');
      fe(g, -0.012, -0.08, 0.006, 0.04, 0, 'rgba(255,255,255,0.8)'); g.restore();
      const u = (t * 1.2) % 1; spark(g, x + 0.1, y - 0.18, 0.04 * Math.sin(u * PI), '#fff3a8'); spark(g, x - 0.06, y - 0.22, 0.025 * Math.sin(((u + 0.5) % 1) * PI), '#fff3a8');
    },
    jumprope(g, sp, t) {
      const ph = P.v, c = Math.cos(ph), cy = lerp(-1.35, 0.22, (c + 1) / 2) + P.bob, front = Math.sin(ph) > 0;
      g.strokeStyle = front ? '#ff6b6b' : 'rgba(255,107,107,0.45)'; g.lineWidth = 0.022; g.beginPath(); g.moveTo(P.hLx, P.hLy); g.bezierCurveTo(P.hLx - 0.15, cy, P.hRx + 0.15, cy, P.hRx, P.hRy); g.stroke();
      for (const h of [[P.hLx, P.hLy], [P.hRx, P.hRy]]) rrf(g, h[0] - 0.02, h[1] - 0.06, 0.04, 0.09, 0.02, '#ffd34d');
    },
    puff(g, sp, t) { },
    carry(g, sp, t, inst) { const x = (P.hRx + P.hLx) / 2 + 0.06, y = (P.hRy + P.hLy) / 2 + 0.06; g.save(); g.translate(x, y); g.scale(1.45, 1.45); carryItem(g, inst.carrying || 'butyrate', 0, 0, t); g.restore(); },
    eat(g, sp, t) {
      const F = sp.geo.face, s = 1 - ((P.at * 0.5) % 1) * 0.5; const x = F.x + 0.12, y = F.y + 0.18;
      g.save(); g.translate(x, y); g.rotate(-0.3); rrf(g, -0.08 * s, -0.04, 0.16 * s, 0.08, 0.035, '#d8b071'); fc(g, -0.02, -0.01, 0.012, '#7cc46a'); fc(g, 0.03 * s, 0.01, 0.01, '#7cc46a'); g.restore();
      if ((P.at * 4) % 1 < 0.5) { fc(g, x - 0.05, y + 0.12, 0.01, '#d8b071'); fc(g, x + 0.04, y + 0.16, 0.008, '#d8b071'); }
    },
  };
  function drop(g, x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(0, -0.08); g.quadraticCurveTo(0.055, -0.01, 0.045, 0.02); g.arc(0, 0.02, 0.045, 0, PI); g.quadraticCurveTo(-0.055, -0.01, 0, -0.08); g.fill(); fe(g, -0.015, 0.0, 0.009, 0.018, -0.3, 'rgba(220,200,160,0.6)'); g.restore(); }

  /* ---------------- face ---------------- */
  function blinkOpen(t, ph, per) { const u = (t + ph * 3.1) % per; return u < 0.15 ? Math.abs(u - 0.075) / 0.075 : 1; }
  function eyeShape(g, x, y, er, open, lid, style, tint) {
    const rx = er * (style === 'baby' ? 0.86 : 0.78), ry = er * open;
    if (lid > 0) {
      const yl = y - ry + 2 * ry * lid, th = Math.asin(clamp((yl - y) / ry, -1, 1));
      g.fillStyle = INK; g.beginPath(); g.ellipse(x, y, rx, ry, 0, th, PI - th); g.quadraticCurveTo(x, yl - er * 0.3, x + rx * Math.cos(th), yl); g.closePath(); g.fill();
      g.strokeStyle = INK; g.lineWidth = er * 0.13; g.beginPath(); g.moveTo(x - rx * Math.cos(th) - er * 0.14, yl + er * 0.14); g.quadraticCurveTo(x, yl - er * 0.34, x + rx * Math.cos(th) + er * 0.14, yl + er * 0.14); g.stroke();
      fe(g, x, y + ry * 0.45, rx * 0.62, ry * 0.32, 0, tint);
      fc(g, x - er * 0.24, Math.max(yl + er * 0.22, y - ry * 0.3), er * 0.24, '#fff'); fc(g, x + er * 0.28, y + ry * 0.4, er * 0.11, '#fff');
      return;
    }
    fe(g, x, y, rx, ry, 0, INK);
    fe(g, x, y + ry * 0.42, rx * 0.66, ry * 0.36, 0, tint);
    const hr = style === 'baby' ? 0.4 : style === 'wide' ? 0.36 : 0.32;
    fc(g, x - er * 0.25, y - ry * 0.34, er * hr, '#fff'); fc(g, x + er * 0.28, y + ry * 0.3, er * 0.13, '#fff');
    if (style === 'sparkle' || style === 'baby') spark(g, x + er * 0.26, y - ry * 0.42, er * 0.2, '#fff');
    if (style === 'baby') fc(g, x - er * 0.05, y + ry * 0.55, er * 0.08, 'rgba(255,255,255,0.8)');
  }
  function drawFace(g, sp, inst, ox, sc, eyesOverride) {
    const t = inst.t || 0, ph = inst.phase || 0, F = sp.geo.face, s = F.s * sc * (sp.eyeSize || 1);
    let er = 0.1 * s; if (sp.eye === 'baby') er *= 1.18; if (sp.eye === 'wide') er *= 1.06;
    const gap = 0.165 * s, lx = P.lx, ly = P.ly;
    const fx = F.x * sc + ox + lx * 0.025 * s, fy = F.y * sc + ly * 0.018 * s;
    const ex = lx * er * 0.32, ey = ly * er * 0.25;
    const hungry = !!inst.hungry && P.eyes !== 1;
    const mood = inst.mood == null ? 0.5 : inst.mood;
    // blush
    g.globalAlpha = clamp(0.55 + mood * 0.35, 0, 1);
    for (const sd of [-1, 1]) g.drawImage(BLUSH, fx + sd * gap * 1.42 - er * 1.05 + ex * 0.4, fy + er * 1.15 - er * 0.75, er * 2.1, er * 1.5);
    g.globalAlpha = 1;
    const eyes = eyesOverride != null ? eyesOverride : P.eyes;
    g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const x = fx + sd * gap + ex, y = fy + ey;
      if (eyes === 2) { g.strokeStyle = INK; g.lineWidth = er * 0.32; g.beginPath(); g.arc(x, y + er * 0.38, er * 0.62, PI * 1.15, PI * 1.85); g.stroke(); continue; }
      if (eyes === 1) { g.strokeStyle = INK; g.lineWidth = er * 0.26; g.beginPath(); g.arc(x, y - er * 0.15, er * 0.55, PI * 0.15, PI * 0.85); g.stroke(); continue; }
      if (eyes === 3) { g.strokeStyle = INK; g.lineWidth = er * 0.26; g.beginPath(); g.moveTo(x - sd * er * 0.45, y - er * 0.4); g.lineTo(x + sd * er * 0.35, y); g.lineTo(x - sd * er * 0.45, y + er * 0.4); g.stroke(); continue; }
      let open = blinkOpen(t, ph, sp.blinkPer), lid = 0;
      if (sp.eye === 'sleepy') { lid = 0.27; open *= 0.95; const sl = (t * 0.35 + ph) % 4; if (sl < 0.8) open *= 0.25 + 0.75 * Math.abs(sl - 0.4) / 0.4; }
      else if (sp.eye === 'lazy') lid = 0.3;
      else if (sp.eye === 'content') lid = 0.14;
      else if (sp.eye === 'cheeky' && sd < 0 && ((t + ph) % 5) < 0.7) { g.strokeStyle = INK; g.lineWidth = er * 0.3; g.beginPath(); g.arc(x, y + er * 0.38, er * 0.62, PI * 1.15, PI * 1.85); g.stroke(); continue; }
      if (open < 0.22) { g.strokeStyle = INK; g.lineWidth = er * 0.24; g.beginPath(); g.moveTo(x - er * 0.6, y); g.quadraticCurveTo(x, y + er * 0.28, x + er * 0.6, y); g.stroke(); }
      else eyeShape(g, x, y, er, open, lid, sp.eye, sp.col.tint);
      if (sp.eye === 'lash') { g.strokeStyle = INK; g.lineWidth = er * 0.16; g.beginPath(); g.moveTo(x + sd * er * 0.62, y - er * 0.55 * open); g.lineTo(x + sd * er * 0.95, y - er * 0.85 * open); g.moveTo(x + sd * er * 0.35, y - er * 0.8 * open); g.lineTo(x + sd * er * 0.5, y - er * 1.12 * open); g.stroke(); }
      if (sp.eye === 'cheeky' && sd > 0 && !hungry) { g.strokeStyle = INK; g.lineWidth = er * 0.18; g.beginPath(); g.moveTo(x - er * 0.5, y - er * 1.45); g.quadraticCurveTo(x, y - er * 1.9, x + er * 0.55, y - er * 1.6); g.stroke(); }
    }
    if (hungry) { // worried little brows
      g.strokeStyle = 'rgba(43,29,38,0.75)'; g.lineWidth = er * 0.17;
      for (const sd of [-1, 1]) { const x = fx + sd * gap + ex, y = fy + ey - er * 1.3; g.beginPath(); g.moveTo(x - sd * er * 0.5, y - er * 0.25); g.lineTo(x + sd * er * 0.45, y + er * 0.05); g.stroke(); }
    }
    if (sp.faceX) for (const n of sp.faceX) FX_FACE[n](g, sp, fx + ex * 0.5, fy + ey * 0.5, er, gap, P, t);
    // mouth
    const mx = fx + ex * 0.6, my = fy + er * 1.55 + ey * 0.5, mw = er * 0.8;
    if (sp.faceX && sp.faceX[0] === 'pacifier' && P.mouth !== 1 && P.mouth !== 2 && P.hold !== 'bottle' && P.hold !== 'eat') return;
    const m = P.mouth;
    g.lineWidth = er * 0.19; g.strokeStyle = INK;
    if (m === 2) { const o = Math.abs(Math.sin(t * 16)); fe(g, mx, my + er * 0.15, mw * 0.36, er * (0.1 + 0.32 * o), 0, MOUTH); }
    else if (m === 3) { const w = 1 + Math.sin(t * 7) * 0.12; fe(g, mx, my + er * 0.2, er * 0.24 * w, er * 0.3 / w, 0, MOUTH); }
    else if (m === 4) { fe(g, mx, my + er * 0.1, er * 0.16, er * 0.12, 0, MOUTH); }
    else if (m === 1 || sp.mouth === 'open' || sp.mouth === 'grin') {
      const big = m === 1 ? 1.15 : 0.95, w = mw * big * (sp.mouth === 'grin' ? 1.15 : 1);
      g.fillStyle = MOUTH; g.beginPath(); g.moveTo(mx - w / 2, my - er * 0.05); g.quadraticCurveTo(mx, my + er * 1.15 * big, mx + w / 2, my - er * 0.05); g.closePath(); g.fill();
      fe(g, mx, my + er * 0.45 * big, w * 0.22, er * 0.16, 0, TONGUE);
      if (sp.mouth === 'grin') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(mx - w * 0.3, my); g.lineTo(mx - w * 0.16, my + er * 0.3); g.lineTo(mx - w * 0.04, my + 0.002); g.closePath(); g.fill(); }
    } else if (sp.mouth === 'cat') {
      g.beginPath(); g.arc(mx - mw * 0.22, my, mw * 0.24, 0.1, PI - 0.1); g.moveTo(mx + mw * 0.46, my); g.arc(mx + mw * 0.22, my, mw * 0.24, 0.1, PI - 0.1); g.stroke();
    } else if (sp.mouth === 'smirk') {
      g.beginPath(); g.moveTo(mx - mw / 2, my + er * 0.05); g.quadraticCurveTo(mx - mw * 0.05, my + er * (0.5 + mood * 0.2), mx + mw / 2, my - er * 0.2); g.stroke();
    } else {
      g.beginPath(); g.moveTo(mx - mw / 2, my); g.quadraticCurveTo(mx, my + er * (0.45 + mood * 0.3), mx + mw / 2, my); g.stroke();
    }
  }

  /* ---------------- character drawing ---------------- */
  function drawFeet(g, sp, sx) {
    const c = sp.col, F = sp.geo.feet, n = F.length;
    for (let i = 0; i < n; i++) {
      const lift = i % 2 ? P.fR : P.fL, x = F[i] * (sx || 1), y = FOOT - 0.045 - lift;
      if (sp.sneakers) { fe(g, x + 0.02, y, 0.115, 0.06, 0, '#fdfdfd'); fe(g, x + 0.02, y + 0.035, 0.115, 0.018, 0, '#ef5b5b'); g.strokeStyle = '#4aa3df'; g.lineWidth = 0.018; g.beginPath(); g.moveTo(x - 0.05, y + 0.005); g.quadraticCurveTo(x + 0.02, y + 0.02, x + 0.08, y - 0.02); g.stroke(); continue; }
      const sm = n > 2 && i >= 2 ? 0.75 : 1;
      fe(g, x, y, 0.1 * sm, 0.058 * sm, 0, c.foot); fe(g, x - 0.02, y - 0.02, 0.045 * sm, 0.02 * sm, 0, c.footHi);
    }
  }
  function drawArms(g, sp) {
    const S = sp.geo.sh, c = sp.col, w = 0.115;
    g.lineCap = 'round';
    for (const side of [-1, 1]) {
      const x0 = S.cx + side * S.x, y0 = S.y, hx = side > 0 ? P.hRx : P.hLx, hy = side > 0 ? P.hRy : P.hLy;
      ln(g, x0 + (hx - x0) * 0.25, y0 + (hy - y0) * 0.25, hx, hy, w, c.arm);
      fc(g, hx - 0.012, hy - 0.014, w * 0.22, c.armHi);
    }
  }
  function drawCore(g, sp, inst, spr, ox, sc, eyes) { // feet + body + face (used for divide too)
    g.save(); g.translate(ox, 0); g.scale(sc, sc);
    drawFeet(g, sp);
    g.translate(0, -FOOT);
    g.drawImage(spr.c, spr.x, spr.y, spr.w, spr.h);
    drawFace(g, sp, inst, 0, 1, eyes);
    g.restore();
  }
  function zzz(g, x, y, t) {
    g.strokeStyle = 'rgba(90,110,160,0.8)'; g.lineWidth = 0.022;
    for (let i = 0; i < 3; i++) { const u = (t * 0.45 + i / 3) % 1, s = 0.04 + u * 0.05, zx = x + u * 0.25 + Math.sin(u * 6) * 0.03, zy = y - u * 0.45; g.globalAlpha = Math.sin(u * PI); g.beginPath(); g.moveTo(zx - s, zy - s); g.lineTo(zx + s, zy - s); g.lineTo(zx - s, zy + s); g.lineTo(zx + s, zy + s); g.stroke(); }
    g.globalAlpha = 1;
  }
  function notes(g, x, y, t) {
    for (let i = 0; i < 2; i++) { const u = (t * 0.5 + i / 2) % 1, nx = x + u * 0.2 + Math.sin(u * 7) * 0.04, ny = y - u * 0.4; g.globalAlpha = Math.sin(u * PI); fe(g, nx, ny, 0.03, 0.022, -0.4, '#5c4b8a'); ln(g, nx + 0.025, ny, nx + 0.025, ny - 0.09, 0.012, '#5c4b8a'); ln(g, nx + 0.025, ny - 0.09, nx + 0.06, ny - 0.07, 0.012, '#5c4b8a'); }
    g.globalAlpha = 1;
  }

  function drawChar(g, sp, inst, spr, shadow) {
    const t = inst.t || 0, act = inst.activity || 'idle', at = inst.activityT || 0;
    const c = inst._c || (inst._c = { face: 1 });
    const dx = inst.dirX || 0; if (dx > 0.15) c.face = 1; else if (dx < -0.15) c.face = -1;
    pose(sp, inst);
    const geo = sp.geo, bb = geo.M.bbox, lift = (inst.lift || 0) / UNIT;
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (shadow) {
      const k = 1 - Math.min(0.5, (lift + P.bob) * 1.6), cx = (bb[0] + bb[2]) / 2 * c.face, w = (bb[2] - bb[0]) / 2 * 0.95;
      if (inst.selected) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 0.03; g.beginPath(); g.ellipse(cx, 0.02, w + 0.12, (w + 0.12) * 0.3, 0, 0, TAU); g.stroke(); fe(g, cx, 0.02, w + 0.12, (w + 0.12) * 0.3, 0, 'rgba(255,240,200,0.35)'); }
      fe(g, cx, 0.015, w * k, w * 0.26 * k, 0, 'rgba(46,34,40,0.2)');
    }
    g.save();
    g.translate(P.jx, -lift - P.bob);
    if (c.face < 0) g.scale(-1, 1);
    g.rotate(P.tilt);
    g.scale((inst.sqx || 1) * P.sx, (inst.sqy || 1) * P.sy);
    if (act === 'divide') {
      const p = clamp(at / 1.2, 0, 1), hw = (bb[2] - bb[0]) / 2, cx = (bb[0] + bb[2]) / 2;
      if (p < 0.35) { const q = ss(0, 0.35, p); g.scale(1 + 0.16 * q + Math.sin(at * 34) * 0.025 * q, 1 - 0.07 * q); drawCore(g, sp, inst, spr, 0, 1, 3); }
      else {
        const q = ss(0.35, 1, p), d = hw * 0.62 * q, s2 = 1 - 0.2 * q;
        drawCore(g, sp, inst, spr, -d - cx * s2 + cx, s2, q > 0.75 ? 2 : 3); drawCore(g, sp, inst, spr, d - cx * s2 + cx, s2, q > 0.75 ? 2 : 3);
        if (p > 0.8) { const u = (p - 0.8) * 5; g.globalAlpha = 1 - u; spark(g, cx, bb[1] - 0.1 - u * 0.15, 0.08, '#fff6c8'); spark(g, cx - 0.2, bb[1] + 0.05 - u * 0.1, 0.05, '#fff6c8'); spark(g, cx + 0.22, bb[1] + 0.1 - u * 0.1, 0.05, '#fff6c8'); g.globalAlpha = 1; }
      }
      g.restore(); return;
    }
    drawFeet(g, sp);
    g.translate(0, -FOOT);
    if (sp.back) for (const n of sp.back) BACK[n](g, sp, P, t);
    g.drawImage(spr.c, spr.x, spr.y, spr.w, spr.h);
    if (sp.front) for (const n of sp.front) FRONT[n](g, sp, P, t);
    drawFace(g, sp, inst, 0, 1, null);
    if (sp.head) for (const n of sp.head) HAT[n](g, sp, P, t);
    if (P.hold && HOLD[P.hold]) HOLD[P.hold](g, sp, t, inst);
    drawArms(g, sp);
    // species ambient effects
    const T = geo.top;
    if (sp.fx === 'puffs') puffs(g, T.x + 0.1, T.y - 0.05, t, P.work ? 0.9 : 0.35, P.work ? 3 : 2, P.work ? 0.6 : 0.45);
    else if (sp.fx === 'bubbles') { const F = geo.face; bubbles(g, F.x + 0.24, F.y + 0.06, t, P.work ? 0.9 : 0.45, P.work ? 5 : 3, 'rgba(212,228,110,0.95)', 0.55, 0.06); }
    else if (sp.fx === 'twinkle') { for (let i = 0; i < 3; i++) { const u = (t * 0.6 + i / 3) % 1, a = i * 2.1 + 0.6; spark(g, Math.cos(a) * 0.36, T.y + 0.3 + Math.sin(a) * 0.45, 0.045 * Math.sin(u * PI), 'rgba(255,246,190,0.95)'); } }
    else if (sp.fx === 'notes' && act !== 'sleep') notes(g, 0.3, T.y + 0.05, t);
    g.restore();
    // un-mirrored effects
    if (P.zzz) zzz(g, 0.18, -lift - P.bob - FOOT + bb[1] + 0.05, t);
    if (P.party) { g.fillStyle = '#ffe48a'; for (let i = 0; i < 5; i++) { const u = (t * 0.9 + i / 5) % 1, a = i * 1.26 - PI / 2; spark(g, Math.cos(a) * (0.45 + u * 0.2), -0.5 + Math.sin(a) * (0.5 + u * 0.2) - u * 0.2 - lift - P.bob, 0.06 * Math.sin(u * PI)); } }
    if (inst.hungry && act !== 'sleep') { const u = (t * 1.3) % 1; g.strokeStyle = 'rgba(120,90,80,' + (0.6 * Math.sin(u * PI)).toFixed(2) + ')'; g.lineWidth = 0.016; for (const sd of [-1, 1]) { const x = sd * ((bb[2] - bb[0]) / 2 + 0.08), y = -0.3 - lift; g.beginPath(); g.moveTo(x, y - 0.06); g.quadraticCurveTo(x + sd * 0.04, y - 0.03, x, y); g.quadraticCurveTo(x - sd * 0.04, y + 0.03, x, y + 0.06); g.stroke(); } }
  }

  /* ---------------- build ---------------- */
  let UNIT = 48, DPR = 1, BUILT = false, K = 64;
  function buildSprite(sp, k) {
    const geo = sp.geo, M = geo.M, pad = 0.32;
    const x0 = M.bbox[0] - pad, y0 = M.bbox[1] - pad, x1 = M.bbox[2] + pad, y1 = M.bbox[3] + pad;
    const c = mk((x1 - x0) * k, (y1 - y0) * k), g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    const deco = { under: null, over: null, post: null }, list = sp.deco || [];
    const u = [], o = [], p = [];
    for (const d of list) { if (d[0] === '|') p.push(DECO[d.slice(1)]); else if (d === 'belly') o.push(DECO[d]); else u.push(DECO[d]); }
    deco.under = (...a) => u.forEach((f) => f(...a)); deco.over = (...a) => o.forEach((f) => f(...a)); deco.post = (...a) => p.forEach((f) => f(...a));
    const dens = clamp(Math.sqrt(k / 70), 0.8, 2.2);
    paintFur(g, geo.path, M, sp.col.h, sp.col.s, sp.col.l, FUR[sp.fur], rng(sp.seed), k, dens, deco, geo);
    return { c, x: x0, y: y0, w: c.width / k, h: c.height / k, k };
  }
  function build(unit, dpr) {
    const t0 = performance.now();
    UNIT = unit || UNIT; DPR = dpr || (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1;
    if (!GLOW) makeShared();
    K = Math.min(UNIT * DPR * 1.35, 240);
    for (const id in SPX) {
      const sp = SPX[id];
      if (!sp.geo.M) sp.geo.M = analyse(sp.geo, 64);
      sp.spr = buildSprite(sp, K); sp.port = null;
    }
    if (!FL.spr || FL.spr.k < 200 * DPR) buildFlora(Math.min(260 * DPR, 700));
    BUILT = true;
    api.buildMs = performance.now() - t0;
    return api.buildMs;
  }
  function ensure() { if (!BUILT) build(UNIT, DPR); }

  /* ---------------- Flora ---------------- */
  const FL = { spr: null, geo: null, M: null, col: { h: 140, s: 26, l: 70 } };
  function floraGeo() {
    const p = new Path2D(); pE(p, 0, -0.33, 0.37, 0.31); pRR(p, -0.31, -0.3, 0.62, 0.3, 0.16);
    return { path: p, ext: [-0.38, -0.65, 0.38, 0] };
  }
  function buildFlora(k) {
    if (!FL.geo) { FL.geo = floraGeo(); FL.M = analyse(FL.geo, 220); }
    const M = FL.M, pad = 0.12, x0 = M.bbox[0] - pad, y0 = M.bbox[1] - pad, x1 = M.bbox[2] + pad, y1 = M.bbox[3] + pad;
    const c = mk((x1 - x0) * k, (y1 - y0) * k), g = c.getContext('2d'); g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    const deco = {
      under: null,
      over(g2, M2, h, s, l) { fe(g2, 0.02, -0.17, 0.2, 0.12, 0, 'rgba(250,255,245,0.18)'); },
      post: null,
    };
    paintFur(g, FL.geo.path, M, FL.col.h, FL.col.s, FL.col.l, FUR.flora, rng(777), k, clamp(Math.sqrt(k / 400), 0.7, 1.6), deco, FL.geo);
    FL.spr = { c, x: x0, y: y0, w: c.width / k, h: c.height / k, k };
  }
  function drawFlora(g, cx, cy, size, st) {
    ensure(); st = st || {};
    const need = size * DPR; if (!FL.spr || FL.spr.k < need * 0.9) buildFlora(Math.min(need * 1.1, 1400));
    const t = st.t || 0, mood = st.mood || 'happy', talk = !!st.talking;
    const lookX = clamp(st.lookX || 0, -1, 1), lookY = clamp(st.lookY || 0, -1, 1);
    const exc = mood === 'excited', cur = mood === 'curious', thk = mood === 'thinking';
    g.save(); g.translate(cx, cy + size * 0.43); g.scale(size, size); g.lineCap = 'round'; g.lineJoin = 'round';
    const bob = exc ? Math.abs(Math.sin(t * 6)) * 0.035 : Math.sin(t * 1.3) * 0.004;
    const br = Math.sin(t * 2) * 0.014;
    fe(g, 0, 0.01, 0.3 * (1 - bob * 3), 0.04 * (1 - bob * 3), 0, 'rgba(61,90,72,0.13)');
    g.translate(0, -bob);
    g.rotate((cur ? 0.075 : thk ? -0.045 : 0) + Math.sin(t * 0.8) * 0.012);
    g.scale(1 + br, 1 - br);
    // feet
    for (const sd of [-1, 1]) { fe(g, sd * 0.13, -0.008, 0.075, 0.04, 0, '#6f9279'); fe(g, sd * 0.13 - 0.015, -0.02, 0.035, 0.014, 0, '#90b19a'); }
    g.translate(0, -0.02);
    // sprout (behind the top fur)
    const sw = Math.sin(t * 1.7) * 0.06 + (exc ? Math.sin(t * 9) * 0.05 : 0) + (cur ? 0.08 : 0);
    g.save(); g.translate(0.01, -0.6); g.rotate(sw); g.scale(1.3, 1.3);
    g.strokeStyle = '#4f7a5c'; g.lineWidth = 0.016; g.beginPath(); g.moveTo(0, 0.04); g.quadraticCurveTo(0.012, -0.05, 0.0, -0.11); g.stroke();
    g.fillStyle = '#5A7A66'; g.beginPath(); g.moveTo(0, -0.08); g.quadraticCurveTo(-0.07, -0.14, -0.13, -0.09); g.quadraticCurveTo(-0.07, -0.04, 0, -0.08); g.fill();
    g.fillStyle = '#7fa88a'; g.beginPath(); g.moveTo(0, -0.095); g.quadraticCurveTo(0.07, -0.17, 0.14, -0.12); g.quadraticCurveTo(0.08, -0.06, 0, -0.095); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.005; g.beginPath(); g.moveTo(-0.01, -0.085); g.quadraticCurveTo(-0.06, -0.11, -0.11, -0.095); g.moveTo(0.01, -0.1); g.quadraticCurveTo(0.07, -0.135, 0.12, -0.12); g.stroke();
    // tiny flower
    const fx0 = 0.0, fy0 = -0.125; g.fillStyle = '#fffaf2'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + t * 0.2; g.beginPath(); g.arc(fx0 + Math.cos(a) * 0.022, fy0 + Math.sin(a) * 0.022, 0.017, 0, TAU); g.fill(); }
    fc(g, fx0, fy0, 0.013, '#f6c86a');
    g.restore();
    // arms (behind body edges)
    let aR = 0.35 + Math.sin(t * 1.5) * 0.05, aL = 0.35 + Math.sin(t * 1.5 + 1) * 0.05;
    if (talk) aR = 0.8 + Math.sin(t * 4) * 0.35;
    if (exc) { aR = 2.5 + Math.sin(t * 12) * 0.3; aL = 2.5 + Math.sin(t * 12 + 1.5) * 0.3; }
    if (thk) aR = 2.35;
    const shy = -0.22, shx = 0.335, AL = 0.075;
    const armCol = '#9cc4a6', armHi = '#c6e0cb';
    // body
    g.drawImage(FL.spr.c, FL.spr.x, FL.spr.y, FL.spr.w, FL.spr.h);
    // face
    const fx = lookX * 0.03, fy = -0.36 + lookY * 0.02, er = 0.078, gap = 0.13, ex = lookX * er * 0.3, ey = lookY * er * 0.28;
    g.globalAlpha = exc ? 0.95 : 0.75; for (const sd of [-1, 1]) g.drawImage(BLUSH, fx + sd * gap * 1.42 - er * 1.1, fy + er * 1.35 - er * 0.75, er * 2.2, er * 1.5); g.globalAlpha = 1;
    let open = blinkOpen(t, 0.4, 3.7);
    const tint = 'rgba(96,150,112,0.75)';
    for (const sd of [-1, 1]) {
      const x = fx + sd * gap + ex, y = fy + ey;
      if (exc && Math.sin(t * 2.5) > 0.3) { g.strokeStyle = '#24302A'; g.lineWidth = er * 0.3; g.beginPath(); g.arc(x, y + er * 0.38, er * 0.62, PI * 1.15, PI * 1.85); g.stroke(); continue; }
      if (open < 0.22) { g.strokeStyle = '#24302A'; g.lineWidth = er * 0.24; g.beginPath(); g.moveTo(x - er * 0.6, y); g.quadraticCurveTo(x, y + er * 0.3, x + er * 0.6, y); g.stroke(); continue; }
      const ry = er * open * (thk ? 0.92 : 1), rx = er * 0.8;
      fe(g, x, y, rx, ry, 0, '#24302A');
      fe(g, x, y + ry * 0.42, rx * 0.66, ry * 0.36, 0, tint);
      const hx = thk ? 0.15 : 0, hy = thk ? -0.15 : 0;
      fc(g, x - er * 0.24 + hx * er, y - ry * 0.34 + hy * er, er * 0.34, '#fff'); fc(g, x + er * 0.3, y + ry * 0.32, er * 0.13, '#fff');
      if (exc) spark(g, x + er * 0.28, y - ry * 0.45, er * 0.24, '#fff');
    }
    // brows for curious / thinking
    if (cur || thk) { g.strokeStyle = 'rgba(36,48,42,0.7)'; g.lineWidth = er * 0.16; const x = fx + gap + ex, y = fy + ey - er * 1.5; g.beginPath(); g.moveTo(x - er * 0.5, y + er * 0.1); g.quadraticCurveTo(x, y - er * 0.35, x + er * 0.55, y); g.stroke(); }
    // mouth
    const mx = fx + ex * 0.6, my = fy + er * 1.7 + ey * 0.5, mw = er * 0.95;
    if (talk) {
      const o = clamp(Math.abs(Math.sin(t * 13) * Math.sin(t * 5.1 + 0.6)) * 1.3, 0.12, 1);
      g.fillStyle = '#5b2a36'; g.beginPath(); g.moveTo(mx - mw * 0.45, my); g.quadraticCurveTo(mx, my - er * 0.12, mx + mw * 0.45, my); g.quadraticCurveTo(mx, my + er * (0.25 + 0.95 * o), mx - mw * 0.45, my); g.fill();
      if (o > 0.4) fe(g, mx, my + er * (0.15 + 0.55 * o), mw * 0.2, er * 0.12 * o, 0, '#ff9aae');
    } else if (exc) {
      g.fillStyle = '#5b2a36'; g.beginPath(); g.moveTo(mx - mw * 0.55, my - er * 0.05); g.quadraticCurveTo(mx, my + er * 1.3, mx + mw * 0.55, my - er * 0.05); g.closePath(); g.fill(); fe(g, mx, my + er * 0.55, mw * 0.24, er * 0.18, 0, '#ff9aae');
    } else if (cur) { fe(g, mx + er * 0.1, my + er * 0.2, er * 0.2, er * 0.24, 0, '#5b2a36'); }
    else if (thk) { g.strokeStyle = '#24302A'; g.lineWidth = er * 0.18; g.beginPath(); g.moveTo(mx - mw * 0.35, my + er * 0.15); g.quadraticCurveTo(mx + mw * 0.05, my + er * 0.4, mx + mw * 0.4, my + er * 0.05); g.stroke(); }
    else { g.strokeStyle = '#24302A'; g.lineWidth = er * 0.18; g.beginPath(); g.moveTo(mx - mw / 2, my); g.quadraticCurveTo(mx, my + er * 0.7, mx + mw / 2, my); g.stroke(); }
    // arms in front
    for (const sd of [-1, 1]) {
      const a = sd > 0 ? aR : aL, x0 = sd * shx, hx = x0 + sd * AL * Math.sin(a), hy = shy + AL * Math.cos(a);
      let tx = hx, ty = hy; if (thk && sd > 0) { tx = x0 - 0.04; ty = shy - 0.09; }
      ln(g, x0 + (tx - x0) * 0.3, shy + (ty - shy) * 0.3, tx, ty, 0.075, armCol); fc(g, tx - 0.008, ty - 0.01, 0.016, armHi);
    }
    if (thk) { for (let i = 0; i < 3; i++) { const u = ((t * 0.8) - i * 0.25) % 1.5; if (u > 0 && u < 1) fc(g, 0.33 + i * 0.07, -0.72 - i * 0.05, 0.018 + i * 0.006, 'rgba(90,122,102,' + (0.7 * Math.sin(u * PI)).toFixed(2) + ')'); } }
    if (exc) { for (let i = 0; i < 6; i++) { const u = (t * 0.7 + i / 6) % 1, a = i * 1.05 - PI / 2 + 0.3; spark(g, Math.cos(a) * (0.42 + u * 0.08), -0.35 + Math.sin(a) * (0.38 + u * 0.08), 0.035 * Math.sin(u * PI), i % 2 ? '#f6c86a' : '#ffffff'); } }
    g.restore();
  }

  /* ---------------- public API ---------------- */
  function draw(g, inst, sx, sy, scale) {
    ensure(); const sp = SPX[inst.species]; if (!sp) return;
    const u = UNIT * (scale || 1);
    g.save(); g.translate(sx, sy); g.scale(u, u);
    drawChar(g, sp, inst, sp.spr, true);
    g.restore();
  }
  function tick(inst, dt) {
    const c = inst._c || (inst._c = { face: 1 });
    const dx = inst.dirX || 0; if (dx > 0.15) c.face = 1; else if (dx < -0.15) c.face = -1;
    c.age = (c.age || 0) + (dt || 0);
  }
  function bounds(inst, scale) {
    ensure(); const sp = SPX[inst && inst.species]; const u = UNIT * (scale || 1);
    if (!sp) return { w: u * 0.8, h: u };
    const bb = sp.geo.M.bbox; return { w: (bb[2] - bb[0] + 0.08) * u, h: (FOOT - bb[1] + sp.hatH * 0.6) * u };
  }
  const PINST = { species: '', t: 0, phase: 0.6, activity: 'idle', activityT: 0, dirX: 1, mood: 0.7, hungry: false, lift: 0, sqx: 1, sqy: 1, _c: { face: 1 } };
  function drawPortrait(g, id, cx, cy, size, t) {
    ensure(); const sp = SPX[id]; if (!sp) return;
    const bb = sp.geo.M.bbox, top = bb[1] - FOOT - sp.hatH, bot = FOOT, H = bot - top, W = bb[2] - bb[0] + 0.25;
    const sc = size * 0.86 / Math.max(H, W);
    const need = sc * DPR;
    let spr = sp.spr; if (need > spr.k * 1.05) { if (!sp.port || sp.port.k < need * 0.95) sp.port = buildSprite(sp, Math.min(need * 1.1, 900)); spr = sp.port; }
    PINST.species = id; PINST.t = t || 0; PINST.activityT = t || 0; PINST._c.face = 1;
    g.save(); g.translate(cx - ((bb[0] + bb[2]) / 2) * sc, cy + (H / 2 - bot) * sc); g.scale(sc, sc);
    drawChar(g, sp, PINST, spr, false);
    g.restore();
  }

  const api = {
    PHYLA, SPECIES, build, tick, draw, bounds, drawPortrait, drawFlora, buildMs: 0,
    get unit() { return UNIT; },
  };
  // public species table
  for (const id in SPX) {
    const sp = SPX[id], bb0 = null; void bb0;
    SPECIES[id] = { nick: sp.nick, phylumKey: sp.ph, niche: sp.niche, workStyle: sp.work, scaleHint: 1, look: sp.look,
      color: hslHex(sp.col.h, sp.col.s, clamp(sp.col.l, 0, 100)) };
  }
  // scaleHint from geometry (height in units incl. feet and hats), computed lazily-safe from ext
  for (const id in SPX) { const e = SPX[id].geo.ext; SPECIES[id].scaleHint = Math.round((FOOT - e[1] + SPX[id].hatH * 0.5) * 100) / 100; }
  // roster-derived former phylum names when available
  try { const R = window.FLORA_ROSTER; if (R && R.phyla) for (const k in PHYLA) if (R.phyla[k] && R.phyla[k].formerName && k !== 'desulfobacterota') PHYLA[k].old = R.phyla[k].formerName; } catch (e) { /* roster optional */ }

  window.FloraCast = api;
})();
