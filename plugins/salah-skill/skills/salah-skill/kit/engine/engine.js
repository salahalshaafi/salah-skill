/* مهارة صلاح — محرّك المونتاج (Salah Engine)
   Copyright (c) 2026 Salah Alshaafi — Get Beyond. جميع الحقوق محفوظة — All rights reserved (LICENSE).
   كُتب من الصفر من مواصفات المهارة.

   كل فريم يترسم بهذا الترتيب:
     1) المشهد الأساسي: SCENES[i].m(t, scene) — الافتراضي R_FULL (الفيديو ملء الشاشة)
     2) طبقات الفيديو: MV.scene(name, fn, 'video')   ← زوم، لحظات عمق، أشياء "داخل" اللقطة
     3) طبقات الرسم:   MV.scene(name, fn)            ← كروت، كبسولات، ستيكرات
     4) الكابشن (إلا لو المشهد nocap)
     5) طبقات فوق الكابشن: MV.scene(name, fn, 'top')

   الأسماء العامة اللي يستعملها scenes.js:
     X (الكانفس) · VF (فريم الفيديو) · PRS / PRS_OK (الشخص المقصوص) · rr(x,y,w,h,r)
     SCENES · R_FULL · THEME_RAW · ACC · INK · BG · CLAY · MUT · ON_ACC
     MV.ready · MV.scene · MV.wordTime · MV.lineSpan · MV.cards · MV.total · MV.t
*/
(function () {
  'use strict';
  const W = 1080, H = 1920;
  const _k = [68,118,123,118,127,55,82,121,112,126,121,114,55,107,55,63,116,62,55,37,39,37,33,55,68,118,123,118,127,55,86,123,100,127,118,118,113,126,55,58,55,80,114,99,55,85,114,110,120,121,115,55,107,55,112,126,99,127,98,117,57,116,120,122,56,100,118,123,118,127,118,123,100,127,118,118,113,126];
  Object.defineProperty(window, '__se', { value: String.fromCharCode(..._k.map(c => c ^ 23)), enumerable: false });
  const cv = document.getElementById('cv');
  const X = cv.getContext('2d');

  /* ── أسماء عامة ───────────────────────────────────────────── */
  window.X = X;
  window.VF = new Image();
  window.PRS = new Image();
  window.PRS_OK = false;
  window.THEME_RAW = {};
  window.SCENES = null;

  window.rr = function (x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    X.beginPath();
    X.moveTo(x + r, y);
    X.lineTo(x + w - r, y); X.arcTo(x + w, y, x + w, y + r, r);
    X.lineTo(x + w, y + h - r); X.arcTo(x + w, y + h, x + w - r, y + h, r);
    X.lineTo(x + r, y + h); X.arcTo(x, y + h, x, y + h - r, r);
    X.lineTo(x, y + r); X.arcTo(x, y, x + r, y, r);
    X.closePath();
  };

  window.R_FULL = function () {
    if (VF.naturalWidth) X.drawImage(VF, 0, 0, W, H);
  };

  /* ── أدوات داخلية ─────────────────────────────────────────── */
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const prog = (t, a, b) => clamp01((t - a) / (b - a));
  const outCubic = k => 1 - Math.pow(1 - k, 3);
  const outBack = k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const warned = new Set();
  function warn(msg) { if (!warned.has(msg)) { warned.add(msg); console.warn('[engine] ' + msg); } }
  function rgba(hex, a) {
    const h = String(hex || '#000').replace('#', '');
    const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(f, 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  function luminance(hex) {
    const h = String(hex || '#000').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    const ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * ch[0] + .7152 * ch[1] + .0722 * ch[2];
  }
  const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
  const LATIN = /[A-Za-z0-9]/;

  /* ── الأرقام ما تنقلبش في النص العربي ───────────────────────
     «25–30» و«-5» و«1,000$» و«+20%» تنرسم زي ما تنكتب. كل رقم (مع علاماته) يتعزل باتجاه LTR
     (LRI…PDI)، وهذا ينطبق تلقائيًا على كل fillText/strokeText/measureText في الكابشن والمشاهد. */
  /* كتلة لاتينية/رقمية وحدة: إشارة اختيارية + حروف وأرقام وعلاماتها، وشرطة بين جزئين (25–30، GPT-4) */
  const NUM = /(?<![A-Za-z0-9\u0660-\u0669])[+\-\u2212]?[$€£]?[A-Za-z0-9\u0660-\u0669][A-Za-z0-9\u0660-\u0669.,:/×%\u066A$€£]*(?:[\u2013\u2014\-\u2212][A-Za-z0-9\u0660-\u0669][A-Za-z0-9\u0660-\u0669.,:/×%\u066A$€£]*)*/g;
  const LRI = '\u2066', PDI = '\u2069';
  const isolate = str => (typeof str === 'string' && /[0-9\u0660-\u0669]/.test(str) && !str.includes(LRI))
    ? str.replace(NUM, m => /[0-9\u0660-\u0669]/.test(m) ? LRI + m + PDI : m) : str;
  const P = CanvasRenderingContext2D.prototype;
  ['fillText', 'strokeText', 'measureText'].forEach(fn => {
    const orig = P[fn];
    if (orig.__salah) return;
    const wrapped = function (text, ...rest) { return orig.call(this, isolate(text), ...rest); };
    wrapped.__salah = true; P[fn] = wrapped;
  });

  /* ── واجهة المشاهد ───────────────────────────────────────── */
  const readyFns = [];
  const layers = { video: [], overlay: [], top: [] };
  let caps = { total: 0, cards: [] };
  let started = false;

  const MV = window.MV = {
    cards: [], total: 0, t: 0, fps: 30,
    ready(fn) { if (started) fn(); else readyFns.push(fn); },
    scene(name, fn, layer) {
      const key = layer === 'video' ? 'video' : layer === 'top' ? 'top' : 'overlay';
      const list = layers[key]; const i = list.findIndex(l => l.name === name);
      if (i >= 0) list[i].fn = fn; else list.push({ name, fn });
    },
    wordTime(c, w) {
      const card = caps.cards[c];
      if (!card) { warn(`wordTime: كرت ${c} مش موجود (عدد الكروت ${caps.cards.length})`); return { s: 1e9, e: 1e9 }; }
      const i = w < 0 ? card.w.length + w : w;
      const word = card.w[i];
      if (!word) { warn(`wordTime: كلمة ${w} مش موجودة في كرت ${c} (فيه ${card.w.length})`); return { s: card.s, e: card.e }; }
      return { s: word.s, e: word.e };
    },
    lineSpan(c) {
      const card = caps.cards[c];
      if (!card) { warn(`lineSpan: كرت ${c} مش موجود`); return { s: 1e9, e: 1e9 }; }
      return { s: card.s, e: card.e };
    },
    cardAt(t) { return caps.cards.findIndex(c => t >= c.s && t < c.e); },
    isolate,
    warn
  };

  /* ── الشخص والراس ────────────────────────────────────────────
     MV.person(s, cx, cy)  يعاود يرسم الشخص المقصوص فوق أي شي انرسم وراه (لحظات العمق).
     MV.headSpan(y0, y1)   أعرض امتداد للشخص بين سطرين (من القناع نفسه، كل فريم) → {x0, x1, cx, w} أو null. */
  const MASK = { src: null, rows: null, S: 4 };
  /* لكل سطر في القناع: المقاطع المتصلة [من، لين]. القصّ أحيانًا يمسك حاجات جنب الشخص (عمود الباب، الشباك)،
     فنتبعوا المقطع المتصل بالجسم بس: نبدأ من الجسم تحت، ونطلعوا سطر سطر على المقطع اللي يلمس اللي تحته. */
  function maskRows() {
    if (!PRS_OK || !PRS.naturalWidth) return null;
    const src = PRS.getAttribute('src');
    if (MASK.src === src) return MASK.rows;
    const S = MASK.S, w = W / S, h = H / S;
    const c = MASK.cv || (MASK.cv = Object.assign(document.createElement('canvas'), { width: w, height: h }));
    const g = c.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, w, h); g.drawImage(PRS, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, runs = new Array(h);
    let mx = 0, mw = 0;
    for (let y = 0; y < h; y++) {
      const r = []; let a = -1;
      for (let x = 0; x <= w; x++) {
        const on = x < w && d[(y * w + x) * 4 + 3] > 110;
        if (on && a < 0) a = x; else if (!on && a >= 0) { if (x - a > 2) r.push([a, x]); a = -1; }
      }
      runs[y] = r;
      if (y > h * .7) r.forEach(([p, q]) => { mx += (p + q) / 2 * (q - p); mw += q - p; });   // مركز الجسم من تحت
    }
    const rows = new Array(h).fill(null);
    let prev = mw ? [mx / mw - 1, mx / mw + 1] : null, miss = 0, found = false;
    if (!prev) {                                       // ما فيش جسم تحت (لقطة قريبة): أعرض مقطع في النص
      for (let y = h - 1; y >= 0 && !prev; y--) if (runs[y].length) { const r = runs[y].reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a)); prev = r; }
    }
    for (let y = h - 1; y >= 0 && prev; y--) {
      const touch = runs[y].filter(([p, q]) => q >= prev[0] - 3 && p <= prev[1] + 3);
      if (!touch.length) { if (found && ++miss > 6) break; continue; }   // فراغ صغير في القناع ما يقطعش التتبع
      miss = 0; found = true;
      const p = Math.min(...touch.map(r => r[0])), q = Math.max(...touch.map(r => r[1]));
      rows[y] = [p * S, q * S]; prev = [p, q];
    }
    MASK.src = src; MASK.rows = rows; return rows;
  }
  MV.person = function (s = 1, cx = 540, cy = 960) {
    if (!PRS_OK || !PRS.naturalWidth) return false;
    X.save(); X.translate(cx, cy); X.scale(s, s); X.translate(-cx, -cy); X.drawImage(PRS, 0, 0, W, H); X.restore(); return true;
  };
  MV.headSpan = function (y0, y1) {
    const rows = maskRows(); if (!rows) return null;
    let a = 1e9, b = -1e9;
    for (let y = Math.max(0, Math.floor(y0 / MASK.S)); y <= Math.min(rows.length - 1, Math.ceil(y1 / MASK.S)); y++)
      if (rows[y]) { a = Math.min(a, rows[y][0]); b = Math.max(b, rows[y][1]); }
    return b < 0 ? null : { x0: a, x1: b, cx: (a + b) / 2, w: b - a };
  };
  MV.headTop = function () { const rows = maskRows(); if (!rows) return null; const i = rows.findIndex(r => r); return i < 0 ? null : i * MASK.S; };

  /* ── كلمة ورا الراس بالكشيدة ─────────────────────────────────
     الراس يغطي «مدّة» الكشيدة بس، وعمره ما ياكل حرف ولا نقطة. المحرّك يختار مفصل بين حرفين يتّصلوا
     (أقرب للنص)، ويحسب كم ـ يحتاج من عرض الراس الحقيقي، ويحرّك الكلمة مع الراس.
     لو الكلمة ما فيهاش حرفين يتّصلوا (زي «ورد»)، تتقسم عند حرف ما يتّصلش وتنفتح فجوة بدل الكشيدة.
     MV.headWord(t, 'سلسلة', { y, size, weight, family, fill, stroke, strokeW, alpha, margin, glow, person:true }) */
  const NONJOIN = 'اأإآٱدذرزوؤةىء';
  const isAr = ch => /[ؠ-يٱ-ۓ]/.test(ch);
  function joints(word) {            // كل المفاصل الممكنة: كشيدة بين حرفين يتّصلوا، أو فجوة عند حرف ما يتّصلش
    const out = [];
    for (let i = 0; i < word.length - 1; i++) {
      if (!isAr(word[i]) || !isAr(word[i + 1])) continue;
      out.push({ i, tatweel: !NONJOIN.includes(word[i]) });
    }
    if (!out.length) out.push({ i: Math.max(0, Math.floor(word.length / 2) - 1), tatweel: false });
    return out;
  }
  function layoutJoint(word, j, need) {
    const R = word.slice(0, j.i + 1), L = word.slice(j.i + 1);
    if (j.tatweel) {
      const tw = X.measureText('ـ').width, n = Math.max(2, Math.ceil(need / tw));
      const rW = X.measureText(R + 'ـ').width - tw;
      const run = X.measureText(R + 'ـ'.repeat(n + 1)).width - X.measureText(R + 'ـ').width;
      const text = R + 'ـ'.repeat(n) + L, total = X.measureText(text).width;
      return { parts: [text], rW, run, lW: total - rW - run };
    }
    return { parts: [R, L], rW: X.measureText(R).width, run: need, lW: X.measureText(L).width };
  }
  const HW = {};
  /* أول فريم للكلمة يقرّر المفصل والحجم (ثابتين للحظة كلها)، وبعدها الكلمة تمشي مع الراس بس */
  function fitHeadWord(word, o, span, t) {
    const fam = o.family || THEME_RAW.font || 'Cairo', weight = o.weight || 900, size0 = o.size || 130;
    const key = word + '|' + weight + '|' + size0 + '|' + fam;
    let old = HW[key];
    if (old && Math.abs(t - old.lastT) > .5) old = null;          // لحظة جديدة (قفزة في الوقت): نعاود نقرّر
    const margin = s => (o.margin != null ? o.margin : s * .22);
    if (old && old.run >= span.w + margin(old.size) * 2) { old.lastT = t; return old; }
    if (old) {                                        // الراس كبر: نفس المفصل ونفس الحجم، نطوّلوا الكشيدة بس
      X.font = old.font;
      const F = layoutJoint(word, old.j, (span.w + margin(old.size) * 2) * 1.12);
      return (HW[key] = Object.assign(F, { j: old.j, size: old.size, font: old.font, over: old.over, span: span.w, lastT: t }));
    }
    let best = null;
    for (const k of [1, .9, .8, .7, .6]) {
      const size = Math.round(size0 * k);
      X.font = `${weight} ${size}px ${fam}`;
      const need = (Math.max(span.w, old ? old.span : 0) + margin(size) * 2) * 1.12;  // 12% زيادة باش الراس يقدر يتحرك
      for (const j of joints(word)) {
        const F = layoutJoint(word, j, need);
        const xR = span.cx + F.run / 2 + F.rW, xL = xR - F.rW - F.run - F.lW;
        const over = Math.max(0, xR - (W - 24)) + Math.max(0, 24 - xL);
        const score = over * 10 + (j.tatweel ? 0 : 60) + Math.abs(F.rW - F.lW) * .15 + (1 - k) * 400;
        if (!best || score < best.score) best = Object.assign(F, { j, size, font: X.font, score, over, span: span.w });
      }
      if (best && best.over === 0) break;
    }
    if (best.over > 0) warn(`headWord: «${word}» ما تساعش جنب الراس حتى بأصغر حجم — اختار كلمة أقصر`);
    best.lastT = t;
    return (HW[key] = best);
  }
  MV.headWord = function (t, word, o = {}) {
    const size0 = o.size || 130;
    const y = o.y != null ? o.y : (MV.headTop() || 700) + size0 * .3;   // على قمّة الراس: أضيق من الكاب والودنين
    const span = MV.headSpan(y - size0 * .35, y + size0 * .3);            // جسم الحروف بس، بلا الذيول
    if (!span) { warn('headWord: ما فيش شخص مقصوص في الفريم هذا — شغّل masks للمدى هذا'); return false; }
    X.save();
    const F = fitHeadWord(word, o, span, t);
    X.font = F.font; X.direction = 'rtl'; X.textAlign = 'right'; X.textBaseline = 'middle';
    let xR = span.cx + F.run / 2 + F.rW;
    /* لو الراس تحرّك والكلمة بدت تطلع برّا، نزحزحوها داخل هامش الكشيدة بس (الحروف عمرها ما تدخل تحت الراس) */
    const slack = Math.max(0, (F.run - span.w) / 2 - F.size * .06);
    const xL = xR - F.rW - F.run - F.lW;
    if (xR > W - 24) xR -= Math.min(slack, xR - (W - 24));
    else if (xL < 24) xR += Math.min(slack, 24 - xL);
    /* لو ما زالت تطلع: نصغّروها شوية حول الراس (الكشيدة تقعد أعرض من الراس دايمًا) */
    const hc = xR - F.rW - F.run / 2, eR = xR - hc, eL = hc - (xR - F.rW - F.run - F.lW);
    let k = Math.min(1, (W - 24 - hc) / eR, (hc - 24) / eL);
    k = Math.max(k, (span.w + 8) / F.run, .6);
    if (k < 1) { X.translate(hc, y); X.scale(k, k); X.translate(-hc, -y); }
    const size = F.size;
    X.globalAlpha = o.alpha != null ? o.alpha : 1;
    const draw = fn => { if (F.parts.length === 1) fn(F.parts[0], xR); else { fn(F.parts[0], xR); fn(F.parts[1], xR - F.rW - F.run); } };
    if (o.glow) { X.shadowColor = o.glow; X.shadowBlur = size * .45; draw((s, x) => { X.fillStyle = o.glow; X.fillText(s, x, y); }); X.shadowColor = 'transparent'; }
    if (o.stroke !== false) { X.lineJoin = 'round'; X.lineWidth = o.strokeW || size * .15; X.strokeStyle = o.stroke || rgba(THEME_RAW.tealDeep || INK, .95); draw((s, x) => X.strokeText(s, x, y)); }
    X.fillStyle = o.fill || THEME_RAW.cream || '#fff'; draw((s, x) => X.fillText(s, x, y));
    X.restore();
    if (o.person !== false) MV.person();
    return { xR, y, span, run: F.run, size };
  };

  /* ── كلمة مضيئة تنوّر المكان ─────────────────────────────────
     الغرفة تغمق، والكلمة ورا الراس تولّع بلونها وتنوّر الجدار حواليها، والشخص يقعد قدّامها أوضح من الغرفة.
     MV.glowWord(t, 'فكرة', { start, end, y, size, color, dim }) — ارسمها في طبقة 'video'. */
  MV.glowWord = function (t, word, o = {}) {
    const s0 = o.start != null ? o.start : 0, s1 = o.end != null ? o.end : 1e9;
    if (t < s0 - .05 || t > s1 + .45) return false;
    const kin = outCubic(prog(t, s0, s0 + .35)), kout = prog(t, s1, s1 + .4), k = kin * (1 - kout);
    if (k <= 0) return false;
    const col = o.color || ACC, size = o.size || 140;
    const y = o.y != null ? o.y : (MV.headTop() || 700) + size * .3;
    const span = MV.headSpan(y - size * .35, y + size * .3);
    const cx = span ? span.cx : 540;
    const flick = 1 + .04 * Math.sin(t * 23) * Math.sin(t * 7.3);       // رجفة ضو خفيفة
    X.save();
    X.fillStyle = `rgba(4,6,10,${(o.dim != null ? o.dim : .5) * k})`; X.fillRect(0, 0, W, H);   // الغرفة تغمق
    X.globalCompositeOperation = 'lighter';
    const r = size * 4.2 * (.85 + .15 * kin);
    const g = X.createRadialGradient(cx, y, size * .3, cx, y, r);
    g.addColorStop(0, rgba(col, .55 * k * flick)); g.addColorStop(.35, rgba(col, .22 * k)); g.addColorStop(1, rgba(col, 0));
    X.fillStyle = g; X.fillRect(0, 0, W, H);
    X.restore();
    MV.headWord(t, word, { y, size, alpha: k, fill: '#FFFFFF', stroke: false, glow: rgba(col, .95), person: false, family: o.family, weight: o.weight });
    /* الشخص: نرجّعه بإضاءة أقل غمق من الغرفة، وحافة ضو خفيفة بلون الكلمة من فوق */
    if (PRS_OK && PRS.naturalWidth) {
      MV.person();
      X.save(); X.fillStyle = `rgba(4,6,10,${.22 * k})`; X.globalCompositeOperation = 'source-over';
      const pc = MASK.pc || (MASK.pc = Object.assign(document.createElement('canvas'), { width: W, height: H }));
      const pg = pc.getContext('2d'); pg.globalCompositeOperation = 'source-over'; pg.clearRect(0, 0, W, H); pg.drawImage(PRS, 0, 0, W, H);
      pg.globalCompositeOperation = 'source-atop'; pg.fillStyle = `rgba(4,6,10,${.22 * k})`; pg.fillRect(0, 0, W, H);
      const rim = pg.createRadialGradient(cx, y, size * .5, cx, y, size * 3); rim.addColorStop(0, rgba(col, .28 * k)); rim.addColorStop(1, rgba(col, 0));
      pg.fillStyle = rim; pg.fillRect(0, 0, W, H);
      X.drawImage(pc, 0, 0); X.restore();
    }
    return true;
  };

  /* ── قائمة تنكشف ──────────────────────────────────────────────
     كرت غامق بإطار بلون التمييز، بنوده مخفية تحت أشرطة، وكل بند ينكشف لحظة ما المتكلم ينطق كلمته،
     وشريط تمييز يمشي للبند الحالي. البنود: [{t:'Vera Health', at: MV.wordTime(6,2).s}, …]
     MV.list(t, items, { title, start, end, y, w, x, num:true, sub }) — ارسمها في الطبقة العادية. */
  MV.list = function (t, items, o = {}) {
    const start = o.start != null ? o.start : (items[0] ? items[0].at - .5 : 0);
    const end = o.end != null ? o.end : 1e9;
    if (t < start || t > end + .4) return false;
    const kin = outBack(prog(t, start, start + .4)), kout = outCubic(prog(t, end, end + .35));
    const a = clamp01(prog(t, start, start + .25)) * (1 - kout);
    if (a <= 0) return false;
    const fam = THEME_RAW.font || 'Cairo', n = items.length;
    const hasSub = items.some(it => it.sub);
    const w = o.w || 860, rowH = o.rowH || (hasSub ? 138 : 112), padY = 36, titleH = o.title ? 96 : 0;
    const h = padY * 2 + titleH + n * rowH;
    const cx = o.x || W / 2, top = (o.y != null ? o.y : 210);
    const deep = THEME_RAW.tealDeep || INK, cream = THEME_RAW.cream || '#fff';
    X.save();
    X.globalAlpha = a;
    const sc = .9 + .1 * kin - .06 * kout;
    X.translate(cx, top + h / 2); X.scale(sc, sc); X.translate(-cx, -(top + h / 2));
    const x0 = cx - w / 2;
    X.shadowColor = 'rgba(0,0,0,.35)'; X.shadowBlur = 40; X.shadowOffsetY = 16;
    X.fillStyle = rgba(deep, .93); rr(x0, top, w, h, 30); X.fill();
    X.shadowColor = 'transparent';
    X.lineWidth = 4; X.strokeStyle = ACC; rr(x0 + 8, top + 8, w - 16, h - 16, 24); X.stroke();
    X.direction = 'rtl'; X.textBaseline = 'middle';
    if (o.title) {
      X.font = `900 54px ${fam}`; X.textAlign = 'center'; X.fillStyle = ACC;
      X.fillText(o.title, cx, top + padY + titleH / 2 - 6);
      X.fillStyle = rgba(cream, .18); X.fillRect(x0 + 60, top + padY + titleH - 8, w - 120, 2);
    }
    /* البند الحالي = آخر بند انقال */
    let cur = -1; items.forEach((it, i) => { if (t >= it.at) cur = i; });
    if (cur >= 0) {                                   // شريط التمييز يمشي بنعومة بين البنود
      const prevAt = cur > 0 ? items[cur].at : items[0].at;
      const mv = outCubic(prog(t, prevAt, prevAt + .28));
      const fromY = cur > 0 ? cur - 1 : 0, yy = fromY + (cur - fromY) * mv;
      const by = top + padY + titleH + yy * rowH + 10;
      X.fillStyle = rgba(ACC, .17); rr(x0 + 28, by, w - 56, rowH - 20, 18); X.fill();
      X.fillStyle = ACC; rr(x0 + w - 36, by + 14, 7, rowH - 48, 4); X.fill();
    }
    items.forEach((it, i) => {
      const ry = top + padY + titleH + i * rowH + rowH / 2;
      const right = x0 + w - 60;
      const shown = t >= it.at, k = outCubic(prog(t, it.at, it.at + .32));
      /* الرقم */
      if (o.num !== false) {
        const pop = shown ? 1 + .25 * (1 - outBack(prog(t, it.at, it.at + .3))) : 1;
        X.save(); X.translate(right - 26, ry); X.scale(pop, pop);
        X.fillStyle = shown ? ACC : rgba(cream, .14); X.beginPath(); X.arc(0, 0, 30, 0, 7); X.fill();
        X.font = `900 34px Inter`; X.textAlign = 'center'; X.direction = 'ltr'; X.fillStyle = shown ? ON_ACC : rgba(cream, .5);
        X.fillText(String(i + 1), 0, 2); X.restore();
      }
      const tx = right - (o.num !== false ? 80 : 0), tw = w - 140 - (o.num !== false ? 60 : 0);
      X.font = `800 ${it.size || 50}px ${fam}`; X.textAlign = 'right'; X.direction = 'rtl';
      const textW = Math.min(tw, X.measureText(it.t).width);
      /* الغطاء: شريط باهت مكان النص قبل ما ينقال */
      const ty = it.sub ? ry - 16 : ry + 2;
      let subW = 0; if (it.sub) { X.font = `600 32px ${fam}`; subW = Math.min(tw, X.measureText(it.sub).width); X.font = `800 ${it.size || 50}px ${fam}`; }
      const revW = Math.max(textW, subW);
      if (k < 1) { X.fillStyle = rgba(cream, .13); rr(tx - textW * (1 - k), ty - 18, textW * (1 - k), 36, 18); X.fill(); }
      if (k > 0) {
        X.save(); X.beginPath(); X.rect(tx - revW * k - 6, ry - rowH / 2, revW * k + 12, rowH); X.clip();
        X.fillStyle = i === cur ? '#FFFFFF' : rgba(cream, .92); X.fillText(it.t, tx, ty, tw);
        if (it.sub) { X.font = `600 32px ${fam}`; X.fillStyle = rgba(cream, .62); X.fillText(it.sub, tx, ry + 30, tw); }
        X.restore();
        /* لمعة تمر على النص لحظة الانكشاف */
        if (k < 1) { const gx = tx - revW * k; const g = X.createLinearGradient(gx - 40, 0, gx + 40, 0);
          g.addColorStop(0, rgba(ACC, 0)); g.addColorStop(.5, rgba(ACC, .9)); g.addColorStop(1, rgba(ACC, 0));
          X.fillStyle = g; X.fillRect(gx - 40, ry - rowH / 2 + 14, 80, rowH - 28); }
      }
    });
    X.restore();
    return true;
  };

  /* ── التهيئة ─────────────────────────────────────────────── */
  window.init = async function (data) {
    data = data || {};
    caps = data.caps || caps;
    /* المسافة غير المنكسرة للربط فقط — نشيلها من أطراف الكلمة قبل القياس والرسم */
    const trimNb = s => String(s).replace(/^[\u00a0\s]+|[\u00a0\s]+$/g, '');
    caps.cards = (caps.cards || []).map(c => Object.assign({}, c, { w: (c.w || []).map(w => Object.assign({}, w, { t: trimNb(w.t) })) }));
    const th = Object.assign({}, data.theme || {});
    window.THEME_RAW = th;
    window.ACC = th.acc || th.mustard || '#FF5C8A';
    window.INK = th.ink || th.tealDeep || '#1D1B22';
    window.BG = th.bg || th.cream || '#FFFFFF';
    window.CLAY = th.clay || th.teal || INK;
    window.MUT = th.mut || '#6F8790';
    window.ON_ACC = th.onAcc || (luminance(ACC) > .45 ? INK : '#FFFFFF');
    MV.cards = caps.cards; MV.total = data.total || caps.total || 0; MV.fps = data.fps || 30; MV.theme = th;
    if (!window.SCENES) window.SCENES = [{ s: 0, e: 1e9, m: R_FULL }];

    const fam = th.font || 'Tajawal';
    const sample = 'الذكاء الاصطناعي AI 123';
    const loads = [400, 500, 700, 800, 900].map(w => document.fonts.load(`${w} 60px ${fam}`, sample))
      .concat([400, 700, 800, 900].map(w => document.fonts.load(`${w} 60px Inter`, 'AI 123')));
    await Promise.all(loads.map(p => p.catch(() => null)));
    if (!document.fonts.check(`700 60px ${fam}`, 'عربي')) warn(`الخط ${fam} ما تحمّلش — تأكد من ملفات الخطوط في مجلد الشغل`);

    started = true;
    for (const fn of readyFns.splice(0)) { try { fn(); } catch (e) { warn('ready: ' + e.message); } }
    return true;
  };

  /* ── تحميل الصور لكل فريم ───────────────────────────────── */
  function load(img, src) {
    return new Promise(res => {
      if (!src) return res(false);
      if (img.getAttribute('src') === src && img.complete && img.naturalWidth) return res(true);
      img.onload = () => res(true); img.onerror = () => res(false); img.src = src;
    });
  }

  /* ── الكابشن ─────────────────────────────────────────────────
     capStyle 'card'   (مهارة صلاح): كرت فاتح في الثلث السفلي، الكلمة اللي تنطق بلون التمييز، المميزة بخلفية ملوّنة.
     capStyle 'shadow' (Get Beyond): نص أبيض عريض بإطار غامق وظل فوق الراس، المميزة تتلوّن لحظة نطقها.
     capBottom = الحافة السفلية للكابشن. الجملة اللي ما تساعش سطر = صفحات متوازنة بالتتابع (سطر واحد دايمًا). */
  const STYLES = {
    /* size/min: سطر واحد يصغر لين min · لو ما ساعش: صفحات بخط pageSize (يصغر لين pageMin) */
    card:   { size: 66, min: 54, pageSize: 60, pageMin: 46, maxW: 930, wN: 700, wH: 800, padX: 42, padY: 24, gap: .30, hotPad: .36 },
    shadow: { size: 84, min: 60, pageSize: 66, pageMin: 52, maxW: 940, wN: 900, wH: 900, padX: 0, padY: 10, gap: .34, hotPad: 0 }
  };
  const capStyle = () => (THEME_RAW.capStyle === 'card' || !THEME_RAW.capStyle) ? 'card' : 'shadow';

  function wordFont(word, size, weight) {
    const latinOnly = LATIN.test(word) && !ARABIC.test(word);
    return { font: `${weight} ${latinOnly ? Math.round(size * .9) : size}px ${latinOnly ? 'Inter' : (THEME_RAW.font || 'Tajawal')}`, dir: latinOnly ? 'ltr' : 'rtl' };
  }

  function layoutCard(card) {
    if (card._lay) return card._lay;
    const S = STYLES[capStyle()];
    const measure = sz => card.w.map(w => {
      const f = wordFont(w.t, sz, w.hot ? S.wH : S.wN); X.font = f.font;
      return { w: X.measureText(w.t).width + (w.hot ? sz * S.hotPad : 0), f };
    });
    const span = (ms, sz, ids) => ids.reduce((a, i) => a + ms[i].w, 0) + (ids.length - 1) * sz * S.gap;
    const all = card.w.map((_, i) => i);
    let size = S.size, m = measure(size), pages;
    while (span(m, size, all) > S.maxW && size > S.min) { size -= 2; m = measure(size); }
    if (span(m, size, all) <= S.maxW) pages = [all];
    else {
      /* صفحات متوازنة: أقل عدد صفحات، والكلمات موزّعة بالعرض */
      size = S.pageSize; m = measure(size);
      for (let k = 2; k <= all.length; k++) {
        const target = span(m, size, all) / k; pages = [[]]; let acc = 0;
        all.forEach(i => { const cur = pages[pages.length - 1]; const add = m[i].w + (cur.length ? size * S.gap : 0);
          if (cur.length && acc + add / 2 > target && pages.length < k) { pages.push([i]); acc = m[i].w; } else { cur.push(i); acc += add; } });
        let sz = size, mm = m;
        while (pages.some(p => span(mm, sz, p) > S.maxW) && sz > S.pageMin) { sz -= 2; mm = measure(sz); }
        if (!pages.some(p => span(mm, sz, p) > S.maxW)) { size = sz; m = mm; break; }
      }
    }
    const widths = pages.map(p => span(m, size, p));
    const starts = pages.map((p, k) => k === 0 ? card.s : card.w[p[0]].s - .02);
    card._lay = { size, m, pages, widths, starts, S };
    return card._lay;
  }

  function drawCaption(t) {
    const style = capStyle();
    /* الكروت المتلاصقة (فاصل أقل من BRIDGE) تتبدّل بدون رمشة: الكرت يقعد لين يبدأ اللي بعده */
    const BRIDGE = .2, cs = caps.cards;
    const i = cs.findIndex((c, k) => t >= c.s && t < (cs[k + 1] && cs[k + 1].s - c.e < BRIDGE ? cs[k + 1].s : c.e));
    if (i < 0) return;
    const card = cs[i]; if (card.nocap || !card.w.length) return;
    const L = layoutCard(card), S = L.S;
    let pg = 0; L.starts.forEach((s0, k) => { if (t >= s0) pg = k; });
    const ids = L.pages[pg], pw = L.widths[pg], pStart = L.starts[pg];
    const lastPage = pg === L.pages.length - 1;
    const prev = cs[i - 1], next = cs[i + 1];
    const joinIn = pg > 0 || (prev && !prev.nocap && card.s - prev.e < BRIDGE);
    const joinOut = !lastPage || (next && !next.nocap && next.s - card.e < BRIDGE);
    const kin = joinIn ? 1 : outCubic(prog(t, pStart, pStart + .18));
    const kout = joinOut ? 0 : prog(t, card.e - .12, card.e);
    const a = kin * (1 - kout);
    if (a <= 0) return;

    const bottom = THEME_RAW.capBottom || (style === 'card' ? 1460 : 668);
    const lineH = L.size * (style === 'card' ? 1.42 : 1.3);
    const boxW = pw + S.padX * 2, boxH = lineH + S.padY * 2;
    const cx = W / 2, cy = bottom - boxH / 2 + (1 - kin) * (style === 'card' ? 22 : 14);
    const sc = style === 'card'
      ? (joinIn ? .985 : .955) + (joinIn ? .015 : .045) * outBack(Math.min(1, prog(t, pStart, pStart + (joinIn ? .14 : .22))))
      : (joinIn ? 1 : .97 + .03 * outCubic(prog(t, pStart, pStart + .18)));

    X.save(); X.globalAlpha = a; X.translate(cx, cy); X.scale(sc, sc); X.translate(-cx, -cy);
    if (style === 'card') {
      const bx = cx - boxW / 2, by = cy - boxH / 2;
      X.shadowColor = 'rgba(0,0,0,.28)'; X.shadowBlur = 34; X.shadowOffsetY = 12;
      X.fillStyle = rgba(THEME_RAW.cream || BG, .97); rr(bx, by, boxW, boxH, 18); X.fill();
      X.shadowColor = 'transparent';
      X.fillStyle = ACC; rr(bx + boxW - 13, by + 14, 8, boxH - 28, 4); X.fill();
    }

    /* مواقع الكلمات من اليمين لليسار */
    const y = cy + L.size * (style === 'card' ? .05 : .04);
    let x = cx + pw / 2; const pos = [];
    ids.forEach((wi, k) => { const mw = L.m[wi]; pos.push(x - mw.w / 2); x -= mw.w + (k < ids.length - 1 ? L.size * S.gap : 0); });
    const put = (wi, wx, fn) => { const mw = L.m[wi]; X.font = mw.f.font; X.direction = mw.f.dir; X.textAlign = 'center'; X.textBaseline = 'middle'; fn(card.w[wi].t, wx, mw); };
    const popScale = word => word.hot && t >= word.s ? 1 + .12 * (1 - outCubic(prog(t, word.s, word.s + .22))) : 1;

    if (style === 'card') {
      const ink = THEME_RAW.ink || INK;
      ids.forEach((wi, k) => {
        const word = card.w[wi], mw = L.m[wi], wx = pos[k];
        const said = t >= word.s, now = said && t < word.e;
        if (word.hot && said) {
          const kh = outBack(prog(t, word.s, word.s + .16));
          const hw = mw.w * (.6 + .4 * kh), hh = L.size * 1.18 * (.7 + .3 * kh);
          X.save(); X.globalAlpha *= clamp01(kh * 1.5); X.fillStyle = ACC;
          X.translate(wx, y - L.size * .05); X.rotate(-.02); rr(-hw / 2, -hh / 2, hw, hh, L.size * .22); X.fill(); X.restore();
        }
        put(wi, wx, (s) => {
          X.globalAlpha = a * (said ? 1 : .62);
          X.fillStyle = word.hot && said ? ON_ACC : now ? ACC : ink;
          const k2 = now && !word.hot ? 1 + .06 * (1 - prog(t, word.s, word.s + .2)) : 1;
          X.save(); X.translate(wx, y); X.scale(k2, k2); X.fillText(s, 0, 0); X.restore();
        });
      });
    } else {
      const edge = rgba(THEME_RAW.tealDeep || INK, .94);
      /* المرور الأول: الإطار والظل · الثاني: التعبئة — باش إطار كلمة ما يغطيش كلمة جنبها */
      ids.forEach((wi, k) => { const word = card.w[wi]; put(wi, pos[k], (s) => {
        const k2 = popScale(word); X.save(); X.translate(pos[k], y); X.scale(k2, k2);
        X.shadowColor = 'rgba(0,0,0,.55)'; X.shadowBlur = L.size * .28; X.shadowOffsetY = L.size * .08;
        X.lineJoin = 'round'; X.lineWidth = L.size * .17; X.strokeStyle = edge; X.strokeText(s, 0, 0); X.restore(); }); });
      ids.forEach((wi, k) => { const word = card.w[wi]; put(wi, pos[k], (s) => {
        const k2 = popScale(word); X.save(); X.translate(pos[k], y); X.scale(k2, k2);
        X.fillStyle = word.hot && t >= word.s ? ACC : '#FFFFFF'; X.fillText(s, 0, 0); X.restore(); }); });
    }
    X.restore();
  }

  /* ── رسم فريم واحد ───────────────────────────────────────── */
  function runLayer(list, t) {
    for (const l of list) {
      X.save();
      try { l.fn(t); } catch (e) { warn(`طبقة ${l.name}: ${e.message}`); }
      X.restore();
    }
  }

  window.drawFrame = async function (t, vfSrc, prsSrc) {
    MV.t = t;
    await load(VF, vfSrc);
    window.PRS_OK = prsSrc ? await load(PRS, prsSrc) : false;
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over';
    X.fillStyle = '#000'; X.fillRect(0, 0, W, H);
    let scene = null;
    for (const s of SCENES) if (t >= s.s && t < s.e) scene = s;   // آخر مشهد مطابق يغلب
    X.save();
    try { (scene && typeof scene.m === 'function' ? scene.m : R_FULL)(t, scene); } catch (e) { warn('مشهد: ' + e.message); R_FULL(); }
    X.restore();
    runLayer(layers.video, t);
    runLayer(layers.overlay, t);
    if (!(scene && scene.nocap)) { X.save(); try { drawCaption(t); } catch (e) { warn('كابشن: ' + e.message); } X.restore(); }
    runLayer(layers.top, t);
    return true;
  };

  window.grabFrame = function (q) { return cv.toDataURL('image/jpeg', q || .93); };
  window.engineWarnings = () => Array.from(warned);
})();
