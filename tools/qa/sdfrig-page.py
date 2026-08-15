#!/usr/bin/env python3
"""SDF CHARACTER RIG (branch exp/sdf-characters) — build docs/review/sdf-characters.html: self-contained (inline CSS, crops as data-URI JPEG), light + dark +
data-theme, < 8 MB. Inputs: docs/perf/sr-<tier>.json (the pane harness's batteries: __sr.battery), docs/perf/sr-fit.json (bun run tools/qa/sdfrig-fit.ts --json),
docs/perf/sr-extra.json (identity hashes, the disc check, gates, tier costs — written by hand / by the harness), docs/shots/sr_fit.png, docs/shots/sr_<tier>_*.jpg,
docs/shots/chaos_<scene>_<tier>_*.jpg, docs/review/sdf-characters.prose.json (verdicts and prose, kept out of the code).
  python3 tools/qa/sdfrig-page.py"""
import os, sys, json, base64, io, html
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = os.path.join(ROOT, 'docs/shots'); PERF = os.path.join(ROOT, 'docs/perf'); OUT = os.path.join(ROOT, 'docs/review/sdf-characters.html')
def load(name, default=None):
    p = os.path.join(PERF, name)
    return json.load(open(p)) if os.path.exists(p) else (default if default is not None else {})
R = {t: load(f'sr-{t}.json') for t in ['high', 'ultra', 'medium', 'low', 'verylow']}
# high is assembled from several sessions: run 1 (sr-high-run1: temporal sd), the dynamic scenes graded against per-variant references (sr-high6), the corrected
# battery after BoxWorld learned to restore the game's capsule words (sr-highB: profiles, IoU, stills, the cap-side costs), and sr-high (reflection stills, cone-side costs)
_run1, _dyn, _B = load('sr-high-run1.json'), load('sr-high6.json'), load('sr-highB.json')
R['high']['sd'] = _run1.get('sd') or R['high'].get('sd'); R['high']['dyn'] = _dyn.get('dyn') or {}; R['high']['profiles'] = _B.get('profiles') or {}; R['high']['iou'] = _B.get('iou') or {}
R['high']['cost'] = {**{k: v for k, v in (R['high'].get('cost') or {}).items() if not k.split(':')[1].startswith('cap')}, **(_B.get('cost') or {})}
R['ultra']['cost'] = {**{k: v for k, v in (R['ultra'].get('cost') or {}).items() if not k.split(':')[1].startswith('cap')}, **(load('sr-ultraB.json').get('cost') or {})}   # (ultra's first cap pair ran before the restore fix: replaced by the redo)
STILL_TAG = 'highB'; DYN_TAG = 'high6'
FIT = load('sr-fit.json'); X = load('sr-extra.json'); VAL = load('sr-validate.json'); DIAG = load('sr-diag.json')
PROSE_F = os.path.join(ROOT, 'docs/review/sdf-characters.prose.json'); PROSE = json.load(open(PROSE_F)) if os.path.exists(PROSE_F) else {}
budget = [0]
esc = html.escape

def img(name, w=None, q=84, ext='jpg', nearest=False, cls=''):
    p = os.path.join(SHOTS, f'{name}.{ext}')
    if not os.path.exists(p): return f'<div class="missing">{esc(name)}</div>'
    im = Image.open(p).convert('RGB')
    if w and im.size[0] > w: im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.NEAREST if nearest else Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); data = b.getvalue(); budget[0] += len(data)
    return f'<img{(" class=%s" % cls) if cls else ""} alt="{esc(name)}" src="data:image/jpeg;base64,{base64.b64encode(data).decode()}" width="{im.size[0]}" height="{im.size[1]}" loading="lazy">'
def prose(key, default=''): v = PROSE.get(key, default); return v if isinstance(v, str) else default
def fmt(v, nd=2):
    if v is None: return '—'
    if isinstance(v, (int, float)): return f'{v:.{nd}f}'
    return esc(str(v))
