#!/usr/bin/env python3
"""Renders / deformation checks for cast.gltf in headless Blender (bpy as a module).

    ~/bvenv/bin/python -I tools/chars/render_cast.py <outdir> [shots…] [--spp N] [--quick]

shots: lineup · turn (a turnaround per variant) · topdown (the game camera, 7.5 m and 21 m) ·
       strips (Workbench animation strips) · clips (lists the mannequin's actions)
The parts are loaded by this file's own glTF reader (so what is drawn is exactly what cast.gltf says:
positions, normals, joints, weights, slots) and skinned to the mannequin's armature as Blender imports it.
"""
import base64
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
CAST = os.environ.get('CAST_GLTF') or os.path.join(REPO, 'public/assets/chars/cast.gltf')     # CAST_GLTF=<path> renders a scratch build
MANN = os.path.join(REPO, 'public/assets/ual/AnimationLibrary_Godot_Standard.gltf')

# per-slot look for the stills (the game shades by slot name; these are stand-ins)
LOOK = {
    'skin': ((0.52, 0.33, 0.22), 0.55, 0.0),
    'cloth_uniform': ((0.115, 0.135, 0.075), 0.92, 0.0),
    'cloth_plain': ((0.50, 0.44, 0.33), 0.92, 0.0),
    'webbing': ((0.19, 0.17, 0.10), 0.85, 0.0),
    'boot': ((0.022, 0.020, 0.018), 0.45, 0.0),
    'helmet': ((0.075, 0.085, 0.055), 0.55, 0.0),
    'metal_dark': ((0.035, 0.035, 0.04), 0.35, 0.85),
    'rubber': ((0.016, 0.014, 0.013), 0.75, 0.0),
    'lens': ((0.01, 0.06, 0.035), 0.05, 0.0),
    'accent': ((0.60, 0.10, 0.07), 0.90, 0.0),
    'eye': ((0.46, 0.445, 0.42), 0.25, 0.0),
}
PAIR = {'red': (0.55, 0.045, 0.035), 'blue': (0.04, 0.12, 0.55)}
# per-variant tints (what the game's loadout / pair colours would do)
TINT = {
    'operator_1': {'accent': PAIR['red']}, 'operator_2': {'accent': PAIR['red']},
    'operator_3': {'accent': PAIR['blue']}, 'operator_4': {'accent': PAIR['blue']},
    'operator_5': {'accent': PAIR['red']},
    'defender_1': {'cloth_plain': (0.46, 0.40, 0.27), 'cloth_uniform': (0.16, 0.17, 0.10), 'helmet': (0.10, 0.13, 0.22)},
    'defender_2': {'cloth_plain': (0.50, 0.50, 0.46), 'cloth_uniform': (0.07, 0.10, 0.20), 'helmet': (0.23, 0.20, 0.12), 'skin': (0.42, 0.26, 0.17)},
    'defender_3': {'cloth_plain': (0.34, 0.10, 0.08), 'cloth_uniform': (0.14, 0.15, 0.09), 'helmet': (0.45, 0.07, 0.05), 'skin': (0.47, 0.30, 0.20)},
    'defender_4': {'cloth_plain': (0.20, 0.30, 0.36), 'cloth_uniform': (0.20, 0.17, 0.12), 'helmet': (0.52, 0.43, 0.24), 'skin': (0.40, 0.25, 0.16)},
    'defender_5': {'cloth_plain': (0.52, 0.47, 0.30), 'cloth_uniform': (0.10, 0.12, 0.08), 'helmet': (0.12, 0.14, 0.09)},
    'defender_6': {'cloth_plain': (0.15, 0.22, 0.14), 'cloth_uniform': (0.08, 0.10, 0.18), 'helmet': (0.2, 0.2, 0.2), 'skin': (0.45, 0.29, 0.19)},
    'responder_1': {'cloth_plain': (0.30, 0.31, 0.31), 'cloth_uniform': (0.055, 0.06, 0.07), 'helmet': (0.03, 0.032, 0.036)},
    'responder_2': {'cloth_plain': (0.30, 0.31, 0.31), 'cloth_uniform': (0.055, 0.06, 0.07), 'helmet': (0.03, 0.032, 0.036), 'skin': (0.44, 0.28, 0.18)},
    'civilian_1': {'cloth_plain': (0.62, 0.64, 0.68), 'cloth_uniform': (0.16, 0.14, 0.12), 'boot': (0.10, 0.05, 0.03)},
    'civilian_2': {'cloth_plain': (0.55, 0.42, 0.20), 'cloth_uniform': (0.25, 0.22, 0.17), 'boot': (0.10, 0.05, 0.03), 'skin': (0.43, 0.27, 0.18)},
}

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
        if 'mesh' not in n:
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


