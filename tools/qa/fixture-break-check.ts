// fixture-break-check — src/game/fixtureBreak.ts (a blast-killed light seen to break, and seen broken afterwards) is ONLY a look:
//   bun run tools/qa/fixture-break-check.ts [--level barracks] [--panel panel_bunks5_13]
// Headless = nothing is drawn; what is asserted:
//   (beat)       a stun charge under a lit ceiling panel with the switch on: the lane's own log says the fixture went out, the look makes ONE record with a hanging
//                fixture and pieces, every box Dynamic | NoShadow and only in the frame's dynamic list, sparks and glass asked of the particles AFTER the blast frame;
//   (same play)  the same seeded charge with the look on and off: the game digest every half second for ten seconds, the lane's log and counts, the debris pool,
//                the hearing events — all equal; and nothing play asks (a ray down through the hanging tray, a walker's circle under it, sight across it) changes;
//   (rest)       everything comes to rest, the glow goes out, the box count holds;
//   (off)        the destruction switch down: nothing; (restart) restartEncounter: nothing; (found) a panel found broken after the clock jumped: drawn fallen, no beat;
//   (cost)       CPU per frame at rest and on the frame it breaks.
import { standUp, ROOT, fake } from './headless.ts';
import { readFileSync } from 'node:fs';
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { DESTR_LOG, DESTR_STATS } = await import(`${ROOT}/src/game/destruction.ts`);
const { FIXLOOK, FIXLOOK_STATS, fixtureLookState } = await import(`${ROOT}/src/game/fixtureBreak.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const LEVEL = arg('--level', 'barracks'), PANEL = arg('--panel', 'panel_bunks5_13');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let fails = 0, checks = 0;
const ok = (c: boolean, what: string) => { checks++; if (!c) fails++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${what}`); };

async function stage(seed: number, look: boolean, destr = true) {
  Math.random = seeded(seed); DESTRUCTION.on = destr; FIXLOOK.on = look;
  for (const k of Object.keys(DESTR_STATS)) (DESTR_STATS as any)[k] = 0; DESTR_LOG.length = 0; for (const k of Object.keys(FIXLOOK_STATS)) (FIXLOOK_STATS as any)[k] = 0;
  const W = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8'))) }); const { game, engine } = W;
  const P = engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  const emits: { f: number; kind: string; n: number; y: number }[] = []; let frame = 0; const emit0 = P.emit.bind(P);
  P.emit = (kind: any, pos: Vec3, dir: Vec3, count: number, o: any) => { emits.push({ f: frame, kind, n: count, y: pos[1] }); return emit0(kind, pos, dir, count, o); };
  game.godMode = true; game.aiEnabled = false; game.player.visibility = 0.02; game.tune.chaos = 0.5;
  const step = (n = 1) => { for (let i = 0; i < n; i++) { frame++; W.step(DT); } };
  step(3);
  const t = game.targets.find((x: any) => x.name === PANEL); if (!t) throw new Error(`no light target '${PANEL}' on ${LEVEL} (${game.targets.map((x: any) => x.name).join(' ')})`);
  return { W, game, engine, t, emits, step, frameNo: () => frame };
}
/** a stun charge's chaos under the panel + the lane's own fixture kill (destruction.ts killFixture: what its loud-level blast rule calls for a fixture in reach) */
const boom = (R: any) => { R.game.destr.bang(under, 0, 1); R.game.destr.killFixture(R.t, under, 'blast', true); };
let under: Vec3 = [0, 0, 0];
const lookBoxes = (game: any) => game.dynBoxes.filter((b: any) => b.name === 'fixtureLook');

