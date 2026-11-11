# مهارة صلاح — ملف الترجمة: python3 srt.py <work> <اسم>  → <work>/<اسم>.srt
# Copyright (c) 2026 Salah Alshaafi. جميع الحقوق محفوظة — All rights reserved (LICENSE).
# كل كرت كابشن = سطر ترجمة بنفس توقيته (النص بلهجة المتكلم، بلا علامات التمييز).
import sys, os, json

work = sys.argv[1] if len(sys.argv) > 1 else '.'
name = sys.argv[2] if len(sys.argv) > 2 else 'ad-master'
cards = json.load(open(os.path.join(work, 'caps.json')))['cards']


def ts(x):
    ms = int(round(max(0, x) * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


rows = []
for c in cards:
    text = ' '.join(w['t'].replace(' ', ' ').strip() for w in c.get('w', [])).strip()
    if text: rows.append((c['s'], c['e'], ' '.join(text.split())))
for i in range(len(rows) - 1):                       # بلا تداخل بين الأسطر
    if rows[i][1] > rows[i + 1][0]: rows[i] = (rows[i][0], rows[i + 1][0] - .01, rows[i][2])
out = os.path.join(work, name + '.srt')
with open(out, 'w', encoding='utf-8') as f:
    for i, (s, e, t) in enumerate(rows, 1): f.write(f'{i}\n{ts(s)} --> {ts(e)}\n{t}\n\n')
print(f'📝 {len(rows)} سطر → {os.path.basename(out)}')
