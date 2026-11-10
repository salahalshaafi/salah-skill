# مهارة صلاح — توقيت الكلمة على موجة الصوت: python3 align.py <work>
# © 2026 صلاح الشعافي (Get Beyond). جميع الحقوق محفوظة — All rights reserved (LICENSE).
#
# التفريغ الآلي يعطي بداية الكلمة بالتقريب، والغلط يبان أكثر بعد سكتة (الكابشن يطلع والمتكلم ساكت، أو يتأخر عليه).
# الأداة هذي تقرا طاقة الصوت كل 5 ملّي ثانية، ولكل كلمة جاية بعد سكتة تحط بدايتها على أول حافة للصوت بالضبط.
# تعدّل caps.json في مكانه، ومرة وحدة بس (تحط علامة aligned). لازم تنعاد بعد كل build_caps.py.
import sys, os, json
import numpy as np
import soundfile as sf

work = sys.argv[1] if len(sys.argv) > 1 else '.'
cp = os.path.join(work, 'caps.json')
caps = json.load(open(cp, encoding='utf-8'))
if caps.get('aligned'):
    print('⏱️ الكابشن متضبط على الموجة من قبل — عاود build_caps.py لو تبي تعاود'); sys.exit(0)

wav = os.path.join(work, 'audio16k.wav')
x, sr = sf.read(wav, dtype='float32')
if x.ndim > 1: x = x.mean(1)
HOP, WIN = int(sr * .005), int(sr * .02)
pad = np.pad(x, (WIN // 2, WIN // 2))
n = len(x) // HOP
frames = np.lib.stride_tricks.sliding_window_view(pad, WIN)[::HOP][:n]
db = 10 * np.log10((frames.astype(np.float64) ** 2).mean(1) + 1e-10)
db = np.convolve(db, np.ones(3) / 3, mode='same')          # تنعيم خفيف
floor = np.percentile(db, 10)                               # مستوى السكوت في الفيديو
f = lambda t: int(round(t / .005))
tm = lambda i: i * .005

BACK, FWD = .15, .20      # نبحث من 150ms قبل التقدير لين 200ms بعده
QUIET, LOUD = 10.0, 14.0  # سكوت = أقل من 10 dB فوق الأرضية · صوت = أكثر من 14
PAUSE = 8                 # السكتة لازم تكون 40ms على الأقل
moved, shifts = 0, []
prev_s = -1.0
used = set()              # كل حافة صوت تاخذها كلمة وحدة بس
quiet = db < floor + QUIET
# «بداية بعد سكتة»: أول فريم عالي بعد 40ms سكوت — هنا بس التوقيت يبان غلط للعين.
# داخل الكلام المتصل الوديان بين المقاطع مش بين الكلمات، فنخلّي توقيت التفريغ.
starts = [j for j in range(PAUSE, n) if db[j] > floor + LOUD and quiet[j - PAUSE:j - 1].all()
          and not (db[j - 1] > floor + LOUD)]
starts = np.array(starts)
# نرجّع كل بداية لأول فريم طالع من السكوت (حافة الصوت)
edge = {}
for j in starts:
    k = j
    while k > 0 and not quiet[k - 1]: k -= 1
    edge[j] = k

for card in caps['cards']:
    for k, w in enumerate(card.get('w', [])):
        s, e = w['s'], w['e']
        if not len(starts):
            break
        near = starts[(starts >= f(s - BACK)) & (starts <= f(min(s + FWD, e - .04)))]
        if not len(near):
            prev_s = s; continue
        j = int(min(near, key=lambda c: abs(tm(c) - s)))
        hit = edge[j]
        # الكلمة اللي قبلها لازم تكون قبل السكتة، والحافة ما خذتهاش كلمة ثانية
        if j in used or tm(hit) <= prev_s + .08:
            prev_s = s; continue
        used.add(j)
        ns = tm(hit) - .015                                  # 15ms قبل الطلعة: العين تسبق الأذن شوية
        ns = max(ns, prev_s + .05)
        if abs(ns - s) >= .02 and ns < e - .05:
            shifts.append(ns - s); w['s'] = round(ns, 3); moved += 1
        prev_s = w['s']
    if card.get('w'):
        card['s'] = round(min(card['s'], card['w'][0]['s']), 3)

# كلمة ما تبداش قبل نهاية اللي قبلها بزيادة، ونهاية الكلمة بعد بدايتها
for card in caps['cards']:
    ws = card.get('w', [])
    for i in range(len(ws) - 1):
        if ws[i]['e'] > ws[i + 1]['s']: ws[i]['e'] = ws[i + 1]['s']
        if ws[i]['e'] <= ws[i]['s']: ws[i]['e'] = round(ws[i]['s'] + .05, 3)

caps['aligned'] = True
json.dump(caps, open(cp, 'w', encoding='utf-8'), ensure_ascii=False)
total = sum(len(c.get('w', [])) for c in caps['cards'])
if shifts:
    sh = np.array(shifts) * 1000
    print(f'⏱️ {moved}/{total} كلمة اتضبطت على الموجة · متوسط الإزاحة {sh.mean():+.0f}ms (من {sh.min():+.0f} لين {sh.max():+.0f})')
else:
    print(f'⏱️ 0/{total} كلمة احتاجت ضبط')
