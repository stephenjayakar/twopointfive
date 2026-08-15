#!/usr/bin/env python3
"""Bradley–Terry fit of the smoke battery's blind-pair judgments (tools/qa/smoke-pref.html → docs/perf/<name>.jsonl).

  python3 tools/qa/smoke-pref-fit.py [docs/perf/smoke-pref.jsonl] [--scene S1] [--boot 200]

Per scene and pooled: strength per variant (log scale, base = 0), P(beats base), win share, 90 % bootstrap interval, and the 'why' lines grouped by the
loser of each pair. Ties count half a win each way. The MM algorithm (Hunter 2004) — no dependencies."""
import json, sys, math, random, collections

def load(path, scene=None):
    rows = []
    for line in open(path):
        line = line.strip()
        if not line: continue
        try: r = json.loads(line)
        except Exception: continue
        if scene and r.get('scene') != scene: continue
        rows.append(r)
    return rows

def bt_fit(rows, iters=200):
    items = sorted({v for r in rows for v in (r['Lv'], r['Rv'])})
    idx = {v: i for i, v in enumerate(items)}
    n = len(items)
    W = [[0.0] * n for _ in range(n)]          # W[i][j] = wins of i over j
    for r in rows:
        a, b = idx[r['Lv']], idx[r['Rv']]
        if r.get('pick') == 'L': W[a][b] += 1
        elif r.get('pick') == 'R': W[b][a] += 1
        else: W[a][b] += 0.5; W[b][a] += 0.5
    p = [1.0] * n
    for _ in range(iters):
        newp = []
        for i in range(n):
            wi = sum(W[i]); den = 0.0
            for j in range(n):
                if i == j: continue
                nij = W[i][j] + W[j][i]
                if nij: den += nij / (p[i] + p[j])
            newp.append((wi + 1e-3) / den if den else p[i])   # (+ε: an unbeaten / never-winning variant stays finite)
        s = sum(newp); p = [x * n / s for x in newp]
    return items, p, W

def report(rows, title, boot=200):
    if not rows: print(f'\n== {title}: no judgments'); return
    items, p, W = bt_fit(rows)
    base = items.index('base') if 'base' in items else None
    # bootstrap
    rs = random.Random(1); boots = collections.defaultdict(list)
    for _ in range(boot):
        samp = [rows[rs.randrange(len(rows))] for _ in rows]
        it2, p2, _ = bt_fit(samp, iters=100)
        m = dict(zip(it2, p2)); ref = m.get('base', 1.0)
        for v in items: boots[v].append(math.log(max(m.get(v, 1e-6), 1e-6) / max(ref, 1e-6)))
    print(f'\n== {title}: {len(rows)} judgments, {len(items)} variants')
    print(f"{'variant':<12} {'strength':>9} {'90% CI':>17} {'P(>base)':>9} {'wins/games':>11}")
    ref = p[base] if base is not None else 1.0
    order = sorted(range(len(items)), key=lambda i: -p[i])
    for i in order:
        v = items[i]; s = math.log(p[i] / ref)
        b = sorted(boots[v]); lo, hi = b[int(0.05 * len(b))], b[int(0.95 * len(b)) - 1]
        pb = p[i] / (p[i] + ref) if base is not None else float('nan')
        wins = sum(W[i]); games = sum(W[i][j] + W[j][i] for j in range(len(items)))
        print(f'{v:<12} {s:>+9.2f} [{lo:+6.2f}, {hi:+6.2f}] {pb:>9.2f} {wins:>5.1f}/{games:<5.0f}')
    whys = collections.defaultdict(list)
    for r in rows:
        if r.get('why'):
            loser = r['Rv'] if r.get('pick') == 'L' else r['Lv'] if r.get('pick') == 'R' else f"{r['Lv']}={r['Rv']}"
            whys[loser].append(f"[{r['scene']}] {r['why']}  (vs {r.get('winner') or 'tie'})")
    if whys:
        print('\n  why, by loser:')
        for k, v in whys.items():
            print(f'  {k}:'); [print('    - ' + x) for x in v]

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    path = args[0] if args else 'docs/perf/smoke-pref.jsonl'
    scene = sys.argv[sys.argv.index('--scene') + 1] if '--scene' in sys.argv else None
    boot = int(sys.argv[sys.argv.index('--boot') + 1]) if '--boot' in sys.argv else 200
    rows = load(path, scene)
    scenes = sorted({r['scene'] for r in rows})
    for sc in scenes: report([r for r in rows if r['scene'] == sc], f'scene {sc}', boot)
    if len(scenes) > 1: report(rows, 'pooled', boot)
