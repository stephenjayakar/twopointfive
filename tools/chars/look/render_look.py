"""Look sheets of the cast in headless Blender (bpy as a module), shaded with THE GAME'S resolved colours.

    REPO=<tree> LOOK=<dir with look.json + look.bin from dump_look.ts> <bvenv>/bin/python -I render_look.py <outdir> [shots…] [--spp N] [--only v1,v2]

shots: lineup (lineup-front.png, lineup-back.png) · topdown (topdown-near.png, topdown-far.png, topdown-far-crop3x*.png) ·
       close (close-<variant>.png) · head (head-<kind>.png) · swatches (swatches.png: every man's eleven slot rows as flat chips)

A copy of <REPO>/tools/chars/render_cast.py (its glTF reader, its skinning to the mannequin's armature, its studio and cameras), with the stand-in LOOK / TINT
colours taken out: every vertex carries the dry-pixel albedo fsSkin would store for that man (dump_look.ts), the slot's lobe roughness and its gain.
  Base Color          <- colour attribute 'Col' (LINEAR, a FLOAT_COLOR point attribute: no sRGB decode anywhere)
  Roughness           <- attribute 'rough' (the game's GGX lobe roughness, 0.03‥0.65)
  Specular IOR Level  <- attribute 'spec' = 0.25 × gain (the game's coat lobe is F0 0.02 × gain; Principled's 0.5 = F0 0.04), metallic 0 (the game's lobe is a dielectric's)
View transform Standard, exposure 0, look None, for every sheet.
"""
import base64
import json
import math
import os
import subprocess
import sys

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

