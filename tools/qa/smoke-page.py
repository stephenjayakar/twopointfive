#!/usr/bin/env python3
"""Build docs/review/smoke-perf.html (perf/smoke-scale) from the lab's JSON results in docs/perf/ and the crops in docs/shots/.
Self-contained (images inlined as data URIs, the scaling chart as inline SVG), light + dark tokens, body-only. Re-run after any measurement lands:
    python3 tools/qa/smoke-page.py
"""
import base64, json, os, glob, html

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PERF = os.path.join(ROOT, 'docs', 'perf'); SHOTS = os.path.join(ROOT, 'docs', 'shots'); OUT = os.path.join(ROOT, 'docs', 'review', 'smoke-perf.html')

def load(name):
    p = os.path.join(PERF, name)
    if not os.path.exists(p): return None
    with open(p) as f: return json.load(f)

def img(path, mime=None, max_w=None):
    p = os.path.join(SHOTS, path)
    if not os.path.exists(p): return None
    data = open(p, 'rb').read()
    if max_w:
        try:
            from PIL import Image; import io
            im = Image.open(io.BytesIO(data)).convert('RGB')
            if im.width > max_w:
                im = im.resize((max_w, round(im.height * max_w / im.width)))
            buf = io.BytesIO(); im.save(buf, 'JPEG', quality=86); data = buf.getvalue(); mime = 'image/jpeg'
        except Exception: pass
    mime = mime or ('image/png' if p.endswith('.png') else 'image/jpeg')
    return f'data:{mime};base64,' + base64.b64encode(data).decode()

def esc(s): return html.escape(str(s))

# ------------------------------------------------------------------ the scaling curves
def curve_rows(kind, state, preset='high', tag=''):
    d = load(f'smoke-curve-{kind}-{state}{("-" + tag) if tag else ""}-{preset}.json')
    return d

def svg_curve(d, title, key='union', ymax=None, w=560, h=300):
    if not d: return f'<p class="mut">(no data yet: {esc(title)})</p>'
    rows = d['rows']; cfgs = d['configs']
    xs = [r['N'] for r in rows]
    vals = {c: [r[c].get(key) for r in rows] for c in cfgs}
    allv = [v for c in cfgs for v in vals[c] if v is not None]
    if not allv: return '<p class="mut">(empty)</p>'
    lo = 0 if key != 'union' else min(allv) - 1; hi = ymax or (max(allv) + 0.6)
    padL, padR, padT, padB = 46, 16, 26, 36
    X = lambda n: padL + (w - padL - padR) * (n - min(xs)) / max(1, (max(xs) - min(xs)))
    Y = lambda v: padT + (h - padT - padB) * (1 - (v - lo) / max(1e-6, hi - lo))
    col = {'before': 'var(--bad)', 'exact': 'var(--bar2)', 'after': 'var(--good)', 'afterS4': 'var(--acc)'}
    out = [f'<svg viewBox="0 0 {w} {h}" width="100%" style="max-width:{w}px;font:12px -apple-system,Helvetica,sans-serif" role="img" aria-label="{esc(title)}">']
    out.append(f'<text x="{padL}" y="16" fill="var(--fg)" font-weight="600">{esc(title)}</text>')
    # grid
    import math
    step = 1 if hi - lo <= 8 else 2
    v = math.ceil(lo)
    while v <= hi:
        y = Y(v); out.append(f'<line x1="{padL}" x2="{w - padR}" y1="{y:.1f}" y2="{y:.1f}" stroke="var(--line)"/><text x="{padL - 6}" y="{y + 4:.1f}" fill="var(--mut)" text-anchor="end">{v:g}</text>'); v += step
    for n in xs:
        x = X(n); out.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{padT}" y2="{h - padB}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="{x:.1f}" y="{h - padB + 16}" fill="var(--mut)" text-anchor="middle">{n}</text>')
    out.append(f'<text x="{(padL + w - padR) / 2:.0f}" y="{h - 4}" fill="var(--mut)" text-anchor="middle">live smoke domains</text><text x="12" y="{(padT + h - padB) / 2:.0f}" fill="var(--mut)" transform="rotate(-90 12 {(padT + h - padB) / 2:.0f})" text-anchor="middle">{esc(key)} ms</text>')
    if key == 'union':
        y14 = Y(14.0)
        if padT < y14 < h - padB: out.append(f'<line x1="{padL}" x2="{w - padR}" y1="{y14:.1f}" y2="{y14:.1f}" stroke="var(--acc)" stroke-dasharray="6 4"/><text x="{w - padR - 4}" y="{y14 - 4:.1f}" fill="var(--acc)" text-anchor="end">14 ms bar</text>')
    for c in cfgs:
        pts = [(X(n), Y(v)) for n, v in zip(xs, vals[c]) if v is not None]
        if not pts: continue
        out.append(f'<polyline fill="none" stroke="{col.get(c, "var(--fg)")}" stroke-width="2.2" points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}"/>')
        for x, y in pts: out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="{col.get(c, "var(--fg)")}"/>')
    # legend
    lx = padL + 8
    for i, c in enumerate(cfgs):
        out.append(f'<rect x="{lx}" y="{padT + 6 + i * 16}" width="12" height="3" fill="{col.get(c, "var(--fg)")}"/><text x="{lx + 18}" y="{padT + 11 + i * 16}" fill="var(--fg)">{esc(c)}</text>')
    out.append('</svg>')
    return ''.join(out)

