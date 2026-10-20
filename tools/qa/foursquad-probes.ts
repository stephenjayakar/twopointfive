// The 'foursquad' family (NIGHTBREACH.squad = 4, the page's ?squad4 — game/nightbreach.ts stages FOUR teammates, a red pair and a blue pair, where the playtests
// stage the one pair; orders.ts / doortools.ts move three or four men through the same menu — X pressed, then a digit), run through probes.ts:
//   bun run tools/qa/probes.ts foursquad | foursquad-off | foursquad-stage | foursquad-follow | foursquad-stack | foursquad-clear | foursquad-drill | foursquad-budget
// PASS / FAIL each, all headless (the Game of headless.ts under the room clear's staging unless a probe says the night breach). The harness has no light meter:
// Sam's visibility is planted dark and he is in god mode, and what anybody SEES of anybody is guards.ts's direct-light estimate, not the page's. Nothing here
// looks at a picture: the pairs' colours, ten men in one frame and who goes without a shadow are untested by eye.
//   foursquad-off      the flag off: the room clear stages the PAIR exactly as it was — two men, Blue One / Blue Two, the default kit, eight characters — and the
//                      one place to ask for men (orders.ts men()) answers for it too
//   foursquad-stage    the flag on: four teammates beside Sam — Red One, Red Two, Blue One, Blue Two — each with his pair in his papers and his pair's colours,
//                      nobody standing in anybody, all five defenders still dealt; men('all' | 'red' | 'blue' | n | guard), pairOf(), pairs(); an order given
//                      to a pair moves that pair alone; a restart stages the four again; stop puts the shift back; the next start with the knob at 2 is the pair
//   foursquad-follow   fall in: the four close up on Sam in one file (pairs together), keep with him down the aisle, in at the break room's west door, across
//                      the room, out at its north door and along the corridor — nobody left behind, nobody standing in a doorway at the end, never two men
//                      in one place; and the squad row's word for a follower holds on a walk (FOLLOWWORD_BREAK=1 = the word unlatched: that line must fail)
//   foursquad-stack    stack up: on every door of the structure from the squad's side there is a mark for each of the four (two files, a pair a file where both
//                      jambs have floor); ordered on a corridor door all four get onto their marks, 'set.' is called, nobody stands in the opening; 'move
//                      there' puts them in two ranks of two; 'hold' and 'cover' take all four where they stand
//   foursquad-clear    the room clear's own rooms taken with the existing rows by all four, over seeds: 'open and clear' and 'bang and clear' — every living
//                      man who is sent in crosses the frame line, the order ends 'in', nobody is left standing in the doorway, and NO teammate goes down to a
//                      teammate's round (the game's own rule — so the LANES are counted too: rounds fired through a friend); how many rooms end clear and
//                      how many teammates are lost is printed (the fight is a fight); then the charge by four, and 'clear from outside' by four (two slice,
//                      two hold the rear)
//   foursquad-drill    F's drill with four: it is the red pair's — blue is not owned by it, keeps an order given meanwhile, and that order does not call the
//                      breach off
//   foursquad-budget   the numbers: ten characters against eight proxy places and sixteen skinned, 63 of 64 steady lights at the spawn's own count and how many
//                      are really uploaded; with ten men drawn the eight proxy places go to the living first once a man is down; an eleventh man is refused
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH, SQUAD4, SQUAD4_BUDGET } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR, STRUCTURE } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { ROOMFIT } = await import(`${ROOT}/src/game/roomfit.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { MAX_QUERIES } = await import(`${ROOT}/src/render/probe.ts`);
const { MAX_CHARS } = await import(`${ROOT}/src/anim/characters.ts`);
const { BoxWorld } = await import(`${ROOT}/src/scene/boxes.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const names = (l: any[]) => l.map((g: any) => g.callsign).join(', ');
/** every probe leaves the knob tables as it found them, pass, fail or throw */
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); } };

// where Sam stands for a door (his side of it is the side the squad works it from), off the line of the opening
const SAM: Record<string, number[]> = { breakroom_w: [25.0, 0, 18.9], breakroom_n: [28.6, 0, 11.0], manager: [24.0, 0, 11.2], storage: [30.8, 0, 11.2], server: [21.0, 0, 11.2] };
const AISLE: number[] = [15, 0, 17.6];
const alongOf = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const offOf = (d: any, p: number[]) => { const th = d.def.closedDir; return Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0]); };
/** standing in the doorway: between the jambs and within half a metre of the frame line */
const inDoorway = (d: any, p: number[]) => { const a = alongOf(d, p); return a > 0 && a < d.def.width && Math.abs(offOf(d, p)) < 0.5; };

/** One game under a seed: the room clear staged (`stage: 'nb'` = the night breach alone) with `squad` teammates (default four), Sam in god mode and dark.
 *  `quiet`: the defenders kept dazzled every frame (they neither see nor fire) — for the probes that are about feet, not the fight. */
async function rig(seed: number, o: { squad?: 2 | 4; stage?: 'rc' | 'nb'; quiet?: boolean; door?: string; knobs?: Record<string, unknown> } = {}) {
  Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS, { squad: o.squad ?? 4 }, o.knobs ?? {});
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game, input = W.input; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true;
  const said: string[] = []; { const msg = game.msg.bind(game); game.msg = (t: string) => { said.push(t); msg(t); }; }
  const why = (o.stage ?? 'rc') === 'rc' ? RC.start(seed) : NB.start();
  const seen = new Set<any>(), heard = new WeakSet<any>();
  const R = { W, game, input, RC, NB, O, D, why, said, quiet: !!o.quiet, lines: [] as { who: string; text: string; t: number }[],
    /** who went down, when, by whom · the least any two living teammates have been apart on any frame (and who) · run before / after every frame */
    downs: [] as { who: any; t: number; by: any }[], closest: Infinity, closestWho: '', pre: null as null | (() => void), post: null as null | (() => void),
    /** rounds the teammates fired · the ones whose line passed through a living teammate */
    rounds: 0, through: [] as string[],
    get ops(): any[] { return NB.ops; }, get hostiles(): any[] { return NB.hostiles; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.player.visibility = 0.05;
        if (R.quiet) for (const h of NB.hostiles) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
        R.pre?.();
        const was = game.guards.map((x: any) => [x, x.state] as const);
        W.step(DT);
        for (const e of game.events) { if (seen.has(e)) continue; seen.add(e);
          // LANES: a teammate's round that passes through a living teammate's body on its way (combat.ts lets a friend's round through him by rule, so nobody can
          // fall to it — what CAN be measured is how often a man fires with a friend in his lane)
          if (e.kind !== 'guardShot' || !e.from || !e.to) continue; const sh = R.ops.find((x: any) => x.char.id === e.who); if (!sh) continue; R.rounds++;
          const ax = e.from[0], az = e.from[2], bx = e.to[0] - ax, bz = e.to[2] - az, L2 = bx * bx + bz * bz || 1;
          for (const m of R.ops) { if (m === sh || m.state === 'dead') continue; const k = ((m.char.pos[0] - ax) * bx + (m.char.pos[2] - az) * bz) / L2; if (k <= 0.02 || k >= 1) continue;
            const y = e.from[1] + (e.to[1] - e.from[1]) * k - m.char.pos[1]; if (Math.hypot(ax + bx * k - m.char.pos[0], az + bz * k - m.char.pos[2]) < 0.28 && y > 0 && y < 1.8) { R.through.push(`${sh.callsign} through ${m.callsign} at ${f2(game.time)} s`); break; } } }
        for (const [x, st] of was) if (st !== 'dead' && x.state === 'dead') R.downs.push({ who: x, t: game.time, by: game.guards.find((k: any) => k.char.id === x.killerId) ?? null });
        for (const gd of game.guards) { const b = gd.bubble; if (b && !heard.has(b)) { heard.add(b); R.lines.push({ who: gd.callsign, text: b.text, t: game.time }); } }
        const up = R.ops.filter((x: any) => x.state !== 'dead');
        for (let a = 0; a < up.length; a++) for (let b = a + 1; b < up.length; b++) { const dd = dist(up[a].char.pos, up[b].char.pos); if (dd < R.closest) { R.closest = dd; R.closestWho = `${up[a].callsign} / ${up[b].callsign} at ${f2(game.time)} s`; } }
        R.post?.();
      }
    },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    door(name: string): any { return game.doors.list.find((d: any) => d.def.name === name); },
    target(name: string) { return O.targetAt(R.door(name).frameCentre); },
    give(id: string, name: string, who: any = 'all'): string | null { return O.give(id, R.target(name), who); },
    floor(p: number[]) { return O.targetAt(p); },
    get op(): any { return D.ops[0] ?? D.done[D.done.length - 1] ?? null; },
    beats(op: any): string { return (op?.beats ?? []).map((b: any) => b.what).join(' | '); },
    room(id: string) { return RC.rooms.find((r: any) => r.def.id === id); },
    /** press X on p (one frame, nothing held), then the digit a third of a second later: the row with that digit, as a player gives it */
    pick(p: number[], n: number) { W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); R.step(); R.step(20); input.pressed.add(`Digit${n}`); R.step(); },
    /** friendly fire: a teammate down by a teammate's (or Sam's) hand */
    get fratricide(): string[] { return R.downs.filter(x => x.who.team === 'operative' && (x.by?.team === 'operative' || x.who.killerId === game.player.char.id)).map(x => `${x.who.callsign} by ${x.by?.callsign ?? 'Sam'}`); },
  };
  R.step(30);
  if (o.door) { game.teleportPlayer(SAM[o.door]); R.step(5); }
  return R;
}
const minApart = (men: any[]) => { let m = Infinity; for (let a = 0; a < men.length; a++) for (let b = a + 1; b < men.length; b++) m = Math.min(m, dist(men[a].char.pos, men[b].char.pos)); return m; };