REPO = os.path.abspath(os.environ.get('REPO') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
LOOKDIR = os.path.abspath(os.environ.get('LOOK') or '.')
CAST = os.environ.get('CAST_GLTF') or os.path.join(REPO, 'public/assets/chars/cast.gltf')
MANN = os.path.join(REPO, 'public/assets/ual/AnimationLibrary_Godot_Standard.gltf')
EXPOSURE = float(os.environ.get('LOOK_EXPOSURE', '0'))      # one exposure for every sheet
BG = '#5c5e63'

_CT = {5121: 'u1', 5123: 'u2', 5125: 'u4', 5126: 'f4'}
_NC = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_cast(path=CAST):
    g = json.load(open(path))
    buf = base64.b64decode(g['buffers'][0]['uri'].split(',', 1)[1])

    def acc(i):
        a = g['accessors'][i]
        bv = g['bufferViews'][a['bufferView']]
        n = _NC[a['type']]
        arr = np.frombuffer(buf, np.dtype(_CT[a['componentType']]), a['count'] * n, bv.get('byteOffset', 0) + a.get('byteOffset', 0))
        return arr.reshape(a['count'], n) if n > 1 else arr
    jn = [g['nodes'][j]['name'] for j in g['skins'][0]['joints']]
    parts = {}
    for n in g['nodes']:
        if 'mesh' not in n or 'skin' not in n:      # (the game's loader: skinned mesh nodes, in node order)
            continue
        prims = []
        for p in g['meshes'][n['mesh']]['primitives']:
            at = p['attributes']
            prims.append({'P': acc(at['POSITION']), 'N': acc(at['NORMAL']), 'J': acc(at['JOINTS_0']), 'W': acc(at['WEIGHTS_0']),
                          'I': acc(p['indices']).reshape(-1, 3), 'slot': g['materials'][p['material']]['name']})
        parts[n['name']] = prims
    return parts, g['extras']['cast']['variants'], jn


def g2b(a):
    a = np.asarray(a, float)
    return np.stack([a[:, 0], -a[:, 2], a[:, 1]], 1)


def srgb(c):
    c = max(0.0, min(1.0, float(c)))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


class Stage:
    def __init__(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=MANN)
        self.arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
        for o in list(bpy.data.objects):
            if o.type == 'MESH':
                bpy.data.objects.remove(o)
        self.arm.hide_render = True
        self.actions = {a.name: a for a in bpy.data.actions}
        self.parts, self.variants, self.jn = read_cast()
        self.scene = bpy.context.scene
        # ---- the game's look: per variant, per vertex of the union mesh (parts in node order, primitives in order: anim/gltf.ts loadGltfCast)
        self.look = json.load(open(os.path.join(LOOKDIR, 'look.json')))
        V = self.look['vertexCount']
        raw = np.fromfile(os.path.join(LOOKDIR, self.look['bin']['file']), np.float32)
        pos = raw[:V * 3].reshape(V, 3)
        self.vlook = {v['name']: raw[V * 3 + k * V * 5: V * 3 + (k + 1) * V * 5].reshape(V, 5) for k, v in enumerate(self.look['variants'])}
        self.men = {v['name']: v for v in self.look['variants']}
        self.off = {}
        vo = 0
        for name, prims in self.parts.items():
            for k, pr in enumerate(prims):
                self.off[(name, k)] = vo
                vo += len(pr['P'])
        if vo != V:
            raise SystemExit('look.json is of another cast: %d vertices there, %d in %s' % (V, vo, CAST))
        allp = np.concatenate([pr['P'] for prims in self.parts.values() for pr in prims])
        d = float(np.abs(allp - pos).max())
        if d > 1e-5:
            raise SystemExit('vertex order differs from the game loader (max position difference %.6f)' % d)
        self.base = {}
        for name, prims in self.parts.items():
            for k, pr in enumerate(prims):
                me = bpy.data.meshes.new('%s.%s' % (name, pr['slot']))
                me.from_pydata(g2b(pr['P']).tolist(), [], pr['I'].tolist())
                me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
                me.normals_split_custom_set_from_vertices(g2b(pr['N']).tolist())
                me.update()
                self.base[(name, k)] = me
        self.meshes = {}
        self.chars = []
        self.material = self._material()

    def _material(self):
        m = bpy.data.materials.new('look')
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes['Principled BSDF']
        col = nt.nodes.new('ShaderNodeAttribute')
        col.attribute_name = 'Col'
        nt.links.new(col.outputs['Color'], b.inputs['Base Color'])
        ro = nt.nodes.new('ShaderNodeAttribute')
        ro.attribute_name = 'rough'
        nt.links.new(ro.outputs['Fac'], b.inputs['Roughness'])
        sp = nt.nodes.new('ShaderNodeAttribute')
        sp.attribute_name = 'spec'
        nt.links.new(sp.outputs['Fac'], b.inputs['Specular IOR Level'])
        b.inputs['Metallic'].default_value = 0.0
        return m

    def mesh(self, variant, part, k):
        key = (variant, part, k)
        if key not in self.meshes:
            me = self.base[(part, k)].copy()
            n = len(me.vertices)
            L = self.vlook[variant][self.off[(part, k)]: self.off[(part, k)] + n]
            a = me.attributes.new('Col', 'FLOAT_COLOR', 'POINT')
            a.data.foreach_set('color', np.concatenate([L[:, :3], np.ones((n, 1), np.float32)], 1).ravel())
            a = me.attributes.new('rough', 'FLOAT', 'POINT')
            a.data.foreach_set('value', np.ascontiguousarray(L[:, 3]))
            a = me.attributes.new('spec', 'FLOAT', 'POINT')
            a.data.foreach_set('value', np.ascontiguousarray(0.25 * L[:, 4]))
            me.materials.append(self.material)
            self.meshes[key] = me
        return self.meshes[key]

    def spawn(self, variant, loc=(0, 0, 0), yaw=0.0, clip=None, frame=1):
        arm = self.arm.copy()
        self.scene.collection.objects.link(arm)
        arm.animation_data_clear()
        arm.rotation_mode = 'XYZ'
        arm.location = loc
        arm.rotation_euler = (0, 0, math.radians(yaw))
        arm.hide_render = True
        if clip:
            ad = arm.animation_data_create()
            act = self.actions[clip]
            ad.action = act
            try:
                if getattr(ad, 'action_slot', None) is None and len(act.slots):
                    ad.action_slot = act.slots[0]
            except Exception:
                pass
            self.scene.frame_set(int(frame))
            bpy.context.view_layer.update()
            basis = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}
            arm.animation_data_clear()
            for pb in arm.pose.bones:
                pb.matrix_basis = basis[pb.name]
        else:
            for pb in arm.pose.bones:
                pb.matrix_basis = Matrix.Identity(4)
        objs = []
        for pn in self.variants[variant]['parts']:
            for k, pr in enumerate(self.parts[pn]):
                o = bpy.data.objects.new('%s.%s.%d' % (variant, pn, k), self.mesh(variant, pn, k))
                self.scene.collection.objects.link(o)
                o.parent = arm
                vgs = [o.vertex_groups.new(name=n) for n in self.jn]
                J, W = pr['J'], pr['W']
                for c in range(4):
                    for j in np.unique(J[:, c]):
                        sel = np.where((J[:, c] == j) & (W[:, c] > 0))[0]
                        if len(sel) == 0:
                            continue
                        ws = W[sel, c]
                        for wv in np.unique(ws):
                            vgs[int(j)].add(sel[ws == wv].tolist(), float(wv), 'ADD')
                md = o.modifiers.new('arm', 'ARMATURE')
                md.object = arm
                objs.append(o)
        self.chars.append((arm, objs))
        return arm

    def clear(self):
        for arm, objs in self.chars:
            for o in objs:
                bpy.data.objects.remove(o)
            bpy.data.objects.remove(arm)
        self.chars = []

    # ---------------- the studio: neutral white lights, a mid-grey floor, a grey world. The same for every sheet.
    def studio(self, floor=(0.30, 0.30, 0.30), target=(0, 0, 1.0), scale=1.0):
        for o in list(bpy.data.objects):
            if o.name.startswith('st_'):
                bpy.data.objects.remove(o)
        w = bpy.data.worlds.new('w') if not self.scene.world else self.scene.world
        self.scene.world = w
        w.use_nodes = True
        bg = w.node_tree.nodes['Background']
        bg.inputs[0].default_value = (0.37, 0.37, 0.37, 1)
        bg.inputs[1].default_value = 0.30
        bpy.ops.mesh.primitive_plane_add(size=80)
        fl = bpy.context.object
        fl.name = 'st_floor'
        m = bpy.data.materials.new('st_floor')
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*floor, 1)
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
        fl.data.materials.append(m)
        t = Vector(target)
        # key / fill / rim as render_cast.py's, made white; `scale` moves them out for a wide stage with the energy kept per square metre
        for nm, loc, e, size in (('key', (3.2, -4.5, 4.6), 380, 3.0), ('fill', (-4.5, -3.0, 2.2), 130, 4.0), ('rim', (-1.5, 4.5, 4.0), 160, 2.5)):
            L = bpy.data.lights.new('st_' + nm, 'AREA')
            L.energy = e * scale * scale
            L.size = size * scale
            L.color = (1, 1, 1)
            o = bpy.data.objects.new('st_' + nm, L)
            o.location = Vector((t.x, t.y, 0)) + Vector(loc) * scale
            self.scene.collection.objects.link(o)
            self.aim(o, t)

    def aim(self, o, target):
        d = Vector(target) - o.location
        o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

    def camera(self, loc, target, fov=None, ortho=None):
        cam = bpy.data.objects.get('cam')
        if cam is None:
            cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
            self.scene.collection.objects.link(cam)
        self.scene.camera = cam
        cam.location = loc
        self.aim(cam, target)
        if ortho:
            cam.data.type = 'ORTHO'
            cam.data.sensor_fit = 'HORIZONTAL'       # ortho scale = the frame's WIDTH in metres
            cam.data.ortho_scale = ortho
        else:
            cam.data.type = 'PERSP'
            cam.data.sensor_fit = 'VERTICAL'
            cam.data.angle_y = math.radians(fov or 28)
        cam.data.clip_end = 200
        return cam

    def game_camera(self, target, dist, yaw=-22.0, pitch=55.0, fov=28.0):
        """src/game/camera.ts FollowCamera: pitch 55 deg down, vertical fov 28 deg, `dist` from the look-at"""
        p, y = math.radians(pitch), math.radians(yaw)
        t = Vector(target)
        loc = t + Vector((math.sin(y) * math.cos(p) * dist, -math.cos(y) * math.cos(p) * dist, math.sin(p) * dist))
        return self.camera(loc, t, fov)

    def render(self, path, w, h, spp=48):
        sc = self.scene
        sc.render.resolution_x, sc.render.resolution_y = w, h
        sc.render.resolution_percentage = 100
        sc.render.filepath = path
        sc.render.image_settings.file_format = 'PNG'
        sc.render.engine = 'CYCLES'
        sc.cycles.samples = spp
        sc.cycles.use_denoising = True
        sc.cycles.device = 'CPU'
        sc.view_settings.view_transform = 'Standard'      # true colours: no filmic / AgX shoulder
        sc.view_settings.look = 'None'
        sc.view_settings.exposure = EXPOSURE
        sc.render.threads_mode = 'AUTO'
        bpy.ops.render.render(write_still=True)

    def pixel(self, p, w, h):
        """image pixel (x from the left, y from the top) of a world point through the current camera"""
        bpy.context.view_layer.update()
        c = world_to_camera_view(self.scene, self.scene.camera, Vector(p))
        return c.x * w, (1 - c.y) * h


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print('FAILED:', ' '.join(cmd[:6]), '…', r.stderr[-400:])
    return r.returncode == 0


