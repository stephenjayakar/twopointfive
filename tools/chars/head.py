"""The head: one parametric surface (height h 0..1 chin->crown, angle th round the vertical axis,
th = 0 front, +90 deg = the character's left) that the skin, every hair style and every piece of
headgear sample with an offset, so nothing crosses.  All rigid on DEF-head."""
import numpy as np

from kit import chunk, ellipsoid, grid_chunk, norm, outward, rot_xyz, tube, box, _hull

SCALE = 1.07
Y0 = 1.588
Y1 = Y0 + 0.236 * SCALE          # chin bottom, crown
Z0 = 0.004                     # the ear line
_H = np.array([0.00, 0.05, 0.12, 0.20, 0.28, 0.36, 0.44, 0.52, 0.60])
_A = np.array([.024, .041, .053, .061, .0665, .071, .0735, .076, .078])     # half width
_F = np.array([.066, .082, .089, .090, .088, .086, .084, .093, .095])       # front of the ear line
_B = np.array([-.030, -.005, .045, .072, .088, .096, .100, .102, .102])     # behind it
_A, _F, _B = _A * SCALE, _F * SCALE, _B * SCALE
CENTER = np.array([0.0, Y0 + 0.60 * (Y1 - Y0), Z0])


def _prof(h):
    h = np.asarray(h, float)
    a, f, b = np.interp(h, _H, _A), np.interp(h, _H, _F), np.interp(h, _H, _B)
    e = np.clip((h - 0.60) / 0.40, 0, 1)
    s = np.sqrt(np.maximum(1 - e * e, 0))
    return a * s, f * s, b * s


def surf(h, th, off=0.0):
    """Points on the head at (h, th) broadcast together, pushed `off` along the outward direction."""
    h, th, off = np.broadcast_arrays(np.asarray(h, float), np.asarray(th, float), np.asarray(off, float))
    th = (th + np.pi) % (2 * np.pi) - np.pi          # the eye dent is written over |th|: 0..2pi dented the left side only
    a, f, b = _prof(np.minimum(h, 1.0))
    c, s = np.cos(th), np.sin(th)
    x = a * s
    z = np.where(c >= 0, f, b) * c
    # eye sockets and temples: shallow dents
    dent = 0.007 * np.exp(-((np.abs(th) - 0.42) / 0.26) ** 2) * np.exp(-((h - 0.455) / 0.07) ** 2)
    k = 1 - dent / np.maximum(np.hypot(x, z), 1e-4)
    P = np.stack([x * k, Y0 + h * (Y1 - Y0), Z0 + z * k], -1)
    n = norm(P - (CENTER + np.array([0, -0.02, 0])))
    n2 = norm(np.stack([x / np.maximum(a, .02) ** 2, np.where(h > 0.6, (h - 0.6) * (Y1 - Y0) / (0.4 * (Y1 - Y0)) ** 2, 0), z / np.maximum(np.where(c >= 0, f, b), .02) ** 2], -1))
    n = norm(n * 0.35 + n2 * 0.65)
    return P + n * off[..., None]


def thetas(S=28, front=0.30):
    t = np.arange(S) * 2 * np.pi / S
    return t - front * np.sin(t)       # denser at the face


def _hrows(h0, h1, n):
    """n+1 heights from h0 to h1, cos-spaced into the crown."""
    u = np.linspace(0, 1, n + 1)
    return h0 + (h1 - h0) * np.sin(u * np.pi / 2) ** 0.9


