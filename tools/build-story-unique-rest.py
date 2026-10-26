"""补齐剩余 13 张剧情独有场景图与 9 件独有道具。

场景使用项目内已有卡面 / 敌人原画重新取景、调色与合成，不跨剧情复用同一文件。
"""

from pathlib import Path
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "story"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1792, 1008


def rgb(path):
    return Image.open(ROOT / path).convert("RGB")


def fit(im, size):
    return ImageOps.fit(im, size, method=Image.LANCZOS)


def wide(path, box=None, anchor=0.5, size=(W, H)):
    im = rgb(path)
    if box:
        im = im.crop(box)
    else:
        w, h = im.size
        target = w / (size[0] / size[1])
        if h > target:
            top = max(0, int((h - target) * anchor))
            im = im.crop((0, top, w, top + int(target)))
    return fit(im, size)


def glow(im, center, radius, color, strength):
    x, y = center
    grad = Image.radial_gradient("L").resize((radius * 2, radius * 2))
    grad = ImageOps.invert(grad).point(lambda v: int(v * strength))
    layer = Image.new("RGB", im.size, (0, 0, 0))
    solid = Image.new("RGB", (radius * 2, radius * 2), color)
    layer.paste(solid, (x - radius, y - radius), grad)
    return ImageChops.screen(im, layer)


def darken_left(im, strength=0.62, reach=0.58):
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    edge = w * reach
    for x in range(w):
        alpha = int(max(0.0, 1 - x / edge) ** 1.6 * strength * 255)
        draw.line([(x, 0), (x, h)], fill=alpha)
    return Image.composite(Image.new("RGB", im.size, (4, 3, 8)), im, mask)


def darken_bottom(im, strength=0.35, reach=0.42):
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    edge = h * reach
    for y in range(h):
        alpha = int(max(0.0, (y - (h - edge)) / edge) ** 1.5 * strength * 255)
        draw.line([(0, y), (w, y)], fill=alpha)
    return Image.composite(Image.new("RGB", im.size, (3, 3, 7)), im, mask)


def vignette(im, strength=0.55):
    mask = Image.radial_gradient("L").resize(im.size)
    mask = ImageOps.invert(mask).point(lambda v: int(v * strength))
    return Image.composite(Image.new("RGB", im.size, (0, 0, 0)), im, mask)


def grade(im, tint, amount, color=0.92, contrast=1.06, brightness=1.0):
    im = ImageEnhance.Color(im).enhance(color)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    im = ImageEnhance.Brightness(im).enhance(brightness)
    return Image.blend(im, Image.new("RGB", im.size, tint), amount)


def grain(im, strength=0.035):
    noise = Image.effect_noise(im.size, 22).convert("RGB")
    return Image.blend(im, noise, strength)


def rain(im, count=240, color=(150, 174, 186), alpha=44, length=(16, 48), tilt=0.22):
    w, h = im.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng = random.Random(917)
    for i in range(count):
        x = rng.randrange(w)
        y = rng.randrange(h)
        ln = rng.randrange(length[0], length[1])
        a = max(10, alpha - (i % 3) * 8)
        d.line([(x, y), (x - ln * tilt, y + ln)], fill=(*color, a), width=1)
    layer = layer.filter(ImageFilter.GaussianBlur(0.35))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def motes(im, count=90, color=(236, 190, 112), y_range=(0.2, 0.95), alpha=(26, 120)):
    w, h = im.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng = random.Random(317)
    for i in range(count):
        x = rng.randrange(w)
        y = int(h * (y_range[0] + rng.random() * (y_range[1] - y_range[0])))
        r = rng.choice((1, 1, 2, 2, 3))
        a = rng.randrange(alpha[0], alpha[1])
        d.ellipse((x - r, y - r, x + r, y + r), fill=(*color, a))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def shards(im, count=30, color=(196, 186, 232)):
    w, h = im.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng = random.Random(771)
    for i in range(count):
        x = rng.randrange(w)
        y = rng.randrange(h)
        size = rng.randrange(18, 100)
        skew = rng.randrange(-22, 22)
        pts = [(x, y), (x + size * 0.6, y + size), (x + size * 0.5 + skew, y + size * 1.4), (x - size * 0.2, y + size * 0.5)]
        d.polygon(pts, fill=(*color, 16 + i % 24))
        d.line(pts[:3], fill=(*color, 42 + i % 30), width=1)
    return Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(0.45))).convert("RGB")


def save(im, name, quality=88):
    path = OUT / name
    im.convert("RGB").save(path, "WEBP", quality=quality, method=6)
    print(path.relative_to(ROOT), im.size)


def save_rgba(im, name, quality=90):
    path = OUT / name
    im.save(path, "WEBP", quality=quality, method=6)
    print(path.relative_to(ROOT), im.size)


def beam(im, start, end, color=(236, 204, 150), width=120, strength=44):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    poly = [start, end, (end[0], end[1] + width), (start[0], start[1] + width * 0.18)]
    d.polygon(poly, fill=(*color, strength))
    layer = layer.filter(ImageFilter.GaussianBlur(24))
    out = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    return glow(out, start, 180, color, strength / 140)


def lighthouse(im, base, scale=1.0, color=(214, 198, 168)):
    w, h = im.size
    x, y = base
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    tw = int(30 * scale)
    th = int(210 * scale)
    d.polygon([(x - tw, y), (x + tw, y), (x + tw * 0.55, y - th), (x - tw * 0.55, y - th)], fill=(*color, 120))
    d.polygon([(x - tw * 0.8, y - th), (x + tw * 0.8, y - th), (x + tw * 0.45, y - th * 1.16), (x - tw * 0.45, y - th * 1.16)], fill=(*color, 90))
    d.rectangle((x - tw * 0.45, y - th * 1.28, x + tw * 0.45, y - th * 1.15), fill=(250, 206, 132, 210))
    layer = layer.filter(ImageFilter.GaussianBlur(1.0))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def sword(im, start, end, glow_color=(190, 208, 220)):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.line([start, end], fill=(34, 30, 30, 255), width=26)
    d.line([start, end], fill=(126, 132, 138, 255), width=15)
    d.line([start, end], fill=(218, 224, 228, 210), width=5)
    dx, dy = end[0] - start[0], end[1] - start[1]
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    qx, qy = start[0] + dx * 0.82, start[1] + dy * 0.82
    d.line([(qx - nx * 44, qy - ny * 44), (qx + nx * 44, qy + ny * 44)], fill=(70, 58, 38, 255), width=14)
    d.ellipse((end[0] - 9, end[1] - 9, end[0] + 9, end[1] + 9), fill=(240, 244, 246, 220))
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    out = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    return glow(out, (int((start[0] + end[0]) / 2), int((start[1] + end[1]) / 2)), 150, glow_color, 0.12)


