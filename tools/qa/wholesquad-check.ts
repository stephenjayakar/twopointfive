// QUICK ORDERS ARE THE WHOLE SQUAD'S (src/game/orders.ts whole() / readInput / ringInput / targetUnder, planmode.ts down(), CMDRING.wholeSquad). The
// maintainer, 10-24: "quick Q mode should always do the whole squad. you should only be able to issue commands to parts of the squad in plan mode".
//   bun run tools/qa/wholesquad-check.ts            (also `probes.ts wholesquad`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/wholesquad-check.ts      — the same lines on the page's stand
// PASS / FAIL each, headless: the room clear on the office with its squad of four under god mode, ONE deal (seed 3: the rule has no die in it), plan
// mode's own rig (planmode-check.ts rig: the ring up while its key is down) with the switch raised here, so both stands ask the same lines.
//   1. a choice left on a pair with plan mode down is everyone's again on the next frame, and the key tapped goes to all four.
//   2. a click on a man with the ring up picks nobody (the ring that stays, as the page has it): the orders are still everyone's.
//   3. the who key steps nobody, on a man or off him.
//   4. the key tapped with the cursor on a teammate is not his alone: the order goes to all four.
//   5. a man picked in plan mode does not outlive it: the mode put down, the orders are everyone's, and the tap goes to all four. A pair the same.
//   6. CONTROL — in plan mode a part of the squad is still picked and ordered: the pick holds while the mode is up, and its order goes to him alone.
//   7. CONTROL — the switch off: the click on a man makes the orders his, and a man picked in plan mode keeps them after it, as it was built.
//   8. CONTROL (plumbing) — a recording from before the key replays with it off; the frozen stand holds it off, the page's has it on, FROZEN_HOLDS has its row.
// WHOLESQUAD_BREAK=1 = the switch left off and the same lines asked: 1 to 5 must fail.
//   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { rig, floorSpot } from './planmode-check.ts';

const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const BREAK = process.env.WHOLESQUAD_BREAK === '1';
/** the stand's own word for the switch, read before any rig holds it */
let stood: boolean | null = null;

