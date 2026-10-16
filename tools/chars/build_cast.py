#!/usr/bin/env python3
"""Builds public/assets/chars/cast.gltf from the mannequin alone (pure numpy; no Blender).

    python3 tools/chars/build_cast.py            # writes the asset, prints the part / variant table

Method (see README.md): every garment is a LOFT of rings cast from a limb's axis out to the
mannequin's own surface (kit.Master) and pushed out by a per-ring offset, so it carries the
mannequin's skin weights at the very points it was cast from; the head is a new parametric surface
(head.py) rigid on DEF-head; hard gear is bevelled solids rigid on one joint each.
"""
import sys

import numpy as np

import head as H
from kit import (Mannequin, Master, box, chunk, ellipsoid, folds, grid_chunk, merge, mirror_x, norm,
                 nearest_weights, outward, raycast_far, rigid_w, rot_xyz, strap, tube, write_gltf, xform, OUT)

M = Mannequin()
NJ = len(M.names)
CM = 0.01
D2R = np.pi / 180


def Wj(joint):
    w = np.zeros(NJ)
    w[M.J[joint]] = 1
    return w


def rig(c, joint):
    c['W'] = rigid_w(len(c['V']), M, joint)
    return c


def both(chunks):
    """left-side chunks -> left + mirrored right"""
    chunks = chunks if isinstance(chunks, list) else [chunks]
    return chunks + [mirror_x(c, M) for c in chunks]


# ------------------------------------------------------------------------------------------------
# masters
# ------------------------------------------------------------------------------------------------
def leg_center(y):
    y = np.asarray(y, float)
    z = np.interp(y, [0, .03, .06, .085, .115, .532, .932, 1.0], [.035, .035, .02, -.01, -.03, -.001, .001, .001])
    return np.stack([np.full_like(y, 0.089), y, z], -1)


def arm_center(x):
    x = np.asarray(x, float)
    return np.stack([x, np.full_like(x, 1.441), np.interp(x, [.192, .466, .739], [-.065, -.07, -.065])], -1)


def torso_center(y):
    y = np.asarray(y, float)
    return np.stack([0 * y, y, 0 * y], -1)


LEG = Master(M, 'legL', leg_center, 0.004, 1.0, (0, 0, 1), (1, 0, 0), 14, sigma=0.025)      # th 0 front, 90 outer
ARM = Master(M, 'armL', arm_center, 0.13, 0.76, (0, 1, 0), (0, 0, 1), 12, sigma=0.03)       # th 0 up, 90 front
TORSO = Master(M, 'torso', torso_center, 0.848, 1.66, (0, 0, 1), (1, 0, 0), 24, sigma=0.035)  # th 0 front, 90 left


def _neck_master():
    """The torso master with the mannequin's bull neck and jaw cut back to a human neck above 1.49."""
    import copy
    N = copy.copy(TORSO)
    rad = TORSO.rad.copy()
    c, s = np.cos(TORSO.th), np.sin(TORSO.th)
    neck = 1.0 / np.sqrt((c / np.where(c >= 0, 0.040, 0.076)) ** 2 + (s / 0.056) ** 2)
    for i, y in enumerate(TORSO.ts):
        if y > 1.49:
            lim = neck + max(0.0, (1.555 - y) / 0.065) * 0.14
            rad[i] = np.minimum(rad[i], lim)
        if y > 1.60:
            rad[i] = np.minimum(rad[i], neck * 0.92)
    N.rad = rad
    return N


NECK = _neck_master()
TH_T = TORSO.th
TH_L = LEG.th
TH_A = ARM.th


# ------------------------------------------------------------------------------------------------
# builds: more than one body on the one skeleton
# ------------------------------------------------------------------------------------------------
# The mannequin is a bodybuilder (chest half-width 17 cm over a 12 cm waist, upper arms 13 cm through, calves to match) and every
# garment is a loft off its surface, so every man WAS that one body. A BUILD scales the masters' radii per height and angle (the
# skin weights at each ray are untouched: a thinner arm bends exactly as the thick one did), and a part is built inside the build
# it belongs to: `with BUILD['big']: part()`. Joints do not move, so height and limb lengths are everybody's; girth, taper, belly,
# bust and limb thickness are not. Above y 1.43 the torso is nobody's to scale: the head part's neck tube (one for all) starts there.
def win(t, lo, hi, ramp):
    """0 outside [lo, hi], 1 from lo + ramp to hi - ramp, linear between."""
    t = np.asarray(t, float)
    return np.clip((t - lo) / ramp, 0, 1) * np.clip((hi - t) / ramp, 0, 1)


def _side(th):
    return np.sin(th) ** 2


def _front(th):
    return np.clip(np.cos(th), 0, 1) ** 2


def _back(th):
    return np.clip(-np.cos(th), 0, 1) ** 2


class Build:
    def __init__(self, torso=None, arm=None, leg=None, base=None):
        self.fns = {'torso': torso, 'arm': arm, 'leg': leg}
        self.base = base

    def scale(self, which, t, th):
        k = self.base.scale(which, t, th) if self.base else np.ones(np.broadcast(t, th).shape)
        f = self.fns[which]
        return k * f(t, th) if f else k

    def __enter__(self):
        self.saved = [(m, m.rad.copy()) for m in (TORSO, NECK, ARM, LEG)]
        for m, which in ((TORSO, 'torso'), (NECK, 'torso'), (ARM, 'arm'), (LEG, 'leg')):
            m.rad[:] = RAW[id(m)] * self.scale(which, m.ts[:, None], m.th[None, :])
        return self

    def __exit__(self, *a):
        for m, r in self.saved:
            m.rad[:] = r


RAW = {id(m): m.rad.copy() for m in (TORSO, NECK, ARM, LEG)}
_TOP = lambda y: np.clip((1.435 - y) / 0.04, 0, 1)      # nothing above the shoulder line

# an ordinary fit man: the lats and the pecs' flare taken in, the waist let out (the V goes from 1.40 to 1.22), arms 10.5 cm
# through instead of 13, thighs and calves a size down. Everything that names no build is built on him.
HUMAN = Build(
    torso=lambda y, th: 1 + _TOP(y) * (-0.085 * win(y, 1.19, 1.47, 0.07) * _side(th) + 0.065 * win(y, 1.00, 1.24, 0.06) * _side(th)
                                       - 0.05 * win(y, 1.26, 1.47, 0.06) * _back(th)),
    arm=lambda x, th: 1 - 0.19 * win(x, 0.15, 0.71, 0.07) - 0.05 * win(x, 0.14, 0.27, 0.04) * np.clip(np.cos(th), 0, 1),
    leg=lambda y, th: 1 - 0.07 * win(y, 0.50, 0.99, 0.10) - 0.10 * win(y, 0.14, 0.50, 0.08))
BUILD = {
    'human': HUMAN,
    # lean and long-armed: the tank top's man
    'wiry': Build(base=HUMAN,
                  torso=lambda y, th: 1 - _TOP(y) * 0.05 * win(y, 1.06, 1.47, 0.08) * (_side(th) + 0.5 * _front(th)),
                  arm=lambda x, th: 1 - 0.13 * win(x, 0.21, 0.71, 0.09)),
    # a big man: a belly that carries the tee out over the belt, a thick waist, heavy arms
    'big': Build(base=HUMAN,
                 torso=lambda y, th: 1 + _TOP(y) * (0.30 * np.exp(-((y - 1.12) / 0.13) ** 2) * np.clip(np.cos(th), 0, 1) ** 1.5
                                                    + 0.15 * win(y, 0.93, 1.43, 0.10) * _side(th) + 0.08 * win(y, 1.00, 1.43, 0.10) * _back(th)),
                 arm=lambda x, th: 1 + 0.17 * win(x, 0.15, 0.71, 0.07)),
    # the cleaner: a woman. Rib cage and waist in, hips out, a bust, slim arms and legs
    'woman': Build(base=HUMAN,
                   torso=lambda y, th: 1 + _TOP(y) * (-0.12 * win(y, 1.04, 1.47, 0.07) * _side(th) + 0.05 * win(y, 0.86, 1.04, 0.05) * _side(th)
                                                      - 0.07 * win(y, 1.02, 1.24, 0.06) * _front(th) - 0.06 * win(y, 1.20, 1.47, 0.07) * _back(th)
                                                      + 0.13 * np.exp(-((y - 1.315) / 0.055) ** 2) * np.exp(-((np.abs((th + np.pi) % (2 * np.pi) - np.pi) - 0.55) / 0.42) ** 2)),
                   arm=lambda x, th: 1 - 0.17 * win(x, 0.15, 0.71, 0.07) - 0.09 * win(x, 0.10, 0.26, 0.05),
                   leg=lambda y, th: 1 - 0.05 * win(y, 0.14, 0.80, 0.10)),
}
HUMAN.__enter__()      # the masters ARE the ordinary man from here on; a named build swaps its own radii in and back


def built(name, fn):
    def f():
        with BUILD[name]:
            return fn()
    return f


def tube_of(mast, ts, off, slot, angle=60.0, cap0=False, cap1=False, fold=0.0, seed=0, clampx=None, scale=1.0, hang=None, rmin=None, tail=False, over_legs=None, cols=None):
    """over_legs = cm (or (cm, mask(S,))): rows below hang[0] stay outside both thighs + that margin.
    hang = (lo, hi): rows outside that range take the ring at the range's end (a shirt tail hangs
    as a tube instead of following the pelvis in). rmin: a floor on the ring radius (boot shafts)."""
    ts = np.asarray(ts, float)
    off = np.asarray(off, float) * CM
    off2 = off[:, None] + np.zeros((1, mast.nseg)) if off.ndim == 1 else off
    o = off2 + (folds(len(ts), mast.nseg, fold * CM, seed) if fold else 0)
    if fold:  # keep the two end rows (rims) unfolded
        o[0] = off2[0]
        o[-1] = off2[-1]
    tt = ts if hang is None else np.clip(ts, hang[0], hang[1])
    P, W = mast.sample(tt, o, scale)
    if hang is not None:
        P = P + (mast.center_fn(ts) - mast.center_fn(tt))[:, None, :]
    if over_legs is not None and hang is not None:
        clear, mask = over_legs if isinstance(over_legs, tuple) else (over_legs, None)
        for i in np.where(ts < hang[0] - 1e-6)[0]:
            C = mast.center_fn(ts[i:i + 1])[0]
            r = ((P[i] - C) * mast.D).sum(-1)
            need = leg_envelope(ts[i], C, mast.D) + clear * CM
            if mast is TORSO:      # and outside the seat of the trousers under it
                P2, _ = mast.sample(ts[i:i + 1], (clear + 2.0) * CM)
                need = np.maximum(need, ((P2[0] - C) * mast.D).sum(-1))
            rn = np.maximum(r, need) if mask is None else np.where(mask, np.maximum(r, need), r)
            if i == 0 and len(ts) > 1 and abs(ts[1] - ts[0]) < 1e-6:      # the tucked rim row keeps its lip
                rn = r + np.maximum(need - ((P[1] - C) * mast.D).sum(-1), 0) if mask is None else r
            P[i] = C + mast.D * rn[:, None]
    if rmin is not None:
        rm = np.broadcast_to(np.asarray(rmin, float), (len(ts),))
        ctr = P.mean(1, keepdims=True)
        d = P - ctr
        l = np.linalg.norm(d, axis=-1, keepdims=True)
        P = ctr + d / np.maximum(l, 1e-6) * np.maximum(l, rm[:, None, None])
    if clampx is not None:
        P[..., 0] = np.maximum(P[..., 0], clampx)
    if tail:
        W = tail_weights(P, W)
    tube_of.last, tube_of.lastW = P, W      # the grid as built (trousers() reads the legs' rings back, sleeve() its own)
    if cols is not None:      # a sheet: only these columns of the tube (an apron's panel, a bib)
        return grid_chunk(P[:, cols], W[:, cols], slot, angle, False)
    return grid_chunk(P, W, slot, angle, True, cap0, cap1)


def leg_envelope(y, C, D, off_cm=3.0):
    """Support distance of both trouser legs at height y from C along each horizontal direction D (S,3)."""
    P, _ = LEG.sample([min(y, 0.995)], off_cm * CM)
    pts = np.maximum(P[0], [0.004, -9, -9])
    pts = np.vstack([pts, pts * [-1, 1, 1]])
    return ((pts[None] - C[None, None]) * D[:, None, :]).sum(-1).max(1)


def top_y(x, z):
    """Height of the dressed body's top surface over (x, z): the shoulders / neck root as the NECK master has them."""
    for y in np.arange(1.62, 1.38, -0.002):
        c = torso_center(np.array([y]))[0]
        dx, dz = x - c[0], z - c[2]
        if NECK.radius(np.array([y]), np.array([np.arctan2(dx, dz)]))[0] >= np.hypot(dx, dz):
            return float(y)
    return 1.38


def band3d(pts, normals, width, thick, slot, lift=0.0, angle=40.0, joint=None, weights=None):
    """A flat strap along a 3D polyline; normals = outward direction at each point. weights = (n, NJ): each cross-section
    takes its centre point's weights whole (the cloth master's under it), so the strap rides the garment it lies on and a
    section never shears; without it every vertex takes the nearest BODY vertex's, which over a shoulder is sometimes the arm's."""
    p = np.asarray(pts, float)
    n = norm(np.asarray(normals, float))
    p = p + n * lift
    tg = norm(np.gradient(p, axis=0))
    sd = norm(np.cross(tg, n))
    n = norm(np.cross(sd, tg))
    h = width / 2
    P = np.stack([p - sd * h, p - sd * h + n * thick, p + sd * h + n * thick, p + sd * h], 1)
    if weights is not None:
        W = np.repeat(np.asarray(weights, float)[:, None, :], 4, 1)
    else:
        W = nearest_weights(P.reshape(-1, 3), M.V, M.W).reshape(P.shape[0], 4, -1)
    c = grid_chunk(P, W, slot, angle, True, True, True)
    return rig(c, joint) if joint else c


def tpath(spec, off_cm):
    """[(y, theta_deg) | (y, theta_deg, own_off_cm) | ('top', x, z)] -> points, outward normals on the torso."""
    pts, nrm = [], []
    for e in spec:
        if e[0] == 'top':
            y = top_y(e[1], e[2])
            pts.append([e[1], y + off_cm * CM, e[2]])
            nrm.append([0.25 * np.sign(e[1]), 1, 0])
        else:
            o = e[2] if len(e) > 2 else off_cm
            p, _ = on(TORSO, e[0], e[1], o)
            c = torso_center(np.array([e[0]]))[0]
            pts.append(p)
            rad = norm((p - c) * [1, 0, 1])
            if len(e) > 2:
                # the surface's own normal (a strap lies flat on the back, which does not face radially near the spine)
                du = on(TORSO, e[0], e[1] + 5, o)[0] - on(TORSO, e[0], e[1] - 5, o)[0]
                dv = on(TORSO, e[0] + 0.02, e[1], o)[0] - on(TORSO, e[0] - 0.02, e[1], o)[0]
                sn = norm(np.cross(du, dv))
                if sn @ rad < 0:
                    sn = -sn
                rad = norm(sn + 0.25 * rad)
            nrm.append(rad)
    return np.array(pts), np.array(nrm)


def th_x(y, x, back=False):
    """The torso angle (deg, his left) at height y whose surface point stands x off the midline: a strap that climbs to the
    shoulder keeps its distance from the neck, which a constant angle does not (the chest narrows into the neck)."""
    ths = np.arange(92, 180, 1.0) if back else np.arange(88, 0, -1.0)
    xs = np.array([on(TORSO, y, t, 0)[0][0] for t in ths])
    assert np.min(np.abs(xs - abs(x))) < 0.01, 'th_x(): the torso is not %.3f m wide at y %.3f' % (abs(x), y)
    return float(ths[np.argmin(np.abs(xs - abs(x)))]) * np.sign(x)


def top_path(x, zs, off_cm):
    """Points over the shoulder at x for each z, off_cm above the body's top surface, with that surface's own normal."""
    pts, nrm = [], []
    for z in zs:
        pts.append([x, top_y(x, z), z])
        dx = (top_y(x + 0.02 * np.sign(x), z) - top_y(x - 0.02 * np.sign(x), z)) / (0.04 * np.sign(x))
        dz = (top_y(x, z + 0.02) - top_y(x, z - 0.02)) / 0.04
        nrm.append(norm(np.array([-dx, 1.0, -dz])))
    pts, nrm = np.array(pts), np.array(nrm)
    return pts + nrm * off_cm * CM, nrm


def surf(mast, y, th_deg, off_cm):
    """A point on a master, off_cm out, with the surface's own outward normal and the master's weights there."""
    p, w = on(mast, y, th_deg, off_cm)
    du = on(mast, y, th_deg + 5, off_cm)[0] - on(mast, y, th_deg - 5, off_cm)[0]
    dv = on(mast, y + 0.012, th_deg, off_cm)[0] - on(mast, y - 0.012, th_deg, off_cm)[0]
    n = norm(np.cross(du, dv))
    out = (p - mast.center_fn(np.array([y]))[0]) * [1, 0, 1]
    if n @ (norm(out) + [0, 0.5, 0]) < 0:
        n = -n
    return p, n, w


def neck_th(y, x, back):
    """The NECK master's angle (deg, 0 front, 90 his left) at height y where its bare surface stands x off the midline, on
    the front or the back half; None where the shoulder is narrower than that (above its top there)."""
    ths = np.arange(0.0, 180.5, 1.0)
    xs = NECK.at(np.full(len(ths), y), ths * D2R, 0.0)[0][:, 0]
    ok = np.where(xs >= x)[0]
    if len(ok) == 0:
        return None
    i = ok[-1] if back else ok[0]
    j = i + 1 if back else i - 1
    th = ths[i]
    if 0 <= j < len(ths) and xs[j] < x:
        th = ths[j] + (ths[i] - ths[j]) * (x - xs[j]) / (xs[i] - xs[j])
    return float(th)


def over_shoulder(sx, xf, xb, y0, y1, off_cm, front=(), back=(), step=0.012):
    """A strap's centreline over one shoulder (sx = +1 his left): up the front of the NECK master from y0 at xf(y) off the
    midline, over the top of the shoulder where the body is exactly that wide, down the back to y1 at xb(y). Every point
    is a point of the master off_cm(y) out, with the surface's own normal and the master's weights: the strap lies ON the
    slope of the shoulder (a fixed, nearly upright normal stood its outer edge 1.7 cm in the air there, a shelf), follows
    the curve of the upper back instead of cutting its corner, and moves with the cloth under it in every pose.
    front / back = [(y, theta_deg, own_off_cm)] TORSO points before and after. -> points, normals, weights."""
    P, N, W = [], [], []

    def add(mast, y, th, o):
        p, n, w = surf(mast, y, th * sx, o)
        P.append(p), N.append(n), W.append(w)

    def th_of(y, bk):
        return neck_th(y, (xb if bk else xf)(y), bk)

    for y, th, o in front:
        add(TORSO, y, th, o)
    ys, y = [], y0
    while th_of(y, False) is not None:
        ys.append(y)
        y += step
    assert ys, 'over_shoulder(): the strap starts above the shoulder'
    yt = ys[-1]                        # the top: the last height at which the shoulder is still that wide
    while th_of(yt + 0.001, False) is not None:
        yt += 0.001
    run = [(y, False) for y in ys if y < yt - 0.3 * step] + [(yt, None)]
    y = yt - 0.5 * step
    while y > y1 - 1e-6:
        if th_of(y, True) is not None:
            run.append((y, True))
        y -= step

    def pos(e):
        th = 0.5 * (th_of(e[0], False) + th_of(e[0], True)) if e[1] is None else th_of(e[0], e[1])
        return on(NECK, e[0], th, 0)[0], th

    # where the shoulder is nearly level a step in height is a long step along it: halve those, or the strap's chord cuts under the cloth
    i = 0
    while i < len(run) - 1:
        a, b = run[i], run[i + 1]
        bk = b[1] if b[1] is not None else a[1]
        ym = 0.5 * (a[0] + b[0])
        if np.linalg.norm(pos(a)[0] - pos(b)[0]) > 0.02 and abs(a[0] - b[0]) > 0.0015 and th_of(ym, bool(bk)) is not None:
            run.insert(i + 1, (ym, bool(bk)))
        else:
            i += 1
    for e in run:
        add(NECK, e[0], pos(e)[1], off_cm(e[0]))
    for y, th, o in back:
        add(TORSO, y, th, o)
    return np.array(P), np.array(N), np.array(W)


def tail_weights(P, W, y_top=0.99, span=0.085, kmax=0.85):
    """A shirt tail / blouse skirt follows the thighs: below y_top a growing share of each vertex's
    weight moves to the thigh on its side (both, near the middle), so a raised thigh carries the hem."""
    W = W.copy()
    k = np.clip((y_top - P[..., 1]) / span, 0, 1) * kmax
    # the seat stays with the hips: a flexed thigh must not drag the back of the tail into the buttocks
    k = k * (0.25 + 0.75 * np.clip((P[..., 2] + 0.035) / 0.07, 0, 1))
    side = np.clip(P[..., 0] / 0.07, -1, 1) * 0.5 + 0.5          # 1 = his left
    W *= (1 - k)[..., None]
    W[..., M.J['DEF-thigh.L']] += k * side
    W[..., M.J['DEF-thigh.R']] += k * (1 - side)
    return W