LABEL = {'ref': 'history-free reference', 'cap': 'capsules (main)', 'cone': 'round cones (i)', 'coneLoose': 'round cones, 1.5 m cull', 'mesh': 'mesh shadows (ultra)', 'softA': 'soft, analytic strip (iii)', 'softM': 'soft, marched field (iii)', 'softMS': 'soft, marched smooth union', 'smooth': 'smooth-union closest hit (ii)', 'meshRefl': 'mesh closest hit (ultra)', 'softMesh': 'soft + mesh'}
def label(v): return LABEL.get(v, v)

def strip(title, cells, cap=''):
    """cells: [(image name, caption)] → a flex row of figures"""
    figs = ''.join(f'<figure>{img(n, w=wd, nearest=True)}<figcaption>{esc(c)}</figcaption></figure>' for n, c, wd in cells)
    return f'<div class="strip"><div class="striptitle">{title}</div><div class="cells">{figs}</div>{f"<p class=note>{cap}</p>" if cap else ""}</div>'

def fit_table():
    if not FIT: return '<p class="missing">no sr-fit.json (bun run tools/qa/sdfrig-fit.ts --json > docs/perf/sr-fit.json)</p>'
    rows = []
    for s in FIT['slots']:
        r0, r1 = s['r0'], s['r1']
        rows.append(f"<tr><th>{esc(s['name'])}{' *' if s.get('overridden') else ''}</th><td class=cap>{s['hand']:.3f}</td><td class=cone>{r0:.3f}{'' if abs(r1 - r0) < 5e-4 else f' → {r1:.3f}'}</td><td>{s['n']}</td><td>{s['rms']*1000:.1f}</td><td>{s['maxAbs']*1000:.0f}</td><td>{s['cover']*100:.0f} %</td><td>{s['len']:.3f}</td></tr>")
    allN = sum(s['n'] for s in FIT['slots']); se = sum(s['rms']**2 * s['n'] for s in FIT['slots'])
    return ('<div class="scroll"><table><thead><tr><th>slot</th><th>hand capsule r (m)</th><th>fitted r0 → r1 (m)</th><th>vertices</th><th>rms (mm)</th><th>max (mm)</th><th>inside</th><th>segment (m)</th></tr></thead><tbody>'
            + ''.join(rows) + f'</tbody></table></div><p class="note">{FIT["verts"]} vertices in the mesh, {allN} used, overall rms {(se/max(1,allN))**0.5*1000:.1f} mm; solved in {FIT["ms"]} ms at load. Blend radii per slot (m): {" · ".join(f"{n} {k}" for n, k in zip(FIT["names"], FIT["k"]) if k)}.</p>')

def profile_table(tier='high'):
    P = (R[tier] or {}).get('profiles') or {}
    lines = [('lampW_contact', 'lamp, 0.25 m behind the man (a shin, by the shoe)'), ('lampW_near', 'lamp, 0.5 m (shins)'), ('lamp_mid', 'lamp, 1.4 m (the trunk\'s edge)'), ('lamp_far', 'lamp, 2.3 m (the head end)'), ('torch_wall', 'torch → wall 0.9 m past him, chest height'), ('torch_wallLow', 'torch → wall, knee height')]
    vs = ['cap', 'cone', 'mesh', 'softA', 'softM']
    h = ['<div class="scroll"><table><thead><tr><th rowspan=2>edge (line walked from the lit floor into the shadow)</th>' + ''.join(f'<th colspan=2 class="{v}">{esc(label(v))}</th>' for v in vs) + '</tr><tr>' + '<th>width</th><th>edge at</th>' * len(vs) + '</tr></thead><tbody>']
    for key, name in lines:
        row = P.get(key)
        if not row: h.append(f'<tr><th>{esc(name)}</th>' + '<td>—</td><td>—</td>' * len(vs) + '</tr>'); continue
        rr = row['rows']; mesh = rr.get('mesh') or {}
        cells = []
        for v in vs:
            q = rr.get(v) or {}
            wcm, mid = q.get('widthCm'), q.get('midCm')
            d = (mid - mesh['midCm']) if (mid is not None and mesh.get('midCm') is not None and v != 'mesh') else None
            cells.append(f'<td>{fmt(wcm,1)} cm</td><td>{fmt(mid,1)}{f" <small>({-d:+.1f})</small>" if d is not None else ""}</td>')
        h.append(f'<tr><th>{esc(name)}</th>' + ''.join(cells) + '</tr>')
    h.append('</tbody></table></div><p class="note">width = the 90 → 10 % fall of the sharp emitter class\'s visibility (lum S ∕ lum U of the denoised direct pair — albedo, the beam\'s own gradient and the tonemap cancel), mean of 12 settled renders, in cm on the floor / wall; edge at = the 50 % crossing along the line, and in brackets how much FATTER (+) or thinner (−) than the mesh reference\'s the shadow is there.</p>')
    return ''.join(h)