class Stage:
    def __init__(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=MANN)
        self.arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
        for o in list(bpy.data.objects):
            if o.type == 'MESH':
                if o.name == 'Mannequin':
                    self.mann = o
                    o.hide_render = True
                    o.hide_viewport = True
                else:
                    bpy.data.objects.remove(o)
        self.arm.hide_render = True
        self.actions = {a.name: a for a in bpy.data.actions}
        self.parts, self.variants, self.jn = read_cast()
        self.scene = bpy.context.scene
        self.mats = {}
        self.meshes = {}
        for name, prims in self.parts.items():
            for k, pr in enumerate(prims):
                me = bpy.data.meshes.new('%s.%s' % (name, pr['slot']))
                me.from_pydata(g2b(pr['P']).tolist(), [], pr['I'].tolist())
                me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
                me.normals_split_custom_set_from_vertices(g2b(pr['N']).tolist())
                me.update()
                self.meshes[(name, k)] = me
        self.chars = []
        self.grey = None

    def mat(self, slot, rgb=None):
        base, ro, me = LOOK[slot]
        rgb = tuple(rgb or base)
        key = (slot, rgb)
        if key not in self.mats:
            m = bpy.data.materials.new('%s_%02x%02x%02x' % (slot, *[int(c * 255) for c in rgb]))
            m.use_nodes = True
            b = m.node_tree.nodes['Principled BSDF']
            b.inputs['Base Color'].default_value = (*rgb, 1)
            b.inputs['Roughness'].default_value = ro
            b.inputs['Metallic'].default_value = me
            if slot.startswith('cloth') or slot == 'webbing':
                try:
                    b.inputs['Sheen Weight'].default_value = 0.3
                except Exception:
                    pass
            m.diffuse_color = (*rgb, 1)
            m.roughness = ro
            self.mats[key] = m
        return self.mats[key]

    def spawn(self, variant, loc=(0, 0, 0), yaw=0.0, clip=None, frame=1, tint=None, parts=None, mannequin=False):
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
        tints = dict(TINT.get(variant, {}))
        tints.update(tint or {})
        objs = []
        if mannequin:
            o = self.mann.copy()
            self.scene.collection.objects.link(o)
            o.hide_render = False
            o.hide_viewport = False
            o.parent = arm
            for m in o.modifiers:
                if m.type == 'ARMATURE':
                    m.object = arm
            objs.append(o)
        else:
            for pn in (parts or self.variants[variant]['parts']):
                for k, pr in enumerate(self.parts[pn]):
                    o = bpy.data.objects.new('%s.%s.%d' % (variant, pn, k), self.meshes[(pn, k)])
                    self.scene.collection.objects.link(o)
                    o.parent = arm
                    vgs = [o.vertex_groups.new(name=n) for n in self.jn]
                    J, W = pr['J'], pr['W']
                    for c in range(4):
                        for j in np.unique(J[:, c]):
                            sel = np.where((J[:, c] == j) & (W[:, c] > 0))[0]
                            if len(sel) == 0:
                                continue
                            # group by equal weight would be slow; add one by one in bulk per weight value
                            ws = W[sel, c]
                            for wv in np.unique(ws):
                                vgs[int(j)].add(sel[ws == wv].tolist(), float(wv), 'ADD')
                    md = o.modifiers.new('arm', 'ARMATURE')
                    md.object = arm
                    if len(o.material_slots) == 0:
                        o.data.materials.append(None) if len(o.data.materials) == 0 else None
                    o.material_slots[0].link = 'OBJECT'
                    o.material_slots[0].material = self.mat(pr['slot'], tints.get(pr['slot']))
                    objs.append(o)
        self.chars.append((arm, objs))
        return arm

    def clear(self):
        for arm, objs in self.chars:
            for o in objs:
                bpy.data.objects.remove(o)
            bpy.data.objects.remove(arm)
        self.chars = []

    # ---------------- lights / cameras / engines
    def studio(self, floor=(0.30, 0.30, 0.31)):
        for o in list(bpy.data.objects):
            if o.name.startswith('st_'):
                bpy.data.objects.remove(o)
        w = bpy.data.worlds.new('w') if not self.scene.world else self.scene.world
        self.scene.world = w
        w.use_nodes = True
        bg = w.node_tree.nodes['Background']
        bg.inputs[0].default_value = (0.36, 0.37, 0.39, 1)
        bg.inputs[1].default_value = 0.22
        bpy.ops.mesh.primitive_plane_add(size=60)
        fl = bpy.context.object
        fl.name = 'st_floor'
        m = bpy.data.materials.new('st_floor')
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*floor, 1)
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
        m.diffuse_color = (*floor, 1)
        fl.data.materials.append(m)
        for nm, loc, e, size, col in (('key', (3.2, -4.5, 4.6), 330, 3.0, (1, .97, .93)), ('fill', (-4.5, -3.0, 2.2), 90, 4.0, (.9, .93, 1)),
                                      ('rim', (-1.5, 4.5, 4.0), 160, 2.5, (1, 1, 1))):
            L = bpy.data.lights.new('st_' + nm, 'AREA')
            L.energy = e
            L.size = size
            L.color = col
            o = bpy.data.objects.new('st_' + nm, L)
            o.location = loc
            self.scene.collection.objects.link(o)
            self.aim(o, (0, 0, 1.0))

    def night(self, lamp=(0.6, 0.4, 3.0)):
        for o in list(bpy.data.objects):
            if o.name.startswith('st_'):
                bpy.data.objects.remove(o)
        w = bpy.data.worlds.new('w') if not self.scene.world else self.scene.world
        self.scene.world = w
        w.use_nodes = True
        bg = w.node_tree.nodes['Background']
        bg.inputs[0].default_value = (0.10, 0.14, 0.24, 1)
        bg.inputs[1].default_value = 0.22
        bpy.ops.mesh.primitive_plane_add(size=80)
        fl = bpy.context.object
        fl.name = 'st_floor'
        m = bpy.data.materials.new('st_floor')
        m.use_nodes = True
        nt = m.node_tree
        ch = nt.nodes.new('ShaderNodeTexChecker')
        ch.inputs['Scale'].default_value = 80
        ch.inputs['Color1'].default_value = (0.20, 0.19, 0.17, 1)
        ch.inputs['Color2'].default_value = (0.15, 0.145, 0.13, 1)
        nt.links.new(ch.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
        nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.7
        fl.data.materials.append(m)
        L = bpy.data.lights.new('st_lamp', 'POINT')
        L.energy = 1500
        L.shadow_soft_size = 0.12
        L.color = (1.0, 0.78, 0.52)
        o = bpy.data.objects.new('st_lamp', L)
        o.location = lamp
        self.scene.collection.objects.link(o)
        L2 = bpy.data.lights.new('st_fill', 'SUN')
        L2.energy = 0.25
        L2.color = (0.6, 0.72, 1.0)
        o2 = bpy.data.objects.new('st_fill', L2)
        o2.rotation_euler = (math.radians(50), 0, math.radians(140))
        self.scene.collection.objects.link(o2)

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
            cam.data.ortho_scale = ortho
        else:
            cam.data.type = 'PERSP'
            cam.data.sensor_fit = 'VERTICAL'
            cam.data.angle_y = math.radians(fov or 28)
        cam.data.clip_end = 200
        return cam

    def game_camera(self, target, dist, yaw=-22.0, pitch=55.0, fov=28.0):
        p, y = math.radians(pitch), math.radians(yaw)
        t = Vector(target)
        loc = t + Vector((math.sin(y) * math.cos(p) * dist, -math.cos(y) * math.cos(p) * dist, math.sin(p) * dist))
        return self.camera(loc, t, fov)

    def render(self, path, w, h, engine='CYCLES', spp=48):
        sc = self.scene
        sc.render.resolution_x, sc.render.resolution_y = w, h
        sc.render.resolution_percentage = 100
        sc.render.filepath = path
        sc.render.image_settings.file_format = 'PNG'
        if engine == 'CYCLES':
            sc.render.engine = 'CYCLES'
            sc.cycles.samples = spp
            sc.cycles.use_denoising = True
            sc.cycles.device = 'CPU'
            sc.view_settings.view_transform = 'Standard'      # true colours: no filmic shoulder
            sc.view_settings.look = 'None'
            sc.view_settings.exposure = 0.0
            sc.render.threads_mode = 'AUTO'
        else:
            sc.render.engine = 'BLENDER_WORKBENCH'
            sh = sc.display.shading
            sh.light = 'FLAT' if self.grey == 'flat' else 'STUDIO'
            sh.color_type = 'SINGLE' if self.grey else 'MATERIAL'
            sh.single_color = (0.62, 0.62, 0.62)
            if self.grey:
                self.scene.world.use_nodes = False
                self.scene.world.color = (0.045, 0.045, 0.05)
            sh.show_cavity = True
            sh.cavity_type = 'BOTH'
            sh.show_shadows = False
            sh.show_backface_culling = True
            sc.view_settings.view_transform = 'Standard'
            fl = bpy.data.objects.get('st_floor')
            if fl:
                fl.hide_render = True
        bpy.ops.render.render(write_still=True)
        fl = bpy.data.objects.get('st_floor')
        if fl:
            fl.hide_render = False


def montage(files, out, tile, geom='+2+2', bg='#5c5e63'):
    os.system('montage %s -tile %s -geometry %s -background "%s" %s' % (' '.join(files), tile, geom, bg, out))


SIDES = (('operators', ('operator',)), ('defenders', ('defender', 'responder', 'civilian')), ('all', ('operator', 'defender', 'responder', 'civilian')))


def side_names(S, tag):
    want = dict(SIDES)[tag]
    return [n for n, v in S.variants.items() if v['side'] in want]


def shot_lineup(S, out, a, tag='all'):
    """lineup-<tag>.png: the men side by side, level front view over a raised three-quarter view."""
    names = side_names(S, tag)
    S.clear()
    S.studio()
    sp = 0.95
    x0 = -(len(names) - 1) * sp / 2
    for i, n in enumerate(names):
        S.spawn(n, (x0 + i * sp, 0, 0), 0, a.pose_clip, a.pose_frame)
    width = max(len(names) * sp + 0.6, 3.0)
    px = min(int(430 * len(names)), 3600) if not a.quick else 300 * len(names)
    ph = int(px * 2.25 / width)
    S.camera((0, -14, 1.15), (0, 0, 0.98), ortho=width)
    p1 = os.path.join(out, '_lineup_a.png')
    p2 = os.path.join(out, '_lineup_b.png')
    S.render(p1, px, ph, a.engine, a.spp)
    S.camera((width * 0.25, -13, 5.2), (0, 0, 0.95), ortho=width * 1.02)
    # seen from the side and above a long row slants up the frame: give the panel the height the end men need
    extra = 0.31 * math.sin(math.atan(0.25 * width / 13)) * (width - 0.6)
    S.render(p2, px, int(px * (2.3 + extra) / (width * 1.02)), a.engine, a.spp)
    os.system('convert %s %s -append %s && rm %s %s' % (p1, p2, os.path.join(out, 'lineup-%s.png' % tag), p1, p2))


def shot_topdown(S, out, a, tag='all'):
    """topdown-<tag>.png, six panels: the game's pitched camera (57 deg down from 14 m, fov 28) and a straight-down
    one (a longer lens, fov 20), each lit in colour, shaded in one grey, and as a flat grey silhouette. Front row faces the camera
    (idle), back row faces away (mid-stride): what is on a man's head and back is what has to tell him apart."""
    names = side_names(S, tag)
    S.clear()
    S.studio()
    sp = 1.05 if len(names) <= 7 else 1.25     # the long row needs elbow room seen from straight above
    x0 = -(len(names) - 1) * sp / 2
    f0, f1 = S.actions['Walk_Loop'].frame_range
    for i, n in enumerate(names):
        S.spawn(n, (x0 + i * sp, -1.1, 0), 12, 'Idle_Loop', 1)
        S.spawn(n, (x0 + i * sp, 1.1, 0), 192, 'Walk_Loop', round(f0 + (f1 - f0) * 0.3))
    w = max(1500, int(160 * ((len(names) - 1) * sp + 2.6)))      # the cameras fit vertically: a longer row = a wider image, same scale
    h = 1000
    panels = []
    for view in ('pitched', 'down'):
        for mode in ('lit', 'shade', 'flat'):
            if view == 'pitched':
                S.game_camera((0, 0, 0.9), 14.0, yaw=0.0, pitch=57.0)
            else:
                cam = S.camera((0, 0, 14.9), (0, 0, 0.9), 20)        # same height, a longer lens: the row fills the frame
                cam.rotation_euler = (0, 0, 0)
            S.grey = None if mode == 'lit' else mode
            p = os.path.join(out, '_top_%s_%s.png' % (view, mode))
            hh = h if view == 'pitched' else 760
            S.render(p, w, hh, a.engine if mode == 'lit' else 'WORKBENCH', a.spp)
            if mode != 'lit':
                S.studio()          # the grey pass switched the world's nodes off
            os.system('convert %s -gravity NorthWest -fill white -pointsize 24 -annotate +8+6 "%s  %s  %s" %s'
                      % (p, tag, '57 deg from 14 m' if view == 'pitched' else 'straight down from 14 m', mode, p))
            panels.append(p)
    S.grey = None
    os.system('convert %s -append %s && rm %s' % (' '.join(panels), os.path.join(out, 'topdown-%s.png' % tag), ' '.join(panels)))


def shot_turn(S, out, a, only=None):
    for n in S.variants:
        if only and n not in only:
            continue
        S.clear()
        S.studio()
        yaws = [0, -40, -90, 180]
        for i, yw in enumerate(yaws):
            S.spawn(n, ((i - 1.5) * 1.25, 0, 0), yw, a.pose_clip, a.pose_frame)
        S.camera((0, -14, 1.0), (0, 0, 0.96), ortho=5.2)
        S.render(os.path.join(out, 'turnaround-%s.png' % n), 2400, 1000, a.engine, a.spp)


# formation for the game-camera sheets: operators stacked on a door line, defenders loose
def stage_cast(S, a, idle=True):
    ops = [n for n in S.variants if S.variants[n]['side'] == 'operator']
    dfs = [n for n in S.variants if S.variants[n]['side'] != 'operator']
    op_clip = [('Pistol_Idle_Loop', 5), ('Pistol_Aim_Neutral', 1), ('Pistol_Idle_Loop', 20), ('Crouch_Idle_Loop', 10), ('Pistol_Aim_Neutral', 1)]
    for i, n in enumerate(ops):
        c, f = op_clip[i % len(op_clip)]
        S.spawn(n, (-2.2 + i * 0.62, -0.9 + 0.10 * (i % 2), 0), -90 + (10 if i % 2 else -6), c, f)
    spots = [(0.9, 0.9, 200), (1.9, -0.2, 110), (2.6, 1.3, 150), (0.2, 1.9, 235), (3.3, 0.2, 80), (1.5, 2.3, 180), (-1.0, 1.6, 300), (-2.2, 2.2, 20)]
    df_clip = [('Idle_Loop', 10), ('Idle_Talking_Loop', 14), ('Pistol_Idle_Loop', 8), ('Idle_Loop', 30), ('Walk_Loop', 6), ('Idle_Talking_Loop', 30), ('Idle_Loop', 20), ('Sitting_Idle_Loop', 5)]
    for i, n in enumerate(dfs):
        x, y, yw = spots[i % len(spots)]
        c, f = df_clip[i % len(df_clip)]
        S.spawn(n, (x, y, 0), yw, c, f)


STRIP_CLIPS = [('Walk_Loop', 4), ('Sprint_Loop', 4), ('Jog_Fwd_Loop', 3), ('Crouch_Fwd_Loop', 4), ('Pistol_Aim_Neutral', 1), ('Pistol_Aim_Up', 1), ('Pistol_Aim_Down', 1),
               ('Pistol_Idle_Loop', 2), ('Pistol_Reload', 3), ('Idle_Loop', 2), ('Death01', 4), ('Hit_Chest', 2), ('Roll', 3), ('Sitting_Idle_Loop', 1),
               ('Fixing_Kneeling', 2), ('PickUp_Table', 2), ('Punch_Cross', 2), ('Push_Loop', 2), ('Interact', 2), ('Crouch_Idle_Loop', 1)]


def shot_strips(S, out, a, variants=None, clips=None):
    os.makedirs(os.path.join(out, 'strips'), exist_ok=True)
    variants = variants or [n for n in ('operator_1', 'defender_1', 'operator_3', 'defender_4') if n in S.variants]
    for v in variants:
        rows = []
        for clip, nfr in (clips or STRIP_CLIPS):
            act = S.actions[clip]
            f0, f1 = act.frame_range
            frames = [f0 + (f1 - f0) * (k + 0.5) / nfr for k in range(nfr)] if nfr > 1 else [(f0 + f1) / 2]
            tiles = []
            for k, fr in enumerate(frames):
                for view, yaw in (('f', 35), ('b', 215)):
                    S.clear()
                    S.studio()
                    arm = S.spawn(v, (0, 0, 0), 0, clip, round(fr))
                    bpy.context.view_layer.update()
                    hips = arm.matrix_world @ arm.pose.bones['DEF-hips'].head
                    yr = math.radians(yaw)
                    tgt = Vector((hips.x, hips.y, max(0.75, min(hips.z, 1.0))))
                    S.camera(tgt + Vector((math.sin(yr) * 9, -math.cos(yr) * 9, 2.2)), tgt, ortho=2.3)
                    p = os.path.join(out, 'strips', '_%s_%s_%d%s.png' % (v, clip, k, view))
                    S.render(p, 420, 420, 'WORKBENCH')
                    tiles.append(p)
            row = os.path.join(out, 'strips', '_row_%s_%s.png' % (v, clip))
            os.system('montage %s -tile %dx1 -geometry +1+1 -background "#444" %s && convert %s -gravity NorthWest -fill white -pointsize 18 -annotate +6+4 "%s  %s" %s'
                      % (' '.join(tiles), len(tiles), row, row, v, clip, row))
            for t in tiles:
                os.remove(t)
            rows.append(row)
        # sheets of 5 clips
        for s in range(0, len(rows), 5):
            sheet = os.path.join(out, 'strips', 'strip-%s-%d.png' % (v, s // 5 + 1))
            os.system('convert %s -background "#444" -append %s' % (' '.join(rows[s:s + 5]), sheet))
        for r in rows:
            os.remove(r)


DEFORM = [('Idle_Loop', .0), ('Walk_Loop', .15), ('Walk_Loop', .65), ('Sprint_Loop', .2), ('Sprint_Loop', .7), ('Jog_Fwd_Loop', .4), ('Crouch_Idle_Loop', .5),
          ('Crouch_Fwd_Loop', .3), ('Pistol_Aim_Neutral', .5), ('Pistol_Aim_Down', .5), ('Sitting_Idle_Loop', .5), ('Death01', .45), ('Death01', 1.0)]


def shot_deform(S, out, a, only=None):
    """One row per variant and view: the same man in a spread of clip frames, Workbench with back-face culling.
    Each variant is rendered by a process of its own (this file with --rows): a long-lived Blender slows down."""
    import subprocess
    sp = 1.9
    if a.rows:
        for n in only:
            for view, yaw in (('f', 30), ('b', 205)):
                S.clear()
                S.studio()
                xs = []
                x = 0.0
                for clip, t in DEFORM:
                    f0, f1 = S.actions[clip].frame_range
                    S.spawn(n, (x, 0, 0), yaw, clip, round(f0 + (f1 - f0) * t))
                    xs.append(x)
                    x += sp * (1.5 if clip == 'Death01' else 1.0)
                span = xs[-1] + 2.2
                mid = Vector(((xs[0] + xs[-1] + 1.2) / 2, 0, 0.75))
                width = span + 1.0
                S.camera(mid + Vector((0, -30, 8.0)), mid, ortho=width)
                p = os.path.join(out, '_deform_%s_%s.png' % (n, view))
                S.render(p, 5200, int(5200 * 3.0 / width), 'WORKBENCH')
                os.system('convert %s -gravity NorthWest -fill white -pointsize 26 -annotate +8+6 "%s  %s" %s' % (p, n, 'front' if view == 'f' else 'back', p))
        return
    for side, tag in (('operator', 'operators'), ('defender', 'defenders')):
        names = [n for n, v in S.variants.items() if (v['side'] == side or (side == 'defender' and v['side'] in ('civilian', 'responder'))) and (not only or n in only)]
        rows = []
        for n in names:
            subprocess.run([sys.executable, '-I', os.path.abspath(__file__), out, 'deform', '--rows', '--only', n], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            rows += [os.path.join(out, '_deform_%s_%s.png' % (n, v)) for v in 'fb']
        if rows:
            os.system('convert %s -append %s' % (' '.join(rows), os.path.join(out, 'deform-%s.png' % tag)))
            if not a.keep:
                for q in rows:
                    os.remove(q)


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('shots', nargs='*', default=['lineup'])
    ap.add_argument('--spp', type=int, default=48)
    ap.add_argument('--quick', action='store_true')
    ap.add_argument('--only', default='')
    ap.add_argument('--pose', default='Idle_Loop:1')
    ap.add_argument('--keep', action='store_true')
    ap.add_argument('--rows', action='store_true')
    a = ap.parse_args(sys.argv[1:])
    a.engine = 'WORKBENCH' if a.quick else 'CYCLES'
    a.pose_clip, a.pose_frame = (a.pose.split(':')[0], int(a.pose.split(':')[1])) if a.pose not in ('', 'T') else (None, 1)
    os.makedirs(a.out, exist_ok=True)
    S = Stage()
    only = [x for x in a.only.split(',') if x]
    for s in a.shots:
        if s == 'clips':
            for n, act in sorted(S.actions.items()):
                print('CLIP %-28s frames %s' % (n, tuple(act.frame_range)))
        elif s.startswith('lineup'):
            shot_lineup(S, a.out, a, s.split('-')[1] if '-' in s else 'all')
        elif s == 'turn':
            shot_turn(S, a.out, a, only)
        elif s.startswith('topdown'):
            shot_topdown(S, a.out, a, s.split('-')[1] if '-' in s else 'all')
        elif s == 'deform':
            shot_deform(S, a.out, a, only)
        elif s == 'strips':
            shot_strips(S, a.out, a, only or None)
    print('DONE')


if __name__ == '__main__':
    main()
