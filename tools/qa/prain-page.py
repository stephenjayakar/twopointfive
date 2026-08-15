#!/usr/bin/env python3
"""PARTICLE-RAIN prototype — build docs/review/particle-rain.html: self-contained (frames / crops / filmstrips / smear maps as data-URI JPEG), light + dark +
data-theme, < 8 MB. Inputs: the captures tools/qa/prain-harness.js posts (docs/shots/prain_*.jpg, docs/shots/ab/ab_smear-*.png) and docs/perf/prain-numbers.json
(the cost table, the burst test, the indoor take, the identity line — pasted from the harness's returns).   python3 tools/qa/prain-page.py [shots_dir]
The raw captures are not committed (≈ 60 MB with the lossless smear frames); to rebuild them from a `?paused&quality=high&mute&prain` boot with the sinks up:
    await import('/qa/prain-harness.js'); for (const v of ['lot','exit','car','glass','sam']) await __pr.pair(v, 'p-' + v);
    await __pr.pair('strike', 'p-strike', { pre: async () => { __weather.strike({ bearing: 3.7, elevDeg: 42, distKm: 0.5, peak: 22 }); __runFrames(1, 1/60); } });
    await __pr.strip('lot', 'fs-lot-hybrid', 6, 2); await __pr.strip('lot', 'fs-lot-today', 6, 2, { on: false }); await __pr.strip('exit', 'fs-exit-hybrid', 6, 2); await __pr.strip('sam', 'fs-sam-hybrid', 6, 3, { rate: 0.8 });
    await __pr.smear('lot', 'smear-on', 8, null); await __pr.smear('lot', 'smear-off', 8, 0)"""
import os, sys, json, base64, io
from PIL import Image
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs/shots')
AB = os.path.join(SH, 'ab')
OUT = os.path.join(ROOT, 'docs/review/particle-rain.html')
N = json.load(open(os.path.join(ROOT, 'docs/perf/prain-numbers.json')))
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
def crop_img(name, box, scale=3, show=1.5, q=84):
    """box = (x, y, w, h) in the 1777×1000 frame; upscaled ×scale nearest for judging, displayed at ×show"""
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
    """per-pixel max − min of luma over m consecutive frames (×3 for display) + frame 3 + the mean; returns (html, stats)"""
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

V = N['views']   # view key → {title, sub, crops: [[x,y,w,h, caption], …]}
def pair_block(key):
    v = V[key]; t, h = f'p-{key}-today', f'p-{key}-hybrid'
    crops = ''.join(f'<div class="croprow"><figure>{crop_img(t, c[:4])}<figcaption>today · {c[4]}</figcaption></figure><figure>{crop_img(h, c[:4])}<figcaption>hybrid · {c[4]}</figcaption></figure></div>' for c in v['crops'])
    return f'''<section><h3>{v["title"]}</h3><p class="sub">{v["sub"]}</p>
<div class="pair"><figure>{frame_img(t)}<figcaption>TODAY — the lattice alone</figcaption></figure><figure>{frame_img(h)}<figcaption>HYBRID — particles near, lattice far</figcaption></figure></div>
{crops}<p class="read">{v["read"]}</p></section>'''

def cost_table():
    rows = []
    for r in N['tiers']['rows']:
        d = r['uH'] - r['uT']
        rows.append(f"<tr><td>{r['preset']}</td><td>{r['size']}</td><td>{r['uT']:.2f} · {r['p95T']:.2f}</td><td>{r['uH']:.2f} · {r['p95H']:.2f}</td><td><b>{d:+.2f}</b></td><td>{r['partH']:.2f}</td><td>{r['volT']:.2f} → {r['volH']:.2f}</td><td>{r['wallT']:.1f} → {r['wallH']:.1f}</td><td>{r['alive']}</td><td>{r['births']}</td><td>{r['cap']}</td></tr>")
    return ('<div class="scroll"><table><caption>' + N['tiers']['caption'] + '</caption><thead><tr><th>preset</th><th>internal → output</th><th>today ∪ mean · p95</th><th>hybrid ∪ mean · p95</th><th>Δ∪</th><th>particles pass</th><th>volumetrics</th><th>wall / frame</th><th>alive</th><th>births / frame</th><th>tier caps (drops · births)</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div><p class="note">' + N['tiers']['note'] + '</p>')
def burst_table():
    B = N['burst']; rows = ''.join(f"<tr><td>{k}</td><td>{r['gameplayBorn']}</td><td>{' · '.join(str(x) for x in r['shotBorn'][:8])} …</td><td>{r['pendingPeak']}</td><td>{r['droppedBirths']} / {r['shedSparks']} / {r['droppedRecs']}</td><td>{r['live0Peak']} / {r['live1Peak']}</td><td>{r['recsPeak']}</td><td>{r['rainBorn']}</td><td>{r['rLivePeak']}</td><td>{r['rainDroppedBirths']} / {r['rainDroppedRecs']}</td></tr>" for k, r in B['runs'].items())
    return '<div class="scroll"><table><caption>' + B['caption'] + '</caption><thead><tr><th>run</th><th>gameplay births (150 frames)</th><th>births on each shot frame</th><th>records waiting, peak</th><th>births dropped / sparks shed / records refused</th><th>SHORT / LONG window peak</th><th>records / frame peak</th><th>rain births</th><th>rain window peak</th><th>rain dropped (births / records)</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="note">' + B['note'] + '</p>'

