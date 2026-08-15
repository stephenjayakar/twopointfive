#!/usr/bin/env python3
"""exp/trace-perf — build docs/review/trace-perf.html (self-contained, light + dark + data-theme, < 6 MB) from:
  docs/perf/trace-results.json   (hand-kept from the notebook: profile, micro-bench per variant, exactness rows, identity hashes, noise)
  docs/perf/trace-matrix-*.json  (the scene matrix, __tl.matrix)
  docs/shots/tr_*.jpg            (crops: E8 iid vs strata, the V6/V4 hint row)
python3 tools/qa/trace-page.py"""
import os, sys, json, base64, io, glob
try:
    from PIL import Image
except Exception:
    Image = None

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
R = json.load(open(os.path.join(ROOT, 'docs/perf/trace-results.json')))
MX = {}
for p in sorted(glob.glob(os.path.join(ROOT, 'docs/perf/trace-matrix-*.json'))):
    try:
        d = json.load(open(p)); MX[os.path.basename(p)[len('trace-matrix-'):-5]] = d
    except Exception as e:
        print('skip', p, e)
SH = os.path.join(ROOT, 'docs/shots'); OUT = os.path.join(ROOT, 'docs/review/trace-perf.html')

def img(name, w=330, q=85):
    p = os.path.join(SH, 'tr_' + name + '.jpg')
    if not os.path.exists(p) or Image is None: return f'<div class="missing">{name}: no crop</div>'
    im = Image.open(p).convert('RGB')
    if im.size[0] > w: im = im.resize((w, round(im.size[1] * w / im.size[0])), Image.NEAREST if im.size[0] % w == 0 else Image.BILINEAR)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q); s = base64.b64encode(b.getvalue()).decode()
    return f'<img alt="{name}" src="data:image/jpeg;base64,{s}" width="{im.size[0]}" height="{im.size[1]}">'

CSS = """
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--good:#1f7a3a;--bad:#a12626;--th:#f1eee6;--bar:#c9924a;--bar2:#7aa6d8}
@media (prefers-color-scheme: dark){:root{--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#e0b25a;--good:#6fd08c;--bad:#f08080;--th:#24231f;--bar:#e0b25a;--bar2:#7aa6d8}}
:root[data-theme="light"]{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a65;--card:#ffffff;--line:#e4e1d8;--acc:#8a5a00;--good:#1f7a3a;--bad:#a12626;--th:#f1eee6;--bar:#c9924a;--bar2:#7aa6d8}
:root[data-theme="dark"]{--bg:#141412;--fg:#ecebe6;--mut:#a3a29b;--card:#1c1c19;--line:#34332e;--acc:#e0b25a;--good:#6fd08c;--bad:#f08080;--th:#24231f;--bar:#e0b25a;--bar2:#7aa6d8}
html{background:var(--bg);color:var(--fg)}body{max-width:1180px;margin:0 auto;padding:28px 18px 80px;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:34px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}h3{font-size:16px;margin:22px 0 6px}
p{margin:8px 0}.mut{color:var(--mut)}.lead{font-size:16px}code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--th);padding:1px 4px;border-radius:3px}
.tldr{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);border-radius:6px;padding:12px 16px;margin:14px 0}
.tldr li{margin:4px 0}
.scroll{overflow-x:auto;margin:10px 0}table{border-collapse:collapse;font-size:13.5px;min-width:640px}th,td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}th{background:var(--th);font-weight:600}caption{caption-side:top;text-align:left;font-weight:600;padding:4px 0;color:var(--mut)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.good{color:var(--good);font-weight:600}.bad{color:var(--bad);font-weight:600}.meh{color:var(--mut)}
.bars{display:grid;grid-template-columns:minmax(160px,300px) 1fr 110px;gap:4px 10px;align-items:center;margin:10px 0;font-size:13.5px}
.bar{height:14px;background:var(--th);border-radius:3px;position:relative;overflow:hidden}.bar>i{position:absolute;left:0;top:0;bottom:0;background:var(--bar);border-radius:3px}.bar>i.b2{background:var(--bar2)}
.bar .zero{position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--mut)}
.strip{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:6px}figure img{display:block;image-rendering:pixelated;max-width:100%;height:auto}figcaption{font-size:12.5px;color:var(--mut);margin-top:4px;max-width:330px}
.verdict{display:inline-block;padding:1px 7px;border-radius:10px;font-size:12px;font-weight:600;border:1px solid var(--line)}
.v-win{background:rgba(80,180,100,.15);color:var(--good)}.v-neg{background:rgba(220,80,80,.12);color:var(--bad)}.v-nil{color:var(--mut)}.v-sit{background:rgba(200,150,60,.15);color:var(--acc)}
.missing{font-size:12px;color:var(--bad);border:1px dashed var(--line);padding:20px;width:290px}
ol.merge li{margin:8px 0}
"""

