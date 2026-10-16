#!/usr/bin/env python3
"""Contract check for public/assets/chars/cast.gltf (plain python3 + numpy, no Blender).

    python3 tools/chars/check_cast.py [path]        exit 0 = every assertion holds, 1 = failures listed

Asserts the file contract the loader is written against: one embedded buffer, no textures / animations,
<= 32 uniquely named part nodes with mesh + skin 0, joints named as the mannequin's, POSITION / NORMAL /
JOINTS_0 / WEIGHTS_0 per primitive, triangle mode, slot-named materials, normalised <= 4 weights, index
ranges, no NaN, no degenerate triangles, bounding box, the variants table, and the triangle budgets.
"""
import base64
import json
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, 'public/assets/chars/cast.gltf')
MANN = os.path.join(REPO, 'public/assets/ual/AnimationLibrary_Godot_Standard.gltf')
SLOTS = ['skin', 'cloth_uniform', 'cloth_plain', 'webbing', 'boot', 'helmet', 'metal_dark', 'rubber', 'lens', 'accent', 'eye']
MAX_PARTS, MAX_VARIANT_TRIS, MAX_UNION_TRIS, MAX_UNION_VERTS = 32, 14000, 45000, 60000
BBOX = ((-1.0, 1.0), (-0.01, 1.95), (-0.45, 0.45))
AREA_EPS = 1e-10          # m^2: below this a triangle counts as degenerate
CT = {5120: 'i1', 5121: 'u1', 5122: 'i2', 5123: 'u2', 5125: 'u4', 5126: 'f4'}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

fails = []


YR = {}
SOLES = {}


def check(ok, msg):
    if not ok:
        fails.append(msg)
    return ok


g = json.load(open(PATH))
mg = json.load(open(MANN))
mann_joints = [mg['nodes'][j]['name'] for j in mg['skins'][0]['joints']]

check(g.get('asset', {}).get('version') == '2.0', 'asset.version is not 2.0')
check(len(g.get('buffers', [])) == 1, 'expected exactly one buffer')
uri = g['buffers'][0].get('uri', '')
check(uri.startswith('data:') and ';base64,' in uri, 'buffer is not an embedded base64 data URI')
buf = base64.b64decode(uri.split(',', 1)[1])
check(len(buf) == g['buffers'][0]['byteLength'], 'buffer byteLength mismatch')
check(not g.get('images') and not g.get('textures'), 'file carries textures / images')
check(not g.get('animations'), 'file carries animations')
check(len(g.get('skins', [])) == 1, 'expected exactly one skin')


def acc(i):
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    n = NC[a['type']]
    dt = np.dtype(CT[a['componentType']])
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    assert not bv.get('byteStride') or bv['byteStride'] == dt.itemsize * n
    assert off + a['count'] * n * dt.itemsize <= len(buf), 'accessor %d runs past the buffer' % i
    arr = np.frombuffer(buf, dt, a['count'] * n, off)
    return (arr.reshape(a['count'], n) if n > 1 else arr), a


skin = g['skins'][0]
joint_names = [g['nodes'][j]['name'] for j in skin['joints']]
check(set(joint_names) <= set(mann_joints), 'skin joints not in the mannequin: %s' % sorted(set(joint_names) - set(mann_joints)))
check(len(set(joint_names)) == len(joint_names), 'duplicate joint names')
mat_names = [m.get('name') for m in g.get('materials', [])]
check(set(mat_names) <= set(SLOTS), 'materials outside the eleven slots: %s' % sorted(set(mat_names) - set(SLOTS)))

