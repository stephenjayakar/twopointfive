// THE SQUAD'S ONLY KEYS (src/game/cmdring.ts: CMDRING.only, ringSeats; src/host/keymap.ts: KEYMAP.qOnly) — the maintainer, 10-22: "squad is now just q and f.
// everything is through the radial menu (which is 1-5? is that sufficient) so we don't need all the other keys". The ring through the game's own input,
// headless; the board through its own reads.
//   bun run tools/qa/qonly-check.ts              (also `probes.ts qonly`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/qonly-check.ts        — the same lines on the page's stand
// PASS / FAIL each: the room clear on the office with its squad of four, everybody under god mode.
//   (1) the stand: the switch as the stand says (held off frozen, on as the page opens), and FROZEN_HOLDS carries its row and word;
//   (2) the seats, on rows written here: digits keep their wedges, a letter's row takes the spare one, six rows make the last wedge 'more', a full page
//       gives its last wedge up to 'more', the word's rows and (on a place) the squad's posture rows are left out; off, the wedges are the digits' rows;
// … then the check raises the ring and the switch itself and asks:
//   (3) a floor's ring: every wedge 1 to 5, the fifth 'throw there', no posture wedge; the digit turns to the throws; a right click steps back;
//   (4) a door's tools with one row more than the wedges hold: the fifth wedge is 'more'; it opens the rest from wedge 1; a digit there gives that
//       row; a right click on 'more' is the tools again, another the first page, another nothing;
//   (5) the ring on Sam himself carries the posture row, and a place's ring does not;
//   (6) a ring up, a row's own letter does nothing (off: it turns the page as it did);
//   (7) the middle button opens no menu (off: it does);
//   (8) the squad panel lists no key for the menu and none for who (off: both);
//   (9) the board: the orders key and the who key give nothing and read as no key; ?qonly=0 and ?qring=0 put both back; a row put back on its key by
//       hand gives its code again;
//   (10) a recording from before the key replays with it off; the page's flags.
// QONLY_BREAK=1 = the switch (and the board's) left off and the same lines asked: the lines that say what the rule does must fail.
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const { CMDRING, CMDRING_STATS, ringHoldSecs, ringSeats } = await import(`${ROOT}/src/game/cmdring.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { TOOLS_PAGE } = await import(`${ROOT}/src/game/doortools.ts`);
const { THROW_PAGE, THROW_OPEN, SQUADTHROW } = await import(`${ROOT}/src/game/squadthrow.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const K = await import(`${ROOT}/src/host/keymap.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
void CMDRING_STATS;

const DT = 1 / 60, BREAK = process.env.QONLY_BREAK === '1';
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

export async function qonlyCheck(): Promise<boolean> {
  console.log(`\n=== qonly: the squad's keys are the command key and the word's; the ring carries every order${BREAK ? ' — QONLY_BREAK: the switch never on' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  const knobs0 = knobsCopy(), rnd0 = Math.random, ap0 = AUTOPILOT.on, C = CMDRING as any, KM = K.KEYMAP as any, km0 = { ...KM };
  const page = () => { C.on = true; C.hint = false; C.hands = false; C.stay = true; C.tapNow = true; C.plan = false; C.planRts = false; C.planRun = false; C.only = !BREAK; C.flat = false;   /* (these lines ask the ring by the menu's pages, as `only` was built: the two-ring tree is held off here and has its own check, ringflat-check) */ SQUADTHROW.on = true; };   // (the floor's throws: a row on a letter of its own, on both stands)
  try {
    // (1) the stand, read off the first stand-up before the check sets anything
    { await quiet(() => standUp({})); const shipped = process.env.TPS_PROFILE === 'shipped', E = process.env;
      const ring = E.TPS_QRING !== undefined ? E.TPS_QRING === '1' : shipped, want = ring && (E.TPS_QONLY !== undefined ? E.TPS_QONLY === '1' : shipped);
      const rows = String(FROZEN_HOLDS['CMDRING.only'] ?? '').includes('TPS_QONLY=1') && PROFILE.STAND_ENV.includes('TPS_QONLY');
      line(C.only === want && rows, `the stand: the switch ${shipped ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries its row and word`,
        `after the stand-up: only ${C.only} (the ring ${C.on}) · TPS_QONLY ${E.TPS_QONLY ?? 'unset'}, TPS_QRING ${E.TPS_QRING ?? 'unset'} · TPS_PROFILE ${E.TPS_PROFILE ?? 'unset'} · row and word ${rows ? 'there' : 'MISSING'}`); }

    // (2) the seats, on rows written here
    { const T = ['floor'], N = ['floor', 'none'], r = (key?: number, x: any = {}) => ({ key, targets: T, ...x });
      const floor = [r(1), r(2), r(3), r(4), r(undefined, { hotKey: 'KeyG', opens: 'throw' }), r(5, { free: true, targets: N }), r(undefined, { hotKey: 'KeyF', free: true })];
      const tools6 = [r(1), r(2), r(3), r(4), r(undefined, { hotKey: 'KeyH' }), r(undefined, { hotKey: 'KeyG' })], tools5 = tools6.filter((_, i) => i !== 4);
      const wall = [r(1), r(2), r(3), r(4), r(undefined, { hotKey: 'KeyG', opens: 'throw' }), r(undefined, { hotKey: 'KeyF' }), r(5, { opens: 'walltools' }), r(undefined, { free: true, targets: N })];
      const show = (s: any) => `${s.row.slice(1).join(',')}|${s.more}|${s.over.join(',')}`, was = C.only; C.only = !BREAK;
      const a = show(ringSeats(floor, true, 'KeyF')), b = show(ringSeats(floor, false, 'KeyF')), c = show(ringSeats(tools6, true, 'KeyF')), d = show(ringSeats(tools5, true, 'KeyF')), e = show(ringSeats(wall, true, 'KeyF'));
      const bare = floor.filter((_, i) => i !== 4), no1 = [r(2), r(3), r(undefined, { hotKey: 'KeyG' })];   // (a floor with no throws to order: the posture row has a wedge nothing else wants · a first page with no row on 1)
      const p = show(ringSeats(bare, true, 'KeyF')), q = show(ringSeats(no1, false, 'KeyF')), q2 = show(ringSeats(no1, false, 'KeyF', false));
      C.only = false; const f = show(ringSeats(floor, true, 'KeyF')), h = show(ringSeats(tools6, true, 'KeyF')); C.only = was;
      line(a === '0,1,2,3,4|0|' && b === '0,1,2,3,-1|5|5,4' && c === '0,1,2,3,-1|5|4,5' && d === '0,1,2,3,4|0|' && e === '0,1,2,3,-1|5|6,4' && p === '0,1,2,3,4|0|' && q === '-1,0,1,2,-1|0|' && q2 === '2,0,1,-1,-1|0|' && f === '0,1,2,3,5|0|' && h === '0,1,2,3,-1|0|',
        "the seats: a letter's row on the spare wedge; the posture row off a place's ring unless a wedge is left over; a first page's wedge 1 is never a spare; six rows make the last wedge 'more'; a full page gives its last wedge up; the word's rows left out; off, the digits' rows alone",
        `(wedges 1…5 | 'more' | its rows) a floor ${a} · the same on the squad's own ring ${b} · six tools ${c} · five ${d} · a wall ${e} · a floor with no throws ${p} · no row on 1: a first page ${q}, a later one ${q2} · off: a floor ${f}, six tools ${h}`); }

    const R = await quiet(() => rig(page)), g = R.g, O = R.O, I = R.I;
    if (R.why) { line(false, 'the room clear stands up', R.why); return false; }
    const spot = floorSpot(R);
    if (!spot) { line(false, 'a spot of open floor to point at', 'none round Sam'); return false; }
    const stackDef = O.defs.find((d: any) => d.id === 'stack'), men = () => O.men('all'); let D: any = null;
    for (const d of [...g.doors.list].sort((a: any, b: any) => dist(a.frameCentre, g.player.char.pos) - dist(b.frameCentre, g.player.char.pos))) { const t = O.targetAt(d.frameCentre); if (t.kind !== 'door' || t.door !== d) continue; if (!O.whyNot(stackDef, O.forMen(t, men()), men()) && R.aimOf(d)) { D = d; break; } }
    if (!D) { line(false, 'a door to open the ring on', 'none the cursor finds'); return false; }
    const view = () => O.ringView(), wedges = () => (view()?.wedges ?? []).map((w: any) => `${w.key}:${w.text.split(' · ')[0]}${w.opens ? ' ▸' : ''}${w.off ? ' (off)' : ''}`).join(' | ');
    const wedge = (k: number) => (view()?.wedges ?? []).find((w: any) => w.key === k), rmb = () => R.click(4);
    // a row of the check's own on the door tools' page, on a letter: with the page's four digits and its frag row that is one row more than five wedges hold
    let probed = 0; O.register({ id: 'qonlyProbe', page: TOOLS_PAGE, hotKey: 'KeyJ', label: 'probe row', targets: ['door'], free: true, issue: () => { probed++; } });

    // (3) a floor's ring
    { const up = R.open(spot), w0 = wedges(), n = view()?.wedges.length, five = wedge(5), silent = (view()?.wedges ?? []).some((w: any) => /silent|loud/.test(w.text));
      R.press('Digit5'); const pg = O.menu?.page, w1 = wedges(), lit = O.cmdRing?.lit; rmb(); const back = O.menu?.page === null && !!O.cmdRing; rmb(); const gone = !O.cmdRing && !O.menu;
      line(up && n === 5 && !!five?.opens && /throw/.test(five.text) && !silent && pg === THROW_PAGE && lit === 0 && back && gone, "a floor's ring: five wedges, the fifth the throws, no posture wedge; the digit turns to them and lights nothing; a right click steps back, another puts it away",
        `left up ${up} · ${w0} · 5: page '${pg}', lit ${lit} · ${w1} · right click: ${back ? 'the first page' : 'NOT the first page'} · again: ${gone ? 'gone' : 'still up'}`);
      R.home(); }

    // (4) a door's tools, one row more than the wedges hold
    { const p = R.aimOf(D)!, up = R.open(p); R.press('Digit5'); const pg = O.menu?.page, w0 = wedges(), more = wedge(5), nRows = O.menu?.rows.length ?? 0;
      R.press('Digit5'); const on = !!O.cmdRing?.more, w1 = wedges(), lit = O.cmdRing?.lit, k = (view()?.wedges ?? []).find((w: any) => /probe/.test(w.text))?.key ?? 0;
      rmb(); const backTools = !!O.cmdRing && !O.cmdRing.more && O.menu?.page === TOOLS_PAGE; R.press('Digit5'); const again = !!O.cmdRing?.more; const n0 = probed;
      if (k) R.press(`Digit${k}`); const gave = probed - n0, gone = !O.cmdRing && !O.menu;
      const up2 = R.open(p); R.press('Digit5'); R.press('Digit5'); rmb(); rmb(); const first = !!O.cmdRing && O.menu?.page === null; rmb(); const gone2 = !O.cmdRing && !O.menu;
      line(up && pg === TOOLS_PAGE && nRows > 5 && more?.text === 'more' && !!more?.opens && on && lit === 0 && k > 0 && backTools && again && gave === 1 && gone && up2 && first && gone2,
        "a door's tools with more rows than wedges: the fifth wedge is 'more'; it opens the rest from wedge 1 and lights nothing; a digit there gives that row; a right click on 'more' is the tools again, another the first page, another nothing",
        `tools: ${nRows} rows · ${w0} · 5 again: more ${on}, lit ${lit} · ${w1} · right click: ${backTools ? 'the tools' : 'NOT the tools'} · 5, then ${k}: the probe row given ${gave} time(s), ring ${gone ? 'gone' : 'up'} · three right clicks from 'more': ${first ? 'the first page' : 'NOT the first page'}, then ${gone2 ? 'gone' : 'still up'}`);
      R.home(); }

    // (5) the posture row: on the ring on Sam, not on a place's
    { const lists = O.defs.some((d: any) => d.id === 'silent');
      if (!lists) line(true, 'the posture rows are not registered on this stand: nothing to ask of them here (the seats line asks it of written rows)', '');
      else { const sp = g.player.char.pos, up = R.open([sp[0], 1.0, sp[2]]), kind = O.menu?.target.kind, own = (view()?.wedges ?? []).some((w: any) => /silent|loud/.test(w.text)), w0 = wedges(); rmb();
        const up2 = R.open(spot), place = (view()?.wedges ?? []).some((w: any) => /silent|loud/.test(w.text)), listed = (O.menu?.rows ?? []).some((r: any) => r.id === 'silent' || r.id === 'loud'); rmb();
        line(up && kind === 'none' && own && up2 && listed && !place, "the ring on Sam himself carries the posture row; a floor's ring does not, though its menu lists it", `on Sam: target '${kind}' · ${w0} · on the floor: the menu lists it ${listed}, a wedge has it ${place}`); }
      R.home(); }

    // (6) a row's own letter with the ring up
    { const up = R.open(spot), key = O.defs.find((d: any) => d.id === THROW_OPEN)?.hotKey ?? 'KeyG'; R.press(key); const pg = O.menu?.page ?? null, still = !!O.cmdRing; rmb(); rmb();
      C.only = false; const up2 = R.open(spot); R.press(key); const pg2 = O.menu?.page ?? null; rmb(); rmb(); C.only = !BREAK;
      line(up && still && pg === null && up2 && pg2 === THROW_PAGE, "a ring up, a row's own letter does nothing; with the switch off it turns the page as it did", `${key} with the ring up: page ${pg === null ? 'the first' : `'${pg}'`}, ring ${still ? 'up' : 'gone'} · off: page '${pg2}'`);
      R.home(); }

    // (7) the middle button
    { R.aim(spot); I.clicked |= 2; R.step(); const menu = !!O.menu; O.close(); I.clicked = 0;
      C.only = false; R.aim(spot); I.clicked |= 2; R.step(); const menu2 = !!O.menu; O.close(); I.clicked = 0; C.only = !BREAK;
      line(!menu && menu2 === ORDERS.mouseOpens, 'the middle button opens no menu; with the switch off it does', `a middle click on the floor: menu ${menu ? 'up' : 'none'} · off: ${menu2 ? 'up' : 'none'}`); }

    // (8) the squad panel's keys
    { R.aim(spot); const keys = () => (O.hud().status?.[0]?.opts ?? []).map((o: any) => o.key).filter((k: string) => !!k).join(' '), on = keys();
      C.only = false; R.step(); const off = keys(); C.only = !BREAK; const x = ORDERS.key.replace('Key', ''), t = ORDERS.whoKey.replace('Key', '');
      const has = (s: string, k: string) => s.split(' ').includes(k);
      line(!has(on, x) && !has(on, t) && has(off, x) && has(off, t), 'the squad panel lists no key for the menu and none for who; with the switch off it lists both', `keys on the panel: ${on || '(none)'} · off: ${off}`); }

    // (9) the board
    { const boot = (q: string) => { K.keysBoot(new URLSearchParams(q ? `${q}&slotsetup=0` : 'slotsetup=0')); if (BREAK) KM.qOnly = false; },   // (the selector's row and the light's left on Z and L: the rows the gun's setup frees are slotsetup-check.ts's)
      read = () => `${K.gameCode('KeyX') || '∅'}/${K.gameCode('KeyT') || '∅'} ${K.capNow('KeyX')}/${K.capNow('KeyT')}`;
      boot(''); const a = read(), others = K.KEY_ACTS.flatMap((x: any) => x.codes).filter((c: string) => !['KeyX', 'KeyT', 'KeyQ', 'KeyB'].includes(c) && K.gameCode(c) !== c).length, f = K.gameCode('KeyF');
      boot('qonly=0'); const b = read(); boot('qring=0'); const c = read();
      boot(''); const w1 = K.keyText('X on the ground, then 5: he goes loud'), w2 = K.keyText('Stack up. X on the door, then 1'), w3 = K.keyText('T again, off the men: BLUE'), cmd = K.capNow('KeyB');
      boot(''); const r = K.bindKey('KeyX', 'KeyX'), d = read(); K.resetKeys(); const e = read(); boot('');
      line(a === `∅/∅ ${K.NONE}/${K.NONE}` && others === 0 && f === 'KeyF' && b === 'KeyX/KeyT X/T' && c === b && r.ok && d === `KeyX/∅ X/${K.NONE}` && e === a && w1 === `Hold ${cmd} on the ground, then 5: he goes loud` && w2 === `Stack up. Hold ${cmd} on the door, then 1` && w3 === 'T again, off the men: BLUE',
        'the board: the orders key and the who key give nothing and read as no key, nothing else moves; ?qonly=0 and ?qring=0 put both back; a row put back on its key by hand gives its code again, and Reset frees it; a line of words that names the orders key names the command key kept down in its place',
        `(X/T give · read) as it boots ${a}, ${others} other keys moved, F gives ${f} · ?qonly=0 ${b} · ?qring=0 ${c} · X bound back: ${d} · Reset: ${e} · words: "${w1}" · "${w2}" · "${w3}"`); }

    // (10) the journal and the page's flags
    { const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      C.only = true; const old = snap(); delete old.tables.CMDRING.only; JOURNAL.applyKnobs(g, old); const without = C.only;
      const own = snap(); own.tables.CMDRING.only = true; JOURNAL.applyKnobs(g, own); const withIt = C.only;
      const flags = (q: string) => { PROFILE.pageSwitches(new URLSearchParams(q)); return `${C.on ? 'ring' : 'no ring'}${C.only ? ' only' : ''}`; };
      const a = flags(''), b = flags('qonly=0'), c = flags('qring=0');
      line(without === false && withIt === true && a === 'ring only' && b === 'ring' && c === 'no ring', 'a recording from before the key replays with it off, one with it keeps it; the page opens with it on — ?qonly=0 puts it off, and ?qring=0 with the ring',
        `applyKnobs with no key → ${without} · with it on → ${withIt} · '' → ${a} · 'qonly=0' → ${b} · 'qring=0' → ${c}`); }
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; AUTOPILOT.on = ap0; Object.assign(KM, km0); K.resetKeys(); }   // (pageSwitches, applyKnobs and keysBoot wrote: each back as this check found it)
  console.log(`=== qonly: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await qonlyCheck()) ? 0 : 1);
