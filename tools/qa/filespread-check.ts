// 'Fall in', Sam stopped: no two places of the file fall on one spot (game/orders.ts ORDERS.fileSpread, apartSlot).
//   bun run tools/qa/filespread-check.ts [--verbose]      (probes.ts filespread, in family squadorders; FILESPREAD_BREAK=1 and FILEHOLD_BREAK=1 must FAIL)
// Found by the wall charge's own check on block-squads: Sam put down at (13.6, 10.3) with no trail behind him and the four told to fall in, Blue One's and Blue
// Two's places came out at (11.69, 7.37) and (11.55, 7.16) — the file's places run straight back from Sam past the end of his trail and both stop where the
// floor does. With the doorway manners on (the page) the rear man is 'standing on a mate', so he is sent to his exact place, a quarter metre from the other's,
// and the two shove each other for as long as Sam stands there.
//   1. that staging, rule off: the fault is there (two men still moving after twenty seconds, their places within half a metre)
//   2. the same, rule on: every man still, no two places within the manners' 0.85 m and no two men within 0.6 m, everybody arrived, nobody further from Sam
//      than with the rule off + 1 m
//   3. Sam put down on the team's start and in up to four held rooms of four squad levels: the rule had work to do (places on one spot without it, places
//      dealt again with it), with it never more men moving than without, no two places on one spot, nobody 1.5 m further from Sam than without it or than the
//      file's own places reach in that run (depot-four's comms hut: Sam shoved 0.17 m or 0.26 m by the first man in decides which way a file with no trail
//      runs — along the room, or out of its open door — rule or no rule); and a file that stood
//      still without the rule stands still with it (printed, not judged: how many of those stand on the very same places — the rule can act for a moment
//      on the walk in, while a man ahead is still on his way round a corner — and how many pairs of places are within the manners' 0.85 m: in a corner
//      with no other floor the rule settles for ORDERS.fileTight, and a man standing where he was near enough is nobody's fault while nobody moves)
//   4. NO FLOOR AND NO STOPPING SHORT: HE HOLDS, HE IS NOT SENT INTO A MATE (ORDERS.fileHold; FILEHOLD_BREAK=1 = the key left off under the rule, must FAIL on
//      both stands). room-clear-four's storage corner, Sam at (33.00, 7.03): a pocket 0.9 m by 0.5 m between the shelves and the open door's lane. On the
//      page's stand the last two walk into it by themselves (line 3's row for that place); the frozen stand's men stop nearer Sam and its storage door shuts
//      behind them, so the corner is STAGED the same way on either stand: doors stay where left, the storage door stood open, Blue One put where he was
//      shoved to (30.89, 4.46) and Blue Two beside him (31.28, 4.91). Key off (the spread alone): both still moving after ten seconds, their places 0.4 m
//      apart. Key on: nobody moving, no two places within 0.6 m, everybody arrived
//   5. the journal: a recording from before the key replays with it off; one that carries it keeps its own word, on or off
// The doorway manners are raised for the staging on either stand (the frozen stand holds them off, and without them the two settle by another road).
// Headless: nothing here says how it looks.
import { ROOT } from './headless.ts';
import { guarded, family } from './thresholdmenu-probes.ts';
const { rig } = (await import('./outerwall-probes.ts')) as any;
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { WALLCHARGE } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { DOORSTAY } = await import(`${ROOT}/src/game/doors.ts`);
const BREAK = !!process.env.FILESPREAD_BREAK, HOLD_BREAK = !!process.env.FILEHOLD_BREAK, VERBOSE = process.argv.includes('--verbose');
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const fmt = (p: number[]) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;

