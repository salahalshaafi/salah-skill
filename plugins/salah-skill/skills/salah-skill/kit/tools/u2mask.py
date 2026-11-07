# مهارة صلاح — © 2026 صلاح الشعافي (Get Beyond). جميع الحقوق محفوظة — All rights reserved (LICENSE).
"""u2net_human_seg person masks.
usage: u2mask.py <vfr_dir> <out_dir> <mode> <frame indices spec>
  mode=stats : print head-top y (in 1920 space) per frame, no files
  mode=cut   : write RGBA cutouts <out_dir>/NNNNN.png (1080x1920, temporally smoothed alpha)
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
    a = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
    rgba = np.dstack([img, (np.clip(a, 0, 1) * 255).astype(np.uint8)])
    cv2.imwrite(f'{out}/{i:05d}.png', rgba, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    print(i, flush=True)
