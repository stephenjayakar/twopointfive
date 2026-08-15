#!/usr/bin/env python3
"""GI-IN-MOTION lane: tables from the harness's dumps (docs/perf/gim-<tag>.json, tools/qa/gi-motion.js `run`).
   python3 tools/qa/gim-report.py [--tier h] [--scene s1] [--view 0] [--tiles unlit,unlitAisle,...] [--json out.json]
Tags are '<tier>_<variant>' (h = high ref framing, hm = high at the designer's 1024x1000, u / m / l / v = the other tiers). Prints, per scene / view,
one row per variant: per tile  sd (rel %)  |Δ|  boil  size — and the GI-share table (composite with vs without the GI term)."""
import json, glob, os, sys, argparse

ap = argparse.ArgumentParser()
ap.add_argument('--dir', default=os.path.join(os.path.dirname(__file__), '../../docs/perf'))
ap.add_argument('--tier', default=None, help='tag prefix before the first underscore (h, hm, u, m, l, v)')
ap.add_argument('--scene', default=None); ap.add_argument('--view', default=None)
ap.add_argument('--tiles', default=None); ap.add_argument('--json', default=None)
ap.add_argument('--order', default='old,main,noTaaMot,g2,A085,A1,A1g,B,B2,B3,C,C2,BC,B2C,B2C2,A1gBC,A085BC,final')
a = ap.parse_args()

runs = {}
for f in sorted(glob.glob(os.path.join(a.dir, 'gim-*.json'))):
    try: d = json.load(open(f))
    except Exception as e: print('skip', f, e); continue
    tag = d.get('tag') or os.path.basename(f)[4:-5]
    if tag in runs and runs[tag].get('t0', 0) > d.get('t0', 0): continue
    runs[tag] = d
if not runs: print('no gim-*.json in', a.dir); sys.exit(1)

def tier_of(tag): return tag.split('_', 1)[0]
def var_of(tag): return tag.split('_', 1)[1] if '_' in tag else tag
tiers = sorted({tier_of(t) for t in runs}) if not a.tier else [a.tier]
order = a.order.split(',')
def vkey(v): return (order.index(v) if v in order else 99, v)

out = {}
for tier in tiers:
    tags = sorted([t for t in runs if tier_of(t) == tier], key=lambda t: vkey(var_of(t)))
    scenes = sorted({k for t in tags for k in runs[t]['scenes'] if not k.endswith('share')})
    if a.scene: scenes = [s for s in scenes if s.startswith(a.scene)]
    if a.view is not None: scenes = [s for s in scenes if s.endswith('v' + a.view)]
    res = runs[tags[0]].get('applied', {}).get('res')
    print(f"\n=== tier '{tier}' ({runs[tags[0]].get('q')} · {runs[tags[0]].get('framing')} · {res}) — {len(tags)} variants ===")
    out[tier] = {}
    for sc in scenes:
        tiles = None
        for t in tags:
            m = runs[t]['scenes'].get(sc)
            if m and m.get('tiles'): tiles = [k for k, v in m['tiles'].items() if not v.get('error')]; break
        if not tiles: continue
        if a.tiles: tiles = [x for x in a.tiles.split(',') if x in tiles]
        pan = next((runs[t]['scenes'][sc].get('camPan') for t in tags if sc in runs[t]['scenes'] and runs[t]['scenes'][sc].get('camPan')), None)
        print(f"\n-- {sc}{f' (pan {pan} px/f)' if pan else ''}: per tile  sd abs (rel %) · |Δ| · boil · size px")
        print('   ' + 'variant'.ljust(10) + ''.join(f"{tl[:15]:>36}" for tl in tiles))
        out[tier][sc] = {}
        for t in tags:
            m = runs[t]['scenes'].get(sc)
            if not m: continue
            row = '   ' + var_of(t).ljust(10); rec = {}
            for tl in tiles:
                x = m['tiles'].get(tl)
                if not x or x.get('error'): row += f"{'—':>36}"; continue
                row += f"{x['sdAbs']:>9.3f} ({x['sdRel']*100:4.1f}%) {x['absDelta']:.2f} {x['boil']:5.2f} {x['sizePx'] or 0:4.1f}"
                rec[tl] = {k: x.get(k) for k in ('sdAbs', 'sdRel', 'sdLow', 'absDelta', 'boil', 'sizePx', 'meanL', 'coverage')}
            print(row); out[tier][sc][var_of(t)] = rec
        # GI share table for composite scenes
        base = sc[:-2] if sc.endswith('v0') else None
        if base and any((base + 'share') in runs[t]['scenes'] for t in tags):
            print(f"   {'(GI share)':10}" + ''.join(f"{'sd with/without GI → gi sd (var %)':>36}" for _ in tiles[:1]))
            for t in tags:
                sh = runs[t]['scenes'].get(base + 'share')
                if not sh: continue
                row = '   ' + var_of(t).ljust(10)
                for tl in tiles:
                    x = sh.get(tl)
                    row += f"{'—':>36}" if not x else f"{x['sdWithGi']:>10.3f}/{x['sdNoGi']:.3f} → {x['giSd']:.3f} ({x['giShareVar']*100:3.0f}%)".rjust(36)
                print(row)
                out[tier][sc].setdefault(var_of(t), {})['_share'] = sh
if a.json:
    json.dump(out, open(a.json, 'w'), indent=1); print('\n→', a.json)