interface Out { ok: boolean; moved: number[]; movers: number; nearGoals: number; tight: number; bare: number; nearMen: number; far: number; fell: number; arrived: boolean; goals: number[][]; men: number[][]; say: string }
/** Sam put down at `at` with no trail, the squad told to fall in, twenty seconds given, then five watched */
async function stand(scn: string, at: number[], on: boolean, hold = on && !HOLD_BREAK, corner: { door?: number[]; men: [number, number[]][] } | null = null): Promise<Out> {
  const R = await rig(scn, 5), g = R.game, O = R.O;
  DOORMANNERS.on = true; ORDERS.fileSpread = on; ORDERS.fileHold = hold; if (corner?.door) DOORSTAY.on = true;   // (after the stand-up: the frozen stand pins them off — and shuts a door behind the men, which the staged corner needs standing open)
  for (const h of R.hostiles) if (h.state !== 'dead') R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);
  R.gather(at, 20); R.step(600);
  if (corner) { const cd = corner.door; if (cd) for (const d of g.doors.list as any[]) if (flat(d.frameCentre, cd) < 0.5) { d.latched = false; d.angle = -1.92; }   // (the leaf as the page's own walk in leaves it)
    for (const [i, p] of corner.men) if (R.up[i]) R.put(R.up[i], p); R.step(600); }
  const men = R.up as any[], last = men.map(m => [...m.char.pos]), moved = men.map(() => 0);
  for (let f = 0; f < 300; f++) { R.step(); men.forEach((m, i) => { moved[i] += flat(m.char.pos, last[i]); last[i] = [...m.char.pos]; }); }
  const sam = g.player.char.pos, open = (a: number[], b: number[]) => !g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]);
  const goals = men.map(m => [...(O.of(m)?.goal ?? m.char.pos)]), pos = men.map(m => [...m.char.pos]);
  let nearGoals = 0, tight = 0, bare = 0, nearMen = 0;   // (nearGoals: on one spot · tight: inside the manners' 'standing on a mate', the bar a man is sent on to his exact place by)
  for (let i = 0; i < men.length; i++) for (let j = i + 1; j < men.length; j++) {
    if (flat(goals[i], goals[j]) < 0.6 && open(goals[i], goals[j])) nearGoals++;
    if (flat(goals[i], goals[j]) < DOORMANNERS.apart - 0.02 && open(goals[i], goals[j])) tight++;
    if (flat(goals[i], goals[j]) < ORDERS.fileTight - 0.02 && open(goals[i], goals[j])) bare++;   // (bare: nearer than the rule's own last bar, a bare body's width — what it asks where the floor has no `fileApart`, and what a held man is stepped out to)
    if (flat(pos[i], pos[j]) < 0.6 && open(pos[i], pos[j])) nearMen++; }
  const movers = moved.filter(x => x > 0.15).length, far = Math.max(...pos.map(p => flat(p, sam))), arrived = men.every(m => !!O.of(m)?.arrived);
  // (fell: how far from Sam the file's own places reach in THIS run before the rule touches one — orders.ts slot(), the trail run straight on and, where a wall
  //  cuts it short, turned through an open door: the rule is judged against the places it was handed, not against another run's Sam, shoved a hand's width the other way)
  const fell = Math.max(0, ...men.map(m => { const A = O.of(m); if (!A || A.post !== null) return 0; try { return flat(O.slot(O.backOf(A.follow) + O.clearBack(A.follow)), sam); } catch { return 0; } }));
  const say = men.map((m, i) => `${m.callsign} ${fmt(pos[i])} → ${fmt(goals[i])} moved ${moved[i].toFixed(2)}`).join(' · ');
  return { ok: men.length > 0, moved, movers, nearGoals, tight, bare, nearMen, far, fell, arrived, goals, men: pos, say };
}