def torn_page(im, center, size=70, angle=-14, fill=(206, 188, 152), alpha=150):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    points = [(0, 0), (size, -size * 0.14), (size * 0.92, size * 0.9), (size * 0.1, size), (0, size * 0.6)]
    rad = math.radians(angle)
    ca, sa = math.cos(rad), math.sin(rad)
    pts = [(center[0] + p[0] * ca - p[1] * sa, center[1] + p[0] * sa + p[1] * ca) for p in points]
    d.polygon(pts, fill=(*fill, alpha), outline=(74, 58, 40, min(210, alpha + 40)))
    for i in range(3):
        a = pts[0]
        b = pts[2]
        t = (i + 1) / 4
        d.line([(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), (pts[1][0] + (pts[3][0] - pts[1][0]) * t, pts[1][1] + (pts[3][1] - pts[1][1]) * t)], fill=(92, 70, 48, 60), width=1)
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def sea_wash(im, horizon=0.62, color=(7, 12, 20), strength=0.9):
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    edge = int(h * horizon)
    for y in range(edge, h):
        a = int(((y - edge) / max(1, h - edge)) ** 1.2 * strength * 255)
        d.line([(0, y), (w, y)], fill=a)
    out = Image.composite(Image.new("RGB", im.size, color), im, mask)
    # thin silver horizon
    line = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(line)
    ld.line([(0, edge), (w, edge)], fill=(188, 206, 212, 30), width=2)
    return Image.alpha_composite(out.convert("RGBA"), line.filter(ImageFilter.GaussianBlur(1.4))).convert("RGB")


