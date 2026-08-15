#!/usr/bin/env python3
"""IMAGE-QUALITY program — offline tables from the pane's dumps (docs/perf/iq-<tag>.json from tools/qa/iq-harness.js batteries, docs/perf/chaos-*.json from
tools/qa/chaos-scenes.js, docs/perf/sharp-metrics.json from sharp-metrics.py). Tags are '<tier letter>_<variant>' (u/h/m/l/v = ultra … verylow).

  python3 tools/qa/iq-report.py                 every table (markdown) to stdout
  python3 tools/qa/iq-report.py --json out.json also the reduced numbers as one JSON (the page builder reads it)
"""
import sys, os, json, glob, math

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PERF = os.path.join(ROOT, 'docs/perf')
TIERS = {'u': 'ultra', 'h': 'high', 'm': 'medium', 'l': 'low', 'v': 'verylow'}

def load_iq():
    """every iq-<tag>[.<parts>].json, merged per tag in file-mtime order (later parts refresh earlier ones key by key)"""
    out = {}
    files = sorted(glob.glob(os.path.join(PERF, 'iq-*.json')), key=os.path.getmtime)
    for f in files:
        try:
            d = json.load(open(f))
        except Exception:
            continue
        tag = d.get('tag') or os.path.basename(f)[3:-5].split('.')[0]
        cur = out.setdefault(tag, {})
        for k, v in d.items():
            if v is not None: cur[k] = v
    return out

