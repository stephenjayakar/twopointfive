// PLAN MODE: A CLICK ON BARE GROUND DESELECTS (src/game/planmode.ts planInput, CMDRING.planClear). The maintainer, 10-25, with the digits picking the
// men and the ground click doing nothing: "clicking on the ground to deselect is pretty key".
//   bun run tools/qa/planclear-check.ts            (also `probes.ts planclear`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/planclear-check.ts      — the same lines on the page's stand
// PASS / FAIL each, headless: the room clear on the office with its squad of four under god mode, ONE deal (seed 3: the rule has no die in it), plan
// mode's own rig (planmode-check.ts rig) with the digits and this switch raised here, so both stands ask the same lines.
//   1. a left click on bare ground with men picked leaves nobody picked: no man would take an order, and no circle is drawn as picked.
//   2. a right click on the floor then orders nobody: no order is logged and no chain is laid.
//   3. the empty set is picked out of again: a click on a man is him, Shift + a digit adds to it, 5 is everyone.
//   4. the mode put down forgets it: up again, everyone is picked.
//   5. a tutorial mission (rails live) has no ground click of its own any more: its lines teach the digits (rails-check asks what the click does there).
//   6. CONTROL — the switch off: the click picks nobody new and who was picked stays picked, as the digits were built.
//   7. CONTROL (plumbing) — a recording from before the key replays with it off; the frozen stand holds it off, the page's has it on, FROZEN_HOLDS has its row.
// PLANCLEAR_BREAK=1 = the switch left off and the same lines asked: 1 to 3 must fail.
//   exit 0 = all hold · 1 = one does not
import { ROOT, standUp } from './headless.ts';
import { rig, floorSpot } from './planmode-check.ts';

const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const PM: any = await import(`${ROOT}/src/game/planmode.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { applyKnobs, knobsSnapshot } = await import(`${ROOT}/src/game/journal.ts`);
const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
const BREAK = process.env.PLANCLEAR_BREAK === '1';

export async function planclearCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const knobs0 = knobsCopy(), rnd0 = Math.random, K = CMDRING;
  console.log(`plan mode's ground click (src/game/planmode.ts, CMDRING.planClear)${BREAK ? ' — PLANCLEAR_BREAK=1: the switch left off, lines 1 to 3 must fail' : ''}`);
  try {
    await standUp(); const stood = !!K.planClear;   // (the stand's own word, before the rig holds anything)
    const R: any = await rig(3), O = R.O, g = R.game, P = R.P, input = R.input, T = (): any[] => R.team, N = T().length;
    const set = (on: boolean) => { K.planDigits = true; K.planClear = on; };
    const digit = (d: number, shift = false) => { if (shift) input.keys.add('ShiftLeft'); R.press(`Digit${d}`); if (shift) { input.keys.delete('ShiftLeft'); R.step(); } };
    const names = () => R.names().join() || 'nobody';
    /** a spot of bare floor, found while men are picked (with nobody picked no order fits a spot, and floorSpot asks that one does) */
    let bare: number[] | null = null;
    const ground = (): boolean => { bare = floorSpot(R) ?? bare; if (bare) { R.aim(bare); R.click(1); } return !!bare; };
    const lit = () => { const V = PM.planView(O); return V ? V.men.filter((m: any) => m.picked).length : -1; };

    // 1, 2
    set(!BREAK); R.home();
    { digit(2); const one = names(), ok = ground(), after = R.names().length, drawn = lit();
      line(P.up && one === T()[1].callsign && ok && after === 0 && drawn === 0, '1. a left click on bare ground with a man picked leaves nobody picked, and no circle is drawn as picked',
        `picked ${one} · a click on the ground: ${after} would take an order, ${drawn} circles lit`);
      const n0 = O.log.length, spot = bare; if (spot) { R.aim(spot); R.click(4); } R.step(6);
      line(!!spot && R.names().length === 0 && O.log.length === n0 && P.chains.length === 0, '2. a right click on the floor then orders nobody: no order is logged and no chain is laid',
        `orders logged by it: ${O.log.length - n0} · chains: ${P.chains.length} · picked: ${names()}`); }
    // 3
    { if (!R.names().length || BREAK) { R.home(); digit(1); ground(); }
      R.clickMan(T()[2]); const him = names(); ground(); digit(4, true); const added = names(); ground(); digit(5); const all = R.names().length;
      line(him === T()[2].callsign && added === T()[3].callsign && all === N, '3. the empty set is picked out of again: a click on a man is him, Shift + a digit adds to it, 5 is everyone',
        `a click on ${T()[2].callsign}: ${him} · cleared, Shift + 4: ${added} · cleared, 5: ${all} of ${N}`); }
    // 4
    { digit(1); ground(); const empty = R.names().length; R.toggle(); const downWho = R.names().length; R.toggle(); const up = R.names().length;
      line(BREAK || (empty === 0 && P.up && downWho === N && up === N && lit() === N), '4. the mode put down forgets it: up again, everyone is picked', `cleared: ${empty} · the mode down: ${downWho} of ${N} · up again: ${up} of ${N}, ${lit()} circles lit`); }
    // 5
    R.home();
    { const rails0 = g.rails; g.rails = { live: true }; const taught = PM.planGroundAll(O); g.rails = { live: false }; const plain = PM.planGroundAll(O); g.rails = rails0;
      line(!taught && !plain, '5. a tutorial mission has no ground click of its own: the switch\'s there too', `rails live: ${taught ? 'everyone' : 'the switch\'s'} · rails not live: ${plain ? 'everyone' : 'the switch\'s'}`); }
    // 6
    set(false); R.home();
    { digit(2); const one = names(); ground(); const still = names();
      line(one === T()[1].callsign && still === one, '6. CONTROL — the switch off: the click picks nobody new and who was picked stays picked', `picked ${one} · a click on the ground: ${still}`); }
    R.home();
    // 7
    { K.planClear = true; const snap = JSON.parse(JSON.stringify(knobsSnapshot(g))), old = JSON.parse(JSON.stringify(snap)); delete old.tables.CMDRING.planClear;
      applyKnobs(g, old); const before = K.planClear; applyKnobs(g, snap); const on = K.planClear;
      const shipped = String(process.env.TPS_PROFILE ?? '') === 'shipped', row = FROZEN_HOLDS['CMDRING.planClear'];
      line(before === false && on === true && stood === shipped && /TPS_PLANCLEAR=1/.test(row ?? ''), '7. CONTROL (plumbing) — a recording from before the key replays with it off; the stands and the FROZEN_HOLDS row',
        `a file without the key: ${before} · one with it on: ${on} · this stand (${shipped ? 'the page\'s' : 'frozen'}) stood it ${stood} · the row: ${row ?? 'none'}`); }
  } finally { knobsBack(knobs0); Math.random = rnd0; }

  console.log(fails ? `=== planclear-check: ${fails} FAIL ===` : '=== planclear-check: ALL PASS ===');
  return !fails;
}

if (import.meta.main) process.exit((await planclearCheck()) ? 0 : 1);
