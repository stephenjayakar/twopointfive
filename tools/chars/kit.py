"""Geometry kit for the character cast (pure numpy, no bpy).

Space = the mannequin's mesh / bind space exactly as its POSITION accessor has it:
metres, +Y up, +Z = the way the toes point (front), +X = the character's LEFT, feet on Y=0, T-pose.

A CHUNK is a dict {V (n,3), F (m,3) int, W (n,53) float, slot str, angle float}: `angle` is the
auto-smooth threshold in degrees (180 = fully smooth, 30 = hard edges split).
A PART is (name, [chunks]). build_cast.py assembles parts and variants; write_gltf() files them.
"""
import base64
import json
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
MANNEQUIN = os.path.join(REPO, 'public/assets/ual/AnimationLibrary_Godot_Standard.gltf')
OUT = os.path.join(REPO, 'public/assets/chars/cast.gltf')

SLOTS = ['skin', 'cloth_uniform', 'cloth_plain', 'webbing', 'boot', 'helmet', 'metal_dark', 'rubber', 'lens', 'accent', 'eye']
# preview colours only: the game shades by slot NAME.  (rgb, roughness, metallic)
SLOT_PREVIEW = {
    'skin': ((0.60, 0.40, 0.28), 0.60, 0.0),
    'cloth_uniform': ((0.20, 0.23, 0.14), 0.90, 0.0),
    'cloth_plain': ((0.62, 0.56, 0.44), 0.90, 0.0),
    'webbing': ((0.27, 0.25, 0.16), 0.85, 0.0),
    'boot': ((0.035, 0.030, 0.028), 0.55, 0.0),
    'helmet': ((0.10, 0.11, 0.09), 0.50, 0.0),
    'metal_dark': ((0.05, 0.05, 0.055), 0.40, 0.8),
    'rubber': ((0.025, 0.022, 0.020), 0.80, 0.0),
    'lens': ((0.02, 0.05, 0.04), 0.08, 0.0),
    'accent': ((0.60, 0.10, 0.07), 0.85, 0.0),
    'eye': ((0.46, 0.445, 0.42), 0.25, 0.0),
}

_CT = {5120: 'i1', 5121: 'u1', 5122: 'i2', 5123: 'u2', 5125: 'u4', 5126: 'f4'}
_NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def norm(v, axis=-1):
    v = np.asarray(v, float)
    n = np.linalg.norm(v, axis=axis, keepdims=True)
    return v / np.maximum(n, 1e-12)


# ------------------------------------------------------------------------------------------------
# the mannequin
# ------------------------------------------------------------------------------------------------
class Mannequin:
    def __init__(self, path=MANNEQUIN):
        g = json.load(open(path))
        self.gltf = g
        buf = open(os.path.join(os.path.dirname(path), g['buffers'][0]['uri']), 'rb').read()

        def acc(i):
            a = g['accessors'][i]
            bv = g['bufferViews'][a['bufferView']]
            n = _NC[a['type']]
            dt = np.dtype(_CT[a['componentType']])
            off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
            arr = np.frombuffer(buf, dt, a['count'] * n, off)
            return arr.reshape(a['count'], n) if n > 1 else arr

        sk = g['skins'][0]
        self.joint_nodes = sk['joints']
        self.names = [g['nodes'][n]['name'] for n in sk['joints']]
        self.J = {n: i for i, n in enumerate(self.names)}
        self.ibm = acc(sk['inverseBindMatrices']).reshape(-1, 16).astype(np.float32).copy()
        self.jpos = np.array([np.linalg.inv(m.reshape(4, 4).T)[:3, 3] for m in self.ibm])
        Ps, Fs, Js, Ws, o = [], [], [], [], 0
        for p in g['meshes'][0]['primitives']:
            P = acc(p['attributes']['POSITION'])
            Ps.append(P)
            Fs.append(acc(p['indices']).reshape(-1, 3).astype(np.int64) + o)
            Js.append(acc(p['attributes']['JOINTS_0']))
            Ws.append(acc(p['attributes']['WEIGHTS_0']))
            o += len(P)
        P = np.vstack(Ps).astype(float)
        F = np.vstack(Fs)
        Jv = np.vstack(Js).astype(int)
        Wv = np.vstack(Ws).astype(float)
        key = np.round(P * 1e5).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        self.V = P[first]
        self.F = inv[F]
        W = np.zeros((len(first), len(self.names)))
        for k in range(4):
            np.add.at(W, (np.arange(len(first)), Jv[first, k]), Wv[first, k])
        self.W = W / W.sum(1, keepdims=True)
        # islands
        par = np.arange(len(self.V))

        def find(a):
            while par[a] != a:
                par[a] = par[par[a]]
                a = par[a]
            return a
        for f in self.F:
            a, b, c = find(f[0]), find(f[1]), find(f[2])
            par[b] = a
            par[c] = a
        lab = np.array([find(x) for x in self.F[:, 0]])
        self.islands = {}
        for r in np.unique(lab):
            fi = np.where(lab == r)[0]
            if len(fi) < 600:
                continue
            c = self.V[self.F[fi]].reshape(-1, 3).mean(0)
            if len(fi) > 1000:
                nm = 'torso'
            elif c[1] > 1.2:
                nm = 'armL' if c[0] > 0 else 'armR'
            else:
                nm = 'legL' if c[0] > 0 else 'legR'
            self.islands[nm] = fi
        assert set(self.islands) == {'torso', 'armL', 'armR', 'legL', 'legR'}, self.islands.keys()
        self.fingers = {}  # bbox of each finger-segment island (for radii / tips)
        for r in np.unique(lab):
            fi = np.where(lab == r)[0]
            if len(fi) >= 600:
                continue
            vi = np.unique(self.F[fi])
            dom = np.bincount(np.argmax(self.W[vi], 1), minlength=len(self.names)).argmax()
            self.fingers.setdefault(self.names[dom], []).append(self.V[vi])

    def tris(self, island):
        return self.V[self.F[self.islands[island]]]

    def jp(self, name):
        return self.jpos[self.J[name]].copy()


