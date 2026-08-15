#!/usr/bin/env python3
"""GI-IN-MOTION lane — build docs/review/gi-motion.html: self-contained (crops / boil maps / frames as data-URI JPEG+PNG), light + dark + data-theme, < 8 MB.
Inputs: docs/perf/gim-<tier>_<variant>.json (tools/qa/gi-motion.js `run`), docs/perf/gim-cost.json + gim-climb.json (optional), docs/shots/gim_*.jpg, docs/shots/ab/gim_*_boil.png,
tools/qa/gim-prose.json (the words: verdict, section notes, per-tier recommendation — kept apart so the numbers can be re-rendered without touching them).
  python3 tools/qa/gim-page.py [--out docs/review/gi-motion.html]"""
import os, sys, json, base64, io, glob, argparse
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap = argparse.ArgumentParser(); ap.add_argument('--out', default=os.path.join(ROOT, 'docs/review/gi-motion.html')); ap.add_argument('--budget', type=float, default=7.6, help='MB cap for embedded images')
A = ap.parse_args()
PERF = os.path.join(ROOT, 'docs/perf'); SH = os.path.join(ROOT, 'docs/shots'); AB = os.path.join(SH, 'ab')
try: PROSE = json.load(open(os.path.join(ROOT, 'tools/qa/gim-prose.json')))
except Exception: PROSE = {}
P = lambda k, d='': PROSE.get(k, d)

runs = {}
for f in sorted(glob.glob(os.path.join(PERF, 'gim-*.json'))):
    n = os.path.basename(f)[4:-5]
    if n in ('cost', 'climb') or n.startswith('cost') or n.startswith('climb'): continue
    try: d = json.load(open(f)); runs[d.get('tag', n)] = d
    except Exception as e: print('skip', f, e)
runsG = {}
for f in sorted(glob.glob(os.path.join(PERF, 'gim-grain', 'gim-*.json'))):
    try: d = json.load(open(f)); runsG[d.get('tag', os.path.basename(f)[4:-5])] = d
    except Exception as e: print('skip', f, e)
try: COST = json.load(open(os.path.join(PERF, 'gim-cost.json')))
except Exception: COST = None
try: CLIMB = json.load(open(os.path.join(PERF, 'gim-climb.json')))
except Exception: CLIMB = None

TIERS = {'h': 'high', 'hm': "high, the designer's 1024×1000", 'u': 'ultra', 'm': 'medium', 'l': 'low', 'v': 'verylow'}
NAMES = {'old': 'OLD renderer (pre-v3)', 'main': 'main (C3j)', 'calm': 'MOTION_CALM rows (spatialAll + penRays · motion α 0.25 · motion sharpen 0.15)', 'rSAP': 'restir spatialAll + penRays', 'rSAPt': 'MOTION_CALM (= rSAP + the resolve terms)', 'rSAP10': 'rSAP + history 10', 'rSAP10t': 'MOTION_CALM + history 10', 'tOnly': 'resolve motion α 0.25 + motion sharpen 0.15 alone', 'c4BC': 'c4 + B + C', 'mainR': 'main (repeat)', 'floor': 'FLOOR = ReSTIR off + the resolve\'s motion terms off', 'noTaaMot': "main − the resolve's motion terms", 'dLeader': 'main with the LEADER/TAIL direct estimator (ReSTIR off)', 'dNoMoveCue': "main − the shadow client's occluder cue",
         'g2': 'gather ½ res (divisor alone)', 'A085': 'A: scale 0.85', 'A090': 'A: scale 0.90', 'A1': 'A: scale 1.0 (sharp direct off there)', 'A1g': 'A: 1.0 + gather ½', 'B': 'B: GI denoised at internal res', 'B2': 'B with 2 internal-res à-trous',
         'C': 'C: young-history rays ×3', 'C2': 'C ×2', 'BC': 'B + C', 'B2C': 'B(2 iters) + C', 'BCD': 'B + C + D (clamp cut 1, young widen 2)', 'CD1': 'C + clamp cut', 'A090BC': 'A 0.90 + B + C', 'A1gBC': 'A 1.0 + gather ½ + B + C', 'final': 'FINAL (recommended)'}
