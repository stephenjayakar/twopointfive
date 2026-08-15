#!/usr/bin/env python3
"""SHARP-DIRECT lane — offline grading of the pane's captures (tools/qa/sharp-harness.js → docs/shots/ab/sh_<tag>_<view>_<static|motion>.png).

  python3 tools/qa/sharp-metrics.py [tags…]          grade every tag found (or the listed ones), print the table, write docs/perf/sharp-metrics.json
  python3 tools/qa/sharp-metrics.py --crops a c f    also write the ×3 edge / tile crops for those tags → docs/shots/sh/<tag>_<view>_<mode>_<name>.jpg

Metrics (all in OUTPUT pixels of the 1777×1000 frame; the specs below are scaled if a capture has another size):
  EDGE-SPREAD  the 10–90 % rise distance of the luma profile ACROSS an edge, sub-pixel by linear interpolation, median over N profiles spread along the edge
               (N ≈ edge length / 3, ≥ 8). Plateaus = the profile's two ends; a profile whose ends differ by < 6 levels is dropped (no edge there).
  CONTRAST     RMS of a high-pass (luma − Gaussian σ 1.5 px) inside a tile — 'how much pixel-scale detail is there'.
The edge / tile definitions were placed by hand on variant (c)'s captures (v3 all-on at high ×0.77, 08-10); every variant renders the same geometry from
the same pinned camera, so they apply to all of them (the motion capture ends on the static yaw for that reason).
"""
import sys, os, json, glob, math
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AB = os.path.join(ROOT, 'docs/shots/ab'); OUT_JSON = os.path.join(ROOT, 'docs/perf/sharp-metrics.json'); CROPS = os.path.join(ROOT, 'docs/shots/sh')
REF_W, REF_H = 1777, 1000

# kind: contact = hard contact shadow · pool = a light's own cone / pool boundary · box = a lit geometry / albedo edge · penumbra = a physically soft shadow edge (reported, not a sharpness target)
# (name, kind, a, b, (t_lo, t_hi))  — a→b runs ALONG the edge; the profile runs along its normal from t_lo to t_hi px
VIEWS = {
    'v1': {'title': "manager's desk under the desk lamp",
           'edges': [('kbShadow', 'contact', (730, 615), (830, 585), (-5, 10)),      # the keyboard's contact shadow: shadow floor → lit desk (its outer edge)
                     ('footShadow', 'penumbra', (680, 447), (760, 422), (-16, 10)),  # the monitor foot's shadow edge on the desk (a taller occluder: physically soft)
                     ('kbTop', 'box', (820, 478), (940, 440), (-6, 6)),              # the keyboard's far edge: lit desk | lit key plate
                     ('paper', 'box', (596, 598), (620, 638), (-7, 7))],             # a sheet's edge on the desk
           'tiles': [('penumbra', 620, 380, 140, 80), ('litDesk', 560, 440, 300, 200)]},
    'v2': {'title': 'torch cone on the corridor wall + lino',
           'edges': [('coneWall', 'pool', (584, 240), (560, 360), (-28, 24)),        # the disc's left edge on the wall (inner 7° → outer 19°: analytic)
                     ('junction', 'box', (696, 380), (650, 460), (-6, 6)),           # wall / floor junction INSIDE the lobe (a normal change under one light)
                     ('boardEdge', 'box', (639, 58), (641, 98), (-6, 6))],           # the notice board's edge on the wall, lit by bounce + haze only
           'tiles': [('cone', 540, 220, 100, 120), ('lobe', 600, 360, 260, 130)]},
    'v3': {'title': 'cubicle desks under the ceiling panels',
           'edges': [('kbFar', 'box', (700, 462), (760, 444), (-5, 5)),              # a keyboard's far edge on desk A
                     ('deskEdge', 'box', (875, 381), (910, 431), (-5, 4)),           # desk A's right edge against the dark floor
                     ('partTop', 'box', (900, 168), (1000, 199), (-5, 5))],          # the lit partition top strip's lower edge
           'tiles': [('penumbra', 1330, 470, 150, 130), ('desk', 560, 360, 340, 200)]},
}
KIND_ORDER = ['contact', 'pool', 'box', 'penumbra']

def load(path):
    """the capture as RGB at the reference OUTPUT size: a smaller output frame (TAAU off at a render scale below 1: the canvas IS the internal size then) is upsampled BILINEARLY to
    1777×1000 first — what the browser does presenting that canvas in the same CSS box — so every variant is graded as presented"""
    im = Image.open(path).convert('RGB')
    if im.size != (REF_W, REF_H): im = im.resize((REF_W, REF_H), Image.BILINEAR)
    return im
def luma(path):
    a = np.asarray(load(path)).astype(np.float32)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