def raycast_far(M, island, O, D):
    """Farthest hit of each ray (O + t D, t > 0) on an island. -> t (nan = miss), W (n,53) at the hit."""
    fi = M.islands[island]
    T = M.V[M.F[fi]]
    A, e1, e2 = T[:, 0], T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]
    n = len(O)
    tout = np.full(n, np.nan)
    Wout = np.zeros((n, M.W.shape[1]))
    for s in range(0, n, 256):
        o = O[s:s + 256][:, None, :]
        d = D[s:s + 256][:, None, :]
        p = np.cross(d, e2[None])
        det = (e1[None] * p).sum(-1)
        ok = np.abs(det) > 1e-12
        inv = np.where(ok, 1.0 / np.where(ok, det, 1), 0)
        tv = o - A[None]
        u = (tv * p).sum(-1) * inv
        q = np.cross(tv, e1[None])
        v = (d * q).sum(-1) * inv
        t = (e2[None] * q).sum(-1) * inv
        hit = ok & (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6) & (t > 1e-6)
        t = np.where(hit, t, -1)
        k = t.argmax(1)
        r = np.arange(len(k))
        tb = t[r, k]
        good = tb > 0
        tout[s:s + 256] = np.where(good, tb, np.nan)
        f = M.F[fi[k]]
        uu, vv = u[r, k][:, None], v[r, k][:, None]
        w = M.W[f[:, 0]] * (1 - uu - vv) + M.W[f[:, 1]] * uu + M.W[f[:, 2]] * vv
        Wout[s:s + 256] = np.where(good[:, None], w, 0)
    return tout, Wout


def _fill_nan_rows(rad, Wt):
    """Fill missed rays: round the ring first, then from the neighbouring rings."""
    R, S = rad.shape
    for r in range(R):
        bad = np.isnan(rad[r])
        if bad.any() and not bad.all():
            idx = np.arange(S)
            g = idx[~bad]
            for s in idx[bad]:
                dd = np.minimum((g - s) % S, (s - g) % S)
                j = g[dd.argmin()]
                rad[r, s] = rad[r, j]
                Wt[r, s] = Wt[r, j]
    good_rows = [r for r in range(R) if not np.isnan(rad[r]).any()]
    for r in range(R):
        if np.isnan(rad[r]).any():
            j = min(good_rows, key=lambda g: abs(g - r))
            rad[r] = rad[j]
            Wt[r] = Wt[j]


