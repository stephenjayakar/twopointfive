// THE ORDERS RING ON THE SQUAD'S COMMAND KEY, AS THE PAGE HAS IT (src/game/cmdring.ts: CMDRING.on, `stay`, `tapNow`; src/game/planmode.ts: CMDRING.plan,
// `planRun`) — the maintainer, 10-22: "longer press for Q opens up squad, doesn't require holding it", "shift Q for plan mode". The key through the game's
// own input, headless.
//   bun run tools/qa/qring-check.ts              (also `probes.ts qring`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/qring-check.ts        — the same lines on the page's stand
// PASS / FAIL each: the room clear on the office with its squad of four, everybody under god mode (the lines are about what is ORDERED, not who wins).
//   (1) the stand: each switch as the stand says (held off frozen, on as the page opens), and FROZEN_HOLDS carries the rows and their words;
// … then the check raises the switches itself (the frozen stand holds them off) and asks:
//   (2) a tap is the quick order and no ring; a press already up in its own tick is given on that tick;
//   (3) the key kept down: no ring at the old hold, the ring at the plainer one; the key up in the middle leaves it up, nobody told anything;
//   (4) left up, a digit gives its wedge at once and is not Sam's weapon slot;
//   (5) left up, a left click gives the lit wedge and is not Sam's trigger;
//   (6) left up, the cursor out to a wedge and the key again gives that wedge;
//   (7) left up, a right click puts it away and nothing is ordered; on a page it steps back first; a click with nothing lit gives nothing;
//   (7b) the back key puts a ring left up away, and takes plan mode down;
//   (7c) the page's Esc (Game.escape) takes plan mode down;
//   (8) kept down, the cursor out to a wedge and the key let go gives that wedge (the ring as it was built);
//   (9) `stay` off: the key up in the middle gives the lit wedge, as it was built;
//   (10) Shift + the key puts plan mode up and takes it down; out of a sprint (a walk key down) it is the key's own order; the mode up, it is left whatever is down;
//   (11) a recording from before the keys replays with them off; the page's flags.
// QRING_BREAK=1 = `stay`, `tapNow` and `planRun` left off and the same lines asked: the lines that say what those rules do must fail.
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const { CMDRING, CMDRING_STATS, ringHoldSecs } = await import(`${ROOT}/src/game/cmdring.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const { BACKKEY } = await import(`${ROOT}/src/game/backkey.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);

const DT = 1 / 60, BREAK = process.env.QRING_BREAK === '1';
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const frames = (s: number) => Math.ceil(s * 60);