CSS = """
:root{--bg:#f6f7f4;--fg:#1c1f1a;--mut:#646a60;--card:#ffffff;--line:#dfe3d8;--acc:#2c6e8f;--good:#1f7a3a;--bad:#a12626;--warn:#8a5a00;--th:#eef1ea}
@media (prefers-color-scheme: dark){:root{--bg:#121412;--fg:#e8ebe4;--mut:#9ea596;--card:#1a1d19;--line:#30352d;--acc:#7cc0e2;--good:#6fd08c;--bad:#f08080;--warn:#e0b25a;--th:#22261f}}
:root[data-theme="light"]{--bg:#f6f7f4;--fg:#1c1f1a;--mut:#646a60;--card:#ffffff;--line:#dfe3d8;--acc:#2c6e8f;--good:#1f7a3a;--bad:#a12626;--warn:#8a5a00;--th:#eef1ea}
:root[data-theme="dark"]{--bg:#121412;--fg:#e8ebe4;--mut:#9ea596;--card:#1a1d19;--line:#30352d;--acc:#7cc0e2;--good:#6fd08c;--bad:#f08080;--warn:#e0b25a;--th:#22261f}
html{background:var(--bg);color:var(--fg)}body{max-width:1820px;margin:0 auto;padding:28px 18px 80px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
h1{font-size:26px;margin:0 0 6px;text-wrap:balance}h2{font-size:20px;margin:36px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px;text-wrap:balance}h3{font-size:16px;margin:22px 0 4px}table{font-variant-numeric:tabular-nums}
p{max-width:1100px}.sub{color:var(--mut);margin:0 0 8px}.read{background:var(--card);border:1px solid var(--line);padding:8px 12px}.read::before{content:'read · ';color:var(--acc);font-weight:600;letter-spacing:.02em}
.tldr{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 16px;max-width:1100px}.tldr b{color:var(--acc)}
.pair{display:flex;gap:10px}.pair figure{margin:0;flex:1 1 0;min-width:0}.pair img{width:100%;height:auto;border:1px solid var(--line)}@media (max-width:760px){.pair{flex-wrap:wrap}.pair figure{flex:1 1 100%}}
.croprow{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.croprow figure{margin:0;flex:0 1 auto;min-width:0}.croprow img{border:1px solid var(--line);image-rendering:pixelated;max-width:100%;height:auto}
figcaption{color:var(--mut);font-size:13px}
.smear{display:flex;gap:14px;flex-wrap:wrap}.smear .col{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px}.smear figure{margin:0 0 6px}.smear img{image-rendering:pixelated;max-width:100%;height:auto}
.scroll{overflow-x:auto;max-width:100%}table{border-collapse:collapse;font-size:13.5px;margin:6px 0}caption{text-align:left;color:var(--mut);padding:4px 0}th,td{border:1px solid var(--line);padding:4px 7px;text-align:right;white-space:nowrap}th{background:var(--th)}td:first-child,th:first-child{text-align:left}
.note{color:var(--mut);font-size:13.5px}code{background:var(--th);padding:1px 4px;border-radius:3px;font-size:13px}
.verdict{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}.verdict div{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px 14px}.verdict h4{margin:0 0 4px}
.good{color:var(--good)}.bad{color:var(--bad)}.warn{color:var(--warn)}.missing{color:var(--bad);border:1px dashed var(--bad);padding:20px}
ul{max-width:1100px}li{margin:3px 0}
"""

def build():
    sm_on, st_on = smear('smear-on', tuple(N['smear']['box']))
    sm_off, st_off = smear('smear-off', tuple(N['smear']['box']))
    fmt = lambda s: '—' if not s else f"mean {s['mean']:.1f} · p99 {s['p99']:.0f} · {s['gt20']:.1f} % of pixels > 20 · {s['gt40']:.1f} % > 40"
    strips = ''.join(f'<h3>{s["title"]}</h3><p class="sub">{s["sub"]}</p>{strip_img(s["tag"], s["n"], tuple(s["box"]))}' for s in N['strips'])
    html = f'''<title>EXP: particle rain — a near-field GPU drop layer over the lattice</title>
<style>{CSS}</style>
<h1>EXP: particle rain — a near-field layer of GPU rain drops over the lattice rain</h1>
<p class="sub">{N['meta']['line']}</p>
<div class="tldr">{N['tldr']}</div>
<h2>What was built</h2>{N['built']}
<h2>V1 – V5: today (the lattice) beside the hybrid</h2>
<p class="note">{N['viewsNote']}</p>
{''.join(pair_block(k) for k in N['viewOrder'])}
<h2>Motion — six frames</h2>{strips}
<h2>The TAA and the reactive mask</h2>
<p>{N['smear']['text']}</p>
<div class="smear"><div class="col"><b>reactive ON (particleRainReact 6, shipped)</b><br>{sm_on}<div class="note">{fmt(st_on)}</div></div><div class="col"><b>reactive forced OFF (0)</b><br>{sm_off}<div class="note">{fmt(st_off)}</div></div></div>
<h2>Numbers</h2>
<h3>Cost per tier</h3>{cost_table()}
<h3>Do gameplay bursts still get their births?</h3>{burst_table()}
<h3>Indoors, identity, memory</h3>{N['misc']}
<h2>Verdict</h2><div class="verdict">{N['verdict']}</div>
<h2>Recommendation</h2>{N['recommend']}
<h2>How to try it · files touched</h2>{N['howto']}
'''
    open(OUT, 'w').write(html)
    print(f'{OUT}: {len(html)/1048576:.2f} MB (images {total_bytes/1048576:.2f} MB)')

build()