class Loft:
    """Rings cast from an axis out to the mannequin's surface: radii + the mannequin's weights there.

    centers (R,3); U, Vv = the ring plane's two unit axes (angle 0 = +U, quarter turn = +Vv);
    `smooth` passes of 1-2-1 along the axis fill the recessed joint bands (never below the raw
    surface), `wsmooth` passes do the same to the weights.
    """

    def __init__(self, M, island, centers, U, Vv, nseg, smooth=3, wsmooth=1, rmax=None, thetas=None):
        self.C = np.asarray(centers, float)
        R = len(self.C)
        th = np.arange(nseg) * 2 * np.pi / nseg if thetas is None else np.asarray(thetas, float)
        self.th = th
        self.D = np.cos(th)[:, None] * np.asarray(U, float)[None] + np.sin(th)[:, None] * np.asarray(Vv, float)[None]
        O = np.repeat(self.C, len(th), 0)
        D = np.tile(self.D, (R, 1))
        t, W = raycast_far(M, island, O, D)
        rad = t.reshape(R, len(th))
        Wt = W.reshape(R, len(th), -1)
        if rmax is not None:
            rm = np.broadcast_to(np.asarray(rmax, float).reshape(-1, 1) if np.ndim(rmax) == 1 else rmax, rad.shape)
            over = rad > rm
            rad = np.where(over, np.nan, rad)
        _fill_nan_rows(rad, Wt)
        raw = rad.copy()
        for _ in range(smooth):
            s = rad.copy()
            s[1:-1] = 0.25 * rad[:-2] + 0.5 * rad[1:-1] + 0.25 * rad[2:]
            rad = np.maximum(s, raw)
        for _ in range(wsmooth):
            s = Wt.copy()
            s[1:-1] = 0.25 * Wt[:-2] + 0.5 * Wt[1:-1] + 0.25 * Wt[2:]
            Wt = s
        self.rad = rad
        self.W = Wt / np.maximum(Wt.sum(-1, keepdims=True), 1e-9)

    def points(self, offset=0.0, scale=1.0, rows=None):
        """Grid of points (R,S,3) at radius*scale + offset; offset/scale broadcast against (R,S)."""
        off = np.broadcast_to(np.asarray(offset, float) if np.ndim(offset) != 1 else np.asarray(offset, float)[:, None], self.rad.shape)
        sc = np.broadcast_to(np.asarray(scale, float) if np.ndim(scale) != 1 else np.asarray(scale, float)[:, None], self.rad.shape)
        P = self.C[:, None, :] + self.D[None] * (self.rad * sc + off)[..., None]
        if rows is not None:
            return P[rows], self.W[rows]
        return P, self.W


# ------------------------------------------------------------------------------------------------
# chunks
# ------------------------------------------------------------------------------------------------
def chunk(V, F, W, slot, angle=180.0):
    return {'V': np.asarray(V, float).reshape(-1, 3), 'F': np.asarray(F, np.int64).reshape(-1, 3),
            'W': np.asarray(W, float), 'slot': slot, 'angle': float(angle)}


def rigid_w(n, M, joint):
    W = np.zeros((n, len(M.names)))
    W[:, M.J[joint]] = 1
    return W


def merge(chunks, slot=None, angle=None):
    Vs, Fs, Ws, o = [], [], [], 0
    for c in chunks:
        Vs.append(c['V'])
        Fs.append(c['F'] + o)
        Ws.append(c['W'])
        o += len(c['V'])
    return chunk(np.vstack(Vs), np.vstack(Fs), np.vstack(Ws), slot or chunks[0]['slot'],
                 chunks[0]['angle'] if angle is None else angle)


def outward(c, center=None):
    """Flip the whole chunk if its faces point at `center` (default: its own centroid)."""
    V, F = c['V'], c['F']
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    fc = V[F].mean(1)
    ctr = V.mean(0) if center is None else np.asarray(center, float)
    if (fn * (fc - ctr)).sum() < 0:
        c['F'] = F[:, ::-1].copy()
    return c


