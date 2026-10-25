// PLAN MODE: THE DIGITS PICK THE MEN (src/game/planmode.ts planInput / pickDigit / planGroundAll, CMDRING.planDigits). The maintainer, 10-24: "1 2 3 4
// in plan mode should select the appropriate squad members, and 5 selects all of them? and then we should remove clicking on the ground selects all".
//   bun run tools/qa/plandigits-check.ts            (also `probes.ts plandigits`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/plandigits-check.ts      — the same lines on the page's stand
// PASS / FAIL each, headless: the room clear on the office with its squad of four under god mode, ONE deal (seed 3: the rule has no die in it), plan
// mode's own rig (planmode-check.ts rig) with the switch raised here, so both stands ask the same lines.
//   1. each digit 1 to 4 picks that man of the squad alone, in the squad's own order, and the picture carries his digit by his circle.
//   2. Shift + a digit puts a man in the picked set and takes him out again.
//   3. 5 picks everyone.
//   4. a left click on bare ground picks nobody new: the men picked stay picked. A click on a man and a drag still pick.
//   5. a digit with the ring's key down is not the mode's (it is the ring's own wedge), and a digit with no man is nothing.
//   6. the ground click is gone on a tutorial mission too (rails live or not: its lines teach the digits since 10-24).
//   7. CONTROL — the switch off: no digit is the mode's (the weapon slot's key is left in the frame), a click on nothing is everyone, no digit drawn.
//   8. CONTROL (plumbing) — a recording from before the key replays with it off; the frozen stand holds it off, the page's has it on, FROZEN_HOLDS has its row.
// PLANDIGITS_BREAK=1 = the switch left off and the same lines asked: 1 to 5 must fail.
//   exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { rig, floorSpot, STOOD } from './planmode-check.ts';