/** the room clear with its four; `set` writes the ring's switches after the stand-up (absent: the stand's own are left as they stood) */
async function rig(set?: () => void) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try { Object.assign(NIGHTBREACH, { squad: 4 }); Math.random = seeded(5); W = await standUp(); set?.(); AUTOPILOT.on = true; W.game.godMode = true; why = W.game.roomClear.start(5); }
  finally { Object.assign(NIGHTBREACH, { squad: squad0 }); }
  const g = W.game, O = g.orders, I = W.input, KEY = CMDRING.key;
  const R = { W, g, O, I, why: why ? String(why) : null as string | null,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    aim(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); R.step(2); return O.hover?.() ?? null; },
    aimOf(d: any): number[] | null { const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
      for (const y of [c[1], 0.05, 1.0, 1.8]) for (const k of [0, 0.35, -0.35]) { const p = [c[0] + nx * k, y, c[2] + nz * k]; const h = R.aim(p); if (h?.kind === 'door' && h.door === d) return p; } return null; },
    /** the key goes down and is kept down `secs` (the frame it goes down included) */
    down(secs: number) { I.keys.add(KEY); I.pressed.add(KEY); R.step(); R.step(Math.max(0, frames(secs) - 1)); },
    /** … and comes up: the frame it is read in */
    up() { I.keys.delete(KEY); R.step(); },
    /** a tap as a hand makes it: down for one frame, seen up on the next */
    tap() { I.keys.add(KEY); I.pressed.add(KEY); R.step(); R.up(); },
    press(code: string) { I.pressed.add(code); R.step(); },
    click(bit: number) { I.clicked |= bit; I.buttons |= bit; R.step(); I.buttons &= ~bit; R.step(); },
    /** the cursor `r` px out of the ring's middle toward wedge `k` (1 at the top, clockwise) */
    out(k: number, r = 80) { const C = O.cmdRing; if (!C) return; const a = (-90 + (k - 1) * 360 / CMDRING.wedges) * Math.PI / 180; I.mouseX = C.ax + Math.cos(a) * r; I.mouseY = C.ay + Math.sin(a) * r; R.step(); },
    mid() { const C = O.cmdRing; if (!C) return; I.mouseX = C.ax; I.mouseY = C.ay; R.step(); },
    /** the ring opened by the plain hold and left up: the key down past the hold, then up in the middle */
    open(p: number[]) { R.aim(p); R.down(ringHoldSecs() + 0.1); R.up(); R.step(5); return !!O.cmdRing; },
    tail() { return O.log[O.log.length - 1]; },
    rowOf(k: number) { return O.menu?.rows.find((r: any) => r.key === k); },
    home() { I.keys.clear(); I.buttons = 0; O.cmdRing = null; O.cmdPress = null; O.close(); if (O.plan.up) { I.keys.add('ShiftLeft'); I.pressed.add(KEY); R.step(); I.keys.clear(); } O.who = 'all'; O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); R.until(() => g.doorTools.ops.length === 0, 40); R.until(() => R.team.every((m: any) => dist(m.char.pos, g.player.char.pos) < 4.5), 25); R.step(30); },
  };
  R.step(30); for (const m of R.team) m.god = true;
  return R;
}
/** a spot of open floor a few metres from Sam the cursor on which is the floor */
function floorSpot(R: any): number[] | null {
  const s = R.g.player.char.pos;
  for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [2, 2], [-2, -2], [2, -2], [-2, 2]]) { const p = [s[0] + dx, 0.04, s[2] + dz]; const h = R.aim(p); if (h?.kind === 'floor' && !h.wall && !h.thing && R.team.every((m: any) => dist(m.char.pos, p) > 1.2)) return p; }
  return null;
}

