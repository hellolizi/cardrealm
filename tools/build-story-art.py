from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "story"
OUT.mkdir(parents=True, exist_ok=True)


def rgb(path):
    return Image.open(ROOT / path).convert("RGB")


def fit(im, size):
    return ImageOps.fit(im, size, method=Image.LANCZOS)


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


def grade(im, tint, amount, color=0.92, contrast=1.06):
    im = ImageEnhance.Color(im).enhance(color)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    return Image.blend(im, Image.new("RGB", im.size, tint), amount)


def save(im, name, quality=88):
    path = OUT / name
    im.save(path, "WEBP", quality=quality, method=6)
    print(path.relative_to(ROOT), im.size)


def build_lighthouse():
    im = fit(rgb("assets/stage/dream-hall.webp"), (1792, 1008))
    im = grade(im, (255, 170, 92), 0.13, color=0.9, contrast=1.08)
    im = glow(im, (1390, 660), 430, (190, 96, 32), 0.42)
    im = glow(im, (1290, 540), 190, (255, 176, 82), 0.28)
    im = darken_left(im, 0.66)
    im = darken_bottom(im, 0.28)
    im = vignette(im, 0.6)
    save(im, "lighthouse.webp")


def build_shipwreck():
    im = fit(rgb("assets/cards/deepChart.webp"), (1792, 1008))
    im = grade(im, (18, 42, 64), 0.12, color=0.8, contrast=1.1)
    im = glow(im, (980, 430), 320, (34, 82, 104), 0.3)
    im = glow(im, (760, 520), 150, (224, 152, 74), 0.24)
    im = darken_left(im, 0.7)
    im = darken_bottom(im, 0.4)
    im = vignette(im, 0.62)
    save(im, "shipwreck.webp")


def build_departure():
    im = fit(rgb("assets/world/archipelago.webp"), (1792, 1008))
    im = grade(im, (255, 190, 118), 0.12, color=0.95, contrast=1.04)
    im = glow(im, (1120, 610), 420, (220, 150, 74), 0.3)
    im = glow(im, (980, 540), 180, (255, 206, 142), 0.2)
    im = darken_left(im, 0.64)
    im = darken_bottom(im, 0.34)
    im = vignette(im, 0.56)
    save(im, "departure.webp")


def build_portrait(source, box, name, tint, warmth):
    im = fit(rgb(source).crop(box), (900, 900))
    im = grade(im, tint, warmth, color=0.86, contrast=1.08)
    im = glow(im, (450, 420), 380, tint, 0.2)
    im = vignette(im, 0.62)
    save(im, name)


