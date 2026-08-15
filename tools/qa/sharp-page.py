#!/usr/bin/env python3
"""SHARP-DIRECT lane — build docs/review/sharp-direct.html: self-contained (crops as data-URI JPEG q≈85), light + dark + data-theme, < 8 MB.
Inputs: docs/perf/sharp-metrics.json (tools/qa/sharp-metrics.py), docs/perf/sharp-cost.json, docs/perf/sharp-noise.json (optional), docs/shots/sh/*.jpg (the ×3 crops).
  python3 tools/qa/sharp-page.py            (regenerate crops first: python3 tools/qa/sharp-metrics.py --crops a b c d f2 g h g1 g2 g3)"""
import os, sys, json, base64, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
M = json.load(open(os.path.join(ROOT, 'docs/perf/sharp-metrics.json')))
C = json.load(open(os.path.join(ROOT, 'docs/perf/sharp-cost.json')))
try: NZ = json.load(open(os.path.join(ROOT, 'docs/perf/sharp-noise.json')))
except Exception: NZ = None
SH = os.path.join(ROOT, 'docs/shots/sh'); OUT = os.path.join(ROOT, 'docs/review/sharp-direct.html')
F = 'f2' if any(k.startswith('f2_') for k in M) else 'f'   # the prototype row (f2 = re-captured after the review fixes; same numbers as f)

def img(tag, view, mode, name, w=300, q=84):
    p = os.path.join(SH, f'{tag}_{view}_{mode}_{name}.jpg')
    if not os.path.exists(p): return f'<div class="missing">{tag} {view} {mode} {name}: no crop</div>'
    im = Image.open(p).convert('RGB')
    if im.size[0] > w: im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.NEAREST if im.size[0] % w == 0 else Image.BILINEAR)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); s = base64.b64encode(b.getvalue()).decode()
    return f'<img alt="{tag} {view} {mode} {name}" src="data:image/jpeg;base64,{s}" width="{im.size[0]}" height="{im.size[1]}">'

def med(tag, view, mode, edge):
    r = M.get(f'{tag}_{view}_{mode}'); e = r and r['edges'].get(edge)
    return e['med'] if e and e.get('n') else None
def rms(tag, view, mode, tile):
    r = M.get(f'{tag}_{view}_{mode}'); return r['tiles'][tile]['rms'] if r and tile in r['tiles'] else None
fmt = lambda v: '—' if v is None else f'{v:.2f}'

LABEL = {'a': '(a) OLD renderer · 1777×1000 native, FXAA', 'b': '(b) v3 · TAA at 1.0', 'c': '(c) v3 · TAAU 0.77 = SHIPPING high', 'd': '(d) v3 · 0.77 bilinear + FXAA', 'e0': '(e0) c, sharpen 0', 'e2': '(e2) c, sharpen 0.5',
         'f': '(f) SHARP DIRECT · 0.77', 'f2': '(f) SHARP DIRECT · 0.77', 'g': '(f + edge rays, permissive — first cut)', 'h': '(f + edge rays, strict — first cut)', 'ie': '(f + edge rays — final form)', 'i': '(f) SHARP DIRECT · 0.77', 'g1': '(f, TAA α 0.2)', 'g2': '(f, TAA kernel 12)', 'g3': '(f, α 0.2 + sharpen 0.4)'}
EDGES = [('v1', 'kbShadow', 'V1 keyboard contact shadow', 'contact'), ('v1', 'kbTop', 'V1 keyboard far edge', 'box'), ('v1', 'paper', 'V1 paper edge', 'box'), ('v1', 'footShadow', 'V1 monitor-foot shadow', 'penumbra'),
         ('v2', 'coneWall', 'V2 torch disc edge on the wall', 'pool'), ('v2', 'junction', 'V2 wall/floor junction in the lobe', 'box'), ('v2', 'boardEdge', 'V2 board edge, bounce-lit', 'box'),
         ('v3', 'kbFar', 'V3 keyboard far edge', 'box'), ('v3', 'partTop', 'V3 partition-top strip edge', 'box')]
