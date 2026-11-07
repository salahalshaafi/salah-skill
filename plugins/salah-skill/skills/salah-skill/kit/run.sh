#!/bin/bash
# Get Beyond Video — خطوات المونتاج (بيئة سحابية لينكس). كل خطوة تنشغل لحالها:
#   bash run.sh setup              ← أدوات + موديلات + خطوط (مرة بالجلسة)
#   bash run.sh init <video.mp4>   ← مجلد شغل + فريمات + صوت
#   bash run.sh palette [اسم]     ← لون الفيديو: يتبدّل تلقائياً عن آخر فيديو (الأسلوب نفسه)
#   bash run.sh transcribe         ← تفريغ بقطع 10 و15 ث (اقرأ t10.log و t15.log وصحّح بنفسك)
#   bash run.sh masks "1-100,2290-2500"   ← قصّ الشخص للحظات العمق (أرقام فريمات)
#   bash run.sh preview 1.0 14.2 …        ← معاينة + sheet.jpg
#   bash run.sh render             ← رسم كل الفريمات (نصفين بالتوازي)
#   bash run.sh encode             ← صوت نظيف + مؤثرات + الغلاف أول فريم + ‎-14 LUFS + srt
set -e
KIT="$(cd "$(dirname "$0")" && pwd)"
GB_HOME="${GB_HOME:-$HOME}"; WORK="${WORK:-$GB_HOME/gb-video/work}"
# مؤقت (لين الجلسة 2): خطوة encode بس تستعمل سكربتات الصوت والترجمة من ماجد. الرسم كله صار من engine/.
MAJED=$GB_HOME/video-ad-editor/video-ad-editor; MAJED_COMMIT=886cae69add821367f6c7bb9d9115a34e2427b21
M=$GB_HOME/models; T=$GB_HOME/gbtools; FONTS=$GB_HOME/fonts
GF=https://raw.githubusercontent.com/google/fonts/main/ofl
export PUPPETEER_PATH=$T/node_modules/puppeteer-core
export CHROME_PATH="${CHROME_PATH:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux64/chrome 2>/dev/null | head -1)}"
S=$MAJED/scripts
case "$1" in
setup)
  [ -d $GB_HOME/video-ad-editor ] || { git clone https://github.com/majedphotos/video-ad-editor.git $GB_HOME/video-ad-editor; git -C $GB_HOME/video-ad-editor checkout -q $MAJED_COMMIT; }
  mkdir -p $M $T; cd $T; [ -f package.json ] || npm init -y >/dev/null; npm i -s puppeteer-core@23.11.1
  pip install -q --break-system-packages sherpa-onnx soundfile onnxruntime opencv-python-headless pillow
  # الخطوط (SIL OFL) من مستودع Google Fonts
  mkdir -p $FONTS; for w in Regular Medium Bold ExtraBold Black; do [ -s $FONTS/Tajawal-$w.ttf ] || curl -sfL -o $FONTS/Tajawal-$w.ttf $GF/tajawal/Tajawal-$w.ttf; done
  [ -s $FONTS/Inter-VF.ttf ] || curl -sfL -o $FONTS/Inter-VF.ttf "$GF/inter/Inter%5Bopsz,wght%5D.ttf"
  [ -s $FONTS/Cairo-VF.ttf ] || curl -sfL -o $FONTS/Cairo-VF.ttf "$GF/cairo/Cairo%5Bslnt,wght%5D.ttf"
  # huggingface محجوب بالسحابة — الموديلات من GitHub releases
  [ -d $M/sherpa-onnx-whisper-turbo ] || (cd $M && curl -sL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2 | tar xj)
  [ -f $M/silero_vad.onnx ] || curl -sL -o $M/silero_vad.onnx https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
  [ -f $M/u2net_human_seg.onnx ] || curl -sL -o $M/u2net_human_seg.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx
  echo "✅ setup";;
init)
  mkdir -p $WORK/vfr $WORK/bt/person; cd $WORK
  ln -sf "$(realpath "$2")" src.mp4
  cp $KIT/engine/engine.html $KIT/engine/engine.js $KIT/kit/theme.json $KIT/kit/cover.html . ; cp $FONTS/*.ttf .
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 src.mp4)
  python3 -c "import json;d=round($D,3);json.dump({'keep':[[0,d]],'total':d,'src_dur':d,'tail':0},open('cut.json','w'))"
  ffmpeg -v error -i src.mp4 -vf fps=30 -q:v 3 -y vfr/%05d.jpg
  ffmpeg -v error -i src.mp4 -ac 1 -ar 16000 -y audio16k.wav
  ffmpeg -v error -i src.mp4 -vn -c:a copy -y voice_src.m4a
  echo "✅ init — المدة $D ث · $(ls vfr | wc -l) فريم";;
palette)
  cd $WORK; python3 - "$KIT" "$2" <<'PY'
import json, sys
kit, want = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else '')
P = json.load(open(kit + '/kit/palettes.json')); H = json.load(open(kit + '/palette-history.json'))['history']
last = H[-1]['palette'] if H else None; order = P['order']
name = want or order[(order.index(last) + 1) % len(order) if last in order else 0]
c = P['palettes'][name]; t = json.load(open('theme.json'))
t.update({k: c[k] for k in ('mustard', 'tealDeep', 'teal', 'cream', 'ink', 'good', 'bad')})
t.update({'acc': c['mustard'], 'clay': c['teal'], 'ink': c['ink'], 'onAcc': c['ink'], 'bg': c['cream'], 'palette': name})
json.dump(t, open('theme.json', 'w'), ensure_ascii=False, indent=1)
print('🎨', name, '—', c['label'], '(آخر فيديو:', last, ')  ← سجّله بـ palette-history.json بعد التسليم')
PY
  ;;
transcribe)
  cd $WORK; python3 $KIT/tools/transcribe2.py audio16k.wav c10.json 10 > t10.log 2>&1; python3 $KIT/tools/transcribe2.py audio16k.wav c15.json 15 > t15.log 2>&1
  cat t10.log; echo ====; cat t15.log; echo "مقاطع الكلام (VAD): c10_vad.json — جمل غامضة: python3 $KIT/tools/win.py audio16k.wav 39.7-42.2 …";;
masks)
  cd $WORK; python3 $KIT/tools/u2mask.py vfr bt/person cut "$2" > mask.log 2>&1; ls bt/person | wc -l;;
preview)
  cd $WORK; shift; cp $KIT/engine/engine.js .; node $KIT/engine/render.js . preview "$@" | grep -v "^معاينة" || true; python3 $KIT/engine/sheet.py . sheet.jpg "$@";;
render)
  cd $WORK; rm -rf out; mkdir out; D=$(python3 -c "import json;print(json.load(open('caps.json'))['total'])"); H=$(python3 -c "print(round($D/2,2))")
  cp $KIT/engine/engine.js .
  node $KIT/engine/render.js . range 0 $H > r1.log 2>&1 & node $KIT/engine/render.js . range $H $D > r2.log 2>&1 & wait
  grep -h "engine\]" r1.log r2.log | sort -u || true; echo "فريمات: $(ls out | grep -c jpg)";;
encode)
  cd $WORK; D=$(python3 -c "import json;print(json.load(open('caps.json'))['total'])"); F=$(python3 -c "print(round($D-0.45,3))")
  python3 $S/05_sfx.py .
  ffmpeg -v error -i voice_src.m4a -af "highpass=f=75,afftdn=nr=6:nf=-35,acompressor=threshold=-22dB:ratio=2.2:attack=12:release=180:makeup=2" -c:a aac -b:a 256k -ar 48000 -y cutz.mp4
  [ -f cover.png ] || node $KIT/tools/cover.js .
  N=$(ls out | grep -c jpg)
  ffmpeg -v error -nostats -framerate 30 -i out/%05d.jpg -loop 1 -i cover.png -i cutz.mp4 -i sfx.wav -filter_complex "[1:v]format=rgba,trim=end_frame=3[cv];[0:v][cv]overlay=0:0:eof_action=pass,scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p[vo];[2:a]aresample=48000,apad=pad_dur=2[a0];[3:a]aresample=48000[s];[a0][s]amix=inputs=2:duration=first:normalize=0[am];[am]atrim=0:$D,asetpts=PTS-STARTPTS,afade=t=out:st=$F:d=0.45[ao]" -map "[vo]" -map "[ao]" -frames:v $N -c:v libx264 -preset veryfast -crf 21 -maxrate 6M -bufsize 12M -profile:v high -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -r 30 -c:a aac -b:a 192k -ar 48000 -movflags +faststart -y ad-final.mp4
  bash $S/06b_master.sh . ad-final.mp4 ad-master.mp4 | tail -2
  python3 $S/09_srt.py . ad-master | tail -2;;
*) sed -n 2,10p "$0";;
esac