def grid_chunk(P, W, slot, angle=180.0, closed=True, cap0=False, cap1=False, flip=None, axis_centers=None):
    """A (R,S) grid of points -> a tube (closed round S) or a sheet; optional fan caps on either end.

    Orientation is made outward automatically (faces look away from each ring's centroid) unless
    `flip` is given."""
    R, S = P.shape[:2]
    V = P.reshape(-1, 3)
    Wf = W.reshape(R * S, -1)
    F = []
    sm = S if closed else S - 1
    r = np.arange(R - 1)[:, None]
    s = np.arange(sm)[None, :]
    a = (r * S + s).ravel()
    b = (r * S + (s + 1) % S).ravel()
    c = ((r + 1) * S + (s + 1) % S).ravel()
    d = ((r + 1) * S + s).ravel()
    F = np.concatenate([np.stack([a, b, c], 1), np.stack([a, c, d], 1)])
    extraV, extraW = [], []
    n = R * S
    for end, on in ((0, cap0), (R - 1, cap1)):
        if not on:
            continue
        extraV.append(P[end].mean(0))
        extraW.append(W[end].mean(0))
        i = n
        n += 1
        ring = end * S + np.arange(S)
        tri = np.stack([np.full(S, i), ring, np.roll(ring, -1)], 1)
        if end == 0:
            tri = tri[:, ::-1]
        F = np.concatenate([F, tri])
    if extraV:
        V = np.vstack([V, np.array(extraV)])
        Wf = np.vstack([Wf, np.array(extraW)])
    ch = chunk(V, F, Wf, slot, angle)
    if flip is None:
        ctr = P.mean(1)  # (R,3)
        tri_r = np.minimum(F.min(1) // S, R - 1)
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        fc = V[F].mean(1)
        flip = (fn * (fc - ctr[tri_r])).sum() < 0
    if flip:
        ch['F'] = ch['F'][:, ::-1].copy()
    return ch


def rot_xyz(rx=0.0, ry=0.0, rz=0.0):
    """Rotation matrix from degrees: R = Ry @ Rx @ Rz (yaw about Y, pitch about X, roll about Z)."""
    rx, ry, rz = np.radians([rx, ry, rz])
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Ry @ Rx @ Rz


def box(center, half, slot, W=None, R=None, bevel=0.0, angle=35.0, taper=None):
    """Chamfered box (bevel>0: 24 verts / 44 tris; else 8 / 12). half = half extents (x,y,z).
    taper = (sx, sz) scales the +Y face. angle 35 = flat chamfers, 180 = pillow."""
    hx, hy, hz = half
    if bevel <= 0:
        s = np.array([[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)], float)
        V = s * np.array(half)
    else:
        b = min(bevel, hx * 0.9, hy * 0.9, hz * 0.9)
        V = []
        for x in (-1, 1):
            for y in (-1, 1):
                for z in (-1, 1):
                    V.append([x * hx, y * (hy - b), z * (hz - b)])
                    V.append([x * (hx - b), y * hy, z * (hz - b)])
                    V.append([x * (hx - b), y * (hy - b), z * hz])
        V = np.array(V, float)
    if taper is not None:
        k = (V[:, 1] / hy + 1) / 2
        V[:, 0] *= 1 + (taper[0] - 1) * k
        V[:, 2] *= 1 + (taper[1] - 1) * k
    # faces = convex hull (small: brute force)
    F = _hull(V)
    if R is not None:
        V = V @ np.asarray(R, float).T
    V = V + np.asarray(center, float)
    return chunk(V, F, W if W is not None else np.zeros((len(V), 1)), slot, angle)


def _hull(V):
    """Convex hull triangles of a small point set, outward CCW (brute force over planes)."""
    n = len(V)
    c = V.mean(0)
    planes = {}
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                nr = np.cross(V[j] - V[i], V[k] - V[i])
                l = np.linalg.norm(nr)
                if l < 1e-12:
                    continue
                nr = nr / l
                d = (V - V[i]) @ nr
                if d.max() > 1e-7 and d.min() < -1e-7:
                    continue
                if d.max() > 1e-7:
                    nr = -nr
                key = tuple(np.round(np.append(nr, nr @ V[i]), 5))
                if key in planes:
                    continue
                on = np.where(np.abs((V - V[i]) @ nr) < 1e-7)[0]
                planes[key] = (nr, on)
    F = []
    for nr, on in planes.values():
        ctr = V[on].mean(0)
        u = norm(V[on[0]] - ctr)
        w = np.cross(nr, u)
        ang = np.arctan2((V[on] - ctr) @ w, (V[on] - ctr) @ u)
        order = on[np.argsort(ang)]
        for t in range(1, len(order) - 1):
            F.append([order[0], order[t], order[t + 1]])
    return np.array(F)


def ellipsoid(center, radii, slot, W=None, R=None, nu=10, nv=6, angle=180.0, vmin=-90.0, vmax=90.0):
    """UV ellipsoid; poles on Y. vmin/vmax (deg latitude) cut it to a dome/band (open edges uncapped)."""
    lats = np.radians(np.linspace(vmin, vmax, nv + 1))
    V, rings = [], []
    for la in lats:
        if abs(abs(la) - np.pi / 2) < 1e-6:
            rings.append([len(V)])
            V.append([0, np.sin(la), 0])
        else:
            st = len(V)
            for k in range(nu):
                lo = 2 * np.pi * k / nu
                V.append([np.cos(la) * np.sin(lo), np.sin(la), np.cos(la) * np.cos(lo)])
            rings.append(list(range(st, st + nu)))
    F = []
    for a, b in zip(rings[:-1], rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for k in range(nu):
            k2 = (k + 1) % nu
            if len(a) == 1:
                F.append([a[0], b[k2], b[k]])
            elif len(b) == 1:
                F.append([a[k], a[k2], b[0]])
            else:
                F.append([a[k], a[k2], b[k2]])
                F.append([a[k], b[k2], b[k]])
    V = np.array(V) * np.array(radii)
    if R is not None:
        V = V @ np.asarray(R, float).T
    V = V + np.asarray(center, float)
    return chunk(V, np.array(F), W if W is not None else np.zeros((len(V), 1)), slot, angle)


def tube(points, radii, slot, W=None, nseg=6, angle=180.0, cap0=True, cap1=True, up=(0, 1, 0), squash=1.0, Wring=None):
    """Tube along a polyline (parallel-transport frames). radii per point; squash scales the 2nd axis.
    Wring = (len(points), NJ) per-ring weights (else W for everybody)."""
    P = np.asarray(points, float)
    n = len(P)
    radii = np.broadcast_to(np.asarray(radii, float), (n,))
    tang = np.zeros_like(P)
    tang[1:-1] = norm(P[2:] - P[:-2])
    tang[0] = norm(P[1] - P[0])
    tang[-1] = norm(P[-1] - P[-2])
    u = np.asarray(up, float)
    if abs(u @ tang[0]) > 0.95:
        u = np.array([1.0, 0, 0]) if abs(tang[0][0]) < 0.9 else np.array([0, 0, 1.0])
    a = norm(np.cross(u, tang[0]))
    G = np.zeros((n, nseg, 3))
    th = np.arange(nseg) * 2 * np.pi / nseg
    for i in range(n):
        a = norm(a - (a @ tang[i]) * tang[i])
        b = np.cross(tang[i], a)
        G[i] = P[i] + radii[i] * (np.cos(th)[:, None] * a + squash * np.sin(th)[:, None] * b)
    NJ = (W.shape[1] if W is not None else Wring.shape[1])
    if Wring is not None:
        Wg = np.repeat(np.asarray(Wring, float)[:, None, :], nseg, 1)
    else:
        Wg = np.broadcast_to(W[0], (n, nseg, NJ)).copy()
    return grid_chunk(G, Wg, slot, angle, True, cap0, cap1)


def with_w(c, W):
    c['W'] = np.broadcast_to(W[:1], (len(c['V']), W.shape[1])).copy() if len(W) != len(c['V']) else W
    return c


def nearest_weights(P, srcV, srcW, k=4):
    """Weight transfer: inverse-distance blend of the k nearest source vertices."""
    P = np.asarray(P, float)
    out = np.zeros((len(P), srcW.shape[1]))
    for s in range(0, len(P), 512):
        d = np.linalg.norm(P[s:s + 512, None, :] - srcV[None], axis=-1)
        idx = np.argpartition(d, k, 1)[:, :k]
        dd = np.take_along_axis(d, idx, 1)
        w = 1.0 / (dd + 1e-4) ** 2
        w /= w.sum(1, keepdims=True)
        out[s:s + 512] = (srcW[idx] * w[..., None]).sum(1)
    return out


def xform(c, R=None, t=None, scale=None, about=None):
    V = c['V']
    o = np.zeros(3) if about is None else np.asarray(about, float)
    V = V - o
    if scale is not None:
        V = V * np.asarray(scale, float)
    if R is not None:
        V = V @ np.asarray(R, float).T
    V = V + o
    if t is not None:
        V = V + np.asarray(t, float)
    c['V'] = V
    return c


def mirror_x(c, M):
    """Mirror a chunk across X=0, swapping .L/.R joint weights and the winding."""
    perm = np.arange(len(M.names))
    for i, n in enumerate(M.names):
        if n.endswith('.L'):
            perm[i] = M.J[n[:-2] + '.R']
        elif n.endswith('.R'):
            perm[i] = M.J[n[:-2] + '.L']
    W = np.zeros_like(c['W'])
    W[:, perm] = c['W']
    return chunk(c['V'] * np.array([-1, 1, 1]), c['F'][:, ::-1], W, c['slot'], c['angle'])


# ------------------------------------------------------------------------------------------------
# finishing: weld, drop degenerates, split normals, top-4 weights
# ------------------------------------------------------------------------------------------------
def finish(c):
    """-> dict(P f32, N f32, J u8 (n,4), W f32 (n,4), I u32 (m,3))"""
    V, F, W = c['V'], c['F'], c['W']
    key = np.round(V * 2e5).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    V, W, F = V[first], W[first], inv[F]
    ok = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    F = F[ok]
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    area2 = np.linalg.norm(fn, axis=1)
    ok = area2 > 2e-9
    F, fn, area2 = F[ok], fn[ok], area2[ok]
    fu = fn / area2[:, None]
    # angle-weighted corner normals within the smoothing angle
    e = [norm(V[F[:, (k + 1) % 3]] - V[F[:, k]]) for k in range(3)]
    cang = [np.arccos(np.clip((e[k] * -e[(k + 2) % 3]).sum(1), -1, 1)) for k in range(3)]
    cosT = np.cos(np.radians(min(c['angle'], 179.9)))
    nc = len(F) * 3
    cv = F.ravel()                      # corner -> vertex   (corner = f*3+k)
    cf = np.repeat(np.arange(len(F)), 3)
    cw = np.stack(cang, 1).ravel()
    order = np.argsort(cv, kind='stable')
    starts = np.searchsorted(cv[order], np.arange(len(V) + 1))
    N = np.zeros((nc, 3))
    if c['angle'] >= 179.9:
        vn = np.zeros((len(V), 3))
        np.add.at(vn, cv, fu[cf] * cw[:, None])
        N = norm(vn)[cv]
    else:
        for v in range(len(V)):
            cs = order[starts[v]:starts[v + 1]]
            if len(cs) == 0:
                continue
            fs = cf[cs]
            dots = fu[fs] @ fu[fs].T
            contrib = fu[fs] * cw[cs][:, None]
            N[cs] = norm((dots >= cosT).astype(float) @ contrib)
    bad = ~np.isfinite(N).all(1) | (np.linalg.norm(N, axis=1) < 0.5)
    N[bad] = fu[cf[bad]]
    # split verts by (vertex, normal)
    nk = np.round(N * 512).astype(np.int64)
    key = np.concatenate([cv[:, None], nk], 1)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    P = V[cv[first]]
    Nn = N[first]
    Wd = W[cv[first]]
    I = inv.reshape(-1, 3)
    # top-4 weights
    Wd = np.where(Wd < 0.01, 0, Wd)
    idx = np.argsort(-Wd, 1)[:, :4]
    w4 = np.take_along_axis(Wd, idx, 1)
    assert (w4.sum(1) > 0).all(), 'unweighted vertex in slot ' + c['slot']
    w4 = w4 / w4.sum(1, keepdims=True)
    idx = np.where(w4 > 0, idx, 0)
    w4 = w4.astype(np.float32)
    w4[:, 0] += 1 - w4.sum(1)           # exact normalisation in f32
    return {'P': P.astype(np.float32), 'N': Nn.astype(np.float32), 'J': idx.astype(np.uint8), 'W': w4,
            'I': I.astype(np.uint32)}


def write_gltf(M, parts, variants, path=OUT, extra=None):
    """parts: [(name, [chunks])]; variants: {name: {'side':…, 'parts': […]}}"""
    g = M.gltf
    blob = bytearray()
    views, accs, meshes, nodes = [], [], [], []

    def add(arr, target=None, minmax=False, typ=None):
        while len(blob) % 4:
            blob.append(0)
        off = len(blob)
        blob.extend(arr.tobytes())
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes}
        if target:
            v['target'] = target
        views.append(v)
        ct = {np.dtype('float32'): 5126, np.dtype('uint8'): 5121, np.dtype('uint16'): 5123, np.dtype('uint32'): 5125}[arr.dtype]
        a = {'bufferView': len(views) - 1, 'componentType': ct, 'count': int(arr.shape[0]),
             'type': typ or {1: 'SCALAR', 3: 'VEC3', 4: 'VEC4', 16: 'MAT4'}[1 if arr.ndim == 1 else arr.shape[1]]}
        if minmax:
            a['min'] = [float(x) for x in arr.min(0)]
            a['max'] = [float(x) for x in arr.max(0)]
        accs.append(a)
        return len(accs) - 1

    # skeleton: the mannequin's joint nodes, verbatim (names / TRS / hierarchy)
    old2new = {}
    order = []

    def walk(i):
        old2new[i] = len(order)
        order.append(i)
        for ch in g['nodes'][i].get('children', []):
            if 'mesh' not in g['nodes'][ch]:
                walk(ch)
    rig = next(i for i, n in enumerate(g['nodes']) if n['name'] == 'Rig')
    walk(rig)
    for i in order:
        src = g['nodes'][i]
        n = {'name': src['name']}
        for k in ('translation', 'rotation', 'scale'):
            if k in src:
                n[k] = src[k]
        ch = [old2new[c] for c in src.get('children', []) if c in old2new]
        if ch:
            n['children'] = ch
        nodes.append(n)
    ibm = add(M.ibm.reshape(-1, 16).astype(np.float32), typ='MAT4')
    skin = {'name': 'Rig', 'joints': [old2new[j] for j in M.joint_nodes], 'inverseBindMatrices': ibm}
    mats = []
    for s in SLOTS:
        rgb, ro, me = SLOT_PREVIEW[s]
        mats.append({'name': s, 'pbrMetallicRoughness': {'baseColorFactor': [*rgb, 1.0], 'roughnessFactor': ro, 'metallicFactor': me}})
    scene_nodes = [0]
    stats = {}
    for name, chunks in parts:
        byslot = {}
        for c in chunks:
            byslot.setdefault(c['slot'], []).append(c)
        prims = []
        tris = verts = 0
        for s in SLOTS:
            if s not in byslot:
                continue
            fins = [finish(c) for c in byslot[s]]
            o = 0
            Is = []
            for f in fins:
                Is.append(f['I'] + o)
                o += len(f['P'])
            P = np.vstack([f['P'] for f in fins])
            N = np.vstack([f['N'] for f in fins])
            Jn = np.vstack([f['J'] for f in fins])
            Wn = np.vstack([f['W'] for f in fins])
            I = np.vstack(Is).ravel()
            I = I.astype(np.uint16) if len(P) < 65535 else I.astype(np.uint32)
            prims.append({'attributes': {'POSITION': add(P, 34962, True), 'NORMAL': add(N, 34962),
                                         'JOINTS_0': add(Jn, 34962), 'WEIGHTS_0': add(Wn, 34962)},
                          'indices': add(I, 34963), 'material': SLOTS.index(s), 'mode': 4})
            tris += len(I) // 3
            verts += len(P)
        assert not set(byslot) - set(SLOTS), set(byslot) - set(SLOTS)
        meshes.append({'name': name, 'primitives': prims})
        nodes.append({'name': name, 'mesh': len(meshes) - 1, 'skin': 0})
        scene_nodes.append(len(nodes) - 1)
        stats[name] = (tris, verts)
    out = {
        'asset': {'version': '2.0', 'generator': 'twopointsix tools/chars/build_cast.py'},
        'scene': 0, 'scenes': [{'name': 'cast', 'nodes': scene_nodes}],
        'nodes': nodes, 'meshes': meshes, 'materials': mats, 'skins': [skin],
        'accessors': accs, 'bufferViews': views,
        'buffers': [{'byteLength': len(blob), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(blob)).decode()}],
        'extras': {'cast': {'version': 1, 'variants': variants, **(extra or {})}},
    }
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path + '.tmp', 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    os.replace(path + '.tmp', path)      # the file on disk is always a whole one
    return stats