console.log(`fixture-break-check · ${LEVEL} · ${PANEL}`);
// ---------------------------------------------------------------- beat
const A = await stage(7, true); const box = A.engine.world.statics[A.t.boxes[0]]; under = [box.c[0] + 0.3, 0.1, box.c[2] + 0.4];
ok(A.t.on && !A.t.broken, `${PANEL} is lit before the charge`);
const playQ = (g: any) => { const r = g.col.raycast([box.c[0], 2.9, box.c[2]], [0, -1, 0], 3.5); const out: Vec3 = [box.c[0], 0, box.c[2]]; const hit = g.col.collideCircle ? JSON.stringify(g.col.collideCircle(out, 0.3)) : ''; return `${r ? r.t.toFixed(4) + ':' + r.index : 'none'}|${g.col.segmentBlocked([box.c[0] - 1, 2.4, box.c[2]], [box.c[0] + 1, 2.4, box.c[2]])}|${g.col.solidBlocked([box.c[0], 2.9, box.c[2] - 0.5], [box.c[0], 1.9, box.c[2] + 0.5])}|${hit}`; };
const q0 = playQ(A.game); const statics0 = A.engine.world.statics.length; const f0 = A.frameNo();
const t0 = performance.now(); boom(A); A.step(1); const msBreak = performance.now() - t0;
ok(A.t.broken, `the charge put ${PANEL} out (${DESTR_LOG.filter((l: string) => /fixture/.test(l)).join(' | ')})`);
let st = fixtureLookState(A.game); let lb = lookBoxes(A.game);
ok(st.recs === 1 && st.hanging === 1, `one record, one fixture hanging (recs ${st.recs}, hanging ${st.hanging})`);
ok(lb.every((b: any) => (b.flags & (BoxFlag.Dynamic | BoxFlag.NoShadow)) === (BoxFlag.Dynamic | BoxFlag.NoShadow)), `every look box is Dynamic | NoShadow (${lb.length} in the frame's dynamic list on the break frame)`);
ok(A.engine.world.statics.length === statics0, 'no static appended');
A.step(210);
st = fixtureLookState(A.game); lb = lookBoxes(A.game);
ok(lb.length === st.boxes && st.boxes === 6 + 2 + FIXLOOK.shards, `${st.boxes} boxes once everything has let go (6 hanging, 2 diffuser pieces, ${FIXLOOK.shards} shards)`);
const mine = A.emits.filter(e => e.f > f0 + 1), blastFrame = A.emits.filter(e => e.f === f0 + 1);
const pops = mine.filter(e => e.kind === 'spark' && e.n > 4), spits = mine.filter(e => e.kind === 'spark' && e.n <= 4); const sparks = pops.reduce((n, e) => n + e.n, 0);
ok(sparks === FIXLOOK.popSparks.reduce((a: number, b: number) => a + b, 0) && pops.length === FIXLOOK.pops.length && pops.slice(0, 3).every(e => e.y > 1.5) && pops[pops.length - 1].y < 1.3, `the lead's sparks come after the blast frame, from the fixture where it hangs and then where it lies (y ${pops.map(e => e.y.toFixed(1)).join(' ')}): ${sparks} over ${pops.length} spurts (frames +${pops.map(e => e.f - f0 - 1).join(', +')}), then ${spits.length} spit${spits.length === 1 ? '' : 's'} of 4 in the first three and a half seconds`);
{ const gl = mine.filter(e => e.kind === 'debris' && e.y > 2 && e.n === FIXLOOK.glass >> 1);
  ok(gl.length === 2 && gl.every(e => e.f - f0 >= Math.floor(FIXLOOK.glassAt * 60) && e.y < 2.8), `the tube's glass comes down ${FIXLOOK.glassAt} s after, from under the ceiling (${gl.reduce((n, e) => n + e.n, 0)} particles in ${gl.length} lots, frames +${gl.map(e => e.f - f0).join(' +')})`); }