def mband(mast, t0, t1, off_in, off_out, slot, angle=40.0, floor=None):
    """floor = the ring floor (m) of the cloth this band goes round (tube_of's rmin there): the band stands off THAT, not off the limb."""
    rm = None if floor is None else [floor - 0.003, floor + (off_out - off_in) * CM, floor + (off_out - off_in) * CM, floor - 0.003]
    # (a floored band is wider than the limb: clamped off the midline like the trousers it goes round, or the mirrored one crosses it)
    return tube_of(mast, [t0, t0, t1, t1], [off_in, off_out, off_out, off_in], slot, angle, rmin=rm, clampx=None if floor is None else 0.004)


def on(mast, t, th_deg, off_cm):
    P, W = mast.at(t, th_deg * D2R, off_cm * CM)
    return P[0], W[0]


def stuck(mast, t, th_deg, off_cm, half, slot, joint=None, bevel=0.008, angle=40.0, pitch=0.0, roll=0.0, taper=None, yaw=None):
    """A box sitting on a torso/leg master at (t, theta), its local +Z pointing out; rigid on one joint
    (default: the joint that owns the surface there)."""
    p, w = on(mast, t, th_deg, off_cm)
    j = joint or M.names[int(np.argmax(w))]
    R = rot_xyz(pitch, th_deg if yaw is None else yaw, roll)
    return rig(box(p, half, slot, None, R, bevel, angle, taper), j)


# ------------------------------------------------------------------------------------------------
# hands
# ------------------------------------------------------------------------------------------------
def hands(slot, grow=0.0):
    """Palm = the mannequin's own palm faces (its weights); fingers = new 6-sided tubes on its joints."""
    fi = M.islands['armL']
    F = M.F[fi]
    # the whole hand from its wrist ring (x .725-.733) out: a cut at .745 left a saw edge whose notches reached x = .773,
    # past the end of every wrist / cuff tube (.758): a hole on the back of each hand
    keep = (M.V[F][:, :, 0] > 0.72).all(1)
    F = F[keep]
    vi = np.unique(F)
    remap = -np.ones(len(M.V), int)
    remap[vi] = np.arange(len(vi))
    V = M.V[vi].copy()
    if grow:
        fn = np.cross(V[remap[F[:, 1]]] - V[remap[F[:, 0]]], V[remap[F[:, 2]]] - V[remap[F[:, 0]]])
        vn = np.zeros_like(V)
        for k in range(3):
            np.add.at(vn, remap[F[:, k]], fn)
        V += norm(vn) * grow
    out = [chunk(V, remap[F], M.W[vi], slot, 180)]
    for f, k in (('f_index', 1.0), ('f_middle', 1.04), ('f_ring', 0.98), ('f_pinky', 0.86), ('thumb', 1.12)):
        j = [M.jp('DEF-%s.%02d.L' % (f, i)) for i in (1, 2, 3)]
        tipbb = np.vstack(M.fingers['DEF-%s.03.L' % f])
        d = norm(j[2] - j[1])
        ext = ((tipbb - j[2]) @ d).max() - 0.004
        tip = j[2] + d * ext
        w = [Wj('DEF-%s.%02d.L' % (f, i)) for i in (1, 2, 3)]
        if f == 'thumb':
            pts = [j[1] - norm(j[1] - j[0]) * 0.018, (j[1] + j[2]) / 2, j[2], (j[2] + tip) / 2, tip]
            ws = [w[0], w[1], (w[1] + w[2]) / 2, w[2], w[2]]
            rr = np.array([.0125, .0120, .0112, .0105, .0075])
        else:
            d0 = norm(j[1] - j[0])
            pts = [j[0] - d0 * 0.014, (j[0] + j[1]) / 2, j[1], (j[1] + j[2]) / 2, j[2], (j[2] + tip) / 2, tip]
            ws = [w[0], w[0], (w[0] + w[1]) / 2, w[1], (w[1] + w[2]) / 2, w[2], w[2]]
            rr = np.array([.0118, .0112, .0108, .0100, .0096, .0090, .0066])
        out.append(tube(pts, rr * k + grow, slot, None, nseg=6, squash=0.92, Wring=np.array(ws), up=(0, 1, 0)))
    return both(out)


# ------------------------------------------------------------------------------------------------
# head, hair, headgear
# ------------------------------------------------------------------------------------------------
WH = Wj('DEF-head')


def part_head():
    c = H.skin_head(WH)
    c.append(tube_of(NECK, [1.44, 1.47, 1.50, 1.53, 1.56, 1.60, 1.645], [0, -0.2, -0.5, -0.7, -0.75, -0.6, -0.4], 'skin', 180))
    return c


def part_head_b():
    """the second face (head.py look 'b': the broad man: low thick brows, a shorter wider nose, a fuller jaw), on five of the men"""
    c = H.skin_head(WH, look='b')
    c.append(tube_of(NECK, [1.44, 1.47, 1.50, 1.53, 1.56, 1.60, 1.645], [0, -0.2, -0.5, -0.7, -0.75, -0.6, -0.4], 'skin', 180))
    return c


def part_moustache():
    # two halves that follow the lip round the face and droop to the corners of the mouth (one straight slab stood off the cheeks
    # at both ends: a plank in three-quarter view, a toothbrush from the front)
    out = []
    for sx in (1, -1):
        th = sx * 0.21
        m = ellipsoid(H.surf(0.222, th, 0.0025), [0.0185, 0.0052, 0.0058], 'rubber', None, rot_xyz(0, np.degrees(th), -sx * 13), nu=8, nv=3)
        out.append(rig(m, 'DEF-head'))
    return out


HAIRLINE = H.rim_interp([0, 35, 70, 95, 140, 180], [.75, .72, .53, .37, .22, .15])


def over_neck(c, clear, S=28, y_hi=1.665):
    """A hair shell's nape lies ON the neck: below the skull's widest the neck tube stands up to 2.4 cm behind the head
    surface the shell was sampled from, and came through it (a skin-coloured hole at the back of the head). Every vertex
    under y_hi is kept `clear` outside the neck (the rim row, the chunk's first S vertices, 1 mm: the edge stays closed)."""
    V = c['V']
    assert len(V) % S == 0, 'over_neck(): the chunk is not rows of S vertices (pass the shell\'s own S)'
    cl = np.full(len(V), clear)
    cl[:S] = 0.001
    for i in np.where(V[:, 1] < y_hi)[0]:
        x, y, z = V[i]
        r = np.hypot(x, z)
        need = NECK.radius(np.array([min(y, 1.645)]), np.array([np.arctan2(x, z)]))[0] + cl[i] * np.clip((y_hi - y) / 0.02, 0, 1)
        if r < need:
            V[i, 0] *= need / r
            V[i, 2] *= need / r
    return c


def rim_cols(vals, S=28):
    """A rim line given per COLUMN of H.thetas(S): S // 2 + 1 heights from the front round to the back (mirrored), or all S of
    them for a line that is not the same on both sides. (rim_interp() draws a smooth line through a table over the angle: a
    hairline wants its own corner at each column — scallops, a sideburn, the arch over an ear.)"""
    v = np.asarray(vals, float)
    full = v if len(v) == S else np.concatenate([v, v[-2:0:-1]])
    assert len(full) == S, 'rim_cols(): S // 2 + 1 or S values'
    return lambda th: full + 0 * th


def feather(g, full, lo=0.002, over=0.07):
    """a hair shell's thickness: `lo` at the hairline growing to `full` over the first `over` of the way up, so the shell meets
    the skin in a slope and not in a wall (the wall caught the light: a pale line round the head, a cap's hard rim)"""
    return lo + (full - lo) * np.clip(g / over, 0, 1)


def part_hair_short():
    # the hairline per column: blunt scallops across the forehead, the temple's corner, a sideburn in front of the ear (72 deg), the arch
    # over the ear, the old line behind it. The rim row is SUNK 2 mm into the scalp (it stood 0.8 mm off it).
    rim = rim_cols([.735, .758, .728, .752, .705, .668, .455, .42, .51, .47, .303, .251, .208, .179, .15])
    return [over_neck(H.shell(WH, rim, lambda g, th: feather(g, 0.006 + 0.004 * g) + 0 * th, 'rubber', gs=[.07, .15, .25, .37, .5, .64, .78, .89, .96, 1.0], rim_in=-0.002), 0.007)]


def slab_loop(P, thick, slot, angle=40.0, W=None, out=(0, 1, 0), root=False):
    """A thin curved slab from a sheet of points P (rows x cols: row 0 the root, the last row the free edge): each row becomes a
    closed loop (the face left to right, the underside right to left) `thick[row]` deep along the sheet's own normal, the free edge
    closed by a strip from its upper to its lower edge. (It was a fan from the last loop's centroid: on a bill that curves in plan and
    falls to the sides the centroid lies behind and BELOW the front edge, and the fan hung out under the slab.)
    `out` = the way the face looks (up, for a cap's bill). W = one weight row for all (default the head's) or (rows, cols, NJ).
    root = close the root end the same way (a slab whose root is not buried in something)."""
    P = np.asarray(P, float)
    R, C = P.shape[:2]
    du = np.gradient(P, axis=1)
    dv = np.gradient(P, axis=0)
    n = norm(np.cross(dv, du))
    n *= np.sign((n * np.asarray(out, float)).sum(-1).mean()) or 1.0
    G = np.concatenate([P, (P - n * np.asarray(thick, float).reshape(R, 1, 1))[:, ::-1]], 1)
    W = WH if W is None else np.asarray(W, float)
    Wg = np.concatenate([W, W[:, ::-1]], 1) if W.ndim == 3 else np.broadcast_to(W, G.shape[:2] + (NJ,))
    c = grid_chunk(G, Wg, slot, angle, True, False, False)
    V = c['V']
    i = np.arange(C - 1)
    for o, away in [((R - 1) * 2 * C, G[-1].mean(0) - G[-2].mean(0))] + ([(0, G[0].mean(0) - G[1].mean(0))] if root else []):
        t0, t1, b0, b1 = o + i, o + i + 1, o + 2 * C - 1 - i, o + 2 * C - 2 - i
        F = np.concatenate([np.stack([t0, t1, b1], 1), np.stack([t0, b1, b0], 1)])
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        if (fn * away).sum() < 0:
            F = F[:, ::-1]
        c['F'] = np.concatenate([c['F'], F])
    return c


def part_cap_ball():
    # a ball cap: a taller front panel, an arch cut out of the back over the adjusting strap (the hair shows in it: from behind and
    # above that is the cap's back), and a CURVED bill 9.5 cm long. The bill, the button and the adjusting strap are on the WEBBING
    # slot (the irregulars' olive canvas: darker than five of the six hat colours and no head's hair. On `rubber`, the hair's own
    # slot, bill and hair were one dark band round the head; in the crown's colour the cap was an egg with no front).
    cols = [.63, .628, .622, .615, .606, .597, .588, .577, .566, .556, .548, .540, .536, .615, .665]
    rim = rim_cols(cols)
    crown = H.shell(WH, rim, lambda g, th: 0.013 + np.sin(g * np.pi) * (0.006 * (1 + 0.6 * np.cos(th)) + 0.005 * np.clip(np.cos(th), 0, 1) ** 2), 'helmet', K=5, angle=50, rim_in=0.008)
    strap = H.band(WH, 0.527, 0.557, 0.008, 0.0135, 'webbing', S=5, th0=142 * D2R, th1=218 * D2R)
    # the bill is rooted on the CROWN'S OWN COLUMNS and follows its rim line: its top face meets the crown 1 mm over the rim on
    # every column, its root ring 5 mm inside the crown's face under the rim. (Rooted at one height on nine columns of its own it
    # crossed the crown's facets wherever they fell: a torn strip.) It is tilted UP 10 degrees from where it hung (it rises 3.4
    # degrees; dipping 6.6 it was a flat bar across both eyes from the front) and keeps the rim's fall to the sides: an arch.
    kk = 6
    t28 = H.thetas(28)[:kk + 1]
    th = np.concatenate([-t28[:0:-1], t28])
    hr = np.concatenate([cols[kk:0:-1], cols[:kk + 1]]) + 0.001 / H.HH
    u = th / th[-1]
    root = H.surf(hr, th, 0.008)
    shape = 1 - 0.58 * np.abs(u) ** 3                      # the planform: a broad front, round corners
    rows = [H.surf(hr, th, 0.002)]                         # the slab's back end lies on the forehead: it closes the gap under the crown's rim, which stands 8 mm off the skin
    for v in (0.30, 0.70, 1.0):
        q = root + np.array([0, 0, 1.0]) * ((0.005 + 0.095 * v) * shape)[:, None]
        q[:, 1] += 0.0056 * v - 0.004 * u * u * v ** 0.7
        rows.append(q)
    bill = slab_loop(rows, [0.006, 0.0055, 0.0045, 0.003], 'webbing')
    button = rig(ellipsoid([0, H.Y1 + 0.016, H.Z0], [0.009, 0.004, 0.009], 'webbing', nu=6, nv=2), 'DEF-head')
    return [crown, strap, bill, button]


HELMET_OFF = 0.030
MARK_PROUD = 0.002      # a band round a helmet: this far off the shell's facets (it shares the shell's columns)
CROWN_HALF = 0.030      # the look's crown panel: half its side at the HEAD's surface, metres (crown_panel): on the shell, 3 cm further out, it measures 5 cm more — an 11 cm square on a shell 22 cm across, a rim of half the radius left all round
STRIPE_PROUD = 0.003    # a stripe over the crown: its own chords sag 0.7 mm under that between its vertices, and cross the shell's
#                         ridges: at 3 it clears them by 0.5 mm at the worst and stands 2.3 mm off the shell in the middle (at 2: specks of shell)


def shell_face(rim, off_fn, K=6, S=28):
    """f(h, th, off): the point on the FACETED face of H.shell(rim, off_fn, K=K, S=S) at height h and angle th, pushed `off` out.
    A marking laid on the smooth surface the shell's vertices were sampled from stands off the shell's flat facets by its own
    offset PLUS their sag (up to 1.3 mm between two rows of a helmet), and had to be raised until it cleared them everywhere:
    it stood as a step. Laid on the facets it is the same height all over."""
    thc = H.thetas(S)
    hl = rim(thc)
    g = np.concatenate([[0.0], np.sin(np.linspace(0, 1, K + 1)[1:] * np.pi / 2) ** 0.9])
    P = H.surf(hl[None, :] + (1 - hl[None, :]) * g[:, None], thc[None, :], np.array([off_fn(gg, thc) + 0 * thc for gg in g]))

    def col(k, h):
        gk = np.clip((h - hl[k]) / (1 - hl[k]), 0, 1)
        j = np.clip(np.searchsorted(g, gk, 'right') - 1, 0, K - 1)
        u = ((gk - g[j]) / (g[j + 1] - g[j]))[..., None]
        return P[j, k] * (1 - u) + P[j + 1, k] * u

    def f(h, th, off):
        h, th, off = np.broadcast_arrays(np.asarray(h, float), np.asarray(th, float), np.asarray(off, float))
        t = th % (2 * np.pi)
        k1 = np.searchsorted(thc, t, 'right')
        k0 = k1 - 1
        t1 = np.where(k1 == S, 2 * np.pi, thc[k1 % S])
        w = ((t - thc[k0]) / (t1 - thc[k0]))[..., None]
        n = norm(H.surf(h, th, 0.031) - H.surf(h, th, 0.030))
        return col(k0, h) * (1 - w) + col(k1 % S, h) * w + n * off[..., None]
    return f


def band_on(face, h0, h1, off_in, off_out, slot, S=28, mid=0, angle=40.0):
    """H.band() on a shell's faceted face (shell_face): a band round it between heights h0..h1, off_out proud of the facets, its two edges sunk to off_in"""
    th = H.thetas(S)
    hh = np.concatenate([[h0], np.linspace(h0, h1, mid + 2), [h1]])[:, None] + 0 * th[None, :]
    off = np.array([off_in] + [off_out] * (len(hh) - 2) + [off_in])[:, None] + 0 * th[None, :]
    P = face(hh, th[None, :], off)
    return grid_chunk(P, np.broadcast_to(WH, P.shape[:2] + (NJ,)), slot, angle, True, False, False)


def crown_stripe(off_in, off_out, half_w, h_end, slot='accent', n=9, face=None, h_back=None, nb=6):
    """A fore-and-aft stripe over the crown, 2 * half_w wide, from height h_end on the brow to h_end at the back: the game's camera
    looks down at 55 degrees and sees the crown, which a band round the head is not on. Every column ends ON the h_end ring
    (so both ends tuck under a band there); the rim all round is sunk to off_in. face = a shell_face() to lay it on (the offsets
    are then from that shell's facets), else the bare head's smooth surface. h_back = the back end runs on DOWN the back of the
    shell to that height instead (under the head's widest ring, in nb more rows): the game's camera sits behind and above a man,
    and a stripe that stopped just past the crown showed it its short end."""
    a0, f0, b0 = [float(v) for v in H._prof(0.6)]
    e_end = (h_end - 0.6) / 0.4
    xs = np.array([-1, -1, -0.5, 0, 0.5, 1, 1]) * half_w
    ts = np.concatenate([[-1], np.linspace(-1, 1, n), [1]])
    psi_end = np.arcsin(np.sqrt(np.maximum(1 - e_end ** 2 - (xs / a0) ** 2, 0)))          # per column: where it meets h_end
    psi = ts[:, None] * psi_end[None, :]                                                   # + = toward the brow
    if h_back is not None:                                                                 # the back half goes all the way to the widest ring…
        k = n // 2 + 1
        psi = np.concatenate([np.linspace(-np.pi / 2, 0, k)[:-1, None] + 0 * xs[None, :], np.linspace(0, 1, k)[:, None] * psi_end[None, :], psi_end[None, :]])
    e = np.sqrt(np.maximum(1 - (xs[None, :] / a0) ** 2 - np.sin(psi) ** 2, 0))
    th = np.arctan2(xs[None, :] / a0 + 0 * psi, np.sin(psi))
    hh = 0.6 + 0.4 * e
    if h_back is not None:                                                                 # …and on down the back in its own columns
        hb = np.concatenate([[h_back], np.linspace(h_back, 0.6, nb + 1)[:-1]])[:, None] + 0 * xs[None, :]
        hh, th = np.concatenate([hb, hh]), np.concatenate([np.repeat(th[:1], len(hb), 0), th])
    off = np.full(hh.shape, off_out)
    off[[0, -1], :] = off_in
    off[:, [0, -1]] = off_in
    P = (face or H.surf)(hh, th, off)
    W = np.broadcast_to(WH, P.shape[:2] + (WH.shape[-1],))
    return outward(grid_chunk(P, W, slot, 40.0, False, flip=False), H.INSIDE)

def crown_panel(face, half=CROWN_HALF, off_in=-0.004, off_out=STRIPE_PROUD, n=9, slot='accent'):
    """One solid square panel on the crown of a shell (shell_face), 2 * half across at the head's own surface (the shell stands
    HELMET_OFF further out, so it measures more: see CROWN_HALF): the pair colour where the game's camera looks, with the shell's own
    colour left all round it. Same lay as crown_stripe's (on the facets, the rim sunk)."""
    a0, f0, b0 = [float(v) for v in H._prof(0.6)]
    k = np.concatenate([[-1], np.linspace(-1, 1, n), [1]])
    u = (k * half / a0)[None, :]
    v = np.where(k > 0, k * half / f0, k * half / b0)[:, None]
    e = np.sqrt(np.maximum(1 - u ** 2 - v ** 2, 0))
    th = np.arctan2(u + 0 * v, v + 0 * u)
    off = np.full(e.shape, off_out)
    off[[0, -1], :] = off_in
    off[:, [0, -1]] = off_in
    P = face(0.6 + 0.4 * e, th, off)
    return outward(grid_chunk(P, np.broadcast_to(WH, P.shape[:2] + (WH.shape[-1],)), slot, 40.0, False, flip=False), H.INSIDE)


def cat_eye(face, h0=0.60, tall=0.025, cols=(12, 16), S=28, slot='accent'):
    """A short band across the BACK of a shell, `tall` metres high, on the shell's own columns cols[0]..cols[1] of S (14 = dead astern)."""
    th = H.thetas(S)[cols[0]:cols[1] + 1]
    th = np.concatenate([th[:1], th, th[-1:]])
    h1 = h0 + tall / (H.Y1 - H.Y0)
    hh = np.array([h0, h0, (h0 + h1) / 2, h1, h1])[:, None] + 0 * th[None, :]
    off = np.full(hh.shape, MARK_PROUD)
    off[[0, -1], :] = -0.004
    off[:, [0, -1]] = -0.004
    P = face(hh, th[None, :], off)
    return outward(grid_chunk(P, np.broadcast_to(WH, P.shape[:2] + (WH.shape[-1],)), slot, 40.0, False, flip=False), H.INSIDE)


# the chin strap's centreline, one side: (degrees round from the nose, height h) from under the point of the chin up to the helmet's rim
STRAP_LINE = [(0, .032), (14, .035), (27, .045), (39, .064), (47, .100), (51.5, .160), (54, .230), (55.5, .31), (57, .40), (59, .50), (62, .60)]
STRAP_W, STRAP_CHIN = 0.019, 0.022      # metres of webbing: down the cheek, under the chin
STRAP_LOOKS = ('a', 'b')                # the faces that wear a helmet (asserted against VARIANTS below)