def rift(im, x_ratio=0.68, color=(168, 120, 236), wobble=12, alpha=180):
    w, h = im.size
    x0 = w * x_ratio
    pts = [(x0 + math.sin(y / 72) * wobble, y) for y in range(int(h * 0.18), h, 3)]
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for width, c, a in [(20, (46, 26, 82), alpha // 2), (8, color, alpha), (2, (248, 238, 255), min(255, alpha + 50))]:
        d.line(pts, fill=(*c, a), width=width, joint="curve")
    layer = layer.filter(ImageFilter.GaussianBlur(0.9))
    return glow(Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB"), (int(x0), int(h * 0.58)), 260, color, 0.2)


def coin(im, center, radius=64):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    for r, c in [(radius, (82, 54, 20, 255)), (radius * 0.9, (202, 156, 72, 255)), (radius * 0.78, (126, 90, 38, 255)), (radius * 0.66, (226, 182, 96, 255))]:
        d.ellipse((x - r, y - r, x + r, y + r), fill=c)
    d.arc((x - radius * 0.7, y - radius * 0.7, x + radius * 0.7, y + radius * 0.7), 200, 340, fill=(255, 226, 158, 200), width=3)
    d.line([(x - 13, y - 18), (x + 6, y + 20), (x + 19, y + 10)], fill=(96, 62, 24, 210), width=3, joint="curve")
    return glow(Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB"), center, int(radius * 2.6), (238, 176, 78), 0.24)


def small_boat(im, center, scale=1.0, color=(18, 16, 20)):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    s = scale
    d.polygon([(x - 46 * s, y), (x + 48 * s, y), (x + 30 * s, y + 17 * s), (x - 30 * s, y + 17 * s)], fill=(*color, 235))
    d.line([(x, y), (x, y - 62 * s)], fill=(*color, 220), width=max(1, int(3 * s)))
    d.polygon([(x + 1 * s, y - 58 * s), (x + 33 * s, y - 10 * s), (x + 1 * s, y - 10 * s)], fill=(*color, 190))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def seated_figure(im, center, scale=1.0, color=(8, 7, 10)):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    s = scale
    d.ellipse((x - 20 * s, y - 95 * s, x + 20 * s, y - 55 * s), fill=(*color, 215))
    d.polygon([(x - 38 * s, y - 58 * s), (x + 38 * s, y - 58 * s), (x + 52 * s, y + 20 * s), (x + 20 * s, y + 32 * s), (x + 8 * s, y - 6 * s), (x - 8 * s, y - 6 * s), (x - 20 * s, y + 32 * s), (x - 52 * s, y + 20 * s)], fill=(*color, 225))
    d.ellipse((x - 48 * s, y + 18 * s, x + 48 * s, y + 52 * s), fill=(*color, 190))
    layer = layer.filter(ImageFilter.GaussianBlur(1.1))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def door_arch(im, center, size=(92, 250), color=(250, 204, 132)):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    w, h = size
    d.rounded_rectangle((x - w / 2, y - h / 2, x + w / 2, y + h / 2), radius=w / 2, fill=(*color, 76))
    d.rounded_rectangle((x - w * 0.32, y - h * 0.44, x + w * 0.32, y + h * 0.44), radius=w * 0.32, fill=(*color, 190))
    d.line([(x - w / 2, y + h * 0.12), (x - w / 2, y - h * 0.1)], fill=(*color, 220), width=3)
    d.line([(x + w / 2, y + h * 0.12), (x + w / 2, y - h * 0.1)], fill=(*color, 220), width=3)
    layer = layer.filter(ImageFilter.GaussianBlur(6))
    out = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    return glow(out, (int(x), int(y)), int(h * 0.7), color, 0.34)


def smoke_ribbon(im, pts, color=(220, 210, 236), alpha=90, width=18):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=(*color, alpha), width=width)
    layer = layer.filter(ImageFilter.GaussianBlur(11))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def face_page(im, center, size=150, angle=-12, fill=(206, 190, 160)):
    w = h = size
    page = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(page)
    pts = [(20, 18), (w * 2 - 34, 8), (w * 2 - 20, h * 2 - 20), (26, h * 2 - 8), (10, h)]
    d.polygon(pts, fill=(*fill, 225), outline=(74, 58, 40, 220))
    for i in range(6):
        y = 36 + i * 38
        d.line((40, y, w * 2 - 60, y - 4), fill=(92, 70, 48, 60), width=2)
    cx, cy = w, h * 0.8
    d.ellipse((cx - 86, cy - 120, cx + 86, cy + 130), outline=(44, 36, 32, 160), width=3)
    d.arc((cx - 58, cy - 50, cx - 8, cy + 10), 200, 340, fill=(44, 36, 32, 160), width=3)
    d.arc((cx + 8, cy - 50, cx + 58, cy + 10), 200, 340, fill=(44, 36, 32, 160), width=3)
    d.line((cx - 4, cy - 20, cx - 18, cy + 54, cx + 14, cy + 58), fill=(44, 36, 32, 150), width=3, joint="curve")
    d.arc((cx - 52, cy + 82, cx + 52, cy + 150), 20, 160, fill=(60, 38, 32, 160), width=3)
    page = page.rotate(angle, resample=Image.BICUBIC, expand=False)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    layer.alpha_composite(page, (int(center[0] - w), int(center[1] - h)))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def lantern_shape(im, center, scale=1.0, glow_color=(248, 188, 92)):
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = center
    s = scale
    d.arc((x - 26 * s, y - 74 * s, x + 26 * s, y - 22 * s), 200, 340, fill=(178, 142, 92, 230), width=max(2, int(5 * s)))
    d.polygon([(x - 26 * s, y - 20 * s), (x + 26 * s, y - 20 * s), (x + 34 * s, y + 44 * s), (x - 34 * s, y + 44 * s)], fill=(250, 196, 110, 220))
    d.line([(x - 26 * s, y - 20 * s), (x - 34 * s, y + 44 * s), (x + 34 * s, y + 44 * s), (x + 26 * s, y - 20 * s), (x - 26 * s, y - 20 * s)], fill=(54, 40, 26, 240), width=max(2, int(4 * s)))
    d.line((x - 6 * s, y - 18 * s, x - 6 * s, y + 42 * s), fill=(54, 40, 26, 170), width=max(1, int(2 * s)))
    d.line((x + 8 * s, y - 18 * s, x + 8 * s, y + 42 * s), fill=(54, 40, 26, 170), width=max(1, int(2 * s)))
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    out = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    return glow(out, (int(x), int(y + 12 * s)), int(120 * s), glow_color, 0.36)


# ─────────────── 13 张场景 ───────────────


def build_scenes():
    # 战后海面：梦船还停在紫雾里，碎页与刀光都没有落地。
    im = wide("assets/cards/deepChart.webp", anchor=0.34)
    im = grade(im, (10, 14, 26), 0.14, color=0.74, contrast=1.1, brightness=0.9)
    im = glow(im, (1490, 190), 380, (218, 150, 122), 0.18)
    im = smoke_ribbon(im, [(520, 760), (690, 680), (720, 590), (840, 520), (900, 430)], (210, 200, 224), 80, 20)
    im = torn_page(im, (600, 660), 70, -18, (200, 188, 162), 150)
    im = torn_page(im, (930, 730), 48, 24, (196, 182, 154), 130)
    im = torn_page(im, (760, 570), 38, -4, (190, 178, 152), 110)
    im = rain(im, 180, (148, 168, 184), 28, (14, 42), 0.18)
    im = darken_left(im, 0.76)
    im = darken_bottom(im, 0.34)
    im = vignette(im, 0.62)
    save(grain(im), "parley-sea.webp")

    # 灯下的旧桌：雨夜，四位声音围着一扇发亮的门。
    im = wide("assets/cards/relicChorus.webp", box=(96, 70, 928, 538), anchor=0.5)
    im = grade(im, (30, 22, 18), 0.16, color=0.76, contrast=1.1, brightness=0.9)
    im = glow(im, (1060, 470), 380, (240, 176, 96), 0.34)
    im = rain(im, 260, (150, 166, 172), 34, (18, 52), 0.2)
    im = motes(im, 90, (238, 190, 116), (0.28, 0.94))
    im = darken_left(im, 0.8)
    im = darken_bottom(im, 0.42)
    im = vignette(im, 0.64)
    save(grain(im), "chorus-table.webp")

    # 海心之门：心口裂开一道等候回答的门。
    im = wide("assets/cards/heartSigil.webp", anchor=0.22)
    im = sea_wash(im, 0.7, (6, 9, 14), 0.84)
    im = grade(im, (28, 14, 20), 0.1, color=0.86, contrast=1.06, brightness=0.92)
    im = door_arch(im, (1000, 480), (104, 280), (252, 204, 132))
    im = small_boat(im, (780, 900), 0.9)
    for i, (cx, cy, sz, ang) in enumerate([(1240, 690, 42, -16), (1340, 760, 32, 22)]):
        im = torn_page(im, (cx, cy), sz, ang, (198, 186, 160), 120 + i * 20)
    im = motes(im, 100, (244, 192, 122), (0.42, 0.95))
    im = darken_left(im, 0.74)
    im = vignette(im, 0.6)
    save(grain(im), "chorus-heart.webp")

    # 梦隙 · 心：两个人坐在缝边，听它把话说完。
    im = wide("assets/cards/mistChart.webp", anchor=0.44)
    im = grade(im, (12, 18, 34), 0.2, color=0.74, contrast=1.08, brightness=0.9)
    im = rift(im, 0.6, (176, 140, 238), 18, 165)
    im = seated_figure(im, (420, 890), 0.9)
    im = seated_figure(im, (1150, 900), 0.68, (16, 14, 24))
    im = glow(im, (470, 760), 120, (236, 192, 126), 0.16)
    im = motes(im, 90, (238, 198, 148), (0.5, 0.94), (20, 90))
    im = darken_left(im, 0.58)
    im = darken_bottom(im, 0.44)
    im = vignette(im, 0.62)
    save(grain(im), "rift-empathy.webp")

    # 梦隙 · 心光：旧灯悬在缝底，光照上来。
    im = wide("assets/cards/voidLamp.webp", anchor=0.36)
    im = grade(im, (14, 20, 34), 0.16, color=0.76, contrast=1.06, brightness=0.9)
    im = beam(im, (860, 520), (240, 620), (226, 200, 156), 80, 22)
    im = sea_wash(im, 0.76, (5, 8, 14), 0.72)
    im = rain(im, 150, (148, 168, 184), 24, (12, 38), 0.12)
    im = glow(im, (860, 610), 260, (230, 204, 156), 0.18)
    im = darken_left(im, 0.74)
    im = vignette(im, 0.64)
    save(grain(im), "rift-empathy-light.webp")

    # 梦隙 · 锋：裂口伸出手，先亮刀的人才会看见刀。
    im = wide("assets/cards/singleThread.webp", anchor=0.36)
    im = sea_wash(im, 0.76, (5, 9, 15), 0.78)
    im = grade(im, (14, 22, 32), 0.18, color=0.7, contrast=1.12, brightness=0.88)
    im = rift(im, 0.5, (132, 198, 210), 9, 210)
    im = shards(im, 24, (146, 202, 210))
    im = rain(im, 200, (154, 180, 190), 30, (16, 48), 0.18)
    im = darken_left(im, 0.74)
    im = darken_bottom(im, 0.4)
    im = vignette(im, 0.62)
    save(grain(im), "rift-threat.webp")

    # 梦隙 · 金：一只手在缝上开价。
    im = wide("assets/cards/ferryFare.webp", anchor=0.32)
    im = sea_wash(im, 0.78, (6, 9, 14), 0.72)
    im = grade(im, (24, 18, 16), 0.14, color=0.82, contrast=1.08, brightness=0.92)
    im = rift(im, 0.35, (202, 156, 86), 11, 130)
    im = glow(im, (620, 320), 300, (242, 182, 88), 0.2)
    im = motes(im, 110, (238, 194, 112), (0.24, 0.92))
    im = rain(im, 120, (150, 168, 176), 22, (12, 34), 0.1)
    im = darken_left(im, 0.72)
    im = vignette(im, 0.6)
    save(grain(im), "rift-bribe.webp")

    # 第一次失败：提灯的人把灯递回你手里。
    im = wide("assets/cards/lampWard.webp", anchor=0.3)
    im = grade(im, (8, 14, 22), 0.18, color=0.7, contrast=1.1, brightness=0.88)
    im = sea_wash(im, 0.78, (4, 7, 12), 0.7)
    im = beam(im, (430, 500), (140, 700), (238, 190, 116), 80, 24)
    im = glow(im, (430, 500), 220, (244, 182, 94), 0.3)
    im = rain(im, 190, (138, 158, 172), 30, (14, 44), 0.16)
    im = darken_left(im, 0.66)
    im = vignette(im, 0.66)
    save(grain(im), "defeat-first-light.webp")

    # 第一次失败 · 镜：碎镜落尽，纸上描着那张脸。
    im = wide("assets/cards/mirrorParry.webp", anchor=0.45)
    im = grade(im, (24, 20, 40), 0.16, color=0.76, contrast=1.12, brightness=0.88)
    im = shards(im, 36)
    im = face_page(im, (1180, 560), 210, -14, (200, 188, 166))
    im = glow(im, (1180, 500), 350, (142, 120, 204), 0.2)
    im = darken_left(im, 0.78)
    im = darken_bottom(im, 0.4)
    im = vignette(im, 0.66)
    save(grain(im), "defeat-mirror.webp")

    # 第一次失败 · 骨庭：王座记住了名字。
    im = wide("assets/enemies/bone-king.webp", anchor=0.12)
    im = grade(im, (38, 24, 12), 0.16, color=0.8, contrast=1.08, brightness=0.92)
    im = motes(im, 130, (244, 184, 92), (0.22, 0.94))
    for i, (x, y) in enumerate([(340, 720), (520, 760), (1260, 700), (1450, 760)]):
        im = glow(im, (x, y), 50, (246, 186, 88), 0.3)
    im = glow(im, (980, 520), 380, (214, 150, 70), 0.22)
    im = darken_left(im, 0.78)
    im = darken_bottom(im, 0.38)
    im = vignette(im, 0.64)
    save(grain(im), "defeat-bone.webp")

    # 心之败：海心问你再听一遍。
    im = wide("assets/enemies/hollow-heart.webp", anchor=0.22)
    im = sea_wash(im, 0.7, (6, 9, 14), 0.8)
    im = grade(im, (34, 16, 18), 0.14, color=0.86, contrast=1.08, brightness=0.94)
    im = small_boat(im, (650, 840), 0.9)
    im = glow(im, (1110, 470), 460, (226, 136, 96), 0.28)
    im = motes(im, 140, (246, 196, 122), (0.44, 0.96))
    im = darken_left(im, 0.7)
    im = vignette(im, 0.6)
    save(grain(im), "defeat-heart-sea.webp")

    # 心之败 · 回航：水面之下是锚，水面上是一盏灯。
    im = wide("assets/cards/drownedAnchor.webp", anchor=0.4)
    im = grade(im, (6, 12, 20), 0.26, color=0.6, contrast=1.12, brightness=0.82)
    im = sea_wash(im, 0.4, (7, 14, 22), 0.5)
    im = lantern_shape(im, (1250, 700), 1.15)
    im = rain(im, 140, (132, 154, 168), 30, (14, 42), 0.16)
    im = darken_left(im, 0.68)
    im = darken_bottom(im, 0.38)
    im = vignette(im, 0.66)
    save(grain(im), "defeat-heart-sea2.webp")

    # 心之败 · 灯室：灯跟着你回来了。
    im = wide("assets/cards/keeperFlame.webp", anchor=0.32)
    im = grade(im, (42, 28, 16), 0.12, color=0.86, contrast=1.06, brightness=0.94)
    im = glow(im, (1130, 560), 400, (246, 180, 92), 0.4)
    im = glow(im, (1130, 560), 120, (255, 224, 164), 0.3)
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r in (330, 410, 500):
        d.ellipse((1130 - r, 560 - r * 0.62, 1130 + r, 560 + r * 0.62), outline=(250, 196, 118, 26), width=2)
    im = Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(1.2))).convert("RGB")
    im = lantern_shape(im, (420, 660), 1.05)
    im = motes(im, 100, (244, 192, 122), (0.35, 0.95))
    im = darken_left(im, 0.66)
    im = darken_bottom(im, 0.36)
    im = vignette(im, 0.56)
    save(grain(im), "defeat-heart-light.webp")


# ─────────────── 9 件道具 ───────────────


def soft_glow(canvas, center, radius, color, alpha=52):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), fill=(*color, alpha))
    return Image.alpha_composite(canvas, layer.filter(ImageFilter.GaussianBlur(radius * 0.4)))