# ------------------------------------------------------------------------------------------------
# the face: a displacement of surf() used by skin_head (hair, hats and the helmets keep sampling surf; a chin strap lies on the
# face, so it asks face_relief() how far the faces that wear it stand off surf there)
# ------------------------------------------------------------------------------------------------
HH = Y1 - Y0
LOOKS = {
    # look 'a': the default man, thirties, ANGULAR: heavy brow, deep sockets, a nose with a bridge, flat cheeks, a square jaw
    'a': dict(
        socket=7.5, brow=2.8, glabella=1.8, temple=1.5,
        nose_h=[.214, .224, .236, .252, .272, .31, .37, .43, .472, .50], nose_z=[0, 2.0, 14.5, 19.5, 18.0, 13.5, 8.5, 4.2, 1.4, 0], nose_w=1.05, wing=8.5,
        nasolabial=3.5, cheekbone=3.0, cheek_h=.375, hollow=4.5, jaw=2.4, jaw_carve=0.0, chin=4.4, chin_w=19.0, groove=3.6, muzzle=4.5,
        lip_w=23.0, lip_up=5.6, lip_lo=4.3, mouth=4.0, mouth_curve=-0.005, mouth_r=1.5,
        eye_w=16.5, eye_h=8.0, eye_tilt=-3.0, lid=0.30, lash=1.6, flick=0.0, iris=6.2, iris_y=-0.6,
        brow_h=[.510, .526, .531, .517], brow_r=[3.6, 4.3, 3.3, 1.5], brow_th=[.12, .30, .52, .76],
        ear=1.0),
    # look 'b': the second MAN, BROAD and ROUND where a is angular: full cheeks (no hollow), a wide jaw and a broad chin, low thick straight
    #   brows over smaller hooded eyes, a short wide nose with a low bridge, a wide mouth with the heavier lower lip
    'b': dict(
        socket=6.5, brow=3.0, glabella=2.4, temple=0.2,
        nose_h=[.214, .224, .236, .252, .272, .31, .37, .43, .468, .49], nose_z=[0, 2.4, 13.5, 16.5, 13.5, 8.0, 4.2, 2.0, 0.6, 0], nose_w=1.30, wing=10.0,
        nasolabial=4.0, cheekbone=2.0, cheek_h=.33, hollow=-3.0, jaw=6.0, jowl=6.0, jaw_carve=0.0, chin=4.6, chin_w=26.0, groove=3.0, muzzle=3.0,
        lip_w=25.5, lip_up=5.2, lip_lo=5.0, mouth=3.6, mouth_curve=-0.002, mouth_r=1.6,
        eye_w=15.0, eye_h=7.0, eye_tilt=0.0, lid=0.34, lash=1.4, flick=0.0, iris=5.8, iris_y=-0.4,
        brow_h=[.512, .522, .524, .514], brow_r=[4.4, 5.0, 4.2, 2.2], brow_th=[.10, .30, .54, .80],
        ear=1.08),
    # look 'c': the cleaner, a WOMAN: a narrow jaw to a small chin, high cheekbones, no brow ridge, thin high arched brows, larger eyes under a
    #   dark lash line with a flick, a small narrow nose, a narrower mouth with full lips
    'c': dict(
        socket=4.4, brow=0.2, glabella=0.0, temple=0.5,
        nose_h=[.214, .224, .236, .252, .272, .31, .37, .43, .468, .49], nose_z=[0, 1.3, 9.5, 13.0, 9.8, 5.4, 2.8, 1.4, 0.5, 0], nose_w=0.78, wing=4.6,
        nasolabial=1.2, cheekbone=3.2, cheek_h=.375, hollow=0.5, jaw=0.0, jowl=-3.5, jaw_carve=8.0, carve_w=0.10, chin=3.8, chin_w=10.5, groove=3.0, muzzle=3.0,
        lip_w=19.5, lip_up=6.0, lip_lo=4.9, mouth=3.0, mouth_curve=0.006, mouth_r=1.5,
        eye_w=16.2, eye_h=8.6, eye_tilt=6.0, lid=0.27, lash=2.4, flick=1.0, iris=6.3, iris_y=-0.9,
        brow_h=[.538, .552, .556, .540], brow_r=[1.7, 1.9, 1.6, 0.9], brow_th=[.16, .31, .52, .73],
        ear=0.85),
}
EYE_H, EYE_TH = 0.468, 0.415
EYE_Z = [0.0040, 0.0033, 0.0003]      # the eyeball lens: height over the socket floor at its centre, mid ring, rim
INSIDE = np.array([0.0, Y0 + 0.36 * (Y1 - Y0), Z0 + 0.02])      # a point well inside the head: every thin sheet is wound to face away from it
MOUTH_H, LIP_UP_H, LIP_LO_H = 0.1485, 0.168, 0.129      # (4.6 mm lower than it first sat: the mouth was jammed under the nose over a long blank chin)
LIP_TOP_H = 0.186             # the upper lip's upper edge, a row of its own for the same reason: without it the lip is one slope from its crest to the nose
LIP_EDGE_H = 0.110            # the lower lip's lower edge: a row of its own, or the lip is one long slope from its crest down into the chin groove