const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const PM: any = await import(`${ROOT}/src/game/planmode.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const BREAK = process.env.PLANDIGITS_BREAK === '1';

export async function plandigitsCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const knobs0 = knobsCopy(), rnd0 = Math.random, K = CMDRING;
  console.log(`plan mode's digits (src/game/planmode.ts, CMDRING.planDigits)${BREAK ? ' — PLANDIGITS_BREAK=1: the switch left off, lines 1 to 5 must fail' : ''}`);
  try {
    const R: any = await rig(3), O = R.O, g = R.game, P = R.P, input = R.input, T = (): any[] => R.team;
    K.planDigits = !BREAK; K.planClear = false; R.home();   // (line 4 asks the ground click as the digits were built: the click that deselects has its own check, planclear-check.ts)
    const digit = (d: number, shift = false) => { if (shift) input.keys.add('ShiftLeft'); R.press(`Digit${d}`); if (shift) { input.keys.delete('ShiftLeft'); R.step(); } };
    const names = () => R.names().join();
    // 1
    { const got: string[] = []; for (let d = 1; d <= 4; d++) { digit(d); got.push(names()); }
      const want = T().map((m: any) => m.callsign), V = PM.planView(O), drawn = V ? V.men.map((m: any) => m.n).join() : 'no picture';
      line(P.up && got.join() === want.join() && drawn === '1,2,3,4', '1. each digit 1 to 4 picks that man alone, in the squad\'s own order, and his digit is drawn by his circle', `the squad ${want.join()} · the digits picked ${got.join()} · drawn ${drawn}`); }
    // 2
    { digit(1); digit(3, true); const two = names(); digit(3, true); const back = names(), a = T()[0].callsign, c = T()[2].callsign;
      line(two === [a, c].sort().join() && back === a, '2. Shift + a digit puts a man in the picked set and takes him out again', `1, then Shift 3: ${two} · Shift 3 again: ${back}`); }
    // 3
    { digit(2); const one = R.names().length; digit(5); const all = R.names().length;
      line(one === 1 && all === T().length && O.who === 'all', '3. 5 picks everyone', `after 2: ${one} · after 5: ${all} of ${T().length}`); }
    // 4
    { digit(2); const spot = floorSpot(R); if (spot) R.aim(spot); R.click(1); const kept = names();
      R.clickMan(T()[3]); const man = names();
      digit(5); const S = T().map((m: any) => ({ m, s: R.screen(m) })).sort((x: any, y: any) => x.s[0] - y.s[0]), two = S.slice(0, 2);
      const lo = (k: number) => Math.min(...two.map((x: any) => x.s[k])) - 14, hi = (k: number) => Math.max(...two.map((x: any) => x.s[k])) + 14;
      R.drag([lo(0), lo(1)], [hi(0), hi(1)]); const boxed = R.names().length;
      line(!!spot && kept === T()[1].callsign && man === T()[3].callsign && boxed >= 2 && boxed < T().length, '4. a left click on bare ground picks nobody new; a click on a man and a drag still pick', spot ? `2 picked, then a click on the ground: ${kept} · a click on a man: ${man} · a box round two: ${boxed}` : 'no bare ground the cursor can be put on'); }
    R.home();
    // 5
    { digit(1); input.keys.add(K.key); input.pressed.add('Digit3'); const left = (() => { PM.planInput(O, input, R.W.cam, R.W.canvas, 0); return input.pressed.has('Digit3'); })(); input.pressed.delete('Digit3'); input.keys.delete(K.key); const held = names();
      const few = T().length; input.pressed.add('Digit4'); const team = O.squad; O.squad = () => team.call(O).slice(0, 3); PM.planInput(O, input, R.W.cam, R.W.canvas, 0); O.squad = team; const none = names();
      line(left && held === T()[0].callsign && none === T()[0].callsign, '5. a digit with the ring\'s key down is left for the ring, and a digit with no man is nothing', `picked ${T()[0].callsign} · the ring's key down + 3: the digit ${left ? 'left in the frame' : 'taken'}, picked ${held} · 4 in a squad of three (of ${few}): picked ${none}`); }
    R.home();
    // 6
    { const rails0 = g.rails; K.planDigits = true;
      g.rails = { live: true }; const taught = PM.planGroundAll(O); g.rails = { live: false }; const plain = PM.planGroundAll(O); g.rails = rails0; const here = PM.planGroundAll(O); K.planDigits = !BREAK;
      line(!taught && !plain && !here, '6. the ground click is gone on a tutorial mission too: its lines teach the digits', `rails live: ${taught ? 'everyone' : 'nobody new'} · rails not live: ${plain ? 'everyone' : 'nobody new'} · this mission: ${here ? 'everyone' : 'nobody new'}`); }
    // 7
    { K.planDigits = false; R.home(); R.clickMan(T()[0]); const one = names();
      input.pressed.add('Digit2'); PM.planInput(O, input, R.W.cam, R.W.canvas, 0); const left = input.pressed.has('Digit2'); input.pressed.delete('Digit2'); const still = names();
      const spot = floorSpot(R); if (spot) R.aim(spot); R.click(1); const all = R.names().length, V = PM.planView(O), drawn = V ? V.men.map((m: any) => m.n).join() : 'no picture';
      line(one === T()[0].callsign && left && still === one && !!spot && all === T().length && drawn === '0,0,0,0', '7. CONTROL — the switch off: no digit is the mode\'s, a click on nothing is everyone, no digit drawn', `picked ${one} · 2: ${left ? 'left in the frame' : 'taken'}, picked ${still} · a click on the ground: ${all} of ${T().length} · drawn ${drawn}`);
      K.planDigits = !BREAK; }
    // 8
    { const was = K.planDigits; K.planDigits = true; const snap = JSON.parse(JSON.stringify(knobsSnapshot(g))), old = JSON.parse(JSON.stringify(snap)); delete old.tables.CMDRING.planDigits;
      applyKnobs(g, old); const before = K.planDigits; applyKnobs(g, snap); const on = K.planDigits; K.planDigits = was;
      const shipped = String(process.env.TPS_PROFILE ?? '') === 'shipped', stood = STOOD.digits, row = FROZEN_HOLDS['CMDRING.planDigits'];
      line(before === false && on === true && stood === shipped && /TPS_PLANDIGITS=1/.test(row ?? ''), '8. CONTROL (plumbing) — a recording from before the key replays with it off; the stands and the FROZEN_HOLDS row', `a file without the key: ${before} · one with it on: ${on} · this stand (${shipped ? 'the page\'s' : 'frozen'}) stood it ${stood} · the row: ${row ?? 'none'}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }
  console.log(fails ? `=== plandigits-check: ${fails} FAIL ===` : '=== plandigits-check: ALL PASS ===');
  return !fails;
}

if (import.meta.main) process.exit((await plandigitsCheck()) ? 0 : 1);