def make_lantern(name, body, glass, metal, glow_color, *, shape="taper", dented=False, seams=False, droplets=0, salt=False):
    size = 760
    cx, cy = 380, 380

    def draw_taper(target, skew=0):
        d = ImageDraw.Draw(target)
        body_pts = [(cx - 118, cy - 152), (cx + 118 - skew, cy - 152), (cx + 148, cy + 180), (cx - 148 + skew, cy + 180)]
        glass_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glass_layer)
        gd.polygon(body_pts, fill=(*glass, 214))
        inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ind = ImageDraw.Draw(inner)
        ind.ellipse((cx - 60, cy - 20, cx + 60, cy + 170), fill=(*glow_color, 235))
        glass_layer = Image.alpha_composite(glass_layer, inner.filter(ImageFilter.GaussianBlur(20)))
        target.alpha_composite(glass_layer)
        d = ImageDraw.Draw(target)
        d.arc((cx - 88, cy - 270, cx + 88, cy - 96), 200, 340, fill=(*metal, 255), width=10)
        d.line((cx - 74, cy - 190, cx - 74, cy - 152), fill=(*metal, 255), width=10)
        d.line((cx + 74 - skew, cy - 190, cx + 74 - skew, cy - 152), fill=(*metal, 255), width=10)
        d.line(body_pts + [body_pts[0]], fill=(*body, 255), width=16, joint="curve")
        for x in (-60, 0, 60):
            d.line((cx + x, cy - 150, cx + x * 1.2, cy + 178), fill=(*body, 190), width=5)
        d.line((cx - 160, cy + 180, cx + 160, cy + 180), fill=(*body, 255), width=20)
        d.line((cx - 120, cy + 206, cx + 120, cy + 206), fill=(*body, 235), width=14)
        d.ellipse((cx - 34, cy + 206, cx + 34, cy + 238), fill=(*metal, 255))
        if seams:
            for pts in [
                [(cx - 110, cy - 130), (cx - 60, cy - 60), (cx - 84, cy + 30)],
                [(cx + 118, cy - 90), (cx + 56, cy - 20), (cx + 84, cy + 100)],
            ]:
                d.line(pts, fill=(232, 186, 96, 240), width=5, joint="curve")
                d.line(pts, fill=(255, 232, 172, 160), width=2, joint="curve")
        if droplets:
            rng = random.Random(41)
            for _ in range(droplets):
                x = rng.randrange(cx - 130, cx + 130)
                y = rng.randrange(cy - 120, cy + 165)
                r = rng.randrange(2, 5)
                d.ellipse((x, y, x + r, y + r * 1.7), fill=(206, 226, 232, 150))
        if dented:
            d.line([(cx + 70, cy - 80), (cx + 116, cy - 40), (cx + 92, cy + 10)], fill=(24, 20, 18, 220), width=6)
            d.polygon([(cx + 116, cy + 20), (cx + 148, cy + 55), (cx + 108, cy + 70), (cx + 128, cy + 105)], fill=(12, 10, 9, 235))
        if salt:
            rng = random.Random(77)
            for _ in range(70):
                x = rng.randrange(cx - 150, cx + 150)
                y = rng.randrange(cy + 120, cy + 235)
                d.ellipse((x, y, x + 3, y + 2), fill=(216, 214, 200, rng.randrange(40, 130)))

    def draw_square(target):
        d = ImageDraw.Draw(target)
        left, right, top, bottom = cx - 132, cx + 132, cy - 150, cy + 168
        glass_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glass_layer)
        gd.rounded_rectangle((left + 12, top + 12, right - 12, bottom - 12), radius=8, fill=(*glass, 214))
        inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ind = ImageDraw.Draw(inner)
        ind.ellipse((cx - 74, cy - 70, cx + 74, cy + 150), fill=(*glow_color, 235))
        glass_layer = Image.alpha_composite(glass_layer, inner.filter(ImageFilter.GaussianBlur(22)))
        target.alpha_composite(glass_layer)
        d = ImageDraw.Draw(target)
        # 圆顶与烟囱
        d.arc((cx - 98, cy - 330, cx + 98, cy - 190), 200, 340, fill=(*metal, 255), width=10)
        d.line((cx - 88, cy - 236, cx - 88, cy - 196), fill=(*metal, 255), width=10)
        d.line((cx + 88, cy - 236, cx + 88, cy - 196), fill=(*metal, 255), width=10)
        d.rectangle((cx - 28, cy - 268, cx + 28, cy - 218), fill=(*metal, 255))
        d.polygon([(left - 26, top), (cx, top - 72), (right + 26, top)], fill=(*body, 255), outline=(*body, 255))
        d.line([(left - 26, top), (cx, top - 72), (right + 26, top)], fill=(*metal, 235), width=7, joint="curve")
        # 主体外框与四角铆钉
        d.rounded_rectangle((left, top, right, bottom), radius=10, outline=(*body, 255), width=16)
        for px in (left + 16, right - 16):
            for py in (top + 16, bottom - 16):
                d.ellipse((px - 7, py - 7, px + 7, py + 7), fill=(*metal, 255))
        for x in (-76, 0, 76):
            d.line((cx + x, top + 14, cx + x, bottom - 14), fill=(*body, 200), width=6)
        # 底脚
        d.line((left - 14, bottom, right + 14, bottom), fill=(*body, 255), width=20)
        d.rectangle((left + 16, bottom + 6, left + 54, bottom + 32), fill=(*metal, 255))
        d.rectangle((right - 54, bottom + 6, right - 16, bottom + 32), fill=(*metal, 255))
        if seams:
            d.line([(cx - 90, top + 26), (cx - 40, cy), (cx - 66, bottom - 30)], fill=(232, 186, 96, 240), width=5, joint="curve")

    def draw_round(target):
        d = ImageDraw.Draw(target)
        body_box = (cx - 148, cy - 124, cx + 148, cy + 190)
        glass_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glass_layer)
        gd.ellipse((cx - 126, cy - 104, cx + 126, cy + 166), fill=(*glass, 214))
        inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ind = ImageDraw.Draw(inner)
        ind.ellipse((cx - 72, cy - 30, cx + 72, cy + 160), fill=(*glow_color, 235))
        glass_layer = Image.alpha_composite(glass_layer, inner.filter(ImageFilter.GaussianBlur(22)))
        target.alpha_composite(glass_layer)
        d = ImageDraw.Draw(target)
        d.arc((cx - 96, cy - 284, cx + 96, cy - 150), 200, 340, fill=(*metal, 255), width=10)
        d.line((cx - 84, cy - 206, cx - 84, cy - 122), fill=(*metal, 255), width=10)
        d.line((cx + 84, cy - 206, cx + 84, cy - 122), fill=(*metal, 255), width=10)
        d.ellipse((cx - 76, cy - 164, cx + 76, cy - 92), fill=(*body, 255), outline=(*metal, 220), width=5)
        d.ellipse(body_box, outline=(*body, 255), width=16)
        d.arc((cx - 160, cy + 130, cx + 160, cy + 250), 190, 350, fill=(*body, 255), width=18)
        d.ellipse((cx - 96, cy + 176, cx + 96, cy + 222), fill=(*body, 255), outline=(*metal, 160), width=4)
        d.ellipse((cx - 40, cy + 214, cx + 40, cy + 248), fill=(*metal, 255))
        ccy = cy + 31
        for x in (-76, 0, 76):
            half = 135 * math.sqrt(max(0.0, 1 - (x / 126) ** 2))
            d.line((cx + x, ccy - half + 6, cx + x, ccy + half - 6), fill=(*body, 190), width=5)
        d.arc((cx - 126, cy - 104, cx + 126, cy + 166), 200, 340, fill=(*metal, 120), width=4)
        if droplets:
            rng = random.Random(41)
            for _ in range(droplets):
                a = rng.uniform(0, math.tau)
                rr = rng.uniform(40, 120)
                x = cx + math.cos(a) * rr
                y = cy + 30 + math.sin(a) * rr * 1.05
                r = rng.randrange(2, 5)
                d.ellipse((x, y, x + r, y + r * 1.7), fill=(206, 226, 232, 150))

    def draw_onion(target):
        d = ImageDraw.Draw(target)
        outline = [(cx, cy - 232), (cx - 62, cy - 176), (cx - 118, cy - 84), (cx - 138, cy + 30),
                   (cx - 110, cy + 132), (cx - 62, cy + 178), (cx + 62, cy + 178), (cx + 110, cy + 132),
                   (cx + 138, cy + 30), (cx + 118, cy - 84), (cx + 62, cy - 176)]
        glass_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glass_layer)
        glass_pts = [(cx + (x - cx) * 0.82, cy + 8 + (y - cy) * 0.8) for x, y in outline]
        gd.polygon(glass_pts, fill=(*glass, 214))
        inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ind = ImageDraw.Draw(inner)
        ind.ellipse((cx - 62, cy - 80, cx + 62, cy + 150), fill=(*glow_color, 235))
        glass_layer = Image.alpha_composite(glass_layer, inner.filter(ImageFilter.GaussianBlur(22)))
        target.alpha_composite(glass_layer)
        d = ImageDraw.Draw(target)
        d.arc((cx - 26, cy - 286, cx + 26, cy - 222), 0, 360, fill=(*metal, 255), width=9)
        d.line((cx, cy - 232, cx, cy - 218), fill=(*metal, 255), width=10)
        d.polygon(outline, outline=(*body, 255))
        d.line(outline + [outline[0]], fill=(*body, 255), width=14, joint="curve")
        for frac in (-0.56, -0.28, 0, 0.28, 0.56):
            x_top = cx + 60 * frac * 2
            x_bottom = cx + 118 * frac
            d.line((x_top, cy - 170, x_bottom, cy + 176), fill=(*body, 180), width=4)
        d.arc((cx - 150, cy + 150, cx + 150, cy + 236), 190, 350, fill=(*body, 255), width=16)
        d.ellipse((cx - 42, cy + 202, cx + 42, cy + 236), fill=(*metal, 255))
        if seams:
            for pts in [
                [(cx - 96, cy - 120), (cx - 54, cy - 40), (cx - 90, cy + 56), (cx - 46, cy + 146)],
                [(cx + 100, cy - 70), (cx + 50, cy + 6), (cx + 82, cy + 104)],
                [(cx - 20, cy - 200), (cx + 16, cy - 108), (cx - 14, cy - 30)],
            ]:
                d.line(pts, fill=(232, 186, 96, 245), width=5, joint="curve")
                d.line(pts, fill=(255, 236, 184, 170), width=2, joint="curve")
                for px, py in pts:
                    d.ellipse((px - 4, py - 4, px + 4, py + 4), fill=(255, 226, 150, 220))

    if shape == "fallen":
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw_taper(layer, skew=10)
        d = ImageDraw.Draw(layer)
        crack = [(cx - 74, cy - 128), (cx - 28, cy - 34), (cx - 60, cy + 64), (cx - 12, cy + 158)]
        d.line(crack, fill=(24, 18, 14, 235), width=9, joint="curve")
        d.line(crack, fill=(238, 188, 100, 245), width=4, joint="curve")
        d.line(crack, fill=(255, 232, 170, 150), width=2, joint="curve")
        layer = layer.rotate(-22, resample=Image.BICUBIC, expand=False)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas = soft_glow(canvas, (392, 372), 200, glow_color, 40)
        canvas.alpha_composite(layer)
    else:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas = soft_glow(canvas, (380, 380), 210, glow_color, 54)
        if shape == "square":
            draw_square(canvas)
        elif shape == "round":
            draw_round(canvas)
        elif shape == "onion":
            draw_onion(canvas)
        else:
            draw_taper(canvas, skew=16 if dented else 0)
    save_rgba(canvas, name)


