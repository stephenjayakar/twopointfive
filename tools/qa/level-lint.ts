// Level lint from the shell — the CLI over src/editor/lint.ts (the same function the editor's LINT button and __ed.lint() run; pure, no GPU):
// nav reachability spawn → objectives → exfil on the guards' own grid, doors walkable both sides / clear / sealing, overlapping statics,
// zero extents, lights inside solids / absurd, budgets, route legs, floor coverage.
//   bun run tools/qa/level-lint.ts [levels/office.json …] [--json] [--quiet]      exit 1 if any file has an ERROR finding (warnings print, pass)
// A file may carry a sidecar `<name>.lint.json` = { allow: { code: { ids: [...] | "*", reason } } } for legitimately odd authored things.
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { ROOT } from './headless.ts';

const { lintLevel, formatLint } = await import(`${ROOT}/src/editor/lint.ts`);
const { validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);

const args = process.argv.slice(2); const flags = new Set(args.filter(a => a.startsWith('--'))); const files = args.filter(a => !a.startsWith('--'));
if (!files.length) files.push('levels/office.json');
let anyErrors = false;
for (const f of files) {
  const path = resolve(ROOT, f);
  if (!existsSync(path)) { console.log(`${f}: no such file`); anyErrors = true; continue; }
  let data: any; try { data = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { console.log(`${f}: not JSON — ${(e as Error).message}`); anyErrors = true; continue; }
  const side = path.replace(/\.json$/, '.lint.json'); let allow: any = undefined;
  if (existsSync(side)) { try { allow = JSON.parse(readFileSync(side, 'utf8')).allow; } catch (e) { console.log(`${f}: sidecar ${side} unreadable — ${(e as Error).message}`); } }
  const v = validateLevelData(data); if (v.length && !flags.has('--quiet')) console.log(`${f}: ${v.length} schema error(s) — lint reports them and stops there`);
  const r = lintLevel(data, { allow });
  if (flags.has('--json')) console.log(JSON.stringify({ file: f, ...r }, null, 1));
  else { const lines = formatLint(r); console.log(`${f} — ${lines[0]}`); if (!flags.has('--quiet') || r.errors) for (const l of lines.slice(1)) console.log(l); }
  if (r.errors) anyErrors = true;
  console.log(`=== level-lint ${f}: ${r.errors ? `FAIL (${r.errors} error${r.errors === 1 ? '' : 's'})` : `PASS (${r.warnings} warning${r.warnings === 1 ? '' : 's'})`} ===`);
}
// ---------------------------------------------------------------- coplanar overlapping FRONT faces (the removed native engine's finding: two ray-visible statics whose
// same-facing faces lie in one plane over an overlapping patch — a hardware closest-hit query returns whichever of the two exactly-tied triangles the AS builder ordered, which is why a
// native still differs boot to boot by 1–4 rays; the WebGPU box walk has its own fixed order). Informational: a count line and the pairs by group; a PASS line only at 0. A fix to the level
// is the maintainer's / a level lane's call, not the lint's.
export function coplanarFrontFaces(data: any, eps = 1e-4): { pairs: { a: string; b: string; axis: string; sign: string; plane: number; overlap: [number, number]; groupA: string; groupB: string }[]; visible: number } {
  const boxes: any[] = (data.boxes ?? []).filter((b: any) => !b.rot && !(b.flags ?? []).includes('NoShadow'));   // (unrotated, ray-visible: NoShadow is invisible to every ray; NoPrimary still shadows / gathers)
  const pairs: any[] = []; const AX = ['x', 'y', 'z'];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    for (let a = 0; a < 3; a++) for (const sgn of [1, -1]) {
      const pa = A.c[a] + sgn * A.h[a], pb = B.c[a] + sgn * B.h[a]; if (Math.abs(pa - pb) > eps) continue;
      const o = [0, 1, 2].filter(k => k !== a); let ok = true; const ov: number[] = [];
      for (const k of o) { const lo = Math.max(A.c[k] - A.h[k], B.c[k] - B.h[k]), hi = Math.min(A.c[k] + A.h[k], B.c[k] + B.h[k]); if (hi - lo <= eps) { ok = false; break; } ov.push(hi - lo); }
      if (!ok) continue;
      pairs.push({ a: A.id ?? String(i), b: B.id ?? String(j), axis: AX[a], sign: sgn > 0 ? '+' : '−', plane: +pa.toFixed(4), overlap: [+ov[0].toFixed(3), +ov[1].toFixed(3)] as [number, number], groupA: A.group ?? '?', groupB: B.group ?? '?' });
    }
  }
  return { pairs, visible: boxes.length };
}
if (!flags.has('--json')) for (const f of files) {
  const path = resolve(ROOT, f); if (!existsSync(path)) continue; let data: any; try { data = JSON.parse(readFileSync(path, 'utf8')); } catch { continue; }
  const r0 = coplanarFrontFaces(data);
  const under = r0.pairs.filter(p => p.axis === 'y' && p.sign === '−' && Math.abs(p.plane) <= 1e-4);   // (the undersides of everything standing on the slab, coplanar with the slab's own bottom at y = 0: no ray in the office ever comes from below — listed apart)
  const r = { visible: r0.visible, pairs: r0.pairs.filter(p => !under.includes(p)) };
  console.log(`\n=== level-lint ${f}: coplanar overlapping front faces (informational — the native AS's tie order; a level fix is the maintainer's call) ===`);
  if (under.length) console.log(`  (${under.length} pair(s) are −y faces on the world floor plane — the undersides of boxes standing on the slab vs the slab's own bottom; no ray comes from below: not counted)`);
  if (!r.pairs.length) console.log(`- PASS — no two ray-visible statics share a same-facing, reachable face plane over an overlapping patch (${r.visible} unrotated ray-visible statics)`);
  else {
    const byGroup = new Map<string, any[]>(); for (const p of r.pairs) { const g = p.groupA === p.groupB ? p.groupA : `${p.groupA} × ${p.groupB}`; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g)!.push(p); }
    console.log(`  ${r.pairs.length} pair(s) among ${r.visible} unrotated ray-visible statics (same plane within 1e-4, extents overlapping):`);
    for (const [g, ps] of [...byGroup.entries()].sort((x, y) => y[1].length - x[1].length)) console.log(`  ${String(ps.length).padStart(4)}  ${g.padEnd(34)} ${ps.slice(0, 6).map(p => `${p.a}/${p.b} ${p.sign}${p.axis}@${p.plane} (${p.overlap[0]}×${p.overlap[1]} m)`).join(' · ')}${ps.length > 6 ? ` · … +${ps.length - 6}` : ''}`);
  }
}
process.exit(anyErrors ? 1 : 0);