def pct(v, good_when='pos'):
    if v is None: return '<span class="meh">—</span>'
    cls = 'good' if (v > 1.5 if good_when == 'pos' else v < -1.5) else ('bad' if (v < -1.5 if good_when == 'pos' else v > 1.5) else 'meh')
    return f'<span class="{cls}">{v:+.1f} %</span>'

def bars(rows, unit='', maxv=None, signed=False):
    """rows: [(label, value, cls)]"""
    vals = [abs(v) for _, v, *_ in rows if v is not None]
    m = maxv or (max(vals) if vals else 1.0)
    h = ['<div class="bars">']
    for row in rows:
        label, v = row[0], row[1]; cls = row[2] if len(row) > 2 else ''
        if v is None: h.append(f'<div>{label}</div><div class="bar"></div><div class="num meh">—</div>'); continue
        if signed:
            w = min(50.0, abs(v) / m * 50.0); left = 50.0 if v >= 0 else 50.0 - w
            h.append(f'<div>{label}</div><div class="bar"><span class="zero"></span><i class="{cls}" style="left:{left:.1f}%;width:{w:.1f}%"></i></div><div class="num">{v:+.1f}{unit}</div>')
        else:
            vs = f'{v:.0f}' if abs(v) >= 100 else f'{v:.2f}'
            h.append(f'<div>{label}</div><div class="bar"><i class="{cls}" style="width:{min(100.0, v / m * 100):.1f}%"></i></div><div class="num">{vs}{unit}</div>')
    h.append('</div>'); return ''.join(h)

def profile_section():
    P = R['profile']
    h = ['<h2 id="profile">1 · Profile first — where the traversal time goes</h2>',
         f'<p class="lead">{P["lead"]}</p>',
         '<div class="scroll"><table><caption>B1 cubicles · high 1368×770 · serialized still frames · the 97/98/99 instruments trace every ray twice, so pass(2×) − pass(1×) = time inside the tracer</caption><thead><tr><th>pass</th><th class="num">1× ms</th><th class="num">any-hit share</th><th class="num">closest share</th><th class="num">traversal in the pass</th></tr></thead><tbody>']
    for row in P['passes']:
        h.append(f'<tr><td>{row[0]}</td><td class="num">{row[1]}</td><td class="num">{row[2]}</td><td class="num">{row[3]}</td><td class="num">{row[4]}</td></tr>')
    h.append('</tbody></table></div>')
    h.append(bars([(r[0], r[5]) for r in P['passes'] if r[5] is not None], unit=' ms'))
    h.append('<h3>Per ray — the reference any-hit walk with counters (B1 receivers)</h3><div class="scroll"><table><thead><tr><th>class</th><th class="num">hit %</th><th>answered by global / grid / capsule %</th><th class="num">cells visited</th><th class="num">lists loaded</th><th class="num">item words (y-culled)</th><th class="num">slab tests (yawed)</th><th class="num">capsule spheres / tests</th></tr></thead><tbody>')
    for row in P['perRay']:
        h.append('<tr>' + ''.join(f'<td class="num">{c}</td>' if i else f'<td>{c}</td>' for i, c in enumerate(row)) + '</tr>')
    h.append('</tbody></table></div>')
    h.append(f'<p>{P["perRayRead"]}</p>')
    h.append('<h3>The probe that decides everything: coherence</h3>')
    h.append(f'<p>{P["cohLead"]}</p>')
    h.append(bars([(r[0], r[1], 'b2' if r[2] else '') for r in P['coherence']], unit=' Mrays/s'))
    h.append(f'<p>{P["cohRead"]}</p>')
    return ''.join(h)

def verdict(v):
    m = {'win': ('v-win', 'WIN'), 'neg': ('v-neg', 'NEGATIVE'), 'nil': ('v-nil', 'no effect'), 'sit': ('v-sit', 'situational')}
    c, t = m.get(v, ('v-nil', v)); return f'<span class="verdict {c}">{t}</span>'

