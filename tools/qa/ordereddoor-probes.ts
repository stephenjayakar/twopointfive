// The 'ordereddoor' family: the WAY a teammate walks to where an order sends him (src/game/cleared.ts; the maintainer, 10-08, playing the warehouse with the four:
// "sometimes they will (1) not all go through the door when clearing (they'll route to the room through a different door) and then (2) even worse they'll
// go through uncleared rooms to get there!").
//   bun run tools/qa/probes.ts ordereddoor | ordereddoor-face | ordereddoor-feet | ordereddoor-late | ordereddoor-round
// All headless (headless.ts's Game under the office room clear's staging, the four): the server room taken and the four standing in it, its corridor door and
// its SIDE door to the manager's office standing open (as doors do after a fight), the manager's office held (its man kept blind: this is about feet), Sam in
// the corridor at the manager's door. Nothing here looks at a picture.
//   ordereddoor-face    the cause and the rule: with the switches off the squad's stack on the manager's corridor door is dealt the face INSIDE the manager's
//                       office (the men's shortest walk: through the side door); now it is the corridor face; with both faces known the walks decide again
//   ordereddoor-feet    'stack up' and 'bang and clear' on that door, as it was and now: which doorways each man walked through. Now: nobody through the side
//                       door, every man sent in crossed the ordered door; as it was: men through the side door (the fault, kept reproducible behind the switches)
//   ordereddoor-late    a man who is not at the door when the entry sends him to his point (the entry's own assign call, from the server room): now he walks
//                       to the ordered door's mouth and in by it; ORDERS.ownDoor off: in by the side door
//   ordereddoor-round   a walk whose short way cuts through a room nobody has been in — a move order and fall in from the corridor / the server room across the
//                       manager's office: now round by the corridor; once somebody of the team has stood in the office, the short way again; and a mark with
//                       no way round (inside the office itself) is still walked to. And THE WAY ROUND ONLY WHEN IT IS WORTH IT (ORDERS.roundCap; the owner's
//                       tape, the floodlit yard 033934 at 1:56.6): the yard staged as the tape had it — front, hall and back doors open, the store door shut,
//                       no room stood in, the men in the yard by Sam — and a wall charge ordered on the radio room's east wall: with the rule off the men's
//                       ways run round the outside of the building, by the back door and through the store nobody has been in; with it on they walk the
//                       short way by the front door and no man goes by the back or the store door; with the store known the way round is refused for its
//                       length alone; and on the office the corridor way (fair, by known floor) is still the way. ROUNDCAP_BREAK=1 = the rule left off
//                       where those lines want it on: they must fail. Both stands: the lines write the knob themselves. And THE CAP SPARES A PAIR'S WAY ROUND TO
//                       ITS OWN DOOR (ORDERS.roundOwn; ROUNDOWN_BREAK=1 = the key left off, must fail on both stands). And THE FILE'S FURTHER BACK ENDS
//                       WITH THE FLOOR (ORDERS.backEnd): Sam in the corridor by the manager's open door with no trail, three of the four put by him and
//                       the last in the corridor's far end, 8 m off in plain sight — key off, he is 'near enough already' and stands there, arrived, for
//                       as long as Sam stands (the further back off the doorway was counted in full though it moved no place: his file distance read
//                       11.8 m); key on, he walks in and every man is within 6 m, nobody moving; and no man's PLACE differs by the key. Staged the same
//                       on either stand: the order given with the men in the server room, the men then put in the corridor, the manager's leaf held
//                       open (the frozen stand's men shoulder it shut); the page's stand also walks into the fault by itself, the fall in from the
//                       server room above. BACKEND_BREAK=1 = the key left off in this probe's runs: must fail on both stands.
import { standUp, ROOT } from './headless.ts';
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS, ROUND_CAP, ROUND_PLUS_M, ROUND_LESS } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { crossesDoor } = await import(`${ROOT}/src/game/guards.ts`);

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const wayLen = (from: number[], q: number[][]) => { let m = 0, a = from; for (const b of q) { m += dist(a, b); a = b; } return m; };
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const DT_DEFAULTS = JSON.parse(JSON.stringify(DOORTOOLS)), RC_DEFAULTS = { ...ROOMCLEAR }, NB_DEFAULTS = { ...NIGHTBREACH }, ORD_DEFAULTS = { ...ORDERS, followBack: [...ORDERS.followBack] };
const restore = () => { Object.assign(DOORTOOLS, JSON.parse(JSON.stringify(DT_DEFAULTS))); Object.assign(ROOMCLEAR, RC_DEFAULTS); Object.assign(NIGHTBREACH, NB_DEFAULTS); Object.assign(ORDERS, ORD_DEFAULTS, { followBack: [...ORD_DEFAULTS.followBack] }); };
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } finally { restore(); } };
const offOf = (d: any, p: number[]) => { const th = d.def.closedDir; return Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0]); };
const inB = (B: any, p: number[], pad = 0) => p[0] > B.x0 - pad && p[0] < B.x1 + pad && p[2] > B.z0 - pad && p[2] < B.z1 + pad;
const WAS = { cleared: false, knownFace: false, ownDoor: false };   // the three switches off: the build as it was
// Sam in the corridor at the manager's door, the four in the server room's aisle · the four in the corridor beside him · a point inside the manager's office
const SERVER: number[][] = [[24.0, 0, 11.2], [18.6, 0, 8.6], [17.8, 0, 8.2], [17.8, 0, 9.0], [17.0, 0, 8.6]];
const INSIDE: number[] = [25.4, 0, 7.4];

