#!/usr/bin/env python3
"""IMAGE-QUALITY program — build docs/review/image-quality.html (self-contained: inline CSS, crops as data-URI JPEG q≈85, light + dark + data-theme, < 10 MB).
Inputs: docs/perf/iq-summary.json (python3 tools/qa/iq-report.py --json docs/perf/iq-summary.json), docs/shots/iqp_*.jpg (page crops: __iq.pageCrops), docs/shots/chaos_*.jpg
(the fast-physics strips), docs/review/image-quality.prose.json (the hand-written sections: verdicts, recommendation, residuals, deletion list — kept out of the code).
  python3 tools/qa/iq-page.py"""
import os, sys, json, base64, io, html
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = os.path.join(ROOT, 'docs/shots'); OUT = os.path.join(ROOT, 'docs/review/image-quality.html')
SUM = json.load(open(os.path.join(ROOT, 'docs/perf/iq-summary.json')))
PROSE_F = os.path.join(ROOT, 'docs/review/image-quality.prose.json')
PROSE = json.load(open(PROSE_F)) if os.path.exists(PROSE_F) else {}
ROWS = {r['tag']: r for r in SUM['rows']}
CH = SUM.get('chaos') or {}
TIER = {'u': 'ultra', 'h': 'high', 'm': 'medium', 'l': 'low', 'v': 'verylow'}
budget = [0]

def img(name, w=None, q=85, scale_hint=''):
    p = os.path.join(SHOTS, name + '.jpg')
    if not os.path.exists(p): return f'<div class="missing">{html.escape(name)}: no crop</div>'
    im = Image.open(p).convert('RGB')
    if w and im.size[0] > w: im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.NEAREST if im.size[0] % w == 0 else Image.BILINEAR)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); data = b.getvalue(); budget[0] += len(data)
    return f'<img alt="{html.escape(name)}" src="data:image/jpeg;base64,{base64.b64encode(data).decode()}" width="{im.size[0]}" height="{im.size[1]}" loading="lazy">'

def fmt(v, nd=2, unit=''):
    if v is None: return '—'
    if isinstance(v, (int, float)): return f'{v:.{nd}f}{unit}'
    return html.escape(str(v))
def prose(key, default=''):
    v = PROSE.get(key, default)
    return v if isinstance(v, str) else default

def cell(v, best=None, worse=None, nd=2):
    cls = ''
    if v is not None and best is not None and abs(v - best) < 1e-9: cls = ' class="best"'
    return f'<td{cls}>{fmt(v, nd)}</td>'

LABEL = PROSE.get('labels', {})
def label(variant): return LABEL.get(variant, variant)

