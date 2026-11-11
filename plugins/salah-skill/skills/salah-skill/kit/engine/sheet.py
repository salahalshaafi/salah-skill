# مهارة صلاح — لوحة معاينة: python3 sheet.py <work> [out.jpg] [ثواني…]
# تجمع فريمات preview/ في شبكة وحدة مع الوقت تحت كل فريم.
# Copyright (c) 2026 Salah Alshaafi. جميع الحقوق محفوظة — All rights reserved (LICENSE).
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont

work = sys.argv[1] if len(sys.argv) > 1 else '.'
out = sys.argv[2] if len(sys.argv) > 2 else 'sheet.jpg'
want = sys.argv[3:]
files = [os.path.join(work, 'preview', f'{float(t):.2f}.jpg') for t in want] if want else sorted(
    glob.glob(os.path.join(work, 'preview', '*.jpg')), key=lambda p: float(os.path.basename(p)[:-4]))
files = [f for f in files if os.path.exists(f)]
if not files:
    sys.exit('ما فيش فريمات معاينة')
TW, TH, LAB, GAP = 360, 640, 34, 12
cols = min(len(files), 4)
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * TW + (cols + 1) * GAP, rows * (TH + LAB) + (rows + 1) * GAP), (24, 24, 28))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype(os.path.join(work, 'Inter-VF.ttf'), 24)
except Exception:
    font = ImageFont.load_default()
for i, f in enumerate(files):
    r, c = divmod(i, cols)
    x, y = GAP + c * (TW + GAP), GAP + r * (TH + LAB + GAP)
    sheet.paste(Image.open(f).convert('RGB').resize((TW, TH), Image.LANCZOS), (x, y))
    d.text((x + TW // 2, y + TH + LAB // 2), os.path.basename(f)[:-4] + 's', fill=(235, 235, 235), font=font, anchor='mm')
sheet.save(os.path.join(work, out), quality=88)
print(os.path.join(work, out))