def chin_strap(top, n_cm=0.9):
    """A helmet's chin strap, up to height `top` (inside that helmet's rim): out from under the shell at the temple (well ahead
    of the ear and of the operators' ear cup), down the cheek a finger's width inside the face's outline, in under the jaw and
    across under the point of the chin (run along the jaw's own edge it read as an outline drawn round the face). One ribbon,
    five points across, every point placed ON the head's surface: the webbing lies 2.2 mm (3.2 under the chin) proud of
    whichever face that wears a helmet stands further out there, its two edges are turned in to under the skin of the one that
    stands further in, and over h 0.45 it lifts off the temple toward the shell's rim (clear of the hair). (It was a band whose height fell as |sin th|^1.5 from the temple to the chin: from the front two straight lines
    across the cheeks to a point under the lip, a V. A wide cup on the chin was tried and read as a goatee.)"""
    line = [q for q in STRAP_LINE if q[1] < top - 0.02]
    line.append((float(np.interp(top, [q[1] for q in STRAP_LINE], [q[0] for q in STRAP_LINE])), top))
    ctl = np.array([(-a, b) for a, b in line[:0:-1]] + line, float) * [D2R, 1]
    # a Catmull-Rom through the control points, then re-stepped evenly along the head (an odd count: one column on the midline)
    u = np.linspace(0, len(ctl) - 1, 600)
    i = np.clip(u.astype(int), 0, len(ctl) - 2)
    t = (u - i)[:, None]
    p0, p1, p2, p3 = (ctl[np.clip(i + k, 0, len(ctl) - 1)] for k in (-1, 0, 1, 2))
    cr = 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3)
    d = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(H.surf(cr[:, 1], cr[:, 0]), axis=0), axis=1))])
    n = 2 * int(round(d[-1] * 100 / n_cm / 2)) + 1
    s = np.linspace(0, d[-1], n)
    th, h = np.interp(s, d, cr[:, 0]), np.interp(s, d, cr[:, 1])
    th[n // 2] = 0.0
    C = H.surf(h, th)
    e = 1e-3

    def jac(hh, tt):
        return (H.surf(hh + e, tt) - H.surf(hh - e, tt)) / (2 * e), (H.surf(hh, tt + e) - H.surf(hh, tt - e)) / (2 * e)
    Jh, Jt = jac(h, th)
    side = norm(np.cross(norm(np.gradient(C, axis=0)), norm(np.cross(Jt, Jh))))     # across the strap, in the surface's own plane
    chin = np.exp(-(th / (30 * D2R)) ** 2)
    wide = STRAP_W + (STRAP_CHIN - STRAP_W) * chin
    lift = 0.0055 * np.clip((h - 0.45) / 0.08, 0, 1)

    def edge(k):
        """(h, th) of the surface points half a width to side k of the centreline: Newton steps on the 3D target (one linear
        step crossed the profile's knots under the chin and left the edge toothed)"""
        hh, tt = h.copy(), th.copy()
        for _ in range(4 if k else 0):
            A, B = jac(hh, tt)
            r = C + side * (wide / 2 * k)[:, None] - H.surf(hh, tt)
            aa, ab, bb, ra, rb = (A * A).sum(1), (A * B).sum(1), (B * B).sum(1), (A * r).sum(1), (B * r).sum(1)
            det = aa * bb - ab * ab
            hh, tt = np.maximum(hh + (bb * ra - ab * rb) / det, 0.004), tt + (aa * rb - ab * ra) / det
        return hh, tt
    rows = []
    for k, proud in ((-1, None), (-1, 0.0022), (0, 0.0026), (1, 0.0022), (1, None)):
        hh, tt = edge(k)
        lo, hi = H.face_relief(hh, tt, STRAP_LOOKS)
        rows.append(H.surf(hh, tt, lift + (lo - 0.002 if proud is None else np.maximum(hi, -0.001) + proud + 0.001 * chin)))
    P = np.stack(rows)
    R, S = P.shape[:2]
    # the right half's quads are cut along the mirror image of the left half's diagonal: the two sides of the chin shade alike
    r_, s_ = [x.ravel() for x in np.meshgrid(np.arange(R - 1), np.arange(S - 1), indexing='ij')]
    a, b, c, dd = r_ * S + s_, r_ * S + s_ + 1, (r_ + 1) * S + s_ + 1, (r_ + 1) * S + s_
    m = (s_ < S // 2)[:, None]
    F = np.concatenate([np.where(m, np.stack([a, b, c], 1), np.stack([a, b, dd], 1)), np.where(m, np.stack([a, c, dd], 1), np.stack([b, c, dd], 1))])
    V = P.reshape(-1, 3)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    if (fn * (V[F].mean(1) - H.CENTER)).sum() < 0:
        F = F[:, ::-1]
    return chunk(V, F, np.broadcast_to(WH, (len(V), WH.shape[-1])), 'webbing', 40.0)


def part_helmet(mark='plain'):
    # the rear rim is 2 cm lower than it was (.39 / .34 at 135 / 180 degrees): with the blouse's collar raised to a gaiter the
    # nape, the palest patch on a dark man from behind and above, is covered from both ends
    rim = H.rim_interp([0, 45, 75, 105, 135, 180], [.615, .60, .53, .49, .33, .26])
    shell = H.shell(WH, rim, lambda g, th: HELMET_OFF + 0 * th, 'helmet', K=6, angle=50, rim_in=0.008)
    # the pair colour: a band (.685-.845: lower it hid under the crown's curve from the game's high camera) and a 6 cm stripe from
    # brow to nape over the crown, where that camera looks. Both lie on the shell's own FACETS, 2 to 3 mm proud of them (shell_face):
    # on the smooth surface the band stood 2 to 3.3 mm off the facets (at 3.5 it was a lampshade) and the stripe had to be raised
    # to 6 mm before the shell's ridges stopped showing through its chords: a step. The stripe's rows are 9 degrees apart for the same reason.
    face = shell_face(rim, lambda g, th: HELMET_OFF, K=6)
    pair = band_on(face, 0.685, 0.845, -0.004, MARK_PROUD, 'accent', mid=3)
    out = [shell, pair, crown_stripe(-0.004, STRIPE_PROUD, 0.030, 0.835, n=13, face=face)]
    if mark == 'gwot':      # the look: one panel on the crown and a short band at the back; the rim all round is the shell's own colour
        out = [shell, crown_panel(face), cat_eye(face)]
    y_ear = H.Y0 + 0.40 * (H.Y1 - H.Y0)
    for sx in (1, -1):
        out.append(rig(ellipsoid([sx * 0.089, y_ear, H.Z0 - 0.012], [0.017, 0.037, 0.031], 'rubber', nu=8, nv=4), 'DEF-head'))
    # boom mic from the left cup round to the mouth
    pts = [[0.092, y_ear - 0.02, H.Z0 + 0.01], [0.088, y_ear - 0.045, H.Z0 + 0.06], [0.05, y_ear - 0.052, H.Z0 + 0.105], [0.018, y_ear - 0.05, H.Z0 + 0.118]]
    out.append(tube(pts, [0.004, 0.004, 0.004, 0.007], 'rubber', WH.reshape(1, -1), nseg=5))
    out.append(chin_strap(0.58))       # (the high-cut rim is at h 0.54 where the strap comes out)
    # NVG mount plate on the brow of the shell
    out.append(rig(box(H.surf(0.69, 0.0, HELMET_OFF + 0.004), [0.024, 0.022, 0.007], 'metal_dark', None, rot_xyz(-28, 0, 0), 0.004), 'DEF-head'))
    return out


def part_nvg_up():
    """AN/PVS-5 style goggle: a housing with two tubes, flipped UP and lying back against the front of the helmet. The only pair in the
    file: the game draws its own box goggles on a man who wears them down (anim/gltf.ts castGoggles), so a mesh pair worn down was never drawn."""
    c = []
    c.append(box([0, 0, 0], [0.060, 0.022, 0.020], 'metal_dark', None, None, 0.007))
    for sx in (1, -1):
        c.append(tube([[sx * 0.031, -0.002, 0.016], [sx * 0.031, -0.002, 0.064]], [0.0195, 0.018], 'metal_dark', np.zeros((1, NJ)), nseg=8, angle=50))
        c.append(tube([[sx * 0.031, -0.002, 0.0642], [sx * 0.031, -0.002, 0.067]], [0.0145, 0.0135], 'lens', np.zeros((1, NJ)), nseg=8, angle=50))
    c.append(box([0, 0.020, -0.006], [0.016, 0.008, 0.014], 'metal_dark', None, None, 0.004))
    # the tubes run UP THE SHELL: their axis is the helmet's own tangent over the brow, the housing a finger off the shell above the
    # rim, nothing below the rim and nothing over the crown. (History: 6 cm above the mount they floated; upright over the crown they
    # were a periscope; tipped forward a snout; upright in front of the brow a tray of binoculars on the brim.)
    off = HELMET_OFF + 0.026
    ctr = H.surf(0.74, 0.0, off)
    tan = norm(H.surf(0.90, 0.0, off) - H.surf(0.70, 0.0, off))
    R = rot_xyz(np.degrees(np.arctan2(-tan[1], tan[2])), 0, 0)
    for k in c:
        xform(k, R=R, t=ctr)
    # the arm from the brow plate to the housing's lower end
    plate = H.surf(0.69, 0.0, HELMET_OFF + 0.004)
    c.append(box((plate + ctr - tan * 0.020) / 2, [0.012, 0.010, 0.013], 'metal_dark', None, None, 0.003))
    return [rig(k, 'DEF-head') for k in c]


# ------------------------------------------------------------------------------------------------
# operator: uniform, kit, boots
# ------------------------------------------------------------------------------------------------
VEST = 3.3   # cm off the body


def pelvis(slot, off=1.5):
    return tube_of(TORSO, [.850, .87, .90, .94, .98, 1.02, 1.045], [off * .6, off, off, off, off, off, off * .8], slot, 180, cap0=True)


def _hull2(P):
    """Convex hull of 2D points (monotone chain), counter-clockwise, as indices into P."""
    idx = sorted(range(len(P)), key=lambda i: (P[i][0], P[i][1]))
    cr = lambda o, a, b: (P[a][0] - P[o][0]) * (P[b][1] - P[o][1]) - (P[a][1] - P[o][1]) * (P[b][0] - P[o][0])
    lo, up = [], []
    for i in idx:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], i) <= 0:
            lo.pop()
        lo.append(i)
    for i in reversed(idx):
        while len(up) >= 2 and cr(up[-2], up[-1], i) <= 0:
            up.pop()
        up.append(i)
    return lo[:-1] + up[:-1]


FLY, SEAM = 0.016, 0.009      # half the width of the strip of seat left in sight between the legs' cloth, front and back
TOP_Y = (1.004, 0.990)      # a trouser leg's top rim (inside the seat) and the row under it (the first that shows: the waistband's lower edge, under a belt)
FORK_TOP = 0.90      # the front panel between the thighs is whole down to here (it faded from .94: a long V from both hip points to the fork)