// ---------------------------------------------------------------- off
export const foursquadOff = guarded(async () => {
  const { verdict, done } = family('foursquad-off: with the flag off the room clear stages the pair as it always did');
  const R = await rig(3, { squad: 2 }); const { game: g, O, NB } = R;
  const ops = NB.ops, dflt = ops.every((x: any) => dist(x.char.tint, [0.07, 0, 0.1]) < 1e-6 && Math.abs(x.char.tint[1] - 0.09) < 1e-6);
  verdict(R.why === null && ops.length === 2 && ops[0].callsign === 'Blue One' && ops[1].callsign === 'Blue Two' && 1 + g.guards.length === 8 && NB.hostiles.length === 5 && dflt && NB.drillOps.length === 2,
    'NIGHTBREACH.squad 2 (the default): two teammates, Blue One and Blue Two, in the default kit — eight characters with Sam and the five defenders', `start ${R.why} · ${names(ops)} · ${1 + g.guards.length} characters · ${NB.hostiles.length} defenders · default tint ${dflt}`);
  verdict(O.men().length === 2 && O.men('blue').length === 2 && O.men('red').length === 0 && O.men(1)[0] === ops[1] && O.men(ops[0])[0] === ops[0] && O.pairs().join() === 'blue' && O.pairOf(ops[0]) === 'blue',
    'the one place to ask for men answers for the pair: all = blue = the two, no red, a man by number or by himself', `all ${names(O.men())} · blue ${names(O.men('blue'))} · red ${O.men('red').length} · men(1) ${names(O.men(1))} · pairs ${O.pairs().join()}`);
  verdict(NIGHTBREACH.squad === 2 && NB_DEFAULTS.squad === 2, 'the knob defaults to 2', `NIGHTBREACH.squad ${NB_DEFAULTS.squad}`);
  return done();
});

