// A CAN IN THE WIND-UP GOES BACK ON THE BELT WHEN HIS HANDS START SOMETHING ELSE (src/game/throwback.ts THROWBACK.on; player.ts, ahead of the early
// returns for a kick, a pick, the wand, hands at work and the keypad, and at a takedown's start). On in the page (`?throwback=0`), off in the module and
// on the frozen stand (`TPS_THROWBACK=1`): this check raises it itself, so it reads the same on both stands.
//   bun run tools/qa/probes.ts throwback        (family `player`)        THROWBACK_BREAK=1 = the rule left off and the same lines asked: must FAIL
//
// The throw is his own: the can's digit and a click, through the game's input. The beat that follows is begun by the game's own start (startKick,
// startPicking), a few frames into the wind-up, as the row's tap would begin it.
//   a pick      a can clicked, a pick begun on a locked door inside the wind-up: the can is back on the belt, and none is in the air when the lock is
//               done, seconds later
//   a kick      the same with a kick: none in the air when the kick is over and after
//   untouched   a can clicked and nothing begun: it leaves his hand on time, one off the belt (the rule changes no plain throw)
//   off         the rule off: the can freezes through the kick and leaves his hand after it, one off the belt, as it did
//   recordings  the switch rides the knob snapshot; one from before the key puts it off; FROZEN_HOLDS has its row
import { ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';

export async function throwBackCheck(): Promise<boolean> {
  const BRK = process.env.THROWBACK_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== throwback: a can in the wind-up goes back on the belt when another beat begins${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { THROWBACK } = await import(`${ROOT}/src/game/throwback.ts`); const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`); const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
  const { startKick, startPicking } = await import(`${ROOT}/src/game/player.ts`); const { THROW_RELEASE } = await import(`${ROOT}/src/game/character.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const was = { on: THROWBACK.on, ring: HANDRING.on, ws: WALLSNAP.on, press: WALLSNAP.press }, log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  try {
    const S = await quiet(() => world(true)); const { pl, g, step, tap, place, click, setCursor } = S as any; WALLSNAP.press = false; HANDRING.on = false;
    const rule = (on: boolean) => { THROWBACK.on = on && !BRK; };
    const door = (name: string) => g.doors.list.find((d: any) => d.def.name === name);
    const cans = () => pl.canisters as number, air = () => g.items.items.length as number;
    /** stood a metre off a door's frame, the smoke in hand, a can clicked at the floor four metres off — and `n` frames into the wind-up */
    const windUp = (d: any, n: number) => { const fc = d.frameCentre; place(fc[0], fc[2] + 1.0, 180, 'pistol'); g.clearAftermath(); pl.canisters = 3; pl.pendingThrow = null; step(20); tap('Digit3'); step(30); setCursor?.(null); const c0 = cans(); click(); step(n); return { c0, pend: !!pl.pendingThrow }; };
    const HALF = Math.max(2, Math.floor(THROW_RELEASE * 60 / 2));
    // ---- a pick
    { rule(true); const d = door('storage'); d.locked = true; d.angle = 0; const W = windUp(d, HALF); startPicking(g, d); step(2); const picking = !!pl.picking, back = cans() === W.c0 && !pl.pendingThrow; let flew = 0, n = 0; for (; n < 900 && pl.picking; n++) { step(1); flew = Math.max(flew, air()); } for (let i = 0; i < 120; i++) { step(1); flew = Math.max(flew, air()); }
      verdict(W.pend && picking && back && flew === 0 && cans() === W.c0, 'a pick begun inside a can\'s wind-up: the can is back on the belt and none is thrown when the lock is done',
        `the wind-up pending ${W.pend} · the pick began ${picking} · the can back ${back} · the pick ran ${(n / 60).toFixed(1)} s · cans in the air through it and 2 s after: ${flew} · the belt ${cans()} of ${W.c0}`); }
    // ---- a kick
    { rule(true); const d = door('storage'), W = windUp(d, HALF), counted = W.c0 - cans(); startKick(g, d); step(2); const back = cans() === W.c0 && !pl.pendingThrow, kicking = !!pl.kick; let flew = 0; for (let i = 0; i < 240; i++) { step(1); flew = Math.max(flew, air()); }
      verdict(W.pend && counted === 1 && kicking && back && flew === 0 && cans() === W.c0, 'a kick begun inside a can\'s wind-up: the can is back on the belt and none is thrown, then or after the kick',
        `the wind-up pending ${W.pend}, the click counted ${counted} off · the kick began ${kicking} · two frames on: the can back and no wind-up ${back} · cans in the air over the next 4 s: ${flew} · the belt ${cans()} of ${W.c0}`); }
    // ---- untouched
    { rule(true); const d = door('conference'), W = windUp(d, 1); let at = -1; for (let i = 0; i < 60 && at < 0; i++) { step(1); if (air() > 0) at = i + 2; }
      verdict(W.pend && at > 0 && at <= Math.ceil(THROW_RELEASE * 60) + 2 && cans() === W.c0 - 1, 'a can clicked and nothing begun leaves his hand on time, one off the belt',
        `in the air ${at} frames after the click (the release is ${Math.ceil(THROW_RELEASE * 60)}) · the belt ${cans()} of ${W.c0}`); }
    // ---- off
    { THROWBACK.on = false; const d = door('storage'); d.locked = true; d.angle = 0; const W = windUp(d, HALF); startKick(g, d); step(2); const held = !!pl.pendingThrow && cans() === W.c0 - 1; let at = -1, kickEnd = -1; for (let i = 0; i < 300 && at < 0; i++) { step(1); if (kickEnd < 0 && !pl.kick) kickEnd = i + 1; if (air() > 0) at = i + 1; }
      verdict(held && at > 0 && kickEnd > 0 && at >= kickEnd && cans() === W.c0 - 1, 'the rule off: the can freezes through the kick and leaves his hand after it, as it did',
        `two frames into the kick: the wind-up still pending, one off the belt ${held} · the kick over at frame ${kickEnd}, the can in the air at frame ${at} · the belt ${cans()} of ${W.c0}`); }
    // ---- recordings
    { rule(true); const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), rides = snap.tables?.THROWBACK?.on === true; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.THROWBACK;
      const both = await quiet(() => { applyKnobs(g, old); const off = THROWBACK.on === false; applyKnobs(g, snap); return [off, THROWBACK.on === true]; }), row = (FROZEN_HOLDS as Record<string, string>)['THROWBACK.on'];
      verdict(rides && both[0] && both[1] && row === 'TPS_THROWBACK=1', 'the switch rides the knob snapshot; a recording from before the key replays with it off; FROZEN_HOLDS has its row',
        `in the snapshot ${rides} · one without the key: off ${both[0]} · one with it: on ${both[1]} · the row '${row}'`); }
  } finally { THROWBACK.on = was.on; HANDRING.on = was.ring; WALLSNAP.on = was.ws; WALLSNAP.press = was.press; }
  console.log(`=== throwback: ${all ? 'ALL PASS' : 'FAIL'} ===`);
  return all;
}
