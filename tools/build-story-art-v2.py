"""剧情美术库 v2：为后 22 段剧情补齐场景、立绘与道具。

素材全部来自项目内已有的卡面 / 立绘 / 场景图，只做取景、调色、蒙版与
合成，不引入外部版权素材。输出到 assets/story/。
"""

from pathlib import Path
import math

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "story"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1792, 1008


def rgb(path):
    return Image.open(ROOT / path).convert("RGB")


def fit(im, size):
    return ImageOps.fit(im, size, method=Image.LANCZOS)


def wide(path, box=None, anchor=0.5):
    im = rgb(path)
    if box:
        im = im.crop(box)
    else:
        # ImageOps.fit 固定居中；需要偏上取景时先裁成 16:9。
        w, h = im.size
        target = w / (W / H)
        if h > target:
            top = max(0, int((h - target) * anchor))
            im = im.crop((0, top, w, top + int(target)))
    return fit(im, (W, H))


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


def save(im, name, quality=88):
    path = OUT / name
    im.convert("RGB").save(path, "WEBP", quality=quality, method=6)
    print(path.relative_to(ROOT), im.size)


def save_rgba(im, name, quality=90):
    path = OUT / name
    im.save(path, "WEBP", quality=quality, method=6)
    print(path.relative_to(ROOT), im.size)