// ---------------------------------------------------------------- stage
export const foursquadStage = guarded(async () => {
  const { verdict, done } = family('foursquad-stage: four teammates in a red pair and a blue pair, behind the flag');
  const R = await rig(3); const { game: g, O, NB, RC } = R; const ops = NB.ops, sam = g.player.char;
  verdict(R.why === null && ops.length === 4 && names(ops) === 'Red One, Red Two, Blue One, Blue Two' && ops.every((x: any) => x.state !== 'dead' && x.team === 'operative'), 'the room clear starts with four teammates: Red One, Red Two, Blue One, Blue Two', `start ${R.why} · ${names(ops)} · ${RC.summary()}`);
  verdict(ops.map((x: any) => x.unit.pair).join() === 'red,red,blue,blue' && O.pairs().join() === 'red,blue' && ops.every((x: any) => O.pairOf(x) === x.unit.pair), 'each man carries his pair in his papers (Guard.unit.pair)', ops.map((x: any) => `${x.callsign}: ${x.unit.pair}`).join(' · '));
  const red = ops[0].char, blue = ops[2].char, same = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  verdict(same(ops[0].char.tint2, ops[1].char.tint2) && same(ops[2].char.tint2, ops[3].char.tint2) && red.tint2[0] > 3 * red.tint2[2] && blue.tint2[2] > 3 * blue.tint2[0] && !same(red.tint, blue.tint),
    'the pairs wear their colours: a pair alike, red and blue apart (the look itself is unseen here)', `red ${red.tint.map(f2)} / joints ${red.tint2.map(f2)} · blue ${blue.tint.map(f2)} / joints ${blue.tint2.map(f2)}`);
  const all = [sam, ...ops.map((x: any) => x.char)]; let near = Infinity; for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) near = Math.min(near, dist(all[a].pos, all[b].pos));
  verdict(near > 0.8 && ops.every((x: any) => !g.col.nav.isBlocked(x.char.pos[0], x.char.pos[2]) && dist(x.char.pos, sam.pos) < 4), 'staged on free floor beside Sam, a body\'s room apart', `${ops.map((x: any) => `${x.callsign} ${at(x.char.pos)}`).join(' · ')} · Sam ${at(sam.pos)} · nearest two ${f2(near)} m`);
  verdict(NB.hostiles.length === 5 && RC.rooms.length === 4 && 1 + g.guards.length === 10, 'all five defenders are still dealt into the four rooms: ten characters', `${NB.hostiles.length} defenders · ${RC.rooms.map((r: any) => `${r.def.name} ${r.defenders.length}`).join(' · ')} · ${1 + g.guards.length} characters`);
  verdict(names(O.men()) === names(ops) && names(O.men('red')) === 'Red One, Red Two' && names(O.men('blue')) === 'Blue One, Blue Two' && O.men(2)[0] === ops[2] && O.men(ops[3])[0] === ops[3] && O.men(7).length === 0,
    'men(): the squad, a pair, a man — one call each', `all [${names(O.men())}] · red [${names(O.men('red'))}] · blue [${names(O.men('blue'))}] · men(2) ${names(O.men(2))} · men(Blue Two) ${names(O.men(ops[3]))} · men(7) ${O.men(7).length}`);
  // THE TEAM STARTS FALLEN IN (startfile.ts START.fallIn — up in the page, down on the frozen stand): the room clear stages the four on the menu's own 'fall in',
  // so until F nobody reads 'waiting' or 'standing by' — every man holds that order and reads 'with you'. Whose the drill is does not move: red's, never blue's.
  const { START } = await import(`${ROOT}/src/game/startfile.ts`); const fell: boolean = START.fallIn;
  verdict(names(NB.drillOps) === 'Red One, Red Two' && (fell ? !NB.drillOps.includes(ops[2]) && !NB.drillOps.includes(ops[3]) && ops.every((x: any) => O.of(x)?.order === 'fallIn' && O.statusOf(x) === 'with you') : O.statusOf(ops[0]) === 'waiting' && O.statusOf(ops[2]) === 'standing by'),
    fell ? 'F\'s drill is the red pair\'s, blue outside it; until F all four hold the fall-in they start on (\'with you\')' : 'F\'s drill is the red pair\'s; blue stands by', `drill: ${names(NB.drillOps)} · ${O.summary()}`);
  // an order to a pair moves the pair alone
  // (fallen in, red is not a pair with no order: it holds its fall-in, and when blue leaves the file it closes up on Sam — a step that is not toward the spot.
  //  Asked there: the SAME order as before on both red men, still 'with you' beside Sam, and neither any nearer the spot blue was sent to)
  const p0 = ops.map((x: any) => [...x.char.pos]), had = ops.map((x: any) => O.of(x)), toSpot = ops.map((x: any) => dist(x.char.pos, AISLE));
  const why = O.give('move', R.floor(AISLE), 'blue'); R.until(() => O.men('blue').every((m: any) => O.of(m)?.arrived), 14); R.step(30);
  const moved = ops.map((x: any, i: number) => dist(x.char.pos, p0[i])); const l = O.log[O.log.length - 1];
  const redStays = fell ? [0, 1].every(i => O.of(ops[i]) === had[i] && had[i]?.order === 'fallIn' && O.statusOf(ops[i]) === 'with you' && dist(ops[i].char.pos, AISLE) > toSpot[i] - 0.3 && dist(ops[i].char.pos, sam.pos) < 4)
    : moved[0] < 0.7 && moved[1] < 0.7 && !O.has(ops[0]) && !O.has(ops[1]);
  verdict(why === null && l?.who.join() === 'Blue One,Blue Two' && redStays && O.men('blue').every((m: any) => dist(m.char.pos, AISLE) < 2.55),
    fell ? 'give(\'move\', spot, \'blue\'): the blue pair goes; red keeps the fall-in it held and stays with Sam (it closes the file blue left, no nearer the spot)' : 'give(\'move\', spot, \'blue\'): the blue pair goes; red has no order and stays (shouldered aside a step as blue files past from behind it)',
    `give → ${why} · log: ${l?.order} → ${l?.who.join(' + ')} · moved ${moved.map(f2).join(' / ')} m · said "${R.said[R.said.length - 1]}"${fell ? ` · red: ${[0, 1].map(i => `${ops[i].callsign} ${O.of(ops[i]) === had[i] ? 'the same' : 'ANOTHER'} ${O.of(ops[i])?.order ?? 'no order'}, ${O.statusOf(ops[i])}, ${f2(toSpot[i])} → ${f2(dist(ops[i].char.pos, AISLE))} m from the spot, ${f2(dist(ops[i].char.pos, sam.pos))} m from Sam`).join(' · ')}` : ''}`);
  // T steps the element: everyone (gold) → red → blue → everyone; T with the cursor on a man is that man, and T again goes back to everyone
  R.W.cursorAt([...g.player.char.pos]);
  const cyc: any[] = []; for (let i = 0; i < 4; i++) { R.input.pressed.add(ORDERS.whoKey); R.step(); cyc.push(O.who); }
  R.W.cursorAt([ops[3].char.pos[0], 1.2, ops[3].char.pos[2]]); R.input.pressed.add(ORDERS.whoKey); R.step(); const onMan = O.who; R.input.pressed.add(ORDERS.whoKey); R.step(); const back = O.who;
  verdict(cyc.join() === 'red,blue,all,red' && onMan === 3 && back === 'all', 'T steps all → red → blue → all; T with the cursor on a man is that man alone, T again is everyone', `who after each tap: ${cyc.join(' ')} · on ${ops[3].callsign}: ${onMan} · again: ${back}`);
  // down and a pair selection
  O.who = 'red'; R.step(2); const kept = O.who; killGuard(g, ops[0], [1, 0, 0], false, 'shot', 'player'); killGuard(g, ops[1], [1, 0, 0], false, 'shot', 'player'); R.step(2);
  verdict(kept === 'red' && O.who === 'all' && O.men('red').length === 0 && O.men('red', { down: true }).length === 2 && O.men().length === 2, 'a pair chosen as "who" stands while a man of it lives, and falls back to all when the pair is down; men() lists the living unless asked', `who 'red' kept: ${kept} · after both red down: ${O.who} · red living ${O.men('red').length}, with the down ${O.men('red', { down: true }).length}`);
  // a restart stages the four again
  g.restartEncounter(); R.step(30);
  verdict(NB.ops.length === 4 && names(NB.ops) === 'Red One, Red Two, Blue One, Blue Two' && NB.ops.every((x: any) => x.state !== 'dead') && 1 + g.guards.length === 10 && NB.staged === 2, 'a restart stages the four again', `${names(NB.ops)} · staged ×${NB.staged} · ${1 + g.guards.length} characters`);
  // stop: the shift back; the knob at 2: the pair
  RC.stop(); R.step(10); const staff = g.guards.length, units = g.guards.filter((x: any) => x.unit).length;
  NIGHTBREACH.squad = 2; const why2 = RC.start(3); R.step(30);
  verdict(units === 0 && staff >= 3 && why2 === null && NB.ops.length === 2 && names(NB.ops) === 'Blue One, Blue Two' && 1 + g.guards.length === 8, 'stop puts the shift back with no unit left; the next start with the knob at 2 is the pair', `after stop: ${staff} guards, ${units} units · restart at 2: ${why2} · ${names(NB.ops)} · ${1 + g.guards.length} characters`);
  return done();
});