used_bytes = 0
def _enc(im, fmt='JPEG', q=84):
    global used_bytes
    b = io.BytesIO(); im.save(b, fmt, quality=q) if fmt == 'JPEG' else im.save(b, fmt); s = base64.b64encode(b.getvalue()).decode(); used_bytes += len(s)
    return f'data:image/{"jpeg" if fmt == "JPEG" else "png"};base64,{s}'
def img_tag(path, w=None, q=84, alt='', pixel=True, fmt=None):
    if not os.path.exists(path): return f'<div class="missing">{alt or os.path.basename(path)}: no image</div>'
    im = Image.open(path).convert('RGB')
    if w and im.size[0] > w: im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.NEAREST if pixel and im.size[0] % w == 0 else Image.BILINEAR)
    if used_bytes > A.budget * 1024 * 1024: return f'<div class="missing">{alt}: over the page\'s image budget</div>'
    return f'<img alt="{alt}" src="{_enc(im, fmt or ("PNG" if path.endswith(".png") else "JPEG"), q)}" width="{im.size[0]}" height="{im.size[1]}">'
def crop_path(tag, scene, view, tile, f): return os.path.join(SH, f'gim_{tag}_{scene}v{view}_{tile}_f{f}.jpg')
def boil_path(tag, scene, view, tile): return os.path.join(AB, f'gim_{tag}_{scene}v{view}_{tile}_boil.png')
def frame_path(tag, scene, view): return os.path.join(SH, f'gim_{tag}_{scene}v{view}_frame.jpg')

def tile_of(tag, scene, tile, src=None):
    r = (src if src is not None else runs).get(tag); m = r and r['scenes'].get(scene); t = m and m['tiles'].get(tile)
    return None if (not t or t.get('error')) else t
def share_of(tag, scene, tile):
    r = runs.get(tag); s = r and r['scenes'].get(scene[:-2] + 'share'); return s and s.get(tile)
def f3(v, d=3): return '—' if v is None else f'{v:.{d}f}'
def cell(t, keys=('sdAbs', 'sdRel', 'absDelta', 'boil', 'sizePx'), ref=None):
    if not t: return '<td class="mut">—</td>'
    sd = t['sdAbs']; cls = ''
    if ref and ref.get('sdAbs'):
        r = sd / ref['sdAbs']
        cls = ' class="good"' if r < 0.85 else ' class="bad"' if r > 1.15 else ''
    return f'<td{cls}>{sd:.3f} <span class="kind">({t["sdRel"]*100:.1f} %)</span><br><span class="kind">|Δ| {t["absDelta"]:.2f} · boil {t["boil"]:.1f} · {t["sizePx"] or 0:.1f} px</span></td>'

def var_table(tier, scene, tiles, variants, caption, refv='main', still=None, src=None):
    R = src if src is not None else runs
    tags = [f'{tier}_{v}' for v in variants if f'{tier}_{v}' in R]
    if not tags: return f'<p class="mut">(no runs for {tier} {scene})</p>'
    h = f'<div class="scroll"><table><caption>{caption}</caption><tr><th>variant</th>' + ''.join(f'<th>{tl}</th>' for tl in tiles) + (f'<th>{still[1]}</th>' if still else '') + '</tr>'
    reft = {tl: tile_of(f'{tier}_{refv}', scene, tl, R) for tl in tiles}
    for tg in tags:
        v = tg.split('_', 1)[1]
        h += f'<tr><td>{NAMES.get(v, v)}</td>' + ''.join(cell(tile_of(tg, scene, tl, R), ref=None if v == refv else reft[tl]) for tl in tiles)
        if still: h += cell(tile_of(tg, still[0], still[2], R), ref=None if v == refv else tile_of(f'{tier}_{refv}', still[0], still[2], R))
        h += '</tr>'
    return h + '</table></div>'