/** the office room clear with the four, the server room taken, its corridor door and the side door standing open; the manager's man blind (feet, not the fight) */
async function rig(seed: number, o: { open?: string[]; spots?: number[][] } = {}) {
  Object.assign(NIGHTBREACH, { squad: 4 });
  Math.random = seeded(seed);
  const W: any = await standUp(); const game = W.game; const RC = game.roomClear, NB = game.nightBreach, O = game.orders, D = game.doorTools;
  game.godMode = true;
  const why = RC.start(seed);
  const R = { W, game, RC, NB, O, D, why, C: game.cleared, walked: new Map<any, string[]>(), inOffice: new Map<any, number>(),
    get up(): any[] { return NB.ops.filter((m: any) => m.state !== 'dead'); },
    room(id: string) { return RC.rooms.find((r: any) => r.def.id === id); },
    door(name: string): any { return game.doors.byName(name); },
    /** a leaf stood open and kept open (unlocked, its closer off) */
    open(name: string) { const d = R.door(name); d.locked = false; d.latched = false; d.angle = 1.45; d.vel = 0; d.closing = false; d.quietT = -3600; d.place(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05;
      for (const h of R.room('manager').defenders) if (h.state !== 'dead') h.dazzledUntil = game.time + 5;
      const was = R.up.map((m: any) => [m, [m.char.pos[0], 0, m.char.pos[2]]] as const); W.step(DT);
      for (const [m, p] of was) { if (dist(p as any, m.char.pos) > 1.5) continue;
        for (const d of game.doors.list) if (crossesDoor(p, m.char.pos, d)) { const l = R.walked.get(m) ?? []; l.push(d.def.name); R.walked.set(m, l); }
        if (inB(R.room('manager').def.bounds, m.char.pos, -0.1)) R.inOffice.set(m, (R.inOffice.get(m) ?? 0) + 1); } } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    place(P: number[][]) { game.teleportPlayer(P[0]); R.up.forEach((m: any, i: number) => { const p = P[1 + i]; m.char.pos[0] = p[0]; m.char.pos[2] = p[2]; }); R.step(30); R.walked.clear(); R.inOffice.clear(); },
    give(id: string, name: string, who: any = 'all'): string | null { return O.give(id, O.targetAt(R.door(name).frameCentre), who); },
    ways(): string { return R.up.map((m: any) => `${m.callsign}: ${(R.walked.get(m) ?? []).join(' → ') || 'no door'}`).join(' · '); },
    through(name: string): any[] { return R.up.filter((m: any) => (R.walked.get(m) ?? []).includes(name)); },
  };
  R.step(30);
  for (const h of R.room('server').defenders) if (h.state !== 'dead') killGuard(game, h, [0, 0, 1], true, 'struck');
  for (const n of o.open ?? ['server', 'server_manager']) R.open(n);
  R.place(o.spots ?? SERVER);
  return R;
}

// ---------------------------------------------------------------- the face
export const ordereddoorFace = guarded(async () => {
  const { verdict, done } = family('ordereddoor-face: the squad of four stacks on the face of an ordered door whose floor the team knows');
  const R = await rig(1); const { O, C } = R; const d = R.door('manager'), men = R.up, sam = R.game.player.char.pos, samSide: 1 | -1 = offOf(d, sam) >= 0 ? 1 : -1;
  const office = C.roomBy(d, -samSide as 1 | -1), corridor = C.roomBy(d, samSide);
  verdict(office > 0 && office === C.roomAt(INSIDE) && !C.isKnown(office) && C.isKnown(corridor) && C.isKnown(C.roomAt(men[0].char.pos)), 'the staging: the corridor (Sam) and the server room (the four) are known ground, the manager\'s office is not',
    `${C.summary()} · office room ${office} known ${C.isKnown(office)} · corridor ${corridor} known ${C.isKnown(corridor)}`);
  Object.assign(ORDERS, WAS); const was = O.sideFor(d, men, samSide); restore();
  verdict(was === -samSide, 'THE CAUSE (switches off): the stack on the manager\'s corridor door is dealt the face INSIDE the manager\'s office — the four\'s shortest walk is through the open side door', `Sam's face ${samSide} · dealt ${was}`);
  const now = O.sideFor(d, men, samSide);
  verdict(now === samSide, 'now: the corridor face (the one whose floor is known), whatever the walks come to', `dealt ${now} · ${C.summary()}`);
  ORDERS.knownFace = false; const priced = O.sideFor(d, men, samSide); restore();
  verdict(priced === samSide, 'ORDERS.knownFace off, ORDERS.cleared on: the walks alone come to the same face — a walk through the office is priced as all but barred', `dealt ${priced}`);
  C.mark(INSIDE); const both = O.sideFor(d, men, samSide);
  verdict(both === was, 'once one of the team has stood in the office both faces are known ground and the walks decide, as they always did', `dealt ${both} (as it was: ${was})`);
  return done();
});

// ---------------------------------------------------------------- feet
export const ordereddoorFeet = guarded(async () => {
  const { verdict, done } = family('ordereddoor-feet: stack up / bang and clear on the manager\'s corridor door, the four coming from the server room');
  const rows: string[] = []; const got: Record<string, any> = {}; let threw = '';
  for (const id of ['stack', 'bangClear']) for (const mode of ['was', 'now'] as const) {
    try {
      restore(); if (mode === 'was') Object.assign(ORDERS, WAS);
      const R = await rig(2); const { O, D } = R; const d = R.door('manager'), n = R.up.length;
      // (the manager's door is locked, and on the SHIPPED stand the lead TRIES a door nobody knew was locked and the order ends there, 'found shut' — DOORTOOLS.testDoor,
      // a FROZEN_HOLDS row, held by doortest-check.ts. These lines are about which door the feet go through, so the entry plays on as it did; `restore` puts the knob back.
      // And 'as it was' is the build before DOORTOOLS.behindSam too — another row of that list: with the switches off the door is worked from the office's side, the can
      // would go out into the corridor Sam stands in, and that rule refuses the row in words, 'you are behind that door.', so THE FAULT's line has no walk to count.)
      DOORTOOLS.testDoor = false; if (mode === 'was') DOORTOOLS.behindSam = false;
      const why = R.give(id, 'manager'); R.step(2); const op = D.ops.find((o: any) => o.door === d) ?? null;
      if (id === 'stack') { R.until(() => R.up.every((m: any) => O.of(m)?.arrived), 30); R.step(60); } else { R.until(() => !D.ops.includes(op), 80); R.step(120); }
      const side = R.through('server_manager'), own = R.through('manager'), sent = op ? [...op.pod.keys()].filter((m: any) => m.state !== 'dead') : [], office = R.up.filter((m: any) => (R.inOffice.get(m) ?? 0) > 0);
      const outside = R.up.filter((m: any) => offOf(d, m.char.pos) * offOf(d, SERVER[0]) > 0).length;
      got[`${id}/${mode}`] = { why, side: side.length, own: own.length, sent: sent.length, sentOwn: sent.filter((m: any) => own.includes(m)).length, office: office.length, outside, n, ended: op?.ended ?? null, arrived: R.up.every((m: any) => O.of(m)?.arrived) };
      rows.push(`${id}, ${mode === 'was' ? 'as it was' : 'now'}: give → ${why}${op ? ` · ended '${op.ended}' · sent in ${sent.length}` : ''} · through the side door ${side.length} · through the ordered door ${own.length} · set foot in the office ${office.length} · ${R.ways()}`);
    } catch (e) { threw = `${id}/${mode}: ${e instanceof Error ? e.stack : e}`; }
  }
  restore();
  verdict(!threw, 'nothing threw', threw || '4 runs');
  const sw = got['stack/was'], sn = got['stack/now'], bw = got['bangClear/was'], bn = got['bangClear/now'];
  verdict(!!sw && sw.side > 0 && sw.office > 0, 'THE FAULT (switches off), stack up: the men walk through the side door into the office nobody has cleared and stack inside it', rows[0] ?? '—');
  verdict(!!sn && sn.why === null && sn.side === 0 && sn.office === 0 && sn.outside === sn.n && sn.arrived, 'now, stack up: every man on his mark in the corridor; nobody through the side door, nobody in the office', rows[1] ?? '—');
  verdict(!!bw && bw.side > 0, 'THE FAULT (switches off), bang and clear: men reach the room by the side door, not the door ordered', rows[2] ?? '—');
  verdict(!!bn && bn.why === null && bn.side === 0 && bn.ended === 'in' && bn.sent >= 3 && bn.sentOwn === bn.sent, 'now, bang and clear: the entry ends \'in\', every man it sent went in through the ordered door, nobody through the side door', rows[3] ?? '—');
  return done();
});

// ---------------------------------------------------------------- a man not at the door
export const ordereddoorLate = guarded(async () => {
  const { verdict, done } = family('ordereddoor-late: a man who is not at the ordered door when the entry sends him to his point');
  const rows: string[] = []; const got: any = {};
  for (const mode of ['off', 'on'] as const) {
    restore(); if (mode === 'off') ORDERS.ownDoor = false;
    const R = await rig(3, { open: ['server', 'server_manager', 'manager'] }); const { O, C } = R; const d = R.door('manager'), m = R.up[0];   // (the ordered door's leaf open, as the entry has it when it sends a man to his point)
    const r = O.route(m, INSIDE, null, d), mouth = r.via.length ? r.via[r.via.length - 1] : null;
    // the entry's own call (doortools.ts, phase 'enter'): his point of domination, by the ordered door
    O.assign(m, { order: 'openClear', door: d, shy: null, thru: d, post: INSIDE, face: 0, watch: null, pace: O.knobs.entry, stance: 'none', upper: 'aim', search: false, going: 'entering', there: 'holding the room' });
    const there = R.until(() => dist(m.char.pos, INSIDE) < 0.8, 40), way = R.walked.get(m) ?? [];
    got[mode] = { how: r.how, via: r.via.length, mouth, way, there, stats: { ...C.stats } };
    rows.push(`ORDERS.ownDoor ${mode}: route → ${r.how ?? 'the short way'}, ${r.via.length} corners${mouth ? `, the last ${at(mouth)}` : ''} · walked ${way.join(' → ') || 'no door'} · at his point ${there}`);
  }
  restore();
  verdict(got.off.way[0] === 'server_manager' && !got.off.way.includes('manager'), 'ORDERS.ownDoor off (as it was): from the server room his point in the office is a walk through the side door', rows[0]);
  verdict(got.on.how === 'mouth' && got.on.there && got.on.way.includes('manager') && !got.on.way.includes('server_manager') && got.on.way[got.on.way.length - 1] === 'manager' && got.on.stats.mouth === 1,
    'now: he is walked out to the corridor, to the mouth of the ordered door, and in through it — never through the side door', rows[1]);
  // the ordered door still locked against the team (no entry sends a man at one; a retake could): never walked at the lock
  { const R = await rig(3); const d = R.door('manager'), r = R.O.route(R.up[0], INSIDE, null, d);
    verdict(r.how !== 'mouth', 'the ordered door locked and latched: he is not walked to its mouth (the way an order always found, instead)', `route → ${r.how ?? 'the short way'}, ${r.via.length} corners, why ${r.why}`); }
  // a man who IS at the door: the short way, no corners (the stack's entry is untouched)
  { const R = await rig(3, { open: ['server', 'server_manager', 'manager'], spots: [[24.0, 0, 11.4], [25.0, 0, 10.8], [26.4, 0, 10.8], [24.2, 0, 10.9], [27.0, 0, 11.0]] }); const d = R.door('manager'), r = R.O.route(R.up[0], INSIDE, null, d);
    verdict(!r.how && r.via.length === 0 && r.why === null, 'a man at the ordered door (its leaf open, as the entry has it): his short way crosses it — nothing is changed for him', `route → ${r.how ?? 'the short way'}, ${r.via.length} corners`); }
  return done();
});

// ---------------------------------------------------------------- round an uncleared room
export const ordereddoorRound = guarded(async () => {
  const { verdict, done } = family('ordereddoor-round: a walk whose short way cuts through a room nobody of the team has been in');
  const ALL = ['server', 'server_manager', 'manager'], CORR: number[][] = [[27.5, 0, 11.4], [25.4, 0, 11.0], [26.2, 0, 11.4], [24.8, 0, 11.6], [26.8, 0, 11.0]], MARK: number[] = [19.0, 0, 8.6];
  const rows: string[] = []; const got: any = {};
  // a move order from the corridor at the manager's door to a spot in the (known) server room by the side door: the short way is across the manager's office
  for (const mode of ['was', 'now', 'known'] as const) {
    restore(); if (mode === 'was') Object.assign(ORDERS, WAS);
    const R = await rig(4, { open: ALL, spots: CORR }); const { O, C } = R; const m = R.up[0];
    C.mark(MARK); if (mode === 'known') C.mark(INSIDE);
    const r = O.route(m, MARK), why = O.give('move', { kind: 'floor', at: MARK }, 'all');
    const there = R.until(() => R.up.every((x: any) => O.of(x)?.arrived), 40), way = R.up.flatMap((x: any) => R.walked.get(x) ?? []), office = R.up.filter((x: any) => (R.inOffice.get(x) ?? 0) > 0).length;
    got[mode] = { how: r.how, via: r.via.length, way, there, office, why };
    rows.push(`move, ${mode === 'was' ? 'as it was' : mode === 'now' ? 'now' : 'now, the office known'}: one man's route → ${r.how ?? 'the short way'} (${r.via.length} corners) · give → ${why} · set foot in the office ${office} of ${R.up.length} · all there ${there} · ${R.ways()}`);
  }
  restore();
  verdict(got.was.office > 0 && got.was.way.includes('manager'), 'THE FAULT (switches off): the walk to a spot in the server room cuts through the manager\'s office nobody has cleared', rows[0]);
  verdict(got.now.how === 'round' && got.now.there && got.now.office === 0 && !got.now.way.includes('manager') && !got.now.way.includes('server_manager'), 'now: round by the corridor and the server room\'s own door — never a foot in the office', rows[1]);
  verdict(!got.known.how && got.known.via === 0 && got.known.office > 0, 'once one of the team has stood in the office it is known ground: the short way through it again', rows[2]);
  // fall in from the server room, Sam in the corridor east of the manager's door: the short way to the file is across the office
  const END_BREAK = process.env.BACKEND_BREAK === '1'; if (END_BREAK) console.log('  (BACKEND_BREAK: ORDERS.backEnd is left off in this probe\'s runs — the fall in from the server room on the page\'s stand, and the staged far man on both, must fail)');
  for (const mode of ['was', 'now'] as const) {
    restore(); if (mode === 'was') Object.assign(ORDERS, WAS);
    const R = await rig(5, { open: ALL, spots: [[27.5, 0, 11.4], [20.8, 0, 8.4], [20.2, 0, 7.6], [20.2, 0, 9.0], [19.6, 0, 8.4]] }); const { O } = R;
    if (END_BREAK) ORDERS.backEnd = false;   // (after the stand-up, which raises it on the page's stand)
    const why = O.give('fallIn', O.targetAt(R.game.player.char.pos), 'all'); R.step(60 * 14);
    const office = R.up.filter((m: any) => (R.inOffice.get(m) ?? 0) > 0).length, near = R.up.filter((m: any) => dist(m.char.pos, R.game.player.char.pos) < 6).length;
    got[`fall/${mode}`] = { office, near, n: R.up.length };
    rows.push(`fall in, ${mode === 'was' ? 'as it was' : 'now'}: give → ${why} · set foot in the office ${office} of ${R.up.length} · with Sam after 14 s ${near} (${R.up.map((m: any) => `${m.callsign} ${dist(m.char.pos, R.game.player.char.pos).toFixed(1)} m${O.of(m)?.arrived ? '' : ', still walking'}`).join(' · ')}) · ${R.ways()}`);
  }
  restore();
  verdict(got['fall/was'].office > 0, 'THE FAULT (switches off): falling in from the server room, men cut through the manager\'s office', rows[3]);
  verdict(got['fall/now'].office === 0 && got['fall/now'].near === got['fall/now'].n, 'now: the four fall in round by the corridor, and are with Sam', rows[4]);
  // no way round: a mark inside the uncleared room itself is still walked to (the order is the order)
  { const R = await rig(6, { open: ALL, spots: CORR }); const { O } = R; const m = R.up[1], r = O.route(m, INSIDE), why = O.give('move', { kind: 'floor', at: INSIDE }, 'all'); const there = R.until(() => R.up.every((x: any) => O.of(x)?.arrived), 30);
    verdict(r.why === null && why === null && there, 'a mark inside the uncleared room itself: taken and walked to — an order is never refused for it', `route why ${r.why} · give → ${why} · all there ${there} · ${R.ways()}`); }
  // ---- THE WAY ROUND ONLY WHEN IT IS WORTH IT (ORDERS.roundCap). ROUNDCAP_BREAK=1: the rule left off where a line wants it on
  const BREAK = process.env.ROUNDCAP_BREAK === '1', CAP = BREAK ? 0 : ROUND_CAP; if (BREAK) console.log('  (ROUNDCAP_BREAK: ORDERS.roundCap is left at 0 under the lines that want it on — they must fail)');
  // the office again with the rule on: the corridor way is by known floor and of fair length — still the way
  { restore(); const R = await rig(4, { open: ALL, spots: CORR }); const { O, C } = R; const m = R.up[0]; C.mark(MARK); ORDERS.roundCap = ROUND_CAP;   // (after the stand-up: the frozen stand pins it at 0. A CONTROL under ROUNDCAP_BREAK: this way is taken with the rule off too)
    const from = [...m.char.pos], plain = wayLen(from, R.game.col.nav.findPath(from, MARK) ?? []), r = O.route(m, MARK), round = wayLen(from, [...r.via, MARK]), why = O.give('move', { kind: 'floor', at: MARK }, 'all');
    const there = R.until(() => R.up.every((x: any) => O.of(x)?.arrived), 40), office = R.up.filter((x: any) => (R.inOffice.get(x) ?? 0) > 0).length;
    verdict(r.how === 'round' && why === null && there && office === 0, `ORDERS.roundCap ${ROUND_CAP}: a way round by floor the team knows, of fair length, is still taken — the corridor, never a foot in the office`, `one man's route → ${r.how ?? 'the short way'}: ${round.toFixed(1)} m for a short way of ${plain.toFixed(1)} m (the rule allows ${(plain * ROUND_CAP + ROUND_PLUS_M).toFixed(1)} m) · give → ${why} · set foot in the office ${office} of ${R.up.length} · all there ${there} · ${R.ways()}`); }
  // the floodlit yard as the owner's tape had it at 1:56.6
  { const WP: any = await import('./wallcharge-probes.ts'), WC: any = await import(`${ROOT}/src/game/wallcharge.ts`);
    const SAM = [23.78, 0, 13.81], MEN = [[21.39, 0, 13.61], [20.10, 0, 14.17], [18.37, 0, 14.16], [22.6, 0, 14.9]], WALL = [27.5, 1.05, 10.21], OPEN: Record<string, number> = { front: -1.77, guard_room: -1.51, radio_room: -1.48, back: -1.09 };
    const yard = async (cap: number, walk: boolean, storeKnown = false) => {
      restore(); const R = await WP.rig('floodlit-four', 5); const g = R.game, O = R.O, C = g.cleared, nav = g.col.nav; Object.assign(ORDERS, { cleared: true, clearedDear: 20, roundCap: cap });
      for (const h of R.hostiles) R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]);   // (feet, not the fight: nobody of the other side on the level's floor)
      for (const [n, a] of Object.entries(OPEN)) { const d = g.doors.byName(n); d.locked = false; d.latched = false; d.angle = a; d.vel = 0; d.closing = false; d.quietT = -3600; d.place(); }
      { const d = g.doors.byName('store'); d.locked = false; d.latched = true; d.angle = 0; d.vel = 0; d.place(); }
      g.teleportPlayer(SAM); R.up.forEach((m: any, i: number) => R.put(m, MEN[i])); O.give('hold', O.targetAt(g.player.char.pos), 'all'); R.step(20);
      C.reset(); R.step(20); if (storeKnown) C.mark([29.5, 0, 8.5]);   // (a clear from outside: nobody has stood in a room — what the team knows is where it stands now, the yard)
      const rooms = { hall: C.roomAt([20.5, 0, 11.0]), radio: C.roomAt([25.0, 0, 10.2]), store: C.roomAt([29.5, 0, 8.5]) }, known = Object.entries(rooms).filter(([, r]) => C.isKnown(r)).map(([n]) => n);
      const why = O.give(WC.WALL_ORDER, O.targetAt(WALL), 'all'); R.step(1);
      const men = R.up.filter((m: any) => O.of(m)?.post).map((m: any) => { const from = [...m.char.pos], to = [...O.of(m).post], pl = nav.findPath(from, to), r = O.route(m, to);
        return { m, from, to, plain: pl ? wayLen(from, pl) : Infinity, how: r.how, via: r.via.length, way: r.via.length || !pl ? wayLen(from, [...r.via, to]) : wayLen(from, pl), walked: 0, last: from, doors: [] as string[], there: false }; });
      if (walk) for (let f = 0; f < 60 * 45 && !men.every((x: any) => x.there); f++) { R.step();
        for (const x of men) { const p = x.m.char.pos, d = dist(x.last, p); if (d > 1.5) { x.last = [...p]; continue; }
          for (const dr of g.doors.list) if (crossesDoor(x.last, p, dr) && !x.doors.includes(dr.def.name)) x.doors.push(dr.def.name);
          if (!x.there) x.walked += d; x.last = [...p]; if (dist(p, x.to) < 0.6 || O.of(x.m)?.arrived) x.there = true; } }
      const words = `order → ${why ?? 'taken'} · of the hall, the radio room and the store the team knows: ${known.join(', ') || 'none'} · ` + (men.map((x: any) => `${x.m.callsign} ${at(x.from)} → ${at(x.to)}: short way ${x.plain.toFixed(1)} m, route → ${x.how ?? 'the short way'}${x.via ? ` by ${x.via} corners` : ' (the short way)'} ${x.way.toFixed(1)} m${walk ? `, walked ${x.walked.toFixed(1)} m by ${x.doors.join(' → ') || 'no door'}${x.there ? '' : ' (NOT THERE)'}` : ''}`).join(' · ') || 'no man was given a mark');
      WP.restoreKnobs(); return { men, known, why, words }; };
    const was = await yard(0, false);
    verdict(was.men.length >= 3 && was.known.length === 0 && was.men.every((x: any) => x.how === 'through' && x.way > x.plain * ROUND_CAP + ROUND_PLUS_M), 'THE FAULT (ORDERS.roundCap 0, the yard as the tape had it): every man\'s way to the wall runs round the outside of the building — more than the rule would allow, and through a room nobody has been in at that', was.words);
    const now = await yard(CAP, true);
    verdict(now.men.length >= 3 && now.men.every((x: any) => x.there && x.walked < x.plain * ROUND_CAP + ROUND_PLUS_M && !x.doors.includes('back') && !x.doors.includes('store') && x.doors.includes('front')), `ORDERS.roundCap ${CAP}: the men walk the short way — in by the front door, each under ${ROUND_CAP} × his short way + ${ROUND_PLUS_M} m, nobody by the back door or the store door`, now.words);
    const long = await yard(CAP, false, true);
    verdict(long.known.join() === 'store' && long.men.length >= 3 && long.men.every((x: any) => x.how === 'through' && x.via === 0), 'the store known (so the way round crosses no unknown floor): it is refused for its length alone — the short way', long.words); }
  // a way round that still crosses unknown floor: taken when that is clearly less of it than the short way's (ROUND_LESS), refused when it is not. The office
  // again, the corridor way's unknown floor given by the probe (ClearedRooms.dearAlong answers a share of the short way's for every way but the short one).
  { const ask = async (share: number) => { restore(); const R = await rig(4, { open: ALL, spots: CORR }); const { O, C } = R; const m = R.up[0]; C.mark(MARK); ORDERS.roundCap = CAP;   // (after the stand-up: the frozen stand pins it at 0)
      const real = C.dearAlong.bind(C); let first: any = null, offM = 0, left = 0;
      C.dearAlong = (from: any, path: any, unk: any) => { const v = real(from, path, unk); if (!first) { first = path; offM = v; return v; } if (path === first) return v; return left = Math.max(v, offM * share); };
      let r: any; try { r = O.route(m, MARK); } finally { C.dearAlong = real; }
      return { via: r.via.length as number, how: r.how as string | undefined, offM, left }; };
    const less = await ask(0.3), most = await ask(0.8); restore();
    const row = (x: { via: number; how?: string; offM: number; left: number }) => `the short way crosses ${x.offM.toFixed(1)} m of unknown floor, the way round ${x.left.toFixed(1)} m → ${x.via ? `the way round (${x.via} corners)` : 'the short way'}`;
    verdict(less.offM > 1 && less.via > 0 && most.via === 0 && less.left > 0.3 && most.left < most.offM - 0.3, `ORDERS.roundCap ${CAP}: a way round of fair length that still crosses unknown floor is taken when that is at most ${ROUND_LESS} of the short way's, and refused — the short way — when it is not`,
      `${row(less)} · ${row(most)}`); }
  // the switch's carriage: the key rides with a recording's flags, and in its ORDERS table where the recording carries one
  { restore(); const R = await rig(4, { open: ALL, spots: CORR }), g = R.game, J: any = await import(`${ROOT}/src/game/journal.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), KN: any = await import(`${ROOT}/src/game/knobs.ts`), all = KN.knobsCopy();   // (applyKnobs writes every table a recording lacks back to 'as it was': the whole registry is put back after)
    try {
      ORDERS.roundCap = ROUND_CAP; const old = snap(); delete old.flags.roundCap; if (old.tables.ORDERS) delete old.tables.ORDERS.roundCap; J.applyKnobs(g, old); const before = ORDERS.roundCap;   // (a file from before the key has it in neither place: a recording carries the ORDERS table as well as the flag now)
      ORDERS.roundCap = ROUND_CAP; const tab = snap(); delete tab.flags.roundCap; ORDERS.roundCap = 0; J.applyKnobs(g, tab); const byTable = ORDERS.roundCap, inTables = 'ORDERS' in tab.tables;   // (…and one that holds the key in its table alone replays its table's number)
      ORDERS.roundCap = ROUND_CAP; const recOn = snap(); ORDERS.roundCap = 0; J.applyKnobs(g, recOn); const kept = ORDERS.roundCap;
      ORDERS.roundCap = 0; const recOff = snap(); ORDERS.roundCap = ROUND_CAP; J.applyKnobs(g, recOff); const keptOff = ORDERS.roundCap;
      verdict(before === 0 && kept === ROUND_CAP && keptOff === 0 && recOn.flags.roundCap === ROUND_CAP && byTable === (inTables ? ROUND_CAP : 0), 'CONTROL (plumbing, not the rule: ROUNDCAP_BREAK does not touch it) — a recording from before the key replays with ORDERS.roundCap 0; one made with it on replays at its number, one made at 0 at 0',
        `a recording without the key: ${before} · recorded at ${ROUND_CAP}: ${kept} · recorded at 0: ${keptOff} · in the recording's flags: ${recOn.flags.roundCap} · ORDERS in its tables: ${inTables}, and with the key there alone: ${byTable}`);
    } finally { KN.knobsBack(all); restore(); } }
  // ---- THE FILE'S FURTHER BACK ENDS WITH THE FLOOR (ORDERS.backEnd), staged the same on either stand: Sam at the manager's open door with no trail, three by him, the last man 8 m down the corridor in plain sight
  { const FROM: number[][] = [[27.5, 0, 11.4], [20.8, 0, 8.4], [20.2, 0, 7.6], [20.2, 0, 9.0], [19.6, 0, 8.4]], FAR: number[][] = [[24.7, 0, 10.9], [24.0, 0, 10.5], [23.2, 0, 10.6], [19.5, 0, 11.4]];   // (the order is given with the men in the server room, as above — 'behind Sam' is the side his men are on when his trail is seeded: into the manager's door — and then the men are PUT in the corridor)
    const stage = async (on: boolean) => { restore(); const R = await rig(5, { open: ALL, spots: FROM }); const { O } = R, sam = R.game.player.char.pos; ORDERS.backEnd = on;   // (after the stand-up: the frozen stand pins it off, the page's raises it)
      const held = (n: number) => { for (let i = 0; i < n; i++) { R.open('manager'); R.step(); } };   // (the manager's leaf HELD open: the frozen stand's men walk to the place in its frame and shoulder the leaf shut, and with it shut there is no frame to stand off)
      const why = O.give('fallIn', O.targetAt(sam), 'all'); R.step(2); R.up.forEach((m: any, i: number) => { m.char.pos[0] = FAR[i][0]; m.char.pos[2] = FAR[i][2]; }); R.walked.clear(); R.inOffice.clear(); held(60 * 2);
      // every man's place, and his file distance, with the key off and on at this very frame (clearBack keeps a frame's answers: asked afresh each way, and left asked afresh for the run's own word)
      const ask = (key: boolean) => { ORDERS.backEnd = key; O.clearT = -1; return R.up.map((m: any) => { const A = O.of(m); if (!A || A.post !== null) return null; const back = O.backOf(A.follow) + O.clearBack(A.follow); return { back, q: O.slot(back) as number[] }; }); };
      const a = ask(false), b = ask(true); ORDERS.backEnd = on; O.clearT = -1;
      const moved = Math.max(0, ...a.map((x: any, i: number) => x && b[i] ? dist(x.q, b[i]!.q) : 99)), backs = (l: any[]) => l.map(x => x ? x.back.toFixed(1) : '-').join(' / ');
      held(60 * 11); const was = R.up.map((m: any) => [m.char.pos[0], 0, m.char.pos[2]]); held(60);
      const men = R.up.map((m: any, i: number) => ({ name: m.callsign, d: dist(m.char.pos, sam), arrived: !!O.of(m)?.arrived, walked: dist(was[i], m.char.pos) }));
      return { why, n: men.length, far: men.filter((m: any) => m.d >= 6 && m.arrived).length, near: men.filter((m: any) => m.d < 6).length, arrived: men.every((m: any) => m.arrived), movers: men.filter((m: any) => m.walked > 0.05).length, moved, shorter: a.some((x: any, i: number) => x && b[i] && b[i]!.back < x.back - 0.25),
        say: `give → ${why} · after 14 s ${men.map((m: any) => `${m.name} ${m.d.toFixed(1)} m${m.arrived ? '' : ', still walking'}`).join(' · ')} · file distances key off ${backs(a)} m, key on ${backs(b)} m · a place differs by the key by at most ${moved.toFixed(3)} m` }; };
    const off = await stage(false), on = await stage(!END_BREAK);
    verdict(off.n === 4 && off.far >= 1, 'THE FAULT (ORDERS.backEnd off), staged: a man 8 m down the corridor in plain sight is \'near enough already\' — marked arrived, more than 6 m from Sam', off.say);
    verdict(on.n === 4 && on.near === on.n && on.arrived && on.movers === 0, 'ORDERS.backEnd: a further back that moves no place is not counted — the far man walks in, every man within 6 m of Sam, arrived, nobody moving', `${on.movers} moving · ${on.say}`);
    verdict(off.moved < 0.01 && on.moved < 0.01 && off.shorter && on.shorter, 'CONTROL (BACKEND_BREAK does not touch it): the key moves no man\'s place — only the file distance the near band is sized from is shorter', `key-off run: places differ by ${off.moved.toFixed(3)} m · key-on run: ${on.moved.toFixed(3)} m`);
    // the journal: a recording from before the key replays with it off (journal.ts applyKnobs); one that carries it keeps its own word
    restore(); const R = await rig(4, { open: ALL, spots: CORR }), g = R.game, J: any = await import(`${ROOT}/src/game/journal.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), KN: any = await import(`${ROOT}/src/game/knobs.ts`), all = KN.knobsCopy();
    try {
      ORDERS.backEnd = true; const old = snap(); if (old.tables.ORDERS) delete old.tables.ORDERS.backEnd; delete old.flags.backEnd; J.applyKnobs(g, old); const x = ORDERS.backEnd;
      ORDERS.backEnd = true; const yes = snap(); ORDERS.backEnd = false; J.applyKnobs(g, yes); const y = ORDERS.backEnd;
      ORDERS.backEnd = false; const no = snap(); ORDERS.backEnd = true; J.applyKnobs(g, no); const z = ORDERS.backEnd;
      verdict(x === false && y === true && z === false, 'CONTROL (plumbing: BACKEND_BREAK does not touch it) — the journal: a recording from before ORDERS.backEnd replays with it off, one made with it on replays on, one made with it off replays off', `old → ${x} · recorded on → ${y} · recorded off → ${z}`);
    } finally { KN.knobsBack(all); restore(); } }
  // ---- … AND THE CAP SPARES A PAIR'S WAY ROUND TO ITS OWN DOOR (ORDERS.roundOwn; a claim from the bodies-and-doors goal's own staging): the office,
  // the pair far inside, Sam outside the fire exit, 'open and clear' on it. The cap refused the pair its way round by the outside (floor nobody had been on) and
  // the short way ran through the fire exit itself: a man pulled it open and walked through it to stack on it. ROUNDOWN_BREAK=1 = the key left off: must fail
  { restore(); const OWN = process.env.ROUNDOWN_BREAK !== '1'; if (!OWN) console.log('  (ROUNDOWN_BREAK: ORDERS.roundOwn is left off under the line that wants it on — it must fail)');
    const { rig: dtRig } = await import('./doortools-probes.ts'), { despawnUnit } = await import(`${ROOT}/src/game/guards.ts`), { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
    const run = async (cap: number, own: boolean) => {
      restore(); const R: any = await dtRig(1, { stage: 'rc' }), g = R.game; for (const h of [...g.guards]) if (h.team === 'hostile') despawnUnit(g, h); R.step(10);
      Object.assign(ORDERS, { roundCap: cap, roundOwn: own });   // (after the stand-up: the frozen stand pins the cap at 0)
      const d = R.door('fire_exit'), c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), H = d.def.hinge, W = d.def.width;
      const off = (s: number, o: number): number[] => [H[0] + ux * W * 0.5 - uz * o * s, 0, H[1] + uz * W * 0.5 + ux * o * s];
      const pf = [1, -1].find(s => g.doors.pullFace(d, off(s, 0.8)))!, sam = off(-pf, 2.6); d.locked = false; g.teleportPlayer(sam); R.step(10);
      const ops = R.ops.filter((x: any) => x.state !== 'dead'), side = sideOf(d, sam), behind = ops.filter((m: any) => sideOf(d, m.char.pos) !== side).length;
      const op = R.D.order('openClear', ops, d, side, null, false); if (typeof op === 'string') return { refused: op as string, behind, opened: -1, over: -1, big: !!g.orders.big };
      let opened = -1; for (let i = 0; i < 60 * 30 && opened < 0; i++) { R.step(1); if (Math.abs(d.angle) > 0.02) opened = i; }
      return { refused: '', behind, opened, over: ops.filter((m: any) => sideOf(d, m.char.pos) === side).length, big: !!g.orders.big };   // (`over`: the men on Sam's side of it the moment its leaf first moves)
    };
    const was = await run(0, true), cut = await run(ROUND_CAP, false), now = await run(ROUND_CAP, OWN); restore();
    const row = (x: { refused: string; behind: number; opened: number; over: number }) => x.refused ? `refused '${x.refused}'` : `${x.behind} behind it · its leaf first moves at frame ${x.opened} with ${x.over} of them on Sam's side`;
    verdict([was, cut, now].every(x => !x.big && x.behind === 2 && x.opened >= 0) && was.over === 2 && cut.over === 0 && now.over === 2,
      `ORDERS.roundOwn: a pair behind the door it is to stack on goes round to it and the door is first opened with both men on Sam's side — with no cap (as it was), and with the cap ${ROUND_CAP}; THE FAULT (the cap, the key off): a man pulls it open from behind it to walk through`,
      `no cap: ${row(was)} · cap, key off: ${row(cut)} · cap, key ${OWN ? 'on' : 'OFF (the break)'}: ${row(now)}`);
    const J: any = await import(`${ROOT}/src/game/journal.ts`), R2 = await rig(4, { open: ALL, spots: CORR }), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R2.game)));
    ORDERS.roundOwn = true; const old = snap(); if (old.tables.ORDERS) delete old.tables.ORDERS.roundOwn; J.applyKnobs(R2.game, old); const before = ORDERS.roundOwn;
    ORDERS.roundOwn = true; const rec = snap(); ORDERS.roundOwn = false; J.applyKnobs(R2.game, rec); const kept = ORDERS.roundOwn, carried = rec.tables.ORDERS?.roundOwn === true;
    ORDERS.roundOwn = false; const recOff = snap(); ORDERS.roundOwn = true; J.applyKnobs(R2.game, recOff); const keptOff = ORDERS.roundOwn; restore();
    verdict(before === false && carried && kept === true && keptOff === false, 'CONTROL (plumbing): a recording from before the key replays with it off; one made with it on carries it and replays on, one made with it off replays off',
      `no key → ${before} · recorded on → ${kept} (carried: ${carried}) · recorded off → ${keptOff}`); }
  return done();
});
