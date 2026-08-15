#!/usr/bin/env python3
"""PARTICLE RAIN v2 — build docs/review/prain.html: the LOOK (drops lit as water, refracting streaks, spread / beads / thin lines) and the WIND, beside v1 at
the same staged frames. Self-contained (frames / crops / strips / smear maps as data-URI JPEG), light + dark + data-theme, < 8 MB.
Inputs: the captures tools/qa/prain-harness.js posts (docs/shots/prain_p2-<view>-v1|v2.jpg, prain_fs2-gust[-v1]-f0‥5.jpg, prain_wind-both|mainsign.jpg,
docs/shots/ab/ab_smear2-v1|v2-s0‥7.png) and docs/perf/prain-v2.json (the cost take + prose). Rebuild the captures from a `?paused&quality=high&mute&prain`
boot with both sinks up:  await import('/qa/prain-harness.js'); … (the battery in docs/internal/prain.md §v2)   then   python3 tools/qa/prain2-page.py"""
import os, sys, json, base64, io
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs/shots')
AB = os.path.join(SH, 'ab')
OUT = os.path.join(ROOT, 'docs/review/prain.html')
N = json.load(open(os.path.join(ROOT, 'docs/perf/prain-v2.json')))
total_bytes = 0

def enc(im, q=80):
    global total_bytes
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True); total_bytes += len(b.getvalue())
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
def load(name):
    p = os.path.join(SH, f'prain_{name}.jpg')
    return Image.open(p).convert('RGB') if os.path.exists(p) else None
def frame_img(name, w=860, q=78):
    im = load(name)
    if im is None: return f'<div class="missing">{name}: no capture</div>'
    im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
    return f'<img alt="{name}" src="{enc(im, q)}" width="{im.size[0]}" height="{im.size[1]}">'
def crop_img(name, box, scale=3, show=1.5, q=86):
    im = load(name)
    if im is None: return f'<div class="missing">{name}: no capture</div>'
    x, y, w, h = box; c = im.crop((x, y, x + w, y + h)).resize((w * scale, h * scale), Image.NEAREST)
    return f'<img alt="{name} crop" src="{enc(c, q)}" width="{round(w * show)}" height="{round(h * show)}">'
def strip_img(tag, n, box, scale=2, q=80):
    frames = [load(f'{tag}-f{i}') for i in range(n)]
    if any(f is None for f in frames): return f'<div class="missing">{tag}: filmstrip incomplete</div>'
    x, y, w, h = box; gap = 6
    out = Image.new('RGB', (n * w * scale + (n - 1) * gap, h * scale), (24, 24, 24))
    for i, f in enumerate(frames): out.paste(f.crop((x, y, x + w, y + h)).resize((w * scale, h * scale), Image.NEAREST), (i * (w * scale + gap), 0))
    return f'<div class="scroll"><img alt="{tag} filmstrip" src="{enc(out, q)}" width="{out.size[0]}" height="{out.size[1]}" style="max-width:none"></div>'
def smear(tag, box, m=8):
    paths = [os.path.join(AB, f'ab_{tag}-s{i}.png') for i in range(m)]
    if not all(os.path.exists(p) for p in paths): return f'<div class="missing">{tag}: smear frames missing</div>', None
    x, y, w, h = box
    st = np.stack([np.asarray(Image.open(p).convert('RGB').crop((x, y, x + w, y + h))).astype(np.float32) for p in paths])
    lum = (st * [0.2126, 0.7152, 0.0722]).sum(axis=3); rng = lum.max(axis=0) - lum.min(axis=0)
    stats = dict(mean=float(rng.mean()), p99=float(np.percentile(rng, 99)), gt20=float(100 * (rng > 20).mean()), gt40=float(100 * (rng > 40).mean()))
    vis = Image.fromarray(np.clip(rng * 3, 0, 255).astype(np.uint8)).convert('RGB').resize((w * 2, h * 2), Image.NEAREST)
    f3 = Image.fromarray(st[3].astype(np.uint8)).resize((w * 2, h * 2), Image.NEAREST)
    cells = f'<figure><img src="{enc(f3, 84)}" width="{w*2}" height="{h*2}"><figcaption>one frame</figcaption></figure><figure><img src="{enc(vis, 84)}" width="{w*2}" height="{h*2}"><figcaption>max − min over {m} frames (×3)</figcaption></figure>'
    return cells, stats

