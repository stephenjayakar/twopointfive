// A HELD MAN DROPS HIS GUN — the check behind HOLD.dropGun (src/game/character.ts HOLD; the rule is player.ts startGrab; on in the page, ?nogundrop; off in the
// module and on the frozen stand, TPS_HOLDDROP=1).
//   bun run tools/qa/probes.ts holddrop        (family `grab`)        HOLDDROP_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-15, of a rifleman in his arm on the pass with the rifle still up in both hands: "held enemies should drop their gun".
// THE STAGING is the hold probes' own (the office, one man placed, Sam behind him, startGrab as the Space press calls it): a rifleman (the carbine dealt to
// Reyes), a pistol man with it drawn, and a calm man with the torch in his hand (whose pistol is holstered: the torch goes, as it always did, and nothing else).
import { standUp, ROOT } from './headless.ts';
import { place, park } from './standoff-probes.ts';
type Vec3 = [number, number, number];
const DT = 1 / 60;
export async function holdDropCheck(): Promise<boolean> {
  const BRK = process.env.HOLDDROP_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== holddrop: a held man drops his gun${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { HOLD } = await import(`${ROOT}/src/game/character.ts`); const { startGrab } = await import(`${ROOT}/src/game/player.ts`);
  const { inHand, rigOf } = await import(`${ROOT}/src/game/guards.ts`); const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const was = HOLD.dropGun, wasDisarm = HOLD.disarm, log = console.log, AT: Vec3 = [14, 0, 11.2], YAW = Math.PI / 2;
  const guns = (g: any) => g.items.items.filter((it: any) => it.kind === 'rifle' || it.kind === 'pistol');
  const props = (g: any) => { const out: any[] = []; handProps(g, out); return out.length; };
  // (the disarm move, HOLD.disarm, takes the gun a beat into the grab: it is held off here, and this check asks the rule under it — the move's voices are probes.ts grabvoice)
  /** one man taken in the arm on a fresh stand; `who`: a rifleman · a man with his pistol drawn · a calm man with the torch in his hand */
  const take = async (who: 'rifle' | 'pistol' | 'torch', rule: boolean) => {
    HOLD.dropGun = rule; console.log = () => { };
    try {
      const W: any = await standUp(); HOLD.dropGun = rule; HOLD.disarm = false; const g = W.game; g.godMode = true; g.player.visibility = 0.02; g.tune.carbineGuards = who === 'rifle' ? 'reyes' : 'none';
      for (let i = 0; i < 5; i++) W.step(DT);
      const A = g.guards.find((x: any) => x.callsign === 'Reyes'); g.guards.forEach((o: any, i: number) => { if (o !== A) park(o, i); });
      place(A, AT, YAW); A.wp = 1; 
      g.teleportPlayer([AT[0] - Math.sin(YAW) * 0.8, 0, AT[2] - Math.cos(YAW) * 0.8]); g.player.crouch = true; g.player.slot = 'pistol'; g.player.holstered = true; W.step(DT); g.player.visibility = 0.02;
      if (who === 'pistol') { A.state = 'suspicious'; A.awareness = 0.5; }   // (a man with a reason to have it out: the sidearm, not the torch, is in his hand)
      const before = { hand: inHand(A), rig: rigOf(A), items: g.items.items.length, lit: !!A.flashlight.enabled };
      startGrab(g, A); const atGrab = inHand(A);
      for (let i = 0; i < 90; i++) { g.player.visibility = 0.02; W.step(DT); }
      return { W, g, A, before, atGrab };
    } finally { console.log = log; }
  };
  const quiet = <T>(f: () => T): T => { console.log = () => { }; try { return f(); } finally { console.log = log; } };
  try {
    const rule = !BRK;
    // ---- staging: with the rule off he keeps it (the fault)
    const off = await take('rifle', false);
    { const { g, A, before, atGrab } = off;
      verdict(before.rig === 'carbine' && before.hand === 'weapon' && atGrab === 'weapon' && inHand(A) === 'weapon' && guns(g).length === 0 && A.gunLostAt < 0 && !!g.player.holding,
        'staging, the rule off: a rifleman taken in the arm keeps the rifle in his hands and nothing lies on the floor (the fault)',
        `rig ${before.rig} · in his hand before ${before.hand}, at the grab ${atGrab}, 1.5 s on ${inHand(A)} · guns on the floor ${guns(g).length} · held ${!!g.player.holding}`); }
    // ---- the rifleman
    const on = await take('rifle', rule);
    { const { g, A, atGrab } = on, G = guns(g), it = G[0], d = it ? Math.hypot(it.pos[0] - A.char.pos[0], it.pos[2] - A.char.pos[2]) : -1, fewer = props(off.g) - props(g);
      verdict(on.before.lit && off.A.flashlight.enabled && atGrab === null && inHand(A) === null && G.length === 1 && it.kind === 'rifle' && A.dropped === it && d < 2.5 && A.gunLostAt >= 0 && !A.flashlight.enabled && fewer > 0 && g.player.holding?.g === A,
        'the rule on: the rifle leaves his hands on the grab\'s own frame and lies on the floor by him, one gun and no more; his light is out; the picture draws no gun in his hands',
        `in his hand at the grab ${atGrab}, 1.5 s on ${inHand(A)} · guns on the floor ${G.map((x: any) => x.kind).join(', ') || 'none'}${it ? `, ${d.toFixed(2)} m from him` : ''} · his light was ${on.before.lit ? 'on' : 'OFF'}, is ${A.flashlight.enabled ? 'on' : 'out'} (rule off: ${off.A.flashlight.enabled ? 'on' : 'out'}) · hand-prop boxes ${fewer} fewer than with the rule off`); }
    // ---- a drawn pistol, and a calm man's torch
    { const P = await take('pistol', rule), T = await take('torch', rule), T0 = await take('torch', false);
      const kinds = (g: any, n0: number) => g.items.items.slice(n0).map((x: any) => x.kind).join(', ') || 'none';
      const pk = kinds(P.g, P.before.items), tk = kinds(T.g, T.before.items), tk0 = kinds(T0.g, T0.before.items);
      verdict(P.before.hand === 'weapon' && P.before.rig === 'pistol' && inHand(P.A) === null && pk === 'pistol' && P.A.gunLostAt >= 0 && T.before.hand === 'torch' && tk === 'torch' && tk0 === 'torch' && T.A.gunLostAt < 0 && inHand(T.A) === null,
        'a drawn pistol goes the same way; a calm man loses the torch he had in his hand, as he always did, and the pistol stays in its holster',
        `pistol man: had ${P.before.hand} (${P.before.rig}), dropped ${pk}, in his hand now ${inHand(P.A)} · calm man: had ${T.before.hand}, dropped ${tk} (rule off: ${tk0}), in his hand now ${inHand(T.A)}`); }
    // ---- the hold's ends
    { const { W, g, A } = on; const n0 = g.items.items.length;
      quiet(() => { g.selectVerb('held', 'choke'); W.input.pressed.add('Space'); for (let i = 0; i < 60 * 5 && A.state !== 'dead'; i++) { g.player.visibility = 0.02; W.step(DT); } for (let i = 0; i < 60; i++) W.step(DT); });
      const G = guns(g), more = g.items.items.slice(n0).map((x: any) => x.kind), darkDead = !A.flashlight.enabled;
      const F = await take('rifle', rule), n1 = guns(F.g).length; quiet(() => { F.g.freeHeld('cancel'); });
      const back = inHand(F.A), react = F.A.reactT; quiet(() => { for (let i = 0; i < 5; i++) F.W.step(DT); });
      const Sh = await take('pistol', rule); quiet(() => { Sh.g.freeHeld('shot'); }); const backShot = inHand(Sh.A), floorShot = guns(Sh.g).length;
      // a torch lost at one grab, a gun at a later one: loose again, calm again, the torch is still on the floor and not in his hand
      const T2 = await take('torch', rule); let twice = '';
      quiet(() => { T2.g.freeHeld('cancel'); T2.A.state = 'suspicious'; startGrab(T2.g, T2.A); const second = guns(T2.g).length; for (let i = 0; i < 30; i++) T2.W.step(DT); T2.g.freeHeld('cancel'); T2.A.state = 'patrol'; T2.A.drawn = false;
        twice = `${second}/${guns(T2.g).length}/${inHand(T2.A)}/${T2.g.items.items.filter((x: any) => x.kind === 'torch').length}`; });
      verdict(A.state === 'dead' && darkDead && backShot === 'weapon' && floorShot === 0 && twice === '1/0/null/1' && G.length === 1 && more.length === 0 && A.dropped === G[0] && n1 === 1 && back === 'weapon' && guns(F.g).length === 0 && F.A.gunLostAt < 0 && F.A.dropped === null && react >= 0.3 + HOLD.regrab - 1e-6,
        'choked out, nothing more falls from him (the one gun lies where it fell, dark); torn loose on his feet — a cancel, or Sam shot down — he has it in his hands again and the floor is clear, a longer stagger paid; a torch lost at an earlier grab stays lost',
        `choke: ${A.callsign} ${A.state}, guns on the floor ${G.length}, new items ${more.join(', ') || 'none'} · loose: guns on the floor ${n1} → ${guns(F.g).length}, in his hand ${back}, stagger ${react.toFixed(2)} s (the hold's own 0.30 + ${HOLD.regrab}) · Sam shot down with a pistol man in the arm: in his hand ${backShot}, guns on the floor ${floorShot} · the dead man's light ${darkDead ? 'out' : 'ON'} · torch at one grab, pistol at the next (guns down at the second / after / in his calm hand / torches on the floor): ${twice}`); }
    // ---- a checkpoint in the middle of the hold (a forced save: the hold itself is not filed, so he loads on his own feet — with his gun, not empty-handed and firing)
    { const { W, g, A } = await take('rifle', rule); let ok = false, detail = 'no hold to save';
      if (g.player.holding) quiet(() => {
        const file = JSON.parse(JSON.stringify(W.snapshot('hold', true))), lost = file.guards?.find?.((x: any) => x.gunLostAt >= 0) !== undefined;
        W.restore(file); for (let i = 0; i < 3; i++) W.step(DT);
        const B = g.guards.find((x: any) => x.callsign === 'Reyes'), G = guns(g);
        ok = lost && !g.player.holding && !B.held && inHand(B) === 'weapon' && B.gunLostAt < 0 && G.length === 0 && B.dropped === null;
        detail = `the file carries his lost gun ${lost} · after the load: held ${!!g.player.holding || !!B.held} · in his hand ${inHand(B)} · guns on the floor ${G.length}`; });
      verdict(ok, 'a checkpoint saved in the hold files the lost gun; loaded, he is on his own feet (a hold is not filed) with the gun in his hands and none on the floor', detail); }
    // ---- the switch's paperwork
    { HOLD.dropGun = true; const snap = JSON.parse(JSON.stringify(knobsSnapshot(on.g))); const has = typeof snap.tables?.HOLD?.dropGun === 'boolean';
      const old = JSON.parse(JSON.stringify(snap)); delete old.tables.HOLD.dropGun; quiet(() => applyKnobs(on.g, old)); const oldOff = HOLD.dropGun === false;
      quiet(() => applyKnobs(on.g, snap)); const newOn = HOLD.dropGun === true;
      verdict(has && oldOff && newOn && FROZEN_HOLDS['HOLD.dropGun'] === 'TPS_HOLDDROP=1', 'the switch rides the journal (a recording from before the key replays with it off) and has its row on the stands\' list',
        `in the journal's tables ${has} · a recording without the key → ${oldOff ? 'off' : 'ON'} · one with it on → ${newOn ? 'on' : 'OFF'} · FROZEN_HOLDS row ${FROZEN_HOLDS['HOLD.dropGun'] ?? 'missing'}`); }
  } finally { console.log = log; HOLD.dropGun = was; HOLD.disarm = wasDisarm; }
  console.log(`=== holddrop: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) { const ok = await holdDropCheck(); (globalThis as any).process.exit(ok ? 0 : 1); }
