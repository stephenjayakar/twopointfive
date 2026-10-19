// A FOLLOWER IS NOT LEFT STANDING ON THE WALK OF A MAN WHO COMES TO A SOUND (SNEAK.noiseWalk; sneak.ts sneakComing, asked by the sneak's follower where it
// would wait short of a stretch that man is looking at or back off down the way he is coming, and by spotted.ts where it would stand him still).
// workthings.ts took the follower off the walk of the man SENT TO THE BREAKER (WORK.offWalk, probes.ts work-walk) and left a claim: the same hole stands
// for any suspicious man who walks to a sound where the follower waits for his back. This is that hole, on work-walk's own stage (lights out as two, the
// partner throws the breaker on order, Sam calls fall in and walks on at a sneak's pace) with ONE thing changed by hand: the errand is taken off the man
// sent to the panel and his interest is kept up as a whistle keeps it (WHISTLE.walkFloor) — he walks to the same place as a man who heard something
// there, and WORK.offWalk, on throughout, no longer answers for him. Nobody is dazzled and Sam is not kept dark.
//   bun run tools/qa/noisewalk-check.ts          (probes.ts sneak-noisewalk; NOISEWALK_BREAK=1 must FAIL — the key is left off where it is asked for)
// Staged by hand, not heard through the game's own ears: one sound alone lets a man talk himself out of it inside about ten metres.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { WORK, workComing } = await import(`${ROOT}/src/game/workthings.ts`);
const { SNEAK, SNEAK_STATS, sneakComing } = await import(`${ROOT}/src/game/sneak.ts`);
const { SPOTTED } = await import(`${ROOT}/src/game/spotted.ts`);
const { WHISTLE } = await import(`${ROOT}/src/game/whistle.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`) as any;