# ------------------------------------------------------------------------------------------------
# master lofts: one dense, band-free radius field per island that every garment samples
# ------------------------------------------------------------------------------------------------
class Master:
    """Dense rings (every `step` m along parameter t) cast onto one mannequin island.

    The radii are smoothed along t by ~sigma metres (never below the raw surface), which fills the
    mannequin's recessed joint bands; weights are the mannequin's own at each hit point, lightly
    smoothed.  Garments sample it at any (t, theta) with an offset, so layers never cross.
    """

    def __init__(self, M, island, center_fn, t0, t1, U, Vv, nseg, step=0.01, sigma=0.03, wsigma=0.012):
        self.ts = np.arange(t0, t1 + 1e-9, step)
        self.center_fn = center_fn
        C = center_fn(self.ts)
        L = Loft(M, island, C, U, Vv, nseg, smooth=0, wsmooth=0)
        self.th, self.D, self.C = L.th, L.D, C
        raw = L.rad.copy()
        rad = raw.copy()
        for _ in range(int(round(2 * (sigma / step) ** 2))):
            s = rad.copy()
            s[1:-1] = 0.25 * rad[:-2] + 0.5 * rad[1:-1] + 0.25 * rad[2:]
            rad = np.maximum(s, raw)
        # a light pass round the ring too
        rad = 0.25 * np.roll(rad, 1, 1) + 0.5 * rad + 0.25 * np.roll(rad, -1, 1)
        self.rad = np.maximum(rad, raw * 0.97)
        W = L.W.copy()
        for _ in range(int(round(2 * (wsigma / step) ** 2))):
            s = W.copy()
            s[1:-1] = 0.25 * W[:-2] + 0.5 * W[1:-1] + 0.25 * W[2:]
            W = s
        self.W = W / W.sum(-1, keepdims=True)
        self.nseg = nseg

    def _rows(self, t):
        t = np.clip(np.asarray(t, float), self.ts[0], self.ts[-1])
        f = (t - self.ts[0]) / (self.ts[1] - self.ts[0])
        i = np.minimum(f.astype(int), len(self.ts) - 2)
        return i, (f - i)

    def sample(self, t, off=0.0, scale=1.0):
        """t (R,) -> P (R,S,3), W (R,S,NJ). off / scale: scalar, (R,), or (R,S)."""
        t = np.asarray(t, float)
        i, a = self._rows(t)
        rad = self.rad[i] * (1 - a)[:, None] + self.rad[i + 1] * a[:, None]
        W = self.W[i] * (1 - a)[:, None, None] + self.W[i + 1] * a[:, None, None]
        C = self.center_fn(t)

        def bc(x):
            x = np.asarray(x, float)
            return x[:, None] if x.ndim == 1 else x
        P = C[:, None, :] + self.D[None] * (rad * bc(scale) + bc(off))[..., None]
        return P, W

    def at(self, t, theta, off=0.0):
        """Arbitrary (t, theta[rad]) samples -> P (n,3), W (n,NJ)."""
        t = np.atleast_1d(np.asarray(t, float))
        theta = np.broadcast_to(np.asarray(theta, float), t.shape)
        off = np.broadcast_to(np.asarray(off, float), t.shape)
        i, a = self._rows(t)
        S = self.nseg
        fs = (theta % (2 * np.pi)) / (2 * np.pi) * S
        s0 = np.floor(fs).astype(int) % S
        b = fs - np.floor(fs)
        s1 = (s0 + 1) % S

        def bl(A):
            ex = (lambda x: x[:, None]) if A.ndim == 3 else (lambda x: x)
            return (A[i, s0] * ex((1 - a) * (1 - b)) + A[i + 1, s0] * ex(a * (1 - b))
                    + A[i, s1] * ex((1 - a) * b) + A[i + 1, s1] * ex(a * b))
        rad = bl(self.rad)
        W = bl(self.W)
        U, Vv = self.D[0], self.D[S // 4] if S % 4 == 0 else None
        d = np.cos(theta)[:, None] * self.D[0][None] + np.sin(theta)[:, None] * self._v()[None]
        P = self.center_fn(t) + d * (rad + off)[:, None]
        return P, W / W.sum(-1, keepdims=True)

    def _v(self):
        # second ring axis, recovered from two ring directions
        th1 = self.th[1]
        return (self.D[1] - np.cos(th1) * self.D[0]) / np.sin(th1)

    def radius(self, t, theta):
        t = np.atleast_1d(np.asarray(t, float))
        theta = np.broadcast_to(np.asarray(theta, float), t.shape)
        P, _ = self.at(t, theta, 0.0)
        return np.linalg.norm(P - self.center_fn(t), axis=1)


def folds(R, S, amp, seed, kt=2.0, ks=3):
    """Low-frequency lumps for cloth offsets, (R,S), in [-amp, amp]."""
    rng = np.random.RandomState(seed)
    r = np.linspace(0, 1, R)[:, None]
    s = np.arange(S)[None, :] * 2 * np.pi / S
    out = np.zeros((R, S))
    for k in range(3):
        a, b = rng.uniform(0, 2 * np.pi, 2)
        out += np.sin(s * rng.randint(1, ks + 1) + a + r * rng.uniform(-3, 3)) * np.sin(r * np.pi * kt * rng.uniform(0.6, 1.6) + b)
    return out * amp / 3.0


def strap(mast, path, width, off_in, off_out, slot, angle=30.0):
    """A flat band laid on a Master surface along path = [(t, theta_deg), ...] (soft: master weights)."""
    path = np.asarray(path, float)
    t, th = path[:, 0], np.radians(path[:, 1])
    r = np.maximum(mast.radius(t, th) + off_out, 0.02)
    # width direction: perpendicular to the path in (t, arc) space
    dt = np.gradient(t)
    da = np.gradient(th) * r
    l = np.maximum(np.hypot(dt, da), 1e-9)
    wt, wa = -da / l * width / 2, dt / l * width / 2
    rows_P, rows_W = [], []
    for sgn, off in ((-1, off_in), (-1, off_out), (1, off_out), (1, off_in)):
        P, W = mast.at(t + sgn * wt, th + sgn * wa / r, off)
        rows_P.append(P)
        rows_W.append(W)
    P = np.stack(rows_P, 1)
    W = np.stack(rows_W, 1)
    return grid_chunk(P, W, slot, angle, True, True, True)