V = N['views']
def pair_block(key):
    v = V[key]; a, b = f'p2-{key}-v1', f'p2-{key}-v2'
    crops = ''.join(f'<div class="croprow"><figure>{crop_img(a, c[:4])}<figcaption>v1 · {c[4]}</figcaption></figure><figure>{crop_img(b, c[:4])}<figcaption>v2 · {c[4]}</figcaption></figure></div>' for c in v['crops'])
    return f'''<section><h3>{v["title"]}</h3><p class="sub">{v["sub"]}</p>
<div class="pair"><figure>{frame_img(a)}<figcaption>v1 — the grey scatterer (same drops, same frame)</figcaption></figure><figure>{frame_img(b)}<figcaption>v2 — water: phase + glint, refraction, spread / beads / thin lines, the wind</figcaption></figure></div>
{crops}<p class="read">{v["read"]}</p></section>'''

def cost_table():
    C = N['cost']; rows = []
    for r in C['rows']:
        rows.append(f"<tr><td>{r['variant']}</td><td>{r['union']:.2f} · {r['unionMed']:.2f}</td><td>{r['p95']:.2f}</td><td><b>{r['dUnion']:+.2f}</b></td><td>{r['particles']:.3f}</td><td>{r['alive']}</td><td>{r['blocks']}</td></tr>")
    return ('<div class="scroll"><table><caption>' + C['caption'] + '</caption><thead><tr><th>variant</th><th>union mean · median (ms)</th><th>p95</th><th>Δ union vs today</th><th>particles pass</th><th>alive (last block)</th><th>block unions</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div><p class="note">' + C['note'] + '</p>')
def knob_table():
    rows = ''.join(f"<tr><td><code>{k['k']}</code></td><td>{k['def']}</td><td>{k['v1']}</td><td>{k['what']}</td></tr>" for k in N['knobs'])
    return '<div class="scroll"><table><caption>PRAIN (game/rainFx.ts) — every row is on Tab ▸ Weather ▸ p-rain, kept per machine; <code>__rain.look</code> / <code>setLook({{…}})</code></caption><thead><tr><th>knob</th><th>default</th><th>v1 equiv.</th><th>what it does</th></tr></thead><tbody>' + rows + '</tbody></table></div>'

CSS = """
:root{--bg:#f6f7f4;--fg:#1c1f1a;--mut:#646a60;--card:#ffffff;--line:#dfe3d8;--acc:#2c6e8f;--good:#1f7a3a;--bad:#a12626;--warn:#8a5a00;--th:#eef1ea}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#121412;--fg:#e8ebe4;--mut:#9ea596;--card:#1a1d19;--line:#30352d;--acc:#7cc0e2;--good:#6fd08c;--bad:#f08080;--warn:#e0b25a;--th:#22261f}}
:root[data-theme="dark"]{--bg:#121412;--fg:#e8ebe4;--mut:#9ea596;--card:#1a1d19;--line:#30352d;--acc:#7cc0e2;--good:#6fd08c;--bad:#f08080;--warn:#e0b25a;--th:#22261f}
html{background:var(--bg);color:var(--fg)}body{background:var(--bg);max-width:1820px;margin:0 auto;padding:28px 18px 80px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
h1{font-size:26px;margin:0 0 6px;text-wrap:balance}h2{font-size:20px;margin:36px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px;text-wrap:balance}h3{font-size:16px;margin:22px 0 4px}table{font-variant-numeric:tabular-nums}
p{max-width:1100px}.sub{color:var(--mut);margin:0 0 8px}.read{background:var(--card);border:1px solid var(--line);padding:8px 12px}.read::before{content:'read · ';color:var(--acc);font-weight:600;letter-spacing:.02em}
.tldr{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 16px;max-width:1100px}.tldr b{color:var(--acc)}
.pair{display:flex;gap:10px}.pair figure{margin:0;flex:1 1 0;min-width:0}.pair img{width:100%;height:auto;border:1px solid var(--line)}@media (max-width:760px){.pair{flex-wrap:wrap}.pair figure{flex:1 1 100%}}
.croprow{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.croprow figure{margin:0;flex:0 1 auto;min-width:0}.croprow img{border:1px solid var(--line);image-rendering:pixelated;max-width:100%;height:auto}
figcaption{color:var(--mut);font-size:13px}
.smear{display:flex;gap:14px;flex-wrap:wrap}.smear .col{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px}.smear figure{margin:0 0 6px}.smear img{image-rendering:pixelated;max-width:100%;height:auto}
.scroll{overflow-x:auto;max-width:100%}table{border-collapse:collapse;font-size:13.5px;margin:6px 0}caption{text-align:left;color:var(--mut);padding:4px 0}th,td{border:1px solid var(--line);padding:4px 7px;text-align:right;white-space:nowrap}th{background:var(--th)}td:first-child,th:first-child{text-align:left}td:last-child{white-space:normal;text-align:left;min-width:280px}
.note{color:var(--mut);font-size:13.5px}code{background:var(--th);padding:1px 4px;border-radius:3px;font-size:13px}
.verdict{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}.verdict div{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px 14px}.verdict h4{margin:0 0 4px}
.good{color:var(--good)}.bad{color:var(--bad)}.warn{color:var(--warn)}.missing{color:var(--bad);border:1px dashed var(--bad);padding:20px}
ul{max-width:1100px}li{margin:3px 0}
"""