export const filespreadCheck = guarded(async () => {
  const F = family('filespread: fall in, Sam stopped — no two places of the file on one spot');
  const keep = { m: DOORMANNERS.on, s: ORDERS.fileSpread, h: ORDERS.fileHold, st: DOORSTAY.on, rnd: Math.random, d: DESTRUCTION.on, w: WALLCHARGE.on, o: WALLCHARGE.outer };   // (the rig seeds Math.random and raises the destruction switches)
  try {
    // ---- 1, 2. the staging it was found on
    // (blue put where the frozen stand's own walk in leaves the pair, on either stand: the page's lived-in mess table, and where it stands, decides how the two come to the corner — moved
    //  clear of the stack marks (levels/block-squads.json, 10-13), the walk in ended with one man stopped 'near enough' short of the shared place and the fault not showing, though it is there)
    { const at = [13.6, 0, 10.3], blue = { men: [[2, [11.36, 0, 6.99]], [3, [11.73, 0, 7.44]]] as [number, number[]][] }, off = await stand('block-squads', at, false, undefined, blue), on = await stand('block-squads', at, !BREAK, undefined, blue);
      if (VERBOSE) console.log(`    off: ${off.say}\n    on:  ${on.say}`);
      F.verdict(off.ok && off.movers >= 2 && off.nearGoals >= 1, 'block-squads, Sam at (13.6, 10.3): the fault is there with the rule off (two men never settle, their places on one spot)', `${off.movers} still moving, ${off.nearGoals} pair of places within 0.6 m · ${off.say}`);
      F.verdict(on.ok && on.movers === 0 && on.bare === 0 && on.nearMen === 0 && on.arrived && on.far <= off.far + 1, `with the rule every man stands still, no two places nearer than a bare body's width (${ORDERS.fileTight} m: the rebuilt block's corner has no floor for more, and a pair that near sends nobody on while nobody moves), no two men within 0.6 m, nobody further from Sam`, `${on.movers} moving, ${on.bare} pair of places within ${ORDERS.fileTight} m (${on.tight} within 0.85 m) and ${on.nearMen} of men within 0.6 m, furthest ${on.far.toFixed(1)} m (off ${off.far.toFixed(1)}) · ${on.say}`); }
    // ---- 3. the held rooms and the start of four squad levels
    let spots = 0, dealt = 0, offMove = 0, onMove = 0, offNear = 0, onNear = 0, onTight = 0, same = 0, plain = 0, plainOk = 0; const bad: string[] = [], rows: string[] = [];
    for (const scn of ['block-squads', 'compound-four', 'depot-four', 'room-clear-four']) {
      let R0: any; try { R0 = await rig(scn, 5); } catch (e) { rows.push(`${scn}: no rig (${String((e as Error).message).slice(0, 60)})`); continue; }
      const g0 = R0.game, lay = g0.level.scenarios?.roomClear, P: number[][] = [[...g0.player.char.pos]];
      for (const r of (lay?.rooms ?? []) as any[]) { const b = r.bounds; if (!b) continue;
        const x0 = b.x0 ?? b[0], z0 = b.z0 ?? b[1], x1 = b.x1 ?? b[2], z1 = b.z1 ?? b[3], c = [(x0 + x1) / 2, 0, (z0 + z1) / 2];
        // (the room's middle, or the nearest free floor to it inside the room)
        let q: number[] | null = null; for (let k = 0; k < 40 && !q; k++) { const t = [c[0] + ((k % 5) - 2) * 0.4 * Math.sign(k), 0, c[2] + (Math.floor(k / 5) - 2) * 0.4 * Math.sign(k)]; if (t[0] > x0 && t[0] < x1 && t[2] > z0 && t[2] < z1 && R0.free(t)) q = t; }
        if (q) P.push(q); }
      for (const at of P.slice(0, 5)) { const off = await stand(scn, at, false), on = await stand(scn, at, !BREAK); if (!off.ok || !on.ok) continue; spots++;
        offMove += off.movers; onMove += on.movers; offNear += off.nearGoals; onNear += on.nearGoals; onTight += on.tight;
        const moved = on.goals.some((q, i) => flat(q, off.goals[i] ?? q) > 0.05); if (moved) dealt++;
        if (off.tight === 0 && off.movers === 0) { plain++; if (!moved) same++; if (on.movers === 0) plainOk++; }
        rows.push(`${scn} ${fmt(at)}: off ${off.movers} moving, ${off.nearGoals} on one spot · on ${on.movers} moving, ${on.nearGoals} on one spot${on.tight ? `, ${on.tight} within 0.85 m` : ''}${moved ? ' · places dealt again' : ''}${on.far > off.far + 1.5 ? ` · furthest man ${on.far.toFixed(1)} m (off ${off.far.toFixed(1)}; the file's own places reach ${on.fell.toFixed(1)})` : ''}`);
        if (on.movers > off.movers || on.nearGoals > 0 || on.far > Math.max(off.far, on.fell) + 1.5) bad.push(`${scn} ${fmt(at)}`); } }
    if (VERBOSE) for (const r of rows) console.log(`    ${r}`);
    F.verdict(spots >= 8 && bad.length === 0 && offNear > 0 && onNear === 0 && onMove < offMove && dealt > 0 && plain > 0 && plainOk === plain, `Sam put down at the start and in the held rooms of four squad levels (${spots} places): the rule had work, with it never more men moving and fewer in all, no two places on one spot, a file that stood still stands still`,
      `men still moving off ${offMove} → on ${onMove} · places on one spot off ${offNear} → on ${onNear} (within 0.85 m: ${onTight}) · dealt again at ${dealt} · still files still still ${plainOk} of ${plain}, on the very same places ${same}${bad.length ? ` · WORSE: ${bad.join(', ')}` : ''}${VERBOSE ? '' : `\n    ${rows.join('\n    ')}`}`);
    // ---- 4. the corner with no floor, staged the same on either stand: the key holds him where he stands
    if (HOLD_BREAK) console.log('  (FILEHOLD_BREAK: ORDERS.fileHold is left off under the rule — line 3 on the shipped stand and the staged corner must fail)');
    { const at = [33.0, 0, 7.03], corner = { door: [32.75, 0, 10], men: [[2, [30.89, 0, 4.46]], [3, [31.28, 0, 4.91]]] as [number, number[]][] };
      const off = await stand('room-clear-four', at, true, false, corner), on = await stand('room-clear-four', at, true, !HOLD_BREAK, corner);
      if (VERBOSE) console.log(`    key off: ${off.say}\n    key on:  ${on.say}`);
      F.verdict(off.ok && off.movers >= 2 && off.nearGoals >= 1, 'room-clear-four, the storage corner staged (door open, the last two put in the pocket): THE FAULT with the key off — no floor, no stopping short, he is sent to his place as it fell and the two never settle', `${off.movers} still moving, ${off.nearGoals} pair of places within 0.6 m · ${off.say}`);
      F.verdict(on.ok && on.movers === 0 && on.nearGoals === 0 && on.arrived, 'ORDERS.fileHold: he holds where he stands, a step off the mate\'s place — nobody moving, no two places on one spot, everybody arrived', `${on.movers} moving, ${on.nearGoals} pair of places within 0.6 m (within 0.85 m: ${on.tight}), ${on.nearMen} of men within 0.6 m · ${on.say}`); }
    // ---- 5. the journal: a recording from before the key replays with it off (journal.ts applyKnobs); one that carries it keeps its own word
    { const J = await import(`${ROOT}/src/game/journal.ts`), R = await rig('room-clear-four', 5), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.game)));
      ORDERS.fileHold = true; const old = snap(); if (old.tables.ORDERS) delete old.tables.ORDERS.fileHold; delete old.flags.fileHold; J.applyKnobs(R.game, old); const a = ORDERS.fileHold;
      ORDERS.fileHold = true; const yes = snap(); ORDERS.fileHold = false; J.applyKnobs(R.game, yes); const b = ORDERS.fileHold;
      ORDERS.fileHold = false; const no = snap(); ORDERS.fileHold = true; J.applyKnobs(R.game, no); const c = ORDERS.fileHold;
      F.verdict(a === false && b === true && c === false, 'the journal: a recording from before the key replays with it off, one made with it on replays on, one made with it off replays off', `old → ${a} · recorded on → ${b} · recorded off → ${c}`); }
  } finally { DOORMANNERS.on = keep.m; ORDERS.fileSpread = keep.s; ORDERS.fileHold = keep.h; DOORSTAY.on = keep.st; Math.random = keep.rnd; DESTRUCTION.on = keep.d; WALLCHARGE.on = keep.w; WALLCHARGE.outer = keep.o; }
  return F.done();
});

if (import.meta.main) process.exit((await filespreadCheck()) ? 0 : 1);