def curve_table(d, cfgs=None):
    if not d: return ''
    cfgs = cfgs or d['configs']
    th = ''.join(f'<th class="num" colspan="3">{esc(c)}: union / direct / smoke</th>' for c in cfgs)
    rows = []
    for r in d['rows']:
        cells = ''.join(f'<td class="num">{r[c].get("union", 0) or 0:.2f}</td><td class="num">{r[c].get("direct", 0) or 0:.2f}</td><td class="num">{r[c].get("smoke", 0) or 0:.2f}</td>' for c in cfgs)
        rows.append(f'<tr><td class="num">{r["N"]}</td><td class="num">{r["domains"]}</td>{cells}<td class="mut">{"contended" if r.get("contended") else ""} {r.get("kept", "")}/3</td></tr>')
    return f'<div class="scroll"><table><tr><th>N</th><th>domains</th>{th}<th>rounds kept</th></tr>{"".join(rows)}</table></div>'

# ------------------------------------------------------------------ page
parts = []
parts.append('''<title>Smoke cost — profile, nine measured attempts, two wins, the scaling curve</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--good:#1f7a3a;--bad:#a12626;--th:#f1eee6;--bar:#c9924a;--bar2:#5b8dc9}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#e0b25a;--good:#6fd08c;--bad:#f08080;--th:#24231f;--bar:#e0b25a;--bar2:#7aa6d8}}
:root[data-theme="dark"]{--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#e0b25a;--good:#6fd08c;--bad:#f08080;--th:#24231f;--bar:#e0b25a;--bar2:#7aa6d8}
html,body{background:var(--bg);color:var(--fg)}body{max-width:1180px;margin:0 auto;padding:28px 18px 80px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:34px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{font-size:16px;margin:22px 0 6px}
p{margin:8px 0}.mut{color:var(--mut)}.lead{font-size:16px}code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--th);padding:1px 4px;border-radius:3px}
.tldr{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);border-radius:6px;padding:12px 16px;margin:14px 0}.tldr li{margin:4px 0}
.scroll{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;font-size:13.5px;min-width:640px}th,td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}th{background:var(--th);font-weight:600}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.good{color:var(--good);font-weight:600}.bad{color:var(--bad);font-weight:600}.meh{color:var(--mut)}
.strip{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px}figure img{display:block;image-rendering:pixelated;max-width:100%;height:auto}figcaption{font-size:12.5px;color:var(--mut);margin-top:4px;max-width:340px}
.verdict{display:inline-block;padding:1px 7px;border-radius:10px;font-size:12px;font-weight:600;border:1px solid var(--line)}.v-win{background:rgba(80,180,100,.15);color:var(--good)}.v-neg{background:rgba(220,80,80,.12);color:var(--bad)}.v-nil{color:var(--mut)}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px}
</style>
<h1>Smoke cost — where a plume's milliseconds go, nine measured attempts, two wins, and how far it now scales</h1>
<p class="lead">Branch <code>perf/smoke-scale</code> off the fire prototype. The designer's ask, verbatim: <i>"the main thing to figure out is how to make smoke cheaper while still preserving the current
fidelity … see how far it can scale."</i> Method = the ray-traversal lab's: instruments first, a profile, hypotheses ranked by it, serialized-union interleaved A/Bs, exactness proven where claimed,
negatives written up. The notebook with every number is <code>docs/internal/smoke-perf.md</code>. M4 Max · Chrome / Metal · <b>high</b> 1368×770 → 1777×1000 unless stated. This GPU was SHARED with
other lanes' pages all session, so every A/B is interleaved with a rotating start and filtered: a round counts only if every variant sits within 5 % of its own quietest round, and the quoted
number is the minimum over rounds of the round medians.</p>
''')

