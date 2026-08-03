#!/bin/sh
set -eu
root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
fixture="$root/app/src/test/resources/fixtures/valid"
mkdir -p "$fixture/audio"
python3 - "$fixture/audio/sample.wav" <<'PY'
import math, struct, sys, wave
with wave.open(sys.argv[1], 'w') as w:
    w.setparams((1, 2, 8000, 8000, 'NONE', 'not compressed'))
    w.writeframes(b''.join(struct.pack('<h', int(900*math.sin(2*math.pi*220*i/8000))) for i in range(8000)))
PY
(cd "$fixture" && zip -q -r ../valid.nz manifest.json experience.html cover.svg audio credits.json rights.json edition.json authenticity.json technical.json lyrics.lrc)