def trousers(slot, off, ys, of, rm, fold, seed, y0=0.85, sink=1.2, proud=0.1):
    """A pair of trousers as ONE garment: the two legs (tube_of rows ys / of / rm, as ever) and a SEAT that joins them. The seat was
    pelvis(): the mannequin's own pelvis block at an offset, which stood proud in the valley between the two leg tubes like a pair of
    briefs worn over them. Now, below the hip joint, each ring of the seat is the convex HULL of the two legs' own rings at that
    height (the legs as built, folds and all): between the thighs, front and back, the cloth bridges flat from one leg to the other,
    tangent to both, down to the fork at y0; round the outside of each thigh it runs just INSIDE the leg's cloth (to `sink` cm), so
    the leg is what shows there and nothing stands on anything. The last row tucks under: the fork. Weights: the hips' with
    tail_weights' share of each thigh, like a hem, so a raised thigh carries its half of the front. Returns the chunks."""
    ys, of, rm = [list(map(float, a)) for a in (ys, of, rm)]
    extra = [y for y in (.965, .925, .875, y0) if min(abs(y - t) for t in ys) > 0.006]      # rows the seat shares with the legs
    yy = sorted(set(ys) | set(extra), reverse=True)
    dup = ys[-1] == ys[-2]                                                                          # the tucked cuff row
    o2 = list(np.interp(yy, ys[::-1][1:] if dup else ys[::-1], of[::-1][1:] if dup else of[::-1]))
    r2 = list(np.interp(yy, ys[::-1][1:] if dup else ys[::-1], rm[::-1][1:] if dup else rm[::-1]))
    if dup:
        yy, o2, r2 = yy + [ys[-1]], o2 + [of[-1]], r2 + [rm[-1]]
    leg = tube_of(LEG, yy, o2, slot, 60, fold=fold, seed=seed, clampx=0.004, rmin=r2)
    LP = tube_of.last                                                                               # (R, S, 3): the leg as built
    if dup and ys[-1] < 0.12:                    # a hem that hangs loose over a shoe breaks on it: its front stands up to 1.5 cm higher than its back
        hem = leg['V'][-2 * LEG.nseg:]
        hem[:, 1] = np.minimum(hem[:, 1] + np.tile(1.5 * CM * np.clip(np.cos(TH_L), 0, 1) ** 1.5, 2), max(ys[-1], 0.112))
    ty = np.array([y0 - 0.016] + [y for y in yy[::-1] if y0 - 1e-6 <= y <= 0.97] + [.995, 1.02, 1.045])
    o = np.full(len(ty), float(off))
    o[-1] *= 0.8
    P, W = TORSO.sample(ty, o * CM)
    for i, y in enumerate(ty):
        if y > 0.975:
            continue
        k = int(np.argmin(np.abs(np.array(yy) - max(y, y0))))
        L = LP[k]
        pts = np.vstack([L, L * [-1, 1, 1]])[:, [0, 2]]
        nL = len(L)
        C = torso_center(ty[i:i + 1])[0]
        c2 = np.array([0.0, np.clip(C[2], pts[:, 1].min() + 0.02, pts[:, 1].max() - 0.02)])
        h = _hull2(pts)
        r = ((P[i] - C) * TORSO.D).sum(-1)
        ends = [pts[j] for a, b in zip(h, h[1:] + h[:1]) if (a < nL) != (b < nL) for j in (a, b)]      # where the bridges leave the legs
        rn = r.copy()
        ff = [float(np.clip((y - y0 - 0.008) / (top - y0), 0, 1)) for top in (FORK_TOP, 0.905)]
        ff = [a * a * (3 - 2 * a) for a in ff]                               # the bridge is whole at the hips and gone at the fork (it holds lower behind: the seat)

        def cast(d, poly):                                                   # the far crossing of a ray from c2 with a closed polygon
            best = None
            for a in range(len(poly)):
                pa, e = poly[a], poly[(a + 1) % len(poly)] - poly[a]
                den = d[0] * e[1] - d[1] * e[0]
                if abs(den) < 1e-12:
                    continue
                w = pa - c2
                t = (w[0] * e[1] - w[1] * e[0]) / den
                u = (w[0] * d[1] - w[1] * d[0]) / den
                if t > 0 and -1e-9 <= u <= 1 + 1e-9 and (best is None or t > best[0]):
                    best = (t, a)
            return best

        H = pts[h]
        for j, D in enumerate(TORSO.D):
            d = np.array([D[0], D[2]])
            d /= max(np.linalg.norm(d), 1e-9)
            f = ff[0] + (ff[1] - ff[0]) * float(np.clip(-d[1] * 2.0, 0, 1))
            hit = cast(d, H)
            if hit is None:
                continue
            t, a = hit
            ia, ib = h[a], h[(a + 1) % len(h)]
            if (ia < nL) == (ib < nL):                                       # round a thigh the seat stays on the leg's cloth down past the hip joint: the leg comes out of it there with no step
                f = max(f, float(np.clip((y - 0.895) / 0.025, 0, 1)))
            q = c2 + d * t
            if (ia < nL) != (ib < nL):                                       # on a bridge: between the thighs
                t += proud * CM
            else:
                sk = sink * CM * float(np.clip((0.955 - y) / 0.055, 0, 1))      # (above the hip joint the SEAT is the cloth that shows: the leg's rings are inside it there)
                t -= sk * min(1.0, min(np.linalg.norm(q - e2) for e2 in ends) / 0.03) if ends else sk
            q = c2 + d * t
            need = float(((np.array([q[0], C[1], q[1]]) - C) * D).sum())
            body = r[j] - (off - 0.4) * CM * (1 - f)                         # the body's own surface: what the fork falls back to
            rn[j] = max(body, body + (need - body) * f * min(1.0, (0.975 - y) / 0.024)) if y > y0 - 1e-6 else max(body - 1.5 * CM, 0.03)
        P[i] = C + TORSO.D * rn[:, None]
    # from the waist (the first row above .975) to the hip row (.95) the seat runs straight: the rows between took a third of the hip's
    # flare and the rest in the last 1.5 cm, a shelf round the hips
    ia, ib = max(i for i in range(len(ty)) if ty[i] <= 0.951), min(i for i in range(len(ty)) if ty[i] > 0.975)
    for i in range(ia + 1, ib):
        u = (ty[i] - ty[ia]) / (ty[ib] - ty[ia])
        C = torso_center(ty[i:i + 1])[0]
        rr = [((P[k] - torso_center(ty[k:k + 1])[0]) * TORSO.D).sum(-1) for k in (ia, ib)]
        P[i] = C + TORSO.D * (rr[0] * (1 - u) + rr[1] * u)[:, None]
    Ws = tail_weights(P, W)
    # THE LEG'S TOP RINGS LIVE INSIDE THE SEAT. The leg tube's open top rim (y .985) and the rings under it carried the mannequin's own
    # leg weights: with a thigh raised or trailed the rim turned with it, out of the seat, and stood off the hip as an open hoop (and
    # under the seat of a raised thigh the tube's mouth hung open). The rim (now at TOP_Y[0]) is drawn in under the seat's shell
    # (radially about the trunk's axis, by 1.2 cm) and the rows from .875 up take the weights of the seat's cloth beside them, so they move
    # as one piece with it and no rim can lift; the rows under them go over to the leg's own weights by the fork.
    # FROM THE ROW UNDER THE RIM (TOP_Y[1]) DOWN THE LEG IS THE CLOTH THAT SHOWS, all the way round to the centre: where the seat stood proud of a
    # leg (the pelvis' own front and the buttocks, 1 to 4 cm: the V panel from both hip points to the fork) the leg's ring is carried
    # out over it by a few millimetres, up to FLY / SEAM of the centre line. What is left of the seat in sight is a strip down the
    # front (the fly) and a narrower one behind (the seat seam), each a few millimetres under the legs' cloth.
    V, Wl, S = leg['V'], leg['W'], LEG.nseg
    Rs = np.array([((P[i] - torso_center(ty[i:i + 1])[0]) * TORSO.D).sum(-1) for i in range(len(ty))])      # the seat as radius(row, column)
    nT = len(TORSO.D)

    def seat_r(y, th):                                                       # the seat's radius about the trunk's axis at height y, angle th
        fs = (th % (2 * np.pi)) / (2 * np.pi) * nT
        j0, b = int(fs) % nT, fs - int(fs)
        col = Rs[:, j0] * (1 - b) + Rs[:, (j0 + 1) % nT] * b
        return float(np.interp(y, ty[1:], col[1:]))
    V0 = V.copy()
    inward = -np.sin(TH_L)                                                   # 1 = the column that looks at the other leg
    for r in range(len(V) // S):
        y = float(V[r * S, 1])
        if y < 0.87:                                                         # the fork and everything under it: the leg as it was
            continue
        share = float(np.interp(y, [.85, .875, .90, .925, .95], [0, .15, .3, .6, 1]))
        lift = 0.5 * CM
        for s_ in range(S):
            v = r * S + s_
            p = V[v].copy()
            if r < 2:                                                        # the two top rows stand over the hip row's own columns (their own rings were the narrow waist's: sheared quads)
                p = np.array([V0[2 * S + s_, 0], TOP_Y[r], V0[2 * S + s_, 2]])
            C = torso_center(np.array([p[1]]))[0]
            th = float(np.arctan2(p[0] - C[0], p[2] - C[2]))
            rr = float(np.hypot(p[0] - C[0], p[2] - C[2]))
            if r == 0 and inward[s_] <= 0.5:                                 # the open rim: tucked under the seat's cloth
                k = min(1.0, max(seat_r(p[1], th) - 1.2 * CM, 0.01) / rr)
                V[v] = [C[0] + (p[0] - C[0]) * k, p[1], C[2] + (p[2] - C[2]) * k]
                continue
            if r == 0 or inward[s_] > 0.85:                                            # the ring's flat side on the centre line stays inside
                V[v] = p
                continue
            if inward[s_] > 0.5:                                             # its corner by the centre line goes straight out, to the edge of the fly / the seat seam
                x = FLY if p[2] > 0 else SEAM
                for _ in range(4):
                    sn = float(np.clip(x / (seat_r(p[1], th) + lift), -1, 1))
                    th = float(np.arcsin(sn)) if p[2] > 0 else float(np.pi - np.arcsin(sn))
            elif r != 1 and rr >= seat_r(p[1], th) + lift:
                V[v] = p
                continue
            q = C + np.array([np.sin(th), 0, np.cos(th)]) * (seat_r(p[1], th) + lift)
            V[v] = q
        if r >= 1:                                  # the column between a corner and the thigh's front (its back) lies on the line between them: left in the hollow beside the seat's centre, its quads were twisted and showed as a row of teeth
            for c_, m_, o_ in ((12, 13, 0), (9, 8, 7)):
                a_, b_, o2 = V[r * S + c_], V[r * S + m_], V[r * S + o_]
                if o2[0] - a_[0] > 1e-4:
                    zl = a_[2] + (o2[2] - a_[2]) * float(np.clip((b_[0] - a_[0]) / (o2[0] - a_[0]), 0, 1))
                    b_[2] = max(b_[2], zl) if c_ == 12 else min(b_[2], zl)
        for v in range(r * S, (r + 1) * S):                                  # ... and every vertex of the row moves with the seat's cloth nearest where it ended up
            C = torso_center(V[v, 1:2])[0]
            th = float(np.arctan2(V[v, 0] - C[0], V[v, 2] - C[2]))
            gap = float(np.hypot(V[v, 0] - C[0], V[v, 2] - C[2])) - seat_r(V[v, 1], th)
            sw = tail_weights(V[v:v + 1], TORSO.at(V[v, 1:2], th)[1])[0]      # what the seat's cloth has here (the same rule its own vertices get)
            # (wholly, by the centre line: on its own leg's weights a turned thigh swung the fly's edge off the fly; and wherever the seat
            # lies within a centimetre under the leg's cloth: on different weights the seat came out through it when a thigh moved)
            k = max(share, float(np.clip((0.07 - V[v, 0]) / 0.04, 0, 1)), float(np.clip((0.02 - gap) / 0.012, 0, 1)))
            Wl[v] = Wl[v] * (1 - k) + sw * k
    return [grid_chunk(P, Ws, slot, 180, True, cap0=True)] + both(leg)


# the operators' trousers: ring floors (m) per row, so the cloth falls from the seat; taken in at the knee, where the pads sit on it
OP_YS = [.985, .95, .90, .84, .77, .70, .63, .575, .535, .495, .44, .38, .33, .295, .268, .268]
OP_RM = [0, .096, .100, .098, .094, .090, .083, .072, .066, .066, .069, .072, .075, .078, .07, 0]
OP_THIGH = lambda y: float(np.interp(y, OP_YS[::-1], OP_RM[::-1]))     # what a strap round the thigh at y goes round


def part_op_uniform(mark='plain'):
    U = 'cloth_uniform'
    c = []
    # blouse skirt below the vest, collar above it
    c.append(tube_of(TORSO, [.915, .915, .95, 1.0, 1.07], [1.7, 3.2, 3.0, 2.5, 2.0], U, 60, fold=0.5, seed=3, hang=(1.0, 2), tail=True, over_legs=0.5))
    # the collar is a GAITER: 4.5 cm higher than the ring it was at the back and sides (to y 1.60, a finger under the hair), dipping
    # 3.5 cm under the chin in front. The bare nape was the palest patch on a dark man from behind and above.
    g = tube_of(NECK, [1.465, 1.50, 1.53, 1.565, 1.60, 1.60], [1.0, 1.1, 1.2, 1.1, 1.0, 0.2], U, 60)
    V = g['V']
    V[:, 1] -= 0.035 * np.clip((V[:, 1] - 1.53) / 0.07, 0, 1) * np.clip(V[:, 2] / np.maximum(np.hypot(V[:, 0], V[:, 2]), 1e-6), 0, 1) ** 0.7
    c.append(g)
    # sleeves
    xs = [.15, .19, .24, .30, .36, .42, .455, .49, .54, .60, .66, .705]
    of = [1.2, 1.5, 1.8, 1.8, 1.7, 1.7, 1.6, 1.7, 1.8, 1.7, 1.6, 1.4]
    tube_of(ARM, [.135] + xs, [0.0] + of, U, 180, fold=0.45, seed=5, cap0=True, scale=np.array([.40, .70, .88, .97] + [1.0] * (len(xs) - 3))[:, None])
    # the head's top sunk under the vest's shoulder (sink_head; the brassard with it): the sleeve's top passed 2.5 cm over the
    # vest's shoulder corner and came out of the armhole as a dark ball between the vest and the brassard
    OP_SINK = (2.0, 1.0)
    sl = grid_chunk(sink_head(tube_of.last, [.135] + xs, *OP_SINK), tube_of.lastW, U, 180, True, True, False)
    # the brassard runs up over the deltoid (from x .205; it began at .262, a band round the middle of the upper arm): with the arm
    # down that is the cap of the shoulder, which the game's camera sees. The sleeve's own taper into the shoulder (`scale`) under it.
    bx = np.array([.205, .205, .25, .30, .335, .335])
    tube_of(ARM, bx, [1.5, 2.55, 2.55, 2.45, 2.45, 1.5], 'accent', 40, scale=np.interp(bx, [.19, .24, .30], [.88, .97, 1.0])[:, None])
    brass = grid_chunk(sink_head(tube_of.last, bx, *OP_SINK), tube_of.lastW, 'accent', 40, True)
    if mark == 'gwot':      # the look: a PATCH on the top of the deltoid (9 cm along the arm, the three columns round its top) in place of the ring
        px = np.array([.200, .200, .230, .260, .290, .290])
        sc = np.interp(px, [.19, .24, .30], [.88, .97, 1.0])[:, None]
        tube_of(ARM, px, [1.5, 2.35, 2.35, 2.35, 2.35, 1.5], 'accent', 40, scale=sc)
        Po, Wp = sink_head(tube_of.last, px, *OP_SINK), tube_of.lastW
        tube_of(ARM, px, [1.5] * 6, 'accent', 40, scale=sc)
        Pi = sink_head(tube_of.last, px, *OP_SINK)
        deg = np.round(np.degrees((TH_A + np.pi) % (2 * np.pi) - np.pi)).astype(int)
        cols = [int(np.where(deg == d)[0][0]) for d in (-30, 0, 30)]
        cols = [cols[0]] + cols + [cols[-1]]
        P = Po[:, cols].copy()
        P[:, [0, -1]] = Pi[:, [cols[0], cols[-1]]]
        brass = grid_chunk(P, Wp[:, cols], 'accent', 40.0, False)
    # trousers, bloused into the boots
    ys = OP_YS
    of = [1.0, 1.5, 1.9, 2.0, 1.9, 1.8, 1.7, 1.6, 1.6, 1.7, 1.9, 2.2, 3.0, 3.5, 2.7, 0.8]
    c += trousers(U, 1.5, ys, of, OP_RM, 0.5, 7)
    p, w = on(LEG, .745, 92, 3.1)
    cargo = rig(box(p, [0.014, 0.075, 0.058], U, None, None, 0.012, 180), 'DEF-thigh.L')
    flap = rig(box(p + np.array([0.004, 0.052, 0]), [0.014, 0.022, 0.060], U, None, None, 0.006, 50), 'DEF-thigh.L')
    c += both([sl, brass, cargo, flap])
    return c


def kneepad():
    ys = np.array([.605, .585, .55, .515, .48, .462])
    th = np.linspace(-78, 78, 7) * D2R
    off = np.full((len(ys), len(th)), 3.1 * CM)
    off[[0, -1], :] = 1.2 * CM
    off[:, [0, -1]] = 1.2 * CM
    off[2:4, 2:5] = 3.6 * CM
    P = np.zeros((len(ys), len(th), 3))
    W = np.zeros((len(ys), len(th), NJ))
    for r, y in enumerate(ys):
        P[r], W[r] = LEG.at(np.full(len(th), y), th, off[r])
    return grid_chunk(P, W, 'rubber', 180, False)


def part_op_kit():
    c = []
    # the vest: front and back plates stand proud, shoulders squared
    ys = np.array([1.060, 1.060, 1.10, 1.16, 1.22, 1.28, 1.33, 1.38, 1.42, 1.45, 1.475, 1.495, 1.507])
    cth = np.cos(TH_T)[None, :]
    sth = np.abs(np.sin(TH_T))[None, :]
    plate = np.clip((np.abs(cth) - 0.45) / 0.3, 0, 1) * np.clip((ys - 1.09) / 0.04, 0, 1)[:, None] * np.clip((1.43 - ys) / 0.05, 0, 1)[:, None]
    # the flank under each arm is 20 mm thinner than the plates' surround (the tucked elbow of the rifle carry
    # went 58 mm into it): only the sides, only between the waist and the armpit
    flank = np.clip((sth - 0.85) / 0.12, 0, 1) * np.clip((ys - 1.09) / 0.05, 0, 1)[:, None] * np.clip((1.36 - ys) / 0.05, 0, 1)[:, None]
    off = (VEST + 1.1 * plate - 2.0 * flank) * CM + 0 * cth
    off[0] = 1.9 * CM
    off[-3] = 2.7 * CM
    off[-2] = 2.0 * CM
    off[-1] = 0.7 * CM
    sq = 1 + 0.07 * sth ** 4 * np.clip((ys - 1.33) / 0.06, 0, 1)[:, None]      # squared shoulders
    P, W = TORSO.sample(ys, off, sq)
    c.append(grid_chunk(P, W, 'webbing', 55))
    # magazine pouches across the front, each with a lid
    # 18 mm less proud than they were (24 mm deep, not 42: both hands sat 15 mm inside their faces at the ready), and
    # the outer pair is behind the elbow line now (was at +-38 deg, in the forearm's way in the rifle carry)
    for thd in (-126, -13, 13, 126):
        o = VEST + (1.1 if abs(thd) < 30 else 0.45)
        c.append(stuck(TORSO, 1.135, thd, o + 0.8, [0.034, 0.064, 0.012], 'webbing', 'DEF-spine.001', 0.006))
        c.append(stuck(TORSO, 1.178, thd, o + 1.1, [0.036, 0.022, 0.013], 'webbing', 'DEF-spine.001', 0.005))
    # upper chest: radio pouch (his left), a pair of grenades (his right)
    c.append(stuck(TORSO, 1.305, 24, VEST + 2.5, [0.036, 0.052, 0.018], 'webbing', 'DEF-spine.003', 0.007))
    for thd in (-17, -33):
        p, w = on(TORSO, 1.30, thd, VEST + 2.9)
        c.append(rig(tube([p - [0, .035, 0], p + [0, .035, 0]], [0.021, 0.021], 'metal_dark', np.zeros((1, NJ)), nseg=7, angle=50), 'DEF-spine.003'))
    # belt, buckle, rear canteens
    c.append(mband(TORSO, 1.000, 1.048, 2.2, 3.1, 'webbing'))
    c.append(stuck(TORSO, 1.024, 0, 3.4, [0.030, 0.021, 0.006], 'metal_dark', 'DEF-hips', 0.004))
    for thd in (148, -148):
        c.append(stuck(TORSO, 0.985, thd, 5.2, [0.050, 0.070, 0.034], 'webbing', 'DEF-hips', 0.016, 180))
    # thigh holster on the right, two leg straps
    hl = [mband(LEG, .835, .800, 1.8, 2.6, 'webbing', floor=OP_THIGH(.8175)), mband(LEG, .735, .700, 1.7, 2.5, 'webbing', floor=OP_THIGH(.7175))]
    p, w = on(LEG, .765, 96, 4.0)
    hl.append(rig(box(p, [0.024, 0.090, 0.046], 'webbing', None, rot_xyz(8, 0, 0), 0.008, 40, taper=(1.0, 1.25)), 'DEF-thigh.L'))
    hl.append(rig(box(p + np.array([0.004, 0.105, -0.026]), [0.014, 0.034, 0.020], 'metal_dark', None, rot_xyz(22, 0, 0), 0.005), 'DEF-thigh.L'))
    c += [mirror_x(k, M) for k in hl]
    # knee pads
    c += both(kneepad())
    return c


def blunt_toe(V, z1=0.085, zc=0.168):
    """Shortens and rounds a boot's toe: ahead of the ball of the foot (z1) every vertex's reach is eased toward zc, the tip most
    (the tip stood at z = .21 with the columns beside it 4 cm behind: a long point seen from above; now .150 and 1.5 cm)."""
    f = V[:, 1] < 0.11
    u = np.clip((V[:, 2] - z1) / (zc - z1), 0, None)
    V[:, 2] = np.where(f & (u > 0), z1 + (zc - z1) * (1 - np.exp(-u)), V[:, 2])
    return V


SOLE = (0.034, 2)      # rows under 3.4 cm take that ring (tube_of's `hang`): the LEG master flares to a 20 cm wide skirt at the sole


def soled(c, y=0.0305):
    """Splits a shoe's tube at its welt: the faces wholly under y (the sole's edge and its underside) leave as a chunk of their own on
    the `metal_dark` slot, a dark sole under the upper: the one slot that is near black on all four sides' tables (`rubber` is the
    HAIR's colour on the sides that wear no gloves: a grey-haired man had grey soles). No triangle is added; the welt's ring is in
    both chunks."""
    low = (c['V'][:, 1] < y)[c['F']].all(1)
    out = []
    for fm, slot in ((~low, c['slot']), (low, 'metal_dark')):
        idx = np.unique(c['F'][fm])
        re = np.full(len(c['V']), -1)
        re[idx] = np.arange(len(idx))
        out.append(dict(c, V=c['V'][idx].copy(), W=c['W'][idx].copy(), F=re[c['F'][fm]], slot=slot))
    return out


def boots(top, slot='boot', sole=1.2, upper=0.8, shaft=0.050):
    rows = [(top, .25, 0), (top, upper + .1, shaft), (top - .05, upper, shaft), (.17, upper, shaft * .96), (.125, upper, shaft * .9),
            (.095, upper, 0), (.07, upper, 0), (.048, upper + .1, 0), (.031, upper + .25, 0), (.030, sole, 0), (.011, sole, 0)]
    ys, of, rm = [np.array(x) for x in zip(*rows)]
    of = of[:, None] + np.zeros((1, LEG.nseg))
    toe = np.clip(np.cos(TH_L), 0, 1) ** 3            # a toe cap: the instep rows reach further forward
    of[5] += 1.2 * toe
    of[6] += 3.0 * toe
    of[7] += 3.2 * toe
    of[8] += 1.0 * toe
    c = tube_of(LEG, ys, of, slot, 80, cap1=True, rmin=rm, hang=SOLE)      # (50 degrees split every ring of the toe into facets: a wedge of flats)
    V = blunt_toe(c['V'])
    V[V[:, 1] < 0.02, 1] = 0.0
    return both(soled(c))


def shoes(slot='boot'):
    rows = [(.120, .2, 0), (.120, .9, .046), (.095, .8, 0), (.07, .8, 0), (.048, .9, 0), (.031, 1.05, 0), (.030, 1.1, 0), (.011, 1.1, 0)]
    ys, of, rm = [np.array(x) for x in zip(*rows)]
    of = of[:, None] + np.zeros((1, LEG.nseg))
    toe = np.clip(np.cos(TH_L), 0, 1) ** 3
    for i, k in ((2, 1.0), (3, 2.4), (4, 2.6), (5, 0.8)):
        of[i] += k * toe
    c = tube_of(LEG, ys, of, slot, 80, cap1=True, rmin=rm, hang=SOLE)      # (50 degrees split every ring of the toe into facets: a wedge of flats)
    V = blunt_toe(c['V'])
    V[V[:, 1] < 0.02, 1] = 0.0
    return both(soled(c))


def part_op_boots():
    return boots(0.275)


def part_op_suit(mark='plain'):
    """Blouse, trousers, vest and its pouches, boots: every operator wears all three and nobody else wears any, so they are ONE
    part (they were three: two slots of the 32 went on a choice nobody makes)."""
    return part_op_uniform(mark) + part_op_kit() + part_op_boots() + (op_shoulder_marks() if mark == 'plain' else [])


def op_shoulder_marks():
    """The pair colour on the TOP of each shoulder: a panel 3 mm proud of the vest over the slope from the collar out to the sleeve
    head (the game's camera sees the crown of the head and the tops of the shoulders; the marking was on neither). It is a patch
    of the vest's own grid (the same rows, offsets and squaring as part_op_kit's top five rows: keep the two in step)."""
    ys = np.array([1.42, 1.45, 1.475, 1.495, 1.507])
    sth = np.abs(np.sin(TH_T))[None, :]
    plate = np.clip((np.abs(np.cos(TH_T))[None, :] - 0.45) / 0.3, 0, 1) * np.clip((1.43 - ys) / 0.05, 0, 1)[:, None]
    off = (VEST + 1.1 * plate) * CM + 0 * sth
    off[-3] = 2.7 * CM
    off[-2] = 2.0 * CM
    off[-1] = 0.7 * CM
    sq = 1 + 0.07 * sth ** 4 * np.clip((ys - 1.33) / 0.06, 0, 1)[:, None]
    Po, W = TORSO.sample(ys, off + 0.003, sq)
    Pi, _ = TORSO.sample(ys, off - 0.003, sq)
    rows = [1, 2, 3, 4, 4]      # (its lower edge is the tucked row at 1.45: begun a row lower it was a wedge down the chest)
    out = []
    for lo, hi in ((60, 120), (-120, -60)):
        cols = _cols(lo, hi)
        cols = [cols[0]] + cols + [cols[-1]]
        P = Po[rows][:, cols].copy()
        P[[0, -1], :] = Pi[[rows[0], rows[-1]]][:, cols]
        P[:, [0, -1]] = Pi[rows][:, [cols[0], cols[-1]]]
        out.append(grid_chunk(P, W[rows][:, cols], 'accent', 40.0, False))
    return out


def part_hands_glove():
    c = hands('rubber', grow=0.0012)
    c += both(tube_of(ARM, [.688, .688, .72, .745, .757], [1.5, 2.4, 2.2, 1.3, 0.25], 'rubber', 60))
    return c


def part_hands_skin():
    return hands('skin')


# ------------------------------------------------------------------------------------------------
# defenders / civilians
# ------------------------------------------------------------------------------------------------
def forearm_skin(x0=.40):
    return tube_of(ARM, [x0, x0 + .05, .52, .58, .64, .70, .758], [.05, .05, .05, .05, .05, .1, .15], 'skin', 180)


SOFT = [.30, .52, .70, .82, .92, .98]      # a defender's sleeve head: no shoulder cap


def soft_scale(n, head=SOFT):
    return np.array(list(head) + [1.0] * (n - len(head)))[:, None]


# a set-in sleeve's head (sleeve()): fuller at its third ring than SOFT, that ring's top sunk half as much again
SLEEVE_HEAD = [.30, .60, .86, .90, .95, .98]
SLEEVE_SINK = [1.0, 1.0, 1.5, 1.1, 0.4, 0.0]


def sink_head(P, xx, sink, inboard, share=None):
    """An arm tube's grid (rows at xx, ARM's columns) with the TOP of its head `sink` cm lower (the upper half of each ring, most
    at the top vertex; all of it to x .22, none from .34) and its rings up to x .30 `inboard` cm nearer the neck (not the first).
    share: the sink's share at x .135 .15 .19 .24 .30 .36 in place of that ramp."""
    P = P.copy()
    xx = np.asarray(xx, float)
    k = np.clip((.34 - xx) / .12, 0, 1) if share is None else np.interp(xx, [.135, .15, .19, .24, .30, .36], share)
    P[..., 1] -= sink * CM * k[:, None] * np.clip(np.cos(TH_A), 0, 1)[None, :]
    P[..., 0] -= (inboard * CM * np.clip((.30 - xx) / .08, 0, 1) * (xx > .136))[:, None]
    return P


def sleeve(xs, of, slot, fold, seed, head=0.86, drop=1.2, sink=1.5, inboard=1.0, arm_from=None, yoke=(1.0, 1.0, 0.5)):
    """A set-in sleeve: tube_of's arm tube with its HEAD (the first hand of it out of the armhole) slimmer and hung `drop` cm below
    the arm's own line. No skin is drawn under a sleeve, so its head need not go round the mannequin's deltoid: at the arm's full
    radius plus the cloth it stood above and outside the shirt's shoulder all the way round, a puffed sausage plugged into the trunk
    with a shadowed crease on the shoulder top, where the game's camera looks. Now the shoulder's line runs on down the sleeve.
    sink / inboard (cm): the head's TOP rows (the upper half of each ring, most at the top vertex) lie that much lower again and its
    first rings that much nearer the neck. The trunk's shoulder ends in a corner at x 0.165, y 1.457; the sleeve's top passed 1.5 cm
    over that corner, so with the arm down the head stood beside the yoke as a lobe of its own with a notch between, and with the
    arms back it rose as a horn beside the neck. Now the trunk's shoulder runs out over it.
    arm_from: rings from that x on ride the upper arm alone (a short sleeve's mouth: on the elbow's blend its lower half followed
    the forearm and the mouth stood open as a bell).
    The third ring (x .19, the first one outside the trunk) is the shoulder's point when the arm hangs: its TOP half rides the yoke
    wholly (its underside half, as it did all round). At half all round its top swung 2 cm out with the arm and stayed level, so
    from the front the sleeve left the trunk as a flat shelf 4 cm wide with a square outer corner, and with the arm forward the
    shelf was a flat lid with fanned pleats seen from behind; now the trunk's slope runs on down to the fourth ring. For that the
    ring is fuller (SLEEVE_HEAD: the head was a cone to a point in the armhole, its columns a fan) and its top lower (SLEEVE_SINK)."""
    xx = np.array([.135] + list(xs))
    sc = soft_scale(len(xx), SLEEVE_HEAD).copy()
    sc[:, 0] *= 1 - (1 - head) * np.clip((xx - .14) / .05, 0, 1) * np.clip((.44 - xx) / .12, 0, 1)
    tube_of(ARM, xx, [0.0] + list(of), slot, 60, fold=fold, seed=seed, cap0=True, scale=sc)
    P, W = tube_of.last.copy(), tube_of.lastW.copy()
    P[..., 1] -= (drop * CM * np.clip((.38 - xx) / .16, 0, 1))[:, None]
    P = sink_head(P, xx, sink, inboard, SLEEVE_SINK)
    # the rings inboard of the shoulder joint (x .192) ride the YOKE (the trunk's own weights at its shoulder), the first two wholly,
    # the third half. On the arm's weights (67 to 92 % upper arm round the ring) the plugged end swung the other way about the
    # joint: arms back, it came up out of the shoulder beside the neck
    Wsh = on(TORSO, 1.44, 90, 0)[1]
    for r, k in enumerate(yoke):
        if r == 2:
            k = (k + (1 - k) * np.clip(np.cos(TH_A) + 0.5, 0, 1))[:, None]
        W[r] = W[r] * (1 - k) + Wsh * k
    if arm_from is not None:
        W[xx >= arm_from - 1e-6] = Wj('DEF-upper_arm.L')
    return grid_chunk(P, W, slot, 60, True, True, False)


def arm_skin(head=None):
    """A bare arm from the shoulder. head: the first rings' share of the arm's radius (default SOFT, a sleeve's head, which under a
    strap top left a thin stalk plugged into the chest with daylight in the armpit: a ball-jointed doll)."""
    xs = [.135, .15, .19, .24, .30, .36, .42, .47, .52, .58, .64, .70, .758]
    sc = soft_scale(len(xs)) if head is None else np.array(list(head) + [1.0] * (len(xs) - len(head)))[:, None]
    return tube_of(ARM, xs, [0, .05, .05, .05, .05, .05, .05, .05, .05, .05, .05, .1, .15], 'skin', 180, cap0=True, scale=sc)


def wrist_skin():
    return tube_of(ARM, [.69, .72, .758], [.05, .1, .15], 'skin', 180)


def part_shirt_loose():
    S = 'cloth_plain'
    # (the hem sat at .905 and 4.3 cm off: in a crouch it stood round the hips as a stiff hoop with the thighs coming out from under it)
    ys = [.935, .935, .96, .99, 1.04, 1.10, 1.16, 1.22, 1.28, 1.33, 1.38, 1.42, 1.45, 1.475, 1.497, 1.52, 1.55, 1.55]
    of = [1.6, 3.6, 3.5, 3.3, 2.9, 2.7, 2.5, 2.3, 2.0, 1.7, 1.3, 1.0, 0.9, 0.9, 1.0, 1.2, 1.9, 0.3]
    c = [tube_of(TORSO, ys[:13], of[:13], S, 60, fold=0.9, seed=11, hang=(0.99, 2), tail=True, over_legs=0.6),
         tube_of(NECK, ys[12:], of[12:], S, 60)]
    xs = [.15, .19, .24, .30, .35, .39, .415, .44, .455, .455]
    # (the mouth stood 2.3 to 2.5 cm off the arm: a wide stiff bell. 15 % off its radius, and from x .39 it rides the upper arm alone)
    of = [0.6, 0.9, 1.3, 1.7, 1.8, 1.7, 1.7, 1.6, 1.4, 0.3]
    c += both([sleeve(xs, of, S, 0.5, 13, arm_from=.39), forearm_skin(.41)])
    return c


TANK_X = 0.074     # the tank top's straps: metres off the midline, of the bare shoulder


def part_tank_top():
    S = 'cloth_plain'
    ys = np.array([.972, .972, 1.0, 1.03, 1.08, 1.14, 1.20, 1.26, 1.32, 1.37, 1.41, 1.44, 1.462, 1.462])
    of = np.array([1.3, 2.3, 2.2, 2.0, 1.6, 1.4, 1.2, 1.2, 1.1, 1.0, 1.0, .9, .9, .25])
    # the top edge is CUT, not a level rim: a scooped neck in front, armholes at the sides, a shallower scoop behind, rising to a
    # point under each strap. (It was a tube cut off level at 1.462 with two straps laid on it: a bandeau with planks.) The rows
    # from 1.30 up are squeezed under that edge column by column.
    thf, thb = neck_th(1.45, TANK_X, False), neck_th(1.45, TANK_X, True)
    kth = np.array([0.0, thf, 0.5 * (thf + thb) - 6.0, thb, 180.0])
    ky = np.array([1.405, 1.462, 1.398, 1.462, 1.45])
    ad = np.abs(np.degrees((TH_T + np.pi) % (2 * np.pi) - np.pi))
    i = np.clip(np.searchsorted(kth, ad, side='right') - 1, 0, len(kth) - 2)
    u = (ad - kth[i]) / (kth[i + 1] - kth[i])
    top = ky[i] + (ky[i + 1] - ky[i]) * (0.5 - 0.5 * np.cos(np.pi * u))
    R, NS = len(ys), TORSO.nseg
    Y = np.repeat(ys[:, None], NS, 1)
    hi = ys > 1.30
    Y[hi] = 1.30 + (Y[hi] - 1.30) * ((top - 1.30) / (1.462 - 1.30))[None, :]
    o = np.repeat(of[:, None] * CM, NS, 1)
    o[1:-1] += folds(R, NS, 0.3 * CM, 21)[1:-1] * np.clip((1.40 - ys[1:-1]) / 0.1, 0, 1)[:, None]      # no lumps along the cut edge
    P, W = TORSO.at(Y.ravel(), np.tile(TH_T, R), o.ravel())
    c = [grid_chunk(P.reshape(R, NS, 3), W.reshape(R, NS, -1), S, 60, True, False, False),
         tube_of(NECK, [1.33, 1.37, 1.40, 1.43, 1.455, 1.48], [.2, .3, .3, .3, .2, -.2], 'skin', 180)]
    c += both(arm_skin([.66, .84, .95, 1.0]))      # a whole deltoid, grown out of the shoulder
    # two shoulder straps, each a line of the NECK master from inside the point of the front edge over the bare shoulder into the
    # point of the back edge (over_shoulder(): flat on the skin, the skin's own weights)
    for sx in (1, -1):
        p, n, w = over_shoulder(sx, lambda y: TANK_X, lambda y: TANK_X, 1.455, 1.455, lambda y: np.interp(y, [1.455, 1.47, 1.49], [0.2, 0.75, 0.55]))      # both ends begin under the cloth's edge
        c.append(band3d(p, n, 0.034, 0.004, S, weights=w))
    return c


def open_front(c, base_cm, k=0.8):
    """Cuts a real opening down the front of a TORSO / NECK tube chunk (rows x 24 columns): the +-30 deg columns become the two
    straight front edges (the cloth of the 45 and 60 deg columns carried on k of a column further), the +-15 deg columns a lip turned
    in behind each edge, and the faces between the lips are dropped. (The opening used to be the same tube dipped under the tee:
    its edge was wherever the dip's slope happened to cross the tee, a ragged line.)"""
    S = len(TH_T)
    deg = np.round(np.degrees((TH_T + np.pi) % (2 * np.pi) - np.pi)).astype(int)
    assert all(d in deg for d in (-60, -45, -30, -15, 0, 15, 30, 45, 60)), 'open_front(): the tube has no columns at 15 degree steps across the front'
    assert len(c['V']) == len(base_cm) * S, 'open_front(): one base_cm entry per row of the tube'
    col = {d: int(np.where(deg == d)[0][0]) for d in (-60, -45, -30, -15, 0, 15, 30, 45, 60)}
    V = c['V']
    R = len(base_cm)
    for r in range(R):
        for sg in (1, -1):
            e, a, b2, l = (r * S + col[sg * d] for d in (30, 45, 60, 15))
            V[e] = V[a] + (V[a] - V[b2]) * k
            V[e, 1] = V[a, 1]
            rad = norm(V[e] * [1, 0, 1])
            V[l] = V[e] - rad * max(base_cm[r] - 0.3, 0.2) * CM - np.array([sg * 0.006, 0, 0])
        V[r * S + col[0]] = (V[r * S + col[15]] + V[r * S + col[-15]]) / 2
    inner = {col[-15], col[0], col[15]}
    F = c['F']
    c['F'] = F[~np.array([all((v % S) in inner and v < R * S for v in f) for f in F])]
    return c


def part_jacket_open():
    S = 'cloth_plain'
    th = np.degrees(np.abs((TH_T + np.pi) % (2 * np.pi) - np.pi))
    front = th < 40                                           # the columns open_front() rebuilds
    ys = np.array([.925, .925, .96, 1.0, 1.06, 1.12, 1.18, 1.24, 1.30, 1.35, 1.40, 1.44, 1.47])
    base = np.array([2.0, 4.4, 4.3, 4.0, 3.6, 3.4, 3.2, 3.0, 2.8, 2.5, 2.1, 1.8, 1.6])
    c = [open_front(tube_of(TORSO, ys, base, S, 50, hang=(0.99, 2), tail=True, over_legs=(0.7, ~front)), base)]
    cy = np.array([1.47, 1.497, 1.52, 1.548, 1.548])
    cb = np.array([1.6, 1.7, 2.0, 2.6, 0.4])
    c.append(open_front(tube_of(NECK, cy, cb, S, 50), cb))
    # the tee under it, on the ACCENT slot: a colour of its own from the side's table (on the trousers' slot the man read as wearing a one-piece)
    c.append(tube_of(TORSO, [.985, 1.0, 1.10, 1.20, 1.30, 1.38, 1.44, 1.47], [1.9, 1.9, 1.5, 1.2, 1.1, 1.0, .9, .9], 'accent', 180))
    # a crew neck up to 1.540: it stopped at 1.512 and left a strip of the dipped jacket above it that the neck's skin came through (the hole at the collar)
    c.append(tube_of(NECK, [1.47, 1.495, 1.52, 1.540, 1.540], [.9, .8, .8, .8, .15], 'accent', 60))
    xs = [.15, .19, .24, .30, .36, .42, .455, .49, .54, .60, .66, .70, .728, .728]
    of = [0.6, 0.9, 1.3, 1.6, 1.7, 1.6, 1.5, 1.6, 1.6, 1.5, 1.4, 1.4, 1.6, 0.3]
    c += both([sleeve(xs, of, S, 0.35, 23, head=0.9), wrist_skin()])
    # two patch pockets
    for thd in (-52, 52):
        c.append(stuck(TORSO, 1.115, thd, 3.9, [0.05, 0.042, 0.006], S, None, 0.004, 50))
    # a collar and lapels (the neck was a plain stand: a cardigan). The collar: a leaf turned down over the stand round the back and
    # sides, ending either side of the opening. The lapels: a flap lying on each front from the notch under the collar's end down to
    # the middle of the chest, cut from the front's own edge (the 30 deg column open_front() laid) and carrying its weights.
    n_ = len(TH_T)
    deg = np.round(np.degrees(TH_T)).astype(int) % 360
    cols = [int(np.where(deg == d)[0][0]) for d in range(45, 316, 15)]
    end = np.clip((np.abs(np.arange(len(cols)) - (len(cols) - 1) / 2) - (len(cols) - 1) / 2 + 1.0), 0, 1)      # 1 at the two end columns
    leaf = [(1.526 + 0.020 * end, 2.0 + 0 * end), (1.523 + 0.023 * end, 2.9 - 0.1 * end), (1.548 + 0.004 * end, 3.0 + 0 * end),
            (1.562 - 0.004 * end, 2.9 + 0 * end), (1.556 - 0.004 * end, 0.7 + 0 * end)]
    P = np.zeros((len(leaf), len(cols), 3))
    W = np.zeros((len(leaf), len(cols), NJ))
    for r, (yy, oo) in enumerate(leaf):
        P[r], W[r] = NECK.at(yy, TH_T[cols], oo * CM)
    c.append(grid_chunk(P, W, S, 40, False))
    body, stand = c[0], c[1]
    assert len(body['V']) == len(ys) * n_ and len(stand['V']) == len(cy) * n_, 'part_jacket_open(): c[0] / c[1] are not the body and the stand'
    for sg in (1, -1):
        e, a = int(np.where(deg == (sg * 30) % 360)[0][0]), int(np.where(deg == (sg * 45) % 360)[0][0])
        P, W = [], []
        for ch, r, wd in ((body, 8, 0.4), (body, 9, 2.4), (body, 10, 4.4), (body, 11, 5.8), (body, 12, 6.6), (stand, 1, 6.6), (stand, 2, 5.4)):
            E, A_ = ch['V'][r * n_ + e], ch['V'][r * n_ + a]
            d = norm((A_ - E) * np.array([1, 0, 1]))
            nrm = np.array([d[2] * sg, 0, -d[0] * sg])                       # square to the cloth, outward
            nrm = nrm * np.sign(nrm @ (E * np.array([1, 0, 1]))) + np.array([0, 0.25, 0]) * (ch is stand)
            P.append([E - d * 0.006 + nrm * 0.008, E + d * wd * CM * 0.5 + nrm * 0.010, E + d * wd * CM + nrm * 0.007])
            W.append([ch['W'][r * n_ + e]] * 3)
        P = np.array(P)
        c.append(slab_loop(P, [0.006] * len(P), S, 50, np.array(W), out=P[3, 1] * np.array([1, 0, 1])))
    return c


def part_shirt_tucked():
    S = 'cloth_plain'
    c = [tube_of(TORSO, [1.035, 1.035, 1.06, 1.10, 1.16, 1.22, 1.28, 1.33, 1.38, 1.42, 1.45],
                 [.9, 1.8, 2.0, 1.8, 1.7, 1.6, 1.5, 1.4, 1.2, 1.0, 0.9], S, 60, fold=0.45, seed=31),
         tube_of(NECK, [1.45, 1.475, 1.497, 1.52, 1.55, 1.55], [0.9, 0.9, 1.0, 1.2, 1.8, .3], S, 60)]
    xs = [.15, .19, .24, .30, .36, .42, .455, .49, .54, .60, .66, .70, .728, .728]
    of = [0.6, 0.9, 1.2, 1.5, 1.5, 1.5, 1.4, 1.5, 1.5, 1.4, 1.3, 1.3, 1.5, 0.3]
    c += both([sleeve(xs, of, S, 0.4, 33), wrist_skin()])
    # a turned-down collar: a third as wide as the ring it was (which lay out over the shoulders like a cape, under the rig's straps);
    # it hugs the neck at the sides and back and comes down to two short points in front
    front = np.clip(np.cos(TH_T), 0, 1) ** 2
    vee = np.exp(-(((TH_T + np.pi) % (2 * np.pi) - np.pi) / 0.30) ** 2)      # 1 at the throat, 0.47 a column out: the V the collar opens in
    # (the lower edge stands 3 mm proud of the shirt's own neck, 1.8 cm at y 1.55, so it reads as turned down over it; at the sides it ends at
    # r = 9.2 cm, inside the chest rig's straps, which ride x = 10.6 +- 2.1 cm)
    # In front the whole collar is 2 cm lower again than its first lowering (3.4 cm under the back of it) and OPEN: the two leaves end either
    # side of a V whose foot is the knot, the shirt's own neck band comes down with them, and band and collar carry the YOKE's weights
    # (the shoulders'), not the neck's: on the neck's the front rode 84 % with the head, and when he bowed it the collar came up to his
    # moustache with it (a scarf from the game's camera).
    n_ = len(TH_T)
    _, Wy = NECK.at(np.full(n_, 1.462), TH_T, 0.0)
    ky = (0.55 + 0.45 * (0.5 + 0.5 * np.cos(TH_T)))[:, None]                 # how much of the yoke: all of it in front, 55 % behind

    def neck_row(yy, oo, k=1.0):
        P_, W_ = NECK.at(yy + 0 * TH_T, TH_T, oo * CM + 0 * TH_T)
        return P_, W_ * (1 - ky * k) + Wy * ky * k
    band = c[1]                                                             # the shirt's neck band: the NECK tube above, rows 2..5 laid again
    assert len(band['V']) == 6 * n_, 'part_shirt_tucked(): c[1] is not the six-row neck band'
    top = 1.55 - 0.030 * front - 0.028 * vee
    for r, (yy, oo, k) in enumerate(((1.497 - 0.017 * vee, 1.0, 0), (1.52 - 0.012 * front - 0.022 * vee, 1.3 - 0.1 * vee, 0.25), (top, 1.8 - 0.6 * vee, 0.6), (top, 0.3, 0.6)), 2):    # k: the rows that lie ON the neck keep its weights, or the skin under them comes through in a bow
        band['V'][r * n_:(r + 1) * n_], band['W'][r * n_:(r + 1) * n_] = neck_row(yy, oo, k)
    lo = 1.548 - 0.050 * front                                              # the leaves' lower edge: 1.498 at the throat
    hi = lambda y: np.maximum(y - 0.034 * front - 0.045 * vee, lo + 0.002)  # their fold: down to the lower edge in the V
    rows = [(lo, 0.9 + 0 * front), (lo, 2.1 + 0.4 * front - 1.1 * vee), (hi(1.562) - 0.004 * (1 - vee), 1.9 + 0.2 * front - 0.8 * vee),
            (hi(1.574), 1.35 - 0.3 * vee), (hi(1.574), 0.4 + 0 * front)]
    P = np.zeros((len(rows), n_, 3))
    W = np.zeros((len(rows), n_, NJ))
    for r, (yy, oo) in enumerate(rows):
        P[r], W[r] = neck_row(yy, oo)
    c.append(grid_chunk(P, W, S, 40, True))
    # the inside of the collar: a ring from the leaves' fold down and in to the neck (its lower row 1 cm inside the neck master, under
    # the skin, on the neck's own weights). There was nothing between the collar and the neck: from above one looked down a black
    # gap inside the collar, widest at the sides of the open V.
    Pi = np.zeros((2, n_, 3))
    Wi = np.zeros((2, n_, NJ))
    Pi[0], Wi[0] = neck_row(hi(1.574), 0.4)
    Pi[1], Wi[1] = neck_row(hi(1.574) - 0.026, -1.1, 0)
    inner = grid_chunk(Pi, Wi, S, 180, True)
    inner['F'] = inner['F'][:, ::-1].copy()      # it faces up and in, at whoever looks down the collar
    c.append(inner)
    # belt + buckle, a tie on the ACCENT slot (the side's table says what it is: a civilian's tie, the response team's, or the shirt's own colour = no tie)
    c.append(mband(TORSO, 1.012, 1.048, 1.3, 2.3, 'boot'))
    c.append(stuck(TORSO, 1.030, 0, 2.5, [0.022, 0.017, 0.004], 'metal_dark', 'DEF-hips', 0.003))
    ty = [1.505, 1.49, 1.47] + [round(float(y), 3) for y in np.arange(1.44, 1.09, -0.03)] + [1.075]      # a section every 3 cm: with five down the chest the shirt's own rows bulged out through the straight runs between them in a bow
    p, n = tpath([(y, 0) if y > 1.46 else (y, 0, 2.5 + 0.5 * min(1.0, (1.46 - y) / 0.06)) for y in ty], 2.5)
    # every cross-section rides the SHIRT's front under it (the cloth master's weights at its centre; the two in the collar's V the
    # yoke's, like the knot). On the nearest body vertex's weights, vertex by vertex, the two edges of the strip took different bones
    # where he bent at the waist and the tie came apart into separate pieces.
    yoke = Wy[int(np.argmin(np.abs((TH_T + np.pi) % (2 * np.pi) - np.pi)))]
    tw = np.array([yoke if y > 1.48 else on(TORSO, y, 0, 2.5)[1] for y in ty])
    tie = band3d(p, n, 0.05, 0.006, 'accent', weights=tw)
    tie['V'][:, 0] *= np.interp(tie['V'][:, 1], [1.40, 1.47], [1.0, 0.58])      # the blade narrows up into the knot (it was 5 cm wide all the way: wider than the knot, which was lost in it)
    c.append(tie)
    # the knot sits IN the collar's V, at its foot, and moves with the yoke like the collar round it (it was rigid on the chest a
    # knot's height below a collar that followed the neck, then on the neck's weights at y 1.522 behind a closed collar)
    kw = Wy[int(np.argmin(np.abs((TH_T + np.pi) % (2 * np.pi) - np.pi)))]
    kp = on(NECK, 1.497, 0, 2.8)[0]
    knot = box(kp, [0.0135, 0.016, 0.010], 'accent', None, None, 0.004, taper=(1.6, 1.15))      # a wedge: 2.7 cm wide at its foot, 4.3 at the top
    knot['W'] = np.repeat(kw[None, :], len(knot['V']), 0)
    c.append(knot)
    return c


def part_trousers_fatigue():
    U = 'cloth_uniform'
    ys = [.985, .95, .90, .84, .77, .70, .63, .575, .535, .495, .44, .37, .30, .23, .16, .105, .105]
    of = [1.0, 1.8, 2.6, 2.8, 2.7, 2.5, 2.3, 2.1, 2.0, 2.0, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 1.1]
    # a floor on every ring from the seat down: the leg HANGS as one straight, slightly tapering tube. (Only the rows under the knee had
    # one: above it the cloth followed thigh, knee and the pinch between them at 2 cm, which read as tights.)
    rm = [0, .100, .106, .105, .102, .098, .094, .091, .089, .087, .086, .085, .085, .085, .085, .085, .058]
    return trousers(U, 1.6, ys, of, rm, 0.6, 17)


def part_trousers_jeans():
    U = 'cloth_uniform'
    ys = [.985, .95, .90, .84, .77, .70, .63, .575, .535, .495, .44, .37, .30, .23, .16, .09, .09]
    of = [1.0, 1.4, 1.7, 1.7, 1.6, 1.5, 1.4, 1.3, 1.3, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, .8]
    rm = [0, .092, .097, .095, .091, .087, .082, .078, .075, .073, .072, .072, .072, .072, .072, .073, .050]      # a straight leg, a size under the fatigues
    return trousers(U, 1.4, ys, of, rm, 0.3, 19)


def part_boots_low():
    return boots(0.20)


def part_shoes():
    return shoes()


# ---- heads
def part_hair_full():
    # fuller hair with a side PARTING on his left: the groove runs back from the hairline toward the crown along one column, the
    # hair on the big side lifts off it and lies over to his right (a lower fringe there), a sideburn in front of each ear.
    # Nothing varies round the crown itself any more: five lobes all the way up met at the pole in a star, dead centre from above.
    rim = rim_cols([.715, .742, .765, .735, .695, .655, .43, .39, .46, .40, .237, .189, .139, .113, .08,
                    .113, .139, .189, .237, .40, .46, .39, .43, .655, .680, .705, .690, .700])
    part = np.zeros(28)
    part[[0, 1, 2, 3, 27, 26]] = [0.0030, 0.0045, -0.0065, 0.0015, 0.0020, 0.0010]

    def off(g, th):
        body = 0.011 + 0.010 * np.sin(g * np.pi) + 0.003 * np.sin(th * 5 + g * 4) * (1 - g) ** 0.7
        return feather(g, body + part * (1 - _ss(g, 0.60, 0.90)), over=0.06)
    return [over_neck(H.shell(WH, rim, off, 'rubber', gs=[.06, .18, .36, .56, .75, .89, .97, 1.0], rim_in=-0.002), 0.011)]


def _ss(u, a, b):
    t = np.clip((u - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hat_brim(h, reach, drop, slot, S=28, off0=0.012, thick=0.005):
    """A soft hat's brim: a ring out from the head at height h whose reach(th) and drop(th, v) (v 0 at the crown, 1 at the edge;
    negative = it turns UP) are the caller's, with a row half way out so it can hang or curl."""
    th = H.thetas(S, 0.0)
    root = H.surf(h, th, off0)
    out = norm((root - np.array([0, 0, H.Z0])) * np.array([1, 0, 1]))
    rows = []
    for v, t in ((-0.16, 0), (0.5, 0), (1.0, 0), (1.0, thick), (-0.16, thick)):
        q = root + out * (reach(th) * v)[:, None]
        q[:, 1] -= drop(th, max(v, 0)) + t
        rows.append(q)
    P = np.stack(rows)
    return grid_chunk(P, np.broadcast_to(WH, P.shape[:2] + (NJ,)), slot, 40.0, True, False, False)


def part_hat_boonie():
    # a SOFT bush hat: a straight-sided crown with a crease pressed into its top from front to back, a dark band 23 mm tall standing
    # proud of the crown all round (under the old crown's bulge it was hidden from above), and a brim that hangs and waves and is
    # turned UP on his left: from the game's camera the outline is lopsided, not a disc
    rim = H.rim_interp([0, 180], [.61, .58])

    def crown_off(g, th):
        h = rim(th) + (1 - rim(th)) * g
        x = H._prof(np.minimum(h, 1.0))[0] * np.sin(th)                      # metres off the midline
        return 0.017 + 0.014 * _ss(g, 0.30, 0.72) + 0.003 * np.sin(th * 4 + 1.3) * np.sin(g * np.pi) - 0.017 * np.exp(-(x / 0.016) ** 2) * _ss(g, 0.72, 0.93)
    crown = H.shell(WH, rim, crown_off, 'helmet', gs=[.16, .34, .52, .66, .78, .88, .95, 1.0], angle=50)
    up = lambda th: np.exp(-(((th - np.pi / 2 + np.pi) % (2 * np.pi) - np.pi) / 0.70) ** 2)      # 1 over his left ear
    brim = hat_brim(0.625, lambda th: 0.080 * (1 + 0.16 * np.sin(th * 3 + 0.7)) * (1 - 0.40 * up(th)),
                    lambda th, v: (0.032 * v * v + 0.006 * np.sin(th * 2 + 1.0) * v) * (1 - up(th)) - 0.030 * up(th) * v ** 1.4, 'helmet')
    return [crown, brim, H.band(WH, 0.628, 0.720, 0.013, 0.0215, 'rubber', mid=1)]


def part_hat_straw():
    rim = H.rim_interp([0, 180], [.62, .60])
    # straw on the ACCENT slot (the irregulars' accent row is pale naturals: straw, undyed cotton), not on `helmet`, whose list would deal it a blue or a red
    crown = H.shell(WH, rim, lambda g, th: 0.030 + 0.008 * np.sin(g * np.pi) + 0 * th, 'accent', K=5, angle=50)
    # (the brim 15 % in: at 12.5 cm it hid the whole man from the game's camera)
    return [crown, H.ring_brim(WH, 0.635, 0.106, 0.006, 'accent', droop=0.012, wave=0.05, off0=0.03),
            H.band(WH, 0.655, 0.715, 0.029, 0.036, 'rubber')]


BANDANA = 'webbing'


def part_bandana():
    # cloth tied on the skull, on the WEBBING slot (the irregulars' olive canvas: one DARK dyed cloth for every man who wears it,
    # and no head's hair colour. On the trousers' slot it drew khaki as often as not, and cap, bandana and straw hat were three tan
    # heads among five; on `accent` it was the palest thing on the floor and two reviewers read it as a white beanie / a chef's cap;
    # on `helmet` it drew the caps' and the boonie's colours and read as a small helmet from above; `boot` is within a shade of
    # brown hair). Low on the forehead, outside the short hair under it (1 cm). A square folded to a
    # triangle: the folded edge is a band 3 mm proud round the head with a hard step where it ends (the fold line), the cloth is
    # pleated in toward the KNOT at the back of the head, and the two ends hang 11 cm down the nape (it was a smooth dome with a
    # tab behind one ear: a swimming cap)
    rim = H.rim_interp([0, 40, 75, 120, 180], [.625, .615, .56, .47, .38])
    pleat = np.where(np.arange(28) % 2 == 0, 1.0, -1.0)

    def fold(g, th):
        back = np.clip(-np.cos(th), 0, 1) ** 2
        return (0.0125 + 0.003 * (g < 0.30) + 0.004 * (1 - g) ** 0.5 * np.sin(th * 5 + g * 9) * np.sin(g * 4 + th) * (1 - back)
                + 0.0035 * pleat * back * np.sin(np.clip(g / 0.6, 0, 1) * np.pi) ** 0.6)
    c = [over_neck(H.shell(WH, rim, fold, BANDANA, gs=[.12, .28, .31, .46, .62, .78, .89, .96, 1.0], angle=35), 0.008)]
    k = H.surf(0.395, np.pi, 0.022)
    c.append(rig(ellipsoid(k, [0.021, 0.015, 0.014], BANDANA, nu=6, nv=3), 'DEF-head'))
    for sx, ln in ((1, 1.0), (-1, 0.88)):
        pts = k + np.array([[sx * 0.010, -0.006, -0.004], [sx * 0.022, -0.058 * ln, 0.010], [sx * 0.040, -0.116 * ln, 0.027]])
        c.append(tube(pts, [0.012, 0.017, 0.013], BANDANA, WH.reshape(1, -1), nseg=6, angle=40, up=(0, 0, -1), squash=0.2))
    return c


# ---- defenders' load carrying
RIG_X = 0.092      # the chest rig's straps over the shoulder: metres off the midline, of the body under the cloth


def part_chest_rig():
    c = []
    for thd in (-31, 0, 31):
        # every cell 10 mm shallower than it was (the left one was 18 mm into the forearm in the relaxed carry)
        c.append(stuck(TORSO, 1.165, thd, 4.4, [0.041, 0.085, 0.017], 'webbing', 'DEF-spine.002', 0.008))
        c.append(stuck(TORSO, 1.228, thd, 4.7, [0.043, 0.026, 0.018], 'webbing', 'DEF-spine.002', 0.005))
        c.append(stuck(TORSO, 1.195, thd, 6.5, [0.006, 0.012, 0.004], 'metal_dark', 'DEF-spine.002', 0.002))
    for thd in (-60, 60):
        c.append(stuck(TORSO, 1.15, thd, 3.9, [0.028, 0.052, 0.013], 'webbing', 'DEF-spine.002', 0.007))
    c.append(mband(TORSO, 1.098, 1.135, 2.4, 4.0, 'webbing'))
    for sx in (1, -1):
        # each point rides its own height off the body: the loose shirt's offset there + 0.8 cm (one 2.6 cm offset stood the strap a
        # centimetre and more off the upper back and buried it in the shirt at the waist)
        # over the shoulder the strap is a line of the NECK master (over_shoulder()): flat on the slope between neck and
        # shoulder cap, a hand inside the sleeve head, clear of the collar; its two runs on chest and back as before
        p, n, w = over_shoulder(sx, lambda y: np.interp(y, [1.38, 1.46], [0.072, RIG_X]), lambda y: np.interp(y, [1.38, 1.46], [0.064, RIG_X]),
                                1.38, 1.385, lambda y: np.interp(y, [1.38, 1.43, 1.50], [2.1, 1.9, 2.0]),
                                front=[(1.235, 22, 3.0), (1.31, 24, 2.6)],
                                back=[(1.34, 163, 2.4), (1.29, 166, 2.7), (1.23, 168, 3.0), (1.17, 169, 3.2), (1.13, 169, 3.3)])
        c.append(band3d(p, n, 0.038, 0.010, 'webbing', lift=0.002, weights=w))
    return c


BANDO_X = 0.122    # the bandolier over the left shoulder: metres off the midline (the tank top's strap ends at 0.091)


def part_bandolier():
    # one loop from his right hip up the front, over the LEFT shoulder and down the back to the hip again. Over the shoulder it is
    # an over_shoulder() run like the rig's straps: on the skin, flat on the slope, the cloth's weights (it was three level points
    # 1.7 cm in the air there: a faceted plank with a black gap under it), and BANDO_X off the midline it lies clear of the tank
    # top's strap beside it instead of half on it.
    o = 1.7
    p, n, w = over_shoulder(1, lambda y: np.interp(y, [1.39, 1.45, 1.52], [0.074, 0.118, BANDO_X]), lambda y: np.interp(y, [1.39, 1.445, 1.52], [0.093, 0.120, BANDO_X]),
                            1.39, 1.39, lambda y: np.interp(y, [1.40, 1.44, 1.48], [1.6, 1.3, 0.5]),
                            front=[(1.02, -95, o), (1.035, -62, o), (1.08, -34, o), (1.15, -14, o), (1.24, 4, o), (1.33, 20, o)],
                            back=[(1.345, 156, 1.4), (1.30, 162, 1.5), (1.20, 182, 1.8), (1.10, 205, o + 0.3), (1.04, 232, o), (1.02, 265, o)])      # (close on the shoulder blade: at 1.7 cm from the shoulder's top straight to y 1.30 it bridged the hollow there and stood off the back like a handle)
    c = [band3d(p, n, 0.052, 0.010, 'webbing', weights=w)]
    # cartridge pockets down the front run
    for y, thd in ((1.375, 31), (1.305, 15.5), (1.24, 4), (1.175, -9), (1.115, -24)):
        c.append(stuck(TORSO, y, thd, 3.6, [0.030, 0.024, 0.013], 'webbing', None, 0.005, roll=-38))
    return c


# ---- the operators' roles: what each carries on his back
def back(y, off_cm, thd=180):
    return on(TORSO, y, thd, VEST + 1.1 + off_cm)[0]


BK = 'DEF-spine.003'


def part_kit_rifleman():
    p = back(1.285, 6.0)
    return [rig(box(p, [0.115, 0.140, 0.062], 'webbing', None, None, 0.030, 180), BK),
            rig(box(p + np.array([0, 0.105, -0.006]), [0.120, 0.042, 0.068], 'webbing', None, None, 0.016, 60), BK),
            rig(box(p + np.array([0, -0.05, -0.066]), [0.080, 0.065, 0.022], 'webbing', None, None, 0.012, 60), BK)]


def part_kit_medic():
    p = back(1.265, 9.0)
    c = [rig(box(p, [0.150, 0.190, 0.092], 'webbing', None, None, 0.035, 180), BK),
         rig(box(p + np.array([0, -0.06, -0.10]), [0.10, 0.08, 0.028], 'webbing', None, None, 0.012, 60), BK)]
    for sx in (1, -1):
        c.append(rig(box(p + np.array([sx * 0.168, -0.06, 0.0]), [0.030, 0.085, 0.052], 'webbing', None, None, 0.012, 60), BK))
    roll = tube([p + np.array([-0.17, 0.225, 0.005]), p + np.array([0.17, 0.225, 0.005])], [0.054, 0.054], 'cloth_uniform', np.zeros((1, NJ)), nseg=10, angle=50)
    c.append(rig(roll, BK))
    for x in (-0.09, 0.09):
        c.append(rig(box(p + np.array([x, 0.225, 0.005]), [0.012, 0.058, 0.058], 'webbing', None, None, 0.01, 60), BK))
    return c


def part_kit_lead():
    p = back(1.315, 5.2)
    c = [rig(box(p, [0.098, 0.125, 0.052], 'metal_dark', None, None, 0.008), BK),
         rig(box(p + np.array([0, -0.07, 0.0]), [0.104, 0.065, 0.057], 'webbing', None, None, 0.010, 50), BK),
         rig(box(p + np.array([-0.045, 0.132, 0.0]), [0.022, 0.012, 0.022], 'metal_dark', None, None, 0.004), BK)]
    a0 = p + np.array([0.075, 0.125, -0.02])
    c.append(rig(tube([a0, a0 + [0, 0.04, 0]], [0.014, 0.011], 'metal_dark', np.zeros((1, NJ)), nseg=6, angle=50), BK))
    top = 1.87
    mid = (a0[1] + 0.04 + top) / 2
    c.append(rig(box([a0[0] + 0.012, mid, a0[2] - 0.055], [0.012, (top - a0[1] - 0.04) / 2 + 0.01, 0.0035], 'metal_dark', None, rot_xyz(-14, 0, -3), 0.002), BK))
    # the handset clipped on the left shoulder strap
    c.append(stuck(TORSO, 1.40, 36, VEST + 2.0, [0.018, 0.042, 0.015], 'rubber', BK, 0.006))
    return c


def part_kit_breacher():
    a = back(1.47, 4.2, 206)
    b = back(1.09, 4.6, 152)
    d = norm(b - a)
    a, b = a + d * 0.01, b + d * 0.13
    c = [rig(tube([a, b], [0.030, 0.030], 'metal_dark', np.zeros((1, NJ)), nseg=8, angle=50), BK)]
    side = norm(np.cross(d, [0, 0, 1]))
    for f in (0.3, 0.7):          # the ram's two handles
        q = a + (b - a) * f + np.array([0, 0, -0.045])
        c.append(rig(box(q, [0.045, 0.008, 0.012], 'metal_dark', None, rot_xyz(0, 0, np.degrees(np.arctan2(d[1], d[0]))), 0.003), BK))
    c.append(rig(box(a - d * 0.012, [0.040, 0.040, 0.040], 'metal_dark', None, rot_xyz(0, 0, np.degrees(np.arctan2(d[1], d[0]))), 0.008), BK))
    # charge satchel low on the other side, a shell bandolier across the chest
    c.append(stuck(TORSO, 1.19, 204, VEST + 1.1 + 3.0, [0.075, 0.085, 0.030], 'webbing', BK, 0.014, 60))
    for thd in (-34, -22, -10, 2, 14, 26):
        c.append(stuck(TORSO, 1.385 + 0.0006 * thd, thd, VEST + 2.2, [0.012, 0.026, 0.011], 'metal_dark', BK, 0.003))
    return c


def part_kit_slick():
    p = back(1.30, 2.6)
    c = [rig(box(p, [0.075, 0.170, 0.026], 'webbing', None, None, 0.02, 60), BK),
         rig(box(p + np.array([0, 0.150, -0.004]), [0.035, 0.022, 0.030], 'rubber', None, None, 0.008), BK)]
    q, n = tpath([(1.44, 150), ('top', 0.085, -0.085), ('top', 0.088, -0.02), ('top', 0.085, 0.035), (1.42, 30), (1.36, 27), (1.31, 26)], VEST + 0.8)
    c.append(rig(tube(q + norm(n) * 0.008, [0.007] * len(q), 'rubber', np.zeros((1, NJ)), nseg=5), BK))
    return c


# ------------------------------------------------------------------------------------------------
# the response team's own outline
# ------------------------------------------------------------------------------------------------
RSP_VEST = 3.7      # cm off the body: over the tucked duty shirt (2.0) and its tie (3.1)


def part_rsp_kit():
    """What makes the response team ITS OWN shape from the game's camera: a full-cut steel helmet with a rolled rim (no band, no
    goggles, no ear cups: the operators' is high-cut with all three), a flak vest with a standing collar and stiff shoulder caps
    (squared shoulders nobody else has), a poncho roll across the small of the back (the operators carry high on the back, the
    irregulars nothing) and a belt of pouches. Worn over shirt_tucked: the tie is under the vest, its knot behind the collar."""
    c = []
    rim = H.rim_interp([0, 45, 75, 105, 135, 180], [.60, .575, .41, .36, .31, .30])
    hoff = lambda g, th: 0.027 + 0.004 * (1 - g) + 0 * th
    c.append(H.shell(WH, rim, hoff, 'helmet', K=6, angle=50, rim_in=0.008))
    c.append(H.band(WH, lambda th: rim(th) - 0.012, lambda th: rim(th) + 0.028, 0.027, 0.0355, 'helmet'))
    c.append(chin_strap(0.50))         # (the full-cut rim is at h 0.43-0.46 there)
    # the element's mark (accent: white on their table): a 4 cm stripe from the brow over the crown and on DOWN THE BACK of the helmet to
    # its rim band (at 5.6 cm and stopping just past the crown it was a blaze, and the camera behind him saw its short end), 3 mm proud
    # of its facets and dead centre, and a bar across the back of the vest below. Helmet, vest and shirt were one dark mass from the
    # game's camera, and nothing said which way a man faced. (It was an 8 cm disc on the crown: a 14-sided cap over a 28-sided
    # shell, its edge uneven and its middle forward of the crown: a bald patch.)
    c.append(crown_stripe(-0.004, STRIPE_PROUD, 0.020, 0.80, n=13, face=shell_face(rim, hoff, K=6), h_back=0.335))
    # the vest: plates front and back, thinner under the arms (the carry's elbow), closing on the shoulder under the collar
    ys = np.array([1.065, 1.065, 1.10, 1.16, 1.22, 1.28, 1.33, 1.38, 1.42, 1.45, 1.475, 1.495, 1.507])
    cth = np.cos(TH_T)[None, :]
    sth = np.abs(np.sin(TH_T))[None, :]
    plate = np.clip((np.abs(cth) - 0.45) / 0.3, 0, 1) * np.clip((ys - 1.09) / 0.04, 0, 1)[:, None] * np.clip((1.43 - ys) / 0.05, 0, 1)[:, None]
    flank = np.clip((sth - 0.85) / 0.12, 0, 1) * np.clip((ys - 1.09) / 0.05, 0, 1)[:, None] * np.clip((1.36 - ys) / 0.05, 0, 1)[:, None]
    off = (RSP_VEST + 0.9 * plate - 1.3 * flank) * CM + 0 * cth
    off[0] = 2.3 * CM
    # the top closes on the shoulders, but stays proud across the throat: the shirt's tie (2.5 cm + its own thickness) runs under it
    front = np.clip((cth[0] - 0.80) / 0.12, 0, 1)
    off[-3] = (3.2 + 1.3 * front) * CM
    off[-2] = (2.7 + 1.7 * front) * CM
    off[-1] = (1.6 + 2.4 * front) * CM
    sq = 1 + 0.06 * sth ** 4 * np.clip((ys - 1.33) / 0.06, 0, 1)[:, None]
    P, W = TORSO.sample(ys, off, sq)
    c.append(grid_chunk(P, W, 'webbing', 55))
    # the standing collar: a thick ring round the neck, outside the shirt's own collar and the tie's knot. At the BACK it stands:
    # 4.5 cm higher there (to y 1.605) and drawn in to the neck at its top, so the camera behind and above does not look down
    # inside it at a bare nape (level all round and 4 cm off the neck, it hid nothing from there)
    bk = np.clip(-np.cos(TH_T), 0, 1)[None, :] ** 0.6
    col = tube_of(NECK, [1.503, 1.503, 1.530, 1.560, 1.560], np.array([2.4, 3.9, 4.5, 4.2, 3.1])[:, None] - np.array([0, 0, 1.3, 2.9, 2.7])[:, None] * bk, 'webbing', 50)
    V = col['V']
    V[:, 1] += 0.045 * np.clip((V[:, 1] - 1.503) / 0.057, 0, 1) * np.clip(-V[:, 2] / np.maximum(np.hypot(V[:, 0], V[:, 2]), 1e-6), 0, 1) ** 0.6
    # in FRONT it is 2 cm lower (to y 1.54) and rides the yoke, not the neck: level at 1.56 on the neck's weights it came up with the
    # head when he crouched and bowed it, and his chin and mouth were inside the collar
    fr = np.clip(np.cos(np.tile(TH_T, 5)), 0, 1)
    V[:, 1] -= 0.020 * np.clip((V[:, 1] - 1.503) / 0.057, 0, 1) * fr ** 0.7
    _, Wy = NECK.at(np.full(len(TH_T), 1.462), TH_T, 0.0)
    kf = (fr ** 0.5)[:, None]
    col['W'] = col['W'] * (1 - kf) + np.tile(Wy, (5, 1)) * kf
    c.append(col)
    # and a throat flap from the vest's top edge up to it, over the knot
    c.append(stuck(TORSO, 1.500, 0, 3.9, [0.040, 0.022, 0.006], 'webbing', 'DEF-spine.003', 0.005))
    # shoulder caps: a stiff band over each sleeve head, tapered in to the shoulder seam at its top and standing off the sleeve below it
    # (closed over the sleeve head like a sleeve of its own, and its lower edge turned in under the shirt's: an open band there
    # showed as a hollow hoop with the sleeve inside whenever the arm came up)
    c += both(tube_of(ARM, [.139, .15, .19, .24, .285, .285], [0.3, 2.3, 2.9, 3.0, 2.7, 1.3], 'webbing', 50, cap0=True, scale=np.array([.30, .52, .72, .86, .90, .80])[:, None]))
    # three magazine pouches low on the front, a radio high on the left with a stub antenna. The pouches, the belt and its two hip
    # pouches are on the HELMET slot: the helmet's grey, three steps lighter than the vest (on `webbing` they vanished on it)
    POUCH = 'helmet'
    for thd in (-25, 0, 25):
        c.append(stuck(TORSO, 1.150, thd, RSP_VEST + 1.6, [0.036, 0.062, 0.014], POUCH, 'DEF-spine.001', 0.006))
        c.append(stuck(TORSO, 1.196, thd, RSP_VEST + 1.9, [0.038, 0.020, 0.015], POUCH, 'DEF-spine.001', 0.005))
    c.append(stuck(TORSO, 1.345, 30, RSP_VEST + 2.2, [0.030, 0.050, 0.016], 'metal_dark', 'DEF-spine.003', 0.006))
    p, w = on(TORSO, 1.40, 34, RSP_VEST + 2.4)
    c.append(rig(tube([p, p + [0.004, 0.105, -0.012]], [0.006, 0.004], 'metal_dark', np.zeros((1, NJ)), nseg=5), 'DEF-spine.003'))
    # belt, and the roll across the small of the back
    c.append(mband(TORSO, 1.000, 1.052, 2.5, 3.4, POUCH))
    c.append(stuck(TORSO, 1.452, 180, RSP_VEST + 0.25, [0.085, 0.021, 0.004], 'accent', 'DEF-spine.003', 0.002))      # the mark's bar, above the radio man's set
    q = on(TORSO, 1.045, 180, RSP_VEST + 4.6)[0]
    c.append(rig(tube([q + [-0.150, 0, 0], q + [0.150, 0, 0]], [0.052, 0.052], 'cloth_plain', np.zeros((1, NJ)), nseg=10, angle=50), 'DEF-spine.001'))
    for x in (-0.085, 0.085):
        c.append(rig(box(q + [x, 0, 0], [0.011, 0.056, 0.056], 'webbing', None, None, 0.01, 60), 'DEF-spine.001'))
    for thd in (118, -118):
        c.append(stuck(TORSO, 1.01, thd, 4.6, [0.036, 0.050, 0.024], POUCH, 'DEF-hips', 0.010, 60))
    return c


def part_rsp_radio():
    """The response team's radio man: a manpack set in a canvas carrier (the shirt's cloth, pale against the vest) high on the back of
    the flak vest, a whip aerial off its right corner. The only thing one responder has that the other has not, and it is on top."""
    p = on(TORSO, 1.335, 180, 3.4 + 4.6)[0]
    c = [rig(box(p, [0.088, 0.100, 0.040], 'cloth_plain', None, None, 0.010, 50), BK),
         rig(box(p + np.array([0, 0.104, 0.0]), [0.080, 0.008, 0.034], 'accent', None, None, 0.004), BK)]      # the set's lid in the element's mark: it stands in front of the vest's bar from behind, and it is what the camera above sees of him
    for sx in (1, -1):      # the carrier's two straps up to the vest's shoulders
        c.append(rig(box(p + np.array([sx * 0.062, 0.060, 0.046]), [0.013, 0.070, 0.005], 'webbing', None, rot_xyz(-28, 0, 0), 0.002), BK))
    a0 = p + np.array([-0.066, 0.108, -0.012])
    c.append(rig(tube([a0, a0 + [0, 0.035, 0]], [0.012, 0.009], 'metal_dark', np.zeros((1, NJ)), nseg=6, angle=50), BK))
    c.append(rig(tube([a0 + [0, 0.035, 0], a0 + [-0.012, 0.42, -0.05]], [0.006, 0.004], 'metal_dark', np.zeros((1, NJ)), nseg=5, angle=50), BK))
    return c


# ------------------------------------------------------------------------------------------------
# the cleaner: a body and clothes of her own
# ------------------------------------------------------------------------------------------------
def _cols(lo, hi):
    """the torso tube's columns from lo to hi degrees (0 = front, + = her left), in order"""
    deg = np.round(np.degrees((TH_T + np.pi) % (2 * np.pi) - np.pi)).astype(int)
    return [int(np.where(deg == d)[0][0]) for d in range(lo, hi + 1, 15)]


def part_cleaner():
    """Built inside BUILD['woman']. A housekeeping tunic (cloth_plain) to the thigh, flared, short loose sleeves, round neck; an apron
    (accent) with a bib on two straps over the shoulders, tied at the waist with a bow behind; slim straight trousers; hair drawn back into a bun. From the game's
    camera: the bun behind the head, bare forearms, the dark apron panel on the tunic, a skirt's flare where a man has a shirt tail."""
    S, U, A = 'cloth_plain', 'cloth_uniform', 'accent'
    ys = np.array([.835, .835, .87, .91, .95, .99, 1.04, 1.09, 1.15, 1.21, 1.27, 1.32, 1.37, 1.42, 1.45])
    of = np.array([2.2, 6.4, 5.7, 4.9, 4.0, 3.1, 2.4, 1.9, 1.7, 1.6, 1.5, 1.4, 1.2, 1.0, 0.9])
    c = [tube_of(TORSO, ys, of, S, 60, hang=(0.99, 2), tail=True, over_legs=0.8),
         tube_of(NECK, [1.45, 1.475, 1.497, 1.52, 1.538, 1.538], [0.9, 0.9, 1.0, 1.1, 1.5, 0.3], S, 60)]
    xs = [.15, .19, .24, .30, .34, .368, .368]
    so = [0.6, 0.9, 1.3, 1.6, 1.5, 1.45, 0.3]      # (the mouth was 2.2 to 2.3 cm off the arm: an open cup when the arms went back)
    c += both([sleeve(xs, so, S, 0.0, 0, head=0.9, drop=1.0, arm_from=.34), forearm_skin(.33)])
    # her own head (head.py look 'c': a woman's brows, jaw and nose) and neck, inside this part: nobody else wears the face, and
    # a third head part would have cost one of the mask's 32 bits
    c += H.skin_head(WH, look='c')
    c.append(tube_of(NECK, [1.44, 1.47, 1.50, 1.53, 1.56, 1.60, 1.645], [0, -0.2, -0.5, -0.7, -0.75, -0.6, -0.4], 'skin', 180))
    # the apron: a skirt panel and a bib, sheets 9 mm off the tunic that hang and swing with it, and the tie round the waist
    # (the panel stops a hand above the tunic's hem: the hem swings with the thighs, and a panel to the very edge went lopsided with it)
    sk = ys[2:8]
    c.append(tube_of(TORSO, sk, of[2:8] + 0.9, A, 50, hang=(0.99, 2), tail=True, over_legs=1.7, cols=_cols(-45, 45)))
    c.append(tube_of(TORSO, [1.09, 1.15, 1.21, 1.27, 1.32, 1.36], [2.8, 2.6, 2.5, 2.4, 2.3, 2.2], A, 50, cols=_cols(-30, 30)))
    # the bib's two straps: over the shoulders and straight down the back into the waist tie (a pinafore's). Lines of the NECK
    # master like the chest rig's, the tunic's own weights. (A loop round the neck was drawn on the master's ring there, which
    # is the whole shoulder yoke: it read as a red bar from shoulder to shoulder.)
    for sx in (1, -1):
        p, n, w = over_shoulder(sx, lambda y: np.interp(y, [1.38, 1.46], [0.066, 0.086]), lambda y: np.interp(y, [1.38, 1.46], [0.060, 0.086]),
                                1.38, 1.385, lambda y: np.interp(y, [1.38, 1.43, 1.50], [1.35, 1.2, 1.3]),
                                front=[(1.345, 23, 2.2)],
                                back=[(1.34, 163, 1.5), (1.28, 166, 1.7), (1.22, 168, 1.9), (1.16, 169, 2.0), (1.115, 169, 2.3)])
        c.append(band3d(p, n, 0.026, 0.004, A, lift=0.001, weights=w))
    c.append(mband(TORSO, 1.082, 1.118, 2.0, 3.2, A))
    c.append(stuck(TORSO, 1.10, 180, 3.5, [0.060, 0.026, 0.010], A, None, 0.008))
    for sx in (1, -1):
        c.append(stuck(TORSO, 1.045, 180 + sx * 9, 3.3, [0.013, 0.055, 0.004], A, None, 0.002, roll=sx * 12))
    # trousers
    ty = [.985, .95, .90, .84, .77, .70, .63, .575, .535, .495, .44, .37, .30, .23, .16, .09, .09]
    to = [1.0, 1.4, 1.7, 1.7, 1.6, 1.5, 1.4, 1.3, 1.3, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, .8]
    rm = [0, .088, .093, .091, .087, .083, .078, .074, .071, .069, .068, .068, .068, .068, .068, .069, .050]
    c += trousers(U, 1.4, ty, to, rm, 0.25, 43)
    # hair: close to the skull, a low nape, a big bun at the back of the head; over it a kerchief in the tunic's cloth, tied
    # under the bun (from the game's camera a dark bun on dark hair is nothing: the kerchief is the one head in the cast that
    # takes its wearer's own colour, and the bun is the bump behind it)
    rim = H.rim_interp([0, 35, 70, 95, 140, 180], [.75, .72, .50, .33, .17, .10])
    c.append(over_neck(H.shell(WH, rim, lambda g, th: 0.008 + 0.005 * np.sin(g * np.pi) + 0 * th, 'rubber', gs=[.07, .15, .25, .37, .5, .64, .78, .89, .96, 1.0]), 0.008))
    bun_c, bun_r = H.surf(0.40, np.pi, 0.040), np.array([0.052, 0.048, 0.050])
    c.append(rig(ellipsoid(bun_c, bun_r, 'rubber', nu=10, nv=5), 'DEF-head'))
    krim = H.rim_interp([0, 40, 75, 110, 150, 180], [.725, .71, .64, .60, .585, .58])
    # (the kerchief is on the TUNIC's slot: on `accent`, the apron's pale cotton, it was a white dome: a chef's cap)
    c.append(H.shell(WH, krim, lambda g, th: 0.0165 + 0.003 * (1 - g) ** 0.5 * np.sin(th * 4 + g * 7), S, gs=[.12, .26, .42, .58, .72, .84, .93, 1.0]))
    # the kerchief is a square folded to a triangle: its POINT lies back over the bun and hangs behind it (the shell alone stopped
    # level above the bun: a beanie on a man). A slab draped on the bun's own ellipsoid, from under the shell's back edge to the tip.
    rows = []
    for phi, psi in ((-60, 62), (-14, 70), (28, 74), (68, 56), (104, 30), (130, 7)):      # (the second row 80 wide: the slab sheared at its two upper corners and showed its underside's back from the side)
        ph, ps = phi * D2R, np.linspace(-psi, psi, 5) * D2R
        rows.append(bun_c + (bun_r + 0.011) * np.stack([np.sin(ps), np.cos(ps) * np.cos(ph), -np.cos(ps) * np.sin(ph)], 1))
    rows[-1][:, 1] -= 0.012                      # the tip hangs off the bun
    c.append(slab_loop(rows, [0.004] * 6, S, 50, root=True))
    return c


# ------------------------------------------------------------------------------------------------
# THE LOOK (`--look gwot` -> cast-gwot.gltf; README "The look"): the defenders in LOCAL DRESS, the operators' helmet with its rails.
# A second FILE, not more parts in the first: the mask is 32 bits and cast.gltf uses them all. The operators', responders' and
# civilians' parts are the same builders; the defenders' nine western parts give their bits to these.
# Slots on the defenders' side (render/charMaterials.ts CHAR_MATS_LOOK says what each is drawn as): the long shirt AND its trousers
# are `cloth_plain` (a suit of one cloth), the waistcoat `cloth_uniform`, a wool cap `helmet`, wound and sewn head cloth (turban,
# skull cap) `accent`, a scarf and a shawl `lens` (a slot the defenders never used: no man of theirs wears glass), beards `rubber`
# (the hair's), sandal straps `boot`.
# ------------------------------------------------------------------------------------------------
KAM_YS = [.60, .60, .64, .70, .76, .82, .88, .93, .96, .99, 1.04, 1.10, 1.16, 1.22, 1.28, 1.33, 1.38, 1.42, 1.45]
KAM_OF = [3.4, 5.6, 5.5, 5.3, 5.0, 4.6, 4.2, 3.8, 3.6, 3.3, 2.9, 2.7, 2.5, 2.3, 2.0, 1.7, 1.3, 1.0, 0.9]      # cm off the body: shirt_loose's from the waist up (the chest rig is cut for those), flaring to the hem
KAM_HEM, KAM_SIDE = 0.60, 0.17      # the hem's height in front and behind (a hand over the knee joint: the thigh alone carries it), and how much higher the cut at each side


def kam_off(y):
    return np.interp(y, KAM_YS[1:], KAM_OF[1:])


def shalwar():
    """The loose trousers under the long shirt, in the shirt's own cloth: a full seat and thigh (ring floors 3 cm over the fatigues'),
    drawn in to a narrow cuff over the ankle."""
    ys = [.985, .95, .90, .84, .77, .70, .63, .575, .535, .495, .44, .37, .30, .23, .16, .105, .105]
    of = [1.0, 2.0, 3.0, 3.3, 3.3, 3.2, 3.1, 3.0, 2.9, 2.8, 2.8, 2.7, 2.6, 2.4, 2.2, 2.0, 0.9]
    rm = [0, .104, .113, .116, .115, .113, .110, .107, .104, .101, .097, .092, .086, .079, .071, .064, .050]
    return trousers('cloth_plain', 1.6, ys, of, rm, 0.8, 61)


def long_tail_weights(P, W, y_top=0.99, span=0.085, kmax=0.85):
    """tail_weights() for a tail that hangs to the knee: the SEAT stays with the hips as there, but from a hand under it the back
    of the tail goes with the thighs like the front (on the hips alone a trailing thigh came out through the back of the skirt)."""
    W = W.copy()
    k = np.clip((y_top - P[..., 1]) / span, 0, 1) * kmax
    k = k * (0.25 + 0.75 * np.maximum(np.clip((P[..., 2] + 0.035) / 0.07, 0, 1), np.clip((0.90 - P[..., 1]) / 0.13, 0, 1)))
    side = np.clip(P[..., 0] / 0.07, -1, 1) * 0.5 + 0.5
    W *= (1 - k)[..., None]
    W[..., M.J['DEF-thigh.L']] += k * side
    W[..., M.J['DEF-thigh.R']] += k * (1 - side)
    return W


def over_cloth(P, mast, V, clear, below, band=0.035):
    """Every vertex of a tube's grid P under height `below` is kept `clear` m outside the cloth V (other chunks' vertices) at its
    own height: the support of V's slice there along the vertex's own ray from the master's axis."""
    for i in range(P.shape[0]):
        for s in range(P.shape[1]):
            y = P[i, s, 1]
            if y >= below:
                continue
            C = mast.center_fn(np.array([y]))[0]
            m = np.abs(V[:, 1] - y) < band
            if not m.any():
                continue
            need = float(((V[m] - C) @ mast.D[s]).max()) + clear
            r = float((P[i, s] - C) @ mast.D[s])
            if r < need:
                P[i, s] = C + mast.D[s] * need
    return P


def kameez_body(under):
    """The long shirt's trunk: a tube that hangs straight from the hips to a hem above the knee, cut up at each side (the shirt
    tail's curve: the hem is KAM_SIDE higher over each hip), kept outside the trousers `under` all the way down."""
    S = 'cloth_plain'
    tube_of(TORSO, KAM_YS, KAM_OF, S, 60, fold=0.9, seed=11, hang=(0.99, 2))
    P, W = tube_of.last.copy(), tube_of.lastW.copy()
    cut = KAM_SIDE * np.abs(np.sin(TH_T)) ** 6
    lo = P[..., 1] < 0.99
    P[..., 1] = np.where(lo, 0.99 - (0.99 - P[..., 1]) * ((0.99 - KAM_HEM - cut) / (0.99 - KAM_HEM))[None, :], P[..., 1])
    P[1:] = over_cloth(P[1:], TORSO, under, 0.012, 0.985)
    C = torso_center(P[0, :, 1])
    P[0] = C + (P[1] - C) * (1 - 0.022 / np.maximum(np.linalg.norm((P[1] - C) * [1, 0, 1], axis=-1), 1e-6))[:, None] * [1, 0, 1] + (P[1] - C) * [0, 1, 0]      # the hem's lip: turned in 2 cm
    return grid_chunk(P, long_tail_weights(P, W), S, 60, True)


def part_local_suit():
    """Shalwar kameez / perahan tunban: a long loose shirt to the knee with long loose sleeves and a low band collar, over loose
    trousers of the same cloth. Every defender of the look wears it, so shirt and trousers are ONE part."""
    S = 'cloth_plain'
    sh = shalwar()
    c = sh + [kameez_body(np.vstack([k['V'] for k in sh])),
              tube_of(NECK, [1.45, 1.475, 1.497, 1.52, 1.543, 1.558, 1.558], [0.9, 0.9, 1.0, 1.0, 0.95, 0.9, 0.2], S, 60)]      # a low band collar that stands on the neck
    xs = [.15, .19, .24, .30, .36, .42, .455, .49, .54, .60, .66, .70, .728, .728]
    of = [0.6, 0.9, 1.4, 1.8, 1.9, 1.9, 1.8, 1.9, 2.0, 2.0, 2.0, 2.0, 2.1, 0.4]
    c += both([sleeve(xs, of, S, 0.5, 13, head=0.9), wrist_skin()])
    return c


def part_waistcoat():
    """A sleeveless waistcoat over the long shirt, to the hip, worn open: the shirt shows down the front between its edges."""
    U = 'cloth_uniform'
    th = np.degrees(np.abs((TH_T + np.pi) % (2 * np.pi) - np.pi))
    front = th < 40                                           # the columns open_front() rebuilds
    ys = np.array([.905, .905, .94, .98, 1.03, 1.09, 1.15, 1.21, 1.27, 1.32, 1.37, 1.41, 1.44, 1.47])
    base = kam_off(ys) + 1.0
    base[-1] = 1.9
    tube_of(TORSO, ys, base, U, 50, hang=(0.99, 2))
    P, W = tube_of.last.copy(), tube_of.lastW.copy()
    P[1:] = over_cloth(P[1:], TORSO, kameez_body(np.vstack([k['V'] for k in shalwar()]))['V'], 0.008, 1.0)
    C = torso_center(P[0, :, 1])
    P[0] = C + (P[1] - C) * [0.9, 1, 0.9]
    body = grid_chunk(P, tail_weights(P, W), U, 50, True)
    c = [open_front(body, base)]
    cy = np.array([1.47, 1.49, 1.506, 1.506])
    cb = np.array([1.9, 1.9, 2.0, 0.5])
    c.append(open_front(tube_of(NECK, cy, cb, U, 50), cb))
    for thd in (-50, 50):                                     # two welt pockets: a flap on each front
        c.append(stuck(TORSO, 1.075, thd, float(kam_off(1.075)) + 1.3, [0.045, 0.014, 0.005], U, None, 0.003, 50))
    return c


def part_patu():
    """A wool shawl (patu) worn as a BAND a forearm wide: across the back of the shoulders, over both of them, its two ends down the
    chest, the left one to the hip and the right one a hand under the collar bone. From the game's camera: both shoulders and the top
    of the back in another cloth, the shirt showing below it and down the middle of the chest. (It was a panel down the chest and
    one down the back over the LEFT shoulder only: a shirt in two colours.)"""
    L = 'lens'
    c = []

    def panel(deg, ylo, seed, rows=8):
        u = np.linspace(0, 1, rows)
        n = len(deg)
        Y = ylo + (1.45 - ylo) * u[:, None] + 0.0 * deg[None, :]
        off = (kam_off(Y) + 2.1) * CM + folds(len(u), n, 0.45 * CM, seed)
        off[:, [0, -1]] = (kam_off(Y[:, [0, -1]]) - 0.3) * CM                          # its two long edges lie in on the shirt
        off[0] = (kam_off(Y[0]) - 0.3) * CM                                            # and its end
        off[1, 1:-1] = (kam_off(Y[1, 1:-1]) + 2.1) * CM
        Y[1] = ylo + 0.004
        P, W = TORSO.at(Y.ravel(), np.tile(deg * D2R, len(u)), off.ravel())
        return grid_chunk(P.reshape(len(u), n, 3), W.reshape(len(u), n, -1), L, 60, False)
    c.append(panel(np.arange(15, 76, 15), 0.99, 71))             # the long end, down the left of the chest
    c.append(panel(np.arange(285, 346, 15), 1.27, 74, 5))        # the short end, on the right
    c.append(panel(np.arange(105, 256, 15), 1.30, 72, 5))        # across the back
    deg = np.arange(15, 346, 15)
    n = len(deg)
    ny = np.array([1.45, 1.475, 1.50, 1.522, 1.522])
    no = np.array([3.0, 3.2, 3.3, 3.0, 0.6])[:, None] + np.zeros((1, n))
    no[:, [0, -1]] = 0.6
    P, W = NECK.at(np.repeat(ny, n), np.tile(deg * D2R, len(ny)), no.ravel() * CM)
    c.append(grid_chunk(P.reshape(len(ny), n, 3), W.reshape(len(ny), n, -1), L, 60, False))
    c += both(sleeve([.15, .19, .24, .285, .285], [2.0, 2.4, 2.9, 3.2, 1.8], L, 0.4, 73, head=0.9, drop=1.0, sink=1.1, inboard=0.7))   # (sink / inboard off the shirt sleeve's own: its hidden first ring must not sit ON the shirt's to the bit)
    return c


def part_scarf():
    """A cotton scarf (shemagh) round the neck: a thick loose ring on the shoulders, its folded point hanging on the chest."""
    L = 'lens'
    n_ = len(TH_T)
    _, Wy = NECK.at(np.full(n_, 1.462), TH_T, 0.0)            # it lies on the shoulders and moves with them, not with the neck inside it
    ring = tube_of(NECK, [1.468, 1.468, 1.492, 1.52, 1.546, 1.546], [1.3, 3.1, 3.7, 3.4, 2.7, 1.0], L, 60, fold=0.5, seed=77)
    ring['W'] = np.tile(Wy, (6, 1))
    ys = np.array([1.488, 1.455, 1.42, 1.385, 1.35, 1.318])
    hw = np.interp(ys, [1.318, 1.488], [3.5, 33.0])           # half its width, degrees round the chest
    cols = np.linspace(-1, 1, 7)
    Y = np.repeat(ys, len(cols))
    TH = (hw[:, None] * cols[None, :]).ravel()
    o = (kam_off(np.minimum(ys, 1.45))[:, None] + 1.5 - 1.3 * (np.abs(cols[None, :]) > 0.99)) + np.zeros((1, len(cols)))
    o[-1] -= 0.9
    P, W = TORSO.at(Y, TH * D2R, o.ravel() * CM)
    tri = grid_chunk(P.reshape(len(ys), len(cols), 3), W.reshape(len(ys), len(cols), -1), L, 60, False)
    return [ring, outward(tri, [0, 1.40, 0])]


def part_pakol():
    """A pakol: a round flat-topped wool cap worn back on the head over a thick rolled band. From above: a flat disc with a rim, wider than
    the head, in wool's browns and greys: no helmet has that outline, and no hat of the plain cast."""
    rim = H.rim_interp([0, 180], [.665, .60])
    crown = H.shell(WH, rim, lambda g, th: 0.012 + 0.020 * _ss(g, 0.0, 0.30) - 0.019 * _ss(g, 0.50, 1.0) + 0 * th, 'helmet',
                    gs=[.10, .22, .36, .50, .64, .78, .90, 1.0], angle=50, rim_in=0.008)
    th = H.thetas(28)
    hh = rim(th)[None, :] + np.array([-.035, -.025, .02, .065, .105, .115])[:, None]
    off = np.array([.007, .026, .034, .034, .024, .011])[:, None] + 0 * th[None, :]
    P = H.surf(hh, th[None, :], off)
    roll = grid_chunk(P, np.broadcast_to(WH, P.shape[:2] + (NJ,)), 'helmet', 40.0, True, False, False)
    return [crown, roll]


def part_turban():
    """A turban (lungee): cloth wound round the head in turns that climb as they go, standing well off the skull, one end
    left hanging behind the left shoulder. The turns are in the SHAPE (a ridge every 4 cm): no texture draws them."""
    rim = H.rim_interp([0, 40, 75, 120, 180], [.635, .61, .50, .44, .40])

    def off(g, th):
        turns = np.sin(g * 4.0 * np.pi + th)
        return 0.033 + 0.016 * np.sin(np.clip(g / 0.9, 0, 1) * np.pi) ** 0.7 + 0.007 * turns * np.clip((1 - g) / 0.25, 0, 1)
    c = [over_neck(H.shell(WH, rim, off, 'accent', gs=[.07, .14, .21, .28, .35, .42, .50, .58, .66, .74, .83, .92, 1.0], angle=50, rim_in=0.006), 0.010)]
    k = H.surf(0.47, 150 * D2R, 0.036)
    pts = k + np.array([[0.0, 0.0, 0.0], [0.012, -0.06, -0.018], [0.020, -0.13, -0.030], [0.024, -0.19, -0.034]])
    c.append(tube(pts, [0.020, 0.030, 0.032, 0.026], 'accent', WH.reshape(1, -1), nseg=6, angle=40, up=(0, 0, -1), squash=0.22))
    return c


def part_kufi():
    """A sewn skull cap: a low round cap sitting on the crown above the ears, pale."""
    rim = H.rim_interp([0, 180], [.715, .67])
    crown = H.shell(WH, rim, lambda g, th: 0.0135 + 0.0035 * np.sin(g * np.pi) - 0.003 * _ss(g, 0.6, 1.0) + 0 * th, 'accent',
                    gs=[.14, .30, .48, .66, .82, .93, 1.0], angle=50, rim_in=0.008)
    return [crown, H.band(WH, lambda th: rim(th) - 0.005, lambda th: rim(th) + 0.075, 0.009, 0.0165, 'accent')]


BEARD_LOOKS = ('a', 'b')      # the faces a beard is fitted to (the defenders')


def part_beard_full():
    """A full beard: from the sideburns along the jaw and under the lower lip, a hand deep under the chin. A sheet laid on whichever of
    the two faces stands further out, its upper edge sunk under the skin. Worn with the moustache."""
    n = 15
    th = np.linspace(-80, 80, n) * D2R
    a = np.abs(np.degrees(th))
    top = np.interp(a, [0, 12, 24, 38, 58, 80], [.100, .108, .168, .225, .30, .405])
    jaw = np.interp(a, [0, 30, 55, 80], [.012, .014, .07, .20])
    hang = np.interp(a, [0, 30, 60, 80], [1.0, 0.9, 0.45, 0.12])
    rows = []
    for f, proud in ((0.0, None), (0.12, 0.004), (0.55, 0.011), (1.0, 0.015)):
        h = top + (jaw - top) * f
        lo, hi = H.face_relief(h, th, BEARD_LOOKS)
        rows.append(H.surf(h, th, lo - 0.0025 if proud is None else np.maximum(hi, 0) + proud))
    back = norm(-(rows[-1] - np.array([0, 0, H.Z0])) * np.array([1, 0, 1]))
    r4 = rows[-1] + np.array([0, -0.026, 0]) * hang[:, None] + back * 0.004
    r5 = r4 + np.array([0, -0.014, 0]) * hang[:, None] + back * (0.012 + 0.004 * hang)[:, None]
    r6 = r5 + np.array([0, 0.006, 0]) + back * 0.024
    P = np.stack(rows + [r4, r5, r6])
    return [outward(grid_chunk(P, np.broadcast_to(WH, P.shape[:2] + (NJ,)), 'rubber', 60.0, False), H.INSIDE)]


def keep_faces(c, mask, slot=None):
    """the chunk's faces picked by `mask`, as a chunk of its own (optionally on another slot)"""
    idx = np.unique(c['F'][mask])
    re = np.full(len(c['V']), -1)
    re[idx] = np.arange(len(idx))
    return dict(c, V=c['V'][idx].copy(), W=c['W'][idx].copy(), F=re[c['F'][mask]], slot=slot or c['slot'])


def part_sandals():
    """Sandals: the bare foot on a dark sole, a strap over the toes, one over the instep, one behind the heel."""
    def foot(grow, slot):
        rows = [(.118, .15, 0), (.095, .2, 0), (.07, .2, 0), (.048, .3, 0), (.031, .5, 0), (.030, 1.0, 0), (.011, 1.0, 0)]
        ys, of, rm = [np.array(x) for x in zip(*rows)]
        of = of[:, None] + np.zeros((1, LEG.nseg)) + grow
        toe = np.clip(np.cos(TH_L), 0, 1) ** 3
        for i, k in ((1, 1.0), (2, 2.3), (3, 2.5), (4, 0.9)):
            of[i] += k * toe
        c = tube_of(LEG, ys, of, slot, 80, cap1=True, rmin=rm, hang=SOLE)
        V = blunt_toe(c['V'])
        V[V[:, 1] < 0.02, 1] = 0.0
        return c
    out = soled(foot(0.0, 'skin'))
    st = foot(0.45, 'boot')
    fc = st['V'][st['F']].mean(1)
    up = fc[:, 1] > 0.034
    strap = up & (((fc[:, 2] > 0.088) & (fc[:, 2] < 0.128)) | ((fc[:, 2] > 0.022) & (fc[:, 2] < 0.058) & (fc[:, 1] < 0.10)) | ((fc[:, 2] < -0.052) & (fc[:, 1] < 0.085)))
    out.append(keep_faces(st, strap))
    return both(out)


def part_helmet_gwot():
    """The operators' helmet with a 2010s high-cut's furniture: an accessory rail along each side over the ear cup, a battery /
    counterweight pouch on the back, a marker light beside the stripe behind the crown. (The shell, the pair band and stripe, the
    ear cups, the boom, the strap and the shroud are part_helmet()'s, unchanged.)"""
    out = part_helmet('gwot')
    for sx in (1, -1):
        out.append(rig(box(H.surf(0.615, sx * 88 * D2R, HELMET_OFF + 0.005), [0.006, 0.011, 0.046], 'metal_dark', None, rot_xyz(0, -sx * 4, 0), 0.003), 'DEF-head'))
    out.append(rig(box(H.surf(0.47, np.pi, HELMET_OFF + 0.013), [0.038, 0.026, 0.013], 'webbing', None, rot_xyz(8, 0, 0), 0.006), 'DEF-head'))
    out.append(rig(box(H.surf(0.80, 152 * D2R, HELMET_OFF + 0.009), [0.012, 0.008, 0.017], 'metal_dark', None, rot_xyz(40, 152, 0), 0.003), 'DEF-head'))
    return out


# ------------------------------------------------------------------------------------------------
PARTS = [
    ('head', part_head),
    ('head_b', part_head_b),
    ('moustache', part_moustache),
    ('hair_short', part_hair_short),
    ('hair_full', part_hair_full),
    ('cap_ball', part_cap_ball),
    ('hat_boonie', part_hat_boonie),
    ('hat_straw', part_hat_straw),
    ('bandana', part_bandana),
    ('helmet', part_helmet),
    ('nvg_up', part_nvg_up),
    ('hands_skin', part_hands_skin),
    ('hands_glove', part_hands_glove),
    ('op_suit', part_op_suit),
    ('kit_lead', part_kit_lead),
    ('kit_breacher', part_kit_breacher),
    ('kit_rifleman', part_kit_rifleman),
    ('kit_slick', part_kit_slick),
    ('kit_medic', part_kit_medic),
    ('shirt_loose', part_shirt_loose),
    ('tank_top', built('wiry', part_tank_top)),
    ('jacket_open', built('big', part_jacket_open)),
    ('shirt_tucked', part_shirt_tucked),
    ('chest_rig', part_chest_rig),
    ('bandolier', built('wiry', part_bandolier)),
    ('trousers_fatigue', part_trousers_fatigue),
    ('trousers_jeans', part_trousers_jeans),
    ('boots_low', part_boots_low),
    ('shoes', part_shoes),
    ('cleaner', built('woman', part_cleaner)),
    ('rsp_kit', part_rsp_kit),
    ('rsp_radio', part_rsp_radio),
]

OP = ['helmet', 'hair_short', 'hands_glove', 'op_suit', 'nvg_up']      # (the goggles: the game draws its own box pair on a man who wears them; the mesh pair is only ever UP)
A, B_ = ['head'], ['head_b']                              # the two faces
DEF = ['hands_skin']
RSP = ['hands_glove', 'hair_short', 'shirt_tucked', 'rsp_kit', 'trousers_fatigue', 'boots_low']
VARIANTS = {
    # one team, five jobs: told apart from above by what is on the back
    'operator_1': {'side': 'operator', 'role': 'team leader: radio + tape antenna', 'parts': A + OP + ['kit_lead']},
    'operator_2': {'side': 'operator', 'role': 'breacher: ram across the back', 'parts': A + OP + ['kit_breacher']},
    'operator_3': {'side': 'operator', 'role': 'rifleman: small assault pack', 'parts': B_ + OP + ['kit_rifleman']},
    'operator_4': {'side': 'operator', 'role': 'rifleman: slick, hydration carrier', 'parts': A + OP + ['kit_slick', 'moustache']},
    'operator_5': {'side': 'operator', 'role': 'medic: big pack + roll', 'parts': B_ + OP + ['kit_medic']},
    # the irregulars: five outfits on three bodies (the ordinary man, the wiry one in the tank top, the big one in the open jacket)
    'defender_1': {'side': 'defender', 'role': 'ball cap, loose shirt', 'parts': A + DEF + ['hair_short', 'cap_ball', 'shirt_loose', 'trousers_fatigue', 'boots_low']},
    'defender_2': {'side': 'defender', 'role': 'wiry: straw hat, tank top + bandolier, jeans', 'parts': B_ + DEF + ['hair_full', 'hat_straw', 'tank_top', 'bandolier', 'trousers_jeans', 'shoes']},
    'defender_3': {'side': 'defender', 'role': 'big: bandana, open jacket over his belly', 'parts': A + DEF + ['moustache', 'hair_short', 'bandana', 'jacket_open', 'trousers_fatigue', 'boots_low']},
    'defender_4': {'side': 'defender', 'role': 'bare head, shirt + chest rig, jeans', 'parts': A + DEF + ['hair_full', 'shirt_loose', 'chest_rig', 'trousers_jeans', 'boots_low']},
    'defender_5': {'side': 'defender', 'role': 'boonie hat, shirt + chest rig', 'parts': B_ + DEF + ['hair_short', 'hat_boonie', 'shirt_loose', 'chest_rig', 'trousers_fatigue', 'shoes']},
    # the response element (the game's trained staff team): ONE outfit and now ONE OUTLINE of its own — steel helmet, flak vest with a collar and
    # shoulder caps, a roll across the small of the back, over the tucked duty shirt. One carries the team's radio (a pack and a whip aerial: the tell from above), the other does not.
    'responder_1': {'side': 'responder', 'role': 'response team: steel helmet, flak vest, back roll; the radio man', 'parts': B_ + RSP + ['rsp_radio']},
    'responder_2': {'side': 'responder', 'role': 'response team: the same, the other face, no radio', 'parts': A + RSP},
    'civilian_1': {'side': 'civilian', 'role': 'the cleaner: a woman, tunic + apron, hair in a bun', 'parts': DEF + ['cleaner', 'shoes']},
    'civilian_2': {'side': 'civilian', 'role': 'office worker: shirt + tie, fuller hair, moustache', 'parts': A + DEF + ['hair_full', 'moustache', 'shirt_tucked', 'trousers_fatigue', 'shoes']},
}

# ---- THE LOOK's file (`--look gwot`): the same 32 bits re-dealt. The operators', responders' and civilians' parts are the ones above
# (the helmet with its rails); the defenders' western parts are gone and local dress stands in their bits.
_GONE = ('cap_ball', 'hat_boonie', 'hat_straw', 'bandana', 'shirt_loose', 'tank_top', 'jacket_open', 'bandolier', 'trousers_jeans')
PARTS_GWOT = [(n, {'helmet': part_helmet_gwot, 'op_suit': lambda: part_op_suit('gwot')}.get(n, f)) for n, f in PARTS if n not in _GONE] + [
    ('local_suit', part_local_suit),
    ('waistcoat', part_waistcoat),
    ('patu', part_patu),
    ('scarf', part_scarf),
    ('pakol', part_pakol),
    ('turban', part_turban),
    ('kufi', part_kufi),
    ('beard_full', part_beard_full),
    ('sandals', part_sandals),
]
LOCAL = DEF + ['local_suit']
VARIANTS_GWOT = dict(VARIANTS)
VARIANTS_GWOT.update({
    # ordinary men in ordinary local clothes; a rifle, and a chest rig on two of them. Told apart from above by the head and by what lies on the shoulders
    'defender_1': {'side': 'defender', 'role': 'pakol, waistcoat over the long shirt, full beard', 'parts': A + LOCAL + ['hair_short', 'moustache', 'beard_full', 'pakol', 'waistcoat', 'shoes']},
    'defender_2': {'side': 'defender', 'role': 'turban, chest rig, full beard, sandals', 'parts': B_ + LOCAL + ['hair_short', 'moustache', 'beard_full', 'turban', 'chest_rig', 'sandals']},
    'defender_3': {'side': 'defender', 'role': 'skull cap, a shawl over both shoulders, moustache, sandals', 'parts': A + LOCAL + ['hair_short', 'moustache', 'kufi', 'patu', 'sandals']},
    'defender_4': {'side': 'defender', 'role': 'bare head, scarf round the neck, chest rig, beard', 'parts': A + LOCAL + ['hair_full', 'beard_full', 'scarf', 'chest_rig', 'shoes']},
    'defender_5': {'side': 'defender', 'role': 'pakol, scarf, waistcoat, moustache', 'parts': B_ + LOCAL + ['hair_short', 'moustache', 'pakol', 'scarf', 'waistcoat', 'boots_low']},
})
LOOKS = {'plain': (PARTS, VARIANTS, OUT), 'gwot': (PARTS_GWOT, VARIANTS_GWOT, OUT.replace('cast.gltf', 'cast-gwot.gltf'))}

for _vs in (VARIANTS, VARIANTS_GWOT):
    for _n, _v in _vs.items():      # chin_strap() is fitted to these faces: a helmet on another head needs its look in STRAP_LOOKS
        assert not {'helmet', 'rsp_kit'} & set(_v['parts']) or {'head': 'a', 'head_b': 'b'}.get(_v['parts'][0]) in STRAP_LOOKS, 'variant %s wears a helmet on a face chin_strap() was not fitted to' % _n
        assert 'beard_full' not in _v['parts'] or {'head': 'a', 'head_b': 'b'}.get(_v['parts'][0]) in BEARD_LOOKS, 'variant %s wears a beard on a face it was not fitted to' % _n


def main():
    """build_cast.py [--look plain|gwot] [out.gltf]"""
    argv = sys.argv[1:]
    look = 'plain'
    if '--look' in argv:
        i = argv.index('--look')
        look = argv[i + 1]
        del argv[i:i + 2]
    assert look in LOOKS, 'build_cast.py: --look is one of %s' % ' '.join(LOOKS)
    PARTS, VARIANTS, out = LOOKS[look]
    assert len(PARTS) <= 32, '%d parts: the mask is 32 bits' % len(PARTS)
    parts = [(n, fn()) for n, fn in PARTS]
    out = argv[0] if argv else out
    stats = write_gltf(M, parts, {n: {'side': v['side'], 'parts': v['parts']} for n, v in VARIANTS.items()}, out)
    tot = [0, 0]
    print('%-18s %7s %7s' % ('part', 'tris', 'verts'))
    for n, (t, v) in stats.items():
        print('%-18s %7d %7d' % (n, t, v))
        tot[0] += t
        tot[1] += v
    print('%-18s %7d %7d   (%d parts)' % ('UNION', tot[0], tot[1], len(stats)))
    for n, v in VARIANTS.items():
        print('%-18s %7d   %s' % (n, sum(stats[p][0] for p in v['parts']), v['side']))
    print('wrote', out)


if __name__ == '__main__':
    main()