// ---------------------------------------------------------------- follow
export const foursquadFollow = guarded(async () => {
  const { verdict, done } = family('foursquad-follow: fall in keeps all four with Sam across two rooms and through the doors');
  const R = await rig(11, { quiet: true }); const { game: g, O, NB } = R; const men = NB.ops, sam = g.player.char;
  // away first, so that falling in is a real leg
  O.give('move', R.floor([21, 0, 17.6])); R.until(() => men.every((m: any) => O.of(m)?.arrived), 14);
  const far = men.map((m: any) => dist(m.char.pos, sam.pos)), ranks = minApart(men);
  O.give('fallIn', O.targetAt(sam.pos)); const l = O.log[O.log.length - 1];
  R.until(() => men.every((m: any) => O.of(m)?.arrived), 14); R.step(90);
  const near = men.map((m: any) => dist(m.char.pos, sam.pos)), file = [...men].sort((a: any, b: any) => O.of(a).follow - O.of(b).follow);
  const together = O.pairOf(file[0]) === O.pairOf(file[1]) && O.pairOf(file[2]) === O.pairOf(file[3]);
  verdict(l?.order === 'fallIn' && l.who.length === 4 && far.every((d: number) => d > 6) && near.every((d: number) => d > 0.6 && d < 5.8) && minApart(men) > 0.6 && men.every((m: any) => O.statusOf(m) === 'with you') && together,
    'fall in: the four come back from a far spot and close up behind Sam in one file, each pair together', `from ${far.map(f2).join(' / ')} m (apart ${f2(ranks)} m there) to ${near.map(f2).join(' / ')} m of Sam · file ${names(file)} · nearest two ${f2(minApart(men))} m`);
  // the walk: the aisle → the west door → across the break room → out of the north door → along the corridor
  const Wd = R.door('breakroom_w'), Nd = R.door('breakroom_n');
  const legs: number[][] = [[26.6, 0, 17.6], [29.6, 0, 17.6], [30.75, 0, 13.6], [30.75, 0, 11.0], [22, 0, 11.0]];
  const path: number[][] = [[sam.pos[0], 0, sam.pos[2]]]; let noPath = '';
  for (const p of legs) { const leg = g.col.nav.findPath(path[path.length - 1], p); if (!leg) { noPath = `no nav path to ${at(p)}`; break; } for (const q of leg) path.push([q[0], 0, q[2]]); path.push(p); }
  let seg = 0, t = 0; const SPEED = 1.55; let walked = 0, frames = 0, far6 = 0; const worst = men.map(() => 0);
  R.pre = () => {
    if (seg >= path.length - 1) return;
    let stepLeft = SPEED * DT;
    while (stepLeft > 0 && seg < path.length - 1) { const a = path[seg], b = path[seg + 1], L = dist(a, b); if (L - t <= stepLeft) { stepLeft -= L - t; seg++; t = 0; } else { t += stepLeft; stepLeft = 0; } }
    const a = path[seg], b = path[Math.min(seg + 1, path.length - 1)], L = dist(a, b) || 1, f = seg >= path.length - 1 ? 0 : t / L;
    g.teleportPlayer([a[0] + (b[0] - a[0]) * f, 0, a[2] + (b[2] - a[2]) * f]); walked += SPEED * DT;
  };
  R.closest = Infinity; const tWalk = g.time;
  while (seg < path.length - 1 && g.time - tWalk < 90) { R.step(); men.forEach((m: any, i: number) => { const d = dist(m.char.pos, sam.pos); worst[i] = Math.max(worst[i], d); if (d > 6.5) far6++; }); frames++; }
  R.pre = null; const walkSecs = g.time - tWalk;
  R.until(() => men.every((m: any) => O.of(m)?.arrived), 10); R.step(60 * 2);
  const end = men.map((m: any) => dist(m.char.pos, sam.pos)), room = (p: number[]) => p[2] < 12.2 ? 'corridor' : p[0] > 28 ? 'break room' : 'cubicles';
  verdict(!noPath && seg >= path.length - 1, 'Sam\'s walk: 1.55 m/s from the aisle, in at the west door, across the break room, out at the north door, along the corridor', noPath || `${f2(walked)} m in ${f2(walkSecs)} s · ended ${at(sam.pos)} (${room(sam.pos)})`);
  verdict(worst.every((d: any) => d < 8) && far6 / (4 * frames) < 0.1, 'all four stay with him the whole way (the last man of four files 4.6 m back)', `furthest ${worst.map(f2).join(' / ')} m · further than 6.5 m for ${f2(100 * far6 / (4 * frames))} % of the man-frames`);
  verdict(end.every((d: any) => d < 5.8) && men.every((m: any) => room(m.char.pos) === 'corridor' && m.state !== 'dead'), 'they end with him on the far side of both doors', `${end.map(f2).join(' / ')} m from Sam · ${men.map((m: any) => `${m.callsign} ${at(m.char.pos)} ${room(m.char.pos)}`).join(' · ')}`);
  verdict(!men.some((m: any) => inDoorway(Wd, m.char.pos) || inDoorway(Nd, m.char.pos)) && minApart(men) > 0.6, 'nobody is left standing in a doorway, and nobody on top of anybody', `nearest two at the end ${f2(minApart(men))} m`);
  verdict(R.closest > 0.5, 'through the doors: never two men in one place (centres never nearer than half a metre)', `closest on any frame of the walk: ${f2(R.closest)} m (${R.closestWho})`);
  // hold and cover take all four where they stand
  const here = men.map((m: any) => [...m.char.pos]); O.give('hold', O.targetAt(sam.pos)); R.step(90);
  const heldOk = men.every((m: any, i: number) => O.of(m)?.order === 'hold' && dist(m.char.pos, here[i]) < 0.5);
  const whyC = O.give('cover', R.floor([14, 0, 11.0])); R.step(120);
  verdict(heldOk && men.filter((m: any) => O.of(m)?.order === 'cover').length >= 3, 'hold: all four stop where they stand; cover: the men with a line take it (a man with none says so and keeps his order)', `held ${heldOk} · cover → ${whyC} · ${men.map((m: any) => `${m.callsign}: ${O.statusOf(m)}`).join(' · ')}`);
  // the squad row's word on a walk: ten seconds straight down the corridor with the four behind him. The row prints statusOf every frame, and a follower's
  // 'with you' / 'falling in' was his bare 'in place' bit (0.8 m off a place dealt again in half metre jumps): it flipped several times a second on every man.
  // It is latched now (orders.ts followWord, ORDERS.wordFarM / wordHoldS). FOLLOWWORD_BREAK=1 = the two numbers at 0, which is the word as it was: must fail
  { const BREAK = (globalThis as any).process.env.FOLLOWWORD_BREAK === '1'; if (BREAK) { ORDERS.wordFarM = 0; ORDERS.wordHoldS = 0; }
    O.give('fallIn', O.targetAt(sam.pos)); R.until(() => men.every((m: any) => O.of(m)?.arrived), 14); R.step(90);
    const from = [sam.pos[0], 0, sam.pos[2]], to = [6, 0, 11.0], L = dist(from, to), clear = !!g.col.nav.findPath(from, to) && g.col.nav.walkable(from, to);
    const word = men.map((m: any) => O.statusOf(m)), raw = men.map((m: any) => !!O.of(m)?.arrived), words = men.map(() => 0), flips = men.map(() => 0), seen = men.map((_: any, i: number) => [word[i]]);
    let gone = 0; const t0 = g.time;
    R.pre = () => { gone = Math.min(L, gone + SPEED * DT); g.teleportPlayer([from[0] + (to[0] - from[0]) * gone / L, 0, from[2] + (to[2] - from[2]) * gone / L]); };
    while (clear && g.time - t0 < 10 && gone < L) { R.step(); men.forEach((m: any, i: number) => {
      const w = O.statusOf(m), a = !!O.of(m)?.arrived; if (w !== word[i]) { words[i]++; word[i] = w; if (!seen[i].includes(w)) seen[i].push(w); } if (a !== raw[i]) { flips[i]++; raw[i] = a; } }); }
    R.pre = null; const secs = g.time - t0;    verdict(clear && secs > 9.5 && words.every((n: number) => n <= 2) && men.every((m: any) => O.of(m)?.order === 'fallIn' && m.state !== 'dead'), 'the squad row on a walk: each man\'s word changes twice at most in ten seconds of following (it flipped with every half metre his place was dealt again)',
      `${f2(gone)} m in ${f2(secs)} s along the corridor${clear ? '' : ' — NO CLEAR WALK'} · word changes ${words.join(' / ')} (${men.map((m: any, i: number) => `${m.callsign}: ${seen[i].join(' → ')}`).join(' · ')}) · his 'in place' bit flipped ${flips.join(' / ')} times${BREAK ? ' · FOLLOWWORD_BREAK: the latch off' : ''}`); }
  return done();
});

