// THE MEN WITH SAM STEP BACK FROM A SET WALL CHARGE — the check behind WALLCHARGE.menClear (src/game/wallcharge.ts clearOf, asked by orders.ts of a man on
// 'fall in': on in the page, ?menclear=0; off on the frozen stand, TPS_MENCLEAR=1; acts only with WALLCHARGE.safe, which this check raises as the wall
// charge's own probes do).
//   bun run tools/qa/menclear-check.ts        (also `probes.ts menclear`)
// The maintainer's own case (The pass, 10-16, the trigger's row reading TOO CLOSE with two of his men named: "after i place a wall charge, my guys should
// move away with standoff"): the four on 'fall in', Sam at the foot of the bunk room's long wall in the yard with a charge of his own on it, the men bunched
// beside him.
//   (1) the stand: the switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) the rule off: the men keep their places in the file, and the row names them — the fault as he met it;
//   (3) the rule on: seconds later the row names nobody but Sam, every man stands out of the blast on a mark of his own, and none of them ran;
//   (3s) the squad silent, as his was: the same, at a walk;
//   (4) Sam walks clear: the men leave their marks and fall in on him;
//   (5) Sam back at the wall: they stand off again;
//   (5b) a second charge on the wall beside their marks: dealt again, out of both blasts;
//   (6) a man on an order of his own keeps it: told to hold inside the radius, he holds, and the row names him;
//   (7) the charge gone off the wall: nobody is kept on a mark, and the file closes up on Sam;
//   (8) a recording from before the key replays with it off; the page's boot: no flag = on, ?menclear=0 = off.
// MENCLEAR_BREAK=1 = the switch left off where the lines want it on: they are asked all the same and must fail on what they find.   exit 0 = all hold · 1 = one does not
// Headless: lines are the collision's own. Never seen on a GPU; nobody has played it.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
const { WALLCHARGE, wallAt, wallPt, safeRadius } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { SILENT, setSilent, squadSilent } = await import(`${ROOT}/src/game/silent.ts`);
const { SNEAK, sneaking } = await import(`${ROOT}/src/game/sneak.ts`);
type Vec3 = [number, number, number];

/** the charge's place on the wall's yard face (wallAt takes a point within WALLCHARGE.pickM of it), where Sam walks clear to, and the bunch: each man's place off the setter's spot */
const CHARGE: Vec3 = [31.28, 0, 18.14], AWAY: Vec3 = [20.5, 0, 21.5];
const BUNCH: [number, number][] = [[-0.9, 0.5], [0.9, 0.5], [-0.5, 1.4], [0.6, 1.5]];