def annotate(path, labels, w, size=16, extra=None):
    """labels: (x centre px, y top px, text). Drawn white on a dark plate, centred on x."""
    cmd = ['convert', path]
    if extra:
        cmd += extra
    cmd += ['-pointsize', str(size), '-fill', 'white', '-undercolor', '#000000b0', '-gravity', 'North']
    for x, y, text in labels:
        cmd += ['-annotate', '%+d%+d' % (round(x - w / 2), round(y)), ' %s ' % text]
    cmd.append(path)
    sh(cmd)


def who(S, n):
    m = S.men[n]
    return '%s · %s' % (n, m['who'])


IDLE_TWIST = 18.0     # Idle_Loop stands bladed (shoulders ~18 deg to his right of the root): the close-ups turn him back by it, so 3/4 = 35 deg of BODY
GROUPS = (('operators', 'operator'), ('defenders', 'defender'), ('responders', 'responder'), ('civilians', 'civilian'))


def names_of(S, side):
    return sorted(n for n, v in S.variants.items() if v['side'] == side)


# ------------------------------------------------------------------ a. the line-ups
def shot_lineup(S, out, a):
    """lineup-front.png / lineup-back.png: all the variants in two rows — operators | responders over defenders | civilians — Idle_Loop frame 1,
    level orthographic view, every man named under his feet."""
    rows = [[('operators', names_of(S, 'operator')), ('responders', names_of(S, 'responder'))], [('defenders', names_of(S, 'defender')), ('civilians', names_of(S, 'civilian'))]]
    sp, gap = 1.0, 0.7
    width = max(sum(len(g[1]) for g in row) * sp + gap * (len(row) - 1) for row in rows) + 0.5
    W = 1800
    Hpx = int(W * 2.42 / width)
    for view, yaw in (('front', 0), ('back', 180)):
        strips = []
        for ri, row in enumerate(rows):
            S.clear()
            S.studio(scale=1.6)
            n = sum(len(g[1]) for g in row)
            x = -(n * sp + gap * (len(row) - 1)) / 2 + sp / 2
            marks, heads = [], []
            for gname, names in row:
                x0 = x
                for nm in names:
                    S.spawn(nm, (x, 0, 0), yaw, 'Idle_Loop', 1)
                    marks.append((x, nm))
                    x += sp
                heads.append(((x0 + x - sp) / 2, gname))
                x += gap
            S.camera((0, -16, 1.12), (0, 0, 1.12), ortho=width)
            p = os.path.join(out, '_lineup_%s_%d.png' % (view, ri))
            S.render(p, W, Hpx, a.spp)
            labels = [(S.pixel((mx, 0, 0), W, Hpx)[0], Hpx + 4, who(S, nm)) for mx, nm in marks]
            annotate(p, labels, W, 14, ['-background', BG, '-gravity', 'South', '-splice', '0x28'])
            annotate(p, [(S.pixel((hx, 0, 0), W, Hpx)[0], 4, '%s — %s' % (gname.upper(), view)) for hx, gname in heads], W, 18)
            strips.append(p)
        sh(['convert'] + strips + ['-append', os.path.join(out, 'lineup-%s.png' % view)])
        for p in strips:
            os.remove(p)