def _g(u, c, w):
    return np.exp(-((u - c) / w) ** 2)


def _ss(u, a, b):
    t = np.clip((u - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _face_disp(h, th, look):
    """(dn, dz) in metres: along surf()'s own outward direction, and straight forward (the nose).  Zero for
    |th| >= 95 deg and for h >= 0.56; never more than 3 mm outward above h = 0.50.  Where a helmet's chin strap runs
    (h .06-.11 under the chin, climbing to .48-.55 at the sides; it stands 5.5 mm off surf()) keep it under 4 mm
    (the chin's own number is larger: the groove over it takes some back at h .06, and what counts is the sum)."""
    L = LOOKS[look]
    a, f, _ = _prof(np.minimum(h, 1.0))
    th = (th + np.pi) % (2 * np.pi) - np.pi
    ath = np.abs(th)
    x = np.abs(a * np.sin(th)) * 1000          # mm off the midline
    front = np.cos(np.minimum(ath, np.pi / 2))
    dn = np.zeros_like(x)
    # eye sockets: deepest under the brow, easing out toward the cheek
    wh = np.where(h > EYE_H + 0.012, 0.030, 0.062)
    dn -= L['socket'] * _g(x, 31.5, 19) * _g(h, EYE_H + 0.012, wh)
    # the root of the nose between the eyes is NOT carved with them
    # brow ridge and glabella (bounded: hats start at h 0.50)
    dn += L['brow'] * _g(h, 0.530, 0.020) * _ss(x, 4, 16) * (1 - _ss(x, 44, 64))
    dn += L['glabella'] * _g(h, 0.522, 0.024) * _g(x, 0, 11)
    dn -= L['temple'] * _g(ath, 1.15, 0.22) * _g(h, 0.47, 0.06)
    # beside the nose, the cheekbone, the hollow under it
    dn -= L['nasolabial'] * _g(x, 21, 8) * _g(h, 0.30, 0.065)
    dn += L['cheekbone'] * _g(x, 50, 13) * _g(h, L['cheek_h'], 0.045)
    dn -= L['hollow'] * _g(ath, 0.80, 0.30) * _g(h, 0.215, 0.075)
    # jaw: a firmer lower border (a) / carved narrow (b)
    side = _ss(ath, 0.45, 0.75) * (1 - _ss(ath, 1.35, 1.62))
    dn += L['jaw'] * side * _g(h, 0.085, 0.040)
    dn -= L['jaw_carve'] * _ss(ath, 0.28, 0.70) * (1 - _ss(ath, 0.90, 1.35)) * _g(h, 0.185, L.get('carve_w', 0.075)) * _ss(h, 0.03, 0.12)
    # chin and the groove over it
    dn += L['chin'] * np.exp(-(x / L['chin_w']) ** 4) * _g(h, 0.060, 0.036)
    dn -= L['groove'] * _g(x, 0, 22) * _g(h, 0.088, 0.024)
    dn -= L['muzzle'] * _g(x, 0, 38) * _g(h, 0.150, 0.060)
    # lips and the line between them
    W = L['lip_w']
    e = np.clip(1 - (x / W) ** 2, 0, 1) ** 0.8
    e2 = np.clip(1 - (x / (W * 0.88)) ** 2, 0, 1)
    dn += L['lip_up'] * e * _g(h, LIP_UP_H, 0.0115) * (1 - 0.22 * _g(x, 0, 4.5))
    dn += L['lip_lo'] * e2 * _g(h, LIP_LO_H, 0.0135)
    # each lip's crest is ONE row of vertices, and in profile it came to a point (two teeth, a beak): the front of both crests is
    # taken back 1 mm about the midline and the rows next to them let out a little, so each lip is a blunt step and not a spike
    dn -= L.get('lip_round', 1.0) * _g(x, 0, 10.0) * (_g(h, LIP_UP_H, 0.006) + _g(h, LIP_LO_H, 0.006))
    dn += 0.45 * L.get('lip_round', 1.0) * _g(x, 0, 10.0) * (_g(h, LIP_TOP_H, 0.006) + _g(h, LIP_EDGE_H, 0.006))
    dn -= L['mouth'] * np.sqrt(np.clip(1 - (x / (W + 4)) ** 2, 0, 1)) * _g(h, MOUTH_H, 0.0065)
    dn -= 1.0 * _g(x, W + 2.5, 5.5) * _g(h, MOUTH_H, 0.018)
    dn -= 1.1 * _g(x, 0, 4.0) * _g(h, 0.192, 0.018)                   # philtrum
    # the nose: a ridge straight forward
    nz = np.interp(h, L['nose_h'], L['nose_z'], left=0, right=0)
    nw = np.interp(h, [.214, .236, .252, .272, .31, .37, .43, .472], [12.5, 16.5, 17.5, 13.5, 8.5, 6.8, 6.8, 9.5]) * L['nose_w']
    # pinched at the bridge, full at the tip: the ridge's section is a round bulb over the nostrils and a narrow roof above them
    npow = np.interp(h, [.236, .256, .29, .33], [0.85, 0.85, 1.4, 1.75])
    t = np.clip(x / nw, 0, 1)
    dz = nz * (1 - t * t) ** npow
    dz += L['wing'] * _g(x, 10.5 * L['nose_w'], 5.0) * _g(h, 0.240, 0.016)
    # windows: nothing behind 95 deg, nothing at or over h 0.56, <= 3 mm proud over h 0.50
    win = (1 - _ss(ath, np.radians(72), np.radians(95))) * (1 - _ss(h, 0.535, 0.56))
    win = np.where((ath >= np.radians(95)) | (h >= 0.56), 0.0, win)
    dn, dz = dn * win * 1e-3, dz * win * front * 1e-3
    # the jowl (look b): the lower face let out at the SIDES, under the cheekbone and in front of the ear, where the window above has
    # already closed (it eases out from 72 deg; this one holds to 84 and is gone by 95, so the skull behind the ear is still surf()'s).
    # Kept under h 0.3: the helmets' chin straps climb the cheek above that at these angles.
    dn = dn + L.get('jowl', 0.0) * 1e-3 * _ss(ath, 0.50, 1.00) * (1 - _ss(ath, np.radians(84), np.radians(95))) * _g(h, 0.165, 0.085) * _ss(h, 0.02, 0.09)
    dn = np.where(ath >= np.radians(95), 0.0, dn)
    lim = np.where(h > 0.50, 0.003, np.inf)
    return np.minimum(dn, lim), np.minimum(dz, np.where(h > 0.50, 0.0, np.inf))


def face_relief(h, th, looks):
    """(least, most) of the faces' displacement along surf()'s outward direction at (h, th), in metres, over `looks`: what
    lies ON several faces (a chin strap) rides `most` and tucks its edges in under `least`."""
    dn = np.stack([_face_disp(np.asarray(h, float), np.asarray(th, float), k)[0] for k in looks])
    return dn.min(0), dn.max(0)


def face_surf(h, th, look='a', off=0.0):
    """surf() with the face modelled into it; equal to surf() behind 95 deg and from h 0.56 up."""
    h, th, off = np.broadcast_arrays(np.asarray(h, float), np.asarray(th, float), np.asarray(off, float))
    th = (th + np.pi) % (2 * np.pi) - np.pi      # surf()'s eye dent is written over |th|: 0..2pi would dent the left side only
    dn, dz = _face_disp(h, th, look)
    P = surf(h, th, dn + off)
    P[..., 2] += dz
    P[..., 1] = np.maximum(P[..., 1], Y0)          # the chin's bottom stays at h = 0: the neck meets it from below
    return P


def face_thetas(S=28):
    """thetas(S) behind the ears (so the skull's facets are the hair shells' own), columns every ~5 mm across the face."""
    back = thetas(S)[S // 4 + 1: S // 2 + 1]            # 1.50 (k = 8) .. pi for S = 28
    back = back[back > 1.45]
    front = np.array([.0625, .125, .188, .253, .33, EYE_TH, .52, .65, .767, .913, 1.065, 1.27])
    half = np.concatenate([front, back])
    return np.concatenate([[0.0], half, 2 * np.pi - half[-2::-1]])


FACE_ROWS = [0.0, .06, .088, LIP_EDGE_H, LIP_LO_H, MOUTH_H, LIP_UP_H, LIP_TOP_H, .208, .224, .236, .252, .272, .315, .375,
             .425, EYE_H, .497, .527, .56]


def _rigid(c, w1):
    c['W'] = np.broadcast_to(w1, (len(c['V']), w1.shape[1])).copy()
    return c


def _ear(sx, w1, k=1.0):
    """A shallow bowl: the rim (helix) stands off the skull at the back, the concha is sunk inside it."""
    n = 8
    ph = np.arange(n) * 2 * np.pi / n
    u = 0.0150 * np.cos(ph) * (1 + 0.22 * np.sin(ph))      # forward
    v = np.where(np.sin(ph) > 0, 0.030, 0.027) * np.sin(ph)  # up
    rings = [(0.80, -0.004), (1.0, 0.0030), (0.78, 0.0052), (0.42, 0.0022)]
    P = np.array([[[w, v_ * s - 0.002 * (1 - s), u_ * s] for u_, v_ in zip(u, v)] for s, w in rings]) * k
    P = P @ rot_xyz(0, -15, -3).T          # the back edge stands out, the top leans out
    P = P @ rot_xyz(-12, 0, 0).T           # raked back
    P[..., 0] *= sx
    P = P + np.array([sx * 0.0745, Y0 + 0.395 * HH, Z0 - 0.010])
    W = np.broadcast_to(w1, P.shape[:2] + (w1.shape[1],))
    return grid_chunk(P, W, 'skin', 180, True, cap0=False, cap1=True)


def skin_head(Wh, h1=1.0, S=28, face=True, look='a'):
    """The bare head from the chin to h1 (1 = whole skull) with its face (look 'a' = the angular man, 'b' = the broad round
    one, 'c' = the woman: LOOKS) + ears, eyes (the white on slot `eye`, the iris on `rubber`), lids, brows, the mouth line and nostrils."""
    w1 = Wh.reshape(1, -1)
    if not face:
        th = thetas(S)
        hs = np.concatenate([[0.0, 0.05, 0.12, 0.20, 0.28, 0.36, 0.44, 0.52], _hrows(0.60, 1.0, 5)])
        hs = hs[hs <= h1 + 1e-6]
        P = surf(hs[:, None], th[None, :])
        W = np.broadcast_to(Wh, P.shape[:2] + (Wh.shape[-1],))
        return [grid_chunk(P, W, 'skin', 180, True, cap0=True, cap1=h1 < 1.0)]
    L = LOOKS[look]
    th = face_thetas(S)
    hs = np.concatenate([FACE_ROWS, _hrows(0.60, 1.0, 5)])
    hs = hs[hs <= h1 + 1e-6]
    P = face_surf(hs[:, None], th[None, :], look)
    W = np.broadcast_to(Wh, P.shape[:2] + (Wh.shape[-1],))
    skin = grid_chunk(P, W, 'skin', 180, True, cap0=True, cap1=h1 < 1.0)
    # each quad is split along the diagonal that leaves it flattest (one diagonal everywhere creased the two cheeks
    # differently, and a twisted quad under the lip or beside the nose shades as a saw-tooth)
    R_, S_ = P.shape[:2]
    nq = (R_ - 1) * S_
    F, V = skin['F'], skin['V']
    r, q = np.divmod(np.arange(nq), S_)
    a, b = r * S_ + q, r * S_ + (q + 1) % S_
    c, d = b + S_, a + S_
    flipped = not np.array_equal(F[0], [a[0], b[0], c[0]])

    def fnrm(i, j, k):
        return norm(np.cross(V[j] - V[i], V[k] - V[i]))
    m = (fnrm(a, b, d) * fnrm(b, c, d)).sum(1) > (fnrm(a, b, c) * fnrm(a, c, d)).sum(1) + 1e-9
    m = np.where(q >= S_ // 2, ~m[r * S_ + (S_ - 1 - q)], m)          # the right half takes the left half's choice, mirrored
    T1 = np.where(m[:, None], np.stack([a, b, d], 1), np.stack([a, b, c], 1))
    T2 = np.where(m[:, None], np.stack([b, c, d], 1), np.stack([a, c, d], 1))
    Fq = np.concatenate([T1, T2])
    skin['F'] = np.concatenate([Fq[:, ::-1] if flipped else Fq, F[2 * nq:]])
    out = [skin]
    # mouth line: a dark sliver lying in the groove between the lips
    tm = np.arcsin(np.clip((L['lip_w'] + 1.0) / 1000 / _prof(MOUTH_H)[0], -1, 1))
    uu = np.array([-tm, -0.253, -0.125, 0.0, 0.125, 0.253, tm]) / tm            # on the skin grid's own columns
    hm = MOUTH_H + L['mouth_curve'] * uu ** 2
    rh = L['mouth_r'] / 1000 / HH * np.array([0.12, 0.75, 1.0, 1.0, 1.0, 0.75, 0.12])          # half height, in h
    Pm = np.stack([face_surf(hm + rh, uu * tm, look, -0.0003), face_surf(hm, uu * tm, look, 0.0013), face_surf(hm - rh, uu * tm, look, -0.0003)])
    out.append(outward(grid_chunk(Pm, np.broadcast_to(Wh, Pm.shape[:2] + (Wh.shape[-1],)), 'rubber', 180, False, flip=False), INSIDE))
    for sx in (1, -1):
        out.append(_ear(sx, w1, L['ear']))
        # the eye: an almond of WHITE (slot `eye`) sunk in the socket, a dark iris on it, the upper lid a skin hood over its top
        c0 = face_surf(EYE_H, sx * EYE_TH, look)
        tu = (face_surf(EYE_H, sx * 0.52, look) - face_surf(EYE_H, sx * 0.33, look)) * sx     # the skin grid's own edges round the eye
        tv = c0 - face_surf(0.425, sx * EYE_TH, look)      # one-sided ON PURPOSE: up to the 0.492 row the skin leans out into the brow, and a frame
        #   tilted with it buries the eye's lower half (tried: half-shut eyes); the lid hides the upper half anyway
        ax = norm(tu * np.array([1, 0, 1]))
        n = norm(np.cross(ax, tv))
        R = np.stack([ax, np.cross(n, ax), n], 1) @ rot_xyz(0, 0, sx * L['eye_tilt'])
        ew, eh = L['eye_w'] / 1000, L['eye_h'] / 1000
        ph = np.arange(8) * np.pi / 4                      # 0 = the outer corner, 90 deg = top
        ox, oy = sx * ew * np.sign(np.cos(ph)) * np.abs(np.cos(ph)) ** 0.8, eh * np.sin(ph)
        E = np.array([np.stack([ox * k, oy * k, np.full(8, z)], 1) for k, z in ((1.0, EYE_Z[2]), (0.72, EYE_Z[1]))]) @ R.T + c0
        ctr = c0 + n * EYE_Z[0]
        Ve = np.vstack([E.reshape(-1, 3), ctr[None]])
        i = np.arange(8)
        j = (i + 1) % 8
        Fe = np.concatenate([np.stack([i, j, 8 + j], 1), np.stack([i, 8 + j, 8 + i], 1), np.stack([8 + i, 8 + j, np.full(8, 16)], 1)])
        out.append(outward(_rigid(chunk(Ve, Fe, np.zeros((17, 1)), 'eye' if L['iris'] else 'rubber', 180.0), w1), INSIDE))
        if L['iris']:
            # the iris: a dark disc lying on the ball, cut by the eye's own outline (the lids cover its top and bottom)
            # (iris_x: toward the OUTER corner. The almond's inner corner lies under the rise of the skin toward the nose, so the opening
            # a viewer sees is shorter on that side, and an iris centred on the almond read as a slight squint inward)
            ri, iy, ixo = L['iris'] / 1000, L['iris_y'] / 1000, sx * L.get('iris_x', 0.6) / 1000
            rings = []
            for f in (1.0, 0.55):                              # two rings + the centre: the disc follows the ball's own facets
                ix, iyy = ixo + f * ri * np.cos(ph), iy + f * ri * np.sin(ph)
                # nothing of the iris above the lid's margin (+0.3 mm, under the lash line): the ball's crown stands prouder than the
                # middle of the hood, and an iris reaching up there came through the lid as a dark bump
                iyy = np.minimum(iyy, eh * (1 - 2 * L['lid']) * np.sqrt(np.clip(1 - (ix / (ew * 1.04)) ** 2, 0, 1)) ** 0.7 + 0.0003)
                k = np.hypot(ix / ew, iyy / eh)
                sc = np.minimum(1.0, 0.97 / np.maximum(k, 1e-6))
                iz = np.interp(np.minimum(k, 0.97), [0, 0.72, 1.0], EYE_Z) + 0.0011
                rings.append(np.stack([ix * sc, iyy * sc, iz], 1))
            Vi = np.vstack(rings + [[[ixo, iy, EYE_Z[0] + 0.0012]]]) @ R.T + c0
            out.append(outward(_rigid(chunk(Vi, Fe, np.zeros((17, 1)), 'rubber', 180.0), w1), INSIDE))
        # the upper lid: a hood from the buried upper rim down to a margin that stands proud of the eye
        pu = np.linspace(0, np.pi, 5)
        ux, uy = sx * ew * 1.10 * np.cos(pu), eh * 1.25 * np.sin(pu)
        my = eh * (1 - 2 * L['lid']) * np.sin(pu) ** 0.7
        mz = 0.0030 + 0.0030 * np.sin(pu) ** 0.6
        top = np.stack([ux, uy + 0.0005, np.full(5, -0.0002)], 1)
        mar = np.stack([ux / 1.10 * 1.04, my, mz], 1)
        Pl = np.stack([top, mar]) @ R.T + c0
        out.append(outward(grid_chunk(Pl, np.broadcast_to(Wh, Pl.shape[:2] + (Wh.shape[-1],)), 'skin', 180, False, flip=False), INSIDE))
        if L['lash']:
            # the lash line: a dark edge along the lid's margin (heavier, with a flick at the outer corner, on look b)
            t = np.minimum(L['lash'] / 1000 / np.maximum(np.linalg.norm(top - mar, axis=1), 1e-5), 0.9)[:, None] * (0.7 + 0.3 * np.sin(pu))[:, None]
            # (1.2 mm proud of the hood: its upper edge crosses the hood's own quad diagonals, and at 0.4 mm the hood came through the
            # middle of a wide lash line as a skin-coloured stripe)
            lo = mar + np.array([0, -0.45 * L['lash'] / 1000, 0.0005]) * (0.5 + 0.5 * np.sin(pu))[:, None] + np.array([0, 0, 0.0007])
            hi = mar + (top - mar) * t + np.array([0, 0, 0.0012])
            lo[0] += np.array([sx * 0.0030, 0.0018, -0.0006]) * L['flick']
            hi[0] = lo[0] + np.array([0, 0.0002, 0])
            Pq = np.stack([hi, lo]) @ R.T + c0
            out.append(outward(grid_chunk(Pq, np.broadcast_to(Wh, Pq.shape[:2] + (Wh.shape[-1],)), 'rubber', 180, False, flip=False), INSIDE))
        # brow: a tapering dark bar on the ridge
        bp = face_surf(np.array(L['brow_h']), sx * np.array(L['brow_th']), look, 0.0006)
        out.append(tube(bp, np.array(L['brow_r']) / 1000, 'rubber', w1, nseg=4, squash=0.45, up=(0, 0, 1)))
        # nostril: a dark dot under the wing
        nb = face_surf(0.232, sx * 0.085 * L['nose_w'], look)
        out.append(_rigid(ellipsoid(nb + np.array([0, -0.0006, -0.0020]), [0.0036 * L['nose_w'], 0.0020, 0.0042], 'rubber', None, rot_xyz(0, sx * 25, 0), nu=6, nv=2), w1))
    return out


def shell(Wh, rim_fn, off_fn, slot, S=28, K=6, angle=180.0, rim_in=0.0008, top=1.0, hmax=None, gs=None):
    """A cap of the head from the rim line rim_fn(th) up over the crown.

    off_fn(g, th) = thickness at g in 0..1 (rim -> crown).  Row 0 sits `rim_in` off the scalp on the
    rim line (so the edge is closed against the head), row 1 is the outer rim.
    gs = the rows' own g values after the rim (ending in 1) instead of K sine-spaced ones: a thin shell
    with a low rim needs rows close together over the back of the skull, or its long first faces cut
    inside the skull's bulge and the scalp shows through."""
    th = thetas(S)
    hl = rim_fn(th)
    assert gs is None or abs(gs[-1] - 1) < 1e-9, 'shell(): gs must end at 1 (the crown), or the top row is an open ring'
    g = np.concatenate([[0.0, 0.0], np.sin(np.linspace(0, 1, K + 1)[1:] * np.pi / 2) ** 0.9 if gs is None else np.asarray(gs, float)])
    h = hl[None, :] + (top - hl[None, :]) * g[:, None]
    off = np.array([off_fn(gg, th) for gg in g])
    off[0] = rim_in
    P = surf(h, th[None, :], off)
    W = np.broadcast_to(Wh, P.shape[:2] + (Wh.shape[-1],))
    return grid_chunk(P, W, slot, angle, True, False, False)


def rim_interp(deg, vals):
    """rim line from a table over |theta| in degrees."""
    def f(th):
        a = np.abs((np.degrees(th) + 180) % 360 - 180)
        return np.interp(a, deg, vals)
    return f


def band(Wh, h0, h1, off_in, off_out, slot, S=28, th0=None, th1=None, angle=40.0, mid=0):
    """A band round the head between heights h0..h1, standing off_out proud, edges closed to off_in.
    mid = extra rows between the two edges (a tall band over the crown's curve needs them, or its face is a chord
    that cuts inside the shell under it)."""
    th = thetas(S) if th0 is None else np.linspace(th0, th1, S)
    if callable(h0):
        assert mid == 0, 'band(): mid rows are only built between two constant heights'
        hh = np.stack([h0(th), h0(th), h1(th), h1(th)])
    else:
        hh = np.concatenate([[h0], np.linspace(h0, h1, mid + 2), [h1]])[:, None] + 0 * th[None, :]
    off = np.array([off_in] + [off_out] * (len(hh) - 2) + [off_in])[:, None] + 0 * th[None, :]
    P = surf(hh, th[None, :], off)
    W = np.broadcast_to(Wh, P.shape[:2] + (Wh.shape[-1],))
    return grid_chunk(P, W, slot, angle, th0 is None, False, False)


def brim(Wh, h, th0, th1, reach, thick, slot, n=7, droop=0.0, off0=0.004):
    """A cap bill: a convex slab from the head surface out `reach` between angles th0..th1 (radians)."""
    th = np.linspace(th0, th1, n)
    inner = surf(h, th, off0)
    mid = (th0 + th1) / 2
    fwd = np.array([np.sin(mid), 0, np.cos(mid)])
    u = (th - mid) / ((th1 - th0) / 2)
    outer = inner + fwd[None] * (reach * np.sqrt(np.maximum(1 - (u * 0.92) ** 2, 0)))[:, None]
    outer[:, 1] -= droop * np.sqrt(np.maximum(1 - (u * 0.92) ** 2, 0))
    inner = inner - fwd[None] * 0.01
    top = np.vstack([inner, outer])
    V = np.vstack([top, top - np.array([0, thick, 0])])
    F = _hull(V)
    return chunk(V, F, np.broadcast_to(Wh.reshape(1, -1), (len(V), Wh.size)).copy(), slot, 40.0)


def ring_brim(Wh, h, reach, thick, slot, S=28, droop=0.01, wave=0.0, off0=0.006):
    """A full hat brim: a flat ring standing `reach` out from the head at height h."""
    th = thetas(S, 0.0)
    inner = surf(h, th, off0)
    out_dir = norm((inner - np.array([0, 0, Z0])) * np.array([1, 0, 1]))
    wob = 1 + wave * np.sin(th * 3 + 0.7)
    outer = inner + out_dir * (reach * wob)[:, None]
    outer[:, 1] -= droop + 0.006 * np.sin(th * 2 + 1.0) * (wave > 0)
    inner = inner - out_dir * 0.012
    dn = np.array([0, thick, 0])
    P = np.stack([inner, outer, outer - dn, inner - dn])
    W = np.broadcast_to(Wh, P.shape[:2] + (Wh.size,))
    return grid_chunk(P, W, slot, 40.0, True, False, False)