export async function wholesquadCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const knobs0 = knobsCopy(), rnd0 = Math.random, K = CMDRING;
  console.log(`quick orders are the whole squad's (src/game/orders.ts whole(), CMDRING.wholeSquad)${BREAK ? ' — WHOLESQUAD_BREAK=1: the switch left off, lines 1 to 5 must fail' : ''}`);
  try {
    { const { standUp } = await import('./headless.ts'); await standUp(); stood = !!K.wholeSquad; }
    const R: any = await rig(3), O = R.O, g = R.game, P = R.P, input = R.input, KEY = K.key, T = (): any[] => R.team, N = T().length;
    const name = (w: any): string => typeof w === 'number' ? O.squad()[w]?.callsign ?? `man ${w}` : String(w);
    /** the key tapped where the cursor is: who took the order it gave (nobody: none was given) */
    const tap = (): string[] => { const n0 = O.log.length; input.keys.add(KEY); input.pressed.add(KEY); R.step(2); input.keys.delete(KEY); R.step(12); const row = R.tail();
      const who = O.log.length > n0 && row ? (row.who ?? []).map(String) : []; O.cmdRing = null; O.close(); return who; };
    const onFloor = () => { const s = floorSpot(R); if (s) R.aim(s); return !!s; };
    const chest = (m: any) => { R.W.cursorAt([m.char.pos[0], 1.0, m.char.pos[2]]); R.step(); };
    const set = (on: boolean) => { K.wholeSquad = on && K.plan; };

    // 1
    set(!BREAK); R.home(false);
    { O.who = 'blue'; R.step(); const next = O.who, ok = onFloor(), took = tap();
      line(ok && next === 'all' && took.length === N && N === 4, '1. a choice left on a pair with plan mode down is everyone\'s on the next frame, and the key tapped goes to all four',
        `left on blue: ${name(next)} a frame later · the tap went to ${took.length} of ${N} (${took.join(', ') || 'nobody'})`); }
    // 2
    R.home(false);
    { const stay0 = K.stay; K.stay = true; onFloor(); input.keys.add(KEY); input.pressed.add(KEY); R.until(() => !!O.cmdRing, 2); input.keys.delete(KEY); R.step(6); const up = !!O.cmdRing;
      const n0 = O.log.length; R.clickMan(T()[2]); R.step(6); const who = O.who, row = O.log.length > n0 ? R.tail() : null, took = row ? (row.who ?? []).length : -1;
      O.cmdRing = null; O.close(); K.stay = stay0;
      line(up && who === 'all' && (took < 0 || took === N), '2. a click on a man with the ring up picks nobody: the orders are still everyone\'s',
        `the ring up: ${up} · a click on ${T()[2].callsign}: orders to ${name(who)} · ${took < 0 ? 'no order given by it' : `the click gave ${row.order} to ${took} of ${N}`}`); }
    // 3
    R.home(false);
    { chest(T()[1]); R.press(ORDERS.whoKey); R.step(2); const onMan = O.who; onFloor(); R.press(ORDERS.whoKey); R.step(2); const off = O.who;
      line(onMan === 'all' && off === 'all', '3. the who key steps nobody, on a man or off him', `pressed on ${T()[1].callsign}: ${name(onMan)} · pressed on the floor: ${name(off)}`); }
    // 4
    R.home(false);
    { chest(T()[2]); const h = O.hover?.(), took = tap();
      line(!(h?.kind === 'none' && h.man) && took.length === N, '4. the key tapped with the cursor on a teammate is not his alone: the order goes to all four',
        `the cursor on ${T()[2].callsign} reads as ${h?.kind === 'none' ? (h.man ? 'that man alone' : 'the squad itself') : h?.kind ?? 'nothing'} · the tap went to ${took.length} of ${N}`); }
    // 5
    R.home(true);
    { R.clickMan(T()[2]); const picked = R.names().join(); R.toggle(); const after = O.who, ok = onFloor(), took = tap();
      R.home(true); const blue = T().filter((m: any) => O.pairOf(m) === 'blue'); R.clickMan(blue[0]); if (blue[1]) R.clickMan(blue[1], true); const pair = O.who; R.toggle(); const afterPair = O.who;
      line(P.up === false && picked === T()[2].callsign && after === 'all' && ok && took.length === N && pair === 'blue' && afterPair === 'all',
        '5. a man or a pair picked in plan mode does not outlive it: the mode put down, the orders are everyone\'s and the tap goes to all four',
        `picked ${picked} in the mode · the mode down: orders to ${name(after)}, the tap went to ${took.length} of ${N} · picked ${name(pair)} · the mode down: ${name(afterPair)}`); }
    // 6
    set(true); R.home(true);
    { R.clickMan(T()[2]); R.step(40); const held = R.names().join(), spot = floorSpot(R), n0 = O.log.length; if (spot) { R.aim(spot); R.click(4); } R.step(4);
      const row = O.log.length > n0 ? R.tail() : null, took = row ? (row.who ?? []).map(String) : [];
      line(P.up && held === T()[2].callsign && took.length === 1 && took[0] === T()[2].callsign, '6. CONTROL — in plan mode a part of the squad is still picked and ordered: the pick holds, and its order goes to him alone',
        `the mode up: ${P.up} · picked ${held} after 40 frames · its order (${row?.order ?? 'none'}) went to ${took.join(', ') || 'nobody'}`); }
    // 7
    set(false); R.home(false);
    { const stay0 = K.stay; K.stay = true; onFloor(); input.keys.add(KEY); input.pressed.add(KEY); R.until(() => !!O.cmdRing, 2); input.keys.delete(KEY); R.step(6);
      R.clickMan(T()[2]); R.step(6); const his = O.who; O.cmdRing = null; O.close(); K.stay = stay0;
      R.home(true); R.clickMan(T()[1]); R.toggle(); const kept = O.who; onFloor(); const took = tap();
      line(typeof his === 'number' && typeof kept === 'number' && took.length === 1, '7. CONTROL — the switch off: the click on a man makes the orders his, and a man picked in plan mode keeps them after it',
        `a click on a man with the ring up: orders to ${name(his)} · picked in the mode, the mode down: ${name(kept)}, the tap went to ${took.length} of ${N} (${took.join(', ')})`); }
    R.home(false);
    // 8
    { K.wholeSquad = true; const snap = JSON.parse(JSON.stringify(knobsSnapshot(g))), old = JSON.parse(JSON.stringify(snap)); delete old.tables.CMDRING.wholeSquad;
      applyKnobs(g, old); const before = K.wholeSquad; applyKnobs(g, snap); const on = K.wholeSquad;
      const shipped = String(process.env.TPS_PROFILE ?? '') === 'shipped', row = FROZEN_HOLDS['CMDRING.wholeSquad'];
      line(before === false && on === true && stood === shipped && /TPS_WHOLESQUAD=1/.test(row ?? ''), '8. CONTROL (plumbing) — a recording from before the key replays with it off; the stands and the FROZEN_HOLDS row',
        `a file without the key: ${before} · one with it on: ${on} · this stand (${shipped ? 'the page\'s' : 'frozen'}) stood it ${stood} · the row: ${row ?? 'none'}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }

  console.log(fails ? `=== wholesquad-check: ${fails} FAIL ===` : '=== wholesquad-check: ALL PASS ===');
  return !fails;
}

if (import.meta.main) process.exit((await wholesquadCheck()) ? 0 : 1);
