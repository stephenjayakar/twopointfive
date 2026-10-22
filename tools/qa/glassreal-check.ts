// GLASS AS BUILDINGS HAVE IT — the check behind GLASSREAL (src/game/glassbreak.ts): two rules, each on in the page and off on the frozen stand.
//   drop   (?glassdrop=0 · TPS_GLASSDROP=1)   toughened glass goes white and drops at once: no wave across the sheet
//   place  (?glassplace=0 · TPS_GLASSPLACE=1) which glass a pane is comes from where it sits: to the floor or a door's panel = toughened, from a sill = float
//
//   bun run tools/qa/glassreal-check.ts [--verbose]     (also `probes.ts glassreal`, family glass; run it on BOTH stands: plain, and TPS_PROFILE=shipped in front)
//
// The lines (each arm sets the two switches itself, so both stands ask the same things):
//    1  drop off: a toughened pane lets go in the wave, as it did (part open two steps on, clumps leaving over a fraction of a second, nearest the blow first)
//    2  drop on:  open under the round at once; nothing more leaves while the sheet stands white; on the step the clock passes `hang` the WHOLE pane is gone,
//                 every fragment of the drop on that one step, at most `blocks` of them, their areas the sheet's
//    3  drop on:  the fragments FALL: down, out the way the round was going, nothing across the pane
//    4  drop on:  the biggest sheet in the office (4 m of window, made toughened) drops with falling glass attached: every emit record out within
//                 four steps of the drop, no more grains trimmed than the wave trims, nine tenths as many born or more
//    5  drop on:  a blast close enough to dice a toughened pane drops it the same way
//    6  place:    the rule on boxes it is handed — to the floor, from a sill, a door's panel, beside a door but starting above a body's reach, a narrow sidelight — on and off
//    7  place:    the office, pane by pane where it stands: the partition and the frontage on its kick wall toughened, the windows float, the laminated two as they were
//    8  place:    what a round does with it: one rifle round takes the partition's sheet whole and leaves a hole in a window (off: the other way round)
//    9  place:    EVERY level's glass counted by kind against the table below, on and off (a level edit that moves a pane across the line shows here)
//
// GLASSREAL_BREAK=1 = the 'on' arms run with the switches off: lines 2 to 9 must fail.   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT, fake } from './headless.ts';
import { officePane, CONF_PANE, LOBBY_PANES } from './office-pane.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const { GLASSBREAK, GLASSREAL, GB_STATS } = await import(`${ROOT}/src/game/glassbreak.ts`);
const { glassImpact, GLASSFX } = await import(`${ROOT}/src/game/glass.ts`);
const { SHARD_STATS } = await import(`${ROOT}/src/game/shards.ts`);
const { makeBox, BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, VERBOSE = process.argv.includes('--verbose'), BROKEN = process.env.GLASSREAL_BREAK === '1';
const f2 = (x: number) => x.toFixed(2);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
/** the switches for an arm: `want` as asked — or, under GLASSREAL_BREAK, off whatever was asked */
const set = (drop: boolean, place: boolean) => { GLASSREAL.drop = drop && !BROKEN; GLASSREAL.place = place && !BROKEN; };

/** EVERY LEVEL'S GLASS BY KIND: [toughened, float, laminated] with `place` on, then with it off. A level not listed must hold no glass. (The -gwot looks, the
 *  relief and the squads block are their base level's boxes: asked too, against the base's row.) */
const CENSUS: Record<string, [[number, number, number], [number, number, number]]> = {
  office: [[10, 9, 3], [13, 6, 3]], warehouse: [[0, 3, 0], [3, 0, 0]], 'test-rooms': [[0, 1, 0], [1, 0, 0]], registry: [[1, 4, 2], [4, 1, 2]], records: [[2, 5, 0], [7, 0, 0]],
  pass: [[0, 8, 0], [8, 0, 0]], mousehole: [[0, 3, 0], [2, 1, 0]], killhouse: [[4, 0, 0], [4, 0, 0]], hall: [[1, 0, 0], [1, 0, 0]], glasshouse: [[10, 0, 0], [6, 4, 0]],
  defuse: [[0, 2, 0], [2, 0, 0]], consulate: [[1, 5, 1], [5, 1, 1]], block: [[0, 4, 0], [4, 0, 0]], bazaar: [[0, 3, 0], [3, 0, 0]], barracks: [[0, 12, 0], [12, 0, 0]],
  'tut-solo': [[0, 2, 0], [2, 0, 0]],
  'tut-sky': [[0, 8, 0], [8, 0, 0]],   // (the tunnel station: eight sill windows behind their shutters)
};
const baseOf = (file: string) => file.replace(/\.json$/, '').replace(/-gwot$/, '').replace(/^office-relief$/, 'office').replace(/^block-squads$/, 'block');

/** the office with a Particles attached, everyone parked, Sam in the corridor, the fracture live and falling glass as asked. (The stand-up writes the two
 *  switches as its stand has them: an arm sets them AFTER this.) */
async function stage(shards = false) {
  Math.random = seeded(4711);
  const W: any = await quiet(() => standUp()); const { game, engine } = W;
  engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
  game.godMode = true; game.player.visibility = 0.02; game.tune.chaos = 0.5; game.tune.glassBreak = true; game.tune.glassShards = shards; GLASSFX.on = true;
  for (const k of Object.keys(GB_STATS)) (GB_STATS as any)[k] = 0;
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; });
  game.teleportPlayer([8.3, 0, 11.6]); W.step(DT); W.step(DT);
  const P = engine.particles; const frags: any[] = [];
  const hook = () => { game.glassBreak.onRelease = (f: any) => frags.push({ ...f, t: game.time }); };
  const clear = () => { P.pending.length = 0; };
  return { W, game, P, gb: game.glassBreak, frags, hook, clear };
}
/** pane bi's frame: its centre, the unit vector along it and its normal, on the plan */
function frame(game: any, bi: number) {
  const b = game.level.boxes[bi]; const cs = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0), wide = b.h[0] >= b.h[2];
  const tan: Vec3 = wide ? [cs, 0, -sn] : [sn, 0, cs], nrm: Vec3 = wide ? [sn, 0, cs] : [cs, 0, -sn];
  return { b, tan, nrm, hu: Math.max(b.h[0], b.h[2]), at: (u: number, v: number): Vec3 => [b.c[0] + tan[0] * u, b.c[1] + v, b.c[2] + tan[2] * u] };
}
/** one round into toughened pane bi, then the run stepped to its end: per step the open share and the fragments handed on */
async function shoot(S: Awaited<ReturnType<typeof stage>>, bi: number, secs = 1.2) {
  const { W, game, gb, frags } = S; const fr = frame(game, bi); gb.setType(bi, 'tempered'); frags.length = 0; S.hook();
  const at = fr.at(0.1 * fr.hu, -0.3 * fr.b.h[1]), dir = v3.scale(fr.nrm, -1) as Vec3; const t0 = game.time;
  const answer = glassImpact(game, bi, at, dir, 1, 1); const st = gb.panes.get(bi);
  const first = frags.length, openAtBlow = gb.openAt(bi, at), cornerShut = !gb.openAt(bi, fr.at(-0.9 * fr.hu, 0.9 * fr.b.h[1]));
  const steps: { t: number; open: number; n: number }[] = [];
  for (let i = 0; i < Math.round(secs * 60); i++) { W.step(DT); steps.push({ t: game.time - t0, open: gb.openFraction(bi), n: frags.length }); }
  return { answer, st, first, openAtBlow, cornerShut, steps, t0, fr, dir, area: 4 * fr.hu * fr.b.h[1] };
}

