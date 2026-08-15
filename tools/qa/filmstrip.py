#!/usr/bin/env python3
"""Tile captured frames into one filmstrip JPEG (the impulses' kick-bang strips, docs/internal/destruction.md; any lane's before/after rows).

  python3 tools/qa/filmstrip.py OUT.jpg [--cols N] [--crop X,Y,W,H] [--width PX] [--labels a,b,…] [--title T] IN1.jpg IN2.jpg …

--crop takes the same source rectangle out of every frame (px of the inputs), --width scales each tile to that width (default: the crop / source width,
capped so the strip stays under ~4000 px across), --labels puts one caption per tile in its corner, --title a line over the strip. PIL only.
"""
import sys, argparse
from PIL import Image, ImageDraw, ImageFont

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('inputs', nargs='+')
    ap.add_argument('--cols', type=int, default=0); ap.add_argument('--crop', default=''); ap.add_argument('--width', type=int, default=0)
    ap.add_argument('--labels', default=''); ap.add_argument('--title', default=''); ap.add_argument('--quality', type=int, default=88); ap.add_argument('--gap', type=int, default=6)
    a = ap.parse_args()
    frames = [Image.open(p).convert('RGB') for p in a.inputs]
    if a.crop:
        x, y, w, h = (int(v) for v in a.crop.split(','))
        frames = [f.crop((x, y, x + w, y + h)) for f in frames]
    n = len(frames); cols = a.cols or n; rows = (n + cols - 1) // cols
    tw = a.width or min(frames[0].width, max(240, 3900 // cols))
    th = round(frames[0].height * tw / frames[0].width)
    frames = [f.resize((tw, th), Image.LANCZOS) if f.width != tw else f for f in frames]
    labels = [s.strip() for s in a.labels.split(',')] if a.labels else []
    try: font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', max(13, tw // 28)); tfont = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', max(15, tw // 22))
    except Exception: font = ImageFont.load_default(); tfont = font
    gap = a.gap; top = (tfont.size + 14) if a.title else 0
    W = cols * tw + (cols + 1) * gap; H = top + rows * th + (rows + 1) * gap
    strip = Image.new('RGB', (W, H), (16, 18, 20)); d = ImageDraw.Draw(strip)
    if a.title: d.text((gap + 4, 6), a.title, fill=(220, 225, 215), font=tfont)
    for i, f in enumerate(frames):
        r, c = divmod(i, cols); x0 = gap + c * (tw + gap); y0 = top + gap + r * (th + gap)
        strip.paste(f, (x0, y0))
        if i < len(labels) and labels[i]:
            tx, ty = x0 + 8, y0 + 6; bb = d.textbbox((tx, ty), labels[i], font=font)
            d.rectangle((bb[0] - 5, bb[1] - 3, bb[2] + 5, bb[3] + 3), fill=(0, 0, 0))
            d.text((tx, ty), labels[i], fill=(235, 235, 225), font=font)
    strip.save(a.out, quality=a.quality)
    print(f'{a.out}: {n} tiles {cols}×{rows} of {tw}×{th} → {W}×{H}')

if __name__ == '__main__': main()