def merge_block():
    """MERGE PREP (08-12 night): the exit-sign fix's before / after crops, the identity hashes, the gates and the cost — from docs/perf/prain-merge.json (absent = no block)"""
    mp = os.path.join(ROOT, 'docs/perf/prain-merge.json')
    if not os.path.exists(mp): return ''
    M = json.load(open(mp))
    def pair(tag, box, cap):
        cells = ''.join(f'<div class="col"><b>{k}</b><br>{crop_img(f"signfix-{tag}-{k}", box, 3, 1.5)}</div>' for k in ('before', 'after'))
        return f'<div class="smear">{cells}</div><p class="note">{cap}</p>'
    idn = M.get('identity', {}); cost = M.get('cost', {}); gates = M.get('gates', {}); val = M.get('validate', {})
    def hrow(t):
        r = idn.get(t); 
        if not r: return ''
        return f"<tr><td>{t} {r['res'][0]}×{r['res'][1]}</td>" + ''.join(f"<td>{r['main'][v]} / {r['lane_norain2'][v]}</td>" for v in ('lot', 'exit', 'glass')) + f"<td>{'identical' if r['identical'] else 'DIFFERS'}</td></tr>"
    ident = f'<div class="tbl"><table><tr><th>preset</th><th>lot (main / lane ?norain2)</th><th>exit</th><th>glass</th><th></th></tr>{hrow("high")}{hrow("medium")}</table></div><p class="note">{idn.get("method", "")}</p>'
    def crow(k):
        c = cost.get(k)
        if not c: return ''
        return f"<tr><td>{c['view']}</td><td>{c['latticeOnly']['union']:.2f} (p95 {c['latticeOnly']['p95']:.2f})</td><td>{c['v2']['union']:.2f} (p95 {c['v2']['p95']:.2f})</td><td>+{c['delta_ms']:.2f}</td><td>{c['v2'].get('particlesPass', 0):.2f}</td></tr>"
    ctab = f'<div class="tbl"><table><tr><th>view (high)</th><th>lattice only, union ms</th><th>v2 on</th><th>Δ</th><th>particles pass</th></tr>{crow("lot")}{crow("indoor")}</table></div><p class="note">{cost.get("machine", "")} · {cost.get("memory", "")}</p>'
    gl = ''.join(f'<li><b>{k}</b>: {v}</li>' for k, v in gates.items())
    vl = f"pane: {val.get('pipelines', {}).get('done', '?')}/{val.get('pipelines', {}).get('total', val.get('pipelines', {}).get('done', '?'))} pipelines, {val.get('validationErrors', '?')} validation / {val.get('uncaptured', '?')} uncaptured / {val.get('consoleErrors', '?')} console errors ultra → verylow with the storm on ({val.get('sweep', '')})" if val else ''
    return f"""<h2>Merge prep (08-12 night): the exit-sign fix, identity, gates, cost</h2>
<p><b>The bug</b> (the designer's screenshot: green-lit drops outside by the corridor's exit sign): the streak's refraction reads the composite in SCREEN space and the top-down camera looks through the roof, so the green corridor floor sat a few pixels beside the drops outside its wall and a tap across the streak landed on it. <b>The fix</b>: a refracted read whose world point is UNDER A ROOF (inside the interior / annex footprint, below the ceiling) is refused like one nearer than the drop or on the sky — rain is only ever outdoors, nothing indoors is behind a drop; and a light whose source is under a roof no longer takes the untraced 35 % credit on rain (the carried / transient lights have no reach mask). Same boot, same staging, same drops (wind set toward the wall so they fall beside it):</p>
{pair('sign', (720, 150, 300, 360), 'The east exit sign from the follow camera, ×3: before, a green streak over the AC units and green flecks by the wall (105 green px in the crop); after, none — every other streak pixel-identical.')}
{pair('lobby', (760, 60, 300, 360), 'Second spot, the lobby frontage from above with the west lamp on (a lit floor behind glass beside the drops outside): no visible change — no collateral.')}
<h3>Identity: the OFF path is main, hash for hash</h3>{ident}
<h3>Gates</h3><ul>{gl}<li>{vl}</li></ul>
<h3>Cost of having it on</h3>{ctab}
<p class="note">Defaults for the merge: particle rain ON (v2) at every tier at its cap (6000 / 4000 / 2500 / 1500 / 800); <code>?norain2</code> = the lattice alone (the OFF path above); <code>?rainv1</code> = the layer with the v1 look for one visit; Tab ▸ Weather &amp; wind ▸ Rain — particles has the switch and the 'v1 look' / 'v2 defaults' buttons.</p>"""

