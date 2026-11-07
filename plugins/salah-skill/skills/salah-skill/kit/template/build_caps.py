# -*- coding: utf-8 -*-
# مهارة صلاح — © 2026 صلاح الشعافي (Get Beyond). جميع الحقوق محفوظة — All rights reserved (LICENSE).
"""مهارة صلاح — Build caps.json (Salah Engine format) from the corrected transcript.
Words are timed inside each VAD speech segment, proportional to length,
consuming only frames where the voice is active (RMS envelope)."""
import json, numpy as np, soundfile as sf

import os
WORK = os.environ.get('WORK', os.path.expanduser('~/gb-video/work'))
WAV = WORK + '/audio16k.wav'
OUT = WORK + '/caps.json'

# (start, end, text)  '|' = caption-card break.  '*word' = hot (mustard) word.
SEG = [
 # (بداية، نهاية، "النص")  الأوقات من c10_vad.json · '|' = فاصل كابشن · '*' = كلمة بلون التمييز
 # اسم إنقليزي من كلمتين: اربطه بـ \u00a0 (مثال: "*\u00a0Vera\u00a0Health")
 (0.10, 2.40, "السلام عليكم | هذا *مثال للكابشن"),
 (2.60, 5.20, "كل سطر هني | جملة من كلامك *بلهجتك"),
]

wav, sr = sf.read(WAV, dtype='float32')
hop = int(0.01 * sr)
rms = np.array([np.sqrt(np.mean(wav[i:i + hop] ** 2) + 1e-12) for i in range(0, len(wav) - hop, hop)])
db = 20 * np.log10(rms + 1e-9)


def active_curve(s, e):
    a, b = int(s * 100), int(e * 100)
    seg = db[a:b]
    if len(seg) == 0:
        return np.array([s]), np.array([1.0])
    thr = max(np.percentile(seg, 30), seg.max() - 32)
    w = np.clip((seg - thr) / 6.0, 0.15, 1.0)  # silence still advances a bit
    return np.arange(a, b) / 100.0, w


cards = []
for s, e, text in SEG:
    groups = [[w for w in g.split(' ') if w] for g in text.split('|')]
    words = [w for g in groups for w in g]
    lens = np.array([len(w.lstrip('*').strip('.،؟:')) + 1.2 for w in words], dtype=float)
    t, w = active_curve(s, e)
    cw = np.concatenate([[0], np.cumsum(w)]); cw /= cw[-1]
    tt = np.concatenate([t, [e]])
    share = np.concatenate([[0], np.cumsum(lens)]) / lens.sum()
    bounds = np.interp(share, cw, tt)
    k = 0
    for g in groups:
        ws = []
        for word in g:
            hot = word.startswith('*')
            ws.append({'t': word.lstrip('*'), 's': round(float(bounds[k]), 3),
                       'e': round(float(bounds[k + 1]), 3), 'hot': hot})
            k += 1
        cards.append({'s': round(ws[0]['s'] - 0.08, 3), 'e': round(ws[-1]['e'] + 0.28, 3), 'w': ws})

cards.sort(key=lambda c: c['s'])
for i in range(len(cards) - 1):
    if cards[i]['e'] > cards[i + 1]['s']:
        cards[i]['e'] = round(cards[i + 1]['s'] - 0.02, 3)
TOTAL = json.load(open(WORK + '/cut.json'))['total']
json.dump({'total': TOTAL, 'cards': cards}, open(OUT, 'w'), ensure_ascii=False, indent=1)
for i, c in enumerate(cards):
    print(f"{i:2d} {c['s']:6.2f}-{c['e']:6.2f}  " + ' '.join(('*' if x['hot'] else '') + x['t'] for x in c['w']))
