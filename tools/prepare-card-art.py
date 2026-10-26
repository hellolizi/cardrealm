#!/usr/bin/env python
"""把 AI 生图原图处理成游戏卡面。

- 自动识别右下角的模型水印，裁掉含水的部分
- 裁成 4:3，压到 1024x768，导出 webp
- 欠曝的 AI 原图按平均亮度反推 gamma 提亮，保留黑色与高光

用法：
  python tools/prepare-card-art.py --src assets/cards/raw/xxx.png --id sunder
  python tools/prepare-card-art.py --all            # 按 IDS 表批量处理
  python tools/prepare-card-art.py --relight        # 提亮 assets/cards 里已有的卡面
"""
import argparse
import os
from pathlib import Path

from PIL import Image, ImageEnhance, ImageStat

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art-source" / "cards"
OUT = ROOT / "assets" / "cards"

TARGET_W, TARGET_H = 1024, 768
TARGET_MEAN = 46.0
TARGET_TOLERANCE = 1.0
MIN_LIFT_GAMMA = 0.42


def luminance_mean(image):
    return ImageStat.Stat(image.convert("L")).mean[0]


def gamma_table(gamma):
    return [min(255, round(255 * ((value / 255) ** gamma))) for value in range(256)]


def auto_lift(image, target=TARGET_MEAN):
    """只压暗部和中调，0 与 255 保持不变，避免洗掉原本的高光。"""
    mean = luminance_mean(image)
    if mean >= target - TARGET_TOLERANCE:
        return image, mean, 1.0

    histogram = image.convert("L").histogram()
    total = sum(histogram)

    def lifted_mean(gamma):
        table = gamma_table(gamma)
        return sum(table[value] * count for value, count in enumerate(histogram)) / total

    low, high = MIN_LIFT_GAMMA, 1.0
    if lifted_mean(low) >= target:
        for _ in range(18):
            mid = (low + high) / 2
            if lifted_mean(mid) < target:
                high = mid
            else:
                low = mid
        gamma = low
    else:
        gamma = low

    lifted = image.point(gamma_table(gamma) * 3)
    return lifted, mean, gamma


def watermark_box(image):
    """在右下角找浅色水印文字的包围盒。"""
    width, height = image.size
    left, top = int(width * 0.85), int(height * 0.84)
    region = image.crop((left, top, width, height)).convert("RGB")
    pixels = region.load()
    rw, rh = region.size
    xs, ys = [], []
    for y in range(rh):
        for x in range(rw):
            r, g, b = pixels[x, y]
            if min(r, g, b) > 118 and max(r, g, b) - min(r, g, b) < 30:
                xs.append(x)
                ys.append(y)
    if len(xs) < 30:
        return None
    return (left + min(xs), top + min(ys), left + max(xs), top + max(ys))


def crop_excluding(image, box):
    """裁出最大 4:3 区域，且不覆盖 box（水印）。"""
    width, height = image.size
    if box:
        max_h = box[1] - 10
    else:
        max_h = height
    crop_h = min(max_h, height, int(width * TARGET_H / TARGET_W))
    crop_w = int(round(crop_h * TARGET_W / TARGET_H))
    if crop_w > width:
        crop_w = width
        crop_h = int(round(crop_w * TARGET_H / TARGET_W))
    x = (width - crop_w) // 2
    y = 0
    if box:
        # 若横向恰好会盖到水印，整体左移
        while x + crop_w > box[0] and y + crop_h > box[1] and x > 0:
            x -= 4
    return image.crop((x, y, x + crop_w, y + crop_h))


def prepare(src, card_id, suffix=""):
    image = Image.open(src).convert("RGB")
    box = watermark_box(image)
    cropped = crop_excluding(image, box)
    resized = cropped.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    resized = ImageEnhance.Contrast(resized).enhance(1.03)
    resized, before, gamma = auto_lift(resized)
    out = OUT / f"{card_id}{suffix}.webp"
    resized.save(out, "WEBP", quality=86, method=6)
    return out, box, cropped.size, before, gamma


def relight_existing():
    changed = 0
    skipped = 0
    for out in sorted(OUT.glob("*.webp")):
        image = Image.open(out).convert("RGB")
        lifted, before, gamma = auto_lift(image)
        if gamma == 1.0:
            skipped += 1
            continue
        temporary = out.with_name(f"{out.stem}.relight.webp")
        lifted.save(temporary, "WEBP", quality=86, method=6)
        os.replace(temporary, out)
        changed += 1
        print(f"{out.stem:18s} {before:5.1f} -> {TARGET_MEAN:.1f}  gamma={gamma:.2f}")
    print(f"提亮 {changed} 张，跳过 {skipped} 张（已经足够明亮）")


IDS = {
    "sunder": "A_single_vertical_sword_slash__2026-10-20T13-19-49.png",
    "nova": "A_falling_star_striking_a_drow_2026-10-20T13-19-53.png",
    "wildfire": "A_dreamlike_grassland_igniting_2026-10-20T13-20-25.png",
    "envenom": "Close_up_of_a_gloved_hand_coat_2026-10-20T13-21-55.png",
    "briarCrown": "A_crown_woven_from_living_thor_2026-10-20T13-22-05.png",
    "tornPage": "A_torn_page_from_an_ancient_le_2026-10-20T13-22-22.png",
}


def known_ids():
    """从 js/data.js 里读出全部卡牌 id。"""
    import re
    source = (ROOT / "js" / "data.js").read_text(encoding="utf-8")
    start = source.index("export const CARDS = [")
    end = source.index("export const CARD_MAP")
    return set(re.findall(r"\bid: '([^']+)'", source[start:end]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--src")
    parser.add_argument("--id")
    parser.add_argument("--suffix", default="")
    parser.add_argument("--all", action="store_true", help="处理 IDS 里写死的六张初版")
    parser.add_argument("--batch", action="store_true", help="扫描 art-source/cards/<卡牌id>.png 批量处理")
    parser.add_argument("--relight", action="store_true", help="提亮 assets/cards 里已有的卡面")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    if args.relight:
        relight_existing()
        return

    jobs = []
    if args.batch:
        ids = known_ids()
        for file in sorted(RAW.glob("*")):
            if not file.is_file() or file.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
                continue
            if file.stem in ids:
                jobs.append((file, file.stem, ""))
    elif args.all:
        for card_id, filename in IDS.items():
            jobs.append((RAW / filename, card_id, ""))
    elif args.src and args.id:
        jobs.append((Path(args.src), args.id, args.suffix))
    else:
        parser.error("需要 --batch、--all 或 --src/--id")

    for src, card_id, suffix in jobs:
        if not src.exists():
            print(f"缺失：{src}")
            continue
        out, box, size, before, gamma = prepare(src, card_id, suffix)
        kb = out.stat().st_size / 1024
        flag = "水印" if box else "无水印"
        print(f"{card_id:14s} {flag} 裁切={size} 亮度 {before:.1f}->{TARGET_MEAN:.1f} gamma={gamma:.2f} -> {out.name} {kb:.0f}KB")


if __name__ == "__main__":
    main()
