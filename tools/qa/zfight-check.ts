// FACES THAT FLICKER, ASKED OF A LEVEL FILE — two boxes the picture draws, each with a face in ONE plane, facing the same way, over a shared patch that nothing
// covers. The depth test has no way to choose between them, so the patch flips from one box's paint to the other's as the camera moves (the maintainer, on a GPU:
// "a sorting issue that's flickering to right of the red door": the pass's gate post, whose side lies exactly in the end face of the yard wall it closes).
// Read off the level FILES: no game is stood up, nothing is drawn.
//   bun run tools/qa/zfight-check.ts [name …] [--all] [--json out.json] [--quiet]
//     name      levels to ask (levels/<name>.json); none = every level file
//     --all     list every pair (the default lists the twelve biggest patches of a level)
//     --quiet   the FAIL lines and the tally only
//   ZFIGHT_BREAK=1 bun run tools/qa/zfight-check.ts    the red path: three pairs are planted in a level made here (in memory) and each verdict must be the
//               one expected: exit 1 = every planted pair was read right, 0 = one was MISSED (the line says which)
// exit 0 = no SEEN pair · 1 = a SEEN pair · 2 = no such level
// WHAT IS A PAIR: two boxes the depth buffer holds (no `NoPrimary`, no `Glass`: a pane is drawn by its own pass, over the picture), standing at ONE angle
//   (their yaws a whole number of quarter turns apart: a turned room's boxes are asked among themselves), a face each within EPS of one plane with the same
//   outward normal, the faces overlapping by more than a finger each way. A tilted box (`rot`) is not asked, and the count says how many were left out.
//   Never the undersides (−y: no camera of the game looks up from under the floor).
// ITS VERDICT:
//   seen    the two are drawn differently (another material, paint, glow, gloss or markings) and part of the patch is open: a player can watch it flicker.
//           FAILS the check. The mend is the level's: sink one face a few millimetres, or end one box at the other.
//   same    the two are drawn alike, so today's picture shows nothing. A NOTE: a look that paints a box by its own size or place (the look prototype's
//           plinth and weather) makes it flicker.
//   covered a third drawn box lies against the whole patch (asked a point every 10 cm, 2 mm off the plane). Counted, not listed.
// NOT ASKED: doors' leaves, loose props and what a blast leaves (they move); tilted boxes; the TOPS of two boxes at different angles; a face a hair behind
//   another (it is hidden, it does not flicker).
import { resolve, basename } from 'node:path';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '../..');
/** two planes nearer than this are one to a depth buffer at the game's camera (half a millimetre) */
export const EPS = 5e-4;
/** a patch thinner than this either way is no patch (a finger) */
const MIN = 0.01;
/** how far off the plane a covering box is looked for, and the grid the patch is asked on (a point every STEP, no more than GRID a side) */
const OUT = 0.002, STEP = 0.1, GRID = 32;

interface FileBox { id?: string; group?: string; c: number[]; h: number[]; yaw?: number; rot?: unknown; flags?: string[]; material?: string; albedo?: number[]; emissive?: unknown; metal?: number; rough?: number; markings?: unknown }
export interface Pair { a: string; b: string; /** the angle the two stand at, in degrees (0 = square to the world: `axis` and `plane` are then the world's) */ turn: number; groupA: string; groupB: string; axis: 'x' | 'y' | 'z'; sign: '+' | '-'; plane: number; at: [number, number, number]; size: [number, number]; verdict: 'seen' | 'same' | 'covered' }
export interface ZRead { boxes: number; turned: number; pairs: Pair[] }

/** a box as it is asked: where it is in the world, and in the FRAME of its own angle (the world turned by its yaw less whole quarter turns, in which it stands
 *  square: two boxes at one angle share a frame, and a quarter turn swaps a box's x and z) */