parts = {}
rows = []
lo = np.full(3, np.inf)
hi = np.full(3, -np.inf)
slots_used = {}
for ni, n in enumerate(g['nodes']):
    if 'mesh' not in n:
        continue
    name = n.get('name', '')
    check(re.fullmatch(r'[a-z0-9_]+', name) is not None, 'part name %r is not lowercase [a-z0-9_]' % name)
    check(name not in parts, 'duplicate part name %r' % name)
    check(n.get('skin') == 0, 'part %s: skin is not 0' % name)
    tris = verts = 0
    pslots = []
    maxinf = 0
    for pi, p in enumerate(g['meshes'][n['mesh']]['primitives']):
        tag = '%s[%d]' % (name, pi)
        at = p['attributes']
        if not check(all(k in at for k in ('POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0')), tag + ': missing attribute'):
            continue
        check(p.get('mode', 4) == 4, tag + ': mode is not triangles')
        slot = mat_names[p['material']] if 'material' in p else None
        check(slot in SLOTS, tag + ': material %r is not a slot name' % slot)
        pslots.append(slot)
        P, pa = acc(at['POSITION'])
        N, na = acc(at['NORMAL'])
        J, ja = acc(at['JOINTS_0'])
        W, wa = acc(at['WEIGHTS_0'])
        I, ia = acc(p['indices'])
        check(pa['componentType'] == 5126 and na['componentType'] == 5126, tag + ': POSITION / NORMAL not f32')
        check(ja['componentType'] in (5121, 5123) and ja['type'] == 'VEC4', tag + ': JOINTS_0 not u8/u16 x4')
        check(wa['componentType'] == 5126 and wa['type'] == 'VEC4', tag + ': WEIGHTS_0 not f32 x4')
        check(ia['componentType'] in (5123, 5125), tag + ': indices not u16/u32')
        check(len(P) == len(N) == len(J) == len(W), tag + ': attribute counts differ')
        check(np.isfinite(P).all() and np.isfinite(N).all() and np.isfinite(W).all(), tag + ': NaN / inf')
        check(len(I) % 3 == 0 and len(I) > 0, tag + ': index count not a multiple of 3')
        check(int(I.max()) < len(P), tag + ': index out of range')
        check(len(np.unique(I)) == len(P), tag + ': %d unreferenced vertices' % (len(P) - len(np.unique(I))))
        check(abs(np.linalg.norm(N, axis=1) - 1).max() < 1e-3, tag + ': normals not unit')
        check(int(J.max()) < len(joint_names), tag + ': joint index out of range')
        check((W >= 0).all(), tag + ': negative weight')
        check(abs(W.sum(1) - 1).max() < 1e-4, tag + ': weights not normalised (max err %.2g)' % abs(W.sum(1) - 1).max())
        check(((W > 0).sum(1) >= 1).all(), tag + ': vertex without weights')
        maxinf = max(maxinf, int((W > 0).sum(1).max()))
        T = P[I.reshape(-1, 3).astype(np.int64)].astype(np.float64)
        fn = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
        area = np.linalg.norm(fn, axis=1) / 2
        check((area > AREA_EPS).all(), tag + ': %d degenerate triangles' % int((area <= AREA_EPS).sum()))
        # normals agree with the winding (outward CCW): a vertex normal should not oppose its faces
        fnu = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-20)
        nn = N[I.reshape(-1, 3).astype(np.int64)].astype(np.float64)
        opp = ((nn * fnu[:, None, :]).sum(-1) < -0.2).any(1).mean()
        check(opp < 0.02, tag + ': %.1f%% of triangles have a vertex normal opposing the face (winding?)' % (opp * 100))
        if 'min' in pa:
            check(np.allclose(pa['min'], P.min(0), atol=1e-5) and np.allclose(pa['max'], P.max(0), atol=1e-5), tag + ': POSITION min/max wrong')
        else:
            check(False, tag + ': POSITION accessor lacks min/max')
        yr = YR.setdefault(name, [9.0, -9.0])
        yr[0], yr[1] = min(yr[0], float(P[:, 1].min())), max(yr[1], float(P[:, 1].max()))
        lo = np.minimum(lo, P.min(0))
        hi = np.maximum(hi, P.max(0))
        tris += len(I) // 3
        verts += len(P)
        slots_used[slot] = slots_used.get(slot, 0) + len(I) // 3
    check(len(set(pslots)) == len(pslots), 'part %s: two primitives share a slot' % name)
    parts[name] = (tris, verts, pslots, maxinf)

check(1 <= len(parts) <= MAX_PARTS, '%d parts (limit %d)' % (len(parts), MAX_PARTS))
for k, (a, b) in enumerate(BBOX):
    check(lo[k] >= a and hi[k] <= b, 'bounding box axis %s = %.3f..%.3f outside %.2f..%.2f' % ('xyz'[k], lo[k], hi[k], a, b))