TILES = [('v1', 'penumbra', 'V1 penumbra tile'), ('v1', 'litDesk', 'V1 lit desk tile'), ('v2', 'lobe', 'V2 lobe tile'), ('v3', 'penumbra', 'V3 chair penumbra tile'), ('v3', 'desk', 'V3 desk tile')]
BOX = [('v1', 'kbTop'), ('v1', 'paper'), ('v2', 'junction'), ('v2', 'boardEdge'), ('v3', 'kbFar'), ('v3', 'partTop')]

def table(tags, title):
    h = [f'<div class="scroll"><table><caption>{title}</caption><thead><tr><th>edge / tile</th>' + ''.join(f'<th colspan="2">{t}</th>' for t in tags) + '</tr><tr><th></th>' + ''.join('<th>still</th><th>motion</th>' for _ in tags) + '</tr></thead><tbody>']
    for v, e, name, kind in EDGES:
        h.append(f'<tr><td>{name} <span class="kind">{kind}</span></td>' + ''.join(f'<td>{fmt(med(t, v, "static", e))}</td><td>{fmt(med(t, v, "motion", e))}</td>' for t in tags) + '</tr>')
    for v, tl, name in TILES:
        h.append(f'<tr class="tile"><td>{name} <span class="kind">contrast</span></td>' + ''.join(f'<td>{fmt(rms(t, v, "static", tl))}</td><td>{fmt(rms(t, v, "motion", tl))}</td>' for t in tags) + '</tr>')
    h.append('</tbody></table></div>'); return ''.join(h)

def boxmean(t, mode):
    vals = [med(t, v, mode, e) for v, e in BOX]; vals = [x for x in vals if x is not None]
    return sum(vals) / len(vals) if vals else None

def strip(tags, view, mode, edge, title):
    cells = ''.join(f'<figure>{img(t, view, mode, edge)}<figcaption><b>{LABEL.get(t, t)}</b><br>{fmt(med(t, view, mode, edge))} px</figcaption></figure>' for t in tags)
    return f'<div class="strip"><div class="striptitle">{title} — {mode}</div><div class="cells">{cells}</div></div>'

def cost_table():
    S = C['still']; rows = []
    for q in ['ultra', 'high', 'medium', 'low', 'verylow']:
        s = S[q]; A, B = s['A'], s['B']
        rows.append(f"<tr><td>{q}</td><td>{s['res']}</td><td>{A['union']:.2f} · {A['p95']:.2f}</td><td>{B['union']:.2f} · {B['p95']:.2f}</td><td><b>{s['dUnion']:+.2f}</b></td><td>{B.get('sharpU', 0):.2f} + {B.get('compS', 0):.2f}</td><td>{A['wall']:.1f} → {B['wall']:.1f} ({s['dWall']:+.1f})</td><td>{s['memMB']}</td></tr>")
    st = C['stress']['high']; A, B = st['A'], st['B']
    stress = f"<p><b>The stress minute at high</b> ({C['stress']['scene']}): union mean · p50 · <b>p95</b> · max — OFF {A['unionMean']} · {A['p50']} · {A['p95']} · {A['max']} → ON {B['unionMean']} · {B['p50']} · <b>{B['p95']}</b> · {B['max']} ms (bar: {st['bar']} — <b>met</b>). Per pass OFF → ON: direct {A['direct']} → {B['direct']}, shadow denoiser {A['softblur']} → {B['softblur']}, gather {A['gather']} → {B['gather']}, froxels {A['volFroxel']} → {B['volFroxel']}, sharpU — → {B['sharpU']}, compS — → {B['compS']}, taau {A['taau']} → {B['taau']}; wall p50 {A['wallP50']} → {B['wallP50']} ms.</p>"
    return ('<div class="scroll"><table><caption>Cost per tier — the calm cubicles still, serialized, sharp OFF (A) vs ON (B) interleaved; union of compute passes med · p95 (ms)</caption><thead><tr><th>preset</th><th>internal → output</th><th>A ∪ med · p95</th><th>B ∪ med · p95</th><th>Δ∪</th><th>sharpU + compS</th><th>wall/frame</th><th>+MB</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>' + stress +
            f"<p class=\"note\">{C['note']} Lower tiers: the two output-size kernels do not shrink with the tier's INTERNAL pixels (they are per OUTPUT pixel: 0.92 + 0.66 ms even at verylow's 1066×600) and at 4–6 ms of real work the serialized GPU clocks down between small dispatches, so their union deltas over-read (P1's note saw the same); the wall column is the better bound there. Ultra renders at scale 1.0: nothing to decouple, the path is idle by construction.</p>")

