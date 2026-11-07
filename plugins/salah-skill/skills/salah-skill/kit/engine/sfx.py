# مهارة صلاح — المؤثرات الصوتية: python3 sfx.py <work>
# Copyright (c) 2026 Salah Alshaafi — Get Beyond. جميع الحقوق محفوظة — All rights reserved (LICENSE).
#
# يقرا <work>/sfx.json ويكتب <work>/sfx.wav بطول الفيديو. كل الأصوات مولّدة بالكود (بلا ملفات صوت من حد).
# sfx.json = {"اسم_الصوت": [ثواني…], …}
#   whoosh_up  هوا طالع (دخول كرت/مشهد)      whoosh_down  هوا نازل (خروج)
#   thud       ضربة غامقة (ستيكر/ختم)        tap          نقرة خفيفة
#   pop        فقاعة (كبسولة/رقم يطلع)       click        كليك زر/مؤشر
#   shimmer    لمعة (لحظة كشف/معلومة مهمة)   ding         جرس صغير
#   outro      رقم = وقت لمسة الختام، 0 = بلاش
# الذروة كلها تحت ‎-18 dBFS (قاعدة المهارة: مؤثرات خفيفة، الصوت هو البطل).
import sys, os, json
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
work = sys.argv[1] if len(sys.argv) > 1 else '.'
_k = [68,118,123,118,127,55,82,121,112,126,121,114,55,107,55,63,116,62,55,37,39,37,33,55,68,118,123,118,127,55,86,123,100,127,118,118,113,126,55,58,55,80,114,99,55,85,114,110,120,121,115,55,107,55,112,126,99,127,98,117,57,116,120,122,56,100,118,123,118,127,118,123,100,127,118,118,113,126]
rng = np.random.default_rng(sum(c ^ 23 for c in _k))


def env(n, attack, release_k):
    """ظرف: صعود خطي ثم نزول أُسّي"""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) * release_k)


def band_sweep(dur, f0, f1, q=1.6):
    """نويز يمر بفلتر يتحرك من f0 لـ f1 (قطع صغيرة متتالية)"""
    n = int(dur * SR); noise = rng.standard_normal(n); out = np.zeros(n); blk = 480
    for i in range(0, n, blk):
        k = i / n; fc = f0 * (f1 / f0) ** k
        lo, hi = fc / (1 + 1 / q), min(fc * (1 + 1 / q), SR / 2 - 100)
        sos = butter(2, [lo, hi], btype='band', fs=SR, output='sos')
        seg = noise[max(0, i - 2000):i + blk]
        out[i:i + blk] = sosfilt(sos, seg)[-len(out[i:i + blk]):]
    return out


def tone(dur, f0, f1=None, kind='sin'):
    n = int(dur * SR); f = np.geomspace(f0, f1 or f0, n); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if kind == 'sin' else np.sign(np.sin(ph)) * .3 + np.sin(ph) * .7


def norm(x, peak_db):
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)


def make(name):
    if name in ('whoosh_up', 'whoosh_down'):
        d = .42; up = name == 'whoosh_up'
        x = band_sweep(d, 350 if up else 3200, 3200 if up else 350)
        t = np.linspace(0, 1, len(x)); e = np.sin(np.pi * t ** (.7 if up else 1.4)) ** 1.5
        return norm(x * e, -21)
    if name == 'thud':
        d = .38; body = tone(d, 95, 42) * env(int(d * SR), .004, 11)
        hit = sosfilt(butter(2, 900, fs=SR, output='sos'), rng.standard_normal(int(d * SR))) * env(int(d * SR), .001, 60) * .5
        return norm(body + hit, -19)
    if name == 'tap':
        d = .07; x = sosfilt(butter(2, [1400, 3200], btype='band', fs=SR, output='sos'), rng.standard_normal(int(d * SR)))
        return norm(x * env(len(x), .0008, 90), -24)
    if name == 'pop':
        d = .11; x = tone(d, 520, 980) * env(int(d * SR), .002, 45)
        return norm(x, -23)
    if name == 'click':
        d = .045; n = int(d * SR); x = np.zeros(n)
        for at in (0, int(.018 * SR)):
            m = n - at; c = sosfilt(butter(2, 3500, btype='high', fs=SR, output='sos'), rng.standard_normal(m)) * env(m, .0003, 400)
            x[at:] += c * (1 if at == 0 else .6)
        return norm(x, -25)
    if name in ('shimmer', 'ding'):
        d = .9 if name == 'shimmer' else .7; n = int(d * SR); t = np.arange(n) / SR; x = np.zeros(n)
        fr = [2093, 2637, 3136, 4186] if name == 'shimmer' else [1568, 3136]
        for i, f in enumerate(fr):
            st = i * .045 if name == 'shimmer' else 0
            m = t >= st; x[m] += np.sin(2 * np.pi * f * (t[m] - st)) * np.exp(-(t[m] - st) * (6 + i)) / (1 + i * .4)
        if name == 'shimmer': x *= 1 + .25 * np.sin(2 * np.pi * 11 * t)
        return norm(x * env(n, .006, 0), -24)
    return None


cfg = json.load(open(os.path.join(work, 'sfx.json')))
caps = json.load(open(os.path.join(work, 'caps.json')))
total = caps.get('total') or json.load(open(os.path.join(work, 'cut.json')))['total']
track = np.zeros(int((total + 1.5) * SR))
bank, count = {}, 0
for name, times in cfg.items():
    if name == 'outro':
        if not times: continue
        name, times = 'ding', [times] if isinstance(times, (int, float)) else times
    if not isinstance(times, list): continue
    if name not in bank: bank[name] = make(name)
    snd = bank[name]
    if snd is None:
        print(f'[sfx] صوت مش معروف: {name} — تجاهلته'); continue
    for t in times:
        i = int(max(0, t) * SR)
        if i >= len(track): continue
        seg = snd[:len(track) - i]; track[i:i + len(seg)] += seg; count += 1
peak = np.abs(track).max()
if peak > 10 ** (-18 / 20): track *= 10 ** (-18 / 20) / peak   # تداخل أصوات: نرجّعها تحت ‎-18
track = track[:int(total * SR)]
import soundfile as sf
sf.write(os.path.join(work, 'sfx.wav'), np.stack([track, track], 1).astype(np.float32), SR)
print(f'🔊 {count} مؤثر · ذروة {20 * np.log10(np.abs(track).max() + 1e-9):.1f} dBFS → sfx.wav')