def frontier_table(tier):
    rows = [r for r in SUM['rows'] if r['tag'] and r['tag'].startswith(tier + '_')]
    if not rows: return '<p class="missing">no rows for this tier</p>'
    order = PROSE.get('order', {}).get(tier)
    if order: rows.sort(key=lambda r: order.index(r['variant']) if r['variant'] in order else 99)
    h = ['<div class="scroll"><table class="frontier"><thead><tr><th rowspan="2">variant</th><th colspan="2">box-edge width px<br><small>10–90 %, median of 5</small></th><th colspan="2">crawl px<br><small>edge position sd</small></th><th colspan="2">desk detail hp<br><small>still → motion</small></th>',
         '<th colspan="3">noise (still sd, 8-bit)<br><small>V1 foot pen · cub chair · cor shadow</small></th><th colspan="2">ReSTIR residuals<br><small>desk dim grain · lamp floor</small></th><th colspan="3">dynamic lights<br><small>A rug lit/dim · B flash · C haze f30</small></th><th colspan="2">calm cost ms<br><small>∪ med · p95</small></th></tr>',
         '<tr><th>still</th><th>motion</th><th>motion</th><th>still</th><th>still</th><th>motion</th><th>foot</th><th>chair</th><th>shadow</th><th>dim sd</th><th>sd</th><th>rug</th><th>flash</th><th>haze</th><th>∪</th><th>p95</th></tr></thead><tbody>']
    for r in rows:
        nz = r.get('noise') or {}; dg = r.get('deskGrain') or {}; fg = r.get('floorGlass') or {}; dy = r.get('dyn') or {}; A = dy.get('A') or {}; B = dy.get('B') or {}; C = dy.get('C') or {}; c = r.get('cost') or {}
        rug = f"{fmt((A.get('rugN') or {}).get('lit'),1)} / {fmt((A.get('rugN') or {}).get('dim'),1)}" if A else '—'
        haze = fmt((C.get('hazeMid') or [None]*4)[3], 1) if C else '—'
        h.append(f"<tr><th>{html.escape(label(r['variant']))} <small>{html.escape(r['tag'])}</small></th>{cell(r.get('wStill'))}{cell(r.get('wMotion'))}{cell(r.get('crawl'),nd=3)}{cell(r.get('crawlStill'),nd=3)}{cell(r.get('hpDeskStill'))}{cell(r.get('hpDeskMotion'))}"
                 f"{cell(nz.get('v1foot'),nd=3)}{cell(nz.get('cubChair'),nd=3)}{cell(nz.get('corShadow'),nd=3)}{cell(dg.get('dim'))}{cell(fg.get('sd'),nd=3)}<td>{rug}</td>{cell(B.get('flash'),nd=1)}<td>{haze}</td>{cell(c.get('union'))}{cell(c.get('p95'))}</tr>")
    h.append('</tbody></table></div>')
    return ''.join(h)

def edge_table(tier):
    rows = [r for r in SUM['rows'] if r['tag'] and r['tag'].startswith(tier + '_') and r.get('edgesMotion')]
    if not rows: return ''
    names = ['partTop', 'partTopN', 'kbFar', 'kbTop', 'deskFront']
    h = ['<div class="scroll"><table class="edges"><thead><tr><th>variant</th>' + ''.join(f'<th>{n}<br><small>still · motion · crawl</small></th>' for n in names) + '</tr></thead><tbody>']
    for r in rows:
        m, s = r['edgesMotion'], r['edgesStill']
        h.append(f"<tr><th>{html.escape(label(r['variant']))}</th>" + ''.join(f"<td>{fmt(s.get(n, [None])[0])} · {fmt(m.get(n, [None])[0])} · {fmt(m.get(n, [None, None])[1], 2)}</td>" if n in m else '<td>—</td>' for n in names) + '</tr>')
    h.append('</tbody></table></div>')
    return ''.join(h)

def strip(tags, cropname, title, frames=('s', 'm1', 'm2', 'm3'), w=None):
    cells = []
    for t in tags:
        r = ROWS.get(t, {}); imgs = ''.join(f'<div class="f"><span>{ {"s": "still", "m1": "motion −2", "m2": "motion −1", "m3": "motion 0"}[f] }</span>{img(f"iqp_{t}_{cropname}_{f}", w)}</div>' for f in frames)
        cells.append(f'<figure><figcaption><b>{html.escape(label(r.get("variant", t)))}</b> <small>{t}</small></figcaption><div class="frames">{imgs}</div></figure>')
    return f'<div class="strip"><div class="striptitle">{title}</div>{"".join(cells)}</div>'

def chaos_strip(key, variants, roi, frames=('01', '02', '04', '08'), title=''):
    cells = []
    for v in variants:
        imgs = ''.join(f'<div class="f"><span>+{int(f)}</span>{img(f"chaos_{key}_{v}_{roi}_f{f}", 340)}</div>' for f in frames)
        cells.append(f'<figure><figcaption><b>{html.escape(label(v))}</b></figcaption><div class="frames">{imgs}</div><div class="maps">{img(f"chaos_{key}_{v}_{roi}_lag", 220)}<span>lag map</span>{img(f"chaos_{key}_{v}_{roi}_boil", 220)}<span>boil</span></div></figure>')
    return f'<div class="strip chaos"><div class="striptitle">{title}</div>{"".join(cells)}</div>'