def iou_table(tier='high'):
    I = (R[tier] or {}).get('iou') or {}
    if not I: return '<p class="missing">no silhouette IoU rows</p>'
    vs = ['cap', 'cone', 'softA', 'softM']
    h = ['<div class="scroll"><table><thead><tr><th>tile (shadow mask vis &lt; 0.5, vs the mesh reference\'s)</th>' + ''.join(f'<th class="{v}">{esc(label(v))}<br><small>IoU · area × · differs</small></th>' for v in vs) + '</tr></thead><tbody>']
    for key, row in I.items():
        cells = ''.join((lambda q: f'<td>{fmt(q.get("iou"),3)} · ×{fmt(q.get("areaRel"),2)} · {fmt(q.get("diffShare",0)*100,1)} %</td>')(row['rows'].get(v) or {}) for v in vs)
        h.append(f'<tr><th>{esc(key.replace("_", " / "))} <small>ref {row.get("refArea")} of {row.get("texels")} texels</small></th>{cells}</tr>')
    h.append('</tbody></table></div>')
    return ''.join(h)

def dyn_table(tier='high'):
    D = (R[tier] or {}).get('dyn') or {}
    scenes = [('PL', 'PL — lamp sweep: the man slid across the corridor under the 6 cm lamp at 1.4 m/s, his 3 m shadow sweeping the lino at ~4× that (near = shins, far = trunk / head / arms)'), ('PT', 'PT — the corridor torch yawing 25° while the man walks through its beam (a hard shadow moving on wall + lino under a moving light)'), ('P0', 'P0 — the image-quality program’s scene: the man walking through the fixed torch beam (1.4 m/s, 8.5 px a frame)')]
    vs = ['cap', 'cone', 'mesh', 'softA', 'softM']
    out = []
    for sc, name in scenes:
        M = (D.get(sc) or {}).get('metrics') or {}
        if not M: out.append(f'<h4>{esc(name)}</h4><p class="missing">not run</p>'); continue
        rois = list(next(iter(M.values())).keys())
        h = [f'<h4>{esc(name)}</h4><div class="scroll"><table><thead><tr><th>variant · ROI</th><th>lag mean / p90 / max (frames)</th><th>trail (px)</th><th>residue +1 / +2 / +4 / +8 (levels)</th><th>boil static / swept (sd)</th><th>on the mover</th><th>swept px</th></tr></thead><tbody>']
        for v in vs:
            mm = M.get(v)
            if not mm or v.startswith('ref'): continue
            for rn in rois:
                m = mm.get(rn) or {}
                res = m.get('residue') or {}
                h.append(f'<tr><th class="{v}">{esc(label(v))} · {esc(rn)}</th><td>{fmt(m.get("lagMean"))} / {fmt(m.get("lagP90"),0)} / {fmt(m.get("lagMax"),0)}</td><td>{fmt(m.get("trailPx"),1)}</td><td>{fmt(res.get("1"),1)} / {fmt(res.get("2"),1)} / {fmt(res.get("4"),1)} / {fmt(res.get("8"),1)}</td><td>{fmt(m.get("boilStatic"),2)} / {fmt(m.get("boilSwept"),2)}</td><td>{fmt(m.get("onObjMean"),1)}</td><td>{m.get("swept","—")}</td></tr>')
        h.append('</tbody></table></div>')
        out.append(''.join(h))
    return ''.join(out)

