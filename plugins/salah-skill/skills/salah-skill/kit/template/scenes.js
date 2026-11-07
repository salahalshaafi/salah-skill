/* مهارة صلاح (Get Beyond) — قالب مشاهد الفيديو
   تشتغل فوق محرّك مهارة صلاح (engine/engine.js): X = الكانفس، VF = فريم الفيديو، PRS = الشخص المقصوص.
   الألوان كلها من theme.json (THEME_RAW). المنطقة: الرسم 170–540 فوق الراس، الكابشن أسفله عند 668. */
(function () {
  'use strict';
  const W = 1080, H = 1920;
  let C = {};
  const E = t => 1 - Math.pow(1 - t, 3);
  const EIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const P = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
  const Lr = (a, b, k) => a + (b - a) * k;
  const fade = (t, s, e, di, dout) => E(P(t, s, s + (di || .28))) * (1 - P(t, e - (dout || .25), e));
  const hexA = (h, a) => { h = h.replace('#', ''); const n = parseInt(h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  let T = {};               // أوقات الكلمات
  const wt = (c, w) => MV.wordTime(c, w).s;
  const we = (c, w) => MV.wordTime(c, w).e;
  const ls = c => MV.lineSpan(c);

  /* ── أدوات الرسم ─────────────────────────────────────────── */
  function font(size, w, f) { X.font = (w || 700) + ' ' + size + 'px ' + (f || 'Tajawal'); }
  function tx(s, x, y, size, o) {
    o = o || {}; X.save(); font(size, o.w, o.f); X.textAlign = o.a || 'center'; X.textBaseline = 'middle'; X.direction = o.dir || 'rtl';
    if (o.alpha !== undefined) X.globalAlpha *= o.alpha;
    if (o.stroke) { X.lineJoin = 'round'; X.lineWidth = o.stroke; X.strokeStyle = o.sc || 'rgba(10,32,40,.92)'; X.strokeText(s, x, y); }
    if (o.shadow) { X.shadowColor = 'rgba(0,0,0,.45)'; X.shadowBlur = o.shadow; X.shadowOffsetY = o.shadow / 4; }
    X.fillStyle = o.c || C.ink; X.fillText(s, x, y); X.restore();
  }
  function tw(s, size, w, f) { X.save(); font(size, w, f); const m = X.measureText(s).width; X.restore(); return m; }
  function panel(x, y, w, h, r, a, o) {   /* مهارة صلاح: كرت فاتح + شريط جانبي بلون التمييز */
    o = o || {}; if (a <= 0) return; X.save(); X.globalAlpha *= a;
    X.shadowColor = 'rgba(0,0,0,.22)'; X.shadowBlur = 30; X.shadowOffsetY = 12;
    X.fillStyle = o.fill || hexA(C.cream, .97); rr(x, y, w, h, Math.min(r, 18)); X.fill(); X.shadowColor = 'transparent';
    X.fillStyle = o.stroke || C.mus; rr(x + w - 12, y + 14, 8, h - 28, 4); X.fill(); X.restore();
  }
  function cream(x, y, w, h, r, a) { panel(x, y, w, h, r, a, { fill: C.cream, stroke: hexA(C.ink, .12), lw: 2 }); }
  function pill(s, cx, cy, size, a, o) {
    o = o || {}; if (a <= 0) return; const pw = tw(s, size, o.w || 800) + size * 1.1 + (o.icon ? size * 1.2 : 0), ph = size * 1.75;
    X.save(); X.globalAlpha *= a; const sc = o.sc || 1; X.translate(cx, cy); X.scale(sc, sc); X.translate(-cx, -cy);
    X.shadowColor = 'rgba(0,0,0,.30)'; X.shadowBlur = 26; X.shadowOffsetY = 10;
    X.fillStyle = o.bg || C.mus; rr(cx - pw / 2, cy - ph / 2, pw, ph, ph * .28); X.fill(); X.shadowColor = 'transparent';
    if (o.border) { X.lineWidth = 3; X.strokeStyle = o.border; rr(cx - pw / 2, cy - ph / 2, pw, ph, ph * .28); X.stroke(); }
    const tx0 = o.icon ? cx - size * .6 : cx;
    tx(s, tx0, cy + size * .06, size, { c: o.fg || C.ink, w: o.w || 800 });
    if (o.icon) icon(o.icon, cx + pw / 2 - size * 1.05, cy, size * 1.05, o.fg || C.ink);
    X.restore(); return pw;
  }
  function popK(t, s, d) { const k = P(t, s, s + (d || .3)); return { a: E(Math.min(1, k * 1.6)), sc: .92 + .08 * E(k) }; }

  /* أيقونات خطية بسيطة (مرسومة بالكود) */
  function icon(kind, x, y, s, c, o) {
    o = o || {}; X.save(); X.translate(x, y); X.strokeStyle = c; X.fillStyle = c; X.lineWidth = Math.max(2.5, s * .09); X.lineCap = 'round'; X.lineJoin = 'round';
    const u = s / 2; X.beginPath();
    switch (kind) {
      case 'chat': rr(-u * .9, -u * .7, u * 1.8, u * 1.2, u * .35); X.stroke(); X.beginPath(); X.moveTo(-u * .35, u * .5); X.lineTo(-u * .55, u * .9); X.lineTo(-u * .05, u * .5); X.stroke(); break;
      case 'robot': rr(-u * .8, -u * .55, u * 1.6, u * 1.25, u * .35); X.stroke(); X.beginPath(); X.arc(-u * .32, u * .05, u * .14, 0, 7); X.arc(u * .32, u * .05, u * .14, 0, 7); X.fill(); X.beginPath(); X.moveTo(0, -u * .55); X.lineTo(0, -u * .85); X.stroke(); X.beginPath(); X.arc(0, -u * .92, u * .1, 0, 7); X.fill(); break;
      case 'gear': { X.arc(0, 0, u * .42, 0, 7); X.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + (o.rot || 0); X.beginPath(); X.moveTo(Math.cos(a) * u * .55, Math.sin(a) * u * .55); X.lineTo(Math.cos(a) * u * .85, Math.sin(a) * u * .85); X.stroke(); } X.beginPath(); X.arc(0, 0, u * .62, 0, 7); X.stroke(); break; }
      case 'search': X.arc(-u * .15, -u * .15, u * .5, 0, 7); X.stroke(); X.beginPath(); X.moveTo(u * .22, u * .22); X.lineTo(u * .75, u * .75); X.stroke(); break;
      case 'phone': X.rotate(-0.6); X.lineWidth = s * .14; X.arc(0, u * .55, u * .75, Math.PI * 1.18, Math.PI * 1.82); X.stroke(); X.beginPath(); rr(-u * .78, -u * .05, u * .42, u * .34, u * .1); X.fill(); X.beginPath(); rr(u * .36, -u * .05, u * .42, u * .34, u * .1); X.fill(); break;
      case 'card': rr(-u * .85, -u * .55, u * 1.7, u * 1.1, u * .18); X.stroke(); X.beginPath(); X.moveTo(-u * .85, -u * .2); X.lineTo(u * .85, -u * .2); X.lineWidth = s * .13; X.stroke(); X.beginPath(); X.lineWidth = s * .08; X.moveTo(u * .2, u * .25); X.lineTo(u * .55, u * .25); X.stroke(); break;
      case 'check': X.lineWidth = s * .14; X.moveTo(-u * .55, 0); X.lineTo(-u * .15, u * .4); X.lineTo(u * .6, -u * .45); X.stroke(); break;
      case 'cross': X.lineWidth = s * .14; X.moveTo(-u * .45, -u * .45); X.lineTo(u * .45, u * .45); X.moveTo(u * .45, -u * .45); X.lineTo(-u * .45, u * .45); X.stroke(); break;
      case 'lock': rr(-u * .6, -u * .1, u * 1.2, u * .95, u * .15); X.fill(); X.beginPath(); X.lineWidth = s * .12; X.arc(0, -u * .12, u * .38, Math.PI, 0); X.lineTo(u * .38, -u * .05); X.moveTo(-u * .38, -u * .12); X.lineTo(-u * .38, -u * .05); X.stroke(); break;
      case 'eye': { const op = o.open === undefined ? 1 : o.open; X.moveTo(-u * .9, 0); X.quadraticCurveTo(0, -u * .85 * op, u * .9, 0); X.quadraticCurveTo(0, u * .85 * op, -u * .9, 0); X.stroke(); if (op > .25) { X.beginPath(); X.arc(0, 0, u * .28 * Math.min(1, op * 1.3), 0, 7); X.fill(); } break; }
      case 'plane': X.rotate(o.rot || 0); X.moveTo(u * .9, 0); X.lineTo(-u * .7, -u * .12); X.lineTo(-u * .9, -u * .45); X.lineTo(-u * .55, -u * .12); X.lineTo(-u * .1, -u * .12); X.lineTo(-u * .45, -u * .85); X.lineTo(-u * .15, -u * .85); X.lineTo(u * .45, -u * .12); X.lineTo(u * .45, u * .12); X.lineTo(-u * .15, u * .85); X.lineTo(-u * .45, u * .85); X.lineTo(-u * .1, u * .12); X.lineTo(-u * .55, u * .12); X.lineTo(-u * .9, u * .45); X.lineTo(-u * .7, u * .12); X.closePath(); X.fill(); break;
      case 'bed': X.moveTo(-u * .9, u * .55); X.lineTo(-u * .9, -u * .5); X.moveTo(-u * .9, u * .15); X.lineTo(u * .9, u * .15); X.lineTo(u * .9, u * .55); X.stroke(); X.beginPath(); rr(-u * .65, -u * .2, u * .45, u * .3, u * .1); X.fill(); X.beginPath(); rr(-u * .1, -u * .2, u * 1.0, u * .32, u * .1); X.stroke(); break;
      case 'car': rr(-u * .9, -u * .1, u * 1.8, u * .55, u * .18); X.stroke(); X.beginPath(); X.moveTo(-u * .55, -u * .1); X.lineTo(-u * .35, -u * .5); X.lineTo(u * .35, -u * .5); X.lineTo(u * .55, -u * .1); X.stroke(); X.beginPath(); X.arc(-u * .5, u * .5, u * .17, 0, 7); X.arc(u * .5, u * .5, u * .17, 0, 7); X.fill(); break;
      case 'mega': X.moveTo(-u * .75, -u * .25); X.lineTo(u * .45, -u * .75); X.lineTo(u * .45, u * .75); X.lineTo(-u * .75, u * .25); X.closePath(); X.stroke(); X.beginPath(); X.moveTo(-u * .45, u * .25); X.lineTo(-u * .3, u * .75); X.stroke(); X.beginPath(); X.moveTo(u * .7, -u * .2); X.lineTo(u * .9, -u * .3); X.moveTo(u * .7, u * .2); X.lineTo(u * .9, u * .3); X.stroke(); break;
      case 'globe': X.arc(0, 0, u * .85, 0, 7); X.stroke(); X.beginPath(); X.ellipse(0, 0, u * .38, u * .85, 0, 0, 7); X.stroke(); X.beginPath(); X.moveTo(-u * .85, 0); X.lineTo(u * .85, 0); X.moveTo(-u * .72, -u * .42); X.lineTo(u * .72, -u * .42); X.moveTo(-u * .72, u * .42); X.lineTo(u * .72, u * .42); X.stroke(); break;
      case 'key': X.arc(u * .45, 0, u * .32, 0, 7); X.stroke(); X.beginPath(); X.moveTo(u * .13, 0); X.lineTo(-u * .85, 0); X.moveTo(-u * .55, 0); X.lineTo(-u * .55, u * .3); X.moveTo(-u * .8, 0); X.lineTo(-u * .8, u * .3); X.stroke(); break;
      case 'star': { const f = o.fill === undefined ? 1 : o.fill; X.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? u * .42 : u * .95, a = -Math.PI / 2 + i * Math.PI / 5; X.lineTo(Math.cos(a) * r, Math.sin(a) * r); } X.closePath(); X.stroke(); if (f > 0) { X.save(); X.clip(); X.fillRect(u * (1 - 2 * f), -u, u * 2 * f, u * 2); X.restore(); } break; }
      case 'warn': X.moveTo(0, -u * .85); X.lineTo(u * .92, u * .7); X.lineTo(-u * .92, u * .7); X.closePath(); X.fill(); X.fillStyle = o.inner || '#12303B'; X.beginPath(); rr(-u * .08, -u * .35, u * .16, u * .62, u * .08); X.fill(); X.beginPath(); X.arc(0, u * .47, u * .1, 0, 7); X.fill(); break;
      case 'comment': rr(-u * .9, -u * .65, u * 1.8, u * 1.15, u * .3); X.stroke(); X.beginPath(); X.moveTo(u * .3, u * .5); X.lineTo(u * .55, u * .9); X.lineTo(u * .65, u * .5); X.stroke(); X.beginPath(); X.moveTo(-u * .5, -u * .2); X.lineTo(u * .5, -u * .2); X.moveTo(-u * .5, u * .1); X.lineTo(u * .2, u * .1); X.stroke(); break;
      case 'pin': X.rotate(.6); rr(-u * .38, -u * .85, u * .76, u * .25, u * .08); X.fill(); X.beginPath(); X.moveTo(-u * .25, -u * .6); X.lineTo(-u * .32, u * .05); X.lineTo(u * .32, u * .05); X.lineTo(u * .25, -u * .6); X.closePath(); X.fill(); X.beginPath(); X.moveTo(0, u * .05); X.lineTo(0, u * .9); X.stroke(); break;
      case 'link': X.lineWidth = s * .12; X.rotate(-.75); rr(-u * .95, -u * .28, u * 1.05, u * .56, u * .28); X.stroke(); X.beginPath(); rr(-u * .1, -u * .28, u * 1.05, u * .56, u * .28); X.stroke(); break;
      case 'moon': X.arc(0, 0, u * .8, Math.PI * .28, Math.PI * 1.72, false); X.arc(u * .38, -u * .05, u * .62, Math.PI * 1.55, Math.PI * .45, true); X.closePath(); X.fill(); break;
      case 'spark': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; X.moveTo(0, 0); X.quadraticCurveTo(Math.cos(a + .785) * u * .2, Math.sin(a + .785) * u * .2, Math.cos(a) * u, Math.sin(a) * u); X.quadraticCurveTo(Math.cos(a - .785) * u * .2, Math.sin(a - .785) * u * .2, 0, 0); } X.fill(); break;
      case 'user': X.arc(0, -u * .3, u * .38, 0, 7); X.fill(); X.beginPath(); X.arc(0, u * .85, u * .75, Math.PI, 0); X.fill(); break;
      case 'brain': rr(-u * .75, -u * .75, u * 1.5, u * 1.5, u * .25); X.stroke(); X.beginPath(); rr(-u * .38, -u * .38, u * .76, u * .76, u * .1); X.fill(); for (let i = -1; i <= 1; i++) { X.beginPath(); X.moveTo(i * u * .35, -u * .75); X.lineTo(i * u * .35, -u * 1.0); X.moveTo(i * u * .35, u * .75); X.lineTo(i * u * .35, u * 1.0); X.moveTo(-u * .75, i * u * .35); X.lineTo(-u * 1.0, i * u * .35); X.moveTo(u * .75, i * u * .35); X.lineTo(u * 1.0, i * u * .35); X.stroke(); } break;
      case 'dollar': font(s * .95, 900, 'Inter'); X.textAlign = 'center'; X.textBaseline = 'middle'; X.direction = 'ltr'; X.fillText('$', 0, s * .04); break;
    }
    X.restore();
  }
  function spinner(x, y, r, t, c) { X.save(); X.strokeStyle = c; X.lineWidth = r * .32; X.lineCap = 'round'; X.beginPath(); X.arc(x, y, r, t * 7, t * 7 + 4.2); X.stroke(); X.restore(); }
  function toggle(x, y, on, a) { /* x,y = مركز · on 0..1 */
    X.save(); X.globalAlpha *= a; const w = 92, h = 50; X.fillStyle = on > .5 ? C.mus : hexA(C.cream, .25); rr(x - w / 2, y - h / 2, w, h, h / 2); X.fill();
    X.fillStyle = C.cream; X.beginPath(); X.arc(Lr(x + w / 2 - h / 2, x - w / 2 + h / 2, E(on)), y, h / 2 - 6, 0, 7); X.fill(); X.restore();
  }
  function ellipseDraw(cx, cy, rx, ry, k, c, lw) { if (k <= 0) return; X.save(); X.strokeStyle = c; X.lineWidth = lw; X.lineCap = 'round'; X.beginPath(); const a0 = -2.2; X.ellipse(cx, cy, rx, ry, -.06, a0, a0 + Math.PI * 2.15 * E(k)); X.stroke(); X.restore(); }
  function drawVF(s, cx, cy) { X.save(); X.translate(cx, cy); X.scale(s, s); X.translate(-cx, -cy); X.drawImage(VF, 0, 0, W, H); X.restore(); }
  function drawPRS(s, cx, cy) { if (typeof PRS_OK === 'undefined' || !PRS_OK || !PRS.naturalWidth) return false; X.save(); X.translate(cx, cy); X.scale(s, s); X.translate(-cx, -cy); X.drawImage(PRS, 0, 0, W, H); X.restore(); return true; }

  /* ── أيقونات إضافية لهالحلقة ── */
  function icon2(kind, x, y, s, c) {
    X.save(); X.translate(x, y); X.strokeStyle = c; X.fillStyle = c; X.lineWidth = Math.max(2.5, s * .09); X.lineCap = 'round'; X.lineJoin = 'round';
    const u = s / 2; X.beginPath();
    switch (kind) {
      case 'pill': X.rotate(-.6); rr(-u * .9, -u * .38, u * 1.8, u * .76, u * .38); X.stroke(); X.beginPath(); X.save(); rr(-u * .9, -u * .38, u * .9, u * .76, u * .38); X.restore(); X.moveTo(0, -u * .38); X.lineTo(0, u * .38); X.stroke(); X.beginPath(); X.save(); X.beginPath(); rr(-u * .9, -u * .38, u * 1.8, u * .76, u * .38); X.clip(); X.fillRect(-u, -u, u, 2 * u); X.restore(); break;
      case 'steth': X.arc(-u * .35, -u * .2, u * .45, Math.PI, 0, true); X.stroke(); X.beginPath(); X.moveTo(u * .1, -u * .2); X.quadraticCurveTo(u * .15, u * .7, u * .55, u * .55); X.stroke(); X.beginPath(); X.arc(u * .62, u * .35, u * .2, 0, 7); X.stroke(); X.beginPath(); X.arc(-u * .8, -u * .75, u * .1, 0, 7); X.arc(u * .1, -u * .75, u * .1, 0, 7); X.fill(); break;
      case 'doc': rr(-u * .65, -u * .85, u * 1.3, u * 1.7, u * .15); X.stroke(); X.beginPath(); for (let i = 0; i < 4; i++) { X.moveTo(-u * .38, -u * .45 + i * u * .32); X.lineTo(u * (i === 3 ? .1 : .38), -u * .45 + i * u * .32); } X.stroke(); break;
      case 'clip': X.lineWidth = s * .1; X.moveTo(u * .25, -u * .5); X.lineTo(u * .25, u * .45); X.arc(0, u * .45, u * .25, 0, Math.PI); X.lineTo(-u * .25, -u * .65); X.arc(u * .05, -u * .65, u * .3, Math.PI, 0); X.lineTo(u * .35, u * .2); X.stroke(); break;
      case 'drop': X.moveTo(0, -u * .9); X.quadraticCurveTo(u * .75, u * .05, u * .55, u * .45); X.arc(0, u * .35, u * .58, .2, Math.PI - .2); X.quadraticCurveTo(-u * .75, u * .05, 0, -u * .9); X.fill(); break;
      case 'crescent': X.arc(0, 0, u * .85, Math.PI * .3, Math.PI * 1.7, false); X.arc(u * .42, -u * .1, u * .68, Math.PI * 1.6, Math.PI * .4, true); X.closePath(); X.fill(); break;
      case 'bell': X.moveTo(-u * .7, u * .45); X.quadraticCurveTo(-u * .55, u * .3, -u * .55, -u * .1); X.quadraticCurveTo(-u * .55, -u * .75, 0, -u * .75); X.quadraticCurveTo(u * .55, -u * .75, u * .55, -u * .1); X.quadraticCurveTo(u * .55, u * .3, u * .7, u * .45); X.closePath(); X.fill(); X.beginPath(); X.arc(0, u * .62, u * .17, 0, 7); X.fill(); break;
      case 'hand': X.lineWidth = s * .1; X.moveTo(-u * .9, u * .1); X.lineTo(-u * .35, -u * .25); X.lineTo(u * .05, -u * .05); X.lineTo(u * .35, -u * .3); X.lineTo(u * .9, u * .1); X.moveTo(-u * .35, -u * .25); X.lineTo(-u * .05, u * .3); X.lineTo(u * .15, u * .15); X.lineTo(u * .35, u * .38); X.lineTo(u * .5, u * .22); X.stroke(); break;
      case 'flask': X.moveTo(-u * .25, -u * .85); X.lineTo(-u * .25, -u * .2); X.lineTo(-u * .75, u * .7); X.lineTo(u * .75, u * .7); X.lineTo(u * .25, -u * .2); X.lineTo(u * .25, -u * .85); X.stroke(); X.beginPath(); X.moveTo(-u * .5, u * .25); X.lineTo(u * .5, u * .25); X.lineTo(u * .75, u * .7); X.lineTo(-u * .75, u * .7); X.closePath(); X.fill(); break;
      case 'bubbleq': rr(-u * .9, -u * .7, u * 1.8, u * 1.25, u * .35); X.stroke(); X.beginPath(); X.moveTo(-u * .4, u * .55); X.lineTo(-u * .6, u * .95); X.lineTo(-u * .05, u * .55); X.stroke(); font(s * .7, 900, 'Inter'); X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText('?', 0, -u * .05); break;
    }
    X.restore();
  }

  /* بطاقة متصفح فيها لقطة حقيقية من موقع الأداة */
  function browser(img, src, x, y, w, h, a, sc, url, rot) {
    if (a <= 0 || !img.naturalWidth) return;
    X.save(); X.globalAlpha *= a; const cx = x + w / 2, cy = y + h / 2; X.translate(cx, cy); X.rotate(rot || 0); X.scale(sc, sc); X.translate(-cx, -cy);
    X.shadowColor = 'rgba(0,0,0,.45)'; X.shadowBlur = 50; X.shadowOffsetY = 20; X.fillStyle = '#FFFFFF'; rr(x, y, w, h, 26); X.fill(); X.shadowColor = 'transparent';
    X.fillStyle = '#EEF0F3'; rr(x, y, w, 50, 26); X.fill(); X.fillRect(x, y + 26, w, 24);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { X.fillStyle = c; X.beginPath(); X.arc(x + 30 + i * 26, y + 25, 8, 0, 7); X.fill(); });
    X.fillStyle = '#FFFFFF'; rr(x + 120, y + 10, w - 150, 30, 15); X.fill(); tx(url, x + 120 + (w - 150) / 2, y + 26, 20, { c: '#5b6470', w: 600, f: 'Inter', dir: 'ltr' });
    X.save(); X.beginPath(); X.rect(x, y + 50, w, h - 50); X.clip(); X.drawImage(img, src[0], src[1], src[2], src[3], x, y + 50, w, h - 50); X.restore();
    X.strokeStyle = hexA(C.mus, .9); X.lineWidth = 4; rr(x, y, w, h, 26); X.stroke();
    X.restore();
  }
  function numBadge(n, x, y, r, a, sc) { if (a <= 0) return; X.save(); X.globalAlpha *= a; X.translate(x, y); X.scale(sc || 1, sc || 1); X.fillStyle = C.mus; X.beginPath(); X.arc(0, 0, r, 0, 7); X.fill(); X.strokeStyle = C.cream; X.lineWidth = r * .1; X.stroke(); tx(String(n), 0, r * .08, r * 1.25, { c: C.ink, w: 900, f: 'Inter', dir: 'ltr' }); X.restore(); }
  function stamp(big, small, y, k, a, rot) {   /* مهارة صلاح: ستيكر ينزلق من اليمين بزاوية خفيفة */
    if (a <= 0) return; const slide = (1 - E(k)) * 420;
    X.save(); X.globalAlpha = a; X.translate(540 + slide, y); X.rotate(rot === undefined ? .045 : rot);
    font(100, 900); const w = Math.max(X.measureText(big).width + 110, 400), h = small ? 210 : 170;
    X.shadowColor = 'rgba(0,0,0,.3)'; X.shadowBlur = 26; X.shadowOffsetY = 12; X.fillStyle = C.mus; rr(-w / 2, -h / 2, w, h, 22); X.fill(); X.shadowColor = 'transparent';
    tx(big, 0, small ? -26 : 4, 100, { c: '#FFFFFF', w: 900 }); if (small) tx(small, 0, 62, 44, { c: hexA('#FFFFFF', .9), w: 700 });
    X.restore();
  }

  /* ═══════════════ مهارة صلاح — هيكل المشاهد (استبدل المحتوى، خلي الأسلوب) ═══════════════
     كل وقت يجي من الكابشن: wt(رقم_الكرت, رقم_الكلمة) = بداية الكلمة · ls(رقم_الكرت).s/.e = بداية/نهاية الكرت.
     أرقام الكروت تطبعها build_caps.py. الرسم فوق الراس (y 170–540)، والكابشن تحته. */

  /* صور حقيقية من مواقع الأدوات (لو فيه) — حطها في work/assets */
  const IMG = {}; [/* 'tool1.jpg', 'tool2.jpg' */].forEach(n => { const i = new Image(); i.src = 'assets/' + n; IMG[n] = i; });

  SCENES = [
    { s: 0, e: 999, m: R_FULL }
    /* { s: من, e: إلى, m: R_FULL, nocap: true }  ← مشهد الموشن يكتب الكلام بنفسه */
  ];

  MV.ready(() => {
    const th = THEME_RAW || {};
    C = { teal: th.teal || CLAY, deep: th.tealDeep || INK, mus: th.mustard || ACC, cream: th.cream || BG, good: th.good || ACC, bad: th.bad || ACC, ink: INK };
    T = {
      /* مثال — بدّل الأرقام حسب كروت فيديوك */
      topic: ls(1).s,            // كبسولة موضوع الفيديو
      hookWord: wt(2, 1),        // كلمة الختم الكبيرة
      orbit: [wt(3, 0), wt(3, 1), wt(3, 2)], orbitEnd: ls(3).e,   // كلمات تلف ورا الراس
      tool1: ls(4).s, tool1End: ls(5).e,                          // بطاقة أداة ①
      endCard: ls(6).s                                            // الختام بالكشيدة
    };
  });

  /* ═══ طبقة الفيديو: زوم + لحظات العمق ═══ */
  function punch(t) {
    let s = 1; const cx = 540, cy = 1150;
    if (t < T.topic + 2.5) s = 1 + .075 * E(P(t, 0, 2.5));
    const hit = (h, to, d) => { if (t >= h - .02 && t < h + d + .4) { const k = t < h + d ? E(P(t, h - .02, h + .12)) : 1 - EIO(P(t, h + d, h + d + .4)); s = 1 + (to - 1) * k; } };
    hit(T.hookWord, 1.12, .5);
    return { s, cx, cy };
  }
  function videoLayer(t) {
    const z = punch(t); if (z.s > 1.001) drawVF(z.s, z.cx, z.cy);
    orbit(t); kashidaEnd(t, 'سلسلة');
  }
  videoLayer.layer = 'video';

  /* كلمات تطلع من ورا الراس وتستقر فوقه (لحظة عمق) */
  function orbit(t) {
    const words = ['كلمة ١', 'كلمة ٢', 'كلمة ٣']; const e0 = T.orbitEnd + .2;
    words.forEach((w, i) => { const at = T.orbit[i]; if (t < at - .05 || t > e0 + .4) return;
      const k = E(P(t, at, at + .45)), out = P(t, e0, e0 + .35); const x = 300 + i * 240, y = Lr(900, 420 + (i % 2) * 70, k);
      pill(w, x, y, 40, (1 - out) * Math.min(1, k * 3), { bg: C.mus, fg: '#FFFFFF', w: 900 }); });
    drawPRS(1, 540, 1150);   /* الشخص فوق الكلمات لين تطلع من ورا راسه */
  }

  /* شريط الختام: اسم السلسلة/الصفحة ينزلق من فوق */
  function kashidaEnd(t, word) {
    if (t < T.endCard - .1) return; const k = E(P(t, T.endCard, T.endCard + .4));
    X.save(); X.globalAlpha = k; X.translate(0, (1 - k) * -160); X.fillStyle = C.mus; rr(90, 180, 900, 150, 24); X.fill();
    tx(word, 540, 255, 72, { c: '#FFFFFF', w: 900 }); X.restore();   /* فوق — ما يتعارضش مع الكابشن */
  }

  /* ═══ طبقة الرسم: فوق الفيديو، تحت الكابشن ═══ */
  function overlay(t) { topicPill(t); bigStamp(t); toolCard(t); }

  function topicPill(t) { pill('موضوع الفيديو', 540, 236, 40, fade(t, T.topic, T.topic + 3, .3, .3), { bg: C.mus, fg: C.ink, w: 900 }); }
  function bigStamp(t) { const k = P(t, T.hookWord - .02, T.hookWord + .16); if (k > 0) stamp('الكلمة', 'السطر الصغير', 390, k, Math.min(1, k * 2.2) * (1 - P(t, T.hookWord + 1.6, T.hookWord + 1.9))); }
  function toolCard(t) {
    /* بطاقة متصفح بلقطة حقيقية: browser(IMG['tool1.jpg'], [sx, sy, sw, sh], 150, 150, 780, 400, a, sc, 'site.com') */
    const k = popK(t, T.tool1, .4), a = k.a * (1 - P(t, T.tool1End - .2, T.tool1End)); if (a <= 0) return;
    numBadge(1, 160, 160, 46, a, k.sc);
  }

  MV.ready(() => { MV.scene('gbVideo', videoLayer, 'video'); MV.scene('gbOverlay', overlay); });
  const _init = window.init;
  window.init = function () { const r = _init.apply(this, arguments);
    const f = ['700 26px Inter', '800 46px Inter', '900 64px Inter'].map(x => document.fonts.load(x, 'AI 123'));
    const im = Object.values(IMG).map(i => new Promise(res => { if (i.complete) res(); else { i.onload = res; i.onerror = res; } }));
    return Promise.all([r, ...f, ...im]); };
})();