console.log(`        (the blast frame itself asked ${blastFrame.reduce((n, e) => n + e.n, 0)} births in ${blastFrame.length} records, none of them this file's)`);
ok(playQ(A.game) === q0, `what play asks under and across the hanging fixture is unchanged (${q0})`);
A.step(360);
st = fixtureLookState(A.game); lb = lookBoxes(A.game);
ok(st.moving === 0, `at rest nine seconds on (moving ${st.moving})`);
const low = Math.min(...lb.filter((b: any) => b.c[1] > 1).map((b: any) => b.c[1] - 0.6 * Math.abs(Math.sin(1)))); const tray = lb.find((b: any) => Math.abs(b.h[0] - box.h[0]) < 1e-6 || Math.abs(b.h[0] - box.h[2]) < 1e-6);
ok(lb.filter((b: any) => b.c[1] < 1).every((b: any) => b.c[1] < 1 && b.c[1] >= 0), `the pieces lie on the floor or the furniture (y ${lb.filter((b: any) => b.c[1] < 1.2).map((b: any) => b.c[1].toFixed(2)).join(' ')})`);
ok(!!tray && tray.c[1] < 1.3 && lb.every((b: any) => b.c[1] < 1.4), `the fixture has come down: nothing is left hanging (tray centre y ${tray?.c[1].toFixed(2)}, highest look box ${Math.max(...lb.map((b: any) => b.c[1])).toFixed(2)})`); void low;
A.step(60 * 45);
ok(lookBoxes(A.game).every((b: any) => b.emissive[0] + b.emissive[1] + b.emissive[2] === 0), 'the glow is out for good within a minute');
ok(lookBoxes(A.game).length === st.boxes, 'the box count holds');
// ---------------------------------------------------------------- off / restart / found
DESTRUCTION.on = false; A.step(2); ok(lookBoxes(A.game).length === 0 && fixtureLookState(A.game).recs === 0, 'the destruction switch down: nothing drawn, nothing kept'); DESTRUCTION.on = true;
A.step(2); ok(fixtureLookState(A.game).hanging === 1 && lookBoxes(A.game).every((b: any) => b.c[1] < 1.4) && FIXLOOK_STATS.beats === 1, 'switch back up: the broken panel is found broken and drawn fallen, with no second beat');
A.game.restartEncounter(); A.step(3); ok(!A.t.broken && lookBoxes(A.game).length === 0 && fixtureLookState(A.game).recs === 0, 'restartEncounter: the light is whole and the look is gone');
A.t.broken = true; A.game.time += 5; A.step(2); ok(fixtureLookState(A.game).hanging === 1 && fixtureLookState(A.game).moving === 0 && lookBoxes(A.game).every((b: any) => b.c[1] < 1.4) && FIXLOOK_STATS.beats === 1, 'a panel found broken after the clock jumped (a load): fallen, at rest, no beat');
// ---------------------------------------------------------------- every panel of every level, found broken: where it lies
{ const { readdirSync } = await import('node:fs'); let panels = 0, through = 0, high = 0, levels = 0, across = 0; const bad: string[] = []; const cap = FIXLOOK.maxPanels; FIXLOOK.maxPanels = 9999;
  for (const f of readdirSync(`${ROOT}/levels`).filter(x => x.endsWith('.json')).sort()) {
    let W: any; try { Math.random = seeded(5); W = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${f}`, 'utf8'))) }); } catch { continue; }
    const g = W.game; g.godMode = true; g.aiEnabled = false; W.step(DT); for (const t of g.targets) if (t.interactive && t.kind === 'emissive') t.broken = true; g.time += 5; W.step(DT); W.step(DT);
    const st = fixtureLookState(g); if (!st.trays.length) continue; levels++;
    for (const t of st.trays) { panels++; if (t.y > t.from[1] - 0.25) { high++; bad.push(`${f} (${t.from[0].toFixed(1)}, ${t.from[2].toFixed(1)}) y ${t.y.toFixed(2)}`); }
      const cut = (y: number) => t.corners.some((c: any) => g.col.solidBlocked([t.from[0], y, t.from[2]], [c[0], y, c[2]]));   // (a wall = what stands to the ceiling; a partition under the panel itself it simply lies across)
      if (cut(2.6)) { through++; bad.push(`${f} (${t.from[0].toFixed(1)}, ${t.from[2].toFixed(1)}) wall`); } else if (cut(1.4)) across++; }
  }
  FIXLOOK.maxPanels = cap;
  ok(panels > 50 && through === 0 && high === 0, `every ceiling panel of every level, found broken: no corner of a fallen fixture (nor its tube) is beyond a wall from where it hung, none left up (${panels} panels on ${levels} levels; ${through} through a wall, ${across} across something lower it hung over, ${high} left up${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''})`); }
// ---------------------------------------------------------------- same play
async function run(look: boolean) { const R = await stage(11, look); const rows: string[] = []; boom(R);
  for (let i = 0; i < 20; i++) { R.step(30); rows.push(JSON.stringify(digestGame(R.game, true))); }
  return { rows, log: DESTR_LOG.join('\n'), stats: JSON.stringify(DESTR_STATS), debris: R.game.destr.debris.list.map((c: any) => `${c.kind}@${c.box.c.map((x: number) => x.toFixed(3))}`).join(' '), events: R.game.events.length, dyn: R.game.dynBoxes.length, broke: R.t.broken, serial: (R.engine.particles as any).serial as number, time: 0 }; }
const on = await run(true), off = await run(false);
ok(on.broke && off.broke, 'both runs lose the light');
ok(on.rows.every((r, i) => r === off.rows[i]), `the game digest every half second for ten seconds is the same with the look on and off (${on.rows.length} digests)`);
ok(on.log === off.log && on.stats === off.stats, `the lane's log and counts are the same (${on.stats})`);
ok(on.debris === off.debris && on.events === off.events, `the debris pool and the hearing events are the same (${on.events} events)`);
ok(on.serial === off.serial && on.serial > 1, `the particles' own serial (what every other effect's births hash) is where it would be without the look (${on.serial})`);
ok(on.dyn === off.dyn + 6 + 2 + FIXLOOK.shards, `the look's whole footprint is its boxes: ${on.dyn - off.dyn} dynamic boxes more`);
// ---------------------------------------------------------------- cost
async function cost(look: boolean) { const R = await stage(13, look); boom(R); R.step(600); const t = performance.now(); R.step(1500); return (performance.now() - t) / 1500; }
const cOff1 = await cost(false), cOn1 = await cost(true), cOff2 = await cost(false), cOn2 = await cost(true);
console.log(`  cost  headless CPU a frame with one broken panel at rest: look off ${Math.min(cOff1, cOff2).toFixed(3)} ms, on ${Math.min(cOn1, cOn2).toFixed(3)} ms (of two takes each, the lower); the frame it broke on, with the charge: ${msBreak.toFixed(2)} ms`);
{ const R = await stage(17, true); R.step(5); const N = 200; let tOn = 0, tOff = 0;
  for (let i = 0; i < N; i++) { const mk = async (look: boolean) => { FIXLOOK.on = look; R.game.restartEncounter(); R.step(2); const t = performance.now(); boom(R); R.step(1); return performance.now() - t; };
    tOff += await mk(false); tOn += await mk(true); }
  console.log(`  cost  the break frame (charge + one step), ${N} restarts each, interleaved: look off ${(tOff / N).toFixed(3)} ms, on ${(tOn / N).toFixed(3)} ms → the look adds ${((tOn - tOff) / N).toFixed(3)} ms on the blast frame`); FIXLOOK.on = true; }
console.log(fails ? `=== fixture-break-check: ${fails} of ${checks} FAILED ===` : `=== fixture-break-check: ALL PASS (${checks} checks) ===`);
process.exit(fails ? 1 : 0);