// ---------------------------------------------------------------- stack
export const foursquadStack = guarded(async () => {
  const { verdict, done } = family('foursquad-stack: four marks on a door, two files, a pair a file');
  const R = await rig(5, { quiet: true, door: 'manager' }); const { game: g, O, D, NB } = R; const men = NB.ops, sam = g.player.char;
  // geometry: every door of the structure, from the side its room's clear plan (or the corridor) takes it
  const rows: string[] = []; let geomOk = true;
  for (const room of STRUCTURE.rooms) for (const { id: dn } of room.doors) { const d = R.door(dn); if (!d) continue;
    for (const side of [1, -1] as const) { const inside = [d.frameCentre[0] - Math.sin(d.def.closedDir) * side * 1.2, 0, d.frameCentre[2] + Math.cos(d.def.closedDir) * side * 1.2];
      if (inBounds(room.bounds, inside)) continue;   // (the squad takes a room's door from OUTSIDE the room)
      const posts = O.stackPosts(d, side, men), tucked = D.stackPosts(d, side, men), pods = D.pods(d, side, 4), so = D.standoffPosts(d, side, 4);
      let apart = Infinity; if (tucked) for (let a = 0; a < tucked.length; a++) for (let b = a + 1; b < tucked.length; b++) apart = Math.min(apart, dist(tucked[a].pos, tucked[b].pos));
      const ok = !!posts && posts.length === 4 && !!tucked && tucked.length === 4 && apart > 0.7 && tucked.every((p: any) => !g.col.nav.isBlocked(p.pos[0], p.pos[2]) && !inDoorway(d, p.pos)) && pods.length >= 3 && pods.every((p: any) => inBounds(room.bounds, p.pos, 0.3));
      if (!ok && !(dn === 'server_manager')) geomOk = false;   // (the keypad door between two rooms: taken from inside a room — printed, not judged)
      rows.push(`${dn} from ${side > 0 ? '+' : '−'}: ${tucked ? `${tucked.length} marks ${tucked.map((p: any) => `${at(p.pos)}${p.lead ? '*' : ''}`).join(' ')} (nearest two ${f2(apart)} m)` : 'no stack'} · ${pods.length} points inside · stand-off ${so ? so.length : 'none'}${ok ? '' : '  ← short'}`); } }
  verdict(geomOk, 'every outside door of the four rooms has four stack marks (apart, on free floor, out of the opening) and at least three points inside for an entry', rows.join('\n    '));
  // live: stack up on the manager's door from the corridor
  const d = R.door('manager'); const why = R.give('stack', 'manager'); const posts = men.map((m: any) => O.of(m)?.post);
  const set = R.until(() => men.every((m: any) => O.of(m)?.arrived), 20); R.step(90);
  const off = men.map((m: any, i: number) => dist(m.char.pos, posts[i])), hiSide = (m: any) => alongOf(d, m.char.pos) > d.def.width / 2;
  const redTogether = hiSide(men[0]) === hiSide(men[1]), blueTogether = hiSide(men[2]) === hiSide(men[3]);
  verdict(why === null && set && off.every((x: any) => x < 0.4) && minApart(men) > 0.7 && men.every((m: any) => O.statusOf(m) === 'stacked · manager door'), 'stack up (the manager\'s door, from the corridor): all four on their own marks', `give → ${why} · ${men.map((m: any, i: number) => `${m.callsign} ${at(m.char.pos)} (${f2(off[i])} m off)`).join(' · ')} · nearest two ${f2(minApart(men))} m`);
  // GLASS IS NOT COVER (orders.ts stackPosts, GLASSPEN.stackEyes — live in the page; no lines while rounds stop in glass, which is the frozen stand): a jamb the
  // room's rifles reach through a pane is nobody's place, and this door's latch jamb is one. So there the four are ONE file down the other wall: the lead at the
  // jamb, the rest behind him (a place left open where Sam stands), red ahead of blue. The game is asked what its dealer asks — the lines through glass onto each
  // bare jamb (glassEyes) — and with such a jamb: everybody on the other hand, on a mark none of those lines reach, the file unbroken, each pair together in it,
  // 'set.' once. Two files, a pair a jamb, is still the deal at a door with no glass in reach: asked of the marks the server room's door is dealt (nobody is sent there).
  const { GLASSPEN } = await import(`${ROOT}/src/game/glasspen.ts`); const side = sideOf(d, sam.pos);
  const jamb = (dr: any, s: number, latch: boolean) => { const th = dr.def.closedDir, al = latch ? dr.def.width + ORDERS.jambPast : -ORDERS.jambPast; return [dr.def.hinge[0] + Math.cos(th) * al - Math.sin(th) * s * ORDERS.jambOut, 0, dr.def.hinge[1] + Math.sin(th) * al + Math.cos(th) * s * ORDERS.jambOut]; };
  const eyesL: number = O.glassEyes(d, side, jamb(d, side, true)), eyesH: number = O.glassEyes(d, side, jamb(d, side, false)), pane = GLASSPEN.stackEyes > 0 && Math.max(eyesL, eyesH) >= GLASSPEN.stackEyes && eyesL !== eyesH;
  const where = `${men.map((m: any) => `${m.callsign}: ${hiSide(m) ? 'latch' : 'hinge'} side, ${f2(Math.abs(alongOf(d, m.char.pos) - d.def.width / 2))} m from the middle`).join(' · ')}`;
  if (!pane) verdict(redTogether && blueTogether && hiSide(men[0]) !== hiSide(men[2]), 'red on one jamb, blue on the other', where);
  else { const hi = eyesH > eyesL, edge = (p: number[]) => { const a = alongOf(d, p); return a > d.def.width / 2 ? a - d.def.width : -a; };   // (hi: the file is the latch wall's — the hand fewer of the lines reach)
    const file = men.map((_: any, i: number) => i).sort((a: number, b: number) => edge(posts[a]) - edge(posts[b])), gaps = file.map((i: number, k: number) => edge(posts[i]) - (k ? edge(posts[file[k - 1]]) : 0));
    const oneHand = men.every((m: any, i: number) => hiSide(m) === hi && (alongOf(d, posts[i]) > d.def.width / 2) === hi), onMarks = off.every((x: number) => x < 0.4);
    const lines: number[] = posts.map((p: number[]) => O.glassEyes(d, side, p)), unseen = lines.every(n => n < GLASSPEN.stackEyes);
    const filed = gaps.every((x: number, k: number) => k === 0 ? Math.abs(x - ORDERS.jambPast) < 0.1 : x > 0.7 && x < 2 * ORDERS.fileGap + 0.1), pairsKept = O.pairOf(men[file[0]]) === O.pairOf(men[file[1]]) && O.pairOf(men[file[2]]) === O.pairOf(men[file[3]]);
    const sets = R.lines.filter(s => s.text === 'set.').length;
    const dS = R.door('server'), sS = sideOf(dS, SAM.server), pS = O.stackPosts(dS, sS, men), hiS = (p: any) => alongOf(dS, p.pos) > dS.def.width / 2;
    const eyesS: number[] = [O.glassEyes(dS, sS, jamb(dS, sS, true)), O.glassEyes(dS, sS, jamb(dS, sS, false))];
    const twoFiles = Math.max(...eyesS) < GLASSPEN.stackEyes && !!pS && pS.length === 4 && hiS(pS[0]) === hiS(pS[1]) && hiS(pS[2]) === hiS(pS[3]) && hiS(pS[0]) !== hiS(pS[2]);
    verdict(oneHand && onMarks && unseen && filed && pairsKept && sets === 1 && twoFiles, 'a jamb in the room\'s lines through glass is nobody\'s: one file of four down the other wall, on marks out of those lines, each pair together, "set." once — and a door with no glass in reach is still dealt red on one jamb, blue on the other',
      `${where} · lines through glass onto the bare jambs: latch ${eyesL}, hinge ${eyesH} (${GLASSPEN.stackEyes} make it no place) · the file: ${file.map((i: number, k: number) => `${men[i].callsign} ${f2(gaps[k])} m ${k ? 'behind' : 'off the jamb'}, ${lines[i]} lines, ${f2(off[i])} m off his mark`).join(' · ')} · "set." ×${sets} · the server room's door (lines ${eyesS.join(' / ')}): ${pS ? pS.map((p: any, i: number) => `${men[i].callsign} ${hiS(p) ? 'latch' : 'hinge'}`).join(', ') : 'no marks'}`); }
  verdict(!men.some((m: any) => inDoorway(d, m.char.pos)) && men.every((m: any) => offOf(d, m.char.pos) * sideOf(d, sam.pos) > 0) && R.lines.filter(s => s.text === 'set.').length === 1, 'nobody in the opening, everybody on Sam\'s side of it, and "set." is called, once', `"set." by ${R.lines.filter(s => s.text === 'set.').map(s => s.who).join(', ') || 'nobody'}`);
  // the menu, as a player gives it: X pressed on the door, then 1
  O.give('fallIn', O.targetAt(sam.pos)); R.step(120); R.pick([d.frameCentre[0], 1, d.frameCentre[2]], 1); const lm = O.log[O.log.length - 1];
  verdict(lm?.order === 'stack' && lm.who.length === 4, 'the same from the menu (X pressed on the door, then 1): the order goes to all four', `${lm?.order} → ${lm?.who.join(' + ')}`);
  // move there: two ranks of two — the line abreast, which is what the order is with roomfit.ts's switch off (on: marks dealt from the room — roomfit-walk)
  ROOMFIT.on = false;
  g.teleportPlayer([12, 0, 17.6]); R.step(5);
  const whyM = O.give('move', R.floor([19, 0, 17.6])); const arrived = R.until(() => men.every((m: any) => O.of(m)?.arrived), 20);
  R.step((await import(`${ROOT}/src/game/teampace.ts`)).TEAMPACE.on ? 240 : 60);   // (at the team's slower walk, teampace.ts, a man called arrived 0.3 m short takes two seconds more onto his mark)
  const spots = men.map((m: any) => m.char.pos), xs = spots.map((p: number[]) => p[0]).sort((a: number, b: number) => a - b);
  const rr = Math.abs(spots[0][0] - spots[1][0]) < 0.4 && Math.abs(spots[2][0] - spots[3][0]) < 0.4;
  verdict(whyM === null && arrived && minApart(men) > 0.7 && xs[3] - xs[0] < 1.6 && xs[3] - xs[0] > 0.5 && rr, 'move there (ROOMFIT off): two ranks of two across the way they were sent, a pair a rank', `give → ${whyM} · ${men.map((m: any) => `${m.callsign} ${at(m.char.pos)}`).join(' · ')} · nearest two ${f2(minApart(men))} m`);
  ROOMFIT.on = true;
  // part-orders on one door (what the pair rows will give): red stacks, then blue is sent to the door red holds, then the same a man at a time
  { g.teleportPlayer(SAM.manager); R.step(5); O.give('fallIn', O.targetAt(sam.pos)); R.step(150);
    const w1 = R.give('stack', 'manager', 'red'); const s1 = R.until(() => men.slice(0, 2).every((m: any) => O.of(m)?.arrived), 20);
    const w2 = R.give('stack', 'manager', 'blue'); const s2 = R.until(() => men.every((m: any) => O.of(m)?.arrived), 20); R.step(60);
    const marks = men.map((m: any) => O.of(m)?.post as number[] | null); let near = Infinity; for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (marks[a] && marks[b]) near = Math.min(near, dist(marks[a]!, marks[b]!));
    verdict(w1 === null && w2 === null && s1 && s2 && marks.every(Boolean) && near > 0.7 && minApart(men) > 0.6 && !men.some((m: any) => inDoorway(d, m.char.pos)), 'a pair sent to stack on a door the other pair holds files in behind them: four marks, no two the same, nobody in the opening', `red → ${w1}, blue → ${w2} · ${men.map((m: any, i: number) => `${m.callsign} ${marks[i] ? at(marks[i]!) : 'no mark'}`).join(' · ')} · nearest two marks ${f2(near)} m`);
    O.give('fallIn', O.targetAt(sam.pos)); R.step(150); const ws: (string | null)[] = [];
    for (let i = 0; i < 4; i++) { ws.push(R.give('stack', 'manager', i)); R.until(() => !!O.of(men[i])?.arrived, 15); }
    R.step(60); const m1 = men.map((m: any) => O.of(m)?.post as number[] | null); let near1 = Infinity; for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (m1[a] && m1[b]) near1 = Math.min(near1, dist(m1[a]!, m1[b]!));
    verdict(ws.every(w => w === null) && m1.every(Boolean) && near1 > 0.7 && minApart(men) > 0.6, 'the four sent to one door a man at a time (T, then the row): each takes a free place — the third and fourth behind the first two', `${men.map((m: any, i: number) => `${m.callsign} → ${ws[i]} ${m1[i] ? at(m1[i]!) : 'no mark'}`).join(' · ')} · nearest two marks ${f2(near1)} m`); }
  // three men: one down
  killGuard(g, men[3], [1, 0, 0], false, 'shot', 'player'); R.step(5); g.teleportPlayer(SAM.manager); R.step(5);
  const why3 = R.give('stack', 'manager'); const set3 = R.until(() => O.men().every((m: any) => O.of(m)?.arrived), 20);
  verdict(why3 === null && set3 && O.men().length === 3 && minApart(O.men()) > 0.7, 'with a man down the three left stack the same way', `give → ${why3} · ${O.men().map((m: any) => `${m.callsign} ${at(m.char.pos)}`).join(' · ')}`);
  return done();
});
function inBounds(b: { x0: number; x1: number; z0: number; z1: number }, p: number[], m = 0) { return p[0] > b.x0 - m && p[0] < b.x1 + m && p[2] > b.z0 - m && p[2] < b.z1 + m; }

