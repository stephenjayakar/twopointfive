// THE WHEEL WITH THE RING UP STEPS NOBODY (src/game/orders.ts ringInput, CMDRING.wheelIdle). The maintainer, 10-24, with a recording of the depot:
// "got into a weird state where my command modes (not plan mode) only selected blue team". The recording has a two-finger scroll with the squad's
// ring still up: the wheel stepped who the orders go to, the choice stayed after the ring had gone, and no key steps it back under `only`.
//   bun run tools/qa/wheelidle-check.ts            (also `probes.ts wheelidle`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/wheelidle-check.ts      — the same lines on the page's stand
// PASS / FAIL each, headless: the room clear on the office with its squad of four under god mode, ONE deal (seed 3: the rule has no die in it), the
// ring put up with its own key the way this stand has it (held, or let go where the ring stays; a stand with no ring is given the ring as built), the
// switch raised here, so both stands ask the same lines. THE SCROLL is the recording's own: its twenty wheel records, tick for tick.
//   1. the scroll with the ring up leaves the orders with everyone, at every record, and the ring is still up.
//   2. the scroll is not his walking pace either (the plain wheel's own job with no ring up): his pace is as it was.
//   3. the ring put away and the key tapped: the order goes to all four.
//   4. a click on a man with the ring up is still him alone, and the scroll after it leaves it his.
//   5. CONTROL — the switch off: the same scroll steps who the orders go to, the choice stays after the ring has gone, and the tap is theirs alone.
//   6. CONTROL (plumbing) — a recording from before the key replays with it off; the frozen stand holds it off, the page's has it on, FROZEN_HOLDS has its row.
// WHEELIDLE_BREAK=1 = the switch left off and the same lines asked: 1 and 3 must fail.
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const { CMDRING, CMDRING_STATS } = await import(`${ROOT}/src/game/cmdring.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const BREAK = process.env.WHEELIDLE_BREAK === '1';
/** the recording's scroll: [ticks after its first record, the wheel that tick] (0.37 s of a trackpad, 266 px in all) */
const SCROLL: [number, number][] = [[0, -1], [2, -5], [3, -8], [4, -10], [5, -11], [6, -18], [7, -18], [8, -9], [9, -33], [10, -20], [11, -9], [13, -40], [14, -7], [16, -33], [17, -10], [18, -10], [19, -4], [20, -8], [21, -8], [22, -4]];

export async function wheelidleCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const knobs0 = knobsCopy(), squad0 = NIGHTBREACH.squad, K = CMDRING;
  console.log(`the wheel with the ring up (src/game/orders.ts ringInput, CMDRING.wheelIdle)${BREAK ? ' — WHEELIDLE_BREAK=1: the switch left off, lines 1 and 3 must fail' : ''}`);
  try {
    Object.assign(NIGHTBREACH, { squad: 4 });
    const W: any = await standUp(), g = W.game, O = g.orders, input = W.input, DT = 1 / 60;
    K.wholeSquad = false;   // (lines 4 and 5 ask the choice as it was built, kept outside plan mode: the rule that only plan mode picks a part of the squad has its own check, wholesquad-check)
    const stood = !!K.wheelIdle, ringStood = !!K.on; if (!K.on) K.on = true;   // (a stand with no ring: the ring as it was built, up while its key is down)
    g.godMode = true; g.roomClear.start(3);
    const step = (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); };
    step(120);
    const team = (): any[] => O.men('all'), key = K.key;
    const aimOff = () => { const p = g.player.char.pos; W.cursorAt([p[0] + 2.5, 0.04, p[2]]); step(2); };
    /** the ring put up with its own key (true: it is up), and put away again */
    const up = (): boolean => { aimOff(); input.keys.add(key); input.pressed.add(key); for (let i = 0; i < 90 && !O.cmdRing; i++) step(); if (K.stay) { input.keys.delete(key); step(30); } return !!O.cmdRing; };
    const away = () => { input.keys.delete(key); input.pressed.add('Escape'); step(3); if (O.cmdRing || O.menu) { O.menu = null; O.cmdRing = null; } step(20); };
    /** the recording's scroll, tick for tick: who the orders go to after each record */
    const scroll = (): string[] => { const seen: string[] = []; let t = 0; for (const [at, w] of SCROLL) { while (t < at) { step(); t++; } input.wheel = w; step(); t++; seen.push(String(O.who)); } step(20); return seen; };
    /** the key tapped on the floor beside him: who took the order */
    const tap = (): string[] => { aimOff(); const n0 = O.log.length; input.keys.add(key); input.pressed.add(key); step(5); input.keys.delete(key); step(12); const row = O.log[O.log.length - 1];
      return O.log.length > n0 && row ? (row.who ?? []).map(String) : []; };
    const home = () => { away(); O.who = 'all'; O.plan.pick = null; step(4); };

    // 1, 2, 3
    K.wheelIdle = !BREAK; home();
    { const upA = up(), pace0 = g.player.pace, who0 = CMDRING_STATS.who, seen = scroll(), still = !!O.cmdRing, pace1 = g.player.pace, stepped = CMDRING_STATS.who - who0;
      line(upA && seen.every(w => w === 'all') && still && stepped === 0, '1. the recording\'s scroll with the ring up leaves the orders with everyone, at every record, and the ring is still up',
        `the ring up: ${upA} · who after each of the ${seen.length} records: ${[...new Set(seen)].join(' → ')} · stepped ${stepped} times · the ring after it: ${still ? 'up' : 'gone'}`);
      line(upA && typeof pace0 === 'number' && pace0 === pace1, '2. the scroll is not his walking pace either: his pace is as it was', `his pace ${pace0} → ${pace1}`);
      away(); const took = tap();
      line(took.length === team().length && team().length === 4 && O.who === 'all', '3. the ring put away and the key tapped: the order goes to all four', `the order went to ${took.length} of ${team().length} (${took.join(', ') || 'nobody'}) · who: ${O.who}`); }
    // 4
    home();
    { const upB = up(), k = 2, man = O.squad()[k]; W.cursorAt([man.char.pos[0], man.char.pos[1], man.char.pos[2]]); step();
      input.clicked |= 1; input.buttons |= 1; step(); input.buttons &= ~1; step(4); const his = O.who, seen = scroll(), after = O.who;
      line(upB && typeof his === 'number' && (BREAK || (after === his && seen.every(w => w === String(his)))), '4. a click on a man with the ring up is still him alone, and the scroll after it leaves it his',
        `a click at ${man.callsign}'s feet: the orders are ${typeof his === 'number' ? O.squad()[his]?.callsign ?? `man ${his}` : his}'s · after the scroll: ${typeof after === 'number' ? O.squad()[after]?.callsign ?? `man ${after}` : after}`); }
    // 5
    K.wheelIdle = false; home();
    { const upC = up(), seen = scroll(); away(); const kept = O.who, took = tap(), path = seen.filter((w, i) => i === 0 || w !== seen[i - 1]);
      line(upC && kept !== 'all' && took.length > 0 && took.length < team().length, '5. CONTROL — the switch off: the same scroll steps who the orders go to, it stays after the ring has gone, and the tap is theirs alone',
        `who through the scroll: ${path.join(' → ')} · after the ring has gone: ${kept} · the tap went to ${took.length} of ${team().length} (${took.join(', ')})`); }
    home();
    // 6
    { K.wheelIdle = true; const snap = JSON.parse(JSON.stringify(knobsSnapshot(g))), old = JSON.parse(JSON.stringify(snap)); delete old.tables.CMDRING.wheelIdle;
      applyKnobs(g, old); const before = K.wheelIdle; applyKnobs(g, snap); const on = K.wheelIdle;
      const shipped = String(process.env.TPS_PROFILE ?? '') === 'shipped', row = FROZEN_HOLDS['CMDRING.wheelIdle'];
      line(before === false && on === true && stood === shipped && /TPS_WHEELIDLE=1/.test(row ?? ''), '6. CONTROL (plumbing) — a recording from before the key replays with it off; the stands and the FROZEN_HOLDS row',
        `a file without the key: ${before} · one with it on: ${on} · this stand (${shipped ? 'the page\'s' : 'frozen'}) stood it ${stood}, its ring ${ringStood ? 'on' : 'off (given here as built)'} · the row: ${row ?? 'none'}`); }
  } finally { knobsBack(knobs0); Object.assign(NIGHTBREACH, { squad: squad0 }); }

  console.log(fails ? `=== wheelidle-check: ${fails} FAIL ===` : '=== wheelidle-check: ALL PASS ===');
  return !fails;
}

if (import.meta.main) process.exit((await wheelidleCheck()) ? 0 : 1);