def ranked_section():
    V = R['variants']
    h = ['<h2 id="ranked">2 · Every attempt, ranked</h2>', f'<p>{R["rankedLead"]}</p>',
         '<div class="scroll"><table><thead><tr><th>#</th><th>variant</th><th>hypothesis</th><th>exact?</th><th>micro-bench, paired speed-up per ray class</th><th>frame (B1 high)</th><th>verdict</th><th>merge cost</th></tr></thead><tbody>']
    for i, v in enumerate(V):
        micro = ' · '.join(f'{k} {pct(x)}' for k, x in v['micro']) if v.get('micro') else '<span class="meh">—</span>'
        frame = ' · '.join(f'{k} {pct(x, "neg")}' for k, x in v['frame']) if v.get('frame') else '<span class="meh">—</span>'
        h.append(f'<tr><td>{i + 1}</td><td><b>{v["name"]}</b></td><td>{v["what"]}</td><td>{v["exact"]}</td><td>{micro}</td><td>{frame}</td><td>{verdict(v["verdict"])}</td><td>{v["cost"]}</td></tr>')
    h.append('</tbody></table></div>')
    # bars: micro speed-up on the incoherent shadow-ray class per variant
    h.append('<h3>Per-variant bars — paired speed-up on the incoherent classes (light shadow rays · gather closest hits), %</h3>')
    h.append(bars([(v['name'], v.get('barLight')) for v in V if 'barLight' in v], unit=' %', signed=True, maxv=15))
    h.append(bars([(v['name'], v.get('barGather'), 'b2') for v in V if 'barGather' in v], unit=' %', signed=True, maxv=15))
    return ''.join(h)

def exact_section():
    E = R['exactness']
    h = ['<h2 id="exact">3 · Exactness evidence</h2>', f'<p>{E["lead"]}</p>', '<div class="scroll"><table><thead><tr><th>variant</th><th class="num">rays compared</th><th>combos (query × class)</th><th>disagreements</th><th>result</th></tr></thead><tbody>']
    for row in E['rows']:
        ok = row[4] == 'EXACT'
        h.append(f'<tr><td>{row[0]}</td><td class="num">{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td class="{"good" if ok else "bad"}">{row[4]}</td></tr>')
    h.append('</tbody></table></div>')
    h.append('<h3>Whole-frame identity</h3><div class="scroll"><table><thead><tr><th>build / boot</th><th>B1 hash</th><th>B3 hash</th><th>note</th></tr></thead><tbody>')
    for row in E['hashes']:
        h.append('<tr>' + ''.join(f'<td><code>{c}</code></td>' if 0 < i < 3 else f'<td>{c}</td>' for i, c in enumerate(row)) + '</tr>')
    h.append('</tbody></table></div>')
    return ''.join(h)

def matrix_section():
    if not MX: return '<h2 id="matrix">4 · Scene matrix</h2><p class="bad">no docs/perf/trace-matrix-*.json yet</p>'
    h = ['<h2 id="matrix">4 · Scene matrix — union and the tracing passes per scene, per preset (serialized still frames, medians, interleaved)</h2>', f'<p>{R.get("matrixLead", "")}</p>']
    for key, d in MX.items():
        cfgs = d['configs']
        h.append(f'<div class="scroll"><table><caption>{key} · {d.get("res", ["?","?"])[0]}×{d.get("res", ["?","?"])[1]} · {d.get("rounds")}×{d.get("n")} frames per config · configs: ' + ' · '.join(f'<b>{c}</b> = {n["note"]}' for c, n in zip(cfgs, d.get('configNotes', [{}] * len(cfgs))) if n) + '</caption>')
        h.append('<thead><tr><th>scene</th>' + ''.join(f'<th class="num">union · {c}</th>' for c in cfgs) + ''.join(f'<th class="num">gather · {c}</th>' for c in cfgs) + ''.join(f'<th class="num">direct · {c}</th>' for c in cfgs) + '<th class="num">A/A %</th></tr></thead><tbody>')
        for sc, r in d['scenes'].items():
            if 'error' in r: h.append(f'<tr><td>{sc}</td><td colspan="{3 * len(cfgs) + 1}" class="bad">{r["error"]}</td></tr>'); continue
            def cells(arr):
                out = []
                base = arr[0] if arr and arr[0] else None
                for i, v in enumerate(arr):
                    if v is None: out.append('<td class="num meh">—</td>'); continue
                    d_ = f' <span class="{ "good" if base and v < base * 0.985 else ("bad" if base and v > base * 1.015 else "meh") }">({(v / base - 1) * 100:+.1f} %)</span>' if i and base else ''
                    out.append(f'<td class="num">{v:.2f}{d_}</td>')
                return ''.join(out)
            h.append(f'<tr><td><b>{sc}</b><br><span class="mut" style="font-size:12px">{(r.get("info") or "")[:90]}</span></td>' + cells(r['union']) + cells(r['gather']) + cells(r['direct']) + f'<td class="num">{r.get("aa")}</td></tr>')
        h.append('</tbody></table></div>')
    return ''.join(h)

