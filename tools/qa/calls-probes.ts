// The 'calls' family — THE CALLS TAKEN WHILE THE MAINTAINER WAS AWAY (rebuild/away-build/calls.md): each open call an earlier page left for him, taken by
// judgment, ships as a switch whose other side is one flick away (Tab ▸ Sandbox ▸ Team feel ▸ 'calls ▸ …' rows; game/teamfeel.ts keeps them per machine).
// This family holds BOTH SIDES of every one of them, run through probes.ts:
//   bun run tools/qa/probes.ts calls | calls-shipped | calls-menu | calls-leave | calls-held | calls-rally | calls-lastseen
// PASS / FAIL each, all headless, the menus given BY KEYS on the rig of thresholdmenu-probes.ts (the cursor on the door, one-frame presses). No picture here:
// nothing says how a row READS on the panel or how the '?' looks.
//   calls-shipped   every switch of the list ships at its pick, and is a key the Team feel panel keeps (a row can reach it, a changed one survives a reload)
//   calls-menu      the threshold's pages with the three row switches moved LIVE (no restage): thrHoldFirst off = the two forms trade keys, and X, 5, 4, 1 then
//                   gives 'threshold'; thrOutsideRow off = 'clear from outside' is off the page; thrBangFirst off = the held page is 1 step in · 2 bang, then
//                   step in again, and Digit1 there is taken as the plain step in; all three back on = the shipped pages exactly
//   calls-leave     a held threshold told to leave: shipped, its men are a stack on that door; thrLeaveFallIn on, they are under 'fall in'
//   calls-held      who gets the held page: 'step in once it goes quiet' on the jambs offers it as built and keeps the tools' row under thrHandsOff (the hold
//                   form offers it either way); with the four and ONE pair holding, the menu addressed to all four reads 'threshold held' as built and 'door
//                   tools' under thrHeldAll (addressed to the pair that holds: held either way); the pair's F with ANOTHER menu up is the word as built and
//                   is not under thrMenuWord off (F with the held door's own menu up, or with no menu, is the word either way)
//   calls-rally     ROOMFIGHT.rallyK: 0 = no defender leaves his room for the fight next door in a run where, shipped, some do (the run itself repeats; that rallyK 1 is the
//                   game as it was is threshold-identity's digest against af55d89 to hold, not this probe's)
//   calls-lastseen  FOG.lastSeen: 0 (shipped) = no mark ever; 4 = an enemy seen and then lost keeps a mark where he was last seen, ageing, gone after 4 s, never
//                   while he is in sight — and the game itself runs the same with it on (the fight's own state compared)
import { readFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { stage, at, spotOf, opOn, beatsOf, rowsOf, textOf, quiet, guarded, family, FIRST, pagesAsTheyWere } from './thresholdmenu-probes.ts';
const { DOORTOOLS, TOOLS_PAGE, THR_PAGE, HELD_PAGE } = await import(`${ROOT}/src/game/doortools.ts`);
const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`);
const { FOG } = await import(`${ROOT}/src/game/fogofwar.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { feelRange, feelDefaults } = await import(`${ROOT}/src/game/teamfeel.ts`);

const F = DOORTOOLS.blowKey as string;
const scn = (id: string) => SCENARIOS.find((e: any) => e.id === id);
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** THE LIST: table, key, the value it ships at, and the other side */
const SHIPPED: [string, string, unknown, string][] = [
  ['DOORTOOLS', 'thrHoldFirst', true, 'false: step in by itself on key 1'], ['DOORTOOLS', 'thrBangFirst', true, 'false: plain step in on key 1 (as built)'],
  ['DOORTOOLS', 'thrOutsideRow', true, 'false: clear from outside off the menu'], ['DOORTOOLS', 'thrLeaveFallIn', false, 'true: leave it = fall in'],
  ['DOORTOOLS', 'thrHandsOff', false, 'true: no what-next on the step-in form'], ['DOORTOOLS', 'thrHeldAll', false, 'true: held page only when all hold'],
  ['DOORTOOLS', 'thrMenuWord', true, 'false: F with another menu up is not the word'], ['DOORTOOLS', 'thrBangs', 2, '1: one can a room'], ['DOORTOOLS', 'thrLight', 1, '2: both jamb men lit'],
  ['DOORTOOLS', 'thrSlice', false, 'true: the opener slices'], ['DOORTOOLS', 'charges', 2, 'kit'], ['DOORTOOLS', 'bangs', 3, 'kit'],
  ['ROOMFIGHT', 'rally', true, 'false: nobody leaves his room'], ['ROOMFIGHT', 'rallyK', 1, 'under 1: fewer leave'], ['FOG', 'lastSeen', 0, 'seconds of a last-seen mark'],
  ['COVER', 'on', true, 'false: nobody watches openings unasked'], ['ORDERS', 'doorRay', true, 'false: the old pick'], ['LASER', 'enemy', false, 'true: enemies show lasers'],
];

// ---------------------------------------------------------------- every call ships at its pick, and has a row
export const callsShipped = guarded(async () => {
  const { verdict, done } = family('calls-shipped: every call taken ships at its pick and is a key the Team feel panel keeps');
  const D = feelDefaults() as Record<string, Record<string, unknown>>;
  // the panel's rows, read off bindings.ts's text: every feelRows('<TABLE>', [ … ]) block's `k: '<key>'` entries (panel-inventory holds that the panel builds them)
  const src = readFileSync(`${ROOT}/src/ui/bindings.ts`, 'utf8'), rows = new Map<string, Set<string>>();
  for (const m of src.matchAll(/feelRows\('([A-Z]+)', \[([\s\S]*?)\n\s*\]/g)) { const set = rows.get(m[1]) ?? new Set<string>(); rows.set(m[1], set); for (const k of m[2].matchAll(/\bk: '([\w.]+)'/g)) set.add(k[1]); }
  for (const [t, k, want, other] of SHIPPED) { const got = D[t]?.[k], range = feelRange(t, k), row = rows.get(t)?.has(k) ?? false;
    verdict(got === want && range !== undefined && row, `${t}.${k} ships ${JSON.stringify(want)}, is kept per machine, and has a Team feel row`, `shipped ${JSON.stringify(got)} · ${range === undefined ? 'NOT KEPT (teamfeel.ts)' : range === null ? 'a switch' : `a slider ${JSON.stringify(range)}`} · ${row ? 'a row in bindings.ts' : 'NO ROW in bindings.ts'} · the other side — ${other}`); }
  return done();
});

// ---------------------------------------------------------------- the three row switches, moved live
export const callsMenu = guarded(async () => {
  const { verdict, done } = family('calls-menu: the threshold\'s pages follow their switches live — which form is key 1, the bang or the plain step in on key 1, \'clear from outside\' on the page or off it');
  pagesAsTheyWere();   // these calls live on the threshold's page (X, 5, 4): the door tools as they were before the one outside order took row 4 (guarded restores them)
  for (const E of [scn('room-clear-pair'), scn('depot-four')]) {
    const spot = await spotOf(E); if (typeof spot === 'string') { verdict(false, `${E.title}: a door to give it on`, spot); continue; }
    const pages = async (R: any) => { await quiet(() => { R.openX(); R.digit(5); R.digit(4); }); const thr = R.read(); if (R.O.menu) R.O.close(); return thr; };
    // ---- the threshold's page
    { const { R } = await at(E, 1, spot); const a = await pages(R);
      DOORTOOLS.thrHoldFirst = false; await quiet(() => R.step(2)); const b = await pages(R);
      DOORTOOLS.thrOutsideRow = false; await quiet(() => R.step(2)); const c = await pages(R);
      DOORTOOLS.thrHoldFirst = true; DOORTOOLS.thrOutsideRow = true; await quiet(() => R.step(2)); const d = await pages(R);
      const ids = (p: any) => p?.page === THR_PAGE ? p.rows.map((r: any) => `${r.key} ${r.id}`).join(' · ') : `NOT THE PAGE (${rowsOf(p)})`;
      verdict(ids(a) === '1 thresholdHold · 2 threshold · 3 outside' && ids(b) === '1 threshold · 2 thresholdHold · 3 outside' && ids(c) === '1 threshold · 2 thresholdHold' && ids(d) === ids(a) && textOf(d) === textOf(a),
        `${E.title}: X, 5, 4 — shipped 1 hold · 2 step in · 3 outside; thrHoldFirst off, the forms trade keys; thrOutsideRow off, the third row is gone; both back, the shipped page`,
        `shipped: ${ids(a)}\n    thrHoldFirst off: ${ids(b)}\n    … and thrOutsideRow off: ${ids(c)}\n    back: ${ids(d)}`); }
    // ---- with the forms traded, key 1 GIVES the step-in form
    { const { R, d } = await at(E, 1, spot); DOORTOOLS.thrHoldFirst = false; await quiet(() => { R.step(2); R.openX(); R.digit(5); R.digit(4); R.press('Digit1'); });
      const l = R.last(), op = opOn(R, d);
      verdict(l?.order === 'threshold' && !!op && !op.thrHold, `${E.title}: thrHoldFirst off — X, 5, 4, 1 gives 'step in once it goes quiet'`, `logged ${l?.order ?? 'nothing'} · order ${op ? `${op.kind}${op.thrHold ? ' (hold)' : ''}` : 'NONE'}`);
      DOORTOOLS.thrHoldFirst = true; }
    // ---- the held page: the bang on key 1 as shipped, the plain step in on key 1 with the switch off — and the key does what its row says
    for (const bangFirst of [true, false]) {
      const { R, d } = await at(E, 1, spot); DOORTOOLS.thrBangFirst = bangFirst; await quiet(() => R.step(2));
      R.D.thresholdOn(spot.door, 'all', undefined, true); const op = opOn(R, d);
      const manned = !!op && await quiet(() => R.until(() => op.phase === 'thr' || !R.D.ops.includes(op), 60)) && op.phase === 'thr';
      await quiet(() => { R.openX(); R.digit(5); }); const pg = R.read(), want = bangFirst ? '1 thrBang · 2 thrStep · 3 thrLeave' : '1 thrStep · 2 thrBang · 3 thrLeave';
      const got = pg?.page === HELD_PAGE ? pg!.rows.filter((r: any) => /^\d$/.test(r.key)).map((r: any) => `${r.key} ${r.id}`).join(' · ') : `NOT THE HELD PAGE (${rowsOf(pg)})`, words = pg?.rows.find((r: any) => r.id === 'thrStep')?.text ?? '';
      await quiet(() => { R.press('Digit1'); R.step(2); }); const b = beatsOf(op), told = b.find((x: string) => /^told · /.test(x)) ?? 'nothing told';
      verdict(manned && got === want && words === (bangFirst ? 'step in · no bang' : 'step in') && told === (bangFirst ? 'told · bang and step in' : 'told · step in'),
        `${E.title}: thrBangFirst ${bangFirst ? 'on (shipped)' : 'off'} — the held page is ${bangFirst ? '1 bang, then step in · 2 step in · no bang' : '1 step in · 2 bang, then step in'} · 3 leave it, and Digit1 is taken as that`,
        `${manned ? 'jambs manned' : 'THE JAMBS WERE NOT MANNED'} · ${got} · the plain row reads "${words}" · Digit1: ${told}`);
      DOORTOOLS.thrBangFirst = true; }
  }
  return done();
});

// ---------------------------------------------------------------- 'leave it': stay stacked, or fall in
export const callsLeave = guarded(async () => {
  const { verdict, done } = family('calls-leave: a held threshold told to leave — stacked on that door as shipped, back on Sam under thrLeaveFallIn');
  pagesAsTheyWere();   // these calls live on the threshold's page (X, 5, 4): the door tools as they were before the one outside order took row 4 (guarded restores them)
  for (const E of [scn('room-clear-pair'), scn('depot-four')]) {
    const spot = await spotOf(E); if (typeof spot === 'string') { verdict(false, `${E.title}: a door to give it on`, spot); continue; }
    for (const fallIn of [false, true]) {
      const { R, d } = await at(E, 1, spot); DOORTOOLS.thrLeaveFallIn = fallIn;
      R.D.thresholdOn(spot.door, 'all', undefined, true); const op = opOn(R, d);
      const manned = !!op && await quiet(() => R.until(() => op.phase === 'thr' || !R.D.ops.includes(op), 60)) && op.phase === 'thr';
      await quiet(() => { R.openX(); R.digit(5); }); const label = R.read()?.rows.find((r: any) => r.id === 'thrLeave')?.text ?? '(no row)';
      await quiet(() => { R.press('Digit3'); R.step(30); });
      const men = (op?.men ?? []).filter((m: any) => m.state !== 'dead'), orders = men.map((m: any) => R.O.of(m)?.order ?? 'none'), want = fallIn ? 'fallIn' : 'stack';
      verdict(manned && op.ended === 'stood down' && men.length > 0 && orders.every((o: string) => o === want) && label === (fallIn ? 'leave it · fall in' : 'leave it'),
        `${E.title}: thrLeaveFallIn ${fallIn ? 'on' : 'off (shipped)'} — X, 5, 3 ends the order and its men are under '${want}'`,
        `${manned ? 'jambs manned' : 'THE JAMBS WERE NOT MANNED'} · the row reads "${label}" · ended ${op?.ended ?? '—'} · ${men.map((m: any, i: number) => `${m.callsign} ${orders[i]}`).join(', ')}`);
      DOORTOOLS.thrLeaveFallIn = false; }
  }
  return done();
});

// ---------------------------------------------------------------- who gets the held page, and the pair's key under another menu
export const callsHeld = guarded(async () => {
  const { verdict, done } = family('calls-held: who the held page is offered to — the step-in form (thrHandsOff), the four with one pair holding (thrHeldAll), the pair\'s F with another menu up (thrMenuWord)');
  pagesAsTheyWere();   // these calls live on the threshold's page (X, 5, 4): the door tools as they were before the one outside order took row 4 (guarded restores them)
  const row5 = async (R: any) => { await quiet(() => R.openX()); const r = R.read()?.rows[4]; if (R.O.menu) R.O.close(); return r?.id ?? '(no menu)'; };
  // ---- thrHandsOff: the form that steps in by itself, on the jambs
  for (const E of [scn('room-clear-pair'), scn('depot-four')]) {
    const spot = await spotOf(E); if (typeof spot === 'string') { verdict(false, `${E.title}: a door to give it on`, spot); continue; }
    const got: string[] = [];
    for (const [hold, off] of [[false, false], [false, true], [true, true]] as [boolean, boolean][]) {
      const { R, d } = await at(E, 1, spot); DOORTOOLS.thrHandsOff = off; R.D.thresholdOn(spot.door, 'all', undefined, hold); const op = opOn(R, d);
      const manned = !!op && await quiet(() => R.until(() => op.phase === 'thr' || !R.D.ops.includes(op), 60)) && op.phase === 'thr';
      got.push(manned ? await row5(R) : 'THE JAMBS WERE NOT MANNED'); DOORTOOLS.thrHandsOff = false; }
    verdict(got.join(' ') === `${HELD_PAGE} ${TOOLS_PAGE} ${HELD_PAGE}`, `${E.title}: 'step in once it goes quiet' on the jambs — row 5 is 'threshold held' as shipped and the tools' under thrHandsOff; the hold form's is 'threshold held' either way`,
      `step-in form, shipped: ${got[0]} · step-in form, thrHandsOff: ${got[1]} · hold form, thrHandsOff: ${got[2]}`);
  }
  // ---- thrHeldAll: the four, one pair on the door
  { const E = scn('depot-four'), spot = await spotOf(E);
    if (typeof spot === 'string') verdict(false, `${E.title}: a door to give it on`, spot);
    else { const { R, d } = await at(E, 1, spot), team = R.team, pair = R.O.pairOf(team[0]), mine = team.filter((m: any) => R.O.pairOf(m) === pair);
      R.D.thresholdOn(spot.door, pair, undefined, true); const op = opOn(R, d);
      const manned = !!op && await quiet(() => R.until(() => op.phase === 'thr' || !R.D.ops.includes(op), 60)) && op.phase === 'thr';
      const t = R.O.targetAt(d.frameCentre), ids = (men: any[]) => R.O.rowsFor(t, null, men).map((x: any) => x.id).join(' ');
      const anyAll = ids(team), anyPair = ids(mine); DOORTOOLS.thrHeldAll = true; const allAll = ids(team), allPair = ids(mine); DOORTOOLS.thrHeldAll = false;
      const held = FIRST.replace('tools', HELD_PAGE);
      verdict(manned && op.men.length === mine.length && anyAll === held && anyPair === held && allAll === FIRST && allPair === held,
        `${E.title}: ${pair} holds ${spot.door} — the menu addressed to all four reads 'threshold held' as shipped and 'door tools' under thrHeldAll; addressed to ${pair} it is 'threshold held' either way`,
        `${manned ? `held by ${op.men.map((m: any) => m.callsign).join(' + ')}` : 'THE JAMBS WERE NOT MANNED'} · shipped: all four → ${anyAll} · ${pair} → ${anyPair}\n    thrHeldAll: all four → ${allAll} · ${pair} → ${allPair}`); }
  }
  // ---- thrMenuWord: the pair's key with ANOTHER menu up (the floor's), with the held door's OWN menu up, and with none
  { const E = scn('room-clear-pair'), spot = await spotOf(E);
    if (typeof spot === 'string') verdict(false, `${E.title}: a door to give it on`, spot);
    else for (const on of [true, false]) {
      const got: string[] = []; let floorMenu = '';
      for (const menu of ['floor', 'own', 'none']) {
        const { R, d } = await at(E, 1, spot); DOORTOOLS.thrMenuWord = on; R.D.thresholdOn(spot.door, 'all', undefined, true); const op = opOn(R, d);
        const manned = !!op && await quiet(() => R.until(() => op.phase === 'thr' || !R.D.ops.includes(op), 60)) && op.phase === 'thr';
        if (!manned) { got.push('THE JAMBS WERE NOT MANNED'); DOORTOOLS.thrMenuWord = true; continue; }
        // 'floor': the cursor off the door, on open floor behind Sam — X there is the floor's menu, no row for the word on it; 'own': X on the held door
        if (menu === 'floor') { const sam = R.g.player.char.pos; R.aim = [sam[0] + (sam[0] - d.frameCentre[0]) * 0.4, 0, sam[2] + (sam[2] - d.frameCentre[2]) * 0.4]; await quiet(() => R.step(10)); }
        if (menu !== 'none') { await quiet(() => R.openX()); const M = R.O.menu; if (menu === 'floor') floorMenu = `${M?.target.kind ?? 'NO MENU'}${M?.rows.some((x: any) => x.hotKey === F) ? ' (IT HAS A ROW ON THAT KEY)' : ''}`; if (menu === 'own' && R.read()?.rows[4]?.id !== HELD_PAGE) got.push('(NOT THE HELD DOOR\'S MENU)'); }
        await quiet(() => { R.press(F); R.step(2); }); got.push(beatsOf(op).some((x: string) => x === 'the word') ? 'the word' : 'not the word'); DOORTOOLS.thrMenuWord = true; }
      verdict(floorMenu === 'floor' && got.join(' · ') === (on ? 'the word · the word · the word' : 'not the word · the word · the word'),
        `${E.title}: thrMenuWord ${on ? 'on (shipped)' : 'off'} — F with the floor's menu up ${on ? 'is' : 'is not'} the held threshold's word; with the held door's own menu up, and with no menu, it is`,
        `the other menu was on: ${floorMenu} · F with it up: ${got[0]} · with the held door's menu up: ${got[1]} · with no menu: ${got[2]}`); }
  }
  return done();
});

// ---------------------------------------------------------------- the rally's strength
export const callsRally = guarded(async () => {
  const { verdict, done } = family('calls-rally: ROOMFIGHT.rallyK — at 0 no defender leaves his room for the fight next door, in a run where shipped (1) some do');
  pagesAsTheyWere();   // these calls live on the threshold's page (X, 5, 4): the door tools as they were before the one outside order took row 4 (guarded restores them)
  const E = scn('room-clear-pair'), spot = await spotOf(E);
  if (typeof spot === 'string') { verdict(false, `${E.title}: a door to give it on`, spot); return done(); }
  const run = async (k: number | null, seed: number) => { const { R } = await at(E, seed, spot); if (k !== null) ROOMFIGHT.rallyK = k;
    const d = R.g.doors.byName(spot.door), side = R.O.targetUnder(R.input, R.W.cam, R.W.canvas).side ?? 1; R.D.order('bangClear', R.team, d, side);
    await quiet(() => R.step(45 * 60)); ROOMFIGHT.rallyK = 1;
    return { rallied: R.g.fight.stats.rallied as number, state: R.g.guards.map((x: any) => `${x.callsign}:${x.state}@${x.char.pos[0].toFixed(2)},${x.char.pos[2].toFixed(2)}`).join(' ') }; };
  let seed = 0, base: { rallied: number; state: string } | null = null;
  for (const s of [1, 2, 3, 4, 5, 6]) { const r = await run(null, s); if (r.rallied > 0) { seed = s; base = r; break; } }
  if (!base) { verdict(false, 'a run in which, shipped, a defender goes to the fight next door', 'none of seeds 1 to 6 had one in 45 s behind a bang and clear'); return done(); }
  const one = await run(1, seed), zero = await run(0, seed);
  verdict(one.state === base.state && one.rallied === base.rallied, `the run repeats (seed ${seed}, 45 s behind a bang and clear on ${spot.door}, rallyK 1 both times: every man in the same state on the same spot) — so what rallyK 0 changes below is the knob's`, `rallied ${base.rallied} and ${one.rallied} · ${one.state === base.state ? 'states and places equal' : `DIFFER:\n    ${base.state}\n    ${one.state}`}`);
  verdict(zero.rallied === 0, 'rallyK 0: nobody goes to the fight next door in that same run', `rallied ${zero.rallied} (shipped ${base.rallied})`);
  return done();
});

// ---------------------------------------------------------------- the last-seen mark
// (FOG.lastSeen by itself: the 'you're told' lever, which decides the mark while that row is 0, is held down here — tools/qa/told-check.ts has it up)
export const callsLastSeen = guarded(async () => (await import('./told-check.ts')).threeLevers(async () => {
  const { verdict, done } = family('calls-lastseen: FOG.lastSeen — no mark as shipped; turned up, an enemy seen and then lost keeps a mark where he was last seen for that long');
  const E = scn('room-clear-pair');
  const run = async (secs: number) => {
    const R = await stage(E, 1), g = R.g; FOG.lastSeen = secs; g.fogOfWar.on = true; g.aiEnabled = false;   // (nobody moves or fights: the fog's own answer, a man seen and then not)
    const team = R.team; for (const m of team) m.dazzledUntil = 1e9;   // (the team's own eyes shut: Sam's is the only one, where the probe puts it)
    const start = [...g.player.char.pos], hostiles = g.guards.filter((x: any) => x.team === 'hostile' && x.state !== 'dead');
    await quiet(() => R.step(30)); const h = hostiles.find((x: any) => g.fogOfWar.hidden(x)); if (!h) return { ok: false, why: 'no defender out of the picture at the start' } as any; const hp = [...h.char.pos]; const before = g.fogOfWar.lastSeen().length, hid0 = g.fogOfWar.hidden(h);
    // Sam put a stride from him (a ghost: not seen, AI off), then back where he started
    let near: number[] | null = null; for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0.9, 0.9], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9]]) { const p = [hp[0] + dx, 0, hp[2] + dz]; if (!g.col.nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.5, p[2]], [hp[0], 1.5, hp[2]])) { near = p; break; } }
    if (!near) return { ok: false, why: 'no floor beside the man' } as any;
    R.aim = [hp[0], 1.0, hp[2]]; g.teleportPlayer(near); await quiet(() => R.step(20)); const seen = g.fogOfWar.seen(h), during = g.fogOfWar.lastSeen().length;
    R.aim = null; g.teleportPlayer(start); await quiet(() => R.step(45)); const lost = g.fogOfWar.hidden(h), marks = g.fogOfWar.lastSeen(), m = marks.find((x: any) => x.gd === h);
    const age1 = m?.age ?? -1, off = m ? flat(m.at, hp) : -1;
    await quiet(() => R.step(Math.round(Math.max(1, secs) * 60))); const after = g.fogOfWar.lastSeen().length;
    return { ok: true, before, hid0, seen, during, lost, n: marks.length, every: marks.every((x: any) => g.fogOfWar.hidden(x.gd) && x.gd.state !== 'dead' && x.age < secs), age1, off, after };
  };
  const on = await run(4), offR = await run(0);
  if (!on.ok || !offR.ok) { verdict(false, 'the staging', on.why ?? offR.why); return done(); }
  verdict(on.before === 0 && on.hid0 && on.seen && on.during === 0 && on.lost && on.n >= 1 && on.every && on.age1 > 0.2 && on.age1 < 1.5 && on.off < 0.3 && on.after === 0,
    'lastSeen 4: unseen, no mark; in sight, no mark; lost, a mark where he stood, ageing (marks only on men out of the picture); gone inside four seconds more',
    `before ${on.before} (hidden ${on.hid0}) · Sam beside him: seen ${on.seen}, marks ${on.during} · Sam gone: hidden ${on.lost}, marks ${on.n}, ${on.age1.toFixed(2)} s old, ${on.off.toFixed(2)} m from where he stands · 4 s on: ${on.after}`);
  verdict(offR.seen && offR.lost && offR.n === 0 && offR.during === 0 && offR.after === 0, 'lastSeen 0 (shipped): the same sighting and loss leave no mark', `seen ${offR.seen} · lost ${offR.lost} · marks ${offR.before} / ${offR.during} / ${offR.n} / ${offR.after}`);
  return done();
}));