def med(a):
    b = sorted(x for x in a if x is not None and not (isinstance(x, float) and math.isnan(x)))
    return b[len(b) // 2] if b else None
def mean(a):
    b = [x for x in a if x is not None and not (isinstance(x, float) and math.isnan(x))]
    return sum(b) / len(b) if b else None
def fmt(v, nd=2):
    return '—' if v is None else (f'{v:.{nd}f}' if isinstance(v, (int, float)) else str(v))

def edge_rows(d, mode):
    """→ {edgeName: (width, posSd, bandGeoSd)} over v3 + v1"""
    out = {}
    for view in ('v3', 'v1'):
        c = (d.get(mode) or {}).get(view)
        if not c: continue
        for n, e in c['edges'].items():
            out[n] = (e.get('widthMotion'), e.get('posSd'), e.get('bandGeoSd'))
    return out

def reduce_tag(d):
    """the frontier row for one battery result"""
    r = {'tag': d.get('tag'), 'variant': d.get('variant'), 'q': d.get('q'), 'desc': d.get('desc')}
    m = edge_rows(d, 'crawl'); s = edge_rows(d, 'still')
    box = ['partTop', 'partTopN', 'kbFar', 'kbTop', 'deskFront']
    r['edgesMotion'] = m; r['edgesStill'] = s
    r['wMotion'] = med([m[n][0] for n in box if n in m]); r['wStill'] = med([s[n][0] for n in box if n in s])
    r['crawl'] = mean([m[n][1] for n in box if n in m]); r['crawlStill'] = mean([s[n][1] for n in box if n in s])
    r['band'] = mean([m[n][2] for n in box if n in m])
    t = lambda mode, view, tile: (((d.get(mode) or {}).get(view) or {}).get('tiles') or {}).get(tile, {}).get('hpMean')
    r['contactStill'] = (s.get('kbShadow') or [None])[0]; r['contactMotion'] = (m.get('kbShadow') or [None])[0]
    r['hpDeskMotion'] = t('crawl', 'v3', 'desk'); r['hpDeskStill'] = t('still', 'v3', 'desk')
    r['hpLitMotion'] = t('crawl', 'v1', 'litDesk'); r['hpLitStill'] = t('still', 'v1', 'litDesk')
    r['hpPenMotion'] = t('crawl', 'v3', 'penumbra'); r['hpPenStill'] = t('still', 'v3', 'penumbra')
    nz = d.get('noise') or {}
    tiles = nz.get('tiles') or {}
    g = lambda v, tl: (tiles.get(v) or {}).get(tl, {}).get('sd')
    gl = lambda v, tl: (tiles.get(v) or {}).get(tl, {}).get('sdLow')
    r['noise'] = {'v1foot': g('v1', 'footPenumbra'), 'v1lit': g('v1', 'litDesk'), 'v1kb': g('v1', 'kbContact'), 'v3desk': g('v3', 'desk'), 'v3chair': g('v3', 'chairPen'), 'v3carpet': g('v3', 'carpet'),
                  'cubDesk': g('cub', 'deskLit'), 'cubChair': g('cub', 'chairPen'), 'cubFloor': g('cub', 'midFloor'), 'corLino': g('cor', 'lino'), 'corShadow': g('cor', 'cabShadow'), 'vendLino': g('brk', 'vendLino'), 'farLino': g('brk', 'farLino'), 'vendFront': g('brk', 'vendFront')}
    r['noiseLow'] = {'v1foot': gl('v1', 'footPenumbra'), 'v1kb': gl('v1', 'kbContact'), 'v3desk': gl('v3', 'desk'), 'v3chair': gl('v3', 'chairPen'), 'cubChair': gl('cub', 'chairPen'), 'cubFloor': gl('cub', 'midFloor'), 'corShadow': gl('cor', 'cabShadow'), 'vendLino': gl('brk', 'vendLino'), 'farLino': gl('brk', 'farLino')}
    r['deskGrain'] = nz.get('deskGrain'); r['rugN'] = nz.get('rugN'); r['floorGlass'] = nz.get('floorGlass')
    dy = d.get('dyn') or {}
    r['dyn'] = {'A': dy.get('A'), 'B': dy.get('B'), 'C': dy.get('C')}
    c = d.get('cost') or {}
    r['cost'] = {'union': c.get('unionMed'), 'p95': c.get('unionP95'), 'sum': c.get('sumMed'), 'wall': c.get('wallMed'), 'res': c.get('res'), 'passes': c.get('passes')}
    r['ms'] = d.get('ms'); r['errs'] = len(d.get('errs') or [])
    return r

def table_sharp(rows):
    rows = [r for r in rows if r.get('wStill') is not None or r.get('wMotion') is not None]
    print('\n### Sharpness + crawl (edge-following, 20-frame 0.3°/frame orbit; widths = 10–90 % px, median of the five box edges; crawl = mean temporal sd of the edge position, px; hp = high-pass RMS of the desk tiles)\n')
    print('| tag | variant | width still | width MOTION | crawl motion (still) | band sd | desk hp still → motion | lit-desk hp still → motion | penumbra hp motion | contact still / motion |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    for r in rows:
        print(f"| {r['tag']} | {r['variant']} | {fmt(r['wStill'])} | {fmt(r['wMotion'])} | {fmt(r['crawl'],3)} ({fmt(r['crawlStill'],3)}) | {fmt(r['band'],3)} | {fmt(r['hpDeskStill'])} → {fmt(r['hpDeskMotion'])} | {fmt(r['hpLitStill'])} → {fmt(r['hpLitMotion'])} | {fmt(r['hpPenMotion'])} | {fmt(r.get('contactStill'))} / {fmt(r.get('contactMotion'))} |")
    print('\nPer edge (width motion / crawl):\n')
    names = ['partTop', 'partTopN', 'kbFar', 'kbTop', 'deskFront']
    print('| tag | ' + ' | '.join(names) + ' | still: ' + ' | '.join(names) + ' |')
    print('|---|' + '---|' * (2 * len(names)))
    for r in rows:
        m, s = r['edgesMotion'], r['edgesStill']
        print(f"| {r['tag']} | " + ' | '.join(f"{fmt(m[n][0])} / {fmt(m[n][1],2)}" if n in m else '—' for n in names) + ' | ' + ' | '.join(f"{fmt(s[n][0])}" if n in s else '—' for n in names) + ' |')

def table_noise(rows):
    rows = [r for r in rows if any(v is not None for v in r['noise'].values()) or r.get('deskGrain')]
    if not rows: return
    print('\n### Noise (temporal sd of 8-bit luma over 30 still frames per tile; desk grain = tjank scene A sq4 sd within the lit / dim level; floorGlass = tjank scene D lamp-lit floor)\n')
    keys = ['v1foot', 'v1lit', 'v1kb', 'v3desk', 'v3chair', 'v3carpet', 'cubDesk', 'cubChair', 'cubFloor', 'corLino', 'corShadow', 'vendLino', 'farLino', 'vendFront']
    print('| tag | ' + ' | '.join(keys) + ' | desk grain lit / dim | rugN lit / dim | floorGlass sd |')
    print('|---|' + '---|' * (len(keys) + 3))
    for r in rows:
        dg = r.get('deskGrain') or {}; rg = r.get('rugN') or {}; fg = r.get('floorGlass') or {}
        print(f"| {r['tag']} | " + ' | '.join(fmt(r['noise'].get(k), 3) for k in keys) + f" | {fmt(dg.get('lit'),2)} / {fmt(dg.get('dim'),2)}{' st' if dg.get('steady') else ''} | {fmt(rg.get('lit'),2)} / {fmt(rg.get('dim'),2)} | {fmt(fg.get('sd'),3)} \u0394{fmt(fg.get('absDelta'),3)} |")
    lk = ['v1foot', 'v1kb', 'v3desk', 'v3chair', 'cubChair', 'cubFloor', 'corShadow', 'vendLino', 'farLino']
    if any((r.get('noiseLow') or {}).get('v1foot') is not None for r in rows):
        print('\nLow-frequency part (sd of an 8-frame running mean per pixel — crawl / drifting blotches; frame-to-frame grain averages out):\n')
        print('| tag | ' + ' | '.join(lk) + ' |'); print('|---|' + '---|' * len(lk))
        for r in rows:
            nl = r.get('noiseLow') or {}
            if nl.get('v1foot') is None: continue
            print(f"| {r['tag']} | " + ' | '.join(fmt(nl.get(k), 3) for k in lk) + ' |')

def table_dyn(rows):
    rows = [r for r in rows if r['dyn'].get('A')]
    if not rows: return
    print('\n### Dynamic lights (tjank A game pattern rugN lit / dim mean · noise; B flash frame / second stroke / desks; C haze mid-sweep frames 24‥34)\n')
    print('| tag | A rugN lit / dim | A rugN sd lit / dim | A desk lit / dim | B floorGlass flash / 2nd | B desks flash | C haze 24 26 28 30 32 34 |')
    print('|---|---|---|---|---|---|---|')
    for r in rows:
        A, B, C = r['dyn']['A'], r['dyn'].get('B') or {}, r['dyn'].get('C') or {}
        print(f"| {r['tag']} | {fmt(A['rugN']['lit'],1)} / {fmt(A['rugN']['dim'],1)} | {fmt(A['rugN']['sdLit'],2)} / {fmt(A['rugN']['sdDim'],2)} | {fmt(A['desk']['lit'],1)} / {fmt(A['desk']['dim'],1)} | {fmt(B.get('flash'),1)} / {fmt(B.get('second'),1)} | {fmt(B.get('desksFlash'),1)} | {' '.join(fmt(x,1) for x in (C.get('hazeMid') or []))} |")

def table_cost(rows):
    rows = [r for r in rows if r['cost'].get('union') is not None]
    if not rows: return
    print('\n### Calm cost (cubicles still, serialized offscreen renders; union of compute passes med / p95, Σ, wall; per-pass medians)\n')
    print('| tag | res | ∪ med | ∪ p95 | Σ | wall | direct | softblur | gather | temporal | reflect+rdenoise | volFroxel+vol | sharpU+compS | gbaa | taau |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for r in rows:
        c = r['cost']; p = c.get('passes') or {}
        g = lambda k: p.get(k) or 0
        print(f"| {r['tag']} | {c.get('res')} | {fmt(c['union'])} | {fmt(c['p95'])} | {fmt(c['sum'])} | {fmt(c['wall'])} | {fmt(g('direct'))} | {fmt(g('softblur'))} | {fmt(g('gather'))} | {fmt(g('temporal'))} | {fmt(g('reflect')+g('rdenoise'))} | {fmt(g('volFroxel')+g('volumetrics'))} | {fmt(g('sharpU')+g('compS'))} | {fmt(g('gbaa'))} | {fmt(g('taau'))} |")

def load_chaos():
    out = {}
    for f in sorted(glob.glob(os.path.join(PERF, 'chaos-*.json'))):
        try: out[os.path.basename(f)[6:-5]] = json.load(open(f))
        except Exception: pass
    return out

def table_chaos(ch):
    if not ch: return
    print('\n### Fast physics (chaos scenes; lag = frames after the truth settled until the pixel reaches its own final value, over swept receiver pixels; residue = |own final − value| N frames after the truth settled, 8-bit levels; boil = temporal sd of never-swept receivers)\n')
    print('| dump | scene | variant | res | swept px | lag mean / p90 / max (frames) | trail px (px per m/s @ m/s) | residue +1 / +2 / +4 / +8 | boil static | onObj | cost ∪ mean / p95 · direct · gbuffer |')
    print('|---|---|---|---|---|---|---|---|---|---|---|')
    for name, d in ch.items():
        for key, byVar in d.items():
            for v, o in byVar.items():
                for rn, m in (o.get('metrics') or {}).items():
                    res = m.get('residue') or {}
                    c = o.get('cost') or {}
                    cost = f"{fmt((c.get('union') or {}).get('mean'))} / {fmt((c.get('union') or {}).get('p95'))} · {fmt((c.get('direct') or {}).get('mean'))} · {fmt((c.get('gbuffer') or {}).get('mean'))}" if c else ''
                    print(f"| {name} | {key}:{rn} | {v} | {o.get('res')} | {m.get('swept')} | {fmt(m.get('lagMean'))} / {m.get('lagP90')} / {m.get('lagMax')} | {fmt(m.get('trailPx'),1)} ({fmt(m.get('trailPxPerMps'),2)} @ {fmt(m.get('speed'),1)}) | {fmt(res.get('1'))} / {fmt(res.get('2'))} / {fmt(res.get('4'))} / {fmt(res.get('8'))} | {fmt(m.get('boilStatic'),3)} | {fmt(m.get('onObjMean'))} | {cost} |")

def main(argv):
    iq = load_iq()
    rows = [reduce_tag(d) for d in iq.values()]
    order = {'u': 0, 'h': 1, 'm': 2, 'l': 3, 'v': 4}
    rows.sort(key=lambda r: (order.get((r['tag'] or 'z')[0], 9), r['tag']))
    table_sharp(rows); table_noise(rows); table_dyn(rows); table_cost(rows)
    ch = load_chaos(); table_chaos(ch)
    if '--json' in argv:
        out = argv[argv.index('--json') + 1]
        json.dump({'rows': rows, 'chaos': ch}, open(out, 'w'), indent=1)
        print(f'\n→ {out}')
    return 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
