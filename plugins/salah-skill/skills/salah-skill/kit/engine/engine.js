/* مهارة صلاح — محرّك المونتاج (Salah Engine)
   Copyright (c) 2026 Salah Alshaafi — Get Beyond. MIT License.
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
    warn
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