def paper_texture(size, tint=(204, 178, 132)):
    texture = Image.effect_noise(size, 30).convert("L")
    paper = ImageOps.colorize(texture, (88, 64, 42), (230, 208, 170))
    return Image.blend(Image.new("RGB", size, tint), paper, 0.42)


def make_ticket(name, tint, wet=False, torn=False):
    w, h = 620, 860
    ticket = paper_texture((w, h), tint).convert("RGBA")
    mask = Image.new("L", (w, h), 255)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, w - 1, h - 1), radius=22, fill=255)
    if torn:
        md.polygon([(0, 0), (140, 0), (70, 90), (0, 40)], fill=0)
    ticket.putalpha(mask)
    d = ImageDraw.Draw(ticket)
    d.rounded_rectangle((28, 28, w - 28, h - 28), radius=16, outline=(88, 64, 38, 190), width=3)
    d.line((60, 250, w - 60, 250), fill=(92, 66, 40, 150), width=2)
    d.line((60, 300, w - 60, 300), fill=(92, 66, 40, 90), width=1)
    font_big = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 54)
    font_small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 28)
    ink = (54, 38, 24, 220 if not wet else 150)
    d.text((66, 74), "白鹭号", font=font_big, fill=ink)
    d.text((66, 148), "登船凭据", font=font_small, fill=ink)
    d.text((66, 330), "三月十七", font=font_big, fill=ink)
    d.text((66, 410), "凌晨 · 潮汐班", font=font_small, fill=ink)
    d.ellipse((420, 600, 546, 726), outline=(110, 54, 42, 190), width=4)
    d.ellipse((444, 624, 522, 702), outline=(110, 54, 42, 120), width=2)
    d.line((60, 760, w - 60, 760), fill=(92, 66, 40, 90), width=2)
    if wet:
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        rng = random.Random(19)
        for _ in range(18):
            x = rng.randrange(40, w - 100)
            y = rng.randrange(40, h - 100)
            rx = rng.randrange(30, 110)
            ry = rng.randrange(18, 60)
            ld.ellipse((x, y, x + rx, y + ry), fill=(88, 116, 126, rng.randrange(18, 44)))
        ticket = Image.alpha_composite(ticket, layer.filter(ImageFilter.GaussianBlur(3.5)))
        ticket = Image.blend(ticket, Image.new("RGBA", (w, h), (92, 114, 120, 255)), 0.1)
    if torn:
        d = ImageDraw.Draw(ticket)
        d.line([(0, 0), (140, 0), (70, 90), (0, 40)], fill=(40, 34, 30, 120), width=4)
    ticket = ticket.rotate(-3.5, resample=Image.BICUBIC, expand=False)
    save_rgba(ticket, name)


