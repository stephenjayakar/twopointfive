// A MAN WHO HAS RUN BREATHES HARD, AND IT SHOWS — the check behind HARDBREATH (src/game/character.ts; on in the page, ?hardbreath=0; off in the module and
// on the frozen stand, TPS_HARDBREATH=1).
//   bun run tools/qa/probes.ts hardbreath        (families `snow`, `weather`)        HARDBREATH_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-19: "characters should breathe more forcefully when sprinting (e.g. on snow levels)". The game has two breaths: the steam off the
// mouth on a snow level (snowBreath.ts, picture only) and the chest's heave (character.ts lifeLayer). There is no breath sound. Both are asked here.
// WHAT THIS CAN AND CANNOT SAY. No GPU: the steam is read as the records the emitter files into a recording stand-in for the particle pool (as
// tools/qa/snowbreath-check.ts reads it) — how far a puff is thrown, how many, how big, how often; what the cloud looks like is the page's. The chest is
// read off the posed skeleton of a man stood still and set blown BY HAND (the life layer's own `exert`, which only a run past 3.2 m/s raises): how far his
// shoulders travel with a breath, how many breaths, how long until his wind is back.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const DT = 1 / 60;
export async function hardBreathCheck(): Promise<boolean> {
  const BRK = process.env.HARDBREATH_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== hardbreath: a man who has run breathes hard, chest and steam${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { SNOW_LOOK } = await import(`${ROOT}/src/game/weatherKinds.ts`); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { updateSnowBreath, seedBreath, SNOWBREATH } = await import(`${ROOT}/src/game/snowBreath.ts`); const { HARDBREATH, LIFE } = await import(`${ROOT}/src/game/character.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`); const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const knobs0 = knobsCopy(), was = { breath: SNOW_LOOK.breath, envSnow: process.env.TPS_SNOW, envBreath: process.env.TPS_SNOWBREATH }, log = console.log, K = SNOWBREATH, H = HARDBREATH, f = (v: number, n = 2) => v.toFixed(n);
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  /** the pass in snow, its room clear begun with a squad of four, the steam's switch up; the rule where `rule` says, held there each frame */
  async function rig(rule: boolean, clear = true) { const sw = rule && !BRK;
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWBREATH = '1';
    const W: any = await quiet(() => standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8'))), seed: 7 }));
    const g = W.game; SNOW_LOOK.breath = true; HARDBREATH.on = sw; if (clear) await quiet(() => startFromQuery(g, '?levelFile=pass.json&roomclear=0&squad4'));
    const step = (n = 1) => { for (let i = 0; i < n; i++) { SNOW_LOOK.breath = true; HARDBREATH.on = sw; W.step(DT); } };
    step(120); return { W, g, step, sw }; }
  /** the steam's emitter run `frames` frames against a recording stand-in for the particle pool, reseeded; `pre(i)` holds the men to the line's pace each frame */
  const fly = (R: any, frames: number, pre?: (i: number) => void) => { const recs: any[] = []; let frame = 0; const P: any = { emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { recs.push({ kind, count, opts: { ...opts }, frame }); return count; } };
    const e = R.g.engine as any, had = { p: e.particles, gp: e.settings.gpuParticles }; seedBreath(R.g, 1);
    for (let i = 0; i < frames; i++) { pre?.(i); e.particles = P; e.settings.gpuParticles = true; SNOW_LOOK.breath = true; HARDBREATH.on = R.sw; updateSnowBreath(R.g, DT); frame++; e.particles = had.p; e.settings.gpuParticles = had.gp; }
    return (id: number) => recs.filter(r => r.opts.owner === id); };
  const breaths = (rs: any[]) => { const out: any[][] = []; let last = -1e9; for (const r of rs) { if (r.frame - last > 12) out.push([]); out[out.length - 1].push(r); last = r.frame; } return out; };
  const key = (r: any) => `${r.frame}:${r.opts.seed}:${r.count}:${r.opts.steam}:${r.opts.size}:${r.opts.speed.toFixed(5)}:${r.opts.vadd.map((v: number) => v.toFixed(4)).join(',')}`;
  const vaddOf = (r: any) => Math.hypot(r.opts.vadd[0], r.opts.vadd[2]);
  try {
    const A = await rig(true), B = await rig(false); const sam = (R: any) => R.g.player.char, mate = (R: any) => R.g.guards.find((gd: any) => gd.team === 'operative').char;
    const hold = (R: any, c: any, v: number) => { c.vel[0] = v; c.vel[2] = 0; };
    // (1) at rest, and walking: the breath as it was, record for record
    { const walk = (R: any) => fly(R, 600, () => { hold(R, sam(R), 0); hold(R, mate(R), 1.5); }), a = walk(A), b = walk(B);
      const sa = a(sam(A).id).map(key).join('|'), sb = b(sam(B).id).map(key).join('|'), ma = a(mate(A).id).map(key).join('|'), mb = b(mate(B).id).map(key).join('|');
      verdict(sa.length > 0 && ma.length > 0 && sa === sb && ma === mb, 'at rest and at a walk nothing changes: a man standing and a teammate walking at 1.5 m/s file the same records with the rule on as off, one for one',
        `ten seconds on the pass: the player standing ${a(sam(A).id).length} records / ${b(sam(B).id).length}, the same ${sa === sb} · a teammate walking ${a(mate(A).id).length} / ${b(mate(B).id).length}, the same ${ma === mb}`); }
    // (2) a sprint: thrown harder, bigger, more of it, more often
    const run = (R: any, secs: number, then = 0) => fly(R, Math.round((secs + then) * 60), i => { hold(R, sam(R), i < secs * 60 ? 4.7 : 0); hold(R, mate(R), 0); })(sam(R).id);
    const ra = run(A, 10), rb = run(B, 10), ba = breaths(ra), bb = breaths(rb), la = ra[ra.length - 1], lb = rb[rb.length - 1], firstA = ra[0], firstB = rb[0];
    { const per = (bs: any[][]) => bs[bs.length - 2]?.length ?? 0, top = (rs: any[]) => Math.max(...rs.slice(-6).map(r => r.opts.speed));
      verdict(!!la && !!lb && ba.length >= bb.length + 2 && top(ra) > top(rb) * 2 && la.count === H.count && lb.count === K.count && per(ba) === H.puffs && per(bb) === K.puffs && la.opts.size > lb.opts.size * 1.25 && vaddOf(la) > vaddOf(lb) * 1.3 && la.opts.steam <= 1,
        'a sprint: held at 4.7 m/s for ten seconds the player breathes more often, each breath more records of more puffs, thrown more than twice as fast, bigger, and leaving with more of his own pace',
        `breaths ${ba.length} / ${bb.length} (rule on / off) · records a breath ${per(ba)} / ${per(bb)} · puffs a record ${la?.count} / ${lb?.count} · thrown at ${f(top(ra))} / ${f(top(rb))} m/s · size ${f(la?.opts.size ?? 0, 3)} / ${f(lb?.opts.size ?? 0, 3)} m · steam share ${f(la?.opts.steam ?? 0)} / ${f(lb?.opts.steam ?? 0)} · carried at ${f(vaddOf(la))} / ${f(vaddOf(lb))} m/s · his first breath of the run, before the effort: size ${f(firstA?.opts.size ?? 0, 3)} / ${f(firstB?.opts.size ?? 0, 3)} m`); }
    // (3) blown sooner
    { const blownAt = (rs: any[], full: number) => (rs.find(r => r.opts.size >= full * 0.97)?.frame ?? 1e9) / 60, ta = blownAt(ra, la.opts.size), tb = blownAt(rb, lb.opts.size);
      verdict(ta < tb - 0.8 && ta <= H.up + 1.2, 'he is blown sooner: his breath is at its full size about a second and a half earlier in the run',
        `full size from ${f(ta, 1)} s of running with the rule on (the table ${H.up} s), ${f(tb, 1)} s with it off (${K.effortUp} s)`); }
    // (4) and the while after it
    { const after = (R: any) => run(R, 6, 9).filter(r => r.frame >= (6 + 3) * 60), aa = after(A), ab = after(B), rest = K.size, sz = (rs: any[]) => rs.reduce((s, r) => s + r.opts.size, 0) / Math.max(1, rs.length), endA = aa[aa.length - 1]?.opts.size ?? 0, endB = ab[ab.length - 1]?.opts.size ?? 0;
      verdict(aa.length > 0 && ab.length > 0 && sz(aa) > sz(ab) * 1.15 && aa.length > ab.length && endA > rest * 1.25 && endA > endB * 1.1,
        'and the while after it: from three to nine seconds after he stops he breathes in bigger breaths and more of them than he would have, and is still well over his resting breath at the end of it',
        `3 to 9 s after a six second sprint: mean size ${f(sz(aa), 3)} / ${f(sz(ab), 3)} m (rule on / off; at rest ${rest}) · records ${aa.length} / ${ab.length} · the last one ${f(endA, 3)} / ${f(endB, 3)} m · his wind back in ${H.down} s / ${K.effortDown} s by the tables`); }
    // (5) the chest: the player on a fresh stand of the level, nothing begun, stood still and set blown by hand. A standing man also settles and shifts
    //     his weight, so the breath's own share is read against the SAME stand with the breath's turns set to nothing: what his neck does over his hips
    //     beyond that, frame for frame (a man in a stance or a hold has no life layer: one at the stack does not heave, with the rule or without)
    { const chest = async (rule: boolean, none = false) => { const R = await rig(rule, false), c = sam(R), L = (c.anim as any).life, keep = { a: LIFE.breathAmp, r: LIFE.breathAmpRun, h: H.chestAmp };
        if (none) { LIFE.breathAmp = 0; LIFE.breathAmpRun = 0; H.chestAmp = 0; }
        try { R.g.aiEnabled = false; c.vel[0] = c.vel[2] = 0; R.step(60); L.exert = 1; L.breath = 0; let turns = 0, prev = L.breath, e3 = 0; const d: number[][] = [];
          for (let i = 0; i < 180; i++) { R.step(1); const b = c.bones; d.push([b.neck[0] - b.hips[0], b.neck[1] - b.hips[1], b.neck[2] - b.hips[2]]); if (L.breath < prev) turns++; prev = L.breath; e3 = L.exert; }
          return { d, turns, e3, still: Math.hypot(c.vel[0], c.vel[2]) }; } finally { LIFE.breathAmp = keep.a; LIFE.breathAmpRun = keep.r; H.chestAmp = keep.h; } };
      const ca = await chest(true), cb = await chest(false), na = await chest(true, true), nb = await chest(false, true);
      const share = (x: any, n: any) => Math.max(...x.d.map((v: number[], i: number) => Math.hypot(v[0] - n.d[i][0], v[1] - n.d[i][1], v[2] - n.d[i][2]))), ta = share(ca, na), tb = share(cb, nb);
      verdict(ca.still < 0.05 && cb.still < 0.05 && ta > tb * 1.3 && tb > 0.001 && ca.turns > cb.turns && ca.e3 > cb.e3 + 0.08,
        'the chest: blown and standing, the player\'s chest is moved further by his breath, he breathes more often, and three seconds on more of his effort is still on him',
        `in three seconds: the furthest his breath moves his neck over his hips ${f(ta * 1000, 1)} / ${f(tb * 1000, 1)} mm (rule on / off; against the same stand with no breath) · breaths begun ${ca.turns} / ${cb.turns} (${H.chestRate} / ${LIFE.breathRateRun} Hz) · effort left ${f(ca.e3)} / ${f(cb.e3)} (back in ${H.chestDown} / 8 s)`); }
    // (6) the game does not know until somebody runs: two fresh games, nobody past a walk, one digest
    { const D1 = await rig(true), D0 = await rig(false); D1.step(300); D0.step(300); const h1 = hashDigest(digestGame(D1.g)), h0 = hashDigest(digestGame(D0.g));
      verdict(h1 === h0, 'with nobody running the game is the game it was: one digest over five seconds of the pass\'s room clear, the rule on and off', `${h1} / ${h0}`);
      // (7) the switch
      HARDBREATH.on = true; const g = D1.g, snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.HARDBREATH?.on === 'boolean'; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.HARDBREATH;
      let offOld = false; await quiet(() => { applyKnobs(g, old); offOld = HARDBREATH.on === false; applyKnobs(g, snap); offOld &&= HARDBREATH.on === true; });
      verdict(has && offOld && typeof FROZEN_HOLDS['HARDBREATH.on'] === 'string' && /TPS_HARDBREATH=1/.test(FROZEN_HOLDS['HARDBREATH.on']), 'a recording carries the switch, one from before the key replays with it off, and the frozen stand holds it off by name',
        `in the file ${has} · off for an old file ${offOld} · FROZEN_HOLDS ${FROZEN_HOLDS['HARDBREATH.on']}`); }
  } finally { knobsBack(knobs0); SNOW_LOOK.breath = was.breath; if (was.envSnow === undefined) delete process.env.TPS_SNOW; else process.env.TPS_SNOW = was.envSnow; if (was.envBreath === undefined) delete process.env.TPS_SNOWBREATH; else process.env.TPS_SNOWBREATH = was.envBreath; console.log = log; }
  console.log(`=== hardbreath: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