def dyn_strips(tier='high'):
    out = []
    tag = DYN_TAG
    for sc, roi, frames in [('PL', 'far', [1, 2, 4]), ('PT', 'beam', [1, 2, 4]), ('P0', 'wall', [1, 2])]:
        for k in frames:
            cells = [(f'chaos_{sc}_{tag}_ref_cone_{roi}_f{k:02d}', 'history-free reference (cones)', 360)] + [(f'chaos_{sc}_{tag}_{v}_{roi}_f{k:02d}', label(v), 360) for v in ['cap', 'cone', 'mesh', 'softA', 'softM']]
            if not any(os.path.exists(os.path.join(SHOTS, c[0] + '.jpg')) for c in cells): continue
            out.append(strip(f'{sc} · {roi} · frame +{k} after the truth settled (×3 crops of the ROI)', cells))
        lagcells = [(f'chaos_{sc}_{tag}_{v}_{roi}_lag', f'{label(v)} — lag map', 200) for v in ['cap', 'cone', 'mesh', 'softA', 'softM']]
        if any(os.path.exists(os.path.join(SHOTS, c[0] + '.jpg')) for c in lagcells): out.append(strip(f'{sc} · {roi} · where it lags (frames behind its own reference, ×40 gain)', lagcells))
    return ''.join(out) or '<p class="missing">no dynamic-scene crops</p>'

def cost_table():
    tiers = ['ultra', 'high', 'medium', 'low', 'verylow']
    pairs = [('cap/cone', '(i) capsules → round cones (fitted cull)'), ('cap/coneLoose', '(i) … with the 1.5 m cull (the primitive alone)'), ('cone/softA', '(iii) cones → + soft, analytic'), ('cone/softM', '(iii) cones → + soft, march'), ('cone/smooth', '(ii) cones → + smooth closest hit')]
    h = ['<div class="scroll"><table><thead><tr><th rowspan=2>A → B, calm views (interleaved, serialized, medians; Δ union ms · Δ direct · Δ reflect)</th>' + ''.join(f'<th colspan=2>{t}</th>' for t in tiers) + '</tr><tr>' + '<th>lobby, 4 men</th><th>lamp, 1 man</th>' * len(tiers) + '</tr></thead><tbody>']
    for key, name in pairs:
        cells = []
        for t in tiers:
            C = (R[t] or {}).get('cost') or {}
            for view in ['lobby4', 'lamp']:
                c = C.get(f'{view}:{key}')
                if not c: cells.append('<td>—</td>'); continue
                dd = (c['B'].get('direct', 0) - c['A'].get('direct', 0)); dr = (c['B'].get('reflect', 0) - c['A'].get('reflect', 0))
                cells.append(f'<td>{c["dUnionMed"]:+.2f} <small>· {dd:+.2f} · {dr:+.2f}</small></td>')
        h.append(f'<tr><th>{esc(name)}</th>{"".join(cells)}</tr>')
    h.append('</tbody></table></div>')
    S = X.get('stress') or {}
    if S:
        h.append('<div class="scroll"><table><thead><tr><th>STRESS MINUTE A → B (4 × 75 frames a side, interleaved)</th><th>union mean</th><th>union p95</th><th>Σ compute</th><th>direct Δ</th><th>softblur Δ</th><th>reflect Δ</th></tr></thead><tbody>')
        for k, s in S.items(): h.append(f'<tr><th>{esc(k)}</th><td>{s["A"]["union"]["mean"]:.2f} → {s["B"]["union"]["mean"]:.2f} ({s["B"]["union"]["mean"]-s["A"]["union"]["mean"]:+.2f})</td><td>{s["A"]["union"]["p95"]:.2f} → {s["B"]["union"]["p95"]:.2f}</td><td>{s["A"]["sum"]["mean"]:.2f} → {s["B"]["sum"]["mean"]:.2f}</td><td>{(s["B"]["passes"].get("direct",{}).get("mean",0)-s["A"]["passes"].get("direct",{}).get("mean",0)):+.2f}</td><td>{(s["B"]["passes"].get("softblur",{}).get("mean",0)-s["A"]["passes"].get("softblur",{}).get("mean",0)):+.2f}</td><td>{(s["B"]["passes"].get("reflect",{}).get("mean",0)-s["A"]["passes"].get("reflect",{}).get("mean",0)):+.2f}</td></tr>')
        h.append('</tbody></table></div>')
    return ''.join(h)

