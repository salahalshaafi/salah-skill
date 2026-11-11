// مهارة صلاح — © 2026 صلاح الشعافي. جميع الحقوق محفوظة — All rights reserved (LICENSE).
// node cover.js <work>  — يرسم <work>/cover.html إلى <work>/cover.png (عدّل COVER_FRAME والعنوان داخل cover.html)
const puppeteer = require(process.env.PUPPETEER_PATH || 'puppeteer-core'), fs = require('fs'), path = require('path');
const W = path.resolve(process.argv[2] || '.');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage(); await p.setViewport({ width: 1080, height: 1920 });
  await p.goto('file://' + W + '/cover.html', { waitUntil: 'networkidle0' });
  const d = await p.evaluate(() => window.render());
  fs.writeFileSync(W + '/cover.png', Buffer.from(d.split(',')[1], 'base64')); await b.close();
})();