# ------------------------------------------------------------------ b. the game camera
def shot_topdown(S, out, a):
    """topdown-near.png / topdown-far.png: the four kinds mixed on one floor from the GAME's camera (pitch 55, fov 28) at 7.5 m and 21 m, 1600x900,
    + topdown-far-crop3x-{lanczos,nearest}.png: the men's patch of the far frame enlarged three times."""
    ops, dfs, rs, cs = (names_of(S, s) for s in ('operator', 'defender', 'responder', 'civilian'))
    mixed = []
    pools = [list(ops), list(dfs), list(rs), list(cs)]
    while any(pools):
        for pl in (pools[0], pools[1], pools[1], pools[0], pools[2], pools[3]):      # op, def, def, op, resp, civ, …: neighbours are of different kinds
            if pl:
                mixed.append(pl.pop(0))
    cols = 5
    nrow = math.ceil(len(mixed) / cols)
    yaws = [12, 200, -70, 150, 95, 180, -20, 240, 30, -140, 170, 60, 0, 215, -95, 130]
    clips = [('Idle_Loop', 1), ('Walk_Loop', 0.3), ('Idle_Loop', 20), ('Walk_Loop', 0.55), ('Walk_Loop', 0.7), ('Idle_Loop', 10)]   # (not Pistol_Idle_Loop: this tool's skinning leaves head-rigid parts behind in that clip; the game's own animator does not)
    S.clear()
    S.studio(scale=1.8, target=(0, 0, 1.0))
    marks = []
    for i, nm in enumerate(mixed):
        r, c = divmod(i, cols)
        inrow = min(cols, len(mixed) - r * cols)
        x = (c - (inrow - 1) / 2) * 1.2
        y = ((nrow - 1) / 2 - r) * 1.25
        clip, f = clips[i % len(clips)]
        if clip not in S.actions:
            clip, f = 'Idle_Loop', 1
        if isinstance(f, float):
            f0, f1 = S.actions[clip].frame_range
            f = round(f0 + (f1 - f0) * f)
        S.spawn(nm, (x, y, 0), yaws[i % len(yaws)], clip, f)
        marks.append(((x, y, 0), nm))
    W, Hh = 1600, 900
    for tag, dist in (('near', 7.5), ('far', 21.0)):
        S.game_camera((0, 0, 0.9), dist, yaw=0.0)
        p = os.path.join(out, 'topdown-%s.png' % tag)
        S.render(p, W, Hh, a.spp)
        px = [S.pixel(m, W, Hh) for m, _ in marks]
        if tag == 'far':
            hd = [S.pixel((m[0], m[1], 1.9), W, Hh) for m, _ in marks]
            x0 = max(0, int(min(q[0] for q in px + hd)) - 40)
            x1 = min(W, int(max(q[0] for q in px + hd)) + 40)
            y0 = max(0, int(min(q[1] for q in hd)) - 20)
            y1 = min(Hh, int(max(q[1] for q in px)) + 20)
            for flt, nm in (('Lanczos', 'lanczos'), ('point', 'nearest')):
                cp = os.path.join(out, 'topdown-far-crop3x-%s.png' % nm)
                sh(['convert', p, '-crop', '%dx%d+%d+%d' % (x1 - x0, y1 - y0, x0, y0), '+repage', '-filter', flt, '-resize', '300%', cp])
                annotate(cp, [((q[0] - x0) * 3, (q[1] - y0) * 3 + 6, nm2.replace('operator', 'op').replace('defender', 'def').replace('responder', 'resp').replace('civilian', 'civ')) for q, (_, nm2) in zip(px, marks)], (x1 - x0) * 3, 12)
            annotate(p, [(W / 2, 6, 'game camera, 21 m (pitch 55, fov 28), 1600x900 — the men are in the middle; see topdown-far-crop3x-*.png for names')], W, 15)
        else:
            annotate(p, [(q[0], q[1] + 6, nm.replace('operator', 'op').replace('defender', 'def').replace('responder', 'resp').replace('civilian', 'civ')) for q, (_, nm) in zip(px, marks)] + [(W / 2, 6, 'game camera, 7.5 m (pitch 55, fov 28), 1600x900')], W, 13)