def sd_table(tier='high'):
    S = (R[tier] or {}).get('sd') or {}
    if not S: return ''
    rows = []
    for view, o in S.items():
        for vn, tiles in o.items():
            if vn == 'text': continue
            rows.append(f'<tr><th class="{vn}">{esc(view)} · {esc(label(vn))}</th>' + ''.join(f'<td>{esc(tn)} {q["meanSd"]:.3f} <small>p99 {q["p99"]:.2f} · L {q["meanL"]:.0f}</small></td>' for tn, q in tiles.items()) + '</tr>')
    return '<div class="scroll"><table><thead><tr><th>still-scene temporal sd (8-bit luma, 30 renders) per tile</th><th colspan=4>tiles</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>'

def disc_table():
    D = X.get('disc') or []
    if not D: return ''
    return ('<div class="scroll"><table><thead><tr><th>floor point (x 19.5, z →)</th><th>disc-lit, 64 rays through the round cones</th><th class="softA">analytic strip</th><th class="softM">march + remap</th></tr></thead><tbody>'
            + ''.join(f'<tr><th>{esc(str(r["z"]))}</th><td>{r["disc"]:.2f}</td><td>{r["softA"]:.2f}</td><td>{r["march"]:.2f}</td></tr>' for r in D) + '</tbody></table></div>')

def verdict(key, word, cls):
    return f'<div class="verdict {cls}"><div class="word">{esc(word)}</div><div>{prose(key)}</div></div>'