export async function glassrealCheck(): Promise<boolean> {
  console.log('\n=== glassreal: toughened glass drops at once, and a pane\'s glass comes from where it sits ==='); let all = true;
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const keep = { ...GLASSREAL }, rnd = Math.random, fx = GLASSFX.on;
  if (BROKEN) console.log('  (GLASSREAL_BREAK: the on arms run with the switches off — lines 2 to 9 must fail)');
  try {
    // ---- 1: the wave, as it was
    { const S = await stage(); GLASSREAL.drop = false; GLASSREAL.place = false; const r = await shoot(S, CONF_PANE); const { frags } = S;
      const two = r.steps[1].open, span = frags[frags.length - 1].t - r.t0, times = new Set(frags.map((f: any) => f.t.toFixed(4))).size;
      verdict(r.answer.diced && r.openAtBlow && r.cornerShut && two > 0 && two < 1 && !!r.st?.gone && span > 0.15 && times > 5, '1 drop off: the pane lets go in the wave, as it did',
        `${(100 * two).toFixed(0)}% open two steps on, ${frags.length} clumps over ${f2(span)} s on ${times} different steps`); }
    // ---- 2, 3: the drop
    { const S = await stage(); set(true, false); const r = await shoot(S, CONF_PANE); const { frags } = S; const hang = GLASSREAL.hang;
      const gi = r.steps.findIndex(s => s.open === 1), goneT = gi < 0 ? -1 : r.steps[gi].t, before = gi < 0 ? r.steps : r.steps.slice(0, gi);
      const stood = before.length > 2 && before.every(s => s.n === r.first && s.open > 0 && s.open < 0.2), gone = gi >= 0 && goneT >= hang - DT - 1e-9 && goneT <= hang + 2 * DT && !!r.st?.gone && !!r.st?.walkable;
      const late = frags.slice(r.first), oneStep = late.length > 0 && new Set(late.map((f: any) => f.t.toFixed(6))).size === 1 && r.steps[r.steps.length - 1].n === frags.length;
      const sum = frags.reduce((a: number, f: any) => a + f.area, 0);
      verdict(r.answer.diced && r.openAtBlow && r.cornerShut && stood && gone && oneStep && late.length <= GLASSREAL.blocks && Math.abs(sum - r.area) < 0.01 * r.area && late.every((f: any) => f.kind === 'clump' && f.cause === 'dice' && f.grain === GLASSBREAK.diceGrain),
        '2 drop on: open under the round at once, the sheet stands white, then the WHOLE pane goes on one step',
        `open at the blow ${r.openAtBlow}, far corner in ${r.cornerShut}; ${before.length} steps standing with ${r.first} fragment(s) out; gone at ${gi < 0 ? '—' : goneT.toFixed(3)} s (hang ${hang}); ${late.length} fragments on ${new Set(late.map((f: any) => f.t.toFixed(6))).size} step(s), at most ${GLASSREAL.blocks}; ${sum.toFixed(3)} m² of a ${r.area.toFixed(3)} m² sheet`);
      const across = Math.max(0, ...late.map((f: any) => Math.abs(v3.dot(f.velocity, r.fr.tan)))), down = late.every((f: any) => f.velocity[1] < -0.25), out = late.every((f: any) => v3.dot(f.velocity, r.dir) > 0);
      verdict(late.length > 0 && across < 1e-9 && down && out, '3 drop on: the fragments fall — down, out the way the round went, nothing across the pane',
        `largest speed across the pane ${across.toExponential(1)} m/s; all down ${down}; all out along the round ${out}`); }
    // ---- 4: the biggest sheet, with falling glass attached
    { const big = async (drop: boolean) => {
        const S = await stage(true); set(drop, false); const { W, game, gb } = S; const bi = officePane(16, 24), fr = frame(game, bi); gb.setType(bi, 'tempered'); W.step(DT);
        for (const k of Object.keys(SHARD_STATS)) (SHARD_STATS as any)[k] = 0;
        glassImpact(game, bi, fr.at(0.3, 0.1), v3.scale(fr.nrm, -1) as Vec3, 1, 1); const hooked = !!gb.onRelease;
        let goneAt = -1, lastEmit = -1, e0 = 0; for (let i = 0; i < 90; i++) { S.clear(); W.step(DT); if (goneAt < 0 && gb.openFraction(bi) === 1) goneAt = i; if (SHARD_STATS.emits !== e0) { e0 = SHARD_STATS.emits; lastEmit = i; } }
        return { hooked, goneAt, lastEmit, clumps: gb.panes.get(bi)?.dice?.clumps.length ?? 0, frags: SHARD_STATS.fragments as number, trimmed: SHARD_STATS.trimmed as number, born: SHARD_STATS.born as number, deferred: SHARD_STATS.recsDeferred as number }; };
      const on = await big(true), off = await big(false);
      verdict(on.hooked && on.goneAt >= 0 && on.clumps > 300 && on.frags <= GLASSREAL.blocks + 8 && on.trimmed <= off.trimmed && on.lastEmit - on.goneAt <= 4 && on.born >= 0.9 * off.born, '4 drop on: a 4 m sheet drops with falling glass attached — every record out within four steps of the drop, no more trimmed than the wave trims, as many grains born',
        `${on.clumps} clumps handed on as ${on.frags} fragments; ${on.born} grains born, ${on.trimmed} trimmed, ${on.deferred} records waited, the last out ${on.lastEmit - on.goneAt} step(s) after the drop · the wave: ${off.frags} fragments, ${off.born} born, ${off.trimmed} trimmed, ${off.deferred} waited, over ${off.lastEmit} steps`); }
    // ---- 5: a blast
    { const S = await stage(); set(true, false); const { W, game, gb, frags } = S; const bi = LOBBY_PANES[0], fr = frame(game, bi); gb.setType(bi, 'tempered'); S.hook(); frags.length = 0;
      const at = v3.add(fr.at(0, 0), v3.scale(fr.nrm, 0.6)) as Vec3; const t0 = game.time; gb.blast(at, { who: 1 }); const st = gb.panes.get(bi);
      let goneAt = -1, parts = 0; for (let i = 0; i < 40 && goneAt < 0; i++) { const o0 = gb.openFraction(bi); W.step(DT); const o1 = gb.openFraction(bi); if (o1 === 1) goneAt = game.time - t0; else if (o1 > o0 + 1e-9 && i > 0) parts++; }
      const mine = frags.filter((f: any) => f.pane === bi).length;
      verdict(!!st?.dice && goneAt >= GLASSREAL.hang - DT - 1e-9 && goneAt <= GLASSREAL.hang + 2 * DT && parts === 0 && mine <= GLASSREAL.blocks + 8, '5 drop on: a blast that dices a toughened pane drops it the same way',
        `gone ${goneAt < 0 ? 'never' : goneAt.toFixed(3) + ' s'} after the blast (hang ${GLASSREAL.hang}); ${parts} step(s) with part of it leaving; ${mine} fragments of this pane`); }
    // ---- 6: the rule on boxes it is handed
    { const S = await stage(); const { game, gb } = S; const D = game.doors.list[0].def, dx = Math.cos(D.closedDir), dz = Math.sin(D.closedDir);
      const pane = (c: Vec3, hu: number, hv: number, yaw = 0) => makeBox({ c, h: [hu, hv, 0.006], yaw, albedo: [0.8, 0.9, 0.9], flags: BoxFlag.Static | BoxFlag.Glass });
      const yawD = -D.closedDir; const beside = (foot: number, gapM: number): Vec3 => [D.hinge[0] - dx * (gapM + 0.5), foot + 0.5, D.hinge[1] - dz * (gapM + 0.5)];
      const cases: [string, any, string, string][] = [
        ['to the floor, far from any door', pane([-40, 1.2, -40], 1, 1.1), 'tempered', 'annealed'],
        ['from a sill, far from any door', pane([-40, 1.65, -40], 1, 0.75), 'annealed', 'annealed'],
        ['from a sill, a panel of a door (0.1 m off its opening)', pane(beside(0.9, 0.1), 0.5, 0.5, yawD), 'tempered', 'annealed'],
        ['from a sill, 0.6 m off a door', pane(beside(0.9, 0.6), 0.5, 0.5, yawD), 'annealed', 'annealed'],
        ['over a door\'s head, 0.1 m off it', pane(beside(1.6, 0.1), 0.5, 0.5, yawD), 'annealed', 'annealed'],
        ['a narrow sidelight to the floor', pane([-40, 1.25, -40], 0.275, 0.95), 'laminated', 'laminated'],
      ];
      const got = (on: boolean) => { set(false, on); return cases.map(c => gb.typeOf(c[1], -1) as string); };
      const a = got(true), b = got(false); const okOn = cases.every((c, i) => a[i] === c[2]), okOff = cases.every((c, i) => b[i] === c[3]);
      verdict(okOn && okOff, '6 place: the rule on boxes it is handed, on and off', cases.map((c, i) => `${c[0]}: ${a[i]} (off ${b[i]})`).join(' · ')); }
    // ---- 7, 8: the office
    { const S = await stage(); const { W, game, gb } = S; const lam = officePane(26.475, 10), win = officePane(16, 24), strip = officePane(9, 4);
      const kinds = (on: boolean) => { set(false, on); return [CONF_PANE, LOBBY_PANES[0], win, lam, strip].map(bi => gb.typeOfPane(bi) as string); };
      const a = kinds(true), b = kinds(false);
      verdict(a.join() === 'tempered,tempered,annealed,laminated,laminated' && b.join() === 'annealed,tempered,tempered,laminated,laminated', '7 place: the office, pane by pane where it stands',
        `partition sheet ${a[0]} (off ${b[0]}) · frontage on its kick wall ${a[1]} (${b[1]}) · north window ${a[2]} (${b[2]}) · manager's sidelight ${a[3]} (${b[3]}) · high strip ${a[4]} (${b[4]})`);
      const one = (on: boolean, bi: number) => { set(false, on); gb.reset(); const fr = frame(game, bi); glassImpact(game, bi, fr.at(0.1, -0.2), v3.scale(fr.nrm, -1) as Vec3, 1, 1); for (let i = 0; i < 90; i++) W.step(DT); const st = gb.panes.get(bi); return { gone: !!st?.gone, open: gb.openFraction(bi) }; };
      const pOn = one(true, CONF_PANE), wOn = one(true, win), pOff = one(false, CONF_PANE), wOff = one(false, win);
      verdict(pOn.gone && !wOn.gone && wOn.open > 0 && wOn.open < 0.2 && !pOff.gone && pOff.open > 0 && wOff.gone, '8 place: one rifle round takes the partition\'s sheet whole and leaves a hole in a window (off: the other way round)',
        `on: partition gone ${pOn.gone}, window ${(100 * wOn.open).toFixed(1)}% open · off: partition ${(100 * pOff.open).toFixed(1)}% open, window gone ${wOff.gone}`); }
    // ---- 9: every level
    { const { readdirSync } = await import('node:fs'); const files = readdirSync(resolve(ROOT, 'levels')).filter(f => f.endsWith('.json') && !f.includes('.lint')).sort();
      const bad: string[] = [], lines: string[] = []; let levels = 0, panes = 0;
      for (const file of files) {
        const src = readFileSync(resolve(ROOT, 'levels', file), 'utf8'); const want = CENSUS[baseOf(file)];
        if (!/"Glass"/.test(src)) { if (want) bad.push(`${file}: the table lists glass and the file has none`); continue; }
        const data = parseLevelData(src); const level = isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data);
        const W: any = await quiet(() => standUp({ level })); const g = W.game; const count = (on: boolean) => { set(false, on); const n: [number, number, number] = [0, 0, 0]; for (const bi of g.engine.world.glassStatics as number[]) { const t = g.glassBreak.typeOfPane(bi); if (t) n[t === 'tempered' ? 0 : t === 'annealed' ? 1 : 2]++; } return n; };
        const on = count(true), off = count(false); levels++; panes += on[0] + on[1] + on[2];
        if (!want) { if (on[0] + on[1] + on[2] > 0) bad.push(`${file}: ${on.join('/')} — not in the table`); continue; }
        if (on.join() !== want[0].join() || off.join() !== want[1].join()) bad.push(`${file}: on ${on.join('/')} (table ${want[0].join('/')}), off ${off.join('/')} (table ${want[1].join('/')})`);
        if (VERBOSE) lines.push(`${file}: toughened/float/laminated ${on.join('/')} (off ${off.join('/')})`);
      }
      for (const l of lines) console.log(`    ${l}`);
      verdict(bad.length === 0 && levels >= 15, '9 place: every level\'s glass by kind, on and off, against the table', bad.length ? bad.join(' · ') : `${levels} level files with glass, ${panes} panes, every count as tabled`); }
  } finally { Object.assign(GLASSREAL, keep); Math.random = rnd; GLASSFX.on = fx; }
  console.log(`=== glassreal: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); if (!all) process.exitCode = 1; return all;
}
if (import.meta.main) await glassrealCheck();
