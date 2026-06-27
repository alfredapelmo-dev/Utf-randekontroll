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


# ---------------------------------------------------------------- planritningar
# Konfigurationsdriven planritare. Varje layout beskrivs av inner-väggar,
# dörröppningar, rumsetiketter och en titel. Yttervägg + norrpil + skalstock +
# titelruta ritas alltid. Samtliga är fiktiva demoplaner.
W, H = 1600, 1120
MARGIN = 90
TWALL = 14
OX0, OY0, OX1, OY1 = MARGIN, MARGIN, W - MARGIN, H - MARGIN


def draw_plan(cfg):
    img = Image.new("RGB", (W, H), (252, 252, 250))
    d = ImageDraw.Draw(img)

    for x in range(0, W, 40):
        d.line([(x, 0), (x, H)], fill=GRID, width=1)
    for y in range(0, H, 40):
        d.line([(0, y), (W, y)], fill=GRID, width=1)

    def wall(x0, y0, x1, y1):
        d.rectangle([x0 - TWALL / 2, y0 - TWALL / 2, x1 + TWALL / 2, y1 + TWALL / 2], fill=WALL)

    def door(x0, y0, x1, y1):
        d.rectangle([x0 - TWALL / 2 - 1, y0 - TWALL / 2 - 1, x1 + TWALL / 2 + 1, y1 + TWALL / 2 + 1],
                    fill=(252, 252, 250))
        d.line([x0, y0, x1, y1], fill=(150, 150, 150), width=2)

    # yttervägg
    wall(OX0, OY0, OX1, OY0)
    wall(OX0, OY1, OX1, OY1)
    wall(OX0, OY0, OX0, OY1)
    wall(OX1, OY0, OX1, OY1)

    for (x0, y0, x1, y1) in cfg.get("walls", []):
        wall(x0, y0, x1, y1)
    for (x0, y0, x1, y1) in cfg.get("doors", []):
        door(x0, y0, x1, y1)

    fr = font(40, bold=True)
    fsub = font(26)
    for (txt, cx, cy) in cfg.get("labels", []):
        tb = d.textbbox((0, 0), txt, font=fr)
        d.text((cx - (tb[2] - tb[0]) / 2, cy - (tb[3] - tb[1]) / 2), txt, font=fr, fill=(120, 124, 130))

    for (txt, x, y) in cfg.get("texts", []):
        d.text((x, y), txt, font=fsub, fill=(120, 124, 130))

    # norrpil
    nx, ny = OX1 - 70, OY0 + 80
    d.polygon([(nx, ny - 46), (nx - 18, ny + 18), (nx, ny + 4), (nx + 18, ny + 18)], fill=INK)
    d.text((nx - 8, ny + 22), "N", font=font(26, bold=True), fill=INK)

    # skalstock
    sx, sy = OX0 + 30, OY1 - 36
    d.rectangle([sx, sy, sx + 200, sy + 12], outline=INK, width=2)
    d.rectangle([sx, sy, sx + 100, sy + 12], fill=INK)
    d.text((sx, sy - 30), "0          5 m", font=fsub, fill=INK)

    # titelruta uppe till vänster
    d.rectangle([OX0, OY0, OX0 + 380, OY0 + 64], fill=(255, 255, 255), outline=WALL, width=2)
    d.text((OX0 + 14, OY0 + 10), cfg["title"], font=font(24, bold=True), fill=INK)
    d.text((OX0 + 14, OY0 + 38), cfg.get("subtitle", "Demo · Utförandekontroll"), font=fsub, fill=(110, 114, 120))

    img.save(os.path.join(ASSETS, cfg["file"]), "PNG")
    print(cfg["file"], img.size)


PLANS = [
    {
        "file": "drawing-plan-a.png", "title": "PLAN 1 – ENTRÉPLAN",
        "walls": [(600, OY0, 600, OY1), (600, 560, OX1, 560), (1060, 560, 1060, OY1)],
        "doors": [(600, 470, 600, 560), (800, 560, 900, 560), (1060, 740, 1060, 830), (330, OY1, 470, OY1)],
        "labels": [("LAGER", 345, 560), ("KONFERENS", 1055, 325), ("KONTOR", 830, 795), ("TEKNIK", 1285, 795)],
        "texts": [("ENTRÉ", 360, OY1 - 46)],
    },
    {
        "file": "drawing-plan-b.png", "title": "PLAN 2 – KONTOR",
        "walls": [(620, OY0, 620, OY1), (1080, OY0, 1080, OY1), (OX0, 560, 620, 560), (1080, 520, OX1, 520)],
        "doors": [(620, 300, 620, 390), (1080, 700, 1080, 790), (300, 560, 400, 560), (820, OY1, 960, OY1)],
        "labels": [("KONTOR A", 355, 325), ("PENTRY", 355, 795), ("OPEN OFFICE", 850, 560),
                   ("KONFERENS", 1295, 305), ("ARKIV", 1295, 775)],
        "texts": [("ENTRÉ", 850, OY1 - 46)],
    },
    {
        "file": "drawing-plan-c.png", "title": "KÄLLARPLAN",
        "walls": [(800, OY0, 800, OY1), (OX0, 560, 800, 560), (800, 620, OX1, 620)],
        "doors": [(800, 300, 800, 390), (400, 560, 500, 560), (1100, 620, 1200, 620), (720, OY1, 860, OY1)],
        "labels": [("FÖRRÅD", 445, 325), ("UNDERCENTRAL", 445, 795), ("TEKNIK", 1155, 355), ("ARKIV", 1155, 825)],
        "texts": [("TRAPPA", 745, OY1 - 46)],
    },
    {
        "file": "drawing-plan-d.png", "title": "LAGER / LASTKAJ",
        "walls": [(1150, OY0, 1150, OY1), (1150, 500, OX1, 500), (450, 760, 450, OY1), (OX0, 760, 450, 760)],
        "doors": [(1150, 700, 1150, 790), (450, 860, 450, 950), (560, OY1, 760, OY1)],
        "labels": [("LAGERHALL", 620, 430), ("KONTOR", 270, 895), ("LASTKAJ", 1330, 295), ("TRUCKZON", 1330, 765)],
        "texts": [("PORT", 600, OY1 - 46)],
    },
]


def make_drawings():
    for cfg in PLANS:
        draw_plan(cfg)
    # Bakåtkompatibilitet: behåll drawing-sample.png (= plan A).
    draw_plan({**PLANS[0], "file": "drawing-sample.png"})


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
    make_drawings()
    make_photo_extinguisher()
    make_photo_door()
    make_icons()
    print("Klart.")
