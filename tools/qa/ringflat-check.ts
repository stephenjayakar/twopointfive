// THE SQUAD'S RING IS TWO RINGS DEEP AND NOTHING RIDES THE CURSOR (src/game/cmdring.ts CMDRING.flat / plainHint / bareHint; orders.ts flatRows, seats, hintView). The maintainer, 10-23, at a wall with three rings between him and one greyed row: "radial menu tree needs
// some work, way too nested"; "loud and quiet should be an option on squad wheel"; "let's remove the icons on mouse position from squad orders
// entirely". (The squad's corner cut down to its key lines is the page's own layer's, not the order book's: no line here.)
//   bun run tools/qa/ringflat-check.ts            (also `probes.ts ringflat`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/ringflat-check.ts      — the same lines on the page's stand
// PASS / FAIL each, headless: the room clear on the office with its squad of four under god mode, ONE deal (seed 3: the rules have no die in them). The
// check raises the ring, `only`, the squad's posture rows and the three switches itself, so both stands ask the same lines.
//   1. the floor's ring: what a tap gives, cover, fall in, hold, 'more' — and 'more' is one ring of the throws with the posture row last; given there,
//      the squad's posture turns.
//   2. a door's ring: the two entries are on the first ring where 'fall in' and 'hold position' were; the rest of its tools are the one ring behind
//      'more', the posture row last; a wedge of the first ring gives its entry.
//   3. on every kind of thing here (floor, wall, the doors, the breaker, a man, nothing): the menu never turns a page, every order of the thing is on a
//      wedge of the first ring or of 'more' (none lost, none twice), and no second ring has one row.
//   4. the squad's own ring (on a man, on nothing): fall in on 1, hold position on 4, the posture row on 5 — no words drawn twice, and digit 3 is
//      still fall in.
//   5. stacked on a door, wedge 1 is the squad's own entry and the row with the same words is not drawn again.
//   6. not offered at all: a charge and the big slot's tool on a steel door, a wall charge the squad never carried — and one carried is on 'more',
//      and is given from it.
//   7. CONTROL — a tutorial mission (rails live) keeps the menu's pages: its lines name the digits of the tree as it was. One whose level takes the
//      flat ring (rails.ts Rails.flatRing) has the flat tree.
//   7b. flatSeats by itself: more rows than wedges (the posture row gives up its place first), one row left over (it sits on the last wedge, no
//      second ring), gaps in the fixed wedges filled, the word's row never seated.
//   9. the squad's cursor mark is not drawn at all (bareHint; the maintainer, at a wall with the ring up: "the line and circle are weird, don't need
//      them"): at rest and under an open ring. 9b, CONTROL: that switch off and plainHint on, the outline with no glyph.
//  10. CONTROL — the switches off: the floor's fifth wedge opens a page, the mark has its glyph.
//  11. CONTROL (plumbing) — a recording from before the keys replays with all three off; one made with them on replays on, off off.
//  12. CONTROL (the stands) — the frozen stand holds all three off, the page's has them on, FROZEN_HOLDS carries their rows.
// RINGFLAT_BREAK=1 = the three switches left off and the same lines asked: 1 to 6 and 9 must fail (7, 7b, 10, 11 and 12 say what holds without them).
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const { CMDRING, FLAT_LEFT, flatSeats } = await import(`${ROOT}/src/game/cmdring.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`);
const SIL: any = await import(`${ROOT}/src/game/silent.ts`);
const DT_: any = await import(`${ROOT}/src/game/doortools.ts`), ST: any = await import(`${ROOT}/src/game/squadthrow.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const BREAK = process.env.RINGFLAT_BREAK === '1', DT = 1 / 60, HOLD_SECS = 0.2;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export async function ringflatCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const knobs0 = knobsCopy(), rnd0 = Math.random, squad0 = NIGHTBREACH.squad, K = CMDRING;
  try {
    Object.assign(NIGHTBREACH, { squad: 4 }); Math.random = seeded(3);
    const W: any = await standUp(), stood = { flat: !!K.flat, plainHint: !!K.plainHint, bareHint: !!K.bareHint };   // (what this stand stood the three up as: line 12)
    const raise = (on: boolean) => { K.flat = on; K.plainHint = on; K.bareHint = on; };
    HANDRING.on = false; K.on = true; K.only = true; K.hint = false; K.hands = false; K.plan = false; K.planRts = false; K.planRun = false; K.stay = false; K.tapNow = false; K.pin = false; K.holdSecs = HOLD_SECS; AUTOPILOT.on = true; SIL.SILENT.on = true; DT_.DOORTOOLS.outsidePlain = true; ST.SQUADTHROW.on = true;   // (the rows the page's ring has on both stands: the squad's posture, one 'clear from outside', the throws)
    raise(!BREAK);
    const g = W.game, O = g.orders, input = W.input, KEY = K.key; g.godMode = true; g.roomClear.start(3);
    const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
    step(30); for (const m of O.squad()) m.god = true;
    const sam = g.player.char.pos, HOLD = Math.ceil(K.tapSecs * 60) + 1;
    const away = () => { input.keys.delete(KEY); O.cmdRing = null; O.close(); step(2); };
    /** the ring put up on a target, the key kept down (the ring's own way up: the hold) */
    const up = (t: any) => { away(); const ok = (O as any).ringUp(t, input, O.view.canvas, g.time - K.tapSecs, O.view.cam); input.keys.add(KEY); step(HOLD); return ok && !!O.cmdRing; };
    const press = (d: number) => { input.pressed.add(`Digit${d}`); step(); };
    const give = () => { input.keys.delete(KEY); step(); };
    const view = () => O.ringView(), texts = () => (view()?.wedges ?? []).map((w: any) => `${w.key}:${w.text}${w.off ? ' (off)' : ''}`);
    const ids = () => { const M = O.menu; return M ? M.rows.map((d: any) => d.id) : []; };
    const tail = () => O.log[O.log.length - 1];
    // targets
    let floor: any = null, wall: any = null;
    for (let gy = 100; gy <= 900 && !(floor && wall); gy += 50) for (let gx = 100; gx <= 1500 && !(floor && wall); gx += 50) { input.mouseX = gx; input.mouseY = gy; step(1); const h = O.hover();
      if (h?.kind === 'floor' && !h.thing) { if (h.wall) wall ??= h; else if (dist(h.at, sam) > 2 && dist(h.at, sam) < 9) floor ??= h; } }
    const doors = [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, sam) - dist(b.frameCentre, sam)), tgt = (d: any) => O.targetAt([d.frameCentre[0], 0, d.frameCentre[2]]);
    const shut = doors.find((d: any) => !d.locked && !d.def.steel && Math.abs(d.angle) < 0.05 && tgt(d).kind === 'door'), steel = doors.find((d: any) => d.def.steel && tgt(d).kind === 'door'), open = doors.find((d: any) => Math.abs(d.angle) > 0.6 && tgt(d).kind === 'door');
    const thing = g.work?.things?.()[0], man = O.squad()[0];
    const none = { kind: 'none', at: [sam[0], 0, sam[2]] }, onMan = { kind: 'none', at: [sam[0], 0, sam[2]], man };
    const posture = () => SIL.squadSilent(g);

    // ---- 1
    { const ok0 = !!floor && up(floor), first = texts(); press(5); const second = texts(), page = O.menu?.page, more = !!O.cmdRing?.more;
      // (a throw's wedge lit on the second ring: its arc is drawn, as it was on the throw page — squadthrow.ts squadThrowPlans)
      const fw = (view()?.wedges ?? []).find((w: any) => /^frag there/.test(w.text)); let arc = 'no frag row'; if (fw) { press(fw.key); arc = fw.off ? 'row off' : ST.squadThrowPlans(g).some((p: any) => p.preview) ? 'drawn' : 'NOT DRAWN'; }
      const last = second[second.length - 1] ?? '', was = posture(); const k = (view()?.wedges ?? []).find((w: any) => /^go (silent|loud)$/.test(w.text))?.key ?? 0; if (k) press(k); give(); step(5); const now = posture(); if (now !== was) { O.give(now ? 'loud' : 'silent', none, 'all'); step(3); }
      line(ok0 && first.length === 5 && /^1:move there/.test(first[0]) && /^2:cover that way/.test(first[1]) && first[2] === '3:fall in' && first[3] === '4:hold position' && first[4] === '5:more' && more && page === null && second.length >= 2 && second.some((x: string) => /frag there/.test(x)) && second.some((x: string) => /bang there/.test(x)) && /go silent$/.test(last) && now !== was && arc !== 'NOT DRAWN',
        'the floor\'s ring: a tap\'s order, cover, fall in, hold, more — and more is ONE ring of the throws with the posture row last, which turns the squad\'s posture', `first ${first.join(' | ') || 'no ring'} · wedge 5: more ${more}, page ${page} · second ${second.join(' | ')} · a frag's wedge lit, its arc: ${arc} · silent ${was} → ${now}`); }
    // ---- 2
    { const T = shut ? tgt(shut) : null, ok0 = !!T && up(T), first = texts(), has = ids(); press(5); const second = texts(), page = O.menu?.page; away();
      const n0 = O.log.length; let gave = '';
      if (T && up(T)) { press(3); give(); step(3); gave = O.log.length > n0 ? tail().order : ''; }
      O.give('fallIn', none, 'all'); for (let i = 0; i < 60 * 30 && g.doorTools.ops.length; i++) step(); step(60);
      line(ok0 && /^1:stack up/.test(first[0] ?? '') && /^2:cover this door/.test(first[1] ?? '') && /^3:open and clear/.test(first[2] ?? '') && /^4:bang and clear/.test(first[3] ?? '') && first[4] === '5:more' && !first.some((x: string) => /fall in|hold position/.test(x)) && page === null && second.length >= 2 && second.length <= K.wedges && /go silent$/.test(second[second.length - 1] ?? '') && !second.some((x: string) => /fall in|hold position|more/.test(x)) && gave === 'openClear',
        'a door\'s ring: its two entries are on the first ring, the rest of its tools one ring behind \'more\' with the posture row last, and wedge 3 gives its entry', `door ${shut?.def.name} · first ${first.join(' | ') || 'no ring'} · second ${second.join(' | ')} · page ${page} · rows ${has.length} · wedge 3 gave '${gave}'`); }
    // ---- 3
    { const T: [string, any][] = [['floor', floor], ['wall', wall], ['shut door', shut && tgt(shut)], ['open door', open && tgt(open)], ['steel door', steel && tgt(steel)], ['thing', thing && { kind: 'floor', at: thing.stand ?? [thing.face[0], 0, thing.face[2]], thing }], ['a man', onMan], ['nothing', none]];
      const out: string[] = []; let ok = true, seen = 0;
      for (const [name, t] of T) { if (!t) { out.push(`${name}: none here`); continue; } seen++;
        if (!up(t)) { ok = false; out.push(`${name}: NO RING`); continue; }
        const M = O.menu, s = (O as any).seats(M, null), rows = M.rows, left = FLAT_LEFT[t.kind] ?? [];
        const owed = rows.map((_: any, i: number) => i).filter((i: number) => rows[i].hotKey !== ORDERS.waitAlt && !left.includes(rows[i].id));
        const on = [...new Set([s.row[1], ...s.row.slice(2)].filter((i: number) => i >= 0)), ...s.over],   // (what a tap gives is wedge 1's and may have a wedge of its own too: 'fall in' on 3)
        lost = owed.filter((i: number) => !on.includes(i)), twice = s.row.slice(2).filter((i: number) => i >= 0).length !== new Set(s.row.slice(2).filter((i: number) => i >= 0)).size || s.over.some((i: number) => s.row.includes(i)), opens = rows.some((d: any) => !!d.opens);
        const first = texts().length; let second = 0, page: any = null; if (s.more) { press(s.more); second = texts().length; page = O.menu?.page; }
        const good = !!M.flat && !lost.length && !twice && !opens && page === null && second !== 1 && first <= K.wedges && second <= K.wedges && (s.more ? s.over.length === second : true);
        if (!good) ok = false; out.push(`${name}: ${first}${s.more ? ` + ${second}` : ''}${lost.length ? ` LOST ${lost.map((i: number) => rows[i].id)}` : ''}${twice ? ' TWICE' : ''}${opens ? ' A PAGE ROW' : ''}${M.flat ? '' : ' NOT FLAT'}`); away(); }
      line(ok && seen >= 5, 'on every kind of thing here the menu never turns a page, every order is on a wedge of the first ring or of \'more\', and no second ring has one row', out.join(' · ')); }
    // ---- 4
    { const a = up(onMan) ? texts() : [], b = up(none) ? texts() : []; const n0 = O.log.length; press(3); give(); step(3); const three = O.log.length > n0 ? tail().order : ''; away();
      const good = (x: string[]) => x.length === 3 && x[0] === '1:fall in' && x[1] === '4:hold position' && /^5:go (silent|loud)$/.test(x[2]);
      line(good(a) && good(b) && three === 'fallIn', 'the squad\'s own ring (on a man, on nothing): fall in, hold position on 4, the posture row on 5 — no words twice, and 3 is still fall in', `on a man: ${a.join(' | ')} · on nothing: ${b.join(' | ')} · digit 3 gave '${three}'`); }
    // ---- 5
    { const T = shut ? tgt(shut) : null; let first: string[] = [], quick = '', hidden = false, stacked = false;
      if (T) { O.give('stack', T, 'all'); for (let i = 0; i < 60 * 30 && !stacked; i++) { step(); stacked = O.squad().every((m: any) => O.of(m)?.order === 'stack' && O.of(m)?.arrived); }
        if (up(T)) { first = texts(); quick = view()?.wedges[0]?.text ?? ''; const M = O.menu, s = (O as any).seats(M, null); hidden = s.same.some((i: number) => i >= 0 && O.labelOf(M.rows[i], M.target) === quick) && !s.row.slice(2).some((i: number) => i >= 0 && O.labelOf(M.rows[i], M.target) === quick); } away(); }
      const twice = first.filter((x: string) => x.slice(2) === quick).length;
      line(stacked && /and clear/.test(quick) && twice === 1 && hidden, 'stacked on a door, wedge 1 is the squad\'s own entry and the row with the same words has no wedge of its own (its digit is wedge 1\'s)', `stacked ${stacked} · ${first.join(' | ')}`);
      O.give('fallIn', none, 'all'); for (let i = 0; i < 60 * 20 && g.doorTools.ops.length; i++) step(); step(60); }
    // ---- 6
    { const S = steel ? tgt(steel) : null, a = S && up(S) ? ids() : null; away();
      const WC = g.wallCharge, b = wall && up(wall) ? ids() : null; away();
      let c: string[] = [], gave = '', where = '';
      if (WC && wall) { const was = WC.carried; WC.setCarried(1); step(2); if (up(wall)) { c = ids(); const M = O.menu, s = (O as any).seats(M, null), i = M.rows.findIndex((d: any) => d.id === 'wallCharge'), n = s.over.indexOf(i);
          where = n >= 0 ? `more ${n + 1}` : s.row.indexOf(i) > 0 ? `wedge ${s.row.indexOf(i)}` : 'nowhere';
          if (n >= 0) { const n0 = O.log.length; press(s.more); press(n + 1); give(); step(3); gave = O.log.length > n0 ? tail().order : (g.wallCharge.ops.length ? 'wallCharge' : ''); } } away(); O.give('fallIn', none, 'all'); step(30); WC.setCarried(was); step(2); }
      const steelOk = !steel || (!!a && !a.includes('charge') && !a.includes('bigClear') && a.includes('openClear'));
      const wallOk = !wall || !WC || (!!b && !b.includes('wallCharge') && c.includes('wallCharge') && where.startsWith('more'));
      line(steelOk && wallOk && (!!steel || !!wall), 'not offered at all: a charge and the big slot\'s tool on a steel door, a wall charge never carried — and one carried is on \'more\'', `steel door ${steel?.def.name ?? 'none here'}: ${a ? a.join(',') : '-'} · wall, none carried: ${b ? b.join(',') : '-'} · one carried: ${where}${gave ? `, given: ${gave}` : ''}`); }
    // ---- 7
    { const rails0 = g.rails; K.flat = true;
      g.rails = { live: true }; const taught = (O as any).flatRing();
      g.rails = { live: true, flatRing: true }; const took = (O as any).flatRing();
      g.rails = { live: false }; const plain = (O as any).flatRing();
      g.rails = rails0; const here = (O as any).flatRing(); K.only = false; const noOnly = (O as any).flatRing(); K.only = true; K.flat = !BREAK;
      line(taught === false && took === true && plain === true && here === true && noOnly === false, 'CONTROL — a tutorial mission keeps the menu\'s pages (its lines teach them) unless its level takes the flat ring; any other level takes the flat tree, and only while the ring carries every order', `on a tutorial mission: ${taught} · on one whose level takes the flat ring: ${took} · off one: ${plain} · this level: ${here} · the ring not carrying every order: ${noOnly}`); }
    // ---- 7b (the seating by itself: what no kit on this floor shows)
    { const R = (id: string, o: any = {}) => ({ id, targets: ['floor'], ...o }), post = R('silent', { free: true, targets: ['floor', 'none'] }), base = [R('move'), R('cover'), R('fallIn'), R('hold')];
      const five = flatSeats([...base, R('a'), R('b'), R('c'), R('d'), R('e'), post], 'floor', 'KeyF', 0), names5 = five.over.length;
      const one = flatSeats([...base, post], 'floor', 'KeyF', 0);
      const gap = flatSeats([R('move'), R('fallIn'), R('a'), R('b'), R('c'), post], 'floor', 'KeyF', 0);
      const word = flatSeats([...base, R('go', { hotKey: 'KeyF' })], 'floor', 'KeyF', 0);
      line(five.more === 5 && names5 === 5 && !five.over.includes(9) && one.more === 0 && one.row[5] === 4 && gap.row[2] === 2 && gap.row[4] === 3 && gap.more === 5 && gap.over.join() === '4,5' && word.more === 0 && word.row[5] === -1,
        'the seating by itself: five tools and the posture row — the posture row gives up its place and no tool is lost; one row left over is on wedge 5, not a ring; empty wedges are filled before \'more\'; the word\'s row has no wedge', `five tools + posture: more on ${five.more}, ${names5} rows, posture ${five.over.includes(9) ? 'ON IT' : 'not on it'} · one left over: wedge 5 row ${one.row[5]}, more ${one.more} · two wedges empty: ${gap.row.slice(1).join()} + more ${gap.over.join()} · the word's row: wedge ${word.row.indexOf(4)}`); }
    // ---- 9
    { const say = (H: any) => H ? `${H.kind}, glyph ${H.glyph}, outline ${H.ring && H.seg ? 'a line and a circle' : H.ring ? 'a circle on the spot' : H.seg ? 'a line' : 'none'}` : 'nothing';
      const hint0 = K.hint; K.hint = true; W.cursorAt([floor.at[0], 0.04, floor.at[2]]); step(3); const idle = O.hintView(); K.hint = hint0;   // (the cursor at rest, the mark asked for)
      const ok0 = up(floor), H = O.hintView(); away();
      line(ok0 && H === null && idle === null, 'the squad\'s cursor mark is not drawn at all: no glyph, no line, no circle — at rest or under an open ring', `at rest: ${say(idle)} · the ring up: ${say(H)}`);
      // 9b. the outline alone, as plainHint left it (bareHint off): still its own switch
      if (!BREAK) { K.bareHint = false; const ok1 = up(floor), P = O.hintView(); away(); K.bareHint = true;
        line(ok1 && !!P && P.glyph === false && !!P.ring, 'CONTROL — the outline\'s switch off, the glyph\'s on: the outline on the floor and no glyph, as that switch was built', `hint ${say(P)}`); } }
    // ---- 10
    { raise(false); const ok0 = up(floor), first = texts(); press(5); const page = O.menu?.page, H = O.hintView(); away();
      raise(!BREAK);
      line(ok0 && page !== null && page !== undefined && H?.glyph === true, 'CONTROL — the switches off: the floor\'s fifth wedge opens a page, the mark has its glyph', `first ${first.join(' | ')} · wedge 5: page '${page}' · glyph ${H?.glyph}`); }
    // ---- 11
    { const J: any = await import(`${ROOT}/src/game/journal.ts`), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g))), keys = ['flat', 'plainHint', 'bareHint'] as const, now = () => keys.map(k => K[k]).join();
      raise(true); const old = snap(); for (const k of keys) if (old.tables.CMDRING) delete old.tables.CMDRING[k]; J.applyKnobs(g, old); const before = now();
      raise(true); const on = snap(); raise(false); J.applyKnobs(g, on); const kept = now();
      raise(false); const offS = snap(); raise(true); J.applyKnobs(g, offS); const keptOff = now(); raise(!BREAK);
      line(before === 'false,false,false' && kept === 'true,true,true' && keptOff === 'false,false,false', 'CONTROL (plumbing: no break word touches it) — a recording from before the keys replays with all three off; one made with them on replays on, off off', `from before the keys: ${before} · recorded on: ${kept} · recorded off: ${keptOff}`); }
    // ---- 12
    { const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`), E = process.env, shipped = E.TPS_PROFILE === 'shipped';
      const want = { flat: shipped ? E.TPS_RINGFLAT !== '0' && E.TPS_QONLY !== '0' && E.TPS_QRING !== '0' : E.TPS_RINGFLAT === '1' && E.TPS_QONLY === '1' && E.TPS_QRING === '1', plainHint: shipped ? E.TPS_PLAINHINT !== '0' : E.TPS_PLAINHINT === '1', bareHint: shipped ? E.TPS_BAREHINT !== '0' : E.TPS_BAREHINT === '1' };
      const rows = ['flat', 'plainHint', 'bareHint'].map(k => FROZEN_HOLDS[`CMDRING.${k}`] ?? '');
      line(stood.flat === want.flat && stood.plainHint === want.plainHint && stood.bareHint === want.bareHint && /TPS_RINGFLAT=1/.test(rows[0]) && /TPS_PLAINHINT=1/.test(rows[1]) && /TPS_BAREHINT=1/.test(rows[2]),
        `CONTROL (the stands) — this stand (${shipped ? 'the page\'s' : 'frozen'}) stands the three up as its words say, and FROZEN_HOLDS carries their rows`, `stood ${JSON.stringify(stood)} · by its words ${JSON.stringify(want)} · rows: ${rows.map(r => `'${r}'`).join(' ')}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; Object.assign(NIGHTBREACH, { squad: squad0 }); }
  console.log(fails ? `ringflat-check: ${fails} FAIL` : 'ringflat-check: ALL PASS');
  return fails === 0;
}

if (import.meta.main) process.exit((await ringflatCheck()) ? 0 : 1);