interface Asked { b: FileBox; i: number; c: number[]; h: number[]; cs: number; sn: number; f: number; fc: number[]; fh: number[] }
const QUARTER = Math.PI / 2;
function asked(b: FileBox, i: number): Asked {
  const yaw = b.yaw ?? 0, q = Math.round(yaw / QUARTER); let f = yaw - q * QUARTER, r = q; if (f < -1e-4) { f += QUARTER; r--; } if (Math.abs(f) < 1e-4) f = 0;
  const cf = Math.cos(f), sf = Math.sin(f);
  return { b, i, c: b.c, h: b.h, cs: Math.cos(yaw), sn: Math.sin(yaw), f, fc: [cf * b.c[0] - sf * b.c[2], b.c[1], sf * b.c[0] + cf * b.c[2]], fh: r % 2 ? [b.h[2], b.h[1], b.h[0]] : b.h };
}
/** what the picture paints a box with, as one string: two boxes that differ here show which of them won the pixel */
const paint = (b: FileBox) => JSON.stringify([b.material ?? '', b.albedo ?? null, b.emissive ?? null, b.metal ?? null, b.rough ?? null, (b.flags ?? []).includes('Gloss'), b.markings ?? null]);

export function zfight(data: { boxes?: FileBox[] }): ZRead {
  const all = data.boxes ?? [], drawn: Asked[] = []; let turned = 0;
  all.forEach((b, i) => { if ((b.flags ?? []).some(f => f === 'NoPrimary' || f === 'Glass') || !b.c || !b.h) return; if (b.rot != null) { turned++; return; } if (b.h[0] <= 0 || b.h[1] <= 0 || b.h[2] <= 0) return; drawn.push(asked(b, i)); });
  // (a point of the world inside a third drawn box, each by its own angle)
  const inside = (p: number[], skip: number[]) => drawn.some(d => { if (skip.includes(d.i) || Math.abs(p[1] - d.c[1]) >= d.h[1]) return false; const dx = p[0] - d.c[0], dz = p[2] - d.c[2]; return Math.abs(d.cs * dx - d.sn * dz) < d.h[0] && Math.abs(d.sn * dx + d.cs * dz) < d.h[2]; });
  const pairs: Pair[] = [], AX = ['x', 'y', 'z'] as const;
  for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) {
    const A0 = drawn[i], B0 = drawn[j]; if (Math.abs(A0.f - B0.f) > 1e-4) continue;   // (two angles: no side of one lies in a side of the other, and their tops are not asked)
    const A = { i: A0.i, b: A0.b, c: A0.fc, h: A0.fh }, B = { i: B0.i, b: B0.b, c: B0.fc, h: B0.fh }, cf = Math.cos(A0.f), sf = Math.sin(A0.f);
    if (Math.abs(A.c[0] - B.c[0]) > A.h[0] + B.h[0] + EPS || Math.abs(A.c[1] - B.c[1]) > A.h[1] + B.h[1] + EPS || Math.abs(A.c[2] - B.c[2]) > A.h[2] + B.h[2] + EPS) continue;
    for (let a = 0; a < 3; a++) for (const sgn of [1, -1]) {
      if (a === 1 && sgn < 0) continue;   // (the undersides)
      const pa = A.c[a] + sgn * A.h[a], pb = B.c[a] + sgn * B.h[a]; if (Math.abs(pa - pb) > EPS) continue;
      const o = [0, 1, 2].filter(k => k !== a), lo: number[] = [], hi: number[] = [];
      for (const k of o) { lo.push(Math.max(A.c[k] - A.h[k], B.c[k] - B.h[k])); hi.push(Math.min(A.c[k] + A.h[k], B.c[k] + B.h[k])); }
      if (hi[0] - lo[0] <= MIN || hi[1] - lo[1] <= MIN) continue;
      // is any of the patch open: a point a hair outside the plane that no third drawn box holds
      let open = false; const nu = Math.min(GRID, Math.max(3, Math.ceil((hi[0] - lo[0]) / STEP))), nv = Math.min(GRID, Math.max(3, Math.ceil((hi[1] - lo[1]) / STEP)));
      for (let u = 0; u < nu && !open; u++) for (let v = 0; v < nv && !open; v++) {
        const p = [0, 0, 0]; p[a] = (sgn > 0 ? Math.max(pa, pb) : Math.min(pa, pb)) + sgn * OUT; p[o[0]] = lo[0] + (hi[0] - lo[0]) * (u + 0.5) / nu; p[o[1]] = lo[1] + (hi[1] - lo[1]) * (v + 0.5) / nv;
        if (!inside([cf * p[0] + sf * p[2], p[1], -sf * p[0] + cf * p[2]], [A.i, B.i])) open = true;
      }
      const fa = [0, 0, 0]; fa[a] = pa; fa[o[0]] = (lo[0] + hi[0]) / 2; fa[o[1]] = (lo[1] + hi[1]) / 2; const at = [cf * fa[0] + sf * fa[2], fa[1], -sf * fa[0] + cf * fa[2]];
      pairs.push({ a: A.b.id ?? `#${A.i}`, b: B.b.id ?? `#${B.i}`, groupA: A.b.group ?? '?', groupB: B.b.group ?? '?', turn: +(A0.f * 180 / Math.PI).toFixed(1), axis: AX[a], sign: sgn > 0 ? '+' : '-', plane: +pa.toFixed(4),
        at: at.map(x => +x.toFixed(2)) as [number, number, number], size: [+(hi[0] - lo[0]).toFixed(3), +(hi[1] - lo[1]).toFixed(3)], verdict: !open ? 'covered' : paint(A.b) === paint(B.b) ? 'same' : 'seen' });
    }
  }
  pairs.sort((x, y) => y.size[0] * y.size[1] - x.size[0] * x.size[1]);
  return { boxes: drawn.length, turned, pairs };
}

