# مهارة صلاح — © 2026 صلاح الشعافي. جميع الحقوق محفوظة — All rights reserved (LICENSE).
import os
import sys, json, numpy as np, soundfile as sf, sherpa_onnx
M = os.path.expanduser(os.environ.get('GB_HOME','~')) + '/models/sherpa-onnx-whisper-turbo/'
wav, sr = sf.read(sys.argv[1], dtype='float32')
cfg = sherpa_onnx.VadModelConfig()
cfg.silero_vad.model = os.path.expanduser(os.environ.get('GB_HOME','~')) + '/models/silero_vad.onnx'
cfg.silero_vad.min_silence_duration = 0.15
cfg.silero_vad.min_speech_duration = 0.1
cfg.silero_vad.max_speech_duration = 20
cfg.silero_vad.threshold = 0.4
cfg.sample_rate = sr
vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=200)
ws = cfg.silero_vad.window_size
i = 0
segs = []


def drain():
    while not vad.empty():
        s = vad.front
        segs.append([s.start / sr, (s.start + len(s.samples)) / sr])
        vad.pop()


while i < len(wav):
    vad.accept_waveform(wav[i:i + ws]); i += ws; drain()
vad.flush(); drain()
json.dump(segs, open(sys.argv[2].replace('.json', '_vad.json'), 'w'))
MAXC = float(sys.argv[3]) if len(sys.argv) > 3 else 24
chunks = []; cur = []
for s in segs:
    if cur and (s[1] - cur[0][0] > MAXC):
        chunks.append(cur); cur = []
    cur.append(s)
if cur: chunks.append(cur)
rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=M + 'turbo-encoder.int8.onnx', decoder=M + 'turbo-decoder.int8.onnx',
    tokens=M + 'turbo-tokens.txt', language='ar', task='transcribe', num_threads=2, tail_paddings=8000)
out = []
for ch in chunks:
    a = max(0, int((ch[0][0] - 0.3) * sr)); b = min(len(wav), int((ch[-1][1] + 0.4) * sr))
    st = rec.create_stream(); st.accept_waveform(sr, wav[a:b]); rec.decode_stream(st)
    try:
        txt = st.result.text.strip()
    except Exception as e:
        txt = '<<decode error>>'
    out.append({'s': ch[0][0], 'e': ch[-1][1], 'speech': ch, 'text': txt})
    print(f"{ch[0][0]:7.2f}-{ch[-1][1]:7.2f} {txt}", flush=True)
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