def share_table(tier, scene, tiles, variants, caption):
    tags = [f'{tier}_{v}' for v in variants if f'{tier}_{v}' in runs and runs[f'{tier}_{v}']['scenes'].get(scene[:-2] + 'share')]
    if not tags: return ''
    h = f'<div class="scroll"><table><caption>{caption}</caption><tr><th>variant</th>' + ''.join(f'<th>{tl}</th>' for tl in tiles) + '</tr>'
    for tg in tags:
        v = tg.split('_', 1)[1]; h += f'<tr><td>{NAMES.get(v, v)}</td>'
        for tl in tiles:
            s = share_of(tg, scene, tl)
            h += '<td class="mut">—</td>' if not s else f'<td>{s["sdWithGi"]:.3f} / {s["sdNoGi"]:.3f}<br><span class="kind">GI alone {s["giSd"]:.3f} · {s["giShareVar"]*100:.0f} % of var · L {s["meanWithGi"]:.0f} / {s["meanNoGi"]:.0f}</span></td>'
        h += '</tr>'
    return h + '</table></div>'
def strip(tag, scene, view, tile, w=260, label=None):
    """three consecutive frames + the boil map of one tile"""
    v = tag.split('_', 1)[1] if '_' in tag else tag
    cells = ''.join(f'<figure>{img_tag(crop_path(tag, scene, view, tile, f), w, alt=f"{tag} {tile} f{f}")}<figcaption>frame {f}</figcaption></figure>' for f in (11, 12, 13))
    cells += f'<figure>{img_tag(boil_path(tag, scene, view, tile), max(120, w // 2), alt=f"{tag} {tile} boil", fmt="PNG")}<figcaption>boil map: max − min over 24 frames, ×8 (32 levels = white; dark red = his silhouette)</figcaption></figure>'
    return f'<div class="strip"><div class="striptitle">{label or NAMES.get(v, v)} — {tile}</div><div class="cells">{cells}</div></div>'

CSS = """<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#2f6c8f;--good:#1f7a3a;--bad:#a12626;--th:#f1eee6}
@media (prefers-color-scheme: dark){:root{--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#7cc0e6;--good:#6fd08c;--bad:#f08080;--th:#24231f}}
:root[data-theme="light"]{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#2f6c8f;--good:#1f7a3a;--bad:#a12626;--th:#f1eee6}
:root[data-theme="dark"]{--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#7cc0e6;--good:#6fd08c;--bad:#f08080;--th:#24231f}
html{background:var(--bg);color:var(--fg)}body{max-width:1200px;margin:0 auto;padding:28px 18px 80px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:34px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{font-size:16px;margin:22px 0 6px}
p{margin:8px 0}.lede{font-size:16px}.mut,.note{color:var(--mut)}.note{font-size:13px}code{font:13px ui-monospace,Menlo,monospace;background:var(--th);padding:1px 4px;border-radius:3px}
.verdict{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);padding:12px 16px;border-radius:6px;margin:14px 0}
.scroll{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;font-size:13px;min-width:640px;width:100%}caption{text-align:left;font-weight:600;padding:4px 0;color:var(--mut)}
th,td{border:1px solid var(--line);padding:4px 6px;text-align:right;white-space:nowrap;vertical-align:top}th{background:var(--th)}td:first-child,th:first-child{text-align:left;white-space:normal;min-width:200px}
.kind{color:var(--mut);font-size:11px}.good{color:var(--good)}.bad{color:var(--bad)}b.k{color:var(--acc)}
.strip{margin:14px 0 6px}.striptitle{font-weight:600;margin-bottom:4px}.cells{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px;max-width:100%}
figure img{display:block;max-width:100%;height:auto;image-rendering:pixelated}figcaption{font-size:12px;color:var(--mut);padding-top:4px;max-width:300px}
.missing{width:260px;height:60px;display:flex;align-items:center;justify-content:center;color:var(--bad);border:1px dashed var(--bad);font-size:12px}
ul.tight li{margin:2px 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:900px){.two{grid-template-columns:1fr}}
</style>"""