STRESS_FILES = {'ultra': 'iq-ultra-stress.json', 'high': 'iq-high3-stress.json', 'medium': 'iq-medium-stress.json', 'low': 'iq-low-stress.json', 'verylow': 'iq-verylow-stress.json'}
BARS = {'ultra': 30, 'high': 14, 'medium': 16.6, 'low': 16.6, 'verylow': 16.6}
def stress_table():
    h = ['<div class="scroll"><table><thead><tr><th>tier</th><th>pair (A vs B)</th><th>res</th><th>A ∪ mean / p50 / p95 / max</th><th>B ∪ mean / p50 / p95 / max</th><th>Δ mean</th><th>B sharpU + compS</th><th>bar (p95)</th></tr></thead><tbody>']
    for tier, f in STRESS_FILES.items():
        fp = os.path.join(ROOT, 'docs/perf', f)
        if not os.path.exists(fp): continue
        d = json.load(open(fp))
        for pr in d.get('pairs', []):
            A, B = pr['A']['union'], pr['B']['union']; pb = pr['B']['passes']
            ok = 'fits' if B['p95'] <= BARS[tier] else 'over'
            h.append(f"<tr><th>{tier}</th><td style='text-align:left'>{html.escape(label(pr['a']))} vs <b>{html.escape(label(pr['b']))}</b></td><td>{html.escape(pr.get('res',''))}</td><td>{A['mean']} / {A['p50']} / {A['p95']} / {A['max']}</td><td>{B['mean']} / {B['p50']} / <b>{B['p95']}</b> / {B['max']}</td><td>{B['mean']-A['mean']:+.2f}</td><td>{(pb.get('sharpU') or {}).get('mean', 0)} + {(pb.get('compS') or {}).get('mean', 0)}</td><td>≤ {BARS[tier]} · {ok}</td></tr>")
    h.append('</tbody></table></div>')
    return ''.join(h)

def tldr_table():
    pairs = [('ultra', 'u_main', 'u_c3j09'), ('high', 'h_main', 'h_c3jh'), ('medium', 'm_main', 'm_c3jh'), ('low', 'l_main', 'l_c3jh'), ('verylow', 'v_main', 'v_c3jh')]
    stress = {}
    for tier, f in STRESS_FILES.items():
        fp = os.path.join(ROOT, 'docs/perf', f)
        if os.path.exists(fp):
            for pr in json.load(open(fp)).get('pairs', []):
                if pr['b'] in ('c3jh', 'c3j09'): stress[tier] = (pr['A']['union'], pr['B']['union'])
    h = ['<div class="scroll"><table><thead><tr><th rowspan="2">tier</th><th colspan="2">still width px</th><th colspan="2">motion width px</th><th colspan="2">crawl px</th><th colspan="2">desk detail (still)</th><th colspan="2">calm ∪ ms</th><th colspan="2">stress ∪ mean / p95 ms</th></tr><tr>' + '<th>main</th><th>C3j</th>' * 6 + '</tr></thead><tbody>']
    for tier, a, b in pairs:
        A, B = ROWS.get(a, {}), ROWS.get(b, {})
        if not A or not B: continue
        sa, sb = stress.get(tier, (None, None))
        st = f"<td>{sa['mean']} / {sa['p95']}</td><td><b>{sb['mean']} / {sb['p95']}</b></td>" if sa else '<td>—</td><td>—</td>'
        h.append(f"<tr><th>{tier}</th>{cell(A.get('wStill'))}<td><b>{fmt(B.get('wStill'))}</b></td>{cell(A.get('wMotion'))}<td><b>{fmt(B.get('wMotion'))}</b></td>{cell(A.get('crawl'),nd=3)}<td><b>{fmt(B.get('crawl'),3)}</b></td>{cell(A.get('hpDeskStill'))}<td><b>{fmt(B.get('hpDeskStill'))}</b></td>{cell((A.get('cost') or {}).get('union'))}<td><b>{fmt((B.get('cost') or {}).get('union'))}</b></td>{st}</tr>")
    h.append('</tbody></table></div>')
    return ''.join(h)