CSS = """
:root{--bg:#f5f7f4;--fg:#1c211f;--mut:#66716c;--card:#ffffff;--line:#dfe4e0;--th:#ecf0ed;--acc:#1f7f6a;--cone:#1f7f6a;--cap:#b6503a;--soft:#6b58a6;--good:#1f7a3a;--bad:#a12626;--warn:#8a5a00}
@media (prefers-color-scheme: dark){:root{--bg:#111514;--fg:#e4ebe7;--mut:#98a6a0;--card:#181d1b;--line:#2c3532;--th:#1f2624;--acc:#6ee7b7;--cone:#6ee7b7;--cap:#ff8c72;--soft:#b3a4ee;--good:#6fd08c;--bad:#f08080;--warn:#e0b25a}}
:root[data-theme="light"]{--bg:#f5f7f4;--fg:#1c211f;--mut:#66716c;--card:#ffffff;--line:#dfe4e0;--th:#ecf0ed;--acc:#1f7f6a;--cone:#1f7f6a;--cap:#b6503a;--soft:#6b58a6;--good:#1f7a3a;--bad:#a12626;--warn:#8a5a00}
:root[data-theme="dark"]{--bg:#111514;--fg:#e4ebe7;--mut:#98a6a0;--card:#181d1b;--line:#2c3532;--th:#1f2624;--acc:#6ee7b7;--cone:#6ee7b7;--cap:#ff8c72;--soft:#b3a4ee;--good:#6fd08c;--bad:#f08080;--warn:#e0b25a}
html{background:var(--bg);color:var(--fg)}body{max-width:1200px;margin:0 auto;padding:28px 18px 90px;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
h1{font-size:27px;line-height:1.2;margin:0 0 8px;text-wrap:balance;font-weight:650;letter-spacing:-.01em}h2{font-size:20px;margin:40px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--line);text-wrap:balance}h3{font-size:16px;margin:24px 0 6px}h4{font-size:14px;margin:18px 0 4px;color:var(--mut);font-weight:600}
.eyebrow{font:600 11px/1.3 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--acc)}
p{margin:8px 0;max-width:980px}.lede{font-size:16px}.mut,.note{color:var(--mut)}.note{font-size:13px}code{font:12.5px ui-monospace,Menlo,monospace;background:var(--th);padding:1px 4px;border-radius:3px}
.verdicts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin:16px 0}
.verdict{background:var(--card);border:1px solid var(--line);padding:12px 14px;border-radius:5px}.verdict .word{font:700 13px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}
.verdict.adopt .word{color:var(--good)}.verdict.keep .word{color:var(--warn)}.verdict.drop .word{color:var(--bad)}
.scroll{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;font-size:12.5px;min-width:700px;width:100%;font-variant-numeric:tabular-nums}
th,td{border:1px solid var(--line);padding:4px 6px;text-align:right;white-space:nowrap;vertical-align:top}thead th{background:var(--th);text-align:center}tbody th{text-align:left;white-space:normal;min-width:200px;font-weight:600;background:var(--card)}
th.cap,td.cap{color:var(--cap)}th.cone,td.cone,th.smooth,th.coneLoose{color:var(--cone)}th.softA,th.softM,th.softMS,th.softMesh{color:var(--soft)}th.mesh,th.meshRefl,th.ref{color:var(--mut)}
small{color:var(--mut)}
.strip{margin:16px 0 8px}.striptitle{font-weight:600;margin-bottom:5px;font-size:13px}.cells{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:5px;max-width:100%}
figure img{display:block;max-width:100%;height:auto;image-rendering:pixelated}figcaption{font:11.5px/1.35 ui-monospace,Menlo,monospace;color:var(--mut);padding-top:4px;max-width:300px}
.hero{display:block;max-width:100%;height:auto;border-radius:4px;border:1px solid var(--line);background:#111514}
.missing{min-width:200px;height:60px;display:flex;align-items:center;justify-content:center;color:var(--bad);border:1px dashed var(--bad);font-size:12px;padding:0 8px}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;font-size:13.5px}.kv b{font-weight:600}
"""

body = []
body.append(f'<title>twopointsix — SDF character rig: round cones fitted to the mannequin, three uses</title>')
body.append(f'<style>{CSS}</style>')
body.append('<div class="eyebrow">exp/sdf-characters · renderer experiment · ' + esc(X.get('date', '2026-08')) + '</div>')
body.append('<h1>The mannequins as round cones fitted to their mesh: sharper limb silhouettes in every ray, a smooth body in the mirror, and character shadows drawn instead of sampled</h1>')
body.append('<p class="note"><b>Since this page (2026-08-11):</b> use (i) shipped at every tier and the capsule paths then left the tree — the GPU capsule test, the <code>if (rigOn())</code> forks, <code>settings.sdfRig</code> / <code>?sdfrig</code> / <code>?nosdfrig</code> and the presets\' rig field are gone, the fitted round cones are every ray\'s character test with no switch, and the "OFF identity" recipes below (<code>?nosdfrig</code>) no longer select anything. The measurements stand as the record taken against the capsules; docs/internal/sdf-characters.md §11 has the cleanup and its before/after identity hashes.</p>')
body.append(f'<p class="lede">{prose("lede")}</p>')
body.append('<div class="verdicts">' + verdict('verdict_i', prose('word_i', 'ADOPT (i)'), prose('cls_i', 'adopt')) + verdict('verdict_ii', prose('word_ii', 'KEEP AS A ROW (ii)'), prose('cls_ii', 'keep')) + verdict('verdict_iii', prose('word_iii', 'EXPERIMENT (iii)'), prose('cls_iii', 'keep')) + '</div>')
body.append(f'<p class="note">{prose("method")}</p>')