def soft_mask(size, feather=0.32):
    w, h = size
    mask = Image.radial_gradient("L").resize((w, h))
    mask = ImageOps.invert(mask)
    mask = mask.point(lambda v: min(255, int(v * (1 / max(0.05, 1 - feather)))))
    return mask.filter(ImageFilter.GaussianBlur(max(6, w // 28)))


def paste_subject(base, path, box, size, opacity=0.85, glow_color=None, glow_strength=0.22):
    subject = fit(rgb(path), size)
    mask = soft_mask(size).point(lambda v: int(v * opacity))
    layer = base.convert("RGBA")
    subject = subject.convert("RGBA")
    subject.putalpha(mask)
    layer.alpha_composite(subject, (box[0], box[1]))
    base = layer.convert("RGB")
    if glow_color:
        base = glow(base, (box[0] + size[0] // 2, box[1] + size[1] // 2), max(size) // 2, glow_color, glow_strength)
    return base


def rain(im, count=260, color=(150, 174, 186), alpha=54, length=(18, 54), tilt=0.22):
    w, h = im.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    seed = 917
    for i in range(count):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        x = seed % w
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        y = seed % h
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        ln = length[0] + seed % (length[1] - length[0])
        a = alpha - (i % 3) * 9
        d.line([(x, y), (x - ln * tilt, y + ln)], fill=(*color, max(12, a)), width=1)
    layer = layer.filter(ImageFilter.GaussianBlur(0.35))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def motes(im, count=90, color=(236, 190, 112), y_range=(0.25, 0.95)):
    w, h = im.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    seed = 317
    for i in range(count):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        x = seed % w
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        y = int(h * (y_range[0] + (seed % 1000) / 1000 * (y_range[1] - y_range[0])))
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        r = 1 + seed % 3
        a = 36 + seed % 90
        d.ellipse((x - r, y - r, x + r, y + r), fill=(*color, a))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def shards(im, count=26):
    w, h = im.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    seed = 771
    for i in range(count):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        x = seed % w
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        y = seed % h
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        size = 20 + seed % 90
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        skew = (seed % 40) - 20
        pts = [(x, y), (x + size * 0.6, y + size), (x + size * 0.5 + skew, y + size * 1.4), (x - size * 0.2, y + size * 0.5)]
        d.polygon(pts, fill=(196, 186, 232, 18 + i % 22))
    return Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(0.5))).convert("RGB")


# ─────────────────────────── 场景 ───────────────────────────


def build_scenes():
    # 古龙倒下后的海面：黑金鳞片与钥匙形的尸骸。
    im = wide("assets/enemies/nightmare-dragon.webp", (0, 40, 960, 580))
    im = grade(im, (28, 18, 10), 0.12, color=0.9, contrast=1.08)
    im = glow(im, (620, 470), 380, (214, 144, 58), 0.32)
    im = motes(im, 110, (242, 188, 92), (0.2, 0.95))
    im = darken_left(im, 0.72)
    im = darken_bottom(im, 0.42)
    im = vignette(im, 0.6)
    save(im, "dragon-falls.webp")

    # 雾退之后的滩涂：雾后、船票与岸。
    im = fit(rgb("assets/cards/mistChart.webp"), (W, H))
    im = grade(im, (18, 34, 42), 0.1, color=0.8, contrast=1.1)
    im = paste_subject(im, "assets/enemies/mist-queen.webp", (1080, 20), (680, 900), 0.8, (128, 188, 172), 0.18)
    im = glow(im, (1360, 600), 420, (96, 170, 154), 0.2)
    im = rain(im, 120, (168, 196, 190), 28, (14, 34), 0.05)
    im = motes(im, 60, (198, 212, 196), (0.35, 0.92))
    im = darken_left(im, 0.74)
    im = darken_bottom(im, 0.4)
    im = vignette(im, 0.62)
    save(im, "mist-shore.webp")

    # 骨庭：纸王冠与蜡烛。
    im = wide("assets/enemies/bone-king.webp", (0, 20, 960, 560))
    im = grade(im, (36, 20, 10), 0.16, color=0.82, contrast=1.08)
    im = glow(im, (700, 470), 420, (200, 132, 52), 0.28)
    im = motes(im, 80, (232, 176, 92), (0.2, 0.9))
    im = darken_left(im, 0.72)
    im = darken_bottom(im, 0.4)
    im = vignette(im, 0.62)
    save(im, "bone-hall.webp")

    # 镜潮：碎镜与未完成的未来。
    im = wide("assets/enemies/mirror-sovereign.webp", (0, 20, 960, 560))
    im = grade(im, (26, 22, 44), 0.12, color=0.84, contrast=1.1)
    im = shards(im, 34)
    im = glow(im, (900, 480), 380, (128, 108, 196), 0.3)
    im = darken_left(im, 0.72)
    im = darken_bottom(im, 0.44)
    im = vignette(im, 0.64)
    save(im, "mirror-field.webp")

    # 十二年前的风暴夜：白鹭号触礁。
    im = fit(rgb("assets/cards/deepChart.webp"), (W, H))
    im = grade(im, (12, 24, 40), 0.14, color=0.74, contrast=1.12, brightness=0.92)
    im = glow(im, (1460, 520), 330, (214, 152, 82), 0.34)
    im = glow(im, (1440, 500), 120, (255, 196, 120), 0.22)
    im = rain(im, 420, (142, 164, 182), 62, (24, 70), 0.3)
    im = darken_left(im, 0.74)
    im = darken_bottom(im, 0.46)
    im = vignette(im, 0.66)
    save(im, "storm-night.webp")

    # 灰烬岛：烧名字的灯塔。
    im = fit(rgb("assets/story/lighthouse.webp"), (W, H))
    im = paste_subject(im, "assets/enemies/ash-saint.webp", (1020, 30), (760, 950), 0.78, (226, 132, 56), 0.28)
    im = grade(im, (70, 22, 8), 0.14, color=0.88, contrast=1.08)
    im = glow(im, (1280, 560), 460, (220, 112, 40), 0.42)
    im = motes(im, 140, (246, 176, 88), (0.12, 0.96))
    im = darken_left(im, 0.76)
    im = darken_bottom(im, 0.4)
    im = vignette(im, 0.6)
    save(im, "ash-lighthouse.webp")

    # 潮钟：指针从三点十七分挪向三点十八分。
    im = wide("assets/enemies/tide-warden.webp", (0, 10, 960, 550))
    im = grade(im, (14, 34, 40), 0.14, color=0.78, contrast=1.1)
    im = glow(im, (1260, 300), 300, (96, 178, 176), 0.28)
    im = rain(im, 180, (150, 190, 190), 34, (16, 46), 0.12)
    im = darken_left(im, 0.76)
    im = darken_bottom(im, 0.44)
    im = vignette(im, 0.64)
    save(im, "tide-clocktower.webp")

    # 纸月：剪出来的月亮与稿纸。
    im = wide("assets/enemies/paper-queen.webp", (0, 10, 960, 550))
    im = grade(im, (48, 36, 26), 0.1, color=0.78, contrast=1.04, brightness=1.04)
    im = glow(im, (760, 300), 460, (232, 206, 158), 0.3)
    im = motes(im, 80, (238, 220, 180), (0.08, 0.9))
    im = darken_left(im, 0.7)
    im = darken_bottom(im, 0.4)
    im = vignette(im, 0.58)
    save(im, "paper-moon.webp")

    # 最后一夜：灯塔下的雨桌。
    im = fit(rgb("assets/story/lighthouse.webp"), (W, H))
    im = grade(im, (22, 26, 34), 0.18, color=0.82, contrast=1.06, brightness=0.9)
    im = glow(im, (1120, 640), 380, (232, 154, 72), 0.38)
    im = rain(im, 300, (146, 168, 178), 40, (20, 60), 0.24)
    im = darken_left(im, 0.76)
    im = darken_bottom(im, 0.38)
    im = vignette(im, 0.6)
    save(im, "rain-table.webp")

    # 海心：所有灯同时转向的地方。
    im = wide("assets/enemies/hollow-heart.webp", (0, 40, 960, 580))
    im = grade(im, (32, 16, 16), 0.1, color=0.9, contrast=1.06)
    im = motes(im, 160, (246, 196, 122), (0.45, 0.98))
    im = glow(im, (900, 430), 440, (224, 138, 96), 0.34)
    im = darken_left(im, 0.74)
    im = darken_bottom(im, 0.36)
    im = vignette(im, 0.6)
    save(im, "heart-sea.webp")

    # 梦隙：海面裂开的地方。
    im = fit(rgb("assets/cards/deepChart.webp"), (W, H))
    im = grade(im, (20, 12, 36), 0.18, color=0.82, contrast=1.12, brightness=0.94)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    center = W * 0.66
    pts = [(center + math.sin(y / 86) * 14, y) for y in range(0, H, 8)]
    for width, color, alpha in [(14, (110, 66, 190), 54), (5, (172, 118, 240), 120), (1, (240, 210, 255), 190)]:
        d.line(pts, fill=(*color, alpha), width=width, joint="curve")
    layer = layer.filter(ImageFilter.GaussianBlur(1.1))
    im = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    im = glow(im, (int(center), 470), 330, (112, 74, 190), 0.34)
    im = motes(im, 70, (188, 156, 236), (0.1, 0.9))
    im = darken_left(im, 0.74)
    im = darken_bottom(im, 0.42)
    im = vignette(im, 0.64)
    save(im, "rift-sea.webp")

    # 墨的房间：稿纸、墨迹与一盏低灯。
    im = fit(rgb("assets/cards/inkEcho.webp"), (W, H))
    im = grade(im, (28, 20, 30), 0.16, color=0.78, contrast=1.12, brightness=0.92)
    im = glow(im, (310, 600), 380, (210, 152, 82), 0.34)
    im = glow(im, (1060, 520), 460, (84, 48, 112), 0.24)
    im = motes(im, 70, (196, 168, 120), (0.2, 0.92))
    im = darken_left(im, 0.78)
    im = darken_bottom(im, 0.42)
    im = vignette(im, 0.62)
    save(im, "ink-desk.webp")

    # 失败后的黑海：一盏灯还在漂。
    im = fit(rgb("assets/cards/mistChart.webp"), (W, H))
    im = grade(im, (8, 12, 20), 0.28, color=0.62, contrast=1.12, brightness=0.82)
    im = glow(im, (430, 660), 250, (224, 156, 80), 0.44)
    im = glow(im, (430, 660), 90, (255, 208, 132), 0.34)
    im = rain(im, 140, (128, 148, 164), 28, (14, 40), 0.16)
    im = darken_left(im, 0.6)
    im = darken_bottom(im, 0.5)
    im = vignette(im, 0.7)
    save(im, "dark-sea.webp")


# ─────────────────────────── 立绘 ───────────────────────────


def build_portrait(source, box, name, tint, warmth, brightness=1.0, contrast=1.08, glow_color=None, glow_strength=0.2):
    im = fit(rgb(source).crop(box), (900, 900))
    im = grade(im, tint, warmth, color=0.86, contrast=contrast, brightness=brightness)
    im = glow(im, (450, 420), 380, glow_color or tint, glow_strength)
    im = vignette(im, 0.62)
    save(im, name)


def build_portraits():
    # 十二年前的烬：同一盏灯，脸还没被烟熏黑。
    build_portrait("assets/cards/lampWard.webp", (70, 0, 750, 680), "npc-ember-young.webp",
                   (132, 92, 46), 0.1, brightness=1.12, contrast=1.02, glow_color=(240, 190, 110), glow_strength=0.3)
    # 梦魇之主：岛屿之主的统称，取镜潮之主的王座剪影。
    build_portrait("assets/enemies/mirror-sovereign.webp", (170, 60, 850, 740), "npc-nightmare-lord.webp",
                   (24, 26, 48), 0.16, brightness=0.96, glow_color=(112, 104, 178), glow_strength=0.24)
    # 缄默之心：一颗借来的心跳。
    build_portrait("assets/enemies/hollow-heart.webp", (120, 70, 860, 810), "npc-heart.webp",
                   (56, 22, 18), 0.12, brightness=1.0, glow_color=(226, 132, 92), glow_strength=0.26)
    # 古龙：锁了十二年的锁。
    build_portrait("assets/enemies/nightmare-dragon.webp", (80, 20, 880, 820), "npc-dragon.webp",
                   (48, 34, 16), 0.1, brightness=1.0, glow_color=(224, 170, 86), glow_strength=0.24)
    # 隙：没有形体，只有一道会说话的裂口。
    im = fit(rgb("assets/cards/moonScript.webp").crop((150, 40, 950, 840)), (900, 900))
    im = grade(im, (18, 12, 34), 0.32, color=0.72, contrast=1.16, brightness=0.9)
    layer = Image.new("RGBA", (900, 900), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = 450
    pts = [(cx + math.sin(y / 26) * 5, y) for y in range(30, 870, 4)]
    for width, color, alpha in [(18, (88, 58, 160), 70), (6, (172, 132, 235), 130), (2, (248, 232, 255), 210)]:
        d.line(pts, fill=(*color, alpha), width=width, joint="curve")
    d.ellipse((382, 360, 518, 480), fill=(6, 4, 10, 235))
    d.ellipse((402, 388, 498, 452), outline=(180, 146, 238, 120), width=2)
    d.ellipse((430, 408, 470, 436), fill=(142, 104, 214, 150))
    im = Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(0.7))).convert("RGB")
    im = glow(im, (450, 440), 300, (118, 80, 196), 0.32)
    im = vignette(im, 0.66)
    save(im, "npc-rift.webp")


# ─────────────────────────── 道具 ───────────────────────────


def paper_texture(size):
    sheet = fit(rgb("assets/cards/deepChart.webp").crop((170, 380, 830, 760)), size)
    texture = ImageOps.grayscale(sheet)
    parchment = Image.new("RGB", size, (204, 178, 132))
    paper = Image.blend(parchment, ImageOps.colorize(texture, (92, 68, 44), (228, 206, 166)), 0.38)
    paper = ImageEnhance.Contrast(paper).enhance(1.04)
    return Image.blend(paper, Image.new("RGB", size, (255, 238, 200)), 0.08)


def torn_mask(size, torn_right=True):
    w, h = size
    mask = Image.new("L", size, 255)
    d = ImageDraw.Draw(mask)
    edge = []
    if torn_right:
        edge.append((w, 0))
        for y in range(0, h + 1, 18):
            edge.append((w - (7 + (y * 11) % 23), y))
        edge.append((w, h))
    else:
        edge.append((0, h))
        for y in range(h, -1, -18):
            edge.append(((7 + (y * 11) % 23), y))
        edge.append((0, 0))
    d.polygon(edge, fill=0)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=10, outline=0, width=2)
    return mask


def build_props():
    yahei = "C:/Windows/Fonts/msyh.ttc"
    serif = "C:/Windows/Fonts/georgia.ttf"

    # 钟针：烧黑的一端停在三点十七分。
    size = 760
    needle = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    nd = ImageDraw.Draw(needle)
    cx, cy = size // 2, size // 2
    angle = math.radians(-58)
    length = 300
    tipx, tipy = cx + math.cos(angle) * length, cy + math.sin(angle) * length
    tailx, taily = cx - math.cos(angle) * 80, cy - math.sin(angle) * 80
    nd.line((tailx, taily, tipx, tipy), fill=(36, 26, 16, 255), width=26)
    nd.line((tailx, taily, tipx, tipy), fill=(148, 108, 56, 255), width=16)
    nd.line((tailx, taily, tipx, tipy), fill=(218, 180, 108, 255), width=7)
    nd.ellipse((tipx - 22, tipy - 22, tipx + 22, tipy + 22), fill=(22, 14, 10, 255))
    nd.ellipse((tipx - 14, tipy - 14, tipx + 14, tipy + 14), fill=(96, 58, 30, 255))
    nd.ellipse((cx - 58, cy - 58, cx + 58, cy + 58), fill=(48, 34, 20, 255))
    nd.ellipse((cx - 44, cy - 44, cx + 44, cy + 44), fill=(168, 128, 68, 255))
    nd.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), fill=(26, 18, 12, 255))
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    gd.ellipse((cx - 90, cy - 90, cx + 90, cy + 90), fill=(224, 168, 82, 40))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(30))
    needle = Image.alpha_composite(glow_layer, needle)
    save_rgba(needle, "needle.webp")

    # 纸王冠：轻得像一页纸。
    cw, ch = 760, 500
    crown = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cd = ImageDraw.Draw(crown)
    base_y = 360
    peaks = [(60, 300), (170, 130), (285, 250), (390, 80), (500, 240), (620, 120), (700, 300)]
    crown_poly = [(60, base_y)] + peaks + [(700, base_y)]
    texture = paper_texture((cw, ch)).convert("RGBA")
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).polygon(crown_poly, fill=255)
    texture.putalpha(mask)
    crown.alpha_composite(texture)
    cd.line(peaks, fill=(92, 64, 38, 210), width=5, joint="curve")
    cd.line([(60, base_y), (700, base_y)], fill=(92, 64, 38, 230), width=6)
    cd.line([(70, base_y - 34), (690, base_y - 34)], fill=(120, 86, 48, 120), width=2)
    for x, y in peaks:
        cd.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(128, 88, 44, 190))
    for i in range(3):
        cd.line([(150 + i * 190, base_y - 10), (140 + i * 190, base_y - 120)], fill=(110, 78, 44, 90), width=2)
    crown = crown.rotate(-4, resample=Image.BICUBIC, expand=False)
    save_rgba(crown, "crown.webp")

    # 旧灯：灯罩上有一道用金线补过的裂痕。
    size = 760
    lantern = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lantern)
    cx, cy = size // 2, 390
    halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((cx - 200, cy - 210, cx + 200, cy + 210), fill=(248, 184, 84, 54))
    halo = halo.filter(ImageFilter.GaussianBlur(46))
    lantern = Image.alpha_composite(lantern, halo)
    # 提环
    ld.arc((cx - 88, cy - 270, cx + 88, cy - 96), 200, 340, fill=(196, 158, 96, 255), width=10)
    ld.line((cx - 74, cy - 190, cx - 74, cy - 152), fill=(196, 158, 96, 255), width=10)
    ld.line((cx + 74, cy - 190, cx + 74, cy - 152), fill=(196, 158, 96, 255), width=10)
    # 灯身
    body = [(cx - 118, cy - 152), (cx + 118, cy - 152), (cx + 148, cy + 180), (cx - 148, cy + 180)]
    glass = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.polygon(body, fill=(250, 190, 88, 214))
    inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ind = ImageDraw.Draw(inner)
    ind.ellipse((cx - 60, cy - 20, cx + 60, cy + 170), fill=(255, 236, 174, 235))
    inner = inner.filter(ImageFilter.GaussianBlur(20))
    glass = Image.alpha_composite(glass, inner)
    lantern = Image.alpha_composite(lantern, glass)
    ld.line(body + [body[0]], fill=(54, 38, 24, 255), width=16, joint="curve")
    for x in (-60, 0, 60):
        ld.line((cx + x, cy - 150, cx + x * 1.2, cy + 178), fill=(54, 38, 24, 190), width=5)
    ld.line([(cx - 132, cy + 40), (cx - 70, cy + 150)], fill=(212, 170, 96, 210), width=3)
    ld.line((cx - 160, cy + 180, cx + 160, cy + 180), fill=(64, 44, 26, 255), width=20)
    ld.line((cx - 120, cy + 206, cx + 120, cy + 206), fill=(42, 30, 20, 255), width=14)
    ld.ellipse((cx - 34, cy + 206, cx + 34, cy + 238), fill=(168, 128, 68, 255))
    save_rgba(lantern, "lantern.webp")

    # 空白牌：定金，背面只有一道缝。
    cw, ch = 620, 860
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((8, 8, cw - 8, ch - 8), radius=26, fill=(18, 14, 24, 246), outline=(154, 126, 88, 220), width=4)
    cd.rounded_rectangle((34, 34, cw - 34, ch - 34), radius=16, outline=(94, 70, 132, 180), width=2)
    for i in range(9):
        y = 90 + i * 78
        cd.line((72, y, cw - 72, y), fill=(72, 56, 92, 90), width=1)
    crack = [(cw // 2 + math.sin(y / 22) * 8, 80 + y) for y in range(0, 700, 8)]
    for width, color, alpha in [(13, (96, 64, 168), 70), (4, (176, 138, 240), 170), (1, (245, 232, 255), 210)]:
        cd.line(crack, fill=(*color, alpha), width=width, joint="curve")
    font = ImageFont.truetype(yahei, 34)
    cd.text((cw // 2 - 30, ch - 150), "隙", font=font, fill=(174, 146, 214, 170))
    save_rgba(card, "blank-card.webp")

    # 两面同一张脸的金币。
    size = 760
    coin = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(coin)
    cx = cy = size // 2
    halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((cx - 250, cy - 250, cx + 250, cy + 250), fill=(230, 180, 80, 46))
    halo = halo.filter(ImageFilter.GaussianBlur(40))
    coin = Image.alpha_composite(coin, halo)
    for r, color in [(270, (88, 64, 28, 255)), (252, (196, 152, 72, 255)), (232, (126, 94, 42, 255)), (214, (218, 174, 92, 255))]:
        cd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    cd.arc((cx - 232, cy - 232, cx + 232, cy + 232), 200, 340, fill=(252, 220, 150, 180), width=6)
    # 两张相对的侧脸
    for flip in (-1, 1):
        pts = []
        for t in range(0, 101, 4):
            x = flip * (20 + t * 0.9)
            y = -46 + math.sin(t / 100 * math.pi) * 34 - t * 0.02
            pts.append((cx + x, cy + y))
        cd.line(pts, fill=(92, 62, 26, 230), width=8, joint="curve")
        cd.ellipse((cx + flip * 108 - 12, cy - 16, cx + flip * 108 + 12, cy + 20), outline=(92, 62, 26, 230), width=5)
    font = ImageFont.truetype(yahei, 46)
    cd.text((cx - 23, cy + 88), "赌", font=font, fill=(86, 58, 24, 230))
    save_rgba(coin, "coin.webp")

    # 被划掉的那一页：守灯人未归。
    pw, ph = 760, 1000
    page = paper_texture((pw, ph)).convert("RGBA")
    mask = torn_mask((pw, ph))
    page.putalpha(mask)
    pd = ImageDraw.Draw(page)
    pd.rounded_rectangle((34, 34, pw - 40, ph - 40), radius=8, outline=(126, 94, 58, 90), width=2)
    big = ImageFont.truetype(yahei, 46)
    small = ImageFont.truetype(yahei, 28)
    ink = (54, 38, 24, 235)
    faint = (76, 54, 34, 160)
    pd.text((64, 70), "三月十七日", font=big, fill=ink)
    pd.text((64, 138), "凌晨三点十七分", font=small, fill=faint)
    pd.text((64, 188), "守灯人未归。", font=big, fill=ink)
    pd.line((52, 260, 610, 260), fill=(96, 66, 40, 120), width=2)
    for i in range(7):
        y = 300 + i * 58
        pd.line((64, y, 64 + 380 + (i * 47) % 190, y), fill=(72, 52, 34, 70), width=3)
    # 反复划掉的那一行
    for off in range(3):
        pd.line((58, 192 + off * 7, 560, 176 + off * 7), fill=(96, 30, 26, 210), width=4)
    # 墨渍
    stain = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stain)
    sd.ellipse((540, 780, 704, 944), fill=(34, 22, 34, 110))
    sd.ellipse((586, 820, 668, 902), fill=(20, 12, 24, 170))
    stain = stain.filter(ImageFilter.GaussianBlur(9))
    page = Image.alpha_composite(page, stain)
    save_rgba(page, "page.webp")


build_scenes()
build_portraits()
build_props()