def noise_table():
    if not NZ: return '<p class="note">(temporal-noise table: docs/perf/sharp-noise.json not present)</p>'
    rows = []
    for key, name in NZ['tiles']:
        o1, o2, n1, n2 = (NZ['data'].get(f'{key}_{m}') for m in ['off', 'off2', 'on', 'on2'])
        if not o1: continue
        rows.append(f'<tr><td>{name}</td><td>{o1[0]:.3f} / {o2[0]:.3f}</td><td>{n1[0]:.3f} / {n2[0]:.3f}</td><td>{o1[1]:.2f} → {n1[1]:.2f}</td><td>{o1[2]:.1f} / {n1[2]:.1f}</td></tr>')
    return '<div class="scroll"><table><caption>Temporal noise — mean per-pixel sd of 8-bit luma over 30 still frames (two takes each), sharp OFF vs ON, high</caption><thead><tr><th>tile</th><th>OFF sd (take 1 / 2)</th><th>ON sd (take 1 / 2)</th><th>p99 OFF → ON</th><th>mean luma</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>'

CSS = """
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--good:#1f7a3a;--bad:#a12626;--th:#f1eee6}
@media (prefers-color-scheme: dark){:root{--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#e0b25a;--good:#6fd08c;--bad:#f08080;--th:#24231f}}
:root[data-theme="light"]{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--good:#1f7a3a;--bad:#a12626;--th:#f1eee6}
:root[data-theme="dark"]{--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#e0b25a;--good:#6fd08c;--bad:#f08080;--th:#24231f}
html{background:var(--bg);color:var(--fg)}body{max-width:1180px;margin:0 auto;padding:28px 18px 80px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:34px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{font-size:16px;margin:22px 0 6px}
p{margin:8px 0}.lede{font-size:16px}.mut,.note{color:var(--mut)}.note{font-size:13px}code{font:13px ui-monospace,Menlo,monospace;background:var(--th);padding:1px 4px;border-radius:3px}
.verdict{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);padding:12px 16px;border-radius:6px;margin:14px 0}
.scroll{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;font-size:13px;min-width:640px;width:100%}caption{text-align:left;font-weight:600;padding:4px 0;color:var(--mut)}
th,td{border:1px solid var(--line);padding:4px 6px;text-align:right;white-space:nowrap}th{background:var(--th)}td:first-child,th:first-child{text-align:left;white-space:normal;min-width:180px}
tr.tile td{color:var(--mut)}.kind{color:var(--mut);font-size:11px}
.strip{margin:14px 0 6px}.striptitle{font-weight:600;margin-bottom:4px}.cells{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px;max-width:100%}
figure img{display:block;max-width:100%;height:auto;image-rendering:pixelated}figcaption{font-size:12px;color:var(--mut);padding-top:4px;max-width:300px}
.missing{width:300px;height:80px;display:flex;align-items:center;justify-content:center;color:var(--bad);border:1px dashed var(--bad);font-size:12px}
ol.ten li{margin:3px 0}.good{color:var(--good)}.bad{color:var(--bad)}b.k{color:var(--acc)}
"""

