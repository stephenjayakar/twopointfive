// OFF THE LINE OF HIS FIRE — the check behind src/game/fireline.ts (FIRELINE.on: on in the page, ?nofireline; off on the frozen stand, TPS_FIRELINE=1).
//   bun run tools/qa/fireline-check.ts        (also `probes.ts fireline`; passes on both stands: it throws the switches itself)
// The room clear's floor with the pair (doortools-probes.ts rig), the defenders kept calm in their rooms by hand, friendly fire ON in every arm (a round
// of Sam's is a round to his own men). Sam stands on the middle aisle of the cubicles and fires the rifle down it with real clicks, five every two seconds; a
// teammate is given the menu's own 'move there' from one side of the aisle to the other, down the passage that crosses it 6.5 m ahead of the muzzle:
//   (1) the stand: off on the frozen stand unless its word raises it, on on the shipped one;
//   (2) THE FAULT, rule off: he walks his order into the lane while the rounds are going down it;
//   (3) rule on: he stops short of the lane, stands there for as long as the fire lasts, and is never in it under fire;
//   (4) the fire stopped: he walks on and is on his mark — he never ran for any of it;
//   (5) no way round worth walking from there (it is a long way back round the block): he looked, found none, and waited on;
//   (6) Sam a stride back from the crossing instead: after the wait's ceiling he walks round BEHIND Sam and is on his mark with the fire still going,
//       never in the lane and never over a walk;
//   (7) a man ALREADY in the lane when the fire starts is not held by the rule — and a round laid on a teammate standing in it finds him: nothing here
//       stops, bends or passes a round;
//   (8) a living defender with a line to where he would wait: he is not held there — by a fight of his own; with the room fight's word shut by hand, by
//       what he himself knows of an enemy's line; and a defender NOBODY on the squad knows of excuses nobody (he waits);
//   (9) a recording from before the table replays with the rule off, one made on replays on; the stands' list has the row and its word;
//  (10) sent to a place up the lane itself (his way turns the corner into it on the slant): he stops clear of its side and goes on when the fire stops;
//       and 'fall in' from the same place leaves him by Sam with no frame in the lane under fire (on the frozen stand by the same wait; the shipped
//       stand's file walks him round behind Sam, a way that never comes near the lane);
//  (11) a new order given while he is on his way round: he goes where the new one sends him, not on round to the old place;
//  (12) Sam changes magazines in the middle of the string: the wait lasts through the reload — one wait, and no frame in the lane before the last round;
//  (13) slow aimed fire, a round every 1.3 s: one wait and one word for the whole string, and no frame in the lane before the last round.
// NOT here (read in the module, not staged): a door order past its stack, a man on a wall charge, a man in a doorway, a man stepping out of Sam's way or
// mid-crossing for the silent squad, the gun swung onto a waiting man; the room fight's own lanes; the page (fireline-page.cjs).
// FIRELINE_BREAK=1 = the switch left off where an arm asks for it: (3), (4), (5), (6), (8), (10), (11), (12) and (13) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
const DT = 1 / 60, BREAK = process.env.FIRELINE_BREAK === '1', VERBOSE = !!process.env.FIRELINE_VERBOSE;
const f2 = (x: number) => x.toFixed(2), flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** the aisle Sam fires down (z), where the passage crosses it (x), and the teammate's two ends */
const Z = 18.0, X = 19.5, FROM = [X, 0, 22.4], TO = [X, 0, 14.6];
let stood: boolean | null = null;   // (the switch as the stand left it, read once after the first stand-up)

interface Arm { rule: boolean; /** shut by hand for the teammate: 'fight' = the room fight never calls him busy (what he knows of the enemy stands) · 'all' = that, and nothing he has says there is an enemy at all */ blind?: 'fight' | 'all'; /** 'fall in' on Sam instead of 'move there' */ fallIn?: boolean; /** 'move there' to here instead of the far side */ to?: number[]; /** a new 'move there', to here, the moment he takes a way round */ reorder?: number[]; /** Sam reloads this many seconds into the fire (the clicks go on) */ reload?: number; /** where Sam stands */ sam: number[]; /** seconds of fire */ fire: number; /** frames between clicks (default 24: five rounds every two seconds) */ every?: number; /** the teammate starts here (default: FROM) */ from?: number[]; /** the fire starts when he is this near the aisle's line, m (default: at once) */ startAt?: number; /** a defender stood here, alive and calm */ foe?: number[]; knobs?: Record<string, number> }

