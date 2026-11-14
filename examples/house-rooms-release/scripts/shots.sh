#!/bin/sh
# Captures a still of each stop in headless Chrome: scripts/shots.sh <outdir> [extra query] [WxH]
OUT="$1"; Q="$2"; SIZE="${3:-1440,900}"; mkdir -p "$OUT"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for v in outside hall amber blue green; do
  "$CH" --headless=new --use-angle=metal --hide-scrollbars --window-size="$SIZE" --virtual-time-budget=6000 --screenshot="$OUT/$v.png" "http://localhost:4311/experience.html?view=$v$Q" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 82 -Z 1200 "$OUT/$v.png" --out "$OUT/$v.jpg" >/dev/null 2>&1; rm -f "$OUT/$v.png"
done; ls "$OUT"