body.append('<h2>1 · The rig: 15 round cones, radii least-squares fitted to the mesh</h2>')
body.append(f'<p>{prose("fit_intro")}</p>')
body.append(img('sr_fit', ext='png', w=1200, q=88, cls='hero'))
body.append('<p class="note">Bind pose, orthographic. Left: the 15 hand-radius capsules main traces (<span style="color:var(--cap)">orange</span>). Middle: the fitted round cones (<span style="color:var(--cone)">green</span>). Right: both from the side. The mesh silhouette in grey.</p>')
body.append(fit_table())
body.append(f'<p>{prose("fit_read")}</p>')

body.append('<h2>2 · (i) Round cones in every ray’s character test — shape</h2>')
body.append(f'<p>{prose("i_intro")}</p>')
for view, tile, ttl in [('lampW', 'near', 'the lamp: shins and arms, half a metre behind him (direct light only, ×3)'), ('lamp', 'mid', 'the lamp: the trunk’s shadow 1.4 m up the corridor (direct only, ×3)'), ('lamp', 'far', 'the lamp: the head end, 2.3 m (direct only, ×3)'), ('torch', 'wall', 'the torch: his shadow on the wall 0.9 m past him (direct only, ×3)'), ('torch', 'lino', 'the torch: the lino behind him (direct only, ×3)')]:
    body.append(strip(ttl, [(f'sr_{STILL_TAG}_{view}_{tile}_{v}_d3', label(v), 560) for v in ['cap', 'cone', 'mesh']]))
body.append(strip('composite, the same tiles (×3)', [(f'sr_{STILL_TAG}_{view}_{tile}_{v}', f'{label(v)} · {view}/{tile}', 300) for view, tile in [('lampW', 'near'), ('lamp', 'mid'), ('torch', 'wall')] for v in ['cap', 'cone', 'mesh']]))
body.append('<h3>Where the shadow’s edge falls, against the mesh</h3>')
body.append(profile_table())
body.append(iou_table())
body.append(f'<p>{prose("i_read")}</p>')

body.append('<h2>3 · (ii) The smooth union as the reflection pass’s closest hit</h2>')
body.append(f'<p>{prose("ii_intro")}</p>')
for view, tile, ttl in [('lobbyR', 'feet', 'lobby stone (rough 0.15), camera at 11°, 3.4 m: the reflection term alone (debug view 14, ×3) at his feet'), ('lobbyR', 'image', 'the same, further down the mirror path (the shins’ images)'), ('lobby4', 'manA', 'the four-men lobby view at gameplay pitch (40°): a man’s image, term alone (×3)')]:
    body.append(strip(ttl, [(f'sr_high_{view}_{tile}_{v}_d14', label(v), 560) for v in ['cone', 'smooth', 'meshRefl']]))
body.append(strip('composite (×3)', [(f'sr_high_{view}_{tile}_{v}', f'{label(v)} · {view}/{tile}', 240) for view, tile in [('lobbyR', 'feet'), ('lobbyR', 'image')] for v in ['cone', 'smooth', 'meshRefl']]))
body.append(f'<p>{prose("ii_read")}</p>')

