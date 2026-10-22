// Does light cross a SHUT door? Every door of the office that stands home is asked, by rays through the band round its leaf (the gaps under the head, at the
// hinge and latch jambs, over the sill), for the sun of each hour and for every lamp in range: a ray from inside the room through a point of that band to the
// light, against the statics and the door leaves as the renderer's rays meet them (no shrink). Exit 1 if the sun of any hour crosses a shut EXTERIOR door.
//   bun run tools/qa/door-light-check.ts [--level office.json] [--step 0.004] [--all]      (--all lists every door, not only the ones that leak)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const HR: any = await import(`${ROOT}/src/game/hours.ts`);
const { loadLevel }: any = await import(`${ROOT}/src/scene/levelLoad.ts`), { parseLevelData }: any = await import(`${ROOT}/src/scene/levelData.ts`);
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const STEP = +arg('--step', '0.004'), ALL = process.argv.includes('--all'), LEVEL = arg('--level', '');
const log = console.log; console.log = () => {}; console.warn = () => {};
const W: any = await standUp(LEVEL ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', LEVEL), 'utf8'))) } : {});   // (a loaded Level, not its file name: standUp walked the string's boxes and threw)
const g = W.game;
HR.applyHour(g, 'dusk');                       // (the outside lamps burn at dusk: the lamps' rows below are a dusk's)
for (let i = 0; i < 5; i++) W.step(1 / 60);
console.log = log;
const DEG = Math.PI / 180;
const suns: { name: string; to: number[] }[] = Object.entries(HR.HOURS).map(([id, d]: any) => { const e = d.sun.elevDeg * DEG, b = d.sun.bearingDeg * DEG; return { name: 'sun@' + id, to: [Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)] }; });
const lamps = g.engine.lights.lights.filter((l: any) => l.enabled && l.intensity > 0 && l.kind !== 2 && !l.owner && !(l.ttl > 0));
const BAND = 0.07, INTO = [0.3, 1.0, 2.5];
// A RAY THAT STARTS INSIDE A BOX IS NOT STOPPED BY IT: a 'room side' point that falls in the wall's own thickness, a frame post or the frame head (a sign hung a
// hand off its door's plane puts it there) is no place light comes from, so such a start is skipped — the solids a ray meets: every static that casts, and the leaves
const NOSHADOW = 2, GLASS = 1 << 17, solids: any[] = [...g.engine.world.statics.filter((b: any) => !(b.flags & (NOSHADOW | GLASS)) && !b.rot), ...g.doors.leafBoxes()];
const inSolid = (P: number[], near: any[]) => near.some((b: any) => { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), px = P[0] - b.c[0], pz = P[2] - b.c[2]; return Math.abs(P[1] - b.c[1]) < b.h[1] && Math.abs(cs * px - sn * pz) < b.h[0] && Math.abs(sn * px + cs * pz) < b.h[2]; });
let skipped = 0;
let red = 0, rows = 0;
for (const d of g.doors.list) {
  const f = d.def; if (Math.abs(d.angle) > 1e-3 || d.slab) { if (ALL) log(`${f.name}: not home (angle ${d.angle.toFixed(2)}), skipped`); continue; }
  const u = [Math.cos(f.closedDir), Math.sin(f.closedDir)], w = f.width, top = d.height + 0.01;
  // the band: every point of the door's plane within BAND of the leaf's outline (inside or outside it)
  const pts: number[][] = [];
  for (let s = -BAND; s <= w + BAND; s += STEP) for (let y = STEP / 2; y <= top + BAND; y += STEP) {
    const inner = s > BAND && s < w - BAND && y > BAND && y < top - BAND; if (inner) continue;
    pts.push([f.hinge[0] + u[0] * s, y, f.hinge[1] + u[1] * s, s]);
  }
  const C = [f.hinge[0] + u[0] * w / 2, 1, f.hinge[1] + u[1] * w / 2];
  const near = solids.filter((b: any) => Math.hypot(b.c[0] - C[0], b.c[2] - C[2]) < Math.hypot(b.h[0], b.h[2]) + w / 2 + INTO[INTO.length - 1] + 0.2);   // (what a start point of this door's rays can be inside)
  const srcs: { name: string; at: (G: number[]) => number[][] }[] = suns.map(s => ({ name: s.name, at: (G: number[]) => [[G[0] + s.to[0] * 60, G[1] + s.to[1] * 60, G[2] + s.to[2] * 60]] }));
  for (const l of lamps) { const dist = Math.hypot(l.pos[0] - C[0], l.pos[1] - C[1], l.pos[2] - C[2]); if (dist > Math.min(l.range, 14)) continue; const r = l.radius ?? 0;
    srcs.push({ name: (l.name ?? 'light') + `(${dist.toFixed(1)} m)`, at: () => [l.pos, [l.pos[0], l.pos[1] + r, l.pos[2]], [l.pos[0], l.pos[1] - r, l.pos[2]], [l.pos[0] + u[0] * r, l.pos[1], l.pos[2] + u[1] * r], [l.pos[0] - u[0] * r, l.pos[1], l.pos[2] - u[1] * r]] }); }
  let any = false;
  for (const S of srcs) {
    let n = 0, n2 = 0, yLo = 9, yHi = -9, sLo = 9, sHi = -9; const land: number[] = [];
    for (const G of pts) for (const E of S.at(G)) {
      const L = [E[0] - G[0], E[1] - G[1], E[2] - G[2]], k = Math.hypot(L[0], L[1], L[2]); L[0] /= k; L[1] /= k; L[2] /= k;
      if (Math.abs(L[0] * -u[1] + L[2] * u[0]) < 0.02) continue;      // the light lies in the door's own plane: nothing crosses
      for (const a of INTO) {
        const A = [G[0] - L[0] * a, G[1] - L[1] * a, G[2] - L[2] * a]; if (A[1] < 0.01) continue;
        if (!g.col.segmentBlocked(A, E, 0)) { if (inSolid(A, near)) { skipped++; continue; } n++; yLo = Math.min(yLo, G[1]); yHi = Math.max(yHi, G[1]); sLo = Math.min(sLo, G[3]); sHi = Math.max(sHi, G[3]); if (land.length < 3) land.push(+A[0].toFixed(2), +A[1].toFixed(2), +A[2].toFixed(2)); }
        else if (!g.col.segmentBlocked(A, E) && !inSolid(A, near)) n2++;                  // crosses only under the CPU light estimate's 2 cm shrink
      }
    }
    if (n || n2 || ALL) { rows++; any = any || n > 0;
      log(`${f.exterior ? 'EXTERIOR' : 'interior'} ${f.name}  ${S.name}: ${n} rays cross the shut door${n ? ` (band y ${yLo.toFixed(3)}‥${yHi.toFixed(3)}, along ${sLo.toFixed(3)}‥${sHi.toFixed(3)} of ${w}; lands e.g. at ${land.join(', ')})` : ''}${n2 ? ` · ${n2} more only with the stand-in's 2 cm shrink` : ''}`);
      if (n && f.exterior && S.name.startsWith('sun')) red++; }
  }
  if (!any && ALL) log(`${f.name}: light-tight (${pts.length} band points × ${srcs.length} sources)`);
}
log(red ? `FAIL — the sun crosses ${red} shut exterior door × hour pairs` : `  PASS  no sun crosses a shut exterior door (${g.doors.list.length} doors, ${suns.length} hours; ${skipped} ray starts inside a solid skipped)`);
process.exit(red ? 1 : 0);