// ---------------------------------------------------------------- clear
export const foursquadClear = guarded(async () => {
  const { verdict, done } = family('foursquad-clear: the four take rooms with the existing rows');
  const CASES: { id: string; door: string; room: string }[] = [
    { id: 'openClear', door: 'storage', room: 'storage' }, { id: 'bangClear', door: 'manager', room: 'manager' },
    { id: 'bangClear', door: 'breakroom_n', room: 'breakroom' }, { id: 'openClear', door: 'server', room: 'server' }, { id: 'bangClear', door: 'breakroom_w', room: 'breakroom' } ];
  const SEEDS = [2, 5, 9];
  const rows: string[] = []; let runs = 0, ended = 0, allIn = 0, cleared = 0, lost = 0, rounds = 0, ff: string[] = [], through: string[] = [], stuck: string[] = [], threw = '';
  for (const C of CASES) for (const seed of SEEDS) {
    const R = await rig(seed, { door: C.door }); const { game: g, O, D, NB, RC } = R; const men = NB.ops, d = R.door(C.door); runs++;
    // (three of these doors are locked, and on the SHIPPED stand the lead TRIES a door nobody knew was locked and the order ends there, 'found shut' —
    // DOORTOOLS.testDoor, a FROZEN_HOLDS row, held by doortest-check.ts. These lines are about the four going in behind the existing rows, so the entry
    // boots the door and goes on as it did; the next rig and `guarded` put the knob back.)
    DOORTOOLS.testDoor = false;
    const room = R.room(C.room);
    try {
      const why = R.give(C.id, C.door);   // (the row's own order, as the menu's release gives it — the cursor's ray from this camera does not reach every corridor door: foursquad-stack gives one through the menu itself)
      const op = D.ops[0]; const took = why === null && !!op && op.kind === C.id && op.door === d && op.men.length === 4;
      let dealtT = NaN; R.post = () => { if (Number.isNaN(dealtT) && op?.pod?.size) dealtT = g.time; };   // (the moment the entry is dealt: the first step the order has given anybody a place inside)
      R.until(() => !D.ops.includes(op), 45); R.step(60); R.post = null;
      const inMen = op ? [...op.crossed.keys()] : [], sent = op ? [...op.pod.keys()] : [];
      const up = men.filter((m: any) => m.state !== 'dead'), isIn = (m: any) => inBounds(room.def.bounds, m.char.pos, 0.2);
      const left = room.defenders.filter((h: any) => h.state !== 'dead').length;
      const done1 = !!op && op.ended === 'in'; if (done1) ended++;
      // (a man who fell on his way to the stack was never given a place inside: he 'fell trying' as much as one who fell in the doorway. On the SHIPPED stand
      // storage seed 5 loses two at the stack — the room's own man, alerted by the squad's shots at another on the way, opens his door on them — and the two
      // left are sent and cross: the line's own words, which a bare count of the men sent read as a failure.)
      // (… BEFORE: down by the step the entry was dealt. A man the order left out who was shot afterwards is a man it sent too few of, not one who fell trying.)
      const fellBefore = R.downs.filter(x => men.includes(x.who) && !sent.includes(x.who) && x.t <= dealtT).length;
      const crossedAll = sent.length >= 1 && sent.length + fellBefore >= 3 && sent.every((m: any) => op.crossed.has(m) || m.state === 'dead'); if (took && done1 && crossedAll) allIn++;
      if (left === 0) cleared++; lost += 4 - up.length;
      for (const f of R.fratricide) ff.push(`${C.door}/${seed}: ${f}`);
      rounds += R.rounds; for (const x of R.through) through.push(`${C.door}/${seed}: ${x}`);
      for (const m of up) if (inDoorway(d, m.char.pos)) stuck.push(`${C.door}/${seed}: ${m.callsign}`);
      rows.push(`${C.id} ${C.door} seed ${seed}: ${took ? 'four on it' : `NOT taken (${op ? `${op.kind}, ${op.men.length} men` : 'no order'})`} · ended '${op?.ended}' · sent in ${sent.length}${fellBefore ? ` (${fellBefore} fell before the entry)` : ''}, crossed ${inMen.length}, inside now ${up.filter(isIn).length} of ${up.length} up · defenders left ${left}/${room.defenders.length} · teammates down ${4 - up.length}${R.downs.filter(x => x.who.team === 'operative').map(x => ` (${x.who.callsign} by ${x.by?.callsign ?? '?'})`).join('')}`);
    } catch (e) { threw = `${C.door}/${seed}: ${e instanceof Error ? e.stack : e}`; }
  }
  verdict(!threw, 'nothing threw', threw || `${runs} runs`);
  verdict(ended === runs && allIn === runs, 'every run: the order is taken by all four, every man it sends in crosses the frame line (or falls trying), and it ends \'in\'', rows.join('\n    '));
  verdict(ff.length === 0, 'no teammate went down to a teammate\'s round or Sam\'s (the game\'s rule makes this so; the lanes are counted below)', ff.join(' · ') || `${lost} teammates lost in ${runs} runs, every one to a defender`);
  verdict(stuck.length === 0, 'nobody is left standing in the doorway', stuck.join(' · ') || 'none');
  verdict(cleared >= Math.ceil(runs * 0.75), 'the room is clear at the end of at least three runs in four (the fight is a fight)', `${cleared} of ${runs} rooms clear · ${lost} teammates lost in all (${f2(lost / runs)} a run)`);
  verdict(rounds > 0 && through.length <= rounds * 0.02, 'lanes: fewer than one teammate\'s round in fifty is fired through another teammate (a friend\'s round passes through him by the game\'s rule — this counts the lines, not casualties)', `${through.length} of ${rounds} rounds${through.length ? ` · ${through.slice(0, 6).join(' · ')}` : ''}`);
  // ---- the charge, by four: one man sets it, three stand off in file (or split past the jambs), Sam blows it, they go in
  { const rows2: string[] = []; let ok = 0, n = 0, blast = 0;
    for (const [door, room, seed] of [['manager', 'manager', 2], ['breakroom_w', 'breakroom', 5]] as const) { n++;
      const R = await rig(seed, { door }); const { D, NB } = R; const why = R.give('charge', door); const op = D.ops[0]; let res: any = null;
      const posts = op ? NB.ops.filter((m: any) => m !== op.lead).map((m: any) => op.post.get(m)?.pos).filter(Boolean) : [];
      for (let i = 0; i < 60 * 70 && op && D.ops.includes(op); i++) { R.step(); if (op.phase === 'armed' && !res) res = D.blow(); }
      R.step(60); const sent = op ? [...op.pod.keys()] : [], Rm = R.room(room);
      const good = why === null && !!op && op.kind === 'charge' && !!res && res.backblast === 0 && op.ended === 'in' && sent.length >= 3 && sent.every((m: any) => op.crossed.has(m) || m.state === 'dead'); if (good) ok++; blast += res?.backblast ?? 0;
      rows2.push(`charge ${door} seed ${seed}: give → ${why} · set by ${op?.lead?.callsign} · stood off at ${posts.map(at).join(' ')} · blown: ${res ? `knocked ${res.knocked}, stunned ${res.stunned}, backblast ${res.backblast}` : 'never armed'} · ended '${op?.ended}' · sent in ${sent.length}, crossed ${op?.crossed.size} · defenders left ${Rm.defenders.filter((h: any) => h.state !== 'dead').length}/${Rm.defenders.length} · teammates down ${NB.ops.filter((m: any) => m.state === 'dead').length}`); }
    verdict(ok === n && blast === 0, 'breach with a charge, by four: set, stood off clear of the blast, blown on Sam\'s word, and in behind it', rows2.join('\n    ')); }
  // ---- clear from outside, by four: two work the opening (the pair's own way of it), two watch the squad's back from the end of the file
  { const rows3: string[] = []; let ok = 0, n = 0;
    for (const [door, room, seed] of [['breakroom_w', 'breakroom', 2], ['breakroom_w', 'breakroom', 5], ['breakroom_w', 'breakroom', 9], ['storage', 'storage', 5]] as const) { n++;
      const R = await rig(seed, { door }); const { D, NB } = R; const d = R.door(door), Rm = R.room(room); let inside = 0, inFrame = 0;
      // (the SHIPPED stand plays 'clear from outside' as one plain order that holds the door — DOORTOOLS.outsidePlain, a FROZEN_HOLDS row — and has no 'outside'
      // row: this line is about the SLICING order by four, so it asks for the threshold's page as it was; the rows are dealt again on the next frame. The store's
      // door is locked: testDoor off here as above, or that run ends 'found shut' at the stack)
      DOORTOOLS.testDoor = false; if (DOORTOOLS.outsidePlain) { DOORTOOLS.outsidePlain = false; R.step(2); }
      R.post = () => { for (const m of NB.ops) { if (m.state === 'dead') continue; if (inBounds(Rm.def.bounds, m.char.pos)) inside++; if (inDoorway(d, m.char.pos)) inFrame++; } };
      const why = R.give('outside', door); const op = D.ops[0]; const took4 = !!op && op.men.length === 4, rear: any[] = op ? [...op.rear] : [], lead0 = op?.lead, work0 = NB.ops.filter((m: any) => m !== lead0 && !rear.includes(m)), marks0 = op ? NB.ops.map((m: any) => `${m.callsign} ${at(op.post.get(m).pos)}`).join(' ') : '';
      const aL = op ? alongOf(d, op.post.get(op.lead).pos) : 0, wrongJamb = op ? NB.ops.filter((m: any) => Math.abs(alongOf(d, op.post.get(m).pos) - (d.def.width - aL)) < 0.9) : [];   // (a mark AT the jamb across from the lead's — a place or more back along that wall is out of the doorway's line)
      const held = R.until(() => op?.phase === 'held', 60); R.step(60 * 5);
      const strayed = rear.filter((m: any) => m.state !== 'dead' && dist(m.char.pos, op.post.get(m).pos) > 0.7).map((m: any) => m.callsign);
      const good = why === null && took4 && rear.length === 2 && wrongJamb.length === 0 && held && op.crossed.size === 0 && inside === 0 && strayed.length === 0; if (good) ok++;
      rows3.push(`outside ${door} seed ${seed}: give → ${why} · lead ${lead0?.callsign}, slicing with ${names(work0)} · rear ${names(rear)} · marks ${marks0} · on the other jamb: ${names(wrongJamb) || 'nobody'} · ${held ? 'held' : `phase ${op?.phase} / ended ${op?.ended}`} with ${op?.men.length} men · over the frame line ${op?.crossed.size} · man-frames inside the room ${inside}, in the opening ${inFrame} · rear men off their marks: ${strayed.join(', ') || 'none'}${R.downs.filter(x => x.who.team === 'operative').map(x => ` · ${x.who.callsign} down to ${x.by?.callsign ?? '?'}`).join('')} · defenders left ${Rm.defenders.filter((h: any) => h.state !== 'dead').length}/${Rm.defenders.length} · rounds through a friend ${R.through.length}/${R.rounds}`); }
    verdict(ok === n, 'clear from outside, by four: taken by all four — two slice the opening from the lead\'s jamb, two hold the rear from the end of that file, nobody on the other jamb, nobody over the frame line or inside (what it costs is printed: the fight is a fight)', rows3.join('\n    ')); }
  return done();
});

