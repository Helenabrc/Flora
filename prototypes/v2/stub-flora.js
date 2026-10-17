/* hiflora v2 · stub-flora.js
   TEST STUB ONLY. Stands in for cast.js while it is being written.
   Provides FloraCast.drawFlora(g, cx, cy, size, state) with the contract signature:
   state = { t, talking, mood: 'happy'|'curious'|'thinking'|'excited', lookX, lookY }.
   It never overrides a real FloraCast. */
(function () {
  'use strict';
  if (window.FloraCast && typeof window.FloraCast.drawFlora === 'function') return;

  function drawFlora(g, cx, cy, size, state) {
    state = state || {};
    var t = state.t || 0;
    var mood = state.mood || 'happy';
    var lx = Math.max(-1, Math.min(1, state.lookX || 0));
    var ly = Math.max(-1, Math.min(1, state.lookY || 0));
    var r = size * 0.4;
    var breathe = 1 + Math.sin(t * 1.6) * 0.012;

    g.save();
    g.translate(cx, cy);
    g.scale(breathe, 1 / breathe);

    // fuzz: short soft hairs around the body
    var n = 96;
    g.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var wav = Math.sin(t * 2 + i * 0.7) * 0.06;
      var len = r * (0.12 + 0.05 * Math.sin(i * 2.3));
      var x0 = Math.cos(a) * r * 0.94, y0 = Math.sin(a) * r * 0.94;
      var x1 = Math.cos(a + wav) * (r + len), y1 = Math.sin(a + wav) * (r + len);
      g.strokeStyle = i % 3 ? 'rgba(122,154,132,0.85)' : 'rgba(150,180,158,0.85)';
      g.lineWidth = size * 0.018;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }

    // body
    var grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
    grad.addColorStop(0, '#B4CCB9');
    grad.addColorStop(0.55, '#7F9E89');
    grad.addColorStop(1, '#5A7A66');
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();

    // sprout
    g.strokeStyle = '#3D5A48'; g.lineWidth = size * 0.016;
    g.beginPath(); g.moveTo(0, -r * 1.05); g.quadraticCurveTo(r * 0.05, -r * 1.25, r * 0.02, -r * 1.36); g.stroke();
    g.fillStyle = '#6F9479';
    g.beginPath(); g.ellipse(r * 0.16, -r * 1.36, r * 0.16, r * 0.08, -0.5, 0, Math.PI * 2); g.fill();

    // face
    var ex = r * 0.36, ey = -r * 0.08;
    var ox = lx * r * 0.08, oy = ly * r * 0.06;
    var blink = (t % 4.3) < 0.13 ? 0.12 : 1;
    var eyeH = r * 0.17 * blink * (mood === 'excited' ? 1.08 : 1);
    g.fillStyle = '#24302A';
    [-1, 1].forEach(function (s) {
      g.beginPath();
      g.ellipse(s * ex + ox, ey + oy, r * 0.105, eyeH, 0, 0, Math.PI * 2);
      g.fill();
    });
    if (blink > 0.5) {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      [-1, 1].forEach(function (s) {
        g.beginPath(); g.arc(s * ex + ox + r * 0.035, ey + oy - r * 0.06, r * 0.035, 0, Math.PI * 2); g.fill();
      });
    }
    // cheeks
    g.fillStyle = 'rgba(232,150,140,0.35)';
    [-1, 1].forEach(function (s) {
      g.beginPath(); g.ellipse(s * r * 0.58 + ox * 0.5, r * 0.18 + oy, r * 0.13, r * 0.08, 0, 0, Math.PI * 2); g.fill();
    });
    // mouth
    g.strokeStyle = '#24302A'; g.fillStyle = '#3B2A2A'; g.lineWidth = size * 0.014;
    var my = r * 0.24 + oy;
    if (state.talking) {
      var open = 0.35 + 0.65 * Math.abs(Math.sin(t * 11));
      g.beginPath(); g.ellipse(ox, my, r * 0.1, r * 0.09 * open + r * 0.02, 0, 0, Math.PI * 2); g.fill();
    } else if (mood === 'thinking') {
      g.beginPath(); g.moveTo(-r * 0.07 + ox, my); g.lineTo(r * 0.08 + ox, my - r * 0.02); g.stroke();
    } else if (mood === 'curious') {
      g.beginPath(); g.arc(ox, my, r * 0.045, 0, Math.PI * 2); g.fill();
    } else {
      var w = mood === 'excited' ? 0.16 : 0.12;
      g.beginPath(); g.arc(ox, my - r * 0.06, r * w, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    }
    g.restore();
  }

  window.FloraCast = window.FloraCast || {};
  window.FloraCast.drawFlora = drawFlora;
  window.FloraCast.__stub = true;
})();
