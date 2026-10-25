# POSE → MESH → PICTURE WITHOUT BLENDER: draws the PLYs tools/qa/close-stills.ts (or pose-mesh.ts / ready-pose-probes.ts) wrote as ONE contact sheet with
# nothing but numpy and Pillow: a small z-buffer rasteriser, flat-shaded off the PLY's vertex colours. For a box with no bpy (pose-mesh-render.py is the
# better picture where Blender is).
#   python3 -I tools/qa/pose-mesh-raster.py <scene.json> [--tile 300] [--out file.png]       a close-stills scene: one column a moment, one row a view
#   python3 -I tools/qa/pose-mesh-raster.py a.ply b.ply … [--tile 300] --out sheet.png       loose PLYs, labelled by file name
# Rows: from his right side · the game camera's pitch (55 degrees down) from behind and to the right · the same from in front and to the left · from above.
# The frame is the PLY's own (x = left, y = up, z = forward); orthographic, 1.25 m either side of the middle of what is drawn. Slot 1 vertices (the second
# man of a close-stills PLY) are drawn lighter so two dark uniforms part.
import json, math, os, struct, sys
import numpy as np
from PIL import Image, ImageDraw

def read_ply(path):
    with open(path, 'rb') as fh: raw = fh.read()
    end = raw.index(b'end_header\n') + 11; head = raw[:end].decode('ascii', 'replace')
    nv = int(head.split('element vertex ')[1].split('\n')[0]); nf = int(head.split('element face ')[1].split('\n')[0])
    vt = np.frombuffer(raw, dtype=np.dtype([('p', '<f4', 3), ('c', 'u1', 4)]), count=nv, offset=end)
    ft = np.frombuffer(raw, dtype=np.dtype([('n', 'u1'), ('i', '<i4', 3)]), count=nf, offset=end + nv * 16)
    return vt['p'].astype(np.float64), vt['c'][:, :3].astype(np.float64) / 255.0, vt['c'][:, 3].copy(), ft['i'].astype(np.int64)

def view_basis(az, pitch):
    # the camera looks along d: az = the bearing it looks toward in the floor plane (0 = +z), pitch = degrees down from level
    a, p = math.radians(az), math.radians(pitch)
    d = np.array([math.sin(a) * math.cos(p), -math.sin(p), math.cos(a) * math.cos(p)])
    right = np.cross(d, [0.0, 1.0, 0.0]); right /= np.linalg.norm(right)   # (camera's right in a right-handed y-up frame is d x up)
    up = np.cross(right, d)
    return right, up, d
TOP = (np.array([0.0, 0.0, 1.0]), np.array([-1.0, 0.0, 0.0]), np.array([0.0, -1.0, 0.0]))   # from above: his forward to the right of the tile
VIEWS = [('from his right side', view_basis(90, 0)), ('game camera, from behind', view_basis(25, 55)), ('game camera, from in front', view_basis(205, 55)), ('from above', TOP)]