async function arm(o: Arm) {
  const { rig } = await import('./doortools-probes.ts');
  const { FIRELINE, FIRELINE_STATS: ST } = await import(`${ROOT}/src/game/fireline.ts`);
  const { FRIENDLYFIRE, FRIENDLYFIRE_STATS: FF } = await import(`${ROOT}/src/game/friendlyfire.ts`);
  const { FRIENDS } = await import(`${ROOT}/src/game/friends.ts`);
  const { hostileTo } = await import(`${ROOT}/src/game/teams.ts`);
  const { PICTURE } = await import(`${ROOT}/src/game/picture.ts`);
  const { TEAMPACE } = await import(`${ROOT}/src/game/teampace.ts`);
  const { harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const log = console.log, warn = console.warn; if (!VERBOSE) console.log = console.warn = () => { };
  try {
    const R: any = await rig(5101, { stage: 'rc' }); const { W, game, input } = R, pl = game.player, O = game.orders; if (stood === null) stood = !!FIRELINE.on;
    FIRELINE.on = o.rule && !BREAK; Object.assign(FIRELINE, o.knobs ?? {}); FRIENDLYFIRE.on = true; FRIENDS.lowReady = false; FRIENDS.noSnap = true;
    // the team's slower walk (teampace.ts) is left as the stand has it: on, on the page's stand, where every arm reads the same with it. Only a FROZEN stand
    // with the walk raised by hand (TPS_TEAMPACE=1) is held off: there arms (6) and (11) stand Sam where one cell of floor behind him is 2 mm outside the
    // lane's berth at the moment a man walking at that pace looks for his way round, and inside it a half second later.
    if (harnessProfile() === 'frozen') TEAMPACE.on = false;
    for (const k of Object.keys(ST)) (ST as any)[k] = 0; const hit0 = FF.samOnMate;
    const mate = R.ops[0], other = R.ops[1], foes = R.hostiles.filter((h: any) => h.state !== 'dead'), foe = o.foe ? foes[0] : null; if (foe) foe.god = true;   // (he is there to have a line, not to be shot)
    const put = (gd: any, p: number[]) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel[0] = gd.char.vel[2] = 0; gd.path = []; gd.pathGoal = null; };
    const home = new Map<any, number[]>(); for (const h of foes) home.set(h, [h.char.pos[0], 0, h.char.pos[2]]);
    /** the defenders hear nothing and stay where they are; the second teammate is parked out of it */
    const calm = () => { for (const h of game.guards) if (hostileTo(h, 'player') && h.state !== 'dead') { h.state = 'patrol'; h.awareness = 0; if (h === foe) put(h, o.foe!); else if (home.has(h)) put(h, home.get(h)!); } put(other, [10, 0, 22.6]); };
    let aimAt: number[] = [o.sam[0] + 9, 1.3, Z], trigger = false, f = 0;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { calm(); pl.char.pos[0] = o.sam[0]; pl.char.pos[2] = o.sam[2]; W.cursorAt(aimAt as any); if (trigger && f % (o.every ?? 24) === 0) { pl.fireCd = 0; input.clicked |= 1; } f++; R.step(); } };
    game.teleportPlayer(o.sam); put(mate, o.from ?? FROM); step(30);
    if (!pl.rifleUp) { input.pressed.add('Digit2'); step(1); if (!pl.rifleUp) { input.pressed.add('KeyE'); step(1); } step(90); }
    if (pl.rifle.def.auto && pl.rifle.automatic) { input.pressed.add('KeyB'); step(2); }   // (SEMI: a click a round)
    const yaw = pl.char.aimYaw, dx = Math.sin(yaw), dz = Math.cos(yaw);
    /** how far off the gun's own line a man is, and how far along it (the muzzle's, this frame) */
    const off = (p: ArrayLike<number>) => { const m = pl.char.muzzle; const rx = p[0] - m[0], rz = p[2] - m[2]; return { along: rx * dx + rz * dz, side: Math.abs(rx * dz - rz * dx) }; };
    const laneHalf = (along: number) => FRIENDLYFIRE.bodyM + FIRELINE.clearM + along * FRIENDLYFIRE.coneK * FIRELINE.spread;
    if (o.blind) game.fight.busy = () => false; if (o.blind === 'all') { game.fight.contact = () => false; PICTURE.on = false; }
    const dest = o.fallIn ? o.sam : o.to ?? TO, destR = o.fallIn ? 3 : 0.5;
    const why = o.fallIn ? O.give('fallIn', O.targetAt(o.sam), undefined, { men: [mate] }) : O.give('move', O.targetAt(dest), undefined, { men: [mate] });
    let fired = 0, inLane = 0, inBody = 0, still = 0, stillMax = 0, nearest = 1e9, fastest = 0, t0 = -1, tStop = -1, tThere = -1, movedAfter = -1, behind = 0, underFire = false, re = -1, reWhy: string | null = null, tThere2 = -1, reloadF = 0, reloaded = false, inString = 0; const shots0 = pl.rifle.shotsFired;
    const trace: string[] = [];
    for (let i = 0; i < (o.fire + 14) * 60; i++) {
      const p = mate.char.pos;
      if (t0 < 0 && (o.startAt === undefined || Math.abs(p[2] - Z) <= o.startAt)) { t0 = game.time; trigger = true; f = 0; }
      if (t0 >= 0 && tStop < 0 && game.time - t0 >= o.fire) { trigger = false; tStop = game.time; }
      if (o.reload !== undefined && !reloaded && t0 >= 0 && game.time - t0 >= o.reload) { reloaded = true; input.pressed.add('KeyR'); }
      if (o.reorder && re < 0 && ST.ways === 1) { re = game.time; reWhy = O.give('move', O.targetAt(o.reorder), undefined, { men: [mate] }); }
      step();
      if (pl.rifle.reloading) reloadF++;
      const firing = pl.rifle.shotsFired > shots0 && game.time - pl.lastFireT < FIRELINE.fireS, q = off(p), v = Math.hypot(mate.char.vel[0], mate.char.vel[2]); fastest = Math.max(fastest, v);
      if (pl.rifle.shotsFired > shots0 && tStop < 0 && q.along > 0.15 && q.side <= laneHalf(q.along)) inString++;
      if (firing) { if (q.along > 0.15 && q.side <= laneHalf(q.along)) inLane++; if (q.along > 0.15 && q.side <= 0.28) inBody++; nearest = Math.min(nearest, q.side - laneHalf(Math.max(0, q.along)));
        if (v < 0.1) { still += DT; stillMax = Math.max(stillMax, still); } else still = 0; if ((p[0] - pl.char.pos[0]) * dx + (p[2] - pl.char.pos[2]) * dz < -0.3) behind++; }
      if (tStop >= 0 && movedAfter < 0 && v > 0.5) movedAfter = game.time - tStop;
      if (tThere < 0 && flat(p, dest) < destR) { tThere = game.time; underFire = firing; }
      if (o.reorder && re >= 0 && tThere2 < 0 && flat(p, o.reorder) < 0.6) tThere2 = game.time;
      if (VERBOSE && i % 30 === 0) trace.push(`${f2(game.time - (t0 < 0 ? game.time : t0))}s ${mate.callsign} ${f2(p[0])},${f2(p[2])} v ${f2(v)} side ${f2(q.side)} along ${f2(q.along)} ${firing ? 'FIRE' : ''} ${mate.state}`);
      if ((tThere >= 0 || tThere2 >= 0) && tStop >= 0 && game.time - tStop > 1.5) break;
    }
    fired = pl.rifle.shotsFired - shots0;
    if (VERBOSE) { console.log = log; console.log(trace.join('\n')); if (foe) console.log('foe', foe.callsign, foe.team, foe.state, foe.char.pos, 'blocked', game.col.segmentBlocked([foe.char.pos[0], 1.6, foe.char.pos[2]], [mate.char.pos[0], 1.2, mate.char.pos[2]])); console.log(JSON.stringify({ why, ST, fired })); }
    return { g: game, why, mate: mate.callsign as string, state: mate.state as string, up: mate.state !== 'dead' && mate.char.alive, fired, inLane, inBody, stillMax, nearest, fastest, hit: FF.samOnMate - hit0,
      there: tThere >= 0, thereUnderFire: underFire, movedAfter, behind, re, reWhy, there2: tThere2 >= 0, reloadF, inString, st: { ...ST } as Record<string, number>, bad: R.bad as string };
  } finally { console.log = log; console.warn = warn; }
}