def main():
    tags1 = ['a', 'b', 'c', 'd', 'e0', 'e2']
    attS = {t: boxmean(t, 'static') for t in ['a', 'b', 'c', 'd', F]}; attM = {t: boxmean(t, 'motion') for t in ['a', 'b', 'c', 'd', F]}
    h = ['<title>Sharp direct — where the sharpness went, and a decoupled-resolution prototype</title>', f'<style>{CSS}</style>',
         '<h1>Sharp direct — where the direct light\'s sharpness went, and what decoupling the resolutions buys</h1>',
         '<p class="mut">Lane v3/sharp-direct · 2026-08-10 · docs/internal/sharp-direct.md has every number and how it was taken · M4 Max, Chrome / Metal, high = 1368×770 internal → 1777×1000 output</p>',
         f'<div class="verdict"><p class="lede"><b>Verdict.</b> On lit box edges the shipping frame is <b>{attS["c"] - attS["a"]:+.2f} px</b> softer than the old renderer when still and <b>{attM["c"] - attM["a"]:+.2f} px</b> softer in a slow orbit (10–90 % edge width, mean of six edges). '
         f'Of that, the temporal resolve at ANY resolution accounts for {attS["b"] - attS["a"]:+.2f} / <b>{attM["b"] - attM["a"]:+.2f}</b> px (still / motion) and the 0.77 render scale + upscale for only {attS["c"] - attS["b"]:+.2f} / {attM["c"] - attM["b"]:+.2f} px. '
         f'The decoupled-resolution prototype (g-buffer, every light\'s exact unshadowed term, composite and TAA at the output size; shadow ratio, bounce, reflections, volumetrics internal) lands where the resolution share said it could: <b>{attS[F] - attS["a"]:+.2f} / {attM[F] - attM["a"]:+.2f} px</b> off the old renderer = variant (b)\'s picture at 0.59× the pixels, for +1.9 ms at high (stress p95 13.0 ≤ 14), OFF path byte-identical to main. '
         'The bigger lever for "sharpness in motion" is the TAA resolve itself, which this lane does not own.</p></div>',
         '<h2>1 · Where the sharpness went</h2>',
         '<p>Three pinned views — <b>V1</b> the manager\'s desk under the desk lamp (hard contact shadows, lit box edges), <b>V2</b> a torch cone up the corridor wall and across its lino (a fixed spot with the guards\' torch numbers), <b>V3</b> cubicle desks under the ceiling panels — captured still (40 settled frames) and in motion (the last frame of a 20-frame 0.3°/frame orbit ending on the same yaw). Variants, each a fresh boot: <b>(a)</b> the OLD renderer (<code>?notaau&amp;norestir&amp;legacydenoise&amp;nofroxel&amp;nortreflect&amp;detail=0</code>, 1777×1000 native, FXAA), <b>(b)</b> v3 all-on with TAA at scale 1.0, <b>(c)</b> v3 at 0.77 = shipping high, <b>(d)</b> v3 at 0.77 with <code>?notaau</code> (bilinear + FXAA, graded after the same bilinear upscale the browser does), <b>(e0 / e2)</b> = c with the sharpen at 0 / 0.5.</p>',
         '<p><b>Edge-spread</b> = the 10–90 % rise distance of the luma profile across an edge, in output px, median over 13–41 profiles along it (a perfectly antialiased step reads ≈ 0.9–1.3; an aliased staircase ≈ 1.0–1.1 — the metric rewards the aliasing the old chain left in). <b>Contrast</b> = RMS of a σ 1.5 px high-pass in a tile.</p>',
         table(tags1, 'Step 1 — every edge and tile, variants a–e (px; contrast rows in grey)'),
         f'<p><b>Attribution</b> (mean of the six clean box edges): STILL a → c {attS["c"] - attS["a"]:+.2f} px = a → b (the whole temporal stack at equal resolution) {attS["b"] - attS["a"]:+.2f} + b → c (0.59× the pixels + the resolve\'s upscale) {attS["c"] - attS["b"]:+.2f}; the resolve is {attS["d"] - attS["c"]:.2f} px <i>sharper</i> than a bilinear upscale of the same pixels. '
         f'MOTION a → c {attM["c"] - attM["a"]:+.2f} px = a → b <b>{attM["b"] - attM["a"]:+.2f}</b> + b → c {attM["c"] - attM["b"]:+.2f}; bilinear-of-0.77 is {attM["c"] - attM["d"]:.2f} px sharper than the resolve in motion (and crawls). Contact shadow: the OLD renderer is the softest (7.2 px — legacy softblur), v3 3.9 (b) / 4.7 (c). The torch disc\'s edge is 25.5 px in every variant — the cone\'s falloff is analytic and an order wider than a pixel: resolution cannot touch light pools that have no hard cutoff. Sharpen 0.5 buys back ≈ 0.2 px.</p>',
         '<h3>The crops (×3, 100 output px across) — a · b · c · d</h3>']
    for v, e, name in [('v1', 'kbTop', 'V1 keyboard far edge (box)'), ('v3', 'kbFar', 'V3 keyboard far edge (box)'), ('v2', 'boardEdge', 'V2 board edge (box, bounce-lit)'), ('v1', 'kbShadow', 'V1 keyboard contact shadow')]:
        for mode in ['static', 'motion']: h.append(strip(['a', 'b', 'c', 'd'], v, mode, e, name))
    h += ['<h2>2 · The prototype in ten lines</h2><ol class="ten">',
          '<li><code>settings.sharpDirect</code> (default on here, <code>?nosharp</code>, Tab ▸ Frame); live only under TAAU below scale 1.0 with no debug view. The Frame block gains <code>sharpCfg</code> (internal size, OUTPUT size) + <code>sharpCfgB</code> (knobs) → 720 B; an OUTPUT-screen twin of the block rides in a second uniform with its own scene group, group 0 of every output-size pass — so <code>frame.screen</code>, <code>worldFromDepth</code> and every pixel-footprint term mean <i>their</i> pixel with no shader knowing.</li>',
          '<li>The boxes + men are rasterised at the OUTPUT size; <code>gdown.wgsl</code> derives the internal-size g-buffer everyone else binds — one texel each (the output texel holding the internal pixel\'s centre), nothing averaged — so restir / direct, the denoisers, the gather, reflections, volumetrics, froxels and particles are untouched and read a strict subsample.</li>',
          '<li><code>sharp_direct.wgsl</code> (\'sharpU\', per output pixel): stage + tile-cull the lights exactly as direct.wgsl does and <code>evalLight</code> every survivor → U per emitter class, exact; then r̂ = Σw·S ∕ Σw·U over the 2×2 internal texels round the pixel (bilinear × same-plane × same-orientation; the outer ring, then the nearest texel, if none lies on this surface) → E = U ⊙ r̂ per class into an output-size pair.</li>',
          '<li><code>composite.wgsl</code> is compiled twice behind a prepended <code>const SHARP</code>: false = the fragment composite as it was; true = the same arithmetic as a compute kernel per output pixel with the output-size g-buffer, the sharp pair as directTex / softTex, and the internal-grid terms (bounce, specular, volumetric march, reflections) fetched through the internal size with their guides read at the output texel that holds the internal sample (the same expression gdown copies by).</li>',
          '<li><code>taau.wgsl</code> compiled twice the same way: SHARP = the 1 : 1 resolve of the output-size composite (jitter ±½ output px). One statement changed in it (the volumetric-reactive texel), one in <code>particles_draw.wgsl</code>; <code>gbuffer.wgsl</code> untouched.</li>',
          '<li>OFF identity: <code>?nosharp</code> hashes <b>identical</b> to main @ 91cd005 served beside it — high ec89a30a / 8a49962c, medium 17c9dd19 / ab6a40b8 (two views each).</li>',
          '<li>Memory at high: +78 MB (output-size raster 39, the direct pair 28, hdr / reactive growth 7, edge mask 4); medium +65, low +42, verylow +29; ultra 0 (idle).</li>',
          '<li>Cost at high: +1.05 (sharpU) + 0.79 (compS) ms of compute; the output-size raster and gdown are render passes the union cannot see (wall +1.6 ms/frame bounds everything).</li>',
          '<li>Experiment behind <code>settings.sharpEdgeRays</code> (default OFF): a hard-edge mask over the denoised pair + one deterministic ray per output pixel to the strongest emitter\'s centre where a hard shadow edge lies between the taps — §5.</li>',
          '<li>Gates: typecheck · gate.sh perf frame-layout player breach glass (24 · 9 · 166 · 13 · 39 PASS, 0 FAIL) · tour 1/1 PASS · soak seed 2 4 min clean · build OK · GPU validation clean across presets, debug views, scale steps, sharp / TAAU / denoiser / restir / froxel / divisor / rt flips, keepHistories off, decals, particles.</li></ol>',
          '<h2>3 · Row (f): what the prototype recovers</h2>',
          table(['a', 'b', 'c', F], 'a · b · c · f — the prototype (f) against the old renderer, TAA at 1.0, and shipping'),
          f'<p>(f) sits on (b) to the hundredth on the box edges — still {attS[F]:.2f} vs {attS["b"]:.2f} px, motion {attM[F]:.2f} vs {attM["b"]:.2f} — i.e. it takes the resolution share back and no more, as §1 predicted; V3\'s desk-tile contrast returns from 4.35 to {rms(F, "v3", "static", "desk"):.2f} (a: 5.04). The contact shadow stays where the internal visibility puts it ({med(F, "v1", "static", "kbShadow"):.2f} px; b 3.90) — the honest loss the brief named; §5 has the experiment that closes it and why it is off.</p>',
          '<h3>a · c · f</h3>']
    for v, e, name in [('v1', 'kbTop', 'V1 keyboard far edge'), ('v1', 'paper', 'V1 paper edge'), ('v3', 'kbFar', 'V3 keyboard far edge'), ('v3', 'partTop', 'V3 partition tops'), ('v2', 'junction', 'V2 wall/floor junction in the torch lobe'), ('v2', 'boardEdge', 'V2 board edge'), ('v1', 'kbShadow', 'V1 keyboard contact shadow')]:
        for mode in ['static', 'motion']: h.append(strip(['a', 'c', F], v, mode, e, name))
    h += ['<h2>4 · Cost, memory, noise</h2>', cost_table(), noise_table(),
          '<h2>5 · Residuals</h2>',
          '<h3>Contact shadows — the output-resolution edge-ray experiment</h3>',
          f'<p>The one place the internal ratio is not enough is a HARD shadow edge from a small emitter, whose thin umbra the ratio\'s blur also erodes. <code>sharp_edge.wgsl</code> builds a mask over the denoised pair (per class: the visibility ratio ranges by &gt; 0.3 within ±2 internal px while the shadowed pixels\' own blocker-distance hints say hard) and <code>sharp_direct.wgsl</code> then spends ONE deterministic ray per flagged output pixel to the class\'s strongest emitter\'s centre, keeping the live remainder on the ratio and the walled-off share of U at its true zero. Permissive veto (any hard dark pixel near): the keyboard\'s contact shadow goes to <b>{med("g", "v1", "static", "kbShadow"):.2f} px</b> still / {med("g", "v1", "motion", "kbShadow"):.2f} motion — crisper than the old renderer\'s 7.2 — but where a hard and a soft shadow of the same lamp overlap (the monitor\'s foot and its panel) the binary ray hardens the soft one, and the fired region\'s rim shows the estimator\'s own 1–2 % bias as a faint line. Strict veto (any wide dark pixel near wins): the overlap is left soft, and the contact shadow only half-fires ({med("h", "v1", "static", "kbShadow"):.2f} px). <b>Final form</b> (the ray replaces only the strongest emitter\'s share, exact wherever ray and taps agree; hardness off the hints\' sign; strict veto): <b>{med("ie", "v1", "static", "kbShadow"):.2f} px</b> still / {med("ie", "v1", "motion", "kbShadow"):.2f} motion with the overlap left soft and no artefact in the crops — clean, half the way to 1.6; the rest needs per-light S from the estimator so a soft occluder\'s share can stay on the ratio. Left OFF by default, one toggle away (Tab ▸ Frame, <code>__sharp.set({{edgeRays:true}})</code>). Cost: unmeasurable at rest (the default pipeline is compiled without the tracer).</p>',
          strip(['b', F, 'ie', 'g'], 'v1', 'static', 'kbShadow', 'V1 keyboard contact shadow — b · f · edge rays (final) · edge rays (permissive first cut)'),
          strip(['b', F, 'ie', 'g'], 'v1', 'motion', 'kbShadow', 'V1 keyboard contact shadow — b · f · edge rays (final) · permissive first cut'),
          strip(['c', 'ie', 'g'], 'v1', 'static', 'penumbra', 'V1 monitor-foot penumbra tile — c · edge rays final (left soft) · permissive first cut (the hardened overlap, top right)'),
          '<h3>The TAA\'s own knobs on top of (f) — the motion lever, for the lane that owns taau.wgsl</h3>',
          table([F, 'g1', 'g2', 'g3'], 'f · g1 (new-frame weight 0.2) · g2 (reconstruction kernel 12) · g3 (weight 0.2 + sharpen 0.4) — settings only, no shader change'),
          '<h3>Everything else</h3><ul>',
          '<li><b>U is exact everywhere</b> (every listed light scored per output pixel — no top-K, no interpolated tail): the budget allowed it (1.05 ms at 41 lights in the stress minute), so there is no residual exactness to state.</li>',
          '<li><b>Slivers</b> the internal raster never sampled (a 1-px lit face at a silhouette) take the nearest internal texel\'s ratio; a coloured light\'s footprint finer than the internal raster takes the luminance ratio for that channel. Neither showed in the graded views; both are guesses by construction.</li>',
          '<li><b>Pools / cone edges</b>: analytic and wide in this level (25 px) — native U changes nothing there; a light with a hard cutoff would go native-sharp.</li>',
          '<li><b>Not visible to the union</b>: the output-size raster (+0.7 Mpx of boxes + men) and gdown; the wall delta (+1.6 ms at high, ≤ +0.5 below) bounds them together with everything else.</li>',
          '<li><b>Debug views</b> switch the path off (they read internal-size diagnostics), which parks / re-acquires the output set through the pool — a dev-tool hitch, not a play one.</li></ul>',
          '<h2>6 · Recommendation</h2>',
          '<ul><li><b>Ship it at high and medium</b> if +1.9 / +0.4 ms of union (stress p95 13.0 at high, inside the 14 bar) is worth a quarter pixel of box-edge width, 6–9 % of desk-tile contrast, and — the part no TAA tuning gives — native-resolution albedo: decals, the coming markings / print, glass edges and emissive panels are composited at 1777×1000 instead of 1368×770. Leave low / verylow off by default (the two output-size kernels are a fixed ~1.6 ms there against 4–6 ms frames) — a per-preset switch is one line in quality.ts.</li>',
          '<li><b>Do not expect it to answer the note by itself.</b> Two thirds of the still loss and 70 % of the motion loss on lit edges is the temporal resolve at any resolution (a → b), plus honest anti-aliasing the old chain never did. The lever is taau.wgsl in motion (history resampling / new-frame weight under camera motion, or a motion-scaled sharpen): g1–g3 above show what its exposed knobs already move, for the temporal-jank lane to weigh against ghosting.</li>',
          '<li><b>Contact shadows</b>: the edge-ray experiment proves output-resolution visibility rays close the gap (1.6 px) for pennies; making it clean needs the ray to replace only the hard occluder\'s share (per-light S, or a second ray class), which is a denoiser-interface question — park it with the P3 lane.</li>',
          '<li>What it does not fix: soft penumbrae and bounce (soft by nature, unchanged), the analytic pool edges (unchanged), the resolve\'s motion softness (unchanged — f in motion = b in motion).</li></ul>',
          '<p class="note">Instruments: tools/qa/sharp-harness.js (captures, cost, stress A/B, sd, identity), tools/qa/sharp-metrics.py (edge-spread / contrast / crops), tools/qa/sharp-page.py (this page). Every PNG behind the numbers is in docs/shots/ab/ (gitignored, on the lane\'s machine); the ×3 crops are in docs/shots/sh/.</p>']
    html = '\n'.join(h)
    os.makedirs(os.path.dirname(OUT), exist_ok=True); open(OUT, 'w').write(html)
    print(f'{OUT}: {len(html)/1048576:.2f} MB')

if __name__ == '__main__': main()