# TL;DR
prof = {k: load(f'smoke-profile-{k}.json') for k in ['K3', 'S3', 'K8']}
parts.append('''<div class="tldr"><b>TL;DR</b><ul>
<li><b>Where it goes.</b> Render-side, a plume costs the <b>direct pass's shadow-ray transmittance</b> and almost nothing else: 0.6 ms for one canister → 1.9 ms for eight (of a 5.8 ms pass); the froxel
J (0.13–0.2) and the per-pixel march (0.2) are flat and small; gather, cascades, reflections, particles pay nothing. Nine in ten lit shadow rays in the room cross a plume's 3.5 m BOX and march eight
samples — 10–14 M atlas fetches a frame — and with eight boxes live every sample tested all eight. Solver-side: <b>0.50 ms per busy domain step</b> (pressure 35 %), up to six at full rate at high.</li>
<li><b>Win 1 (exact, on):</b> shadow rays now visit only the domains whose <i>occupied</i>-brick box the segment meets (the solver writes that box behind its occupancy words). Bit-exact against main's
function over 50 M random segments; <b>−1.2 ms of direct at eight domains (−20 % of the pass), −0.7 at three, 0 at one</b>.</li>
<li><b>Win 2 (bounded, off by default, recommended 0.5):</b> a domain nothing is emitting into steps every p-th frame, p from how fast its VISIBLE smoke moves, so the plume never moves more than half a
voxel between the steps you see: <b>the smoke pass of three hanging plumes 1.25 → 0.79 ms (−37 %; −63 % at 1.0)</b>. Active canisters keep their price.</li>
<li><b>Negatives, measured:</b> a per-tile 'can this tile see smoke' gate in restir (+0.1 ms: presence costs nothing to gate), prefiltered mips of the field for shadow rays (±0.06: the fetch was never the
cost), a branch-free single-domain sample loop (+0.2 and last-bit different), the froxel cull's smoke gate (nil), kernel fusion / batching (a dispatch costs 1 µs here), fewer pressure pairs (the solver's
own soak says no). Fewer transmittance samples is real (−0.3‥0.5 ms at 4) but blotches the plume's shadow: 8 stays, the knob exists.</li>
</ul></div>''')

# 1. profile
def prof_row(k, label):
    d = prof.get(k)
    if not d: return ''
    t = d['table']
    g = lambda p, f: (t.get(p) or {}).get(f)
    return f'<tr><td>{esc(label)}</td><td class="num">{g("union","ref"):.2f} → {g("union","noSmoke"):.2f} ({g("union","total"):.2f})</td><td class="num"><b>{g("direct","shadowRays"):.2f}</b> ({g("direct","ref"):.2f} → {g("direct","noShadow"):.2f})</td><td class="num">{g("volFroxel","marchAndJ") or 0:.2f}</td><td class="num">{g("volumetrics","marchAndJ") or 0:.2f}</td><td class="num">{g("direct","presence") or 0:.2f}</td></tr>'