def chaos_table():
    if not CH: return '<p class="missing">no chaos dumps</p>'
    h = ['<div class="scroll"><table><thead><tr><th>scene · ROI</th><th>tier · variant</th><th>res</th><th>swept px</th><th>lag frames<br><small>mean · p90 · max</small></th><th>trail px<br><small>(px per m/s @ m/s)</small></th><th>residue levels<br><small>+1 · +2 · +4 · +8</small></th><th>boil<br><small>static sd</small></th><th>on-object<br><small>|Δ| vs ref</small></th><th>cost ms<br><small>∪ mean · p95 · direct · gbuffer</small></th></tr></thead><tbody>']
    for name, d in CH.items():
        for key, byVar in d.items():
            for v, o in byVar.items():
                for rn, m in (o.get('metrics') or {}).items():
                    res = m.get('residue') or {}; c = o.get('cost') or {}
                    cost = f"{fmt((c.get('union') or {}).get('mean'))} · {fmt((c.get('union') or {}).get('p95'))} · {fmt((c.get('direct') or {}).get('mean'))} · {fmt((c.get('gbuffer') or {}).get('mean'))}" if c else '—'
                    h.append(f"<tr><th>{html.escape(key)} · {rn}</th><td>{html.escape(name)} · {html.escape(label(v))}</td><td>{o.get('res')}</td><td>{m.get('swept')}</td><td>{fmt(m.get('lagMean'))} · {m.get('lagP90')} · {m.get('lagMax')}</td><td>{fmt(m.get('trailPx'),1)} ({fmt(m.get('trailPxPerMps'),2)} @ {fmt(m.get('speed'),1)})</td><td>{fmt(res.get('1'))} · {fmt(res.get('2'))} · {fmt(res.get('4'))} · {fmt(res.get('8'))}</td><td>{fmt(m.get('boilStatic'),3)}</td><td>{fmt(m.get('onObjMean'))}</td><td>{cost}</td></tr>")
    h.append('</tbody></table></div>')
    return ''.join(h)

CSS = """
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--best:#e8f4e1;--code:#f3f1ea;}
@media (prefers-color-scheme: dark){:root{--bg:#161615;--fg:#e9e6df;--mut:#a19e96;--card:#1f1e1c;--line:#34322d;--acc:#f0b34a;--best:#233520;--code:#262522;}}
:root[data-theme="light"]{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--best:#e8f4e1;--code:#f3f1ea;}
:root[data-theme="dark"]{--bg:#161615;--fg:#e9e6df;--mut:#a19e96;--card:#1f1e1c;--line:#34322d;--acc:#f0b34a;--best:#233520;--code:#262522;}
body{background:var(--bg);color:var(--fg);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;}
main{max-width:1180px;margin:0 auto;padding:28px 20px 80px;}
h1{font-size:28px;margin:0 0 6px;letter-spacing:-.01em} h2{font-size:21px;margin:42px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px} h3{font-size:16px;margin:26px 0 8px;color:var(--acc)}
p,li{max-width:78ch} small,.mut{color:var(--mut)} code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:13px}
.lede{font-size:16px;color:var(--mut);max-width:80ch}
.rule{border-left:4px solid var(--acc);background:var(--card);padding:12px 16px;margin:14px 0;border-radius:0 8px 8px 0}
.scroll{overflow-x:auto;margin:10px 0 18px;border:1px solid var(--line);border-radius:8px;background:var(--card)}
table{border-collapse:collapse;font-size:12.5px;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:5px 7px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap} th{text-align:left;font-weight:600;background:var(--code)} thead th{text-align:center;vertical-align:bottom}
tbody th{background:transparent} td.best{background:var(--best);font-weight:600}
.strip{margin:16px 0 26px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.striptitle{font-weight:600;margin-bottom:8px}
.strip figure{margin:0 0 12px} .strip figcaption{font-size:13px;margin-bottom:4px}
.frames{display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start} .frames .f{display:flex;flex-direction:column;font-size:11px;color:var(--mut)} .frames img{image-rendering:pixelated;border-radius:4px;max-width:100%;height:auto}
.maps{display:flex;gap:8px;align-items:center;font-size:11px;color:var(--mut);margin-top:4px} .maps img{border-radius:4px}
.missing{color:#b04a3f;font-size:12px}
.rec{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px} .rec .card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px} .rec h4{margin:0 0 6px}
pre{background:var(--code);padding:10px 12px;border-radius:8px;overflow-x:auto;font-size:12.5px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px} @media (max-width:800px){.two{grid-template-columns:1fr}}
</style>
"""