const DT = 1 / 60, BREAK = !!process.env.NOISEWALK_BREAK, VERBOSE = !!process.env.NOISEWALK_VERBOSE;
const f2 = (x: number) => x.toFixed(2), flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function seeded(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Sam's way on the run the breaker's check was taken from */
const WAY = [[9.3, 16.7], [9.3, 14.8], [8.7, 12.1], [9.0, 9.3], [11.0, 8.0], [13.7, 7.4], [16.1, 7.4], [17.0, 8.5], [17.1, 10.0], [17.3, 12.5], [17.7, 14.6]];
let stood: boolean | null = null;   // (the key as the stand left it, read once after the first stand-up)

async function arm(rule: boolean) {
  Math.random = seeded(21); NIGHTBREACH.squad = 2;
  const log = console.log, warn = console.warn; if (!VERBOSE) console.log = console.warn = () => { };
  try {
    const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/lights-out.json`, 'utf8'))), seed: 1 }); if (stood === null) stood = !!SNEAK.noiseWalk;
    const g = W.game; g.godMode = true; WORK.on = true; const why = startFromQuery(g, '?levelFile=lights-out.json&quiet&squad=1').why;
    const O = g.orders, pl = g.player, b: any = O.squad()[0]; if (!b) return { ok: false as const, why: `${why} no partner` };
    SNEAK.on = true; SPOTTED.on = true; WORK.offWalk = true; SNEAK.noiseWalk = rule; SNEAK_STATS.noiseWalks = 0;
    const asked = (h: any) => { const w = SNEAK.noiseWalk, n = SNEAK_STATS.noiseWalks; SNEAK.noiseWalk = true; try { return sneakComing(g, b, h); } finally { SNEAK.noiseWalk = w; SNEAK_STATS.noiseWalks = n; } };   // (the geometry, whichever way the key is; the game's own count of its asking is left as the game made it)
    let at = [...WAY[0]], seg = 0, along = 0;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { pl.crouch = true; pl.char.pos[0] = at[0]; pl.char.pos[2] = at[1]; W.step(DT); } };
    g.teleportPlayer([at[0], 0, at[1]]); b.char.pos[0] = 9.9; b.char.pos[2] = 17.3; b.path = []; b.pathGoal = null; step(60);
    const th = g.work.things().find((x: any) => x.kind === 'breaker'); if (!th?.stand) return { ok: false as const, why: 'no breaker to work' };
    O.give('work', { kind: 'floor', at: th.stand, thing: th }, 'all'); for (let i = 0; i < 25 * 60 && !g.blackout.active; i++) step();
    const t0 = g.time, man: any = g.guards.find((x: any) => x.task?.kind === 'breaker'); if (!g.blackout.active || !man) return { ok: false as const, why: `mains ${g.blackout.active ? 'out' : 'on'} · sent ${man?.callsign ?? 'nobody'}` };
    const spot = [man.task.pos[0], man.task.pos[1], man.task.pos[2]];
    // the one thing staged by hand: no errand — a man walking to where he heard something, his interest kept up as a whistle keeps it
    const noErrand = () => { man.task = null; if (man.state === 'suspicious') { if (!man.lastKnown) man.lastKnown = [...spot]; if (flat(man.char.pos, spot) > 1.2) man.awareness = Math.max(man.awareness, WHISTLE.walkFloor); } };
    noErrand(); step(72); O.give('fallIn', { kind: 'floor', at: [9, 0, 17.5] }, 'all');
    let still = 0, stillMax = 0, on = 0, off = 0, low = 0, roused: string | null = null, rousedT = -1, nearest = 1e9, fastest = 0, errand = 0, astray = 0, past = 0;
    for (let f = 0; f < 26 * 60; f++) {
      if (g.time - t0 > 5.2 && seg < WAY.length - 1) { along += 1.4 * DT;
        for (let L = Math.hypot(WAY[seg + 1][0] - WAY[seg][0], WAY[seg + 1][1] - WAY[seg][1]); seg < WAY.length - 1 && along >= L;) { along -= L; seg++; if (seg < WAY.length - 1) L = Math.hypot(WAY[seg + 1][0] - WAY[seg][0], WAY[seg + 1][1] - WAY[seg][1]); }
        if (seg < WAY.length - 1) { const L = Math.hypot(WAY[seg + 1][0] - WAY[seg][0], WAY[seg + 1][1] - WAY[seg][1]), k = along / L; at = [WAY[seg][0] + (WAY[seg + 1][0] - WAY[seg][0]) * k, WAY[seg][1] + (WAY[seg + 1][1] - WAY[seg][1]) * k]; } else at = [...WAY[seg]]; }
      noErrand(); step();
      const v = Math.hypot(b.char.vel[0], b.char.vel[2]), coming = man.state !== 'dead' && asked(man), gap = flat(b.char.pos, pl.char.pos); fastest = Math.max(fastest, v);
      if (man.state !== 'dead' && workComing(g, b, man)) errand++;
      if (coming) { on++; if (b.char.anim.crouch > 0.5) low++; if (!man.lastKnown || flat(man.lastKnown, spot) > 1) astray++; } else { off++; if (on > 0 && man.state === 'suspicious') past++; }   // (past: still about his business, and no longer walking over the partner — gone by, or stood at the place looking round)
      if (coming && v < 0.1 && gap > 3) { still += DT; stillMax = Math.max(stillMax, still); } else still = 0;
      if (man.state !== 'dead') nearest = Math.min(nearest, flat(b.char.pos, man.char.pos));
      if (!roused) { const h = g.guards.find((x: any) => x.team !== 'operative' && (x.state === 'alert' || x.state === 'search' || x.state === 'dead')); if (h) { roused = `${h.callsign} ${h.state}`; rousedT = g.time - t0; } }
    }
    return { ok: true as const, g, man: man.callsign, partner: b.callsign, stillMax, on, off, low, roused, rousedT, nearest, fastest, errand, astray, past, asks: SNEAK_STATS.noiseWalks as number, gap: flat(b.char.pos, pl.char.pos) };
  } finally { console.log = log; console.warn = warn; }
}

export async function noisewalkCheck(): Promise<boolean> {
  console.log('\n=== sneak-noisewalk: a follower is not left standing on the walk of a man who comes to a sound ===');
  let all = true; const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  const knobs0 = knobsCopy(), rnd = Math.random, sq = NIGHTBREACH.squad;
  try {
    const A = await arm(false);
    verdict(A.ok && A.on > 60 && A.errand === 0 && A.astray === 0 && A.asks === 0, 'staged: lights out as two, the mains thrown, a man with NO errand walks to the panel as to a sound, Sam calls fall in and walks on', A.ok ? `${A.partner} threw it · ${A.man} walks there with no errand · his walk passed within ${SNEAK.noiseWalkM} m of the partner on ${A.on} frames, the place he was going to moved off the panel on ${A.astray} of them · the breaker man's rule (on) answered for him on ${A.errand} · the game answered yes with the key off ${A.asks} times` : A.why);
    if (!A.ok) return false;
    const shipped = (process.env.TPS_PROFILE ?? '') === 'shipped', word = process.env.TPS_NOISEWALK === '1';
    verdict(stood === (shipped || word), 'the stand: off on the frozen stand unless its word raises it, on on the shipped one', `stood up ${stood} · ${shipped ? 'shipped' : 'frozen'}${word ? ' with TPS_NOISEWALK=1' : ''}`);
    verdict(A.stillMax >= 2 && !!A.roused && /alert|search/.test(A.roused ?? ''), 'THE FAULT, key off: the follower stood still on that man\'s walk with Sam gone on, and was walked into', `stood still on the walk ${f2(A.stillMax)} s (Sam over 3 m off) · ${A.roused ?? 'nobody roused'}${A.roused ? ` ${f2(A.rousedT)} s after the throw` : ''} · the man came within ${f2(A.nearest)} m`);
    const B = await arm(!BREAK);
    if (!B.ok) { verdict(false, 'staged again, key on', B.why); return false; }
    verdict(!B.roused, 'key on: nobody is roused', `${B.roused ? `${B.roused} ${f2(B.rousedT)} s after the throw` : 'no defender alert, searching or down'} · nearest the man came ${f2(B.nearest)} m`);
    verdict(B.stillMax < 1 && B.gap < 3, 'key on: he does not stand on that walk with Sam gone on, and ends at Sam\'s shoulder', `longest still on the walk ${f2(B.stillMax)} s (key off ${f2(A.stillMax)}) · ${f2(B.gap)} m from Sam at the end`);
    verdict(B.fastest <= ORDERS.brisk + 0.25 && B.low >= B.on * 0.9, 'he never ran for it: a walk, low with Sam the whole of that walk', `fastest ${f2(B.fastest)} m/s (brisk ${ORDERS.brisk}) · low on ${B.low} of the ${B.on} frames on the walk`);
    verdict(B.past > 60 && B.on > 60 && B.errand === 0 && B.astray === 0 && B.asks > 0, 'the rule is that walk\'s and the game\'s own asking: with the man gone by, or stood at the place looking round, it no longer answers; the breaker man\'s rule never did', `frames on the walk ${B.on} · the game answered yes ${B.asks} times · frames after it with the man still about it ${B.past} · the place he was going to moved on ${B.astray} · the breaker man's rule answered on ${B.errand}`);
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), PR: any = await import(`${ROOT}/src/host/profile.ts`), SE: any = await import(`${ROOT}/src/host/standEnv.ts`), g = B.g;
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      SNEAK.noiseWalk = true; const old = snap(); if (old.tables.SNEAK) delete old.tables.SNEAK.noiseWalk; J.applyKnobs(g, old); const before = SNEAK.noiseWalk;
      SNEAK.noiseWalk = true; const recOn = snap(); SNEAK.noiseWalk = false; J.applyKnobs(g, recOn); const kept = SNEAK.noiseWalk;
      SNEAK.noiseWalk = false; const recOff = snap(); SNEAK.noiseWalk = true; J.applyKnobs(g, recOff); const keptOff = SNEAK.noiseWalk;
      verdict(before === false && kept === true && keptOff === false && PR.FROZEN_HOLDS['SNEAK.noiseWalk'] === 'TPS_NOISEWALK=1' && SE.STAND_ENV.includes('TPS_NOISEWALK'), 'a recording from before the key replays with the rule off; one made with it on replays on, off off; the stands\' list has the row',
        `a recording without the key: ${before} · recorded on: ${kept} · recorded off: ${keptOff} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['SNEAK.noiseWalk'] ?? 'no row'} · STAND_ENV ${SE.STAND_ENV.includes('TPS_NOISEWALK')}`); }
  } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); all = false; }
  finally { knobsBack(knobs0); Math.random = rnd; NIGHTBREACH.squad = sq; }
  console.log(`=== sneak-noisewalk: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await noisewalkCheck()) ? 0 : 1);