cast = g.get('extras', {}).get('cast', {})
check(cast.get('version') == 1, 'extras.cast.version != 1')
variants = cast.get('variants', {})
check(len(variants) > 0, 'no variants')
vrows = []
used = set()
for vn, v in variants.items():
    check(v.get('side') in ('operator', 'defender', 'civilian', 'responder'), 'variant %s: bad side %r' % (vn, v.get('side')))
    missing = [p for p in v.get('parts', []) if p not in parts]
    check(not missing, 'variant %s: unknown parts %s' % (vn, missing))
    check(len(set(v.get('parts', []))) == len(v.get('parts', [])), 'variant %s lists a part twice' % vn)
    t = sum(parts[p][0] for p in v.get('parts', []) if p in parts)
    check(t <= MAX_VARIANT_TRIS, 'variant %s: %d triangles (limit %d)' % (vn, t, MAX_VARIANT_TRIS))
    used |= set(v.get('parts', []))
    vrows.append((vn, v.get('side'), t, len(v.get('parts', []))))
    ys = [YR[p] for p in v.get('parts', []) if p in YR]
    if ys:
        check(min(y[0] for y in ys) < 0.02 and max(y[1] for y in ys) > 1.7, 'variant %s does not span floor to 1.7 m' % vn)
        sole = min(y[0] for y in ys)
        SOLES[vn] = sole
        check(abs(sole) <= 0.002, 'variant %s: soles at y = %.4f m, not on the floor (y = 0, bind pose, metres)' % (vn, sole))
print('lowest vertex per variant (m): ' + ' '.join('%s %.4f' % kv for kv in SOLES.items()))
unused = sorted(set(parts) - used)
check(not unused, 'parts worn by no variant: %s' % unused)
sets = [frozenset(v.get('parts', [])) for v in variants.values()]
check(len(set(sets)) == len(sets), 'two variants wear the same part set')
sides = [v.get('side') for v in variants.values()]
check(sides.count('operator') >= 5 and sides.count('defender') >= 4 and sides.count('civilian') >= 1, 'the set wants >= 5 operators, 4 defenders, 1 civilian: %s' % {k: sides.count(k) for k in set(sides)})
ut = sum(p[0] for p in parts.values())
uv = sum(p[1] for p in parts.values())
check(ut <= MAX_UNION_TRIS, 'union %d triangles (limit %d)' % (ut, MAX_UNION_TRIS))
check(uv <= MAX_UNION_VERTS, 'union %d vertices (limit %d)' % (uv, MAX_UNION_VERTS))

print('%s  (%.0f KB)' % (PATH, os.path.getsize(PATH) / 1024))
print('\n%-20s %6s %6s %4s  %s' % ('part', 'tris', 'verts', 'infl', 'slots'))
for n, (t, v, s, m) in parts.items():
    print('%-20s %6d %6d %4d  %s' % (n, t, v, m, ' '.join(s)))
print('%-20s %6d %6d       %d parts (limit %d) · limits %d tris / %d verts' % ('UNION', ut, uv, len(parts), MAX_PARTS, MAX_UNION_TRIS, MAX_UNION_VERTS))
print('\n%-20s %-9s %6s %5s' % ('variant', 'side', 'tris', 'parts'))
for vn, side, t, k in vrows:
    print('%-20s %-9s %6d %5d   (limit %d)' % (vn, side, t, k, MAX_VARIANT_TRIS))
print('\ntriangles by slot: ' + ' · '.join('%s %d' % (s, slots_used[s]) for s in SLOTS if s in slots_used))
print('slots never used:  ' + (' '.join(s for s in SLOTS if s not in slots_used) or '(none)'))
print('parts in no variant: ' + (' '.join(unused) or '(none)'))
print('bounding box: x %.3f..%.3f  y %.3f..%.3f  z %.3f..%.3f' % (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
print('joints in the skin: %d (all mannequin names: %s)' % (len(joint_names), set(joint_names) <= set(mann_joints)))
if fails:
    print('\nFAIL (%d):' % len(fails))
    for f in fails:
        print('  - ' + f)
    sys.exit(1)
print('\nPASS: every contract assertion holds')
