#!/bin/bash
# مهارة صلاح — ضبط مستوى الصوت للمنصات: bash master.sh <in.mp4> <out.mp4>
# Copyright (c) 2026 Salah Alshaafi. جميع الحقوق محفوظة — All rights reserved (LICENSE).
# جولتين loudnorm: الأولى تقيس، الثانية تطبّق بدقة → ‎-14 LUFS، ذروة حقيقية ‎-1 dBTP. الصورة تتنسخ بلا إعادة ترميز.
set -e
IN="$1"; OUT="$2"; I=${LUFS:--14}; TP=-1.5; LRA=11
M=$(ffmpeg -hide_banner -nostats -i "$IN" -vn -af "loudnorm=I=$I:TP=$TP:LRA=$LRA:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -i "$IN" -map 0:v -map 0:a -c:v copy \
  -af "loudnorm=I=$I:TP=$TP:LRA=$LRA:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -y "$OUT"
R=$(ffmpeg -hide_banner -nostats -i "$OUT" -vn -af "loudnorm=I=$I:TP=$TP:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
echo "$R" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f\"🎚️ {d['input_i']} LUFS · ذروة {d['input_tp']} dBTP → $(basename "$OUT")\")"
