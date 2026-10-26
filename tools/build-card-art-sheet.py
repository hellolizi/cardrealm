"""生成卡面联排预览图（docs/card-art-sheet.jpg）。"""
import json
import os
import re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "js", "card-art-manifest.js")
ART_DIR = os.path.join(ROOT, "assets", "cards")
OUT = os.path.join(ROOT, "docs", "card-art-sheet.jpg")

CELL_W, CELL_H = 240, 180
COLS = 12


def main():
    src = open(MANIFEST, encoding="utf-8").read()
    ids = re.findall(r"'([A-Za-z0-9_-]+)':\s*\{\s*src:", src)
    files = [os.path.join(ART_DIR, f"{cid}.webp") for cid in ids]
    files = [f for f in files if os.path.exists(f)]
    print(f"联排 {len(files)} 张")

    rows = (len(files) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL_W, rows * CELL_H), (18, 14, 24))
    for index, path in enumerate(files):
        img = Image.open(path).convert("RGB")
        img.thumbnail((CELL_W, CELL_H), Image.LANCZOS)
        x = (index % COLS) * CELL_W + (CELL_W - img.width) // 2
        y = (index // COLS) * CELL_H + (CELL_H - img.height) // 2
        sheet.paste(img, (x, y))
    sheet.save(OUT, "JPEG", quality=82, optimize=True)
    print("写出", OUT, os.path.getsize(OUT) // 1024, "KB", sheet.size)


if __name__ == "__main__":
    main()