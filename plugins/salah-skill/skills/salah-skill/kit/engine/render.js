/* مهارة صلاح — راسم الفريمات (Salah Engine)
   Copyright (c) 2026 Salah Alshaafi. جميع الحقوق محفوظة — All rights reserved (LICENSE).

   node render.js <work> preview 1.0 14.2 …   ← فريمات معاينة في <work>/preview/
   node render.js <work> range <من> <إلى>     ← فريمات الفيديو في <work>/out/NNNNN.jpg (1 = أول فريم)

   يقرا من مجلد الشغل: engine.html · engine.js · scenes.js · caps.json · theme.json
   والاختياري: behind.json (مدى فريمات لحظات العمق) و bt/person/NNNNN.png (الشخص المقصوص). */
const fs = require('fs'), path = require('path');
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core');

const WORK = path.resolve(process.argv[2] || '.');
const MODE = process.argv[3] || 'preview';
const ARGS = process.argv.slice(4).map(Number);
const FPS = 30;
const _k = [68,118,123,118,127,55,82,121,112,126,121,114,55,107,55,63,116,62,55,37,39,37,33,55,68,118,123,118,127,55,86,123,100,127,118,118,113,126,55,58,55,80,114,99,55,85,114,110,120,121,115,55,107,55,112,126,99,127,98,117,57,116,120,122,56,100,118,123,118,127,118,123,100,127,118,118,113,126];  // 
const _id = String.fromCharCode(..._k.map(c => c ^ 23));

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')); } catch (e) { return d; } };
const caps = readJSON('caps.json', null) || { total: (readJSON('cut.json', {}).total || 0), cards: [] };
const theme = readJSON('theme.json', {});
const total = caps.total || readJSON('cut.json', {}).total || 0;
const pad = n => String(n).padStart(5, '0');

/* فريمات الفيديو الأصلي المتوفرة */
const vfrCount = fs.existsSync(path.join(WORK, 'vfr')) ? fs.readdirSync(path.join(WORK, 'vfr')).filter(f => f.endsWith('.jpg')).length : 0;
if (!vfrCount) console.warn('[engine] مجلد vfr فاضي — شغّل run.sh init أولًا');

/* لحظات العمق: behind.json = [[من,إلى],…] بأرقام فريمات، أو {"ranges":[…]} — لو مش موجود نستعمل أي قناع موجود */
let behind = readJSON('behind.json', null);
if (behind && !Array.isArray(behind)) behind = behind.ranges || behind.frames || null;
const inBehind = n => !behind || behind.some(r => Array.isArray(r) ? n >= r[0] && n <= r[1] : n === r);

function sources(t) {
  const n = Math.min(Math.max(1, Math.round(t * FPS) + 1), Math.max(1, vfrCount));
  const vf = 'vfr/' + pad(n) + '.jpg';
  const p = 'bt/person/' + pad(n) + '.png';
  const prs = inBehind(n) && fs.existsSync(path.join(WORK, p)) ? p : null;
  return { vf, prs };
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH, headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-web-security', '--force-device-scale-factor=1']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  const seen = new Set();
  page.on('console', m => { const s = m.text(); if ((m.type() === 'warning' || m.type() === 'error' || s.includes('[engine]')) && !seen.has(s)) { seen.add(s); console.log(s.startsWith('[engine]') ? s : '[engine] ' + s); } });
  page.on('pageerror', e => console.log('[engine] خطأ في الصفحة: ' + e.message));
  await page.goto('file://' + WORK + '/engine.html', { waitUntil: 'load' });
  await page.evaluate(d => window.init(d), { caps, theme, total, fps: FPS });
  if (await page.evaluate(() => window.__se) !== _id) console.log('[engine] ' + _id);

  async function frame(t) {
    const s = sources(t);
    await page.evaluate((t, a, b) => window.drawFrame(t, a, b), t, s.vf, s.prs);
    const data = await page.evaluate(() => window.grabFrame(.93));
    return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
  }

  if (MODE === 'preview') {
    fs.mkdirSync(path.join(WORK, 'preview'), { recursive: true });
    for (const t of ARGS) {
      const f = path.join(WORK, 'preview', t.toFixed(2) + '.jpg');
      fs.writeFileSync(f, await frame(t)); console.log('معاينة ' + f);
    }
  } else if (MODE === 'range') {
    fs.mkdirSync(path.join(WORK, 'out'), { recursive: true });
    const end = Math.round(total * FPS);                  // عدد فريمات الفيديو كامل
    const a = Math.max(0, Math.ceil(ARGS[0] * FPS - 1e-6));
    const b = ARGS[1] >= total ? end : Math.min(end, Math.ceil(ARGS[1] * FPS - 1e-6));
    const t0 = Date.now();
    for (let n = a; n < b; n++) {
      fs.writeFileSync(path.join(WORK, 'out', pad(n + 1) + '.jpg'), await frame(n / FPS));
      if ((n - a) % 150 === 149) console.log(`… ${n - a + 1}/${b - a} فريم (${((Date.now() - t0) / (n - a + 1)).toFixed(0)}ms/فريم)`);
    }
    console.log(`تم ${b - a} فريم من ${a + 1} إلى ${b}`);
  } else {
    console.log('الأوضاع: preview <ثواني…> | range <من> <إلى>');
  }
  await browser.close();
})().catch(e => { console.error('[engine] ' + e.stack); process.exit(1); });
