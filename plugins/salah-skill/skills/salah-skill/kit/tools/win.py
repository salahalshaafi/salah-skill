# مهارة صلاح — © 2026 صلاح الشعافي (Get Beyond). جميع الحقوق محفوظة — All rights reserved (LICENSE).
import os
import sys, soundfile as sf, sherpa_onnx
M = os.path.expanduser(os.environ.get('GB_HOME','~')) + '/models/sherpa-onnx-whisper-turbo/'
wav, sr = sf.read(sys.argv[1], dtype='float32')
rec = sherpa_onnx.OfflineRecognizer.from_whisper(
    encoder=M + 'turbo-encoder.int8.onnx', decoder=M + 'turbo-decoder.int8.onnx',
    tokens=M + 'turbo-tokens.txt', language='ar', task='transcribe', num_threads=2, tail_paddings=16000)
for w in sys.argv[2:]:
    a, b = map(float, w.split('-'))
    st = rec.create_stream(); st.accept_waveform(sr, wav[int(a * sr):int(b * sr)]); rec.decode_stream(st)
    try:
        txt = st.result.text.strip()
    except Exception:
        txt = '<<err>>'
    print(f'{a:6.2f}-{b:6.2f} | {txt}', flush=True)
