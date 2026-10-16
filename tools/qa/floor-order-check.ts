// EVERY LEVEL'S FLOOR DRAWS IN ORDER (tools/levels/flatLayers.ts layFloor, run by tools/levels/export.ts) — the maintainer, 10-11, on Training 3: "more bad
// zsorting in tutorial level". Two things drawn at the floor in different paint whose top faces share a plane fight for every pixel of their overlap on a GPU,
// and the split moves with the camera: the training ground's gravel court and generator slab over the yard's dirt, all three tops at 4 mm.
//
//   bun run tools/qa/floor-order-check.ts [level.json …] [--verbose]      (probes.ts floororder, also under look; FLOOR_BREAK=1 = asked a metre apart: must fail)
//
// Per level file: of everything drawn whose top face is at the floor, no two of different paint that overlap on the plan have their tops under 0.7 mm apart.
// The sweep itself: a solid finish is raised by growing (its underside stays), a decal is moved whole, a later tier never moves an earlier one, and a level
// already in order is left as it is.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FLAT_STEP, floorClashes, layFloor, type FlatView } from '../levels/flatLayers.ts';

const ROOT = resolve(import.meta.dir, '../..');

export async function floorOrderCheck(): Promise<boolean> {
  const argv = process.argv.slice(2), verbose = argv.includes('--verbose'), BREAK = process.env.FLOOR_BREAK === '1';
  const named = argv.filter(a => a.endsWith('.json')), files = (named.length ? named : readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json')).sort());
  let fails = 0;
  const verdict = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (detail) console.log(`    ${detail}`); };

  // ---- the sweep's own rules, on a made-up floor
  { type B = { id: string; c: [number, number, number]; h: [number, number, number]; albedo: number[]; decal?: boolean; hidden?: boolean };
    const V: FlatView<B> = { paint: b => b.albedo, drawn: b => !b.hidden, decal: b => !!b.decal };
    const slab = (id: string, x: number, w: number, top: number, hh: number, a: number, o: Partial<B> = {}): B => ({ id, c: [x, top - hh, 0], h: [w, hh, 2], albedo: [a, a, a], ...o });
    const top = (b: B) => b.c[1] + b.h[1], under = (b: B) => b.c[1] - b.h[1];
    const dirt = slab('dirt', 0, 10, 0.004, 0.002, 0.3), gravel = slab('gravel', 0, 3, 0.004, 0.002, 0.5), mat = slab('mat', 1, 1, 0.004, 0.002, 0.7, { decal: true });
    const same = slab('same', 6, 1, 0.004, 0.002, 0.3), far = slab('far', 30, 1, 0.004, 0.002, 0.9), ghost = slab('ghost', 0, 2, 0.004, 0.002, 0.1, { hidden: true });
    const n = layFloor([[dirt, gravel, mat, same, far, ghost]], V);
    verdict(n === 2 && Math.abs(top(dirt) - 0.004) < 1e-9 && top(gravel) - top(dirt) >= FLAT_STEP - 1e-9 && top(mat) - top(gravel) >= FLAT_STEP - 1e-9,
      'three paints stacked in one plane come out a step apart, in the order written; the first is not moved', `tops ${[dirt, gravel, mat].map(b => (top(b) * 1000).toFixed(2)).join(' / ')} mm · moved ${n}`);
    verdict(Math.abs(under(gravel)) < 1e-9 && Math.abs(gravel.h[1] * 2 - top(gravel)) < 1e-9, 'a solid finish is raised by growing: its underside stays on the ground', `underside ${(under(gravel) * 1e6).toFixed(0)} µm, thickness ${(gravel.h[1] * 2000).toFixed(2)} mm`);
    verdict(Math.abs(mat.h[1] - 0.002) < 1e-12, 'a decal is moved whole: its thickness is what it was', `half height ${mat.h[1]}`);
    verdict(top(same) === 0.004 && top(far) === 0.004 && top(ghost) === 0.004, 'one of the same paint, one that overlaps nothing and one that is not drawn are left where they were');
    verdict(layFloor([[dirt, gravel, mat, same, far, ghost]], V) === 0 && floorClashes([dirt, gravel, mat, same, far, ghost], V).length === 0, 'a floor already in order is left as it is, and the check finds nothing on it');
    const base = slab('base', 0, 10, 0.004, 0.002, 0.3), rug = slab('rug', 0, 2, 0.004, 0.002, 0.6), b0 = JSON.stringify(base);
    layFloor([[base], [rug]], V);
    verdict(JSON.stringify(base) === b0 && top(rug) - top(base) >= FLAT_STEP - 1e-9, 'tiers: a later tier (lived-in furniture, the dressing) is laid over an earlier one and never moves it', `rug top ${(top(rug) * 1000).toFixed(2)} mm`);
    const lone = slab('lone', 0, 2, 0.004, 0.002, 0.6), l0 = JSON.stringify(lone); layFloor([[], [lone]], V);
    verdict(JSON.stringify(lone) === l0, 'a tier with nothing under it is left as written');
    // one that is FIXED and starts above the flat being raised (a later tier under a finish its own tier raised; a thick threshold; a flat written a hair under a box)
    { const d = slab('d', 0, 10, 0.004, 0.002, 0.3), g = slab('g', 0, 3, 0.004, 0.002, 0.5), r = slab('r', 1, 4, 0.004, 0.002, 0.7, { decal: true });
      layFloor([[d, g], [r]], V);
      const d2 = slab('d2', 0, 10, 0.004, 0.002, 0.3), g2 = slab('g2', 0, 3, 0.004, 0.002, 0.5), sill = slab('sill', 2, 1.5, 0.005, 0.02, 0.8), s0 = JSON.stringify(sill);
      layFloor([[d2, g2, sill]], V);
      const box = slab('box', 0, 2, 0.01, 0.02, 0.2), thin = slab('thin', 0, 1, 0.0098, 0.002, 0.6, { decal: true }), x0 = JSON.stringify(box);
      layFloor([[box], [thin]], V);
      verdict(floorClashes([d, g, r], V).length === 0 && floorClashes([d2, g2, sill], V).length === 0 && JSON.stringify(sill) === s0 && floorClashes([box, thin], V).length === 0 && JSON.stringify(box) === x0 && top(thin) > top(box),
        'a flat raised to within a step under something it cannot move goes over it: a rug over a finish its own tier raised, a finish beside a thick threshold, a decal written a hair under a box',
        `rug ${(top(r) * 1000).toFixed(2)} over ${(top(g) * 1000).toFixed(2)} mm · finish ${(top(g2) * 1000).toFixed(2)} by a ${(top(sill) * 1000).toFixed(2)} mm sill · decal ${(top(thin) * 1000).toFixed(2)} over ${(top(box) * 1000).toFixed(2)} mm`); }
    { const off = slab('off', 0, 2, 0.004127, 0.002, 0.6), o0 = JSON.stringify(off);
      verdict(layFloor([[off]], V) === 0 && JSON.stringify(off) === o0, 'a flat that clashes with nothing is not touched, whatever its height (no rounding of what did not have to move)'); } }

  // ---- every level file
  let levels = 0, pairs = 0; const red: string[] = [];
  for (const f of files) { let L: any; try { L = JSON.parse(readFileSync(resolve(ROOT, 'levels', f), 'utf8')); } catch { continue; }
    if (!Array.isArray(L?.boxes)) continue; levels++;
    const mats = L.materials ?? {}, V: FlatView<any> = { paint: b => b.albedo ?? mats[b.material]?.albedo ?? [0, 0, 0], drawn: b => !(b.flags ?? []).some((x: string) => x === 'NoPrimary' || x === 'Glass'), decal: b => (b.flags ?? []).includes('NoShadow') };
    const cl = BREAK ? floorClashes(L.boxes, V, 1) : floorClashes(L.boxes, V); pairs += cl.length;
    if (cl.length) red.push(`${f}: ${cl.length} (${cl.slice(0, 3).map(([p, q]) => `${p.id} × ${q.id}`).join(', ')})`);
    else if (verbose) console.log(`    ${f}: in order`); }
  verdict(pairs === 0 && levels > 0, `in each of the ${levels} level files, no two things drawn at the floor in different paint that overlap have their top faces under ${(FLAT_STEP * 1000).toFixed(1)} mm apart: the picture can order them (${pairs} pairs cannot)`, red.slice(0, 12).join('\n    '));
  console.log(fails ? `=== floor-order-check: ${fails} FAIL ===` : '=== floor-order-check: ALL PASS ===');
  return fails === 0;
}
if (import.meta.main) process.exit((await floorOrderCheck()) ? 0 : 1);