def edge_spread(L, a, b, trange, sx, sy):
    ax, ay = a[0] * sx, a[1] * sy; bx, by = b[0] * sx, b[1] * sy
    dx, dy = bx - ax, by - ay; ln = math.hypot(dx, dy)
    if ln < 1e-6: return None
    ux, uy = dx / ln, dy / ln; nx, ny = -uy, ux          # normal (either sign: polarity is detected per profile)
    N = max(8, int(ln / 3))
    step = 0.25; ts = np.arange(trange[0] * sx, trange[1] * sx + 1e-6, step)
    widths, t50s, contrasts = [], [], []
    for k in range(N):
        f = (k + 0.5) / N; cx, cy = ax + dx * f, ay + dy * f
        xs = cx + nx * ts; ys = cy + ny * ts
        p = map_coordinates(L, [ys, xs], order=1, mode='nearest')
        m = max(2, int(1.5 / step))
        lo, hi = p[:m].mean(), p[-m:].mean()
        if abs(hi - lo) < 6: continue
        if hi < lo: p = -p; lo, hi = -lo, -hi
        q = (p - lo) / (hi - lo)
        i50 = next((i for i in range(len(q)) if q[i] >= 0.5), None)
        if i50 is None or i50 == 0: continue
        # t10: the last upward crossing of 0.1 at or before i50; t90: the first crossing of 0.9 at or after i50 (both interpolated)
        i10 = None
        for i in range(i50, 0, -1):
            if q[i - 1] < 0.1 <= q[i]: i10 = i; break
        i90 = None
        for i in range(i50, len(q)):
            if q[i - 1] < 0.9 <= q[i]: i90 = i; break
        if i10 is None or i90 is None: continue
        def cross(i, lv): return ts[i - 1] + (ts[i] - ts[i - 1]) * (lv - q[i - 1]) / max(q[i] - q[i - 1], 1e-6)
        t10, t90 = cross(i10, 0.1), cross(i90, 0.9); t50 = cross(i50, 0.5)
        widths.append((t90 - t10) / sx); t50s.append(t50 / sx); contrasts.append(hi - lo)
    if not widths: return {'n': 0}
    w = np.array(widths)
    return {'n': len(widths), 'of': N, 'med': round(float(np.median(w)), 2), 'mean': round(float(w.mean()), 2), 'p25': round(float(np.percentile(w, 25)), 2), 'p75': round(float(np.percentile(w, 75)), 2),
            't50': round(float(np.mean(t50s)), 2), 'contrast': round(float(np.mean(contrasts)), 1)}

def contrast(L, x, y, w, h, sx, sy):
    x, y, w, h = int(round(x * sx)), int(round(y * sy)), int(round(w * sx)), int(round(h * sy))
    t = L[y:y + h, x:x + w]
    hp = t - gaussian_filter(t, 1.5)
    return {'rms': round(float(np.sqrt((hp ** 2).mean())), 3), 'mean': round(float(t.mean()), 1)}

def grade(path):
    raw = Image.open(path).size
    L = luma(path); H, W = L.shape; sx, sy = W / REF_W, H / REF_H
    name = os.path.basename(path)[:-4]; _, tag, view, mode = name.split('_', 3) if name.count('_') >= 3 else (None, None, None, None)
    spec = VIEWS.get(view)
    if not spec: return None
    out = {'tag': tag, 'view': view, 'mode': mode, 'res': list(raw), 'edges': {}, 'tiles': {}}
    for (en, kind, a, b, tr) in spec['edges']: r = edge_spread(L, a, b, tr, sx, sy); r['kind'] = kind; out['edges'][en] = r
    for (tn, x, y, w, h) in spec['tiles']: out['tiles'][tn] = contrast(L, x, y, w, h, sx, sy)
    return out

def crops(path, k=3, half=50):
    im = load(path); W, H = im.size; sx, sy = W / REF_W, H / REF_H
    name = os.path.basename(path)[:-4]; _, tag, view, mode = name.split('_', 3)
    spec = VIEWS.get(view); os.makedirs(CROPS, exist_ok=True); made = []
    def save(nm, cx, cy, hw, hh):
        x0, y0 = int(round(cx * sx - hw * sx)), int(round(cy * sy - hh * sy)); x1, y1 = x0 + int(round(2 * hw * sx)), y0 + int(round(2 * hh * sy))
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
        c = im.crop((x0, y0, x1, y1)).resize(((x1 - x0) * k, (y1 - y0) * k), Image.NEAREST)
        fn = os.path.join(CROPS, f'{tag}_{view}_{mode}_{nm}.jpg'); c.save(fn, quality=85); made.append(os.path.relpath(fn, ROOT))
    for (en, kind, a, b, tr) in spec['edges']: save(en, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, half, half)
    for (tn, x, y, w, h) in spec['tiles']: save(tn, x + w / 2, y + h / 2, w / 2, h / 2)
    return made

def main(argv):
    want_crops = '--crops' in argv; tags = [a for a in argv if not a.startswith('--')]
    files = sorted(glob.glob(os.path.join(AB, 'sh_*_v[123]_*.png')))
    rows = []
    for f in files:
        r = grade(f)
        if r and (not tags or r['tag'] in tags): rows.append(r)
        if r and want_crops and (not tags or r['tag'] in tags): crops(f)
    try:
        old = json.load(open(OUT_JSON))
    except Exception:
        old = {}
    for r in rows: old[f"{r['tag']}_{r['view']}_{r['mode']}"] = r
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True); json.dump(old, open(OUT_JSON, 'w'), indent=1)
    # table: per view × mode, rows = tags, cols = edges (median 10–90 px) + tiles (hp rms)
    alltags = sorted({r['tag'] for r in old.values()}, key=lambda t: (len(t), t))
    for view in VIEWS:
        for mode in ['static', 'motion']:
            spec = VIEWS[view]; en = [e[0] for e in spec['edges']]; tn = [t[0] for t in spec['tiles']]
            print(f"\n{view} {mode} — {spec['title']}   (edge-spread = median 10–90 % width in output px [n profiles]; tiles = high-pass RMS)")
            print('tag'.ljust(8) + ''.join(f"{e}({k[0]})".rjust(17) for e, k in [(e[0], e[1]) for e in spec['edges']]) + ''.join(t.rjust(14) for t in tn))
            for tag in alltags:
                r = old.get(f'{tag}_{view}_{mode}')
                if not r: continue
                line = tag.ljust(8)
                for e in en:
                    x = r['edges'].get(e, {})
                    line += (f"{x['med']:.2f} [{x['n']}]" if x.get('n') else '—').rjust(17)
                for t in tn:
                    x = r['tiles'].get(t, {}); line += (f"{x['rms']:.2f}" if x else '—').rjust(14)
                print(line)
    return 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