def e8_section():
    E = R['e8']
    h = ['<h2 id="e8">5 · The win in detail — E8, tile-coherent stratified gather directions</h2>', f'<p class="lead">{E["lead"]}</p>', f'<p>{E["how"]}</p>']
    h.append('<div class="scroll"><table><caption>Quality: energy and temporal noise of the DENOISED indirect (gi[0], linear) and the final frame, iid vs strata, two takes each · B1 high · 12 still frames per take</caption><thead><tr><th>tile</th><th>take</th><th class="num">gi mean, iid</th><th class="num">gi mean, strata</th><th class="num">gi rel. sd, iid</th><th class="num">gi rel. sd, strata</th><th class="num">LDR sd iid / strata</th></tr></thead><tbody>')
    for row in E['noise']:
        h.append('<tr>' + ''.join(f'<td class="num">{c}</td>' if i > 1 else f'<td>{c}</td>' for i, c in enumerate(row)) + '</tr>')
    h.append('</tbody></table></div>')
    if E.get('raw'):
        h.append('<div class="scroll"><table><caption>…and of the RAW gather output (passes.indirect, before any filtering): the stratification itself</caption><thead><tr><th>tile</th><th class="num">raw rel. sd, iid</th><th class="num">raw rel. sd, strata</th><th class="num">Δ</th></tr></thead><tbody>')
        for row in E['raw']: h.append(f'<tr><td>{row[0]}</td><td class="num">{row[1]}</td><td class="num">{row[2]}</td><td class="num">{pct(row[3], "neg")}</td></tr>')
        h.append('</tbody></table></div>')
    h.append('<h3>Crops (×3, nearest): final frame and indirect-only view, iid vs strata — the same frame count from the same boot state</h3><div class="strip">')
    for name, cap in E['crops']:
        h.append(f'<figure>{img(name)}<figcaption>{cap}</figcaption></figure>')
    h.append('</div>')
    return ''.join(h)

def lossy_section():
    L = R['lossy']
    h = ['<h2 id="lossy">6 · The one lossy row — the men-last occludedT (V4 / V6)</h2>', f'<p>{L["lead"]}</p>']
    if L.get('diff'): h.append('<div class="scroll"><table><thead><tr><th>capture pair (B2, direct-only view)</th><th class="num">max</th><th class="num">mean</th><th class="num">px > 2</th><th class="num">px > 8</th></tr></thead><tbody>' + ''.join(f'<tr><td>{r[0]}</td><td class="num">{r[1]}</td><td class="num">{r[2]}</td><td class="num">{r[3]}</td><td class="num">{r[4]}</td></tr>' for r in L['diff']) + '</tbody></table></div>')
    if L.get('verdict'): h.append(f'<p><b>{L["verdict"]}</b></p>')
    h.append('<div class="strip">' + ''.join(f'<figure>{img(n)}<figcaption>{c}</figcaption></figure>' for n, c in L.get('crops', [])) + '</div>')
    return ''.join(h)

def merge_section():
    M = R['merge']
    h = ['<h2 id="merge">7 · What I would merge, in order</h2><ol class="merge">'] + [f'<li>{x}</li>' for x in M['order']] + ['</ol>']
    h.append('<h2 id="dead">8 · What did not work, and why (as valuable as the win)</h2><ul>' + ''.join(f'<li>{x}</li>' for x in M['dead']) + '</ul>')
    h.append('<h2 id="next">9 · Structural proposals</h2><ul>' + ''.join(f'<li>{x}</li>' for x in M['next']) + '</ul>')
    return ''.join(h)

def page():
    h = [f'<title>{R["title"]}</title>', f'<style>{CSS}</style>', f'<h1>{R["title"]}</h1>', f'<p class="mut">{R["sub"]}</p>', '<div class="tldr"><ul>' + ''.join(f'<li>{x}</li>' for x in R['tldr']) + '</ul></div>',
         profile_section(), ranked_section(), exact_section(), matrix_section(), e8_section(), lossy_section(), merge_section(),
         f'<p class="mut" style="margin-top:40px">{R.get("foot", "")}</p>']
    html = '\n'.join(h)
    open(OUT, 'w').write(html)
    print(f'{OUT}: {len(html) / 1024:.0f} KB')

if __name__ == '__main__':
    page()