def build_props():
    import math

    sheet = fit(rgb("assets/cards/deepChart.webp").crop((170, 380, 830, 760)), (760, 500))
    texture = ImageOps.grayscale(sheet)
    parchment = Image.new("RGB", (760, 500), (204, 178, 132))
    paper = Image.blend(parchment, ImageOps.colorize(texture, (92, 68, 44), (228, 206, 166)), 0.38)
    paper = ImageEnhance.Contrast(paper).enhance(1.04)
    paper = Image.blend(paper, Image.new("RGB", paper.size, (255, 238, 200)), 0.08)
    noise = Image.effect_noise((760, 500), 14).convert("L")
    paper = Image.composite(ImageEnhance.Brightness(paper).enhance(1.06), paper, noise.point(lambda v: int(v * 0.14)))

    mask = Image.new("L", (760, 500), 255)
    md = ImageDraw.Draw(mask)
    torn = [(760, 0)]
    for y in range(0, 501, 25):
        torn.append((760 - (8 + (y * 7) % 19), y))
    torn.append((760, 500))
    md.polygon(torn, fill=0)
    md.rounded_rectangle((0, 0, 759, 499), radius=12, outline=0, width=2)

    ticket = paper.convert("RGBA")
    ticket.putalpha(mask)
    wash = Image.new("RGBA", (760, 500), (44, 28, 16, 0))
    wd = ImageDraw.Draw(wash)
    wd.rounded_rectangle((26, 24, 506, 250), radius=8, fill=(44, 28, 16, 46))
    wd.rectangle((26, 276, 470, 278), fill=(88, 58, 34, 120))
    wd.rectangle((26, 286, 470, 287), fill=(88, 58, 34, 70))
    ticket.alpha_composite(wash)

    draw = ImageDraw.Draw(ticket)
    yahei = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 28)
    yahei_small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 20)
    yahei_big = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 62)
    georgia = ImageFont.truetype("C:/Windows/Fonts/georgia.ttf", 26)
    ink = (48, 32, 20, 235)
    faint = (66, 46, 28, 195)
    light = (238, 218, 178, 150)
    stamp = (120, 42, 32, 190)

    def stamped_text(pos, text, font, fill, stroke=1):
        x, y = pos
        draw.text((x + 1, y + 2), text, font=font, fill=light, stroke_width=stroke, stroke_fill=light)
        draw.text((x, y), text, font=font, fill=fill)

    stamped_text((46, 40), "白鹭号 · 登船凭据", yahei, ink)
    stamped_text((46, 96), "三月十七", yahei_big, ink, 2)
    stamped_text((48, 190), "凌晨 03:17 · 第九号甲板", yahei_small, faint)
    draw.text((48, 418), "No. 0917", font=georgia, fill=faint)
    draw.ellipse((548, 286, 704, 442), outline=stamp, width=5)
    draw.ellipse((566, 304, 686, 424), outline=(120, 42, 32, 120), width=2)
    draw.text((590, 324), "灯", font=ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 58), fill=stamp)
    draw.text((588, 394), "十二年前", font=yahei_small, fill=(120, 42, 32, 170))
    draw.line((548, 452, 704, 452), fill=(120, 42, 32, 90), width=1)
    save(ticket, "ticket.webp")

    size = 760
    clock = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(clock)
    cx = cy = size // 2
    for r, color in [(352, (38, 28, 18, 255)), (338, (114, 87, 48, 255)), (326, (196, 158, 94, 255)), (316, (58, 44, 27, 255))]:
        cd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)

    face_mask = Image.new("L", (600, 600), 0)
    ImageDraw.Draw(face_mask).ellipse((0, 0, 599, 599), fill=255)
    face = Image.radial_gradient("L").resize((600, 600))
    face = ImageOps.invert(face)
    face = ImageOps.colorize(face, (8, 7, 7), (54, 42, 30)).convert("RGBA")
    face.putalpha(face_mask)
    clock.alpha_composite(face, (cx - 300, cy - 300))
    cd.ellipse((cx - 300, cy - 300, cx + 300, cy + 300), outline=(196, 158, 94, 160), width=3)
    cd.ellipse((cx - 286, cy - 286, cx + 286, cy + 286), outline=(196, 158, 94, 60), width=1)

    serif = ImageFont.truetype("C:/Windows/Fonts/georgia.ttf", 58)
    for hour, label in [(12, "XII"), (3, "III"), (6, "VI"), (9, "IX")]:
        angle = hour * 30 - 90
        lx = cx + math.cos(math.radians(angle)) * 236
        ly = cy + math.sin(math.radians(angle)) * 236
        box = cd.textbbox((0, 0), label, font=serif)
        cd.text((lx - (box[2] - box[0]) / 2, ly - (box[3] - box[1]) / 2 - 10), label, font=serif, fill=(222, 198, 154, 240))

    for i in range(60):
        angle = i * 6 - 90
        inner = 262 if i % 5 else 246
        outer = 284
        x1 = cx + math.cos(math.radians(angle)) * inner
        y1 = cy + math.sin(math.radians(angle)) * inner
        x2 = cx + math.cos(math.radians(angle)) * outer
        y2 = cy + math.sin(math.radians(angle)) * outer
        cd.line((x1, y1, x2, y2), fill=(196, 158, 94, 150 if i % 5 else 225), width=3 if i % 5 else 5)

    minute_angle = math.radians(17 * 6 - 90)
    hour_angle = math.radians((3 + 17 / 60) * 30 - 90)
    cd.line((cx, cy, cx + math.cos(hour_angle) * 170, cy + math.sin(hour_angle) * 170), fill=(232, 204, 158, 255), width=14)
    cd.line((cx, cy, cx + math.cos(minute_angle) * 252, cy + math.sin(minute_angle) * 252), fill=(240, 214, 170, 255), width=8)
    cd.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), fill=(232, 204, 158, 255))
    cd.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(72, 50, 30, 255))
    cd.arc((cx - 292, cy - 292, cx + 292, cy + 292), 200, 260, fill=(255, 246, 220, 90), width=5)
    save(clock, "clock.webp")


build_lighthouse()
build_shipwreck()
build_departure()
build_portrait("assets/cards/lampWard.webp", (0, 0, 620, 620), "npc-ember.webp", (120, 64, 30), 0.1)
build_portrait("assets/cards/ferryFare.webp", (0, 60, 620, 680), "npc-ferry.webp", (20, 54, 66), 0.1)
build_portrait("assets/cards/inkEcho.webp", (60, 60, 680, 680), "npc-ink.webp", (54, 28, 74), 0.12)
build_props()