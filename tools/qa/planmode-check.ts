// PLAN MODE, A PROTOTYPE (src/game/planmode.ts, CMDRING.plan — off unless asked for on the page and on both stands): the mode's keys and buttons through
// the game's own input, headless.
//   bun run tools/qa/planmode-check.ts            (also `probes.ts planmode`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/planmode-check.ts      — the same lines on the page's stand
// PASS / FAIL each: the room clear on the office with its squad of four, everybody under god mode (the lines are about what is ORDERED, not who wins).
// The check raises the ring's switch and the mode's itself (no stand has them on), and the quick key's autopilot for the line that presses that key. A click is a button down for a frame (the right button's order goes on the frame it comes up); a drag is held across frames.
// PLANMODE_BREAK=1 = the mode's switch left off and the same lines asked: they must fail (the one that holds says 'as it was': the switch-off line).
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const CR: any = await import(`${ROOT}/src/game/cmdring.ts`);
const PM: any = await import(`${ROOT}/src/game/planmode.ts`);
const AP: any = await import(`${ROOT}/src/game/autopilot.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { CMDRING } = CR, { PLAN_STATS, planView } = PM, { AUTOPILOT } = AP;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const BREAK = process.env.PLANMODE_BREAK === '1';

async function rig(seed: number, plan = !BREAK) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try {
    Object.assign(NIGHTBREACH, { squad: 4 });
    Math.random = seeded(seed);
    W = await standUp();
    CMDRING.on = true; CMDRING.hint = true; CMDRING.hands = true; CMDRING.plan = plan; CMDRING.planRts = plan; AUTOPILOT.on = true;
    W.game.godMode = true;
    why = W.game.roomClear.start(seed);
  } finally { Object.assign(NIGHTBREACH, { squad: squad0 }); }
  const game = W.game, O = game.orders, input = W.input, KEY = CMDRING.key, F = DOORTOOLS.blowKey;
  const R: any = { W, game, O, why, input, P: O.plan,
    get team(): any[] { return O.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    aim(p: number[]) { W.cursorAt([p[0], p[1], p[2]]); R.step(2); return O.hover?.() ?? null; },
    press(code: string) { input.pressed.add(code); R.step(); },
    /** Shift + the ring's key: the mode's toggle */
    toggle() { input.keys.add('ShiftLeft'); input.pressed.add(KEY); R.step(); input.keys.delete('ShiftLeft'); R.step(); },
    /** a click of a button (1 left, 4 right) where the cursor is, Shift held or not */
    click(bit: number, shift = false) { if (shift) input.keys.add('ShiftLeft'); input.clicked |= bit; input.buttons |= bit; R.step(); input.buttons &= ~bit; R.step(); if (shift) { input.keys.delete('ShiftLeft'); R.step(); } },
    /** a left click on a man (his chest: the ray meets his own body) */
    clickMan(m: any, shift = false) { W.cursorAt([m.char.pos[0], 1.0, m.char.pos[2]]); R.step(); R.click(1, shift); },
    /** a left drag between two places on the screen */
    drag(a: number[], b: number[], shift = false) { if (shift) input.keys.add('ShiftLeft'); input.mouseX = a[0]; input.mouseY = a[1]; input.clicked |= 1; input.buttons |= 1; R.step();
      for (let k = 1; k <= 4; k++) { input.mouseX = a[0] + (b[0] - a[0]) * k / 4; input.mouseY = a[1] + (b[1] - a[1]) * k / 4; R.step(); }
      input.buttons &= ~1; R.step(); if (shift) { input.keys.delete('ShiftLeft'); R.step(); } },
    word() { R.press(F); },
    screen(m: any): number[] { const [x, y] = W.cam.project(m.char.pos, W.canvas.clientWidth, W.canvas.clientHeight); return [x, y]; },
    names(): string[] { return O.recipients().map((m: any) => m.callsign).sort(); },
    tail() { return O.log[O.log.length - 1]; },
    stacked(men: any[] = R.team) { return men.filter((m: any) => m.state !== 'dead').every((m: any) => O.of(m)?.order === 'stack' && O.of(m)?.arrived); },
    /** everything put away and the men back round Sam, the mode as `up` */
    home(up = true) { input.keys.clear(); input.buttons = 0; O.cmdRing = null; O.close(); O.plan.chains = []; O.plan.pick = null; O.plan.drag = null; O.who = 'all'; if (O.plan.up !== (up && CMDRING.plan)) R.toggle();
      O.give('fallIn', O.targetAt(game.player.char.pos), 'all'); R.until(() => game.doorTools.ops.length === 0, 40); R.until(() => R.team.every((m: any) => dist(m.char.pos, game.player.char.pos) < 4.5), 25); R.step(30); },
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  return R;
}
function doorsNear(R: any): { d: any; t: any }[] {
  const s = R.game.player.char.pos, out: { d: any; t: any }[] = [];
  for (const d of [...R.game.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s))) { const t = R.O.targetAt(d.frameCentre); if (t.kind === 'door' && t.door === d) out.push({ d, t }); }
  return out;
}
function aimOf(R: any, d: any): number[] | null {
  const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th);
  for (const y of [c[1], 0.05, 1.0, 1.8]) for (const k of [0, 0.35, -0.35]) { const p = [c[0] + nx * k, y, c[2] + nz * k]; const h = R.aim(p); if (h?.kind === 'door' && h.door === d) return p; }
  return null;
}
function floorSpot(R: any, skip: number[][] = []): number[] | null {
  const s = R.game.player.char.pos;
  for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [2, 2], [-2, -2], [2, -2], [-2, 2], [3.5, 0], [0, 3.5], [-3.5, 0], [0, -3.5]]) { const p = [s[0] + dx, 0.04, s[2] + dz]; if (skip.some(q => dist(q, p) < 1.5)) continue;
    const h = R.aim(p); if (h?.kind === 'floor' && !h.wall && !h.thing && R.team.every((m: any) => dist(m.char.pos, p) > 1.2) && R.O.defaultFor(h)?.id === 'move' && R.O.whyNot(R.O.defaultFor(h), h) === null) return p; }
  return null;
}

export async function planmodeCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const keep = { on: CMDRING.on, hint: CMDRING.hint, hands: CMDRING.hands, plan: CMDRING.plan, rts: CMDRING.planRts, ap: AUTOPILOT.on, rnd: Math.random };
  console.log(`plan mode (src/game/planmode.ts)${BREAK ? ' — PLANMODE_BREAK=1: the switch left off, the lines below must fail' : ''}`);
  try {
    // 1. the switch off (the ring's own on): Shift and the key are nobody's, the mouse is Sam's, the file has no plan in it
    { const R = await rig(1, false), g = R.game, pl = g.player; R.home(false);
      R.toggle(); const up = R.P.up; const spot = floorSpot(R); if (spot) R.aim(spot);
      const t0 = pl.lastFireT; R.click(1); const fired = pl.lastFireT !== t0;
      line(!up && fired && !planView(R.O), 'the switch off: Shift+Tab is nobody\'s, the left click is his trigger, nothing is drawn', `mode ${up ? 'up' : 'not up'} · the click ${fired ? 'fired' : 'did not fire'} · ${planView(R.O) ? 'a plan drawn' : 'nothing drawn'}`); }

    const R = await rig(1), g = R.game, O = R.O, P = R.P, pl = g.player, T = () => R.team.filter((m: any) => m.state !== 'dead');
    R.home(false);
    // 2. Shift + the key puts it up and takes it down; the key alone is still the ring
    { R.toggle(); const up = P.up; const spot = floorSpot(R); if (spot) R.aim(spot);
      R.input.keys.add(CMDRING.key); R.input.pressed.add(CMDRING.key); R.step(3 + Math.ceil(CMDRING.holdSecs * 60)); const ring = !!O.cmdRing;   // (kept down past the hold, cmdring.ts holdSecs: a tap opens none)
      R.press('Escape'); R.input.keys.delete(CMDRING.key); R.step(2);
      const still = P.up; R.toggle(); const downAgain = !P.up;
      line(up && ring && still && downAgain, 'Shift+Tab puts the mode up and takes it down; Tab alone is still the ring', `after the first: ${up ? 'up' : 'down'} · Tab: ${ring ? 'a ring' : 'no ring'} · after it: ${still ? 'up' : 'down'} · after the second: ${downAgain ? 'down' : 'up'}`); }
    R.home();
    // 3. the left button is the squad's: no round goes, a click on a man is him alone, Shift click adds a man and takes him out, the who key is everyone again
    { const [a, b] = [T()[0], T().find((m: any) => O.pairOf(m) !== O.pairOf(T()[0])) ?? T()[1]];
      const t0 = pl.lastFireT; R.clickMan(a); const one = R.names().join(); const fired = pl.lastFireT !== t0;
      R.clickMan(b, true); const two = R.names().join(), picked = P.pick ? P.pick.length : 0;
      R.clickMan(b, true); const back = R.names().join();
      R.clickMan(b, true); R.press(ORDERS.whoKey); const afterT = P.pick;
      line(!fired && one === a.callsign && two === [a.callsign, b.callsign].sort().join() && picked === 2 && back === a.callsign && afterT === null, 'a click picks a man, Shift click adds him and takes him out, T lets the set go — and Sam fires nothing', `click: ${one} · Shift click: ${two} · again: ${back} · after T the set is ${afterT === null ? 'gone' : 'kept'} · ${fired ? 'a round went' : 'no round'}`); }
    R.home();
    // 4. a drag boxes the men in it; a click on nothing is everyone
    { const S = T().map((m: any) => ({ m, s: R.screen(m) })).sort((x: any, y: any) => x.s[0] - y.s[0]), two = S.slice(0, 2);
      const lo = (k: number) => Math.min(...two.map((x: any) => x.s[k])) - 14, hi = (k: number) => Math.max(...two.map((x: any) => x.s[k])) + 14;
      const want = S.filter((x: any) => x.s[0] >= lo(0) && x.s[0] <= hi(0) && x.s[1] >= lo(1) && x.s[1] <= hi(1)).map((x: any) => x.m.callsign).sort().join();
      R.drag([lo(0), lo(1)], [hi(0), hi(1)]); const boxed = R.names().join();
      const spot = floorSpot(R); if (spot) R.aim(spot); R.click(1); const all = R.names().length;
      line(boxed === want && want.split(',').length < T().length && all === T().length && O.who === 'all', 'a drag boxes the men in it; a click on nothing is everyone', `the box held ${want} · picked ${boxed} · after the click: ${all} of ${T().length}`); }
    R.home();
    // 5. a right click is the quick key's order for the picked men alone, at once
    { const [a, b] = [T()[0], T().find((m: any) => O.pairOf(m) !== O.pairOf(T()[0])) ?? T()[1]]; R.clickMan(a); R.clickMan(b, true);
      const spot = floorSpot(R), n = O.log.length; if (spot) { R.aim(spot); R.click(4); }
      const row = O.log.length > n ? R.tail() : null, went = row ? [...row.who].sort().join() : '';
      line(!!spot && row?.order === 'move' && went === [a.callsign, b.callsign].sort().join() && P.chains.length === 1, 'a right click moves the picked men, and nobody else', spot ? `${row?.order ?? 'nothing given'} to ${went || 'nobody'} · ${P.chains.length} chain` : 'no open floor found'); }
    R.home();
    const doors = doorsNear(R).filter(x => !!aimOf(R, x.d)), A = doors[0], other = doors.filter(x => x.d !== A?.d), B = other.find(x => !x.d.def.steel) ?? other[0];   // (a second door a pair can be sent THROUGH: a steel one is refused from its locked side)
    if (!A) line(false, 'a door to plan on', 'none the cursor can be put on');
    else {
      const entries = ['bangClear', 'openClear', 'charge'], isEntry = () => entries.includes(R.tail()?.order);
      // 6. a right click on a door: they stack and WAIT at the threshold, the word's key drawn there
      { R.aim(aimOf(R, A.d)!); R.click(4); const C = P.chains[0], went = R.tail()?.order; R.until(() => C?.phase === 'wait', 25); const waits = C?.phase === 'wait'; const n = O.log.length; R.step(150);
        const V = planView(O), stop = V?.chains[0]?.stops[0];
        line(went === 'stack' && waits && O.log.length === n && g.doorTools.ops.length === 0 && stop?.keys === 1 && stop?.now === true, 'a right click on a door: they stack and wait at the threshold, the key drawn on it', `${went} · chain ${C?.phase ?? 'none'} · ${O.log.length - n} orders in 2.5 s more · the stop shows ${stop?.keys ?? 'no'} key${stop?.now ? ', lit' : ''}`);
        // 7. the word's key: they go in by the entry they pick; nothing chained after it, the chain is done once the room is taken
        const done0 = PLAN_STATS.done; R.word(); const entry = R.tail()?.order, ph = P.chains[0]?.phase; R.until(() => P.chains.length === 0, 45);
        line(entries.includes(entry) && ph === 'in' && P.chains.length === 0 && PLAN_STATS.done === done0 + 1, 'F at the threshold: they go in by the entry they pick, and the chain is done once the room is taken', `${entry} · chain ${ph} · then ${P.chains.length ? `still ${P.chains[0].phase}` : 'done'}`); }
      R.home();
      // 8. Shift + right click chains: the room, then a spot — F to go in, F again to move on once it is taken, and no key on the last stop
      { const spot = floorSpot(R); R.aim(aimOf(R, A.d)!); R.click(4); if (spot) { R.aim(spot); R.click(4, true); }
        const C = P.chains[0], steps = C?.steps.length ?? 0, V0 = planView(O), keys0 = V0?.chains[0]?.stops.map((s: any) => s.keys).join('+');
        R.until(() => C?.phase === 'wait', 25); R.word(); const in1 = C?.phase === 'in' && isEntry();
        R.until(() => C?.phase === 'held', 45); const held = C?.phase === 'held', n = O.log.length; R.step(120); const quiet = O.log.length === n;
        R.word(); const moved = R.tail()?.order === 'move' && O.log.length === n + 1; R.until(() => P.chains.length === 0, 25);
        line(!!spot && steps === 2 && keys0 === '2+0' && in1 && held && quiet && moved && P.chains.length === 0, 'Shift + right click chains a spot after the room: F goes in, they hold the room until F, then walk on', spot ? `${steps} stops, keys ${keys0} · F: ${in1 ? 'in' : 'not in'} · room taken: ${held ? 'they wait' : `chain ${C?.phase}`}${quiet ? '' : ', and moved without the key'} · F: ${moved ? 'moving' : R.tail()?.order} · ${P.chains.length ? 'chain still up' : 'chain done'}` : 'no open floor found'); }
      R.home();
      // 9. an early F counts for the next pause: its mark comes off the plan, they go in without another press, and the plan shows a moment with the mode down
      { R.aim(aimOf(R, A.d)!); R.click(4); const C = P.chains[0]; R.toggle(); const hidden = !planView(O) || g.time - P.showT < CMDRING.planShowSecs; R.step(Math.ceil(CMDRING.planShowSecs * 60) + 5); const gone = !planView(O);
        const early = C?.phase === 'go'; R.word(); const spent = C?.spent, V = planView(O), keys = V?.chains[0]?.stops[0]?.keys, shown = !!V && !V.up;
        R.until(() => C?.phase === 'in' || P.chains.length === 0, 30); const inNow = isEntry();
        line(hidden && gone && early && spent === 1 && keys === 0 && shown && inNow, 'F early: the mark comes off the plan (shown a moment, the mode down) and they go in at the threshold without another press', `pressed while ${early ? 'walking' : C?.phase} · kept ${spent} · the stop shows ${keys} keys · plan ${shown ? 'shown' : 'not shown'} · then ${R.tail()?.order}`); }
      R.home();
      // 10. an order given another way takes the men off the chain — but the quick key on the door they wait at is the chain's own word
      { const quick = () => { R.press(ORDERS.quickKey); if (ORDERS.quickKey === CMDRING.key) R.step(2); };   // (the quick key the ring's own key, as in the page: the order is given as the key comes up)
        const spot = floorSpot(R); R.aim(aimOf(R, A.d)!); R.click(4); if (spot) { R.aim(spot); R.click(4, true); } const C = P.chains[0]; R.until(() => C?.phase === 'wait', 25);
        R.aim(aimOf(R, A.d)!); quick(); const own = C?.phase === 'in' && P.chains.includes(C) && isEntry();
        R.until(() => C?.phase === 'held', 45); if (spot) { R.aim(spot); quick(); } const off = P.chains.length === 0 && R.tail()?.order === 'move';
        line(!!spot && own && off, 'B on the door they wait at is the chain\'s word; B somewhere else takes them off the chain', `B on the door: ${own ? 'in, chain kept' : `chain ${P.chains.includes(C) ? C?.phase : 'gone'}`} · B on the floor: ${off ? 'moving, chain gone' : `${P.chains.length} chain`}`); }
      R.home();
      // 11. a plain right click replaces the chain
      { const spot = floorSpot(R); R.aim(aimOf(R, A.d)!); R.click(4); if (B) { R.aim(aimOf(R, B.d)!); R.click(4, true); } const was = P.chains[0]?.steps.length;
        if (spot) { R.aim(spot); R.click(4); } const C = P.chains[0];
        line(!!spot && P.chains.length === 1 && C?.steps.length === 1 && C.steps[0].kind === 'floor' && R.tail()?.order === 'move', 'a plain right click replaces what they were chained to', `was ${was} stops · now ${P.chains.length} chain of ${C?.steps.length} (${C?.steps[0]?.kind}) · ${R.tail()?.order}`); }
      R.home();
      // 12. the snapshot pair (savestate.ts files it with the switch on; a room clear's cast is not a thing a save takes, so the pair is asked directly)
      { const [a, b] = [T()[0], T().find((m: any) => O.pairOf(m) !== O.pairOf(T()[0])) ?? T()[1]]; R.clickMan(a); R.clickMan(b, true);
        const spot = floorSpot(R); R.aim(aimOf(R, A.d)!); R.click(4); if (spot) { R.aim(spot); R.click(4, true); }
        const snap = PM.planSnapshot(O), was = JSON.stringify({ up: P.up, pick: P.pick, chains: P.chains });
        R.toggle(); R.press(ORDERS.whoKey); P.chains.length = 0; R.step(5); const changed = JSON.stringify({ up: P.up, pick: P.pick, chains: P.chains });
        PM.planRestore(O, JSON.parse(JSON.stringify(snap))); const now = JSON.stringify({ up: P.up, pick: P.pick, chains: P.chains });
        line(snap.chains.length === 1 && changed !== was && now === was && P.chains[0]?.steps.length === 2 && P.pick?.length === 2, 'the snapshot pair: the mode, the picked men and their chain come back as filed', `${snap.chains.length} chain filed · after the load: ${now === was ? 'as saved' : 'different'} (${P.up ? 'up' : 'down'}, ${P.pick?.length ?? 0} picked, ${P.chains[0]?.steps.length ?? 0} stops)`); }
      R.home();
      // 13. the word's key is somebody else's first: blue stacked on another door and waiting, red walking a chain — F is blue's word, and is not kept for red's pause; with nobody else waiting it is
      if (!B) line(false, 'a second door for the word to be somebody else\'s', 'none the cursor can be put on');
      else { const blue = O.men('blue'), red = O.men('red'); O.give('stack', B.t, 'blue'); R.until(() => R.stacked(blue), 25); const set = R.stacked(blue);
        O.who = 'red'; R.aim(aimOf(R, A.d)!); R.click(4); const C = P.chains[0], walking = C?.phase === 'go'; O.who = 'all'; R.step();
        R.word(); const kept = C?.spent, went = g.doorTools.ops.some((op: any) => op.door === B.d) || blue.some((m: any) => O.of(m)?.order !== 'stack');
        line(set && walking && kept === 0 && went, 'F with men waiting on the word elsewhere is THEIR word, not kept for the chain\'s pause', `blue ${set ? 'stacked' : 'not stacked'} · red's chain ${C?.phase} · kept ${kept} · blue ${went ? 'went' : 'did not go'}`); }
      R.home();
      // 14. a right click that is refused leaves the men on the chain they were on
      { const spot = floorSpot(R); R.aim(aimOf(R, A.d)!); R.click(4); const C = P.chains[0], n = O.log.length, real = O.quickFor;
        O.quickFor = () => null;   // (the order book refuses: nobody can do it — asked of this file's own rule, not of the level)
        try { if (spot) { R.aim(spot); R.click(4); } } finally { O.quickFor = real; }
        line(!!spot && P.chains.length === 1 && P.chains[0] === C && C.steps.length === 1 && C.steps[0].kind === 'door' && O.log.length === n, 'a refused right click changes nothing: the men stay on the chain they were on', `${O.log.length - n} orders given · ${P.chains.length} chain, ${P.chains[0] === C ? 'the same' : 'another'}, to a ${P.chains[0]?.steps[0]?.kind}`); }
      R.home();
      // 15. the mode up with a menu up: the click that puts the menu away is not Sam's trigger; and Shift is not his sprint
      { const spot = floorSpot(R); if (spot) R.aim(spot); R.press(ORDERS.key); const menu = !!O.menu, t0 = pl.lastFireT; R.click(1); const fired = pl.lastFireT !== t0, away = !O.menu;
        R.input.keys.add('ShiftLeft'); R.input.keys.add('KeyW'); let ran = false; for (let i = 0; i < 40; i++) { R.step(); ran ||= pl.sprinting; } R.input.keys.clear(); R.step(20);
        line(menu && away && !fired && !ran, 'the mode up: a click on a menu fires nothing, and Shift is not his sprint', `menu ${menu ? 'up' : 'not up'}, then ${away ? 'away' : 'still up'} · ${fired ? 'a round went' : 'no round'} · Shift+W: ${ran ? 'he sprinted' : 'he walked'}`); }
      R.home();
      // 16. Shift + right click with men picked out of a bigger chain: they part from it with its stops and the new one; the others go on as they were
      { const spot = floorSpot(R); R.aim(aimOf(R, A.d)!); R.click(4); const n = O.log.length; O.who = 'red'; if (spot) { R.aim(spot); R.click(4, true); }
        const red = P.chains.find((c: any) => c.who.every((x: string) => x.startsWith('Red'))), blue = P.chains.find((c: any) => c.who.every((x: string) => x.startsWith('Blue')));
        line(!!spot && P.chains.length === 2 && red?.steps.length === 2 && blue?.steps.length === 1 && O.log.length === n, 'Shift + right click for two of a chain of four: they keep its stops and take the new one, the others go on, nobody is re-ordered', `${P.chains.length} chains · red ${red?.steps.length ?? 0} stops · blue ${blue?.steps.length ?? 0} · ${O.log.length - n} orders given`); }
      R.home();
      // 17. a load's own fresh cast leaves the chains it put back; a fresh cast later clears them
      { R.aim(aimOf(R, A.d)!); R.click(4); const snap = PM.planSnapshot(O); P.chains.length = 0; PM.planRestore(O, snap); PM.planFresh(O); const stood = P.chains.length; R.step(30); PM.planFresh(O); const cleared = P.chains.length === 0;
        line(stood === 1 && cleared, 'the cast a load stands up leaves the chains the file put back; a fresh cast later clears them', `after the load's cast: ${stood} chain · after a later one: ${P.chains.length}`); }
      R.home();
      // 18. two rooms for one pair: F in, F on to the next door, where they stack and wait again, F in — and the other pair is never ordered
      if (!B) line(false, 'a second door for a chain of two rooms', 'none the cursor can be put on');
      else { const red = O.men('red'), blue = O.men('blue'), names = red.map((m: any) => m.callsign).sort().join(), n0 = O.log.length; O.who = 'red';
        R.aim(aimOf(R, A.d)!); R.click(4); R.aim(aimOf(R, B.d)!); R.click(4, true); const C = P.chains[0], keys = planView(O)?.chains[0]?.stops.map((s: any) => s.keys).join('+');
        R.until(() => C?.phase === 'wait', 25); R.word(); const in1 = isEntry() && C?.phase === 'in';
        R.until(() => C?.phase === 'held', 60); const held = C?.phase === 'held'; R.word(); const on = R.tail()?.order === 'stack' && C?.steps.length === 1;
        R.until(() => C?.phase === 'wait', 40); const wait2 = C?.phase === 'wait'; R.word(); const in2 = isEntry() && C?.phase === 'in';
        R.until(() => P.chains.length === 0, 60); const rows = O.log.slice(n0), mine = rows.every((r: any) => [...r.who].sort().join() === names), still = blue.every((m: any) => O.of(m)?.order === 'fallIn');
        line(keys === '2+1' && in1 && held && on && wait2 && in2 && P.chains.length === 0 && mine && still, 'two rooms chained for one pair: F in, F on to the next door, stacked there until F, in — the other pair never ordered', `keys ${keys} · first door: ${in1 ? 'in' : 'not in'}, ${held ? 'held' : `chain ${C?.phase}`} · F: ${on ? 'to the next door' : R.tail()?.order} · there: ${wait2 ? 'waiting' : `chain ${C?.phase}`}, ${in2 ? 'in' : 'not in'} · ${P.chains.length ? 'chain still up' : 'chain done'} · ${rows.length} orders, ${mine ? 'all red\'s' : 'not all red\'s'} · blue ${still ? 'with Sam' : 'moved'}`); }
      R.home();
      // 19. Sam stands and the walk keys move the view; the mode put down, the view is his again and so are his feet
      { const cam = R.W.cam, p0 = [...pl.char.pos], c0 = [...cam.target]; R.input.keys.add('KeyD'); R.step(60); R.input.keys.delete('KeyD'); R.step();
        const stood = dist(pl.char.pos, p0), look = P.look ? dist(P.look, p0) : 0, follows = !!P.look && dist(g.followPos(), P.look) < 1e-6, went = dist(cam.target, c0);
        R.toggle(); const back = !P.look && dist(g.followPos(), pl.char.pos) < 1e-6; let walked = 0;
        for (const k of ['KeyD', 'KeyA', 'KeyW', 'KeyS']) { if (walked > 0.5) break; R.input.keys.add(k); R.step(30); R.input.keys.delete(k); R.step(); walked = dist(pl.char.pos, p0); }
        R.toggle();
        line(P.up && stood < 0.05 && look > 10 && follows && went > 5 && back && walked > 0.5, 'the mode up, the walk keys move the view and Sam stands; the mode down, the view is his again and he walks', `mode up, D for a second: he moved ${stood.toFixed(2)} m, the view's point ${look.toFixed(1)} m, the camera ${went.toFixed(1)} m${follows ? '' : ' (the camera is not given the point)'} · mode down: the view ${back ? 'on him' : 'not on him'}, he walked ${walked.toFixed(2)} m`); }
      R.home();
      // 20. he goes on facing what he faced, wherever the cursor goes
      { R.step(30); const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), yaw0 = pl.char.bodyYaw, a0 = [...g.aimPoint], q = pl.char.pos;
        R.W.cursorAt([2 * q[0] - a0[0], 0.04, 2 * q[2] - a0[2]]); R.step(45); const turned = Math.abs(wrap(pl.char.bodyYaw - yaw0)), held = !!P.aim && dist(g.aimPoint, a0) < 1e-6;
        line(P.up && held && turned < 0.02, 'the cursor taken behind him, he goes on facing what he faced', `he turned ${turned.toFixed(3)} rad · his aim point ${held ? 'held' : `moved ${dist(g.aimPoint, a0).toFixed(2)} m`}`); }
      R.home();
      // 21. the view goes no further than its reach from the box he and the men stand in
      { R.input.keys.add('KeyW'); R.step(300); R.input.keys.delete('KeyW'); R.step(); const L = P.look ?? pl.char.pos, pts = [pl.char.pos, ...T().map((m: any) => m.char.pos)];
        const out = (k: number) => Math.max(0, Math.min(...pts.map((q: any) => q[k])) - L[k], L[k] - Math.max(...pts.map((q: any) => q[k]))), far = Math.max(out(0), out(2));
        line(P.up && far <= CMDRING.planPanReachM + 1e-6 && far >= CMDRING.planPanReachM - 0.01, 'W held five seconds: the view stops at its reach from the men', `${far.toFixed(2)} m outside the box they stand in (the reach: ${CMDRING.planPanReachM})`); R.toggle(); R.toggle(); }
      R.home();
      // 22. the right button is read when it comes up: let go inside the hold it is a click, and the order goes then
      { const spot = floorSpot(R), n = O.log.length; let early = -1, ring = true;
        if (spot) { R.aim(spot); R.input.clicked |= 4; R.input.buttons |= 4; R.step(6); early = O.log.length - n; ring = !!O.cmdRing; R.input.buttons &= ~4; R.step(2); }
        line(!!spot && P.up && early === 0 && !ring && O.log.length === n + 1 && R.tail()?.order === 'move' && P.chains.length === 1, 'the right button let go inside the hold is a click: the order goes as it comes up', spot ? `down a tenth of a second: ${early} orders, ${ring ? 'a ring' : 'no ring'} · up: ${O.log.length - n} order (${R.tail()?.order}), ${P.chains.length} chain` : 'no open floor found'); }
      R.home();
      // 23. kept down, it is the ring at the cursor: nothing is given until it comes up, and then the lit wedge — its second, an order by hand
      { const spot = floorSpot(R), n = O.log.length; let ring = false, quiet = false, lit = 0, want = '';
        if (spot) { R.aim(spot); R.input.clicked |= 4; R.input.buttons |= 4; R.step(20); const G = O.cmdRing; ring = !!G?.rmb && !!O.menu; quiet = O.log.length === n;
          if (G) { const a = 2 * Math.PI / CMDRING.wedges, r = (CMDRING.flickPx + 30) * G.z; R.input.mouseX = G.ax + Math.sin(a) * r; R.input.mouseY = G.ay - Math.cos(a) * r; R.step(3); lit = O.cmdRing?.lit ?? 0; want = O.menu?.rows.find((x: any) => x.key === 2)?.id ?? ''; }
          R.input.buttons &= ~4; R.step(2); }
        line(ring && quiet && lit === 2 && !!want && O.log.length === n + 1 && R.tail()?.order === want && !O.cmdRing && !O.menu && P.up && P.chains.length === 0, 'the right button kept down is the ring; let go on its second wedge, that order is given', spot ? `kept down a third of a second: ${ring ? 'the ring' : 'no ring'}, ${quiet ? 'nothing given yet' : 'an order already'} · the cursor out to wedge 2: ${lit} lit (${want || 'no row'}) · let go: ${O.log.length - n} order (${R.tail()?.order}), mode ${P.up ? 'up' : 'down'}, ${P.chains.length} chains` : 'no open floor found'); }
      R.home();
      // 24. … let go on its first wedge, it is the right click's own order with its chain; Shift + the button, however long, adds a stop and opens no ring
      { R.aim(aimOf(R, A.d)!); const n = O.log.length; R.input.clicked |= 4; R.input.buttons |= 4; R.step(20); const ring = !!O.cmdRing?.rmb; R.input.buttons &= ~4; R.step(2);
        const C = P.chains[0], first = O.log.length === n + 1 && R.tail()?.order === 'stack' && C?.steps.length === 1 && C.steps[0].kind === 'door';
        const spot = floorSpot(R); let ring2 = true; if (spot) { R.aim(spot); R.input.keys.add('ShiftLeft'); R.input.clicked |= 4; R.input.buttons |= 4; R.step(30); ring2 = !!O.cmdRing; R.input.buttons &= ~4; R.step(2); R.input.keys.delete('ShiftLeft'); R.step(); }
        line(ring && first && !!spot && !ring2 && P.chains.length === 1 && P.chains[0]?.steps.length === 2 && O.log.length === n + 1, 'the ring let go on its first wedge is the click\'s order, chain and all; Shift + the button kept down adds a stop and opens no ring', `on the door: ${ring ? 'the ring' : 'no ring'}, ${first ? 'stack, a chain of one stop' : `${R.tail()?.order}, ${P.chains.length} chains`} · Shift, half a second: ${ring2 ? 'a ring' : 'no ring'}, ${P.chains[0]?.steps.length ?? 0} stops, ${O.log.length - n} orders given`); }
      R.home();
      // 25. a left click with the button's ring up puts it away: nothing is given, no round goes, the mode stays
      { const spot = floorSpot(R), n = O.log.length, t0 = pl.lastFireT; let ring = false;
        if (spot) { R.aim(spot); R.input.clicked |= 4; R.input.buttons |= 4; R.step(20); ring = !!O.cmdRing; R.input.clicked |= 1; R.step(); R.input.buttons &= ~4; R.step(2); }
        line(ring && !O.cmdRing && !O.menu && O.log.length === n && P.up && pl.lastFireT === t0, 'a left click with that ring up puts it away: nothing given, nothing fired', `${ring ? 'the ring was up' : 'no ring'} · after the click: ${O.cmdRing ? 'still up' : 'gone'}, ${O.log.length - n} orders, ${pl.lastFireT === t0 ? 'no round' : 'a round'}, mode ${P.up ? 'up' : 'down'}`); }
      R.home();
      // 26. a file keeps where the view was and what he faced
      { R.input.keys.add('KeyA'); R.step(20); R.input.keys.delete('KeyA'); R.step(); const L0 = P.look ? [...P.look] : null, snap = PM.planSnapshot(O); R.toggle(); const down = !P.look; PM.planRestore(O, snap);
        line(!!L0 && down && P.up && !!P.look && dist(P.look, L0) < 1e-6 && dist(L0, pl.char.pos) > 2 && !!P.aim, 'a file keeps where the view was and what he faced', `${L0 ? `the view ${dist(L0, pl.char.pos).toFixed(1)} m from him` : 'no view of its own'} · restored: ${P.look && L0 ? `${dist(P.look, L0).toFixed(2)} m off` : 'none'}, ${P.aim ? 'his aim kept' : 'no aim'}`); }
      R.home();
      // 27. a restart with the mode up: the view starts on him again
      const sam = () => g.player.char.pos;   // (a restart stands up a new Sam: `pl` is the old one from here on)
      { R.input.keys.add('KeyA'); R.step(30); R.input.keys.delete('KeyA'); R.step(); const off = P.look ? dist(P.look, pl.char.pos) : 0;  g.restart(); R.step(3);
        const on = P.look ? dist(P.look, sam()) : -1, cam = dist(g.followPos(), sam());
        line(P.up && off > 3 && on >= 0 && on < 1e-6 && cam < 1e-6, 'a restart with the mode up: the view starts on him again', `the view ${off.toFixed(1)} m from him · after the restart: ${on < 0 ? 'no view of its own' : `${on.toFixed(2)} m`}, the camera's point ${cam.toFixed(2)} m from him`); }
      // 28. its own word left off (cmdring.ts planRts): the mode as it was first built — he walks with it up, the view is on him, a right click orders as it goes down
      { for (const m of T()) m.god = true; R.step(30);  R.home(false); CMDRING.planRts = false; R.toggle(); const p0 = [...sam()]; let walked = 0;
        for (const k of ['KeyD', 'KeyA', 'KeyW', 'KeyS']) { if (walked > 0.5) break; R.input.keys.add(k); R.step(30); R.input.keys.delete(k); R.step(); walked = dist(sam(), p0); }
        const onHim = !P.look && dist(g.followPos(), sam()) < 1e-6, spot = floorSpot(R), n = O.log.length; let atOnce = 0;
        if (spot) { R.aim(spot); R.input.clicked |= 4; R.input.buttons |= 4; R.step(); atOnce = O.log.length - n; R.step(25); } const ring = !!O.cmdRing; R.input.buttons &= ~4; R.step(2);
        CMDRING.planRts = !BREAK; R.toggle();
        line(!BREAK && walked > 0.5 && onHim && !!spot && atOnce === 1 && !ring, 'that word off: he walks with the mode up, the view is on him, and a right click orders as it goes down', `he walked ${walked.toFixed(2)} m · the view ${onHim ? 'on him' : 'not on him'} · the button down: ${atOnce} order at once, ${ring ? 'a ring' : 'no ring'} after half a second`); }
    }
  } finally { CMDRING.on = keep.on; CMDRING.hint = keep.hint; CMDRING.hands = keep.hands; CMDRING.plan = keep.plan; CMDRING.planRts = keep.rts; AUTOPILOT.on = keep.ap; Math.random = keep.rnd; }
  console.log(fails ? `planmode-check: ${fails} FAIL` : 'planmode-check: ALL PASS');
  return fails === 0;
}

if (import.meta.main) process.exit((await planmodeCheck()) ? 0 : 1);
