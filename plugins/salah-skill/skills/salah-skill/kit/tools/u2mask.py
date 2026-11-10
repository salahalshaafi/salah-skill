# مهارة صلاح — © 2026 صلاح الشعافي (Get Beyond). جميع الحقوق محفوظة — All rights reserved (LICENSE).
"""u2net_human_seg person masks.
usage: u2mask.py <vfr_dir> <out_dir> <mode> <frame indices spec>
  mode=stats : print head-top y (in 1920 space) per frame, no files
  mode=cut   : write RGBA cutouts <out_dir>/NNNNN.png (1080x1920, temporally smoothed alpha)
               + soft edges: the alpha follows the hair in the image (guided filter) and the room colour
                 is removed from the edge pixels. SOFT=0 turns it off (hard u2net edge).
  spec: '1-300:10' or '100-220' (1-based frame numbers, inclusive)"""
import sys, os, numpy as np, cv2, onnxruntime as ort

vfr, out, mode, spec = sys.argv[1:5]
so = ort.SessionOptions(); so.intra_op_num_threads = 2
sess = ort.InferenceSession(os.path.expanduser(os.environ.get('GB_HOME','~')) + '/models/u2net_human_seg.onnx', so, providers=['CPUExecutionProvider'])
iname = sess.get_inputs()[0].name
MEAN = np.array([0.485, 0.456, 0.406], np.float32); STD = np.array([0.229, 0.224, 0.225], np.float32)


def frames(spec):
    r = []
    for part in spec.split(','):
        step = 1
        if ':' in part:
            part, step = part.split(':'); step = int(step)
        a, b = map(int, part.split('-'))
        r += list(range(a, b + 1, step))
    return r


def raw_mask(img):
    x = cv2.resize(img, (320, 320), interpolation=cv2.INTER_AREA)[:, :, ::-1].astype(np.float32) / 255.0
    x = x / max(x.max(), 1e-6)
    x = (x - MEAN) / STD
    x = x.transpose(2, 0, 1)[None]
    d = sess.run(None, {iname: x})[0][0, 0]
    d = (d - d.min()) / (d.max() - d.min() + 1e-8)
    return cv2.resize(d, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)


SOFT = os.environ.get('SOFT', '1') != '0'


def guided(I, p, r, eps):
    """فلتر موجَّه بالصورة: القناع ياخذ حواف الصورة نفسها (الشعر) — I: رمادي 0..1، p: القناع"""
    box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
    mI, mp = box(I), box(p)
    a = (box(I * p) - mI * mp) / (box(I * I) - mI * mI + eps)
    b = mp - a * mI
    return box(a) * I + box(b)


def soften(img, a):
    """حواف ناعمة بلا هالة: نشتغل في شريط رفيع حول الحافة بس، وباقي القناع يقعد زي ما هو"""
    hard = (a > .5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17))
    band = (cv2.dilate(hard, k) - cv2.erode(hard, k)).astype(bool)
    if not band.any():
        return img, a
    I = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    g = np.clip(guided(I, a.astype(np.float32), 8, 6e-3), 0, 1)
    g = cv2.GaussianBlur(g, (0, 0), 1.0)                   # بلا شوك صغيرة على الحافة
    g = np.clip((g - .12) / .80, 0, 1)                     # نشد الأطراف: ما فيش ضباب ولا لطخات خفيفة حول الشخص
    # حارس: الحافة الجديدة تتحرك 4 بكسل بس عن القديمة (لا شوك برّا، لا قضم جوّا)
    lo = cv2.erode(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    hi = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    g = np.minimum(np.maximum(g, lo), hi)
    out = a.copy(); out[band] = g[band]
    # لون الغرفة: نقدّره من البكسلات البرّانية القريبة (تمويه موزون بعكس القناع)
    bgw = (out < .02).astype(np.float32)
    f = img.astype(np.float32)
    B = cv2.GaussianBlur(f * bgw[..., None], (0, 0), 9) / (cv2.GaussianBlur(bgw, (0, 0), 9)[..., None] + 1e-4)
    al = out[..., None]
    F = (f - (1 - al) * B) / np.maximum(al, .35)            # لون الشخص الحقيقي على الحافة (بلا تضخيم للأطراف الخفيفة)
    Fc = np.clip(F, 0, 255)
    edge = (band & (out > .35) & (out < .98))[..., None]
    res = np.where(edge, Fc, f).astype(np.uint8)
    return res, out


idx = frames(spec)
os.makedirs(out, exist_ok=True)
if mode == 'stats':
    for i in idx:
        img = cv2.imread(f'{vfr}/{i:05d}.jpg')
        m = raw_mask(img)
        rows = np.where((m > 0.5).sum(1) > 40)[0]
        print(i, int(rows[0]) if len(rows) else -1, flush=True)
    sys.exit()

# cut mode: compute raw masks with 2-frame margin, then temporal smoothing [1,2,3,2,1]
ext = sorted({j for i in idx for j in range(max(1, i - 2), i + 3)})
raw = {}
for i in ext:
    p = f'{vfr}/{i:05d}.jpg'
    if not os.path.exists(p):
        continue
    small = cv2.resize(cv2.imread(p), (540, 960), interpolation=cv2.INTER_AREA)
    raw[i] = raw_mask(small)
W = {-2: 1, -1: 2, 0: 3, 1: 2, 2: 1}
for i in idx:
    acc = 0; ws = 0
    for k, w in W.items():
        if i + k in raw:
            acc = acc + raw[i + k] * w; ws += w
    A = acc / ws; M = raw[i]
    f = np.clip((np.abs(M - A) - .18) / .30, 0, 1)
    m = A + (M - A) * f
    m = np.clip((m - .30) / .45, 0, 1)
    m = cv2.GaussianBlur(m, (0, 0), 0.8)
    img = cv2.imread(f'{vfr}/{i:05d}.jpg')
    a = np.clip(cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC), 0, 1)
    if SOFT:
        img, a = soften(img, a)
    rgba = np.dstack([img, (np.clip(a, 0, 1) * 255).astype(np.uint8)])
    cv2.imwrite(f'{out}/{i:05d}.png', rgba, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    print(i, flush=True)