export async function menclearCheck(): Promise<boolean> {
  const BREAK = process.env.MENCLEAR_BREAK === '1', RULE = !BREAK;
  console.log(`\n=== menclear: the men with Sam step back from a charge set on a wall${BREAK ? ' — MENCLEAR_BREAK: the rule never on' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const knobs0 = knobsCopy(), destr0 = DESTRUCTION.on, rnd0 = Math.random;
  const log = console.log, quiet = async <T>(fn: () => Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
  const data = parseLevelData(readFileSync(`${ROOT}/levels/pass.json`, 'utf8'));
  try {
    // (1) the stand, read off the first stand-up before the check sets anything
    { const W: any = await quiet(() => standUp({})); void W; const stood = WALLCHARGE.menClear;
      const word = process.env.TPS_MENCLEAR, shipped = process.env.TPS_PROFILE === 'shipped', want = word !== undefined ? word === '1' : shipped, row = FROZEN_HOLDS['WALLCHARGE.menClear'];
      line(stood === want && typeof row === 'string' && /TPS_MENCLEAR=1/.test(row), `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen digest was recorded'}; FROZEN_HOLDS carries the row and its word`,
        `after the stand-up: ${stood} · TPS_MENCLEAR ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · FROZEN_HOLDS['WALLCHARGE.menClear'] = ${row ?? 'MISSING'}`); }

    /** The pass, the four in the yard on 'fall in', bunched at the foot of the wall beside Sam; every defender out of the way; then his charge on the wall */
    const stage = async (rule: boolean, silent = false) => {
      DESTRUCTION.on = true; WALLCHARGE.on = true;   // (the destruction switch raised as the wall charge's own probes raise it)
      const W: any = await quiet(() => standUp({ level: loadLevel(data), seed: 1 })); const g = W.game; g.godMode = true; g.tune.chaos = 0.5;
      WALLCHARGE.outer = true; WALLCHARGE.safe = true; WALLCHARGE.menClear = rule;   // (after the stand-up: the frozen stand holds them off)
      const why = await quiet(async () => startFromQuery(g, '?levelFile=pass.json&roomclear&squad4').why); if (why) throw new Error(`start refused — ${why}`);
      if (silent) { SILENT.on = true; SNEAK.on = true; setSilent(g, true); }   // (the squad silent, as his was: the sneak's own carriage)
      const O = g.orders, C = g.wallCharge, nav = g.col.nav, men: any[] = O.men('all'), peak = new Map<any, number>();
      /** stepped a 60th at a time, each man's fastest metre a second kept (over a tenth of a second: a shove is not his pace) */
      const step = (secs: number) => { for (let i = 0; i < Math.round(secs * 6); i++) { const was = men.map(m => [m.char.pos[0], 0, m.char.pos[2]]);
        for (let k = 0; k < 10; k++) W.step(1 / 60); men.forEach((m, j) => peak.set(m, Math.max(peak.get(m) ?? 0, flat(m.char.pos, was[j]) * 6))); } };
      const put = (gd: any, p: number[]) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.path = []; gd.pathGoal = null; gd.speed = 0; };
      for (const h of g.guards.filter((h: any) => h.team === 'hostile')) put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
      const Wl = wallAt(g, CHARGE), spot: Vec3 | null = Wl ? (C as any).setSpot(Wl) : null; if (!Wl || !Wl.ok || !spot) return null;
      const bunch = () => men.forEach((m, i) => { const b = BUNCH[i % BUNCH.length], q = nav.nearestFreePoint(spot[0] + b[0], spot[2] + b[1]); put(m, [q[0], 0, q[2]]); });
      const sam = (p: Vec3) => { g.teleportPlayer(p); };
      sam(spot); bunch(); step(0.5); O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); bunch(); step(1.5); peak.clear();
      const set = () => { const c = { wall: Wl, t: g.time, by: 'Sam', paid: 0 }; C.set.push(c); return c; };
      const hit = (p: number[]) => C.blastShare(Wl, p, undefined, false) > 0;
      const where = () => men.map(m => `${m.callsign} ${at(m.char.pos)}${hit(m.char.pos) ? ' IN' : ''}`).join(' · ');
      return { W, g, O, C, men, Wl, spot, step, put, sam, set, hit, where, peak };
    };

    // (2) the rule off: the fault as he met it
    { const S = await stage(false); if (!S) { line(false, 'the bunk room\'s long wall takes a charge from the yard'); return false; }
      const c = S.set(); S.step(6); const close: string[] = S.C.tooClose(c), mates = close.filter(n => n !== 'you');
      line(mates.length >= 2 && S.C.stats.cleared === 0, 'the rule off: six seconds after his charge goes on the wall the men stand where they stood, and the row names them',
        `too close: ${close.join(', ') || 'nobody'} · ${S.where()} · stepped back ${S.C.stats.cleared}`); }

    const S = await stage(RULE); if (!S) { line(false, 'the bunk room\'s long wall takes a charge from the yard'); return false; }
    const brisk: number = S.O.knobs.brisk, R = safeRadius(S.g, S.Wl);
    // (3) the rule on
    { const in0 = S.men.filter(m => S.hit(m.char.pos)).length, c = S.set(); let took = 0; while (took < 6 && S.C.tooClose(c).join() !== 'you') { S.step(0.5); took += 0.5; } S.step(6 - took);
      const close: string[] = S.C.tooClose(c), out = S.men.every(m => !S.hit(m.char.pos)), apart = S.men.every((m, i) => S.men.every((o, j) => j <= i || flat(m.char.pos, o.char.pos) > 0.5));
      const top = Math.max(...S.men.map(m => S.peak.get(m) ?? 0));
      const marks0 = S.men.map(m => { const a = (S.C as any).away.get(m); return a ? `${at(a.at)} ${flat(a.at, wallPt(S.Wl, 0, 0)).toFixed(2)} m` : '–'; }).join(' ');
      const off = S.men.every(m => S.C.blastShare(S.Wl, m.char.pos, { ...R, reach: R.standoff - 0.3 }, false) === 0);   // (at the stand-off or out of its line, not only past the reach)
      line(in0 >= 2 && close.join() === 'you' && out && off && apart && S.C.stats.cleared === in0 && top <= brisk * 1.1,
        'the rule on: six seconds after his charge goes on the wall the row names nobody but him, every man stands at the stand-off or out of its line on a place of his own, each dealt a mark once, and nobody went faster than the pace a man steps out of Sam\'s way at',
        `in the blast before: ${in0} of ${S.men.length} · too close: ${close.join(', ') || 'nobody'} · ${S.where()} · at the stand-off: ${off} · marks ${marks0} · clear after ${took.toFixed(1)} s · stepped back ${S.C.stats.cleared} · fastest ${top.toFixed(2)} m/s (brisk ${brisk}) · reach ${R.reach} m, stand-off ${R.standoff} m`);
      // (3s) the squad silent, as his was
      { const Q = await stage(RULE, true); if (!Q) { line(false, 'the silent squad\'s stage'); return false; }
        const was = squadSilent(Q.g) && Q.men.every(m => sneaking(Q.g, m)), in1 = Q.men.filter(m => Q.hit(m.char.pos)).length, c1 = Q.set(); let secs = 0; while (secs < 12 && Q.C.tooClose(c1).join() !== 'you') { Q.step(0.5); secs += 0.5; }
        Q.step(4); const R1 = safeRadius(Q.g, Q.Wl), off1 = Q.men.every(m => Q.C.blastShare(Q.Wl, m.char.pos, { ...R1, reach: R1.standoff - 0.3 }, false) === 0);
        const walk: number = Q.O.knobs.walk, top1 = Math.max(...Q.men.map(m => Q.peak.get(m) ?? 0)), close1: string[] = Q.C.tooClose(c1);
        line(was && in1 >= 2 && close1.join() === 'you' && off1 && top1 <= walk * 1.1, 'the squad silent and nobody on to it: they step back all the same, at a walk',
          `silent and sneaking: ${was} · in the blast before: ${in1} · clear after ${secs.toFixed(1)} s · at the stand-off four seconds on: ${off1} · too close: ${close1.join(', ') || 'nobody'} · ${Q.where()} · fastest ${top1.toFixed(2)} m/s (walk ${walk})`); }
      // (4) Sam walks clear: they leave their marks and fall in on him
      const stood = S.C.stats.cleared; S.sam(AWAY); S.step(9); const held = (S.C as any).away.size, far = S.men.map(m => flat(m.char.pos, S.g.player.char.pos));
      line(stood >= 2 && held === 0 && far.every(d => d < 6), 'Sam well clear of it: nine seconds later nobody is kept on a mark and the four are with him', `stood off before: ${stood} · kept on marks: ${held} · from Sam: ${far.map(d => d.toFixed(1)).join(', ')} m`);
      // (5) Sam back at the wall: they stand off again
      S.sam(S.spot); S.step(9); const close2: string[] = S.C.tooClose(c);
      line(close2.join() === 'you' && S.men.every(m => !S.hit(m.char.pos)), 'Sam back at the foot of the wall: nine seconds later the row names nobody but him', `too close: ${close2.join(', ') || 'nobody'} · ${S.where()}`);
      // (5b) a second charge on the wall beside their marks: the marks are dealt again, out of both
      { let at2: Vec3 = [S.men[0].char.pos[0], 0, CHARGE[2]], W2 = wallAt(S.g, at2); const was = S.C.stats.cleared;
        for (let x = at2[0]; x < CHARGE[0] - 1.5 && !(W2 && W2.ok); x += 0.3) { at2 = [x, 0, CHARGE[2]]; W2 = wallAt(S.g, at2); }   // (the first place along the wall from their marks that takes one)
        if (!W2 || !W2.ok) line(false, 'a second place on the wall, by the men\'s marks, takes a charge', `wall at ${at(at2)}: ${W2 ? `${W2.index} ok ${W2.ok} ${W2.why ?? ''}` : 'none'}`);
        else { const c2 = { wall: W2, t: S.g.time, by: 'Sam', paid: 0 }, in2 = S.men.filter(m => S.C.blastShare(W2, m.char.pos, undefined, false) > 0).length; S.C.set.push(c2); S.step(9);
          const closeA: string[] = S.C.tooClose(c), closeB: string[] = S.C.tooClose(c2), mates = [...closeA, ...closeB].filter(n => n !== 'you');
          line(in2 >= 1 && mates.length === 0 && S.C.stats.cleared > was, 'a second charge on the wall beside their marks: nine seconds later no man of his is in either blast', `in the second blast before: ${in2} · too close to the first: ${closeA.join(', ') || 'nobody'} · to the second: ${closeB.join(', ') || 'nobody'} · ${S.men.map(m => `${m.callsign} ${at(m.char.pos)}`).join(' · ')} · dealt again ${S.C.stats.cleared - was} · the second charge at ${at(wallPt(W2, 0, 0))} · marks: ${S.men.map(m => { const a = (S.C as any).away.get(m); return a ? at(a.at) : '–'; }).join(' ')}`);
          S.C.set.splice(S.C.set.indexOf(c2), 1); S.step(6); } }
      // (6) a man on an order of his own keeps it
      { const one = S.men[0], q = S.g.col.nav.nearestFreePoint(S.spot[0] - 1.0, S.spot[2] + 0.9), mark: Vec3 = [q[0], 0, q[2]], was = S.hit(mark);
        S.put(one, mark); const why = S.O.give('hold', S.O.targetAt(mark), S.O.squad().indexOf(one)); S.step(5); const off = flat(one.char.pos, mark), close3: string[] = S.C.tooClose(c);
        line(was && !why && off < 0.6 && close3.includes(one.callsign), 'a man told to hold inside the radius holds, and the row names him: the rule is for the men on fall in', `hold → ${why ?? 'taken'} · mark ${at(mark)} in the blast: ${was} · ${one.callsign} ${off.toFixed(1)} m off it five seconds on · too close: ${close3.join(', ') || 'nobody'}`);
        S.O.give('fallIn', S.O.targetAt(S.g.player.char.pos), 'all'); S.step(6); }
      // (7) the charge gone off the wall
      { const before = (S.C as any).away.size; S.C.set.splice(S.C.set.indexOf(c), 1); S.step(8); const held2 = (S.C as any).away.size, far2 = S.men.map(m => flat(m.char.pos, S.g.player.char.pos));
        line(before >= 2 && held2 === 0 && Math.min(...far2) < 2.5 && far2.every(d => d < 6), 'the charge off the wall: nobody is kept on a mark, and eight seconds later the file has closed up on him at the wall\'s foot', `kept on marks before: ${before} · after: ${held2} · from Sam: ${far2.map(d => d.toFixed(1)).join(', ')} m`); } }
    // (8) a recording from before the key replays with the rule off; the page's own boot
    { const g = S.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      WALLCHARGE.menClear = true; const old = snap(); delete old.tables.WALLCHARGE.menClear; JOURNAL.applyKnobs(g, old); const without = WALLCHARGE.menClear;
      const own = snap(); own.tables.WALLCHARGE.menClear = true; JOURNAL.applyKnobs(g, own); const withIt = WALLCHARGE.menClear;
      line(without === false && withIt === true, 'a recording from before the key replays with the rule off; one that carries it on plays with it on', `applyKnobs with no key → ${without} · with the key on → ${withIt}`);
      PROFILE.pageSwitches(new URLSearchParams('')); const a = WALLCHARGE.menClear; PROFILE.pageSwitches(new URLSearchParams('menclear=0')); const b = WALLCHARGE.menClear; PROFILE.pageSwitches(new URLSearchParams('standfire=0')); const c = WALLCHARGE.menClear;
      line(a === true && b === false && c === true, 'the page\'s boot (pageSwitches): no flag → on · ?menclear=0 → off · another flag leaves it on', `'' → ${a} · 'menclear=0' → ${b} · 'standfire=0' → ${c}`); }
  } finally { console.log = log; knobsBack(knobs0); DESTRUCTION.on = destr0; Math.random = rnd0; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== menclear: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await menclearCheck()) ? 0 : 1);
