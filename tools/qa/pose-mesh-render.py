# POSE → MESH → PICTURE: draws what tools/qa/pose-mesh.ts wrote (a posed man of the cast as a PLY + its JSON) as ONE labelled contact sheet.
#
#   ~/bvenv/bin/python -I tools/qa/pose-mesh-render.py <file.ply> [more.ply …] [--tile 480] [--out <dir>]
#       → <file>.png beside each PLY (or in --out): front · three-quarter · the game camera · from behind, then each hand twice
#         (onto the back of the hand, and along the knuckles from the thumb side — the view a curl is read in)
#
# Blender as a Python module (bpy), the Workbench engine: flat slot colours off the PLY's vertex colours under the studio light with a cavity pass (so fingers of one
# colour still read as fingers), BACK-FACE CULLING ON (a mesh that is inside out or open shows it), a neutral grey backdrop and a floor. No Cycles, no textures: a
# sheet takes about a second. The hand close-ups cut away everything nearer the camera than the hand (the near clip), so a hand against a vest or behind the back is
# still seen; what they cut is cut, not hidden — an open rim there is the trunk sliced, not a hole in the mesh.
# The game camera tile is the middle of a 2 x tile-row frame at the game's own numbers (pitch 55° down, 7.5 m, fov 28°): the man at the size a player sees him.
import json, math, os, sys
import numpy as np
import bpy
from mathutils import Vector
from PIL import Image, ImageDraw

argv = sys.argv[1:]
def opt(name, default=None):
    if name in argv:
        i = argv.index(name); v = argv[i + 1]; del argv[i:i + 2]; return v
    return default
TILE = int(opt('--tile', '480')); OUT = opt('--out')
files = [a for a in argv if a.endswith('.ply')]
if not files:
    print(__doc__ or 'usage: python -I tools/qa/pose-mesh-render.py <file.ply> [more.ply …] [--tile 480] [--out <dir>]'); sys.exit(2)

def read_ply(path):
    raw = open(path, 'rb').read(); end = raw.index(b'end_header\n') + 11; head = raw[:end].decode().split('\n')
    nv = int(next(l for l in head if l.startswith('element vertex')).split()[2]); nf = int(next(l for l in head if l.startswith('element face')).split()[2])
    vt = np.dtype([('p', '<f4', 3), ('c', 'u1', 3), ('slot', 'u1')]); ft = np.dtype([('n', 'u1'), ('i', '<i4', 3)])
    v = np.frombuffer(raw, vt, nv, end); f = np.frombuffer(raw, ft, nf, end + nv * vt.itemsize)
    return v['p'].copy(), v['c'].copy(), v['slot'].copy(), f['i'].copy()

# game space (y up, +z the man's front, +x his left) → Blender (z up): (x, y, z) → (x, −z, y)
def g2b(p): return Vector((p[0], -p[2], p[1]))

scene = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
scene.render.engine = 'BLENDER_WORKBENCH'
sh = scene.display.shading
sh.light = 'STUDIO'; sh.color_type = 'VERTEX'; sh.show_backface_culling = True; sh.show_cavity = True; sh.cavity_type = 'BOTH'
sh.curvature_ridge_factor = 1.0; sh.curvature_valley_factor = 1.4; sh.cavity_ridge_factor = 0.6; sh.cavity_valley_factor = 1.6
sh.show_shadows = False; sh.show_object_outline = False; sh.show_specular_highlight = False
scene.display.render_aa = '8'
scene.world = scene.world or bpy.data.worlds.new('w'); scene.world.color = (0.19, 0.2, 0.215)
scene.view_settings.view_transform = 'Standard'; scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
cam_data.sensor_fit = 'VERTICAL'

def col_attr(me, rgb):
    a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); lin = (rgb.astype(np.float32) / 255.0)
    lin = np.where(lin <= 0.04045, lin / 12.92, ((lin + 0.055) / 1.055) ** 2.4)   # the PLY carries sRGB bytes; the attribute is linear
    buf = np.ones((len(rgb), 4), np.float32); buf[:, :3] = lin; a.data.foreach_set('color', buf.ravel()); me.color_attributes.active_color = a

def shot(path, loc, target, fov_deg, w, h, clip=(0.05, 60.0), up=None):
    cam.location = loc; d = (Vector(target) - Vector(loc)).normalized()
    if up is None: q = d.to_track_quat('-Z', 'Y')
    else:   # the picture's up as near `up` as the view allows (a hand close-up: fingers down the picture)
        u = Vector(up) - d * Vector(up).dot(d); u = u.normalized() if u.length > 1e-4 else Vector((0, 0, 1)); r = d.cross(u).normalized()
        from mathutils import Matrix
        q = Matrix((r, u, -d)).transposed().to_quaternion()
    cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = q
    cam_data.angle_y = math.radians(fov_deg); cam_data.clip_start, cam_data.clip_end = clip
    scene.render.resolution_x = w; scene.render.resolution_y = h; scene.render.resolution_percentage = 100; scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return Image.open(path).convert('RGB')

