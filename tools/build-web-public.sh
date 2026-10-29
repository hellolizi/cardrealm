#!/usr/bin/env bash
# 生成 GitHub Pages 用的单机网页目录：保留工坊，只收起联机入口。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/web-public"

rm -rf "$OUT"
mkdir -p "$OUT"
cp "$ROOT/index.html" "$OUT/"
cp -a "$ROOT/css" "$ROOT/js" "$ROOT/assets" "$OUT/"

"${PYTHON:-python3}" - "$OUT/index.html" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
anchor = '<meta name="theme-color" content="#0d0a10">'
if anchor not in text:
    raise SystemExit("index.html 缺少 theme-color 锚点")
if 'name="cardrealm-online"' not in text:
    text = text.replace(
        anchor,
        anchor + '\n  <meta name="cardrealm-online" content="off">',
        1,
    )
    path.write_text(text, encoding="utf-8", newline="\n")
PY

if ! grep -q 'name="cardrealm-online" content="off"' "$OUT/index.html"; then
    echo "联机开关注入失败" >&2
    exit 1
fi

printf '网页单机版目录：%s\n' "$OUT"
du -sh "$OUT"