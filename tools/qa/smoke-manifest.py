#!/usr/bin/env python3
"""Rebuild docs/shots/clips/sb_manifest.json from the clips on disk (the pairs page's deck source).
Routing: `aug9` and `r_*` clips (main on the pre-markings office) go to the ANCHOR decks S#r (paired only with each other — the fair
cross-build comparison); everything else stays in its scene; G* scenes are the glass decks. Incomplete clips are skipped."""
import json, os, glob, sys
root = sys.argv[1] if len(sys.argv) > 1 else 'docs/shots/clips'
clips, scenes, variants = [], {}, {}
for meta in sorted(glob.glob(f'{root}/sb_*__*/meta.json')):
    m = json.load(open(meta)); d = os.path.dirname(meta); n = len(glob.glob(d + '/f*.jpg'))
    if n < m.get('frames', 1) or m['variant'] == 'rectest': continue
    v, sc = m['variant'], m['scene']
    if v == 'aug9' or v.startswith('r_'): sc = sc + 'r'
    vname = v[2:] + '·relief' if v.startswith('r_') else v
    clips.append({'clip': m['clip'], 'scene': sc, 'variant': vname, 'frames': n, 'build': m.get('build', 'main')})
    scenes.setdefault(m['scene'], m.get('title', ''))
    if sc != m['scene']: scenes[sc] = scenes.get(m['scene'], m.get('title', '')) + ' — ANCHOR deck: the Aug-9 build vs main on the pre-markings office'
    variants[vname] = m.get('note', '') or variants.get(vname, '')
variants['aug9'] = 'the Aug-9 build (main @773d73f, pre-renderer-v3) on the identical staging'
json.dump({'fps': 30, 'scenes': scenes, 'variants': variants, 'clips': clips}, open(f'{root}/sb_manifest.json', 'w'), indent=1)
by = {}
for c in clips: by.setdefault(c['scene'], []).append(c['variant'])
for k in sorted(by): print(f'{k}: {", ".join(by[k])}')
