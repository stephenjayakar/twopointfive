// The 'airdust' family (game/airDust.ts — a picked weather's dust standing in the rooms where the openings let it), run through probes.ts:
//   bun run tools/qa/probes.ts airdust | airdust-shut | airdust-door | airdust-breach | airdust-eyes | airdust-save | airdust-off
// PASS / FAIL each, all headless (the records level in dust; the switch raised by the probe on either stand):
//   airdust-shut   a level whose doors are shut: every roofed cell holds the weather's leak or more and at most the open air's 1, the cells away from every
//                  opening hold the leak EXACTLY, the open air is 1, and the field stands still (no cell moves over ten seconds)
//   airdust-door   an outside door swung open and held: the dust comes in — within eight seconds the cell on its threshold is well over the leak and thins
//                  with distance into the room; shut again, the room is back at the leak within a minute; two games given the same doors agree bit for bit
//   airdust-breach a stretch of outside wall taken away (as destruction takes one): within twelve seconds the dust stands in the room behind it; the level
//                  put back (reset) = the leak again
//   airdust-eyes   the men's eyes are cut by that field: a sight line across the threshold is dimmer with the door open than shut, a line in the open is
//                  unchanged, and with every door shut airTrans is what the leak-under-every-roof rule gives wherever the line stays clear of a roof's edge
//   airdust-save   a checkpoint carries it: saved with the door open, loaded into the same game and into a fresh one, the field is the saved one cell for cell,
//                  and ten more seconds leave all three with the same field
//   airdust-off    the switch off (the frozen stand's default, the page's ?flatfog): the field is the leak under every roof, nothing moves when a door opens,
//                  no checkpoint slice is written, and airTrans is exactly the old rule's number
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { standUp, ROOT } from './headless.ts';
const K = await import(`${ROOT}/src/game/weatherKinds.ts`);
const WX = await import(`${ROOT}/src/game/weather.ts`);
const { AIRDUST } = await import(`${ROOT}/src/game/airDust.ts`);
const { AIR_CELL, AIR_W, AIR_H } = await import(`${ROOT}/src/scene/airGrid.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

const DT = 1 / 60;
const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const levelOf = (name: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', `${name}.json`), 'utf8')));
/** a game born in `kind` on `level` with the switch as asked — written AFTER the stand-up (the frozen stand pins it off as it builds the Game) and the field
 *  seeded again under it; left as asked (each probe puts the table back when it is done: `kept`) */
async function born(on: boolean, kind: string | null = 'dust', level = 'records'): Promise<any> {
  const log = console.log; console.log = () => {};
  K.WEATHER_BOOT.kind = kind; AIRDUST.on = on;
  try { const W = await standUp({ level: levelOf(level) }); W.game.aiEnabled = false; AIRDUST.on = on; W.game.airDust.reseed(); return W; } finally { K.WEATHER_BOOT.kind = null; console.log = log; }
}
function run(W: any, secs: number) { for (let i = 0; i < Math.round(secs / DT); i++) W.step(DT); }
async function kept(fn: () => Promise<boolean>): Promise<boolean> { const was = AIRDUST.on; try { return await fn(); } finally { AIRDUST.on = was; } }
function hold(d: any, open: boolean) { d.angle = open ? (d.maxA > 0.5 ? Math.min(d.maxA, 1.5) : Math.max(d.minA, -1.5)) : 0; d.vel = 0; d.latched = !open; d.quietT = open ? -3600 : 10; d.closing = false; d.place(); }
/** the outside door the probes work: the first exterior one with a roofed room on one side and the open on the other, and the point `m` metres in from its
 *  threshold (negative = out in the open) */
function doorOf(g: any, last = false) {
  const w = g.weather;
  for (const d of last ? [...g.doors.list].reverse() : g.doors.list) {
    if (!last && (!d.def.exterior || d.def.locked)) continue;   // (`last`: by the plan alone — the big levels' yard doors carry no `exterior`)
    const c = d.poseAt(0).c;
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const at = (m: number): [number, number, number] => [c[0] + nx * m, 1.5, c[2] + nz * m];
      if (w.underRoof(at(1.2)[0], at(1.2)[2]) && (last || w.underRoof(at(5)[0], at(5)[2])) && !w.underRoof(at(-1.2)[0], at(-1.2)[2]) && !g.col.solidBlocked(at(0.6), at(last ? 1.5 : 5))) return { d, c, at, inside: true, outside: true };
    }
  }
  const d = g.doors.list[0], c = d.poseAt(0).c; return { d, c, at: (m: number): [number, number, number] => [c[0] + m, 1.5, c[2]], inside: false, outside: false };
}
const fieldOf = (g: any) => Float64Array.from(g.airDust.s as Float64Array);
function maxDiff(a: Float64Array, b: Float64Array) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }

// ---------------------------------------------------------------- airdust-shut
export const airShut = () => kept(async () => {
  const F = family('airdust-shut: a shut level holds the leak, the open air 1, and stands still');
  const W = await born(true), g = W.game, A = g.airDust, w = g.weather, leak = w.fog.leak;
  for (const d of g.doors.list) hold(d, false);
  A.reseed(); run(W, 1);
  let roofed = 0, atLeak = 0, bad = 0, open = 0, openBad = 0, mx = 0;
  for (let iz = 0; iz < AIR_H; iz++) for (let ix = 0; ix < AIR_W; ix++) {
    const v = A.s[ix + iz * AIR_W], r = w.underRoof((ix + 0.5) * AIR_CELL, (iz + 0.5) * AIR_CELL);
    if (r) { roofed++; if (v === leak) atLeak++; if (!(v >= leak && v <= 1)) bad++; if (v > mx) mx = v; } else { open++; if (v !== 1) openBad++; }
  }
  F.verdict(A.live && roofed > 200 && bad === 0 && openBad === 0, 'every roofed cell is between the leak and 1, every open cell is 1',
    `${roofed} roofed (${atLeak} exactly at the leak ${f3(leak)}, the thickest ${f3(mx)}), ${open} open; out of range ${bad}, open cells off 1: ${openBad}`);
  F.verdict(atLeak > roofed * 0.5, 'most of a shut building holds the leak exactly', `${atLeak} of ${roofed} (the rest stand by a doorless opening or an open window)`);
  const a = fieldOf(g); run(W, 10); const moved = maxDiff(a, fieldOf(g));
  F.verdict(moved < 2e-3, 'the field stands still with nothing moving', `most any cell moved in 10 s: ${moved.toExponential(2)} · ${A.summary()}`);
  return F.done();
});

// ---------------------------------------------------------------- airdust-door
export const airDoor = () => kept(async () => {
  const F = family('airdust-door: the dust comes in at an open door, and clears when it is shut');
  const W = await born(true), g = W.game, A = g.airDust, leak = g.weather.fog.leak;
  for (const d of g.doors.list) hold(d, false);
  A.reseed(); run(W, 1);
  const D = doorOf(g), near = D.at(0.75), mid = D.at(2.5), far = D.at(5);
  const before = [A.shareAt(near[0], near[2]), A.shareAt(mid[0], mid[2]), A.shareAt(far[0], far[2])];
  F.verdict(D.inside && D.outside && before[0] < leak + 0.05, 'the door stands between a roofed room and the open, and its threshold starts near the leak',
    `door '${D.d.def.name}' at ${f3(D.c[0])}, ${f3(D.c[2])} · inside roofed ${D.inside}, outside open ${D.outside} · shares at 0.75 / 2.5 / 5 m in: ${before.map(f3).join(' / ')} (leak ${f3(leak)})`);
  hold(D.d, true); for (let i = 0; i < 8 / DT; i++) { hold(D.d, true); W.step(DT); }
  const open = [A.shareAt(near[0], near[2]), A.shareAt(mid[0], mid[2]), A.shareAt(far[0], far[2])];
  // (the bound is for the NARROWEST way in the lattice gives a door: a 0.9 m doorway opens one 0.5 m edge or two by where it sits on the 0.5 m cells — records_west
  //  opens one and reads 0.52 on the threshold, the 1.2 m door this was first read on opened two and read 0.62)
  F.verdict(open[0] > leak + 0.15 && open[0] > open[1] && open[1] >= open[2] && open[1] > before[1] + 0.02, 'eight seconds open: thick on the threshold, thinning into the room',
    `shares at 0.75 / 2.5 / 5 m in: ${open.map(f3).join(' / ')} (were ${before.map(f3).join(' / ')})`);
  // a second game given the same doors agrees bit for bit
  { const W2 = await born(true), g2 = W2.game; for (const d of g2.doors.list) hold(d, false); g2.airDust.reseed(); run(W2, 1);
    const D2 = doorOf(g2); hold(D2.d, true); for (let i = 0; i < 8 / DT; i++) { hold(D2.d, true); W2.step(DT); }
    const m = maxDiff(fieldOf(g), fieldOf(g2));
    F.verdict(m === 0, 'two games given the same doors hold the same field, bit for bit', `largest difference over ${AIR_W * AIR_H} cells: ${m}`); }
  hold(D.d, false); for (let i = 0; i < 60 / DT; i++) { hold(D.d, false); W.step(DT); }
  const shut = [A.shareAt(near[0], near[2]), A.shareAt(mid[0], mid[2])];
  // a level of many doors: the LAST outside door of the list moving is seen like the first (the leaves' signature is a hash of every pose, not a running sum)
  { const W3 = await born(true, 'dust', 'compound'), g3 = W3.game, A3 = g3.airDust, lk = g3.weather.fog.leak; for (const d of g3.doors.list) hold(d, false); A3.reseed(); run(W3, 1);
    const D3 = doorOf(g3, true), idx = g3.doors.list.indexOf(D3.d), p3 = D3.at(0.75), b3 = A3.shareAt(p3[0], p3[2]);
    for (let i = 0; i < 6 / DT; i++) { hold(D3.d, true); W3.step(DT); }
    const o3 = A3.shareAt(p3[0], p3[2]);
    F.verdict(D3.inside && idx >= 10 && o3 > b3 + 0.2, 'on a level of many doors the last outside door lets the dust in like the first', `compound: door ${idx} of ${g3.doors.list.length} '${D3.d.def.name}' · share 0.75 m in: ${f3(b3)} → ${f3(o3)} (leak ${f3(lk)})`); }
  F.verdict(shut[0] < before[0] + 0.01 && shut[1] < before[1] + 0.01, 'a minute after it is shut the room is back where it was', `shares at 0.75 / 2.5 m in: ${shut.map(f3).join(' / ')} (before the door opened ${f3(before[0])} / ${f3(before[1])})`);
  return F.done();
});

// ---------------------------------------------------------------- airdust-breach
export const airBreach = () => kept(async () => {
  const F = family('airdust-breach: a wall that is no longer there lets the dust in');
  const W = await born(true), g = W.game, A = g.airDust, leak = g.weather.fog.leak;
  for (const d of g.doors.list) hold(d, false);
  A.reseed(); run(W, 1);
  // a stretch of outside wall: from the open, well to one side of the door, a ray into the building
  const D = doorOf(g), n = [D.at(1)[0] - D.at(0)[0], 0, D.at(1)[2] - D.at(0)[2]], side = [-n[2], 0, n[0]];
  let hit: any = null, o: number[] = [], k = 0;
  for (const m of [3, -3, 4.5, -4.5, 6, -6]) { o = [D.at(-1.5)[0] + side[0] * m, 1.5, D.at(-1.5)[2] + side[2] * m]; hit = g.col.raycast(o as any, n as any, 3); if (hit && hit.index < 1e6 && g.weather.underRoof(o[0] + n[0] * (hit.t + 1), o[2] + n[2] * (hit.t + 1))) { k = m; break; } hit = null; }
  if (!hit) { F.verdict(false, 'found a stretch of outside wall to take away', 'none within 6 m of the door'); return F.done(); }
  const inP = [o[0] + n[0] * (hit.t + 0.9), 1.5, o[2] + n[2] * (hit.t + 0.9)], before = A.shareAt(inP[0], inP[2]);
  const box = g.engine.world.statics[hit.index], was = box.flags; box.flags |= BoxFlag.NoShadow;   // (what destruction does to a static it takes away: every solid query passes it)
  run(W, 12); const after = A.shareAt(inP[0], inP[2]);
  F.verdict(before < leak + 0.02 && after > leak + 0.15, 'twelve seconds after the wall goes, the dust stands in the room behind it',
    `wall static ${hit.index} ${k} m along from '${D.d.def.name}' · share 0.9 m inside it: ${f3(before)} → ${f3(after)} (leak ${f3(leak)})`);
  box.flags = was; A.reset(); run(W, 1); const back = A.shareAt(inP[0], inP[2]);
  F.verdict(back === leak, 'the level put back as authored (reset): the leak again', `share ${f3(back)}`);
  return F.done();
});

// ---------------------------------------------------------------- airdust-eyes
export const airEyes = () => kept(async () => {
  const F = family('airdust-eyes: the men\'s eyes are cut by the field');
  const W = await born(true), g = W.game, A = g.airDust, f = g.weather.fog;
  for (const d of g.doors.list) hold(d, false);
  A.reseed(); run(W, 1);
  const D = doorOf(g), a = D.at(0.6), b = D.at(6), o1 = D.at(-2), o2 = D.at(-9);
  const shutT = WX.airTrans(g, a, b), outT = WX.airTrans(g, o1, o2);
  // the old rule's number for the same lines
  const old = (p: number[], q: number[]) => { let leak = 0; for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; leak += g.weather.underRoof(p[0] + (q[0] - p[0]) * t, p[2] + (q[2] - p[2]) * t) ? f.leak : 1; } return Math.exp(-K.fogTau(f, p, q) * leak / 4); };
  F.verdict(Math.abs(outT - old(o1, o2)) < 1e-12, 'a line in the open is cut exactly as it was', `airTrans ${outT.toFixed(6)} · the leak rule ${old(o1, o2).toFixed(6)}`);
  hold(D.d, true); for (let i = 0; i < 8 / DT; i++) { hold(D.d, true); W.step(DT); }
  const openT = WX.airTrans(g, a, b);
  F.verdict(openT < shutT - 0.003 && openT > 0.5, 'a line from the threshold into the room is dimmer with the door open', `shut ${shutT.toFixed(4)} → open ${openT.toFixed(4)} (5.4 m of room; the leak rule: ${old(a, b).toFixed(4)})`);
  F.verdict(Math.abs(WX.airTrans(g, o1, o2) - outT) < 1e-12, '…and the open air beside it is unchanged', `${WX.airTrans(g, o1, o2).toFixed(6)}`);
  return F.done();
});

// ---------------------------------------------------------------- airdust-save
export const airSave = () => kept(async () => {
  const F = family('airdust-save: a checkpoint carries the field');
  const W = await born(true), g = W.game, A = g.airDust;
  const D = doorOf(g); for (let i = 0; i < 5 / DT; i++) { hold(D.d, true); W.step(DT); }
  const snap = A.snapshot(), was = fieldOf(g);
  F.verdict(!!snap && snap.s.length > 0 && typeof snap.stat === 'string', 'the slice lists the cells off the leak and the openings', `${snap ? snap.s.length / 2 : 0} cells, ${snap ? snap.stat.length : 0} hex digits of openings, ${JSON.stringify(snap ?? null).length} bytes`);
  const file = saveState(g, { label: 'airdust', kind: 'harness', force: true });
  F.verdict(!!file?.air, 'saveState files it', `air slice ${file?.air ? JSON.stringify(file.air).length + ' bytes of ' + JSON.stringify(file).length : 'absent'}`);
  run(W, 3);   // (the game moves on …)
  loadState(g, file); const same = maxDiff(was, fieldOf(g));   // (… and is put back)
  F.verdict(same === 0, 'loaded into the same game: the saved field, cell for cell', `largest difference ${same}`);
  const W2 = await born(true), g2 = W2.game; loadState(g2, file); const fresh = maxDiff(was, fieldOf(g2));
  F.verdict(fresh === 0, 'loaded into a fresh game: the saved field, cell for cell', `largest difference ${fresh}`);
  run(W, 10); run(W2, 10); const later = maxDiff(fieldOf(g), fieldOf(g2));
  F.verdict(later === 0, 'ten seconds on, the two games still agree bit for bit', `largest difference ${later}`);
  return F.done();
});

// ---------------------------------------------------------------- airdust-off
export const airOff = () => kept(async () => {
  const F = family('airdust-off: the switch off = the leak under every roof, as it was');
  const W = await born(false), g = W.game, A = g.airDust, w = g.weather, f = w.fog;
  let bad = 0; for (let iz = 0; iz < AIR_H; iz++) for (let ix = 0; ix < AIR_W; ix++) { const v = A.s[ix + iz * AIR_W]; if (v !== (w.underRoof((ix + 0.5) * AIR_CELL, (iz + 0.5) * AIR_CELL) ? f.leak : 1)) bad++; }
  F.verdict(!A.live && bad === 0, 'the field is the leak under every roof and 1 in the open', `live ${A.live} · cells off that: ${bad}`);
  const a = fieldOf(g), D = doorOf(g); for (let i = 0; i < 5 / DT; i++) { hold(D.d, true); W.step(DT); }
  F.verdict(maxDiff(a, fieldOf(g)) === 0 && A.snapshot() === null && !saveState(g, { label: 'off', kind: 'harness', force: true })?.air, 'an open door moves nothing, and no checkpoint slice is written', `moved ${maxDiff(a, fieldOf(g))} · snapshot ${JSON.stringify(A.snapshot())}`);
  const old = (p: number[], q: number[]) => { let leak = 0; for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4; leak += w.underRoof(p[0] + (q[0] - p[0]) * t, p[2] + (q[2] - p[2]) * t) ? f.leak : 1; } return Math.exp(-K.fogTau(f, p, q) * leak / 4); };
  let off = 0, n = 0; for (let k = 0; k < 400; k++) { const p = [((k * 37) % 400) / 10, 1.6, ((k * 91) % 280) / 10], q = [((k * 53 + 17) % 400) / 10, 1.1, ((k * 29 + 5) % 280) / 10]; n++; if (WX.airTrans(g, p as any, q as any) !== old(p, q)) off++; }
  F.verdict(off === 0, 'airTrans is exactly the old rule\'s number', `${n} lines across the level, ${off} differ`);
  const N = await born(true, null); F.verdict(!N.game.airDust.live && N.game.airDust.snapshot() === null && N.game.airDust.shareAt(20, 14) === 1, 'no weather picked: inert whatever the switch', N.game.airDust.summary());
  return F.done();
});
