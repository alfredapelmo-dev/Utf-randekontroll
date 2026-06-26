# -*- coding: utf-8 -*-
"""
Genererar bildtillgångar för demon (helt offline, inga externa beroenden utöver Pillow):
  - assets/drawing-sample.png      : exempel-planritning (bakgrund i ritningsvyn)
  - assets/photo-extinguisher.jpg  : exempelfoto (seedad avvikelse)
  - assets/photo-door.jpg          : exempelfoto (seedad avvikelse)
  - assets/icons/*.png             : PWA-ikoner (vanliga + maskable) + apple-touch + favicon

Kör:  python Demo/tools/generate_assets.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))
ICONS = os.path.join(ASSETS, "icons")
os.makedirs(ICONS, exist_ok=True)

BRAND = (198, 40, 40)        # röd, samma temafärg som appen
INK = (33, 37, 41)
WALL = (40, 44, 52)
GRID = (225, 228, 232)


def font(size, bold=False):
    candidates = (
        ["arialbd.ttf", "Arial Bold.ttf"] if bold else ["arial.ttf", "Arial.ttf"]
    )
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            pass
    # Windows-systemfont som fallback
    for path in [r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
                 r"C:\Windows\Fonts\segoeui.ttf"]:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def center_text(d, box, text, f, fill):
    x0, y0, x1, y1 = box
    tb = d.textbbox((0, 0), text, font=f)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text((x0 + (x1 - x0 - tw) / 2 - tb[0], y0 + (y1 - y0 - th) / 2 - tb[1]),
           text, font=f, fill=fill)


# ---------------------------------------------------------------- planritning
def make_drawing():
    W, H = 1600, 1120
    img = Image.new("RGB", (W, H), (252, 252, 250))
    d = ImageDraw.Draw(img)

    # svag rutnät-bakgrund (som ett ritningsark)
    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=GRID, width=1)
    for y in range(0, H, 40):
        d.line([(0, y), (W, y)], fill=GRID, width=1)

    m = 90
    ox0, oy0, ox1, oy1 = m, m, W - m, H - m
    tw = 14  # väggtjocklek

    def wall(x0, y0, x1, y1):
        d.rectangle([x0 - tw / 2, y0 - tw / 2, x1 + tw / 2, y1 + tw / 2], fill=WALL)

    # yttervägg
    wall(ox0, oy0, ox1, oy0)  # topp
    wall(ox0, oy1, ox1, oy1)  # botten
    wall(ox0, oy0, ox0, oy1)  # vänster
    wall(ox1, oy0, ox1, oy1)  # höger

    # innerväggar
    vx = 600
    hx = 1060
    wall(vx, oy0, vx, oy1)            # lodrät vägg vänster zon | höger zon
    wall(vx, 560, ox1, 560)          # vågrät vägg i höger zon
    wall(hx, 560, hx, oy1)           # lodrät vägg höger-nedre

    # dörröppningar (vita gap + karmstreck)
    def door(x0, y0, x1, y1):
        d.rectangle([x0 - tw / 2 - 1, y0 - tw / 2 - 1, x1 + tw / 2 + 1, y1 + tw / 2 + 1],
                    fill=(252, 252, 250))
        d.line([x0, y0, x1, y1], fill=(150, 150, 150), width=2)

    door(vx, 470, vx, 560)           # vänster<->höger
    door(800, 560, 900, 560)         # konferens<->kontor
    door(hx, 740, hx, 830)           # kontor<->teknik
    # entrédörr i nedre yttervägg
    door(330, oy1, 470, oy1)

    # rumsetiketter
    fr = font(40, bold=True)
    fsub = font(26)
    labels = [
        ("LAGER", (vx + ox0) / 2, (oy0 + oy1) / 2),
        ("KONFERENS", (vx + ox1) / 2, (oy0 + 560) / 2),
        ("KONTOR", (vx + hx) / 2, (560 + oy1) / 2),
        ("TEKNIK", (hx + ox1) / 2, (560 + oy1) / 2),
    ]
    for txt, cx, cy in labels:
        tb = d.textbbox((0, 0), txt, font=fr)
        d.text((cx - (tb[2] - tb[0]) / 2, cy - (tb[3] - tb[1]) / 2), txt, font=fr, fill=(120, 124, 130))

    # entré-text
    d.text((360, oy1 - 46), "ENTRÉ", font=fsub, fill=(120, 124, 130))

    # norrpil
    nx, ny = ox1 - 70, oy0 + 80
    d.polygon([(nx, ny - 46), (nx - 18, ny + 18), (nx, ny + 4), (nx + 18, ny + 18)], fill=INK)
    d.text((nx - 8, ny + 22), "N", font=font(26, bold=True), fill=INK)

    # skalstock
    sx, sy = ox0 + 30, oy1 - 36
    d.rectangle([sx, sy, sx + 200, sy + 12], outline=INK, width=2)
    d.rectangle([sx, sy, sx + 100, sy + 12], fill=INK)
    d.text((sx, sy - 30), "0          5 m", font=fsub, fill=INK)

    # titelruta uppe till vänster
    d.rectangle([ox0, oy0 - 0, ox0 + 360, oy0 + 64], fill=(255, 255, 255), outline=WALL, width=2)
    d.text((ox0 + 14, oy0 + 10), "PLANRITNING – PLAN 1", font=font(24, bold=True), fill=INK)
    d.text((ox0 + 14, oy0 + 38), "Demo · Utförandekontroll", font=fsub, fill=(110, 114, 120))

    img.save(os.path.join(ASSETS, "drawing-sample.png"), "PNG")
    print("drawing-sample.png", img.size)


# ---------------------------------------------------------------- exempelfoton
def make_photo_extinguisher():
    W, H = 1000, 1333
    img = Image.new("RGB", (W, H), (205, 208, 212))
    d = ImageDraw.Draw(img)
    d.rectangle([0, int(H * 0.72), W, H], fill=(168, 150, 128))      # golv
    # brandsläckare
    cx = W // 2
    d.rounded_rectangle([cx - 110, 360, cx + 110, 980], radius=70, fill=BRAND)
    d.rectangle([cx - 38, 300, cx + 38, 380], fill=(30, 30, 30))     # ventil
    d.rectangle([cx + 20, 300, cx + 150, 330], fill=(30, 30, 30))    # slang
    d.ellipse([cx - 90, 560, cx + 90, 740], fill=(245, 245, 245))    # etikett
    d.rectangle([0, 0, W, 70], fill=(0, 0, 0))
    d.text((20, 18), "Exempelfoto · brandsläckare", font=font(34, bold=True), fill=(255, 255, 255))
    img.save(os.path.join(ASSETS, "photo-extinguisher.jpg"), "JPEG", quality=82)
    print("photo-extinguisher.jpg", img.size)


def make_photo_door():
    W, H = 1000, 1333
    img = Image.new("RGB", (W, H), (210, 212, 215))
    d = ImageDraw.Draw(img)
    d.rectangle([0, int(H * 0.78), W, H], fill=(160, 145, 125))
    # dörr
    d.rectangle([260, 250, 740, 1040], fill=(110, 120, 135), outline=(60, 66, 78), width=10)
    d.rectangle([300, 290, 700, 1000], outline=(70, 78, 92), width=6)
    d.ellipse([670, 640, 710, 700], fill=(40, 44, 52))             # handtag
    # grön nödutgångsskylt
    d.rectangle([300, 150, 520, 240], fill=(0, 122, 51))
    d.text((315, 175), "UTGÅNG", font=font(34, bold=True), fill=(255, 255, 255))
    d.rectangle([0, 0, W, 70], fill=(0, 0, 0))
    d.text((20, 18), "Exempelfoto · branddörr", font=font(34, bold=True), fill=(255, 255, 255))
    img.save(os.path.join(ASSETS, "photo-door.jpg"), "JPEG", quality=82)
    print("photo-door.jpg", img.size)


# ---------------------------------------------------------------- ikoner
def flame_points(size, pad):
    s = size - 2 * pad
    pts = [(0.50, 0.06), (0.66, 0.34), (0.60, 0.50), (0.74, 0.44),
           (0.72, 0.66), (0.58, 0.74), (0.66, 0.84), (0.50, 0.94),
           (0.34, 0.84), (0.30, 0.66), (0.40, 0.70), (0.34, 0.50),
           (0.44, 0.54), (0.38, 0.30)]
    return [(pad + x * s, pad + y * s) for (x, y) in pts]


def make_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill=BRAND)          # fyller hela ytan (safe zone)
        inner_pad = size * 0.22
    else:
        r = int(size * 0.22)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BRAND)
        inner_pad = size * 0.18
    d.polygon(flame_points(size, inner_pad), fill=(255, 255, 255))
    return img


def make_icons():
    for s in (192, 512):
        make_icon(s, maskable=False).save(os.path.join(ICONS, f"icon-{s}.png"))
        make_icon(s, maskable=True).save(os.path.join(ICONS, f"icon-{s}-maskable.png"))
    make_icon(180, maskable=False).save(os.path.join(ICONS, "apple-touch-icon-180.png"))
    make_icon(32, maskable=False).save(os.path.join(ICONS, "favicon-32.png"))
    print("icons -> ", os.listdir(ICONS))


if __name__ == "__main__":
    make_drawing()
    make_photo_extinguisher()
    make_photo_door()
    make_icons()
    print("Klart.")