def draw(P, C, slot, F, basis, tile, centre, half=1.25):
    right, up, d = basis
    col = C * 1.0; col[slot == 1] = np.clip(col[slot == 1] * 1.6 + 0.16, 0, 1); col[slot == 0] = np.clip(col[slot == 0] * 1.5 + 0.05, 0, 1)
    Q = P - centre; sx = (Q @ right) / half * 0.5 * tile + 0.5 * tile; sy = 0.5 * tile - (Q @ up) / half * 0.5 * tile; sz = Q @ d
    img = np.full((tile, tile, 3), 0.86); zb = np.full((tile, tile), 1e9)
    # the floor (y = 0) as a darker band where the view sees it edge on, a tint elsewhere
    if abs(up[1]) > 0.99: y0 = int(0.5 * tile + centre[1] / half * 0.5 * tile); img[max(0, y0):, :] = 0.74
    else: img[:, :] = 0.80
    a, b, c = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]; n = np.cross(b - a, c - a); ln = np.linalg.norm(n, axis=1); ln[ln == 0] = 1; n /= ln[:, None]
    light = np.array([0.35, 0.85, -0.4]); light /= np.linalg.norm(light)
    facing = -(n @ d); shade = 0.42 + 0.58 * np.clip(n @ light, 0, 1) + 0.12 * np.clip(facing, 0, 1)
    fc = (col[F[:, 0]] + col[F[:, 1]] + col[F[:, 2]]) / 3.0 * shade[:, None]
    X = np.stack([sx[F[:, 0]], sx[F[:, 1]], sx[F[:, 2]]], 1); Y = np.stack([sy[F[:, 0]], sy[F[:, 1]], sy[F[:, 2]]], 1); Z = np.stack([sz[F[:, 0]], sz[F[:, 1]], sz[F[:, 2]]], 1)
    x0 = np.clip(np.floor(X.min(1)).astype(int), 0, tile - 1); x1 = np.clip(np.ceil(X.max(1)).astype(int), 0, tile - 1)
    y0 = np.clip(np.floor(Y.min(1)).astype(int), 0, tile - 1); y1 = np.clip(np.ceil(Y.max(1)).astype(int), 0, tile - 1)
    den = (Y[:, 1] - Y[:, 2]) * (X[:, 0] - X[:, 2]) + (X[:, 2] - X[:, 1]) * (Y[:, 0] - Y[:, 2])
    for t in np.nonzero((np.abs(den) > 1e-9) & (X.max(1) >= 0) & (X.min(1) < tile) & (Y.max(1) >= 0) & (Y.min(1) < tile))[0]:
        xs = np.arange(x0[t], x1[t] + 1) + 0.5; ys = np.arange(y0[t], y1[t] + 1) + 0.5
        if xs.size == 0 or ys.size == 0: continue
        gx, gy = np.meshgrid(xs, ys)
        w0 = ((Y[t, 1] - Y[t, 2]) * (gx - X[t, 2]) + (X[t, 2] - X[t, 1]) * (gy - Y[t, 2])) / den[t]
        w1 = ((Y[t, 2] - Y[t, 0]) * (gx - X[t, 2]) + (X[t, 0] - X[t, 2]) * (gy - Y[t, 2])) / den[t]
        w2 = 1 - w0 - w1; inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any(): continue
        z = w0 * Z[t, 0] + w1 * Z[t, 1] + w2 * Z[t, 2]
        sub = zb[y0[t]:y1[t] + 1, x0[t]:x1[t] + 1]; hit = inside & (z < sub)
        if hit.any(): sub[hit] = z[hit]; img[y0[t]:y1[t] + 1, x0[t]:x1[t] + 1][hit] = fc[t]
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))

def main():
    args = sys.argv[1:]; tile = 300; out = None; files = []
    i = 0
    while i < len(args):
        if args[i] == '--tile': tile = int(args[i + 1]); i += 2
        elif args[i] == '--out': out = args[i + 1]; i += 2
        else: files.append(args[i]); i += 1
    if not files: print(__doc__ or 'usage: pose-mesh-raster.py <scene.json | a.ply …> [--tile N] [--out file.png]'); sys.exit(2)
    if files[0].endswith('.json'):
        meta = json.load(open(files[0])); base = os.path.dirname(os.path.abspath(files[0]))
        shots = [(s['label'], os.path.join(base, s['file'])) for s in meta['shots']]; title = meta.get('title', '') + (' · ' + meta['tag'] if meta.get('tag') else '')
        out = out or files[0][:-5] + '.png'
    else:
        shots = [(os.path.basename(f)[:-4], f) for f in files]; title = ''; out = out or 'pose-mesh-raster.png'
    pad, lab, top = 6, 30, 26 if title else 4
    sheet = Image.new('RGB', (pad + len(shots) * (tile + pad), top + len(VIEWS) * (tile + pad) + lab), (245, 243, 238)); dr = ImageDraw.Draw(sheet)
    if title: dr.text((pad, 6), title + '   (rows: ' + ' · '.join(v[0] for v in VIEWS) + ')', fill=(30, 30, 30))
    for k, (label, path) in enumerate(shots):
        P, C, slot, F = read_ply(path); lo, hi = P.min(0), P.max(0); centre = np.array([(lo[0] + hi[0]) / 2, 0.95, (lo[2] + hi[2]) / 2])
        for r, (_, basis) in enumerate(VIEWS): sheet.paste(draw(P, C, slot, F, basis, tile, centre), (pad + k * (tile + pad), top + r * (tile + pad)))
        dr.text((pad + k * (tile + pad) + 2, top + len(VIEWS) * (tile + pad) + 4), label[:int(tile / 6.2)], fill=(30, 30, 30))
    sheet.save(out); print(out)
if __name__ == '__main__': main()