parts.append('<h2>1. The profile — by switch, per pass (frozen field, still renders)</h2><p>Interleaved over: as is · smoke shadows off (frame flag 64) · smoke render off (flag 8) · both · the renderer told there is no smoke. Per pass, what the SHADOW-RAY TRANSMITTANCE costs, what the MARCH + froxel J cost, what the plumes\' mere PRESENCE costs (every consumer\'s per-ray domain loop with nothing to sample).</p>')
parts.append('<div class="scroll"><table><tr><th>scene</th><th class="num">union: ref → no smoke (total)</th><th class="num">direct: shadow-ray transmittance</th><th class="num">froxel J</th><th class="num">march</th><th class="num">presence</th></tr>'
             '<tr><td>S1 — one canister (1 domain)</td><td class="num">12.12 → 11.21 (0.92)</td><td class="num"><b>0.59</b> (4.46 → 3.87)</td><td class="num">0.13</td><td class="num">0.20</td><td class="num">0.00</td></tr>'
             + prof_row('K3', 'K3 — three canisters (3)') + prof_row('S3', 'S3 — three fires: 3 domains + 6 flickering lights') + prof_row('K8', 'K8 — eight canisters, wide framing (8)') + '</table></div>')
parts.append('<p>Gather / cascades / reflections / particles: 0.00 everywhere (gather rays do not attenuate through smoke; the cascades never read it). S3\'s direct pass is 7.7 ms: the fires\' own two point lights each cost the pod +1 ms (they double its ray count and their fresh candidates walk cluttered desks) — the LIGHTS\' price, not the smoke\'s, and not this lane\'s. <b>Solver</b> (live, K3, mature plumes 97 % of bricks active): 1.51 ms = 0.50 per domain step; pressure pairs 0.044 ms each (4 = 35 % of the step); brick-skip idle on a grown canister; a dispatch\'s fixed cost 1.0 µs (an empty kernel ×192).</p>')
heat = img('ab/sl_S1_heat.png', max_w=700)
parts.append('<h3>Per ray — the counters (a debug build of the direct pass, read back from S0)</h3><div class="scroll"><table><tr><th>scene</th><th class="num">rays/px</th><th class="num">T calls per ray</th><th class="num">calls that MARCH</th><th class="num">px with a marched call</th><th class="num">density evals per marched call</th><th class="num">atlas fetches per eval</th></tr>'
             '<tr><td>S1</td><td class="num">2.24</td><td class="num">0.80</td><td class="num"><b>87.9 %</b></td><td class="num">78 %</td><td class="num">8.0</td><td class="num">0.75</td></tr>'
             '<tr><td>K3</td><td class="num">2.24</td><td class="num">0.80</td><td class="num">90.6 %</td><td class="num">80 %</td><td class="num">7.9</td><td class="num">0.76</td></tr>'
             '<tr><td>S3</td><td class="num">4.22</td><td class="num">0.83</td><td class="num">98.1 %</td><td class="num">88 %</td><td class="num">7.9</td><td class="num">0.48</td></tr>'
             '<tr><td>K8</td><td class="num">2.32</td><td class="num">0.79</td><td class="num">95.8 %</td><td class="num">84 %</td><td class="num">7.4 (× 8 boxes tested each)</td><td class="num">0.62</td></tr></table></div>')
if heat: parts.append(f'<div class="strip"><figure><img src="{heat}" width="700" alt="marched-call heat map, S1"><figcaption>S1 from the game\'s framing, green = pixels whose shadow rays MARCH the canister\'s box (blue = calls that missed it): a coarse domain is a 3.5 m cube standing floor to ceiling between most receivers and the ceiling panels — nearly every lit ray in the pod pays eight samples for one canister.</figcaption></figure></div>')