if (import.meta.main) {
  const args = process.argv.slice(2), flag = (n: string) => args.includes(n), val = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  if (process.env.ZFIGHT_BREAK === '1') {
    // a wall along x with a post in its end (seen), a second length of the same wall laid over its top (same), and the first pair again under a cap (covered)
    const wall = (id: string, c: number[], h: number[], material = 'mud'): FileBox => ({ id, c, h, material });
    const level = { boxes: [wall('wall', [5, 1.2, 0], [5, 1.2, 0.12]), wall('post', [9.83, 1.25, 0], [0.17, 1.25, 0.17], 'render'), wall('twin', [3, 1.2, 0], [2, 1.2, 0.12]),
      wall('wall2', [5, 1.2, 9], [5, 1.2, 0.12]), wall('post2', [9.83, 1.2, 9], [0.17, 1.2, 0.17], 'render'), wall('cap', [10.3, 1.2, 9], [0.3, 1.3, 0.5], 'stone'),
      { ...wall('hid', [5, 1.2, 4], [5, 1.2, 0.12]), flags: ['NoPrimary'] }, wall('hidpost', [9.83, 1.25, 4], [0.17, 1.25, 0.17], 'render'), { ...wall('skew', [20, 1.2, 6], [3, 1.2, 0.12]), yaw: 0.4 }, { ...wall('skewpost', [20 + 2.83 * Math.cos(0.4), 1.25, 6 - 2.83 * Math.sin(0.4)], [0.17, 1.25, 0.17], 'render'), yaw: 0.4 + Math.PI / 2 },
      { ...wall('pane', [9.83, 1.2, 12], [0.17, 1.2, 0.17], 'glass'), flags: ['Glass'] }, wall('wall3', [5, 1.2, 12], [5, 1.2, 0.12]), { ...wall('lean', [5, 1.2, 14], [0.17, 1.2, 0.17]), rot: [0.1, 0, 0] }] };
    const r = zfight(level), has = (a: string, b: string, axis: string, v: string) => r.pairs.some(p => p.a === a && p.b === b && p.axis === axis && p.verdict === v);
    const missed = [!has('wall', 'post', 'x', 'seen') && 'a post flush in a wall\'s end was not SEEN', !has('wall', 'twin', 'y', 'same') && 'two lengths of one wall with one top were not a NOTE',
      !has('wall2', 'post2', 'x', 'covered') && 'a pair under a cap was not read as covered', r.pairs.some(p => p.a === 'hid' || p.b === 'hid') && 'a box the picture does not draw was asked',
      r.turned !== 1 && 'the tilted box was not counted as left out', !r.pairs.some(p => p.a === 'skew' && p.b === 'skewpost' && p.verdict === 'seen' && p.turn > 22 && p.turn < 23) && 'a post flush in the end of a TURNED wall was not SEEN', r.pairs.some(p => p.a === 'pane' || p.b === 'pane') && 'a pane of glass was asked', r.pairs.some(p => p.axis === 'y' && p.sign === '-') && 'an underside was asked'].filter(Boolean);
    console.log(missed.length ? `=== zfight-check BREAK: MISSED: ${missed.join('; ')} ===` : `=== zfight-check BREAK: every planted pair was read right (${r.pairs.length} pairs) ===`);
    process.exit(missed.length ? 0 : 1);
  }
  const named = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');
  const names = named.length ? named.map(n => basename(n).replace(/\.json$/, '')) : readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.endsWith('.lint.json')).map(f => f.replace(/\.json$/, '')).sort();
  const out: Record<string, ZRead> = {}; let seen = 0, same = 0, bad = false;
  for (const n of names) {
    const path = resolve(ROOT, 'levels', `${n}.json`); if (!existsSync(path)) { console.log(`${n}: no such level`); bad = true; continue; }
    const data = JSON.parse(readFileSync(path, 'utf8')); if (!Array.isArray(data.boxes)) continue;   // (a file under levels/ that is no level)
    const r = zfight(data); out[n] = r;
    const S = r.pairs.filter(p => p.verdict === 'seen'), N = r.pairs.filter(p => p.verdict === 'same'), C = r.pairs.length - S.length - N.length; seen += S.length; same += N.length;
    const line = (p: Pair) => `    ${p.a} / ${p.b}  ${p.sign}${p.axis}${p.turn ? ` (turned ${p.turn}°)` : ` at ${p.plane}`}  ${p.size[0]} × ${p.size[1]} m  near [${p.at.join(', ')}]  ${p.groupA === p.groupB ? p.groupA : `${p.groupA} × ${p.groupB}`}`;
    const list = (ps: Pair[]) => { const k = flag('--all') ? ps.length : 12; for (const p of ps.slice(0, k)) console.log(line(p)); if (ps.length > k) console.log(`    … and ${ps.length - k} smaller (--all)`); };
    if (S.length) { console.log(`${n}: FAIL  ${S.length} patch${S.length === 1 ? '' : 'es'} a player can watch flicker (two faces in one plane, drawn differently)`); list(S); }
    if (!flag('--quiet')) {
      if (N.length) { console.log(`${n}: NOTE  ${N.length} pair${N.length === 1 ? '' : 's'} in one plane, drawn alike (nothing shows until a look paints each box by itself)`); list(N); }
      if (!S.length) console.log(`${n}: ${N.length ? 'no patch that shows' : 'PASS'} · ${r.boxes} boxes asked, ${r.turned} tilted ones left out, ${C} covered`);
    }
  }
  const jf = val('--json'); if (jf) writeFileSync(resolve(jf), JSON.stringify(out, null, 1));
  console.log(`=== zfight-check: ${seen ? `FAIL (${seen} seen)` : bad ? 'NOT RUN (a level named is not there)' : 'PASS'} · ${same} noted · ${Object.keys(out).length} levels ===`);
  process.exit(bad ? 2 : seen ? 1 : 0);
}