# ------------------------------------------------------------------ c. close sheets
def swatch_strip(S, n, path, width):
    """the man's slot rows as flat chips: the slot's resolved albedo (linear → sRGB, as stored: no light), its share of his surface"""
    m = S.men[n]
    slots = [s for s in S.look['slots'] if s in m['slotShare']]
    cw = max(90, min(150, width // max(1, len(slots))))
    cmd = ['convert']
    for s in slots:
        al = m['palette']['slot'][s]['albedo']
        rgb = 'rgb(%d,%d,%d)' % tuple(round(255 * srgb(c)) for c in al)
        via = m['aliases'].get(s)
        cmd += ['(', '-size', '%dx54' % cw, 'xc:' + rgb, '-pointsize', '11', '-fill', 'white', '-undercolor', '#000000b0', '-gravity', 'North', '-annotate', '+0+3',
                ' %s%s ' % (s, ' =' + via if via else ''), '-gravity', 'South', '-annotate', '+0+3', ' %.3f %.3f %.3f · %d%% ' % (al[0], al[1], al[2], round(100 * m['slotShare'][s])), ')']
    cmd += ['+append', '-background', BG, '-gravity', 'center', '-extent', '%dx62' % width, path]
    return sh(cmd)


def shot_close(S, out, a, only):
    """close-<variant>.png: one man, 3/4 front and 3/4 back, head to toe (~840 px tall), his name and numbers above, his slot chips below."""
    todo = only or [n for n in ('operator_1', 'operator_2', 'defender_1', 'defender_2', 'defender_3', 'defender_4', 'defender_5', 'responder_1', 'civilian_1', 'civilian_2') if n in S.variants]
    W, Hh = 1400, 1000
    for n in todo:
        S.clear()
        S.studio()
        S.spawn(n, (-0.72, 0, 0), -35 + IDLE_TWIST, 'Idle_Loop', 1)
        S.spawn(n, (0.72, 0, 0), 145 + IDLE_TWIST, 'Idle_Loop', 1)
        S.camera((0, -14, 1.35), (0, 0, 1.02), ortho=3.08)
        p = os.path.join(out, 'close-%s.png' % n)
        S.render(p, W, Hh, a.spp)
        m = S.men[n]
        head = '%s — %s — table side %s — id %d — tint %s  tint2 %s' % (n, m['who'], m['side'], m['id'], m['tint'], m['tint2'])
        annotate(p, [(W / 2, 6, head), (W * 0.26, Hh - 26, '3/4 front'), (W * 0.74, Hh - 26, '3/4 back')], W, 15)
        sw = os.path.join(out, '_sw.png')
        if swatch_strip(S, n, sw, W):
            sh(['convert', p, sw, '-append', p])
            os.remove(sw)


def shot_head(S, out, a, only):
    """head-<kind>.png: head and shoulders of one man of each kind: front, 3/4, back 3/4."""
    todo = only or [names_of(S, s)[0] for s in ('operator', 'defender', 'responder', 'civilian') if names_of(S, s)]
    W, Hh = 1680, 650
    for n in todo:
        S.clear()
        S.studio(target=(0, 0, 1.55))
        for i, yw in enumerate((0, -40, 150)):
            S.spawn(n, ((i - 1) * 0.64, 0, 0), yw, 'Idle_Loop', 1)
        S.camera((0, -14, 1.75), (0, 0, 1.58), ortho=1.95)
        kind = S.variants[n]['side']
        p = os.path.join(out, 'head-%s.png' % (kind if not only else n))
        S.render(p, W, Hh, a.spp)
        annotate(p, [(W / 2, 6, 'head · %s · %s' % (who(S, n), S.men[n]['side'])), (W * 0.17, Hh - 24, 'front'), (W * 0.5, Hh - 24, '3/4'), (W * 0.83, Hh - 24, 'back 3/4')], W, 15)


def shot_swatches(S, out):
    rows = []
    for n in sorted(S.men, key=lambda x: [g[1] for g in GROUPS].index(S.variants[x]['side']) * 100 + int(x.split('_')[1])):
        p = os.path.join(out, '_swr_%s.png' % n)
        swatch_strip(S, n, p, 1500)
        sh(['convert', '-size', '300x62', 'xc:' + BG, '-pointsize', '14', '-fill', 'white', '-gravity', 'West', '-annotate', '+8+0', who(S, n) + '\n' + 'id %d · %s' % (S.men[n]['id'], S.men[n]['side']), p, '+append', p])
        rows.append(p)
    sh(['convert'] + rows + ['-append', os.path.join(out, 'swatches.png')])
    for p in rows:
        os.remove(p)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('shots', nargs='*', default=['lineup'])
    ap.add_argument('--spp', type=int, default=48)
    ap.add_argument('--only', default='')
    a = ap.parse_args(sys.argv[1:])
    os.makedirs(a.out, exist_ok=True)
    S = Stage()
    only = [x for x in a.only.split(',') if x]
    for s in a.shots:
        if s == 'lineup':
            shot_lineup(S, a.out, a)
        elif s == 'topdown':
            shot_topdown(S, a.out, a)
        elif s == 'close':
            shot_close(S, a.out, a, only)
        elif s == 'head':
            shot_head(S, a.out, a, only)
        elif s == 'swatches':
            shot_swatches(S, a.out)
        elif s == 'clips':
            for n, act in sorted(S.actions.items()):
                print('CLIP %-28s frames %s' % (n, tuple(act.frame_range)))
    print('DONE', ' '.join(a.shots))


if __name__ == '__main__':
    main()