def sheet(ply):
    meta = json.load(open(ply[:-4] + '.json')); P, C, S, F = read_ply(ply)
    for o in [o for o in bpy.data.objects if o.type == 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
    me = bpy.data.meshes.new('man'); V = np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)
    me.from_pydata(V.tolist(), [], F.tolist()); me.update(); col_attr(me, C)
    ob = bpy.data.objects.new('man', me); scene.collection.objects.link(ob)
    fm = bpy.data.meshes.new('floor'); fm.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)]); fm.update()
    col_attr(fm, np.full((4, 3), 118, np.uint8)); fo = bpy.data.objects.new('floor', fm); scene.collection.objects.link(fo)
    tmp = (OUT or os.path.dirname(os.path.abspath(ply))) + '/.pose-mesh-tmp.png'
    J = meta['joints']; hips = g2b(J['hips']); body = V[S < 15] if (S < 15).any() else V; lo, hi = body.min(0), body.max(0)   # framed on the worn mesh's own box: a man folded forward keeps his head in the picture
    mid = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, hi[2] / 2 + 0.02))
    span = max(1.25, hi[2] + 0.25, max(hi[0] - lo[0], hi[1] - lo[1]) + 0.3); dist = span / (2 * math.tan(math.radians(14))) * 1.04
    tiles = []
    def body(label, yaw_deg, elev_deg):
        a, e = math.radians(yaw_deg), math.radians(elev_deg)   # yaw 0 = straight in front of him (Blender −Y), + toward his left
        loc = mid + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
        tiles.append((label, shot(tmp, loc, mid, 28, TILE, TILE)))
    body('front', 0, 4); body('three-quarter (his left)', 38, 14)
    # the game camera: 55° down, 7.5 m from a look-at point at his chest height, fov 28° — the middle TILE x TILE of a frame 2 x TILE rows high; from his front-right
    a, e = math.radians(-30), math.radians(55); tgt = Vector((hips.x, hips.y, 1.0))
    g = shot(tmp, tgt + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 7.5, tgt, 28, TILE * 2, TILE * 2)
    tiles.append((f'game camera: 55° down, 7.5 m, fov 28° (1:1 crop of a {TILE * 2}-row frame)', g.crop((TILE // 2, TILE // 2, TILE // 2 + TILE, TILE // 2 + TILE))))
    body('from behind', 180, 8)
    for side in ('L', 'R'):
        Hn = meta['hands'][side]; w, i1, m1, p1 = (g2b(Hn[k]) for k in ('wrist', 'index1', 'middle1', 'pinky1')); tips = [g2b(t) for t in Hn['tips'] if t]
        c = (w + m1 * 2 + sum(tips, Vector()) / max(1, len(tips))) / 4; fingers = (m1 - w).normalized()
        n = (i1 - w).cross(p1 - w).normalized() * (1 if side == 'L' else -1)   # out of the BACK of the hand
        radial = (i1 - p1).normalized()                                          # across the knuckles toward the thumb
        D, near = 0.5, 0.33
        tiles.append((f'{side} hand: onto the back of it', shot(tmp, c + n * D, c, 30, TILE, TILE, (near, 10), up=-fingers)))
        tiles.append((f'{side} hand: along the knuckles, from the thumb side', shot(tmp, c + (radial * 0.94 + n * 0.34).normalized() * D, c, 30, TILE, TILE, (near, 10), up=-fingers)))
    # the hand tiles are lifted (gamma 0.6): a black glove against a black gun is two shades apart as drawn, and it is the shape that is being judged
    lift = [round(255 * (v / 255) ** 0.6) for v in range(256)] * 3
    tiles = [(l + ' (lifted)', t.point(lift)) if ' hand: ' in l else (l, t) for l, t in tiles]
    try: os.remove(tmp)
    except OSError: pass
    cols, pad, lab, top = 4, 6, 20, 46; rows = (len(tiles) + cols - 1) // cols
    W = cols * TILE + (cols + 1) * pad; Hh = top + rows * (TILE + lab + pad) + pad
    im = Image.new('RGB', (W, Hh), (24, 25, 28)); dr = ImageDraw.Draw(im)
    title = f"{meta['variant']} ({meta['side']}, id {meta['id']})  ·  {meta['situation']}: {meta['says']}"
    sub = f"moves {'ON' if meta['moves'] else 'OFF'}  ·  tree @ {meta.get('commit') or '?'}{('  ·  ' + meta['tag']) if meta.get('tag') else ''}  ·  held: {meta.get('held') or 'nothing'}  ·  {meta['bodyTris']} tris worn + {meta['propBoxes']} prop boxes  ·  back faces culled"
    dr.text((pad + 2, 6), title, fill=(236, 236, 230)); dr.text((pad + 2, 24), sub, fill=(160, 164, 170))
    for k, (label, t) in enumerate(tiles):
        x = pad + (k % cols) * (TILE + pad); y = top + (k // cols) * (TILE + lab + pad)
        dr.text((x + 2, y + 3), label, fill=(206, 208, 200)); im.paste(t, (x, y + lab))
    out = (OUT + '/' + os.path.basename(ply)[:-4] if OUT else ply[:-4]) + '.png'
    im.save(out); print('pose-mesh-render:', out)

if OUT: os.makedirs(OUT, exist_ok=True)
for f in files: sheet(f)