export async function qringCheck(): Promise<boolean> {
  console.log(`\n=== qring: the squad's command key kept down is the orders ring, and it stays; Shift + the key is plan mode${BREAK ? ' — QRING_BREAK: stay, tapNow and planRun never on' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  const knobs0 = knobsCopy(), rnd0 = Math.random, ap0 = AUTOPILOT.on, C = CMDRING as any, S = CMDRING_STATS;
  const page = () => { C.on = true; C.hint = false; C.hands = false; C.stay = !BREAK; C.tapNow = !BREAK; C.plan = true; C.planRts = true; C.planRun = !BREAK; C.only = false; };
  try {
    // (1) the stand, read off the first stand-up before the check sets anything
    { await quiet(() => standUp({})); const shipped = process.env.TPS_PROFILE === 'shipped', E = process.env;
      const ring = E.TPS_QRING !== undefined ? E.TPS_QRING === '1' : shipped, stay = ring && (E.TPS_QSTAY !== undefined ? E.TPS_QSTAY === '1' : shipped), plan = ring && (E.TPS_QPLAN !== undefined ? E.TPS_QPLAN === '1' : shipped);
      const want: Record<string, boolean> = { on: ring, tapNow: ring, stay, plan, planRts: plan, planRun: plan }, stood = Object.keys(want).map(k => `${k} ${C[k]}`);
      const rows = Object.keys(want).every(k => typeof FROZEN_HOLDS[`CMDRING.${k}`] === 'string') && FROZEN_HOLDS['CMDRING.on'] === 'TPS_QRING=1' && FROZEN_HOLDS['CMDRING.stay'].includes('TPS_QSTAY=1') && FROZEN_HOLDS['CMDRING.plan'].includes('TPS_QPLAN=1');
      line(Object.keys(want).every(k => C[k] === want[k]) && C.hands === false && rows && PROFILE.STAND_ENV.includes('TPS_QRING') && PROFILE.STAND_ENV.includes('TPS_QSTAY') && PROFILE.STAND_ENV.includes('TPS_QPLAN'),
        `the stand: the ring, its staying up and plan mode ${shipped ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'} (Space's own ring off on both); FROZEN_HOLDS carries the rows and the words`,
        `after the stand-up: ${stood.join(' · ')} · hands ${C.hands} · TPS_QRING ${E.TPS_QRING ?? 'unset'}, TPS_QSTAY ${E.TPS_QSTAY ?? 'unset'}, TPS_QPLAN ${E.TPS_QPLAN ?? 'unset'} · TPS_PROFILE ${E.TPS_PROFILE ?? 'unset'} · rows ${rows ? 'all there' : 'MISSING'}`); }

    const R = await quiet(() => rig(page)), g = R.g, O = R.O, I = R.I, pl = g.player;
    if (R.why) { line(false, 'the room clear stands up', R.why); return false; }
    const spot = floorSpot(R);
    if (!spot) { line(false, 'a spot of open floor to point at', 'none round Sam'); return false; }
    const stackDef = O.defs.find((d: any) => d.id === 'stack'), men = () => O.men('all'); let D: any = null;
    for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, pl.char.pos) - dist(b.frameCentre, pl.char.pos))) { const t = O.targetAt(d.frameCentre); if (t.kind !== 'door' || t.door !== d) continue; if (!O.whyNot(stackDef, O.forMen(t, men()), men()) && R.aimOf(d)) { D = d; break; } }
    if (!D) { line(false, 'a door to open the ring on', 'none the cursor finds'); return false; }

    // (2) a tap; and a press already up in its own tick
    { R.aim(spot); const n0 = O.log.length, o0 = S.opened; R.tap(); const k = O.log.length - n0, row = R.tail(), ring = !!O.cmdRing || S.opened !== o0; R.step(30); R.home();
      R.aim(spot); const n1 = O.log.length; I.pressed.add(CMDRING.key); R.step(); const same = O.log.length - n1, row1 = R.tail(); R.step(1); const next = O.log.length - n1; R.step(30); R.home();
      line(k === 1 && row?.order === 'move' && !ring && same === 1 && row1?.order === 'move' && next === 1, 'a tap is the quick order and no ring; a press already up in its own tick is given on that tick',
        `a tap (down a frame, then up): +${k} ${row?.order}, a ring ${ring ? 'went up' : 'never up'} · pressed and not down: +${same} on its own tick (${row1?.order}), +${next} a tick on`); }

    // (3) the key kept down: the plainer hold, then the key up leaves the ring there
    { R.aim(spot); const n0 = O.log.length; R.down(CMDRING.holdSecs + 0.05); const early = !!O.cmdRing; R.step(frames(CMDRING.stayHoldSecs - CMDRING.holdSecs) + 2); const up = !!O.cmdRing, lit = O.cmdRing?.lit;
      R.up(); const left = !!O.cmdRing && !!O.menu, free = O.cmdRing?.free === true; R.step(60); const still = !!O.cmdRing, told = O.log.length - n0, V = O.ringView();
      line(!early && up && lit === 1 && left && free && still && told === 0 && !!V && V.wedges.every((x: any) => x.key >= 1 && x.key <= 5), 'the key kept down: no ring at the old hold, the ring at the plainer one; the key up in its middle leaves it up, and nobody has been told anything',
        `at ${(CMDRING.holdSecs + 0.05).toFixed(2)} s: ${early ? 'up' : 'not up'} · at ${(CMDRING.stayHoldSecs + 0.1).toFixed(2)} s: ${up ? 'up' : 'not up'}, lit ${lit} · the key up: ${left ? 'still up' : 'gone'}, free ${free} · a second on: ${still ? 'still up' : 'gone'} · order book +${told} · wedges ${(V?.wedges ?? []).map((x: any) => x.key).join('')}`);
      // (4) … a digit gives its wedge at once, and is not his weapon slot
      const r3 = R.rowOf(3), slot0 = pl.slot; R.press('Digit3'); const row = R.tail(), k = O.log.length - n0;
      line(!!r3 && k === 1 && row?.order === r3.id && !O.cmdRing && !O.menu && pl.slot === slot0, 'left up, a digit gives its wedge at once and the ring goes; the digit is not Sam\'s weapon slot', `wedge 3 is '${r3?.id}' · order book +${k} ${row?.order} · ring ${O.cmdRing ? 'up' : 'gone'} · slot ${slot0} → ${pl.slot}`);
      R.step(30); R.home(); }

    // (5) left up, a left click gives the lit wedge and is not his trigger
    { const open = R.open(spot), n0 = O.log.length, t0 = pl.lastFireT, f0 = S.fired; R.click(1); const row = R.tail(), k = O.log.length - n0, fired = pl.lastFireT !== t0 || S.fired !== f0;
      line(open && k === 1 && row?.order === 'move' && !O.cmdRing && !fired, 'left up, a left click gives the lit wedge and is not Sam\'s trigger', `ring left up ${open} · order book +${k} ${row?.order} · ring ${O.cmdRing ? 'up' : 'gone'} · he ${fired ? 'FIRED' : 'did not fire'}`);
      R.step(30); R.home(); }

    // (6) left up, the cursor out to a wedge lights it and the key again gives it
    { const open = R.open(spot), n0 = O.log.length, r2 = R.rowOf(2); R.out(2); const lit = O.cmdRing?.lit, mid = O.log.length - n0; R.step(20); const held = O.log.length - n0;
      I.keys.add(CMDRING.key); I.pressed.add(CMDRING.key); R.step(); const row = R.tail(), k = O.log.length - n0, gone = !O.cmdRing; R.step(frames(CMDRING.stayHoldSecs) + 6); const again = !!O.cmdRing; I.keys.delete(CMDRING.key); R.step(2);
      line(open && !!r2 && lit === 2 && mid === 0 && held === 0 && k === 1 && row?.order === r2.id && gone && !again, 'left up, the cursor out to a wedge lights it and gives nothing; the key again gives it, and that press kept down opens no second ring', `wedge 2 is '${r2?.id}' · lit ${lit} · order book while it stood +${held} · the key again: +${k} ${row?.order} · that key kept down: ${again ? 'A RING' : 'no ring'}`);
      R.step(30); R.home(); }

    // (7) left up, a right click puts it away; on a page it steps back first; a click with nothing lit gives nothing
    { const open = R.open(spot), n0 = O.log.length, c0 = S.cancelled; R.click(4); const gone = !O.cmdRing && !O.menu, told = O.log.length - n0, can = S.cancelled - c0; R.step(10);
      const p = R.aimOf(D); const open2 = !!p && R.open(p), toolsRow = O.menu?.rows.find((r: any) => r.opens), n1 = O.log.length;
      if (toolsRow) R.press(`Digit${toolsRow.key}`); const onPage = O.menu?.page ?? null, lit = O.cmdRing?.lit, t0 = pl.lastFireT; R.click(1); const dead = !!O.cmdRing && O.log.length === n1 && pl.lastFireT === t0;
      R.click(4); const back = !!O.cmdRing && (O.menu?.page ?? null) === null; R.click(4); const away = !O.cmdRing && !O.menu, told2 = O.log.length - n1;
      line(open && gone && told === 0 && can === 1 && open2 && !!toolsRow && onPage !== null && lit === 0 && dead && back && away && told2 === 0, 'left up, a right click puts it away and nothing is ordered; on a page it steps back first; a click with nothing lit gives nothing and he does not fire',
        `on the floor: ring ${gone ? 'gone' : 'up'}, order book +${told} · on the door: wedge ${toolsRow?.key} turns to '${onPage}', lit ${lit} · a left click there: ${dead ? 'nothing' : 'SOMETHING'} · a right click: ${back ? 'the first page' : 'not back'} · again: ${away ? 'gone' : 'up'}, order book +${told2}`);
      R.step(10); R.home(); }

    // (7b) the back key (Tab where Tab backs out, else Esc) puts the ring away, and takes plan mode down
    { const BK = BACKKEY.tab ? 'Tab' : 'Escape', open = R.open(spot), n0 = O.log.length, can = g.backable(); R.press(BK); const gone = !O.cmdRing && !O.menu, told = O.log.length - n0;
      I.keys.add('ShiftLeft'); I.keys.add(CMDRING.key); I.pressed.add(CMDRING.key); R.step(); I.keys.clear(); R.step(2); const up = O.plan.up, can2 = g.backable(); R.press(BK); const down = !O.plan.up, can3 = g.backable();
      line(open && can && gone && told === 0 && up && can2 === !BREAK && down === !BREAK && !can3 === !BREAK, 'the back key puts a ring left up away and orders nothing; with plan mode up it takes the mode down', `the back key here: ${BK} · ring left up ${open}, something to back out of ${can} · after it: ring ${gone ? 'gone' : 'up'}, order book +${told} · plan mode ${up ? 'up' : 'NOT up'}, to back out of ${can2} · after it: ${down ? 'down' : 'STILL up'}`);
      R.home(); }
    // (7c) … and the page's own Esc (Game.escape, the pause's key there) takes the mode down too, once: nothing is left for it to back out of after
    { I.keys.add('ShiftLeft'); I.keys.add(CMDRING.key); I.pressed.add(CMDRING.key); R.step(); I.keys.clear(); R.step(2); const up = O.plan.up, took = g.escape(), down = !O.plan.up; R.step(2); const again = g.escape();
      line(up && took === !BREAK && down === !BREAK && !again === !BREAK, "the page's Esc takes plan mode down, and has nothing more to back out of", `plan mode ${up ? 'up' : 'NOT up'} · Game.escape() ${took} · the mode ${down ? 'down' : 'still up'} · again: ${again}`);
      if (O.plan.up) { I.keys.add('ShiftLeft'); I.keys.add(CMDRING.key); I.pressed.add(CMDRING.key); R.step(); I.keys.clear(); R.step(2); }
      R.home(); }

    // (8) kept down, out to a wedge, let go: that wedge (the ring as it was built)
    { R.aim(spot); const n0 = O.log.length; R.down(ringHoldSecs() + 0.1); const r4 = R.rowOf(4); R.out(4); const lit = O.cmdRing?.lit; R.up(); const row = R.tail(), k = O.log.length - n0;
      line(!!r4 && lit === 4 && k === 1 && row?.order === r4.id && !O.cmdRing && !O.menu, 'kept down, the cursor out to a wedge and the key let go gives that wedge', `wedge 4 is '${r4?.id}' · lit ${lit} · the key up: +${k} ${row?.order} · ring ${O.cmdRing ? 'up' : 'gone'}`);
      R.step(30); R.home(); }

    // (9) `stay` off: the ring goes with its key
    { C.stay = false; R.aim(spot); const n0 = O.log.length; R.down(CMDRING.holdSecs + 0.1); const up = !!O.cmdRing; R.up(); const row = R.tail(), k = O.log.length - n0, gone = !O.cmdRing && !O.menu; C.stay = !BREAK;
      line(up && k === 1 && row?.order === 'move' && gone, '`stay` off: the ring is up at the old hold and the key up in its middle gives the lit wedge, as it was built', `at ${(CMDRING.holdSecs + 0.1).toFixed(2)} s: ${up ? 'up' : 'not up'} · the key up: +${k} ${row?.order} · ring ${gone ? 'gone' : 'up'}`);
      R.step(30); R.home(); }

    // (10) Shift + the key: plan mode up and down; out of a sprint, the key's own order; the mode up, it is left whatever is down
    { const P = O.plan, shiftKey = (walk: boolean) => { I.keys.add('ShiftLeft'); if (walk) I.keys.add('KeyW'); R.step(2); I.keys.add(CMDRING.key); I.pressed.add(CMDRING.key); R.step(); I.keys.delete(CMDRING.key); R.step(); I.keys.delete('ShiftLeft'); I.keys.delete('KeyW'); R.step(2); };
      R.aim(spot); const n0 = O.log.length; shiftKey(false); const up = P.up, k0 = O.log.length - n0; shiftKey(false); const down = !P.up;
      R.aim(spot); const n1 = O.log.length; shiftKey(true); const ran = !P.up, k1 = O.log.length - n1, row = R.tail(); R.step(30); R.home();
      shiftKey(false); const up2 = P.up; shiftKey(true); const left = !P.up, k2 = O.log.length;
      line(up && k0 === 0 && down && ran && k1 === 1 && row?.order === 'move' && up2 && left, 'Shift + the key puts plan mode up and takes it down, ordering nothing; with a walk key down (a sprint) it is the key\'s own order and the mode stays down; the mode up, Shift + the key leaves it whatever else is down',
        `standing: ${up ? 'up' : 'NOT up'}, order book +${k0}, again ${down ? 'down' : 'STILL up'} · running: the mode ${ran ? 'down' : 'UP'}, +${k1} ${k1 ? row?.order : ''} · up again ${up2}, Shift + W + the key: ${left ? 'down' : 'STILL up'}`);
      void k2; R.home(); }

    // (11) the journal and the page's flags
    { const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      C.stay = true; C.tapNow = true; C.planRun = true; const old = snap(); delete old.tables.CMDRING.stay; delete old.tables.CMDRING.tapNow; delete old.tables.CMDRING.planRun; JOURNAL.applyKnobs(g, old); const without = [C.stay, C.tapNow, C.planRun].join('/');
      const own = snap(); Object.assign(own.tables.CMDRING, { stay: true, tapNow: true, planRun: true }); JOURNAL.applyKnobs(g, own); const withThem = [C.stay, C.tapNow, C.planRun].join('/');
      const flags = (q: string) => { PROFILE.pageSwitches(new URLSearchParams(q)); return `${C.on ? 'ring' : 'no ring'} ${C.stay ? 'stays' : 'goes'} ${C.plan ? 'plan' : 'no plan'}${C.planRun ? '' : ' (no run rule)'}${C.hands ? ' hands' : ''}`; };
      const a = flags(''), b = flags('qring=0'), c = flags('qstay=0'), d = flags('qplan=0'), e = flags('nocmdplan'), f = flags('cmd');
      line(without === 'false/false/false' && withThem === 'true/true/true' && a === 'ring stays plan' && b === 'no ring goes no plan (no run rule)' && c === 'ring goes plan' && d === 'ring stays no plan (no run rule)' && e === d && f === 'ring stays plan hands',
        'a recording from before the keys replays with them off, one with them keeps them; the page opens with the ring, staying up, and plan mode — ?qring=0, ?qstay=0 and ?qplan=0 each put theirs off, and ?cmd still raises Space\'s own ring',
        `applyKnobs with no keys → ${without} · with them on → ${withThem} · '' → ${a} · 'qring=0' → ${b} · 'qstay=0' → ${c} · 'qplan=0' → ${d} · 'nocmdplan' → ${e} · 'cmd' → ${f}`); }
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; AUTOPILOT.on = ap0; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== qring: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await qringCheck()) ? 0 : 1);