# 2. ranked table
parts.append('''<h2>2. Every attempt, ranked by what it bought (Δ direct-pass ms per scene unless noted; min of 5 × 20 interleaved rounds)</h2>
<div class="scroll"><table>
<tr><th>#</th><th>variant</th><th>class</th><th class="num">1 domain (S1)</th><th class="num">3 fires (S3)</th><th class="num">8 domains (K8)</th><th>fidelity</th><th>verdict</th></tr>
<tr><td>T1</td><td>visit only the domains the segment can take density from: per-ray mask ∩ each domain's OCCUPIED-brick box (the solver writes the box behind its occupancy words, same dispatch)</td><td>exact</td><td class="num">0.0</td><td class="num good">−0.72</td><td class="num good">−1.18 (−20 %)</td><td>bit-exact: 50 M random segments vs main's function, 0 mismatches (1 / 3 / 8 domains)</td><td><span class="verdict v-win">WIN — on</span></td></tr>
<tr><td>D2</td><td>calm domains (no source in them) step every p-th frame, p from the VISIBLE smoke's speed (½ voxel per visible step)</td><td>bounded</td><td class="num" colspan="3">smoke pass, three hanging plumes: 1.25 → <b>0.79</b> ms at 0.5 (−37 %), 0.46 at 1.0 (−63 %); nothing while sources run</td><td>sub-voxel motion per visible step by construction; the schedule at 0 is the old one statement for statement</td><td><span class="verdict v-win">WIN — knob, default 0, recommend 0.5</span></td></tr>
<tr><td>steps</td><td>fewer transmittance samples (settings.smokeShadowSteps)</td><td>bounded</td><td class="num">−0.2 (6) / −0.3 (4)</td><td class="num">−0.26 / −0.5</td><td class="num">−0.13 / −0.3</td><td class="bad">4: blotches in the plume's shadow, tile means −3‥−6 %; 6: a third of that</td><td><span class="verdict v-nil">knob, 8 stays</span></td></tr>
<tr><td>T2</td><td>restir per-tile × per-light 'no segment of this tile meets smoke' gate</td><td>exact</td><td class="num">0.0</td><td class="num bad">+0.13</td><td class="num bad">+0.06</td><td>—</td><td><span class="verdict v-neg">NEGATIVE</span> presence costs 0.00–0.07 to begin with</td></tr>
<tr><td>A3</td><td>prefiltered mips (2- / 4-cell means) of the field for shadow rays</td><td>bounded</td><td class="num">−0.07</td><td class="num">−0.06</td><td class="num">−0.06</td><td>bias −0.01 (lod 1) / −0.03‥0.04 (lod 2) in mean T</td><td><span class="verdict v-neg">NEGATIVE</span> the fetch was never the cost; removed</td></tr>
<tr><td>T4</td><td>single-domain branch-free sample loop (no brick test, outside samples weighted 0)</td><td>meant exact</td><td class="num">0.0</td><td class="num bad">+0.20</td><td class="num bad">+0.14</td><td class="bad">12–83 k / 12.6 M segments last-bit different (max |ΔT| 5e-3–1e-2)</td><td><span class="verdict v-neg">NEGATIVE</span> reverted</td></tr>
<tr><td>F1</td><td>froxel cull's per-cluster × per-light smoke gate</td><td>exact</td><td class="num" colspan="3">volFroxel 0.59–0.66 either way</td><td>—</td><td><span class="verdict v-nil">NIL</span> not ported</td></tr>
<tr><td>rskip</td><td>the lossless brick skip OFF for shadow rays (every sample fetches)</td><td>exact</td><td class="num" colspan="3">K8 direct −0.13 (one contended take)</td><td>—</td><td><span class="verdict v-nil">inconclusive</span> left on</td></tr>
<tr><td>D10</td><td>dispatch count: kernel fusion / all domains in one dispatch per kernel</td><td>exact</td><td class="num" colspan="3">an EMPTY kernel costs 1.0 µs a dispatch (×192 = +0.20 ms): ~20 µs of a 500 µs step is fixed</td><td>—</td><td><span class="verdict v-neg">NEGATIVE</span> not built</td></tr>
<tr><td>D3</td><td>fewer pressure pairs</td><td>bounded</td><td class="num" colspan="3">0.044 ms a pair a domain (4 → 2 = −18 % of a busy step)</td><td>the solver's own 90 s soak: under-projection piles up divergence, +40 % mass</td><td><span class="verdict v-nil">not pursued</span></td></tr>
</table></div>
<p class="mut">What T1 leaves of the transmittance (vs a stub returning 1): 0.3–0.4 ms at one domain, 0.8 at eight, 1.1 with three fires — the eight samples themselves, latency-bound on their dependent
chain (box test → brick word → fetch); the two attempts to cheapen a sample (A3, T4) say only FEWER samples pay, and fewer samples show.</p>''')