def main():
    parts = ['<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Renderer v3 — image quality: sharpness, TAA resolve, ReSTIR grain, fast physics (all five tiers)</title>', CSS, '<main>']
    parts.append('<h1>Renderer v3 — image quality program</h1>')
    parts.append(f'<p class="lede">{prose("lede")}</p>')
    parts.append('<h2 id="tldr">TL;DR — main vs the recommended C3j configuration, per tier</h2>' + prose('tldr_html') + tldr_table())
    parts.append(prose('intro_html'))
    parts.append('<h2 id="instruments">1 · Instruments</h2>' + prose('instruments_html'))
    parts.append('<h2 id="frontier">2 · The frontier, per tier</h2>' + prose('frontier_intro_html'))
    for t in ['h', 'u', 'm', 'l', 'v']:
        if not any(r['tag'] and r['tag'].startswith(t + '_') for r in SUM['rows']): continue
        parts.append(f'<h3>{TIER[t]}</h3>' + prose(f'tier_{t}_html') + frontier_table(t) + '<details><summary>per edge (still · motion width · crawl)</summary>' + edge_table(t) + '</details>')
    parts.append('<h2 id="crops">3 · The telling crops</h2>' + prose('crops_intro_html'))
    for s in PROSE.get('strips', []): parts.append(strip(s['tags'], s['crop'], s['title'], tuple(s.get('frames', ['s', 'm1', 'm2', 'm3'])), s.get('w')))
    parts.append('<h2 id="physics">4 · Fast physics — the chaos scenes</h2>' + prose('physics_intro_html'))
    for s in PROSE.get('chaos_strips', []): parts.append(chaos_strip(s['key'], s['variants'], s['roi'], tuple(s.get('frames', ['01', '02', '04', '08'])), s['title']))
    parts.append(chaos_table() + prose('physics_findings_html'))
    parts.append('<h2 id="recommendation">5 · Recommendation — one configuration per tier</h2>' + prose('rule_html') + prose('recommendation_html') + '<h3>The stress minute (QRF weapon lights + rain + 8 smoke domains, orbiting camera; A/B/A/B, serialized)</h3>' + stress_table())
    parts.append('<h2 id="chaos-budget">6 · How much chaos can we afford</h2>' + prose('budget_html'))
    parts.append('<h2 id="residuals">7 · Honest residuals</h2>' + prose('residuals_html'))
    parts.append('<h2 id="legacy">8 · Legacy paths we could now delete</h2>' + prose('legacy_html'))
    parts.append('<h2 id="method">9 · Method, identities, gates</h2>' + prose('method_html'))
    parts.append('</main>')
    out = ''.join(parts)
    os.makedirs(os.path.dirname(OUT), exist_ok=True); open(OUT, 'w').write(out)
    print(f'{OUT}: {len(out)/1048576:.2f} MB (images {budget[0]/1048576:.2f} MB)')

if __name__ == '__main__': main()