body.append('<h2>4 · (iii) The experiment: character shadows as an analytic visibility in the direct light</h2>')
body.append(f'<p>{prose("iii_intro")}</p>')
body.append('<h3>Is the query right? — the disc integral</h3>')
body.append(f'<p>{prose("disc_read")}</p>')
body.append(disc_table())
body.append('<h3>Penumbra width and edge position against the stochastic reference</h3>')
body.append('<p class="note">The same table as §2, read for the two soft columns against the round-cone column: the query’s penumbra vs the sampled one of the same solids, at 0.25 / 0.5 / 1.4 / 2.3 m behind the man and on the torch’s wall.</p>')
body.append(strip('stills, direct only (×3): the stochastic round cones · the analytic strip · the marched field · the mesh', [(f'sr_{STILL_TAG}_{view}_{tile}_{v}_d3', f'{label(v)} · {view}/{tile}', 420) for view, tile in [('lampW', 'near'), ('lamp', 'far'), ('torch', 'wall')] for v in ['cone', 'softA', 'softM', 'mesh']]))
body.append('<h3>Moving shadows: does the drawn penumbra stop trailing?</h3>')
body.append(f'<p>{prose("dyn_read")}</p>')
body.append(dyn_table())
if DIAG:
    import re as _re
    rows = []
    for line in (DIAG.get('text') or '').split('\n'):
        m = _re.match(r'(\S+)\s+(\S+)\s+recv (\d+) swept (\d+) lag ([\d.]+|null) f \(p90 (\S+), max (\S+)\) = (\S+) px .*residue \+1/\+2/\+4/\+8 (\S+) boil', line)
        if m and not m.group(1).startswith('ref'): rows.append(f'<tr><th class="softA">{esc(m.group(1))} · {esc(m.group(2))}</th><td>{float(m.group(5)):.2f} f</td><td>{float(m.group(8)):.1f} px</td><td>{esc(m.group(9))}</td></tr>')
    body.append('<h4>PL, the drawn shadow with one history off at a time (each against its own reference)</h4><div class="scroll"><table><thead><tr><th>variant · ROI</th><th>lag</th><th>trail</th><th>residue +1/+2/+4/+8</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div><p class="note">softA_noShT = the shadow denoiser’s temporal stage off · softA_noRsT = ReSTIR’s M-cap 1 · softA_noTaa ∕ cone_noTaa = TAAU off (the metric loses its footing under the raw internal-resolution noise: residue never settles). Baseline softA on this ROI: 1.51 f · 10.5/3.5/0.8; cone 0.46 f.</p>')
body.append(dyn_strips())
body.append('<h3>Still-scene noise</h3>')
body.append(sd_table())
body.append(f'<p>{prose("sd_read")}</p>')
body.append('<h3>What the query gets wrong, stated</h3>')
body.append(f'<p>{prose("iii_limits")}</p>')

body.append('<h2>5 · Cost, per tier</h2>')
body.append(f'<p>{prose("cost_read")}</p>')
body.append(cost_table())

body.append('<h2>6 · OFF identity, validation, gates</h2>')
kv = X.get('identity') or {}
body.append('<div class="kv">' + ''.join(f'<b>{esc(k)}</b><span>{esc(v)}</span>' for k, v in kv.items()) + '</div>')
if VAL: body.append(f'<p><b>GPU validation sweep</b> (this tree, five presets × ten variants (cap · cone · coneLoose · softA · softM · softMS · smooth · mesh · softMesh · meshRefl) × debug views 0 ∕ 3 ∕ 4 ∕ 14, an error scope round two game steps + two renders each): {VAL.get("checks")} checks, <b>{len(VAL.get("bad") or [])} validation errors</b>, {len(VAL.get("uncaptured") or [])} uncaptured device errors.{" First: " + esc(str((VAL.get("bad") or [""])[0])) if VAL.get("bad") else ""}</p>')
body.append(f'<p>{prose("gates")}</p>')

body.append('<h2>7 · Verdicts</h2>')
body.append(f'<p>{prose("verdicts")}</p>')
body.append(f'<p class="note">{prose("files")}</p>')

open(OUT, 'w').write('\n'.join(body))
sz = os.path.getsize(OUT)
print(f'{OUT}: {sz/1048576:.2f} MB ({budget[0]/1048576:.2f} MB of images)')
if sz > 8 * 1048576: print('WARNING: over 8 MB'); sys.exit(1)