# 3. fidelity crops
crops = {n: img(f'sp_S1_deskL_{n}.jpg') for n in ['L0S8', 'L0S8b', 'L0S6', 'L0S4']}
crops2 = {n: img(f'sp_S1_floorS_{n}.jpg') for n in ['L0S8', 'L0S6', 'L0S4']}
parts.append('<h2>3. Fidelity of the bounded render knob (sample count) — S1 frozen, 48 renders per setting, ×3 crops</h2>')
parts.append('<div class="scroll"><table><tr><th>vs 8 samples</th><th class="num">whole frame mean |Δ| (255)</th><th class="num">px &gt; 8</th><th class="num">deskL tile mean (ref 119.3) / max</th><th class="num">floorR (61.8)</th><th class="num">floorS (63.6)</th></tr>'
             '<tr><td>8 again (noise floor)</td><td class="num">0.22 / 0.26</td><td class="num">56–67</td><td class="num">−0.03 / 8</td><td class="num">+0.01 / 4</td><td class="num">−0.03 / 3</td></tr>'
             '<tr><td>6 samples (−0.13‥0.26 ms)</td><td class="num">0.67</td><td class="num">9.3 k</td><td class="num">−1.5 / 10</td><td class="num">+0.6 / 15</td><td class="num">−0.1 / 6</td></tr>'
             '<tr><td>4 samples (−0.3‥0.5 ms)</td><td class="num">1.17</td><td class="num">47.7 k</td><td class="num bad">−4.0 / 34</td><td class="num bad">+2.2 / 29</td><td class="num bad">−3.6 / 20</td></tr></table></div>')
strip = ''.join(f'<figure><img src="{crops[n]}" width="330"><figcaption>deskL — {lab}</figcaption></figure>' for n, lab in [('L0S8', '8 samples (as shipped)'), ('L0S8b', '8 again — the renderer\'s own noise'), ('L0S6', '6 samples'), ('L0S4', '4 samples: the blotch on the desk top under the plume\'s edge')] if crops.get(n))
parts.append(f'<div class="strip">{strip}</div>')
strip2 = ''.join(f'<figure><img src="{crops2[n]}" width="330"><figcaption>floorS — {lab}</figcaption></figure>' for n, lab in [('L0S8', '8 samples'), ('L0S6', '6'), ('L0S4', '4: the floor under the plume 5.7 % darker in the mean, contoured')] if crops2.get(n))
parts.append(f'<div class="strip">{strip2}</div>')

# 4. curves
parts.append('<h2>4. The scaling curve — union vs live domains, LIVE (game steps: the solver counts), before / after</h2><p><b>before</b> = main\'s transmittance verbatim (TRACE_VARIANT 256) + the solver\'s schedule as it was; <b>exact</b> = the masked walk alone (what ships ON); <b>after</b> = + calm domains at calmCells 0.5. Canisters at fixed spots ≥ 4 m apart (each its own coarse domain), the wide framing for every N; "active" = 8 s in, sources running; "hanging" = canisters of 10 s measured 12 s after they end. Min over 3 interleaved rounds of the round medians; a row marked contended kept fewer than two clean rounds.</p>')
KA = curve_rows('K', 'active'); KH = curve_rows('K', 'hanging'); FA = curve_rows('F', 'active'); KAm = curve_rows('K', 'active', 'medium'); KHm = curve_rows('K', 'hanging', 'medium')
parts.append('<div class="two"><div>' + svg_curve(KA, 'high — N canisters ACTIVE (union ms)') + '</div><div>' + svg_curve(KH, 'high — N plumes HANGING (union ms)') + '</div></div>')
parts.append('<h3>high, active</h3>' + curve_table(KA) + '<h3>high, hanging</h3>' + curve_table(KH))
parts.append('<div class="two"><div>' + svg_curve(FA, 'high — N fires (then + canisters) ACTIVE (union ms)') + '</div><div>' + svg_curve(KAm, 'medium — N canisters ACTIVE (union ms)') + '</div></div>')
parts.append('<h3>high, fires</h3>' + curve_table(FA) + '<h3>medium, active</h3>' + curve_table(KAm) + '<h3>medium, hanging</h3>' + svg_curve(KHm, 'medium — N plumes HANGING (union ms)') + curve_table(KHm))