def make_clock(name, face, rim, hand_color, hour_angle, minute_angle, *, shape="pocket", cracked=False, tide=False):
    size = 760
    cx = cy = 380
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c = soft_glow(c, (380, 380), 250, (234, 186, 98), 42)
    d = ImageDraw.Draw(c)

    def draw_hands(center, hour_len, minute_len, hour_w=16, minute_w=10, hub=24):
        hx, hy = center
        for angle, length, width in [(hour_angle, hour_len, hour_w), (minute_angle, minute_len, minute_w)]:
            a = math.radians(angle - 90)
            d.line((hx - math.cos(a) * 22, hy - math.sin(a) * 22, hx + math.cos(a) * length, hy + math.sin(a) * length), fill=(*hand_color, 255), width=width)
        d.ellipse((hx - hub, hy - hub, hx + hub, hy + hub), fill=(54, 38, 22, 255))
        d.ellipse((hx - hub // 2, hy - hub // 2, hx + hub // 2, hy + hub // 2), fill=(*rim, 255))

    if shape == "square":
        # 船钟：方形黄铜壳，顶部提梁与撞钟，底部双脚
        d.arc((cx - 92, cy - 384, cx + 92, cy - 262), 190, 350, fill=(*rim, 255), width=10)
        d.rectangle((cx - 24, cy - 308, cx + 24, cy - 260), fill=(*rim, 255))
        d.rounded_rectangle((cx - 306, cy - 266, cx + 306, cy + 250), radius=28, fill=(48, 34, 22, 255), outline=(*rim, 255), width=9)
        d.rounded_rectangle((cx - 268, cy - 228, cx + 268, cy + 212), radius=18, fill=(*rim, 255))
        d.ellipse((cx - 218, cy - 178, cx + 218, cy + 182), fill=(*face, 255), outline=(94, 70, 40, 255), width=7)
        fcy = cy + 2
        for i in range(12):
            a = math.radians(i * 30 - 90)
            r1, r2 = 176, 198 if i % 3 else 208
            d.line((cx + math.cos(a) * r1, fcy + math.sin(a) * r1, cx + math.cos(a) * r2, fcy + math.sin(a) * r2), fill=(64, 44, 26, 230), width=5 if i % 3 == 0 else 3)
        draw_hands((cx, fcy), 112, 168, 16, 10, 22)
        d.arc((cx - 218, cy - 178, cx + 218, cy + 182), 20, 92, fill=(255, 232, 178, 60), width=4)
        d.rectangle((cx - 220, cy + 250, cx - 160, cy + 318), fill=(*rim, 255))
        d.rectangle((cx + 160, cy + 250, cx + 220, cy + 318), fill=(*rim, 255))
        if cracked:
            rng = random.Random(5)
            pts = [(cx - 30, fcy - 190), (cx + 30, fcy - 90), (cx - 20, fcy + 10), (cx + 60, fcy + 120), (cx + 4, fcy + 176)]
            d.line(pts, fill=(238, 240, 236, 120), width=3, joint="curve")
            for _ in range(5):
                x = cx + rng.randrange(-90, 90)
                y = fcy + rng.randrange(-170, 170)
                d.line((x, y, x + rng.randrange(-50, 50), y + rng.randrange(-40, 60)), fill=(238, 240, 236, 80), width=2)
    elif shape == "tide":
        # 潮钟：八角青铜框，表盘外圈是潮位刻度而非十二时
        pts = []
        for i in range(8):
            a = math.radians(i * 45 + 22.5)
            pts.append((cx + math.cos(a) * 306, cy + math.sin(a) * 306))
        d.polygon(pts, fill=(52, 38, 24, 255), outline=(*rim, 255))
        d.line(pts + [pts[0]], fill=(*rim, 255), width=10, joint="curve")
        inner = [(cx + (x - cx) * 0.86, cy + (y - cy) * 0.86) for x, y in pts]
        d.polygon(inner, fill=(70, 104, 98, 255), outline=(*rim, 255))
        d.ellipse((cx - 226, cy - 226, cx + 226, cy + 226), fill=(*face, 255), outline=(94, 140, 132, 255), width=6)
        for i in range(24):
            a = math.radians(i * 15 - 90)
            r1 = 188 if i % 2 else 198
            d.line((cx + math.cos(a) * r1, cy + math.sin(a) * r1, cx + math.cos(a) * 208, cy + math.sin(a) * 208), fill=(46, 82, 78, 200), width=3)
        for i in range(8):
            a = math.radians(i * 45 - 90)
            d.arc((cx + math.cos(a) * 216 - 26, cy + math.sin(a) * 216 - 14, cx + math.cos(a) * 216 + 26, cy + math.sin(a) * 216 + 14), 200, 340, fill=(214, 230, 200, 120), width=3)
        draw_hands((cx, cy), 120, 176, 15, 9, 23)
        d.arc((cx - 306, cy - 306, cx + 306, cy + 306), 20, 92, fill=(180, 232, 218, 60), width=6)
        if tide:
            for off in (-18, 18):
                d.arc((cx - 210, cy + 204 + off, cx + 210, cy + 276 + off), 200, 340, fill=(80, 142, 138, 120), width=3)
            d.line((cx, cy + 230, cx, cy + 268), fill=(100, 166, 158, 140), width=3)
    else:
        for r, color in [(300, (48, 34, 22, 255)), (282, (*rim, 255)), (258, (94, 70, 40, 255)), (242, (*face, 255))]:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
        d.arc((cx - 282, cy - 282, cx + 282, cy + 282), 200, 340, fill=(252, 222, 158, 150), width=5)
        for i in range(12):
            a = math.radians(i * 30 - 90)
            r1, r2 = 206, 228 if i % 3 else 238
            d.line((cx + math.cos(a) * r1, cy + math.sin(a) * r1, cx + math.cos(a) * r2, cy + math.sin(a) * r2), fill=(64, 44, 26, 230), width=5 if i % 3 == 0 else 3)
        draw_hands((cx, cy), 130, 196)
        d.arc((cx - 268, cy - 268, cx + 268, cy + 268), 20, 92, fill=(255, 232, 178, 70), width=3)
        if cracked:
            rng = random.Random(5)
            pts = [(cx - 10, cy - 240), (cx + 40, cy - 150), (cx - 24, cy - 40), (cx + 64, cy + 80), (cx + 10, cy + 230)]
            d.line(pts, fill=(238, 240, 236, 130), width=3, joint="curve")
            for _ in range(5):
                x = cx + rng.randrange(-80, 80)
                y = cy + rng.randrange(-220, 220)
                d.line((x, y, x + rng.randrange(-50, 50), y + rng.randrange(-40, 60)), fill=(238, 240, 236, 90), width=2)
        if tide:
            for y in (cy + 250, cy + 268):
                d.line((cx - 250, y, cx + 250, y), fill=(80, 142, 138, 80), width=3)
    save_rgba(c, name)


def make_page(name, mode):
    w, h = 760, 1000
    if mode == "moon":
        # 冷色稿纸：页眉一轮月，正文写满被划掉的结局
        page = paper_texture((w, h), (166, 180, 190)).convert("RGBA")
        page = Image.alpha_composite(page, Image.new("RGBA", (w, h), (84, 110, 130, 26)))
        d = ImageDraw.Draw(page)
        d.rectangle((54, 64, w - 58, h - 62), outline=(52, 72, 90, 150), width=2)
        d.rectangle((62, 72, w - 66, h - 70), outline=(52, 72, 90, 70), width=1)
        cx, cy, r = 566, 248, 104
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(30, 44, 64, 235))
        d.arc((cx - r + 30, cy - r + 12, cx + r + 30, cy + r - 12), 250, 110, fill=(214, 226, 228, 190), width=5)
        rng = random.Random(31)
        for i in range(13):
            y = 424 + i * 34
            left = 82 + (i % 3) * 9
            right = w - 150 - rng.randrange(0, 130)
            struck = i == 6
            d.line((left, y, right + (40 if struck else 0), y), fill=(44, 60, 78, 150 if struck else 96), width=4 if struck else 3)
            if struck:
                d.line((left - 10, y - 10, right + 52, y + 12), fill=(122, 50, 42, 200), width=5)
                d.line((left - 8, y + 12, right + 50, y - 10), fill=(122, 50, 42, 160), width=3)
        for i in range(3):
            d.line((84, 888 + i * 26, 330 + i * 60, 884 + i * 26), fill=(44, 60, 78, 70), width=2)
        stain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(stain)
        sd.ellipse((64, 706, 330, 964), fill=(46, 78, 92, 54))
        sd.ellipse((92, 738, 288, 916), outline=(38, 66, 80, 110), width=5)
        sd.ellipse((120, 770, 250, 872), outline=(38, 66, 80, 70), width=3)
        page = Image.alpha_composite(page, stain.filter(ImageFilter.GaussianBlur(7)))
        mask = Image.new("L", (w, h), 255)
        md = ImageDraw.Draw(mask)
        for x in range(0, w, 14):
            md.polygon([(x, 0), (x + 7, 5 + (x * 11) % 36), (x + 14, 0)], fill=0)
        md.ellipse((w - 76, 418, w + 48, 548), fill=0)
        page.putalpha(ImageChops.multiply(page.getchannel("A"), mask))
        page = page.rotate(1.8, resample=Image.BICUBIC, expand=False)
    elif mode == "blank":
        # 空白的最后一页：只有纸纹、月形水印与一条书签带
        page = paper_texture((w, h), (214, 200, 170)).convert("RGBA")
        page = Image.alpha_composite(page, Image.new("RGBA", (w, h), (168, 140, 96, 18)))
        mark = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        mk = ImageDraw.Draw(mark)
        mk.rectangle((68, 74, w - 72, h - 86), outline=(126, 104, 70, 72), width=2)
        cx, cy, r = 388, 452, 236
        mk.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(150, 126, 88, 30), outline=(146, 122, 84, 84), width=3)
        mk.ellipse((cx - r + 34, cy - r + 40, cx + r - 26, cy + r - 20), outline=(146, 122, 84, 46), width=2)
        mk.ellipse((cx - 118, cy - 96, cx - 42, cy - 18), outline=(146, 122, 84, 52), width=2)
        mk.ellipse((cx + 54, cy + 38, cx + 128, cy + 110), outline=(146, 122, 84, 52), width=2)
        ribbon = [(512, 0), (552, 0), (552, 286), (532, 262), (512, 286)]
        mk.polygon(ribbon, fill=(138, 48, 40, 205))
        mk.line((512, 0, 512, 286), fill=(96, 32, 28, 130), width=2)
        page = Image.alpha_composite(page, mark)
        crease = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        cd = ImageDraw.Draw(crease)
        cd.line((w // 2 + 26, 40, w // 2 + 12, h - 40), fill=(110, 88, 58, 26), width=3)
        page = Image.alpha_composite(page, crease.filter(ImageFilter.GaussianBlur(3)))
        mask = Image.new("L", (w, h), 255)
        md = ImageDraw.Draw(mask)
        for x in range(0, w, 18):
            md.polygon([(x, h), (x + 9, h - 7 - (x * 13) % 30), (x + 18, h)], fill=0)
        page.putalpha(ImageChops.multiply(page.getchannel("A"), mask))
        page = page.rotate(-1.6, resample=Image.BICUBIC, expand=False)
    elif mode == "names":
        # 名册式的最后一页：写满名字，只空着一行
        page = paper_texture((w, h), (202, 188, 160)).convert("RGBA")
        page = Image.alpha_composite(page, Image.new("RGBA", (w, h), (120, 104, 76, 18)))
        d = ImageDraw.Draw(page)
        d.line((66, 92, w - 70, 92), fill=(70, 54, 38, 210), width=3)
        d.line((66, 104, w - 70, 104), fill=(70, 54, 38, 100), width=1)
        d.line((w // 2, 132, w // 2, 860), fill=(110, 86, 60, 90), width=2)
        rng = random.Random(53)
        for row in range(9):
            y = 160 + row * 78
            for col in range(2):
                x0 = 84 + col * (w // 2)
                if (row, col) == (4, 1):
                    d.rectangle((x0 + 8, y - 10, x0 + 252, y + 36), outline=(120, 96, 70, 80), width=2)
                    d.arc((x0 + 40, y - 4, x0 + 74, y + 30), 200, 340, fill=(140, 50, 42, 190), width=4)
                    continue
                for k in range(rng.randrange(2, 5)):
                    gx = x0 + 10 + k * 52
                    d.line((gx, y, gx + 30, y), fill=(58, 44, 32, 220), width=4)
                    d.line((gx + 15, y - 18, gx + 15, y + 22), fill=(58, 44, 32, 190), width=3)
                    d.line((gx + 4, y + 6, gx + 26, y - 12), fill=(58, 44, 32, 150), width=2)
                d.line((x0 + 10, y + 34, x0 + 232, y + 34), fill=(110, 86, 60, 50), width=1)
        d.rectangle((w - 208, 872, w - 104, 960), outline=(132, 48, 40, 210), width=5)
        d.line((w - 208, 872, w - 104, 960), fill=(132, 48, 40, 120), width=3)
        d.line((w - 104, 872, w - 208, 960), fill=(132, 48, 40, 120), width=3)
        stain = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(stain)
        sd.ellipse((70, 790, 300, 980), fill=(60, 72, 64, 40))
        sd.ellipse((110, 830, 250, 948), outline=(54, 66, 58, 70), width=4)
        page = Image.alpha_composite(page, stain.filter(ImageFilter.GaussianBlur(8)))
        mask = Image.new("L", (w, h), 255)
        md = ImageDraw.Draw(mask)
        md.polygon([(0, 0), (0, 110), (46, 74), (96, 30), (150, 0)], fill=0)
        for y in range(0, h, 18):
            md.polygon([(w, y), (w - 7 - (y * 9) % 24, y + 9), (w, y + 18)], fill=0)
        page.putalpha(ImageChops.multiply(page.getchannel("A"), mask))
        page = page.rotate(3.0, resample=Image.BICUBIC, expand=False)
    else:
        # 暖色草稿：描了两遍的脸，名字被墨抹掉
        page = paper_texture((w, h), (196, 170, 132)).convert("RGBA")
        page = Image.alpha_composite(page, Image.new("RGBA", (w, h), (146, 104, 58, 22)))
        d = ImageDraw.Draw(page)
        for x0, y0, x1, y1 in [(44, 48, w - 48, 54), (w - 52, 56, w - 44, h - 52),
                               (w - 50, h - 48, 46, h - 54), (48, h - 52, 42, 56)]:
            d.line((x0, y0, x1, y1), fill=(70, 50, 34, 160), width=3)
        cx, cy = 322, 388
        d.ellipse((cx - 176, cy - 238, cx + 176, cy + 238), outline=(58, 44, 36, 60), width=3)
        d.ellipse((cx - 170, cy - 232, cx + 170, cy + 232), outline=(58, 44, 36, 165), width=4)
        d.arc((cx - 112, cy - 92, cx - 34, cy + 12), 200, 340, fill=(58, 44, 36, 180), width=4)
        d.arc((cx + 34, cy - 92, cx + 112, cy + 12), 200, 340, fill=(58, 44, 36, 180), width=4)
        for k in (-1, 0, 1):
            d.line((cx - 6 + k * 5, cy - 10 + k * 3, cx - 20 + k * 6, cy + 66), fill=(58, 44, 36, 150), width=3)
        d.arc((cx - 66, cy + 88, cx + 66, cy + 186), 20, 160, fill=(78, 44, 36, 170), width=4)
        d.line((cx + 42, cy - 70, cx + 108, cy - 20), fill=(40, 30, 26, 210), width=5)
        d.line((cx + 44, cy - 24, cx + 106, cy - 70), fill=(40, 30, 26, 210), width=5)
        for i in range(6):
            y = 746 + i * 32
            d.line((78, y, 560 - (i * 29) % 130, y), fill=(72, 52, 34, 80), width=2)
        ink = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        idr = ImageDraw.Draw(ink)
        idr.ellipse((446, 792, 620, 852), fill=(28, 16, 14, 210))
        idr.ellipse((500, 766, 560, 806), fill=(28, 16, 14, 150))
        page = Image.alpha_composite(page, ink.filter(ImageFilter.GaussianBlur(5)))
        d = ImageDraw.Draw(page)
        for i in range(6):
            x = 350 + i * 44
            d.line((x, 88, x + 24, 112), fill=(132, 46, 38, 170), width=3)
            d.line((x + 24, 88, x, 112), fill=(132, 46, 38, 120), width=2)
        soot = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sod = ImageDraw.Draw(soot)
        sod.ellipse((w - 210, -40, w + 40, 220), fill=(26, 20, 16, 150))
        sod.ellipse((w - 150, 820, w + 10, 980), fill=(30, 22, 16, 60))
        page = Image.alpha_composite(page, soot.filter(ImageFilter.GaussianBlur(26)))
        mask = Image.new("L", (w, h), 255)
        md = ImageDraw.Draw(mask)
        md.polygon([(w - 210, h), (w, h - 190), (w, h - 60), (w - 40, h)], fill=0)
        for y in range(0, h, 22):
            md.polygon([(0, y), (6 + (y * 7) % 22, y + 11), (0, y + 22)], fill=0)
        page.putalpha(ImageChops.multiply(page.getchannel("A"), mask))
        page = page.rotate(-4.2, resample=Image.BICUBIC, expand=False)
    save_rgba(page, name)


def build_props():
    make_lantern("lantern-deep.webp", (54, 44, 32), (220, 188, 112), (152, 126, 82), (240, 196, 112), shape="square")
    make_lantern("lantern-rain.webp", (42, 34, 26), (238, 176, 86), (118, 94, 58), (246, 182, 88), shape="round", droplets=55)
    make_lantern("lantern-gold.webp", (48, 38, 28), (248, 206, 138), (178, 142, 82), (250, 204, 128), shape="onion", seams=True)
    make_lantern("lantern-defeat.webp", (36, 30, 26), (184, 132, 68), (86, 70, 52), (210, 142, 70), shape="fallen", dented=True, salt=True)

    make_ticket("ticket-mist.webp", (156, 168, 158), wet=True, torn=True)
    make_clock("clock-night.webp", (86, 66, 40), (130, 102, 58), (238, 196, 108), 98.5, 102, shape="square", cracked=True)
    make_clock("clock-318.webp", (74, 112, 104), (96, 150, 138), (232, 210, 150), 99, 108, shape="tide", tide=True)

    make_page("page-moon.webp", "moon")
    make_page("page-face.webp", "face")
    make_page("page-last.webp", "blank")
    make_page("page-names.webp", "names")


if __name__ == "__main__":
    build_scenes()
    build_props()