export async function firelineCheck(): Promise<boolean> {
  console.log('\n=== fireline: a teammate walking on an order waits short of the lane the player is firing down, and crosses when he stops ===');
  let all = true; const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`) as any;
  const { FIRELINE } = await import(`${ROOT}/src/game/fireline.ts`);
  const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
  const knobs0 = knobsCopy(), rnd = Math.random;
  try {
    const FAR = [13, 0, Z], NEAR = [18.1, 0, Z];
    const A = await arm({ rule: false, sam: FAR, fire: 7 });
    const shipped = (process.env.TPS_PROFILE ?? '') === 'shipped', word = process.env.TPS_FIRELINE === '1';
    verdict(stood === (shipped || word), 'the stand: off on the frozen stand unless its word raises it, on on the shipped one', `stood up ${stood} · ${shipped ? 'shipped' : 'frozen'}${word ? ' with TPS_FIRELINE=1' : ''}`);
    verdict(!A.why && A.fired >= 12 && A.inLane >= 20 && A.st.holds === 0, 'THE FAULT, rule off: Sam fires down the aisle and a teammate\'s \'move there\' walks him into the lane under fire',
      `${A.mate}: ${A.fired} rounds · ${A.inLane} frames inside the lane while they flew, ${A.inBody} of them on the gun's own line · ${A.hit} of Sam's rounds found him (${A.state}) · waits ${A.st.holds}${A.why ? ` · order refused: ${A.why}` : ''}`);
    const B = await arm({ rule: true, sam: FAR, fire: 7 });
    verdict(!B.why && B.fired >= 12 && B.inLane === 0 && B.stillMax >= 4 && B.nearest > 0.2 && B.hit === 0 && B.up && B.st.holds === 1 && B.st.enemy === 0, 'rule on: he stops short of the lane, stands there while the fire lasts, and is never in it under fire',
      `${B.mate}: ${B.fired} rounds · frames in the lane ${B.inLane} (rule off ${A.inLane}) · stood ${f2(B.stillMax)} s · nearest its edge ${f2(B.nearest)} m · rounds into him ${B.hit} · waits ${B.st.holds}${B.why ? ` · order refused: ${B.why}` : ''}`);
    verdict(B.there && !B.thereUnderFire && B.movedAfter >= 0 && B.movedAfter < FIRELINE.fireS + 1 && B.fastest <= ORDERS.brisk + 0.25, 'the fire stopped: he walks on inside a second and a bit and is on his mark; he never ran',
      `walking again ${B.movedAfter < 0 ? 'never' : `${f2(B.movedAfter)} s`} after the last round · on his mark ${B.there} · fastest ${f2(B.fastest)} m/s (brisk ${ORDERS.brisk})`);
    verdict(B.st.noWay >= 1 && B.st.ways === 0, 'no way round worth the walk from there: he looked after the wait\'s ceiling, found none inside the allowance, and waited on', `looks that found none ${B.st.noWay} · ways taken ${B.st.ways} · ceiling ${FIRELINE.maxS} s, allowance ${FIRELINE.wayMoreM} m`);
    const C = await arm({ rule: true, sam: NEAR, fire: 11.5 });
    verdict(!C.why && C.st.holds >= 1 && C.st.ways === 1 && C.thereUnderFire && C.inLane === 0 && C.hit === 0 && C.behind > 30 && C.stillMax >= FIRELINE.maxS - 1 && C.fastest <= ORDERS.brisk + 0.25, 'Sam a stride back from the crossing: after the ceiling he walks round behind Sam and is on his mark with the fire still going, never in the lane, at a walk',
      `${C.mate}: ${C.fired} rounds · stood ${f2(C.stillMax)} s first · ways taken ${C.st.ways} · frames behind Sam's back ${C.behind} · frames in the lane ${C.inLane} · rounds into him ${C.hit} · on his mark under fire ${C.thereUnderFire} · fastest ${f2(C.fastest)} m/s${C.why ? ` · order refused: ${C.why}` : ''}`);
    const D = await arm({ rule: true, sam: FAR, fire: 3, from: [X, 0, Z + 0.1], startAt: 0.3 });
    verdict(!D.why && D.st.holds === 0 && D.hit >= 1 && D.fired >= 1, 'a man already in the lane when the fire starts is not held by the rule, and Sam\'s round finds him: nothing stops, bends or passes it',
      `${D.mate} started on the gun's line: waits ${D.st.holds} · ${D.fired} rounds, ${D.hit} into him (${D.state})${D.why ? ` · order refused: ${D.why}` : ''}`);
    const E = await arm({ rule: true, sam: FAR, fire: 5, from: [X, 0, 20.4], foe: [X + 0.2, 0, 22.9] });
    const E2 = await arm({ rule: true, sam: FAR, fire: 5, from: [X, 0, 20.4], foe: [X + 0.2, 0, 22.9], blind: 'fight' });
    const E3 = await arm({ rule: true, sam: FAR, fire: 5, from: [X, 0, 20.4], foe: [X + 0.2, 0, 22.9], blind: 'all' });
    verdict(!E.why && !E2.why && !E3.why && E.st.fight + E.st.enemy >= 1 && E.inLane > 0 && E2.st.enemy >= 1 && E2.inLane > 0 && E3.st.holds >= 1 && E3.st.enemy === 0 && E3.inLane === 0,
      'a living defender with a line to where he would wait: he is not held there — by his own fight; that shut by hand, by what he knows of the enemy\'s line; and a defender nobody on the squad knows of excuses nobody',
      `${E.mate}: waits ${E.st.holds}, frames let go for his own fight ${E.st.fight}, for an enemy's line ${E.st.enemy} (he went on: ${E.inLane} frames in the lane under fire, ${E.hit} of Sam's rounds into him: ${E.state}) · the fight's word shut: waits ${E2.st.holds}, frames let go for an enemy's line ${E2.st.enemy}, ${E2.inLane} frames in the lane · nothing known of him: waits ${E3.st.holds}, for an enemy's line ${E3.st.enemy}, frames in the lane ${E3.inLane}`);
    const UP = [15.5, 0, Z];   // (a place ON the aisle, between Sam and the crossing: his way turns the corner into the lane and up it)
    const F = await arm({ rule: true, sam: FAR, fire: 9, to: UP });
    verdict(!F.why && F.fired >= 12 && F.st.holds >= 1 && F.inLane === 0 && F.hit === 0 && F.nearest >= 0.3 && F.there && !F.thereUnderFire && F.up,
      'sent to a place up the lane itself, his way comes at it on the slant: he stops clear of its side while the fire lasts and goes on to his mark when it stops',
      `${F.mate}: ${F.fired} rounds · waits ${F.st.holds} · stood ${f2(F.stillMax)} s · nearest the lane's side ${f2(F.nearest)} m · frames in the lane ${F.inLane} · rounds into him ${F.hit} · on his mark after ${F.there}${F.thereUnderFire ? ' (under fire)' : ''}${F.why ? ` · order refused: ${F.why}` : ''}`);
    const F2 = await arm({ rule: true, sam: FAR, fire: 9, fallIn: true });
    verdict(!F2.why && F2.fired >= 12 && F2.inLane === 0 && F2.hit === 0 && F2.there && F2.up && (F2.st.holds >= 1 ? F2.nearest >= 0.3 && !F2.thereUnderFire : F2.nearest >= 0.3),
      '\'fall in\' from the same place: he is by Sam with no frame in the lane under fire — waiting clear of its side where his way came up it, or by a way that never came near it',
      `${F2.mate}: ${F2.fired} rounds · waits ${F2.st.holds} · stood ${f2(F2.stillMax)} s · nearest the lane's side ${f2(F2.nearest)} m · frames in the lane ${F2.inLane} · rounds into him ${F2.hit} · by Sam ${F2.there}${F2.thereUnderFire ? ' (the fire still going)' : ''}${F2.why ? ` · order refused: ${F2.why}` : ''}`);
    const NEW = [X + 3, 0, 22.4];
    const G = await arm({ rule: true, sam: NEAR, fire: 11.5, reorder: NEW });
    verdict(!G.why && G.re >= 0 && !G.reWhy && G.there2 && !G.there && G.inLane === 0, 'a new order while he is on his way round: he goes where the new one sends him, not on round to the old place',
      `${G.mate}: ways taken ${G.st.ways} · the new order ${G.re >= 0 ? (G.reWhy ? `refused: ${G.reWhy}` : 'given') : 'never given (no way round taken)'} · at the new place ${G.there2} · at the old one ${G.there} · frames in the lane ${G.inLane}`);
    const H = await arm({ rule: true, sam: FAR, fire: 8, reload: 2.6 });
    verdict(!H.why && H.reloadF >= 60 && H.fired >= 10 && H.st.holds === 1 && H.inString === 0 && H.hit === 0 && H.there && !H.thereUnderFire,
      'Sam changes magazines in the middle of the string: the wait lasts through the reload — one wait, no frame in the lane before the last round, and on his mark after',
      `${H.mate}: ${H.fired} rounds with ${f2(H.reloadF * DT)} s of reload among them · waits ${H.st.holds} · frames in the lane before the last round ${H.inString} · rounds into him ${H.hit} · on his mark after ${H.there}${H.thereUnderFire ? ' (under fire)' : ''}`);
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), PR: any = await import(`${ROOT}/src/host/profile.ts`), SE: any = await import(`${ROOT}/src/host/standEnv.ts`), g = B.g;
      const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
      FIRELINE.on = true; const old = snap(); delete old.tables.FIRELINE; J.applyKnobs(g, old); const before = FIRELINE.on;
      FIRELINE.on = true; const recOn = snap(); FIRELINE.on = false; J.applyKnobs(g, recOn); const kept = FIRELINE.on;
      FIRELINE.on = false; const recOff = snap(); FIRELINE.on = true; J.applyKnobs(g, recOff); const keptOff = FIRELINE.on;
      verdict(before === false && kept === true && keptOff === false && PR.FROZEN_HOLDS['FIRELINE.on'] === 'TPS_FIRELINE=1' && SE.STAND_ENV.includes('TPS_FIRELINE'), 'a recording from before the table replays with the rule off; one made with it on replays on, off off; the stands\' list has the row',
        `a recording without the table: ${before} · recorded on: ${kept} · recorded off: ${keptOff} · FROZEN_HOLDS ${PR.FROZEN_HOLDS['FIRELINE.on'] ?? 'no row'} · STAND_ENV ${SE.STAND_ENV.includes('TPS_FIRELINE')}`); }
    const I = await arm({ rule: true, sam: FAR, fire: 12, every: 78, startAt: 2.3 });
    verdict(!I.why && I.fired >= 8 && I.st.holds === 1 && I.st.cues === 1 && I.inString === 0 && I.hit === 0 && I.there && !I.thereUnderFire,
      'slow aimed fire, a round every 1.3 s, begun as he comes up to the lane: one wait and one word for the whole string, and no frame in the lane before the last round',
      `${I.mate}: ${I.fired} rounds · waits ${I.st.holds} · words ${I.st.cues} · frames in the lane before the last round ${I.inString} · rounds into him ${I.hit} · on his mark after ${I.there}${I.thereUnderFire ? ' (under fire)' : ''}`);
    for (const r of [A, B, C, D, E, E2, E3, F, F2, G, H, I]) if (r.bad) verdict(false, 'no man left the floor', r.bad);
  } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); all = false; }
  finally { knobsBack(knobs0); Math.random = rnd; }
  if (BREAK) console.log('(FIRELINE_BREAK=1: the switch was left off where an arm asked for it — the lines above about the rule on must have failed)');
  return all;
}
if (import.meta.main) process.exit((await firelineCheck()) ? 0 : 1);