def build():
    sm2, st2 = smear('smear2-v2', tuple(N['smear']['box']))
    sm1, st1 = smear('smear2-v1', tuple(N['smear']['box']))
    fmt = lambda s: '—' if not s else f"mean {s['mean']:.1f} · p99 {s['p99']:.0f} · {s['gt20']:.1f} % of pixels > 20 · {s['gt40']:.1f} % > 40"
    strips = ''.join(f'<h3>{s["title"]}</h3><p class="sub">{s["sub"]}</p>{strip_img(s["tag"], s["n"], tuple(s["box"]))}' for s in N['strips'])
    W = N['wind']
    windproof = f'''<div class="pair"><figure>{frame_img('wind-both')}<figcaption>{W["capA"]}</figcaption></figure><figure>{frame_img('wind-mainsign')}<figcaption>{W["capB"]}</figcaption></figure></div>
<div class="croprow"><figure>{crop_img('wind-both', W["box"], 2, 1.4)}<figcaption>v2, both layers · ×2</figcaption></figure><figure>{crop_img('wind-mainsign', W["box"], 2, 1.4)}<figcaption>the lattice alone, main's sign · ×2</figcaption></figure></div><p class="read">{W["read"]}</p>'''
    html = f'''<title>EXP: particle rain v2 — water, refraction, wind</title>
<style>{CSS}</style>
<h1>EXP: particle rain v2 — drops lit as water, refracting streaks, and the wind field</h1>
<p class="sub">{N['meta']['line']}</p>
<div class="tldr">{N['tldr']}</div>
{merge_block()}
<h2>What v2 does</h2>{N['built']}
<h2>v1 beside v2 — the same drops, the same frame</h2>
<p class="note">{N['viewsNote']}</p>
{''.join(pair_block(k) for k in N['viewOrder'])}
<h2>The wind</h2>{N['windText']}
{strips}
<h3>Which way the rain leans</h3>{windproof}
<h2>The TAA and the streaks</h2>
<p>{N['smear']['text']}</p>
<div class="smear"><div class="col"><b>v2 (refraction 'over', reactivity by what changed)</b><br>{sm2}<div class="note">{fmt(st2)}</div></div><div class="col"><b>v1 (additive, reactivity by luminance)</b><br>{sm1}<div class="note">{fmt(st1)}</div></div></div>
<h2>Cost</h2>{cost_table()}
<h2>The knobs</h2>{knob_table()}
<h2>Caveats · what is not done</h2>{N['caveats']}
<h2>How to try it · files</h2>{N['howto']}
'''
    open(OUT, 'w').write(html)
    print(f'{OUT}: {len(html)/1048576:.2f} MB (images {total_bytes/1048576:.2f} MB)')

build()