# 5. port list + caveats
parts.append('''<h2>5. What to port to main, and how (main has no fire prototype; none of this touches it)</h2>
<ol>
<li><b>T1 — common.wgsl</b>: <code>smokeOcc</code> as <code>array&lt;vec4u, 34&gt;</code>; <code>smokeSubWord / smokeSubLo / smokeSubHi / smokeSegment / smokeDensityLod / smokeTransmittanceLod</code> replacing <code>smokeDensityAt</code>'s use inside <code>smokeTransmittance</code> (smokeDensityAt itself stays for the march / self-shadow / probe); <b>vol_common.wgsl</b>: <code>smokeTransIn / smokeTransCoarse</code> become one-liners over <code>smokeTransmittanceLod</code>. <b>smoke.wgsl</b>: <code>renderOccPack</code>'s box reduction + the word write. <b>smoke.ts</b>: <code>OCC_BUFFER_BYTES</code> (544) for occBuf; <b>engine.ts</b>: the no-smoke stand-in buffer 544 B. Drop the lab's <code>SMK_*</code> consts, counters, <code>smkGate</code>, <code>smokeTransmittanceRef</code>, and restir.wgsl's / froxel.wgsl's lab hunks (T2 / F1 were negative).</li>
<li><b>D2 — smoke.ts</b>: <code>SmokeParams.calmCells</code> (+ default), <code>DT_CAP / MAX_PERIOD</code>, <code>Domain.since / owed / period</code>, the period scheduler in <code>encode()</code>, <code>writeSimParams(dt, stepDt)</code> returning per-domain offsets (simParamBuf × 9 copies), <code>bricks.vmaxS</code> readback; <b>smoke.wgsl</b>: <code>dilate</code>'s <code>wgDilSpeedS</code> + brick stats word 5. A Tab ▸ Smoke row and a soak invariant (a domain never waits more than 4 frames) on port.</li>
<li><b>Knob</b> — <code>settings.smokeShadowSteps</code> (frame.volCfg.w bits 2‥5, default 8; <code>smokeShadowLod</code> can go with the mips).</li>
<li><b>The lab</b> — <code>tools/qa/smoke-lab.js</code>, <code>src/render/shaders/smoke_lab.wgsl</code>, <code>tools/qa/smoke-page.py</code>, this page and the notebook; the counters need the <code>SMK_COUNT</code> build of common + restir's debug-view-12 hunk if kept.</li>
</ol>
<h2>6. Caveats</h2>
<ul>
<li>The GPU was shared for the whole session (25–90 % busy while this page idled): absolute unions moved ±1 ms between hours; every delta above is from interleaved rounds filtered to their quiet minimum, and rounds that failed the filter are counted in each table. Two early takes (S1 live, one brick-skip A/B) were visibly contended and are quoted as such.</li>
<li>'before' routes the direct pass, gather / reflection / card hits and the composite's glass ray through main's transmittance; the froxel haze's 5-sample transmittance and the light probe keep the new walk in both columns (their deltas were nil), and the solver writes its box words in both.</li>
<li>Not measured: ultra / low tiers, the breach's daylight sun through a plume, the QRF stress minute's eight FINE gun-smoke domains (small boxes: T1's mask matters less, the calm rule more), the CPU.</li>
<li>The fires' remaining +2 ms of direct per fire is their two point lights inside cluttered pods — a light-count question (one light per fire halves it), parked for the fire lane.</li>
</ul>''')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write('\n'.join(parts))
print(OUT, f'{os.path.getsize(OUT) / 1024:.0f} KB')