// ---------------------------------------------------------------- the F drill
export const foursquadDrill = guarded(async () => {
  const { verdict, done } = family('foursquad-drill: F\'s breach is the red pair\'s; blue is not owned by it');
  const R = await rig(4, { stage: 'nb' }); const { game: g, O, NB } = R; const [r1, r2, b1, b2] = NB.ops;
  verdict(R.why === null && NB.ops.length === 4 && NB.hostiles.length === 3 && 1 + g.guards.length === 8, 'the night breach alone with four: Sam, four teammates, three defenders', `start ${R.why} · ${names(NB.ops)} · ${1 + g.guards.length} characters`);
  R.input.pressed.add('KeyF'); R.step(); R.step(60);
  const own = NB.ops.map((x: any) => O.owners.some((o: any) => o.owns(x)));
  verdict(NB.state === 'stacking' && own.join() === 'true,true,false,false', 'F: the red pair goes to the stack — the drill owns red, not blue', `state ${NB.state} · owned: ${NB.ops.map((x: any, i: number) => `${x.callsign} ${own[i]}`).join(' · ')}`);
  const p = [...b1.char.pos]; const why = O.give('move', R.floor(AISLE), 'blue'); R.step(60 * 3);
  verdict(why === null && (NB.state === 'stacking' || NB.state === 'set') && O.has(b1) && O.has(b2) && !O.has(r1) && dist(b1.char.pos, p) > 1, 'an order to blue meanwhile is taken, and does not call the breach off', `give → ${why} · state ${NB.state} · Blue One moved ${f2(dist(b1.char.pos, p))} m · ${O.summary()}`);
  R.until(() => NB.state === 'set', 25); const set = NB.state; R.input.pressed.add('KeyF'); R.step();
  R.until(() => NB.state === 'clear' || NB.state === 'failed', 40); R.step(60);
  verdict(set === 'set' && (NB.state === 'clear' || NB.state === 'failed') && O.has(b1) && R.fratricide.length === 0, 'the breach runs to its end with blue still on its own order; no teammate shot by a teammate', `set: ${set} · ended ${NB.state} · ${NB.summary()} · friendly fire: ${R.fratricide.join(', ') || 'none'}`);
  return done();
});