def build():
    H = ['<title>GI in motion — what the noise in motion is, and the levers measured</title>', CSS]
    H.append(f'<h1>{P("h1", "GI in motion — what the noise in motion is, and the levers measured")}</h1>')
    H.append(f'<p class="mut">{P("byline", "Lane v3/gi-motion · docs/internal/gi-motion.md has every number and how it was taken · M4 Max, Chrome / Metal · high = 1368×770 internal → 1777×1000 output unless a row says otherwise")}</p>')
    H.append(f'<div class="verdict"><p class="lede">{P("verdict", "(verdict)")}</p>{P("verdict2", "")}</div>')
    # ---- 1. the two scenes
    H.append(f'<h2>1. The two shots of the recording, reproduced</h2>{P("scenes", "")}')
    H.append('<div class="two">' + f'<figure>{img_tag(frame_path("h_main", "s1", 0), 590, alt="S1 frame", pixel=False)}<figcaption>{P("s1cap", "S1 — the window-lit cubicle floor: Sam walks east at his walking pace under the follow camera (pan ≈ 2.4 output px / frame); tiles re-projected per frame")}</figcaption></figure>'
             + f'<figure>{img_tag(frame_path("h_main", "s2", 0), 590, alt="S2 frame", pixel=False)}<figcaption>{P("s2cap", "S2 — the breach, stack shot: Blue One walking the last metre along the break room wall; his silhouette + 8 px is masked per frame")}</figcaption></figure></div>')
    H.append(f'<p class="note">{P("metricNote", "")}</p>')
    # ---- 2. attribution
    tilesS1 = ['unlit', 'unlitAisle', 'lightEdge', 'sillWall', 'litFloor']; tilesS2 = ['wall', 'wallHigh', 'door']   # (stripe / moonStripe are in the JSON but occluded by the desk cluster for part of the pan — out of every table)
    H.append(f'<h2>2. Attribution — whose noise is it?</h2>{P("attr", "")}')
    H.append(share_table('h', 's1v0', tilesS1, ['main', 'mainR', 'old', 'B', 'C', 'BC', 'A090', 'rSAPt'], 'S1 pan, composite: temporal sd WITH / WITHOUT the GI term (settings.indirectScale 0 — everything else, the resolve included, identical) → the GI\'s own part and its share of the variance'))
    H.append(share_table('h', 's2v0', tilesS2, ['main', 'old', 'B', 'C', 'BC'], 'S2 stack shot, the same'))
    H.append(var_table('h', 's1v4', tilesS1, ['mainAttr', 'BCAttr'], 'S1 pan under the INDIRECT-only debug view (the GI term naked: no resolve, no sharp direct) — 8-bit sd (rel) · |Δ| · boil · blotch size', refv='mainAttr'))
    H.append(var_table('h', 's1v3', tilesS1, ['mainAttr'], 'S1 pan under the DIRECT-only debug view (the control)', refv='mainAttr'))
    H.append(var_table('h', 's1v0', tilesS1, ['main', 'dLeader', 'noTaaMot', 'dNoMoveCue', 'floor', 'old'], "S1 pan, composite — the direct estimator's and the resolve's share: ReSTIR off (the leader / tail path), the resolve's motion terms off, the shadow client's occluder cue off, both off (‘floor’), and the OLD renderer", still=('s1stillv0', 'unlit STILL', 'unlit')))
    H.append(var_table('h', 's2v0', tilesS2, ['main', 'dLeader', 'noTaaMot', 'dNoMoveCue', 'floor', 'old'], 'S2 stack shot (static camera, the operative walking), composite — the same switches'))
    H.append(P('attrAfter', ''))
    H.append('<h3>Crops — ×3 nearest, three consecutive frames of the pan, and the boil map of the tile</h3><p class="note">The world tile drifts left through the crop as the camera pans right; compare TEXTURE frame to frame inside the floor, not position. Boil maps: brighter = that floor point changed more over the 24 frames (×8: 32 levels = white).</p>')
    for tg, lab in [('h_main', 'main — unlit floor'), ('h_dLeader', 'ReSTIR off (leader / tail) — unlit floor'), ('h_floor', 'FLOOR (ReSTIR off + no motion terms) — unlit floor'), ('h_old', 'OLD renderer — unlit floor')]:
        if tg in runs: H.append(strip(tg, 's1', 0, 'unlit', 280, lab))
    for tg, lab in [('h_main', "main — the light's edge"), ('h_dLeader', "ReSTIR off — the light's edge"), ('h_old', "OLD renderer — the light's edge")]:
        if tg in runs: H.append(strip(tg, 's1', 0, 'lightEdge', 280, lab))
    for tg, lab, v in [('h_mainAttr', 'main — the GI term NAKED (indirect-only view 4), unlit floor', 4), ('h_mainAttr', 'main — the DIRECT term naked (view 3), unlit floor', 3), ('h_dLeaderAttr', 'ReSTIR off — the direct term naked (view 3), unlit floor', 3)]:
        if tg in runs: H.append(strip(tg, 's1', v, 'unlit', 280, lab))
    # ---- 2b. the direct side's own levers (settings this lane may place per tier): ReSTIR rows, the resolve's motion terms, the shadow client's caps — S1 pan, grain ON (ranking only)
    H.append(f'<h3>2b. The direct chain\'s and the resolve\'s own knobs under the same pan</h3>{P("knobs", "")}')
    KN = ['mainR1', 'mainR2', 'mainR3', 'rHist8', 'rHist4', 'rRays5', 'rRays6', 'rSpAll', 'rSp5', 'rPerm', 'rPenCap6', 'rPenRays', 'rGrad2', 'rCoh', 'tma30', 'tma20', 'tma10', 'tsm0', 'ths0', 'shCap20', 'shCap6', 'dirHist5', 'combo1', 'combo2']
    NAMES.update({'mainR1': 'main (repeat 1)', 'mainR2': 'main (repeat 2)', 'mainR3': 'main (repeat 3)', 'rHist8': 'restirHistory 20 → 8', 'rHist4': 'restirHistory → 4', 'rRays5': 'restirRays 4 → 5 (final ray, spatial everywhere)', 'rRays6': 'restirRays → 6',
                  'rSpAll': 'restirSpatialAll', 'rSp5': 'restirSpatial 3 → 5', 'rPerm': 'restirPermute', 'rPenCap6': 'restirPenCap 6', 'rPenRays': 'restirPenRays', 'rGrad2': 'restirGradK 5 → 2', 'rCoh': 'restirCoherent',
                  'tma30': 'taauMotionAlpha 0.4 → 0.3', 'tma20': 'taauMotionAlpha → 0.2', 'tma10': 'taauMotionAlpha → 0.1 (= no motion term)', 'tsm0': 'taauSharpenMotion 0.3 → 0', 'ths0': 'taauHistSharp 0.5 → 0', 'shCap20': 'dnShadowCap 12 → 20', 'shCap6': 'dnShadowCap → 6', 'dirHist5': 'directHistory 0.7 → 0.5',
                  'combo1': 'restirRays 5 + motion α 0.25 + motion sharpen 0.15', 'combo2': 'restirSpatialAll + motion α 0.25 + motion sharpen 0.15'})
    KN += ['c3', 'c4', 'c5', 'c6', 'c7', 'floor', 'mainR4', 'dLeader', 'old']
    NAMES.update({'c3': 'c3 = restirHistory 6 + spatialAll + penRays', 'c4': 'c4 = c3 + motion α 0.25 + motion sharpen 0.15', 'c5': 'restirRays 5 + history 6 + α 0.25 + sharpen 0.15', 'c6': 'rays 5 + penRays + history 8 + α 0.25 + sharpen 0.15', 'c7': 'spatialAll + penRays + α 0.2 + sharpen 0.1 + shadowCap 20', 'floor': 'FLOOR = ReSTIR off + no motion terms (what the old renderer amounts to)', 'mainR4': 'main (repeat 4)'})
    H.append(var_table('h', 's1v0', tilesS1, KN, 'S1 pan, composite, film grain ON (the first evening\'s takes: they RANK the knobs — repeats 1–4 of main give the take-to-take spread; the grain-free re-takes of the winners are in §3) — green / red vs main (repeat 1)', refv='mainR1', src=runsG))
    # ---- 3. variants at high
    H.append(f'<h2>3. The levers at high — A (resolution / divisor), B (GI at internal res), C (young-history rays), D</h2>{P("levers", "")}')
    VH = ['old', 'main', 'mainR', 'A090', 'B', 'C', 'BC', 'tOnly', 'rSAP', 'rSAPt', 'rSAP10t', 'c3', 'c4', 'c4BC', 'floor']
    H.append(var_table('h', 's1v0', tilesS1, VH, 'S1 pan, composite — 8-bit temporal sd (rel) · |Δ| · boil · blotch size; green / red = ±15 % vs main; last column the STILL', still=('s1stillv0', 'unlit STILL', 'unlit')))
    H.append(var_table('h', 's2v0', tilesS2, VH, 'S2 stack shot, composite'))
    H.append(P('leversAfter', ''))
    H.append('<h3>Crops</h3>')
    for tg, lab in [('h_main', 'main — unlit floor'), ('h_rSAPt', 'MOTION_CALM — unlit floor'), ('h_BC', 'B + C — unlit floor')]:
        if tg in runs: H.append(strip(tg, 's1', 0, 'unlit', 280, lab))
    for tg, lab in [('h_main', "main — the light's edge"), ('h_rSAPt', "MOTION_CALM — the light's edge"), ('h_rSAP10t', "MOTION_CALM + history 10 — the light's edge"), ('h_floor', "FLOOR — the light's edge")]:
        if tg in runs: H.append(strip(tg, 's1', 0, 'lightEdge', 280, lab))
    for tg, lab in [('h_main', 'main — S2 wall (static camera; the operative walks through the right of the crop)'), ('h_rSAPt', 'MOTION_CALM — S2 wall'), ('h_BC', 'B + C — S2 wall'), ('h_dLeader', 'ReSTIR off — S2 wall'), ('h_old', 'OLD renderer — S2 wall')]:
        if tg in runs: H.append(strip(tg, 's2', 0, 'wall', 240, lab))
    # ---- 4. other tiers
    H.append(f'<h2>4. Every tier</h2>{P("tiers", "")}')
    for tier in ['u', 'm', 'l', 'v']:
        vs = [v for v in ['old', 'main', 'calm', 'BC', 'B', 'floor'] if f'{tier}_{v}' in runs]
        if not vs: H.append(f'<p class="mut">({TIERS[tier]}: no runs yet)</p>'); continue
        H.append(var_table(tier, 's1v0', tilesS1, vs, f'{TIERS[tier].upper()} — S1 pan, composite', still=('s1stillv0', 'unlit STILL', 'unlit')))
        if any(runs[f'{tier}_{v}']['scenes'].get('s2v0') for v in vs): H.append(var_table(tier, 's2v0', tilesS2, vs, f'{TIERS[tier].upper()} — S2 stack shot, composite'))
        H.append(share_table(tier, 's1v0', tilesS1, vs, f'{TIERS[tier]} — GI share (with / without)'))
    # ---- 5. the designer's framing
    H.append(f'<h2>5. The designer\'s window — 788×770 → 1024×1000 at high</h2>{P("maint", "")}')
    vs = [v for v in ['old', 'main', 'calm', 'BC', 'A090', 'floor'] if f'hm_{v}' in runs]
    if vs: H.append(var_table('hm', 's1v0', tilesS1, vs, 'S1 pan at 1024×1000 output, composite', still=('s1stillv0', 'unlit STILL', 'unlit'))); H.append(share_table('hm', 's1v0', tilesS1, vs, '1024×1000 — GI share'))
    else: H.append('<p class="mut">(no runs at the designer\'s framing yet)</p>')
    for tg, lab in [('hm_main', 'main at 1024×1000 — unlit floor'), ('hm_calm', 'MOTION_CALM at 1024×1000 — unlit floor'), ('hm_old', 'OLD renderer at 1024×1000 — unlit floor'), ('hm_main', "main at 1024×1000 — the light's edge"), ('hm_calm', "MOTION_CALM at 1024×1000 — the light's edge")]:
        if tg in runs: H.append(strip(tg, 's1', 0, 'unlit' if 'unlit' in lab else 'lightEdge', 280, lab))
    # ---- 6. the climb
    H.append(f'<h2>6. (A) The headroom-aware climb</h2>{P("climb", "")}')
    if CLIMB:
        for key, c in CLIMB.items():
            rows = ''.join(f'<tr><td>{r["rung"]}</td><td>{r["res"]}</td><td>{r["union"]:.2f}</td><td>{r["p95"]:.2f}</td><td>{" · ".join(f"{k} {v:.2f}" for k, v in r["passes"].items() if v and k in ("direct","softblur","gather","temporal","volFroxel","sharpU","compS","taau"))}</td></tr>' for r in c.get('curve', []))
            H.append(f'<div class="scroll"><table><caption>{c.get("title", key)}: serialized calm-still union per rung</caption><tr><th>rung</th><th>internal → output</th><th>∪ med ms</th><th>p95</th><th>passes</th></tr>{rows}</table></div>')
            st = c.get('sim', {}).get('settled'); lg = c.get('sim', {}).get('log', [])
            if st: H.append(f'<p>The real ladder driven at 60 fps against those numbers (+0.5 ms slack): {" → ".join(e["note"].split(" (")[0] for e in lg)} — settles at <b>scale {st["scale"]:.2f}{", gather ½" if not st["gatherThird"] else ""}{", vol ½" if not st["volQuarter"] else ""}</b> (∪ ≈ {st["union"]:.1f} ms of 16.7).</p>')
    else: H.append('<p class="mut">(cost curve not measured yet — the GPU was contended)</p>')
    # ---- 7. cost + memory
    H.append(f'<h2>7. Cost and memory</h2>{P("cost", "")}')
    if COST:
        rows = ''
        for r in COST.get('pairs', []): rows += f'<tr><td>{r["tier"]}</td><td>{r["b"]}</td><td>{r["kind"]}</td><td>{r["A"]:.2f}</td><td>{r["B"]:.2f}</td><td>{r["B"]-r["A"]:+.2f}</td><td>{r.get("note","")}</td></tr>'
        H.append(f'<div class="scroll"><table><caption>Serialized A/B unions (ms; A = main)</caption><tr><th>tier</th><th>variant</th><th>take</th><th>A</th><th>B</th><th>Δ</th><th>note</th></tr>{rows}</table></div>')
        if COST.get('memory'): H.append('<ul class="tight">' + ''.join(f'<li>{m}</li>' for m in COST['memory']) + '</ul>')
    else: H.append('<p class="mut">(cost table pending an uncontended GPU)</p>')
    # ---- 8. recommendation
    H.append(f'<h2>8. Recommendation per tier, and what is left</h2>{P("reco", "")}{P("residuals", "")}{P("notdone", "")}')
    html = '\n'.join(H)
    open(A.out, 'w').write(html)
    print(f'→ {A.out}: {len(html)/1048576:.2f} MB ({used_bytes/1048576:.2f} MB of images), {len(runs)} runs')
build()