// ---------------------------------------------------------------- budget
export const foursquadBudget = guarded(async () => {
  const { verdict, done } = family('foursquad-budget: ten men against eight proxy places, sixteen skinned, sixty-four lights');
  const R = await rig(3); const { game: g, NB } = R; const world = g.engine.world, L = g.engine.lights.lights;
  const steady = L.filter((l: any) => l.ttl < 0).length, lit = L.filter((l: any) => l.ttl < 0 && l.enabled && l.intensity > 0).length;
  const capOwners = () => { const out: number[] = []; for (let k = 0; k < world.charCount; k++) out.push(world.capsuleU32[k * BoxWorld.CAPS_PER_CHAR * 8 + 7] & 0xff); return out; };
  R.step(2); const before = capOwners(), order0 = [g.player.char.id, ...g.guards.map((x: any) => x.char.id)];
  verdict(1 + g.guards.length === 10 && SQUAD4_BUDGET === 10 && 10 <= MAX_CHARS && world.charCount === 8 && before.join() === order0.slice(0, 8).join(),
    `characters: 10 on the floor (Sam + 4 + 5) of ${MAX_CHARS} skinned; 8 have shadow / reflection proxies — with everybody up, Sam, the four and the first three defenders`, `proxy places: ${before.join(' ')} · on the floor: ${order0.join(' ')} · without: ${order0.slice(8).join(' ')}`);
  verdict(steady < MAX_LIGHTS && lit < MAX_LIGHTS, `lights: ${steady} steady lights of ${MAX_LIGHTS} by spawnUnit's own count (${MAX_LIGHTS - steady} spare), ${lit} of them lit and uploaded (${MAX_LIGHTS - lit} spare for flashes and tracers)`, `every man is booked a torch whether it burns or not`);
  // the probe's table (render/probe.ts MAX_QUERIES a frame, the rest dropped): what the game asks of it in a frame with everybody up
  { const P = g.probe as any, real = P.query, realS = P.querySegment; let n = 0; const keys: string[] = [];
    P.query = (k: string, ...r: any[]) => { n++; keys.push(k); return real?.call(P, k, ...r); }; P.querySegment = (k: string, ...r: any[]) => { n++; keys.push(k); return realS?.call(P, k, ...r); };
    let worst = 0, lines = 0; for (let i = 0; i < 30; i++) { n = 0; keys.length = 0; R.step(); if (n > worst) { worst = n; lines = keys.filter(k => /^smoke\d/.test(k)).length; } }
    P.query = real; P.querySegment = realS;
    verdict(worst > 0 && worst <= MAX_QUERIES && lines === NB.hostiles.length, `the probe's ${MAX_QUERIES} queries a frame: ${worst} asked with all ten up (${MAX_QUERIES - worst} spare) — the smoke sight lines to Sam are asked for the ${lines} defenders only`, `fog of war off in this rig: its smoke lines (up to six more) queue last and are the first dropped`); }
  // a teammate down: his place goes to a man standing
  killGuard(g, NB.ops[1], [1, 0, 0], false, 'shot', 'player'); R.step(3); const after = capOwners(), dead = NB.ops[1].char.id;
  const up1 = [g.player.char.id, ...g.guards.filter((x: any) => x.state !== 'dead').map((x: any) => x.char.id)];
  verdict(world.charCount === 8 && !after.includes(dead) && after.join() === up1.slice(0, 8).join() && up1.length === 9,
    'a man down gives up his proxy place: the eight go to the living first (the ninth living man still goes without)', `proxy places now: ${after.join(' ')} · Red Two (${dead}) is down and not among them`);
  killGuard(g, NB.hostiles[0], [1, 0, 0], false, 'shot', 'player'); R.step(3); const after2 = capOwners(), living = [g.player.char.id, ...g.guards.filter((x: any) => x.state !== 'dead').map((x: any) => x.char.id)];
  verdict(living.length === 8 && living.every(id => after2.includes(id)), 'two down: every man standing has his proxies; only the bodies go without', `living ${living.join(' ')} · proxy places ${after2.join(' ')}`);
  // an eleventh man is refused, by the caller's own budget; a caller with none still gets the eight
  let e1 = '', e2 = '';
  try { spawnUnit(g, { team: 'hostile', pos: [15, 0, 17.6], budget: SQUAD4_BUDGET }); } catch (e) { e1 = (e as Error).message; }
  try { spawnUnit(g, { team: 'hostile', pos: [15, 0, 17.6] }); } catch (e) { e2 = (e as Error).message; }
  verdict(/budget is 10/.test(e1) && /shadow-capsule budget is 8/.test(e2) && 1 + g.guards.length === 10, 'an eleventh character is refused (the four-man squad\'s budget is ten); a spawn with no budget of its own is still held to eight', `"${e1.slice(0, 90)}…" · "${e2.slice(0, 90)}…"`);
  verdict(SQUAD4.length === 4 && SQUAD4.map((m: any) => m.pair).join() === 'red,red,blue,blue', 'the roster is data: SQUAD4', SQUAD4.map((m: any) => `${m.name} (${m.pair})`).join(' · '));
  return done();
});
