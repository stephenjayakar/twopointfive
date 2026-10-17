// ESC IS ONLY THE PAUSE; TAB BACKS OUT — the check behind BACKKEY.tab (src/game/backkey.ts; on in the page, ?tabback=0; off in the module and on the frozen
// stand, TPS_TABBACK=1).
//   bun run tools/qa/probes.ts tabback        (family `orders`)        TABBACK_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-17: "esc is overloaded -- exiting out of menus as well as going to pause. maybe we make tab exit out of menus and esc is always pause?"
// THE FOUR THINGS ESC BACKED OUT OF, each staged as play stages it and given a Tab in the tick, with the rule on and with it off:
//   the squad's order menu (X on the floor, a room clear with four) · the open Space list (Space held at a shut door) · a running verb (the leaf being eased)
//   · the launcher's held arc (the right button held with a 40 mm up).
// THEN THE PAUSE with the rule on, under stepFrame (host/loop.ts, the loop main.ts runs) with the card up for some frames and Space let go under it: the first
// tick after the card, and only it, holds the one-tick code 'Paused'; the Space list is shut and its row is not done; the order menu is still up. The same
// keys given to a fresh game tick by tick (what a recording holds and a replay does) end the same way, and a held arc given 'Paused' is let go unsent.
// A headless run cannot press the page's keys: main.ts's lines (Esc's press taken out of the frame, no back-out on it, Tab's trial waiting its turn) are held
// by their source text here, and looked at on the real page apart.
import { readFileSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
type V = [number, number, number];
const DT = 1 / 60, IK = 'Space';
export async function tabBackCheck(): Promise<boolean> {
  const BRK = process.env.TABBACK_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== tabback: Esc is only the pause, Tab backs out${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const { BACKKEY, backName } = await import(`${ROOT}/src/game/backkey.ts`); const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { knobsSnapshot, applyKnobs } = await import(`${ROOT}/src/game/journal.ts`); const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);
  const { stage, rmbHold, rmbUp } = await import('./fn2000-probes.ts');
  const was = BACKKEY.tab, log = console.log, err = console.error, warn = console.warn;
  const quiet = async <T>(f: () => T | Promise<T>): Promise<T> => { console.log = console.error = console.warn = () => { }; try { return await f(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  const set = (rule: boolean) => { BACKKEY.tab = rule && !BRK; };
  const key = (W: any, code: string, n = 1) => { W.input.pressed.add(code); for (let i = 0; i < n; i++) W.step(DT); };
  try {
    // ---- the Space list and the leaf being eased: the office, a shut door, everybody parked
    const door = async (rule: boolean) => quiet(async () => { set(rule); const W: any = await standUp({ seed: 31 }); set(rule); const g = W.game; g.godMode = true; g.aiEnabled = false; g.playerInvisible = true;
      const d = g.doors.byName('breakroom_n'); d.reset(); g.teleportPlayer([30.6, 0, 11.45]); g.player.crouch = false; g.player.char.bodyYaw = 0; W.step(DT); W.step(DT); return { W, g, d, pl: g.player }; });
    const list = async (rule: boolean, code: string) => { const { W, g, d, pl } = await door(rule);
      return quiet(() => { W.input.keys.add(IK); W.input.pressed.add(IK); for (let i = 0; i < 30 && !pl.sel.open; i++) W.step(DT); const open = !!pl.sel.open, a0 = d.angle;
        key(W, code); const shut = !pl.sel.open; W.input.keys.delete(IK); for (let i = 0; i < 30; i++) W.step(DT);
        return { open, shut, did: Math.abs(d.angle - a0) > 0.02 || !!pl.easing || !!pl.picking, g, W }; }); };
    const ease = async (rule: boolean, code: string) => { const { W, g, d, pl } = await door(rule);
      return quiet(() => { key(W, 'ArrowDown'); const hv = g.hover?.verb; key(W, IK, 12); const easing = pl.easing === d; key(W, code, 2); return { hv, easing, stopped: !pl.easing }; }); };
    { const on = await list(true, 'Tab'), off = await list(false, 'Tab'), esc = await list(true, 'Escape');
      verdict(on.open && on.shut && !on.did && off.open && !off.shut && off.did && esc.open && esc.shut && !esc.did, 'the open Space list: Tab backs out of it and the press is spent (letting go does nothing); with the rule off Tab is nothing to it; an Escape that reaches the tick still backs out',
        `rule on, Tab: open ${on.open} → shut ${on.shut}, anything done on letting go ${on.did} · rule off, Tab: shut ${off.shut}, done on letting go ${off.did} · rule on, Escape in the tick: shut ${esc.shut}, done ${esc.did}`); }
    { const on = await ease(true, 'Tab'), off = await ease(false, 'Tab');
      verdict(on.easing && on.stopped && off.easing && !off.stopped, 'a running verb (the leaf being eased): Tab stops it where it is; with the rule off it runs on', `rule on: ${on.hv} running ${on.easing} → stopped ${on.stopped} · rule off: running ${off.easing} → stopped ${off.stopped}`); }

    // ---- the launcher's held arc: the 40 mm up, the right button held
    const arc = async (rule: boolean, how: 'Tab' | 'Paused') => quiet(async () => { set(rule); const W: any = await stage(2301); set(rule); const g = W.game, pl = g.player, rf = pl.rifle; rf.shells = Math.max(rf.shells, 2);
      const AHEAD: V = [35.5, 1.2, 11.5], at = () => AHEAD; for (let i = 0; i < 3 && rf.attachment !== 'he40'; i++) { key(W, 'Digit2'); for (let f = 0; f < 40; f++) { W.cursorAt(AHEAD); W.step(DT); } }
      const s0 = rf.shells; rmbHold(W, at, 6); const held = pl.launchHeld;
      W.cursorAt(AHEAD); W.input.buttons |= 4; W.input.pressed.add(how); W.step(DT);
      const after = pl.launchHeld; rmbUp(W, at); for (let f = 0; f < 6; f++) { W.cursorAt(AHEAD); W.step(DT); }
      return { load: rf.attachment, held, after, flew: s0 - rf.shells + g.shells.length }; });
    { const on = await arc(true, 'Tab'), off = await arc(false, 'Tab');
      verdict(on.held === 'he40' && on.after === null && on.flew === 0 && off.held === 'he40' && off.after === 'he40' && off.flew === 1, 'the launcher\'s held arc: Tab lets go of it unsent; with the rule off Tab is nothing to it and letting go sends the round',
        `rule on: held ${on.held} → ${on.after}, rounds gone ${on.flew} · rule off: held ${off.held} → ${off.after}, rounds gone ${off.flew}`); }

    // ---- the squad's order menu: a room clear with four, X on the floor ahead
    const squad = async (rule: boolean) => quiet(async () => { set(rule); const W: any = await standUp({ seed: 33 }); set(rule); const g = W.game; g.godMode = true;
      const why = startFromQuery(g, new URLSearchParams('roomclear&squad4')).why; for (let i = 0; i < 20; i++) { g.player.visibility = 0.05; W.step(DT); }
      const p = g.player.char.pos, at: V = [p[0] + 1.5, 0, p[2] + 0.5]; W.cursorAt(at); key(W, ORDERS.key); W.cursorAt(at); W.step(DT);
      return { W, g, O: g.orders, why, at }; });
    { const A = await squad(true), hintOn = String(A.O.hud().menu?.hint ?? ''), upA = !!A.O.menu, ableA = A.g.backable(); await quiet(() => { A.W.cursorAt(A.at); key(A.W, 'Tab', 2); }); const goneA = !A.O.menu, ableAfter = A.g.backable();
      const B = await squad(false), hintOff = String(B.O.hud().menu?.hint ?? ''), upB = !!B.O.menu; await quiet(() => { B.W.cursorAt(B.at); key(B.W, 'Tab', 2); }); const stayB = !!B.O.menu; await quiet(() => { B.W.cursorAt(B.at); key(B.W, 'Escape', 2); }); const escB = !B.O.menu;
      verdict(A.why === null && upA && goneA && ableA && !ableAfter && /\btab\b/.test(hintOn) && !/\besc\b/.test(hintOn) && upB && stayB && escB && /\besc\b/.test(hintOff) && !/\btab\b/.test(hintOff),
        'the order menu: Tab closes it and its line names Tab, not Esc; with the rule off Tab is nothing to it, Esc closes it and the line names Esc', `rule on: up ${upA} → gone on Tab ${goneA} · something to back out of before ${ableA}, after ${ableAfter} · "${hintOn}" · rule off: up ${upB}, still up after Tab ${stayB}, gone on Esc ${escB} · "${hintOff}"`); }

    // ---- the pause with the rule on: the first tick after the card holds 'Paused'; a held list and a held arc are let go unsent in it; the order menu stays
    { const { stepFrame } = await import(`${ROOT}/src/host/loop.ts`);
      const under = (W: any, st: { frozen: boolean; seen: number; esc: number }) => { const g = W.game, up = g.update;
        g.update = function (this: any, dt: number, input: any, ...a: unknown[]) { if (input.pressed.has('Paused')) st.seen++; if (input.pressed.has('Escape')) st.esc++; return up.call(this, dt, input, ...a); };
        return { game: g, input: W.input, cam: W.cam, view: W.canvas, host: W.engine, render: () => { W.engine.world.upload(); }, betweenTicks: () => { W.engine.world.upload(true); },
          smoke: null, audio: null, demo: null, attract: null, hud: null, bubbles: null, time: 0, updateMs: 0, frozen: () => st.frozen, present: () => false, fixedStep: () => false }; };
      const A = await squad(true), up0 = !!A.O.menu, stA = { frozen: false, seen: 0, esc: 0 };
      await quiet(() => { const ctx = under(A.W, stA); A.W.cursorAt(A.at); stepFrame(ctx, DT); stA.frozen = true; for (let i = 0; i < 3; i++) stepFrame(ctx, DT); stA.frozen = false; for (let i = 0; i < 3; i++) { A.W.cursorAt(A.at); stepFrame(ctx, DT); } }); const up1 = !!A.O.menu;
      const stL = { frozen: false, seen: 0, esc: 0 };
      const L = await quiet(async () => { const { W, d, pl } = await door(true); W.input.keys.add(IK); W.input.pressed.add(IK); for (let i = 0; i < 30 && !pl.sel.open; i++) W.step(DT); const open = !!pl.sel.open, a0 = d.angle;
        const ctx = under(W, stL); stepFrame(ctx, DT); stL.frozen = true; stepFrame(ctx, DT); W.input.keys.delete(IK); stepFrame(ctx, DT); stepFrame(ctx, DT); const under0 = !!pl.sel.open; stL.frozen = false; stepFrame(ctx, DT); const shut = !pl.sel.open;
        for (let i = 0; i < 30; i++) stepFrame(ctx, DT); return { open, under0, shut, did: Math.abs(d.angle - a0) > 0.02 || !!pl.easing || !!pl.picking }; });
      const T = await quiet(async () => { const { W, d, pl } = await door(true); W.input.keys.add(IK); W.input.pressed.add(IK); for (let i = 0; i < 30 && !pl.sel.open; i++) W.step(DT); const open = !!pl.sel.open, a0 = d.angle;
        W.input.keys.delete(IK); W.input.pressed.add('Paused'); W.step(DT); const shut = !pl.sel.open; for (let i = 0; i < 30; i++) W.step(DT); return { open, shut, did: Math.abs(d.angle - a0) > 0.02 || !!pl.easing || !!pl.picking }; });
      const R = await arc(true, 'Paused');
      const main = readFileSync(`${ROOT}/src/main.ts`, 'utf8'), never = /!BACKKEY\.tab && game\.escape\(\)/.test(main), takes = /if \(BACKKEY\.tab\) input\.pressed\.delete\('Escape'\); menu\.toggle\(\);/.test(main), trial = /input\.hit\('Tab'\) && !\(BACKKEY\.tab && !frozen && game\.backable\(\)\)/.test(main);
      verdict(up0 && up1 && stA.seen === 1 && L.open && L.under0 && L.shut && !L.did && stL.seen === 1 && stL.esc === 0 && T.open && T.shut && !T.did && R.held === 'he40' && R.after === null && R.flew === 0 && never && takes && trial && backName() === (BRK ? 'Esc' : 'Tab'),
        'the pause is the pause and nothing else: the first tick after the card holds \'Paused\' once, a Space list held as the card came up is shut with its row not done (and the same keys given tick by tick, as a replay gives them, end the same), a held arc is let go unsent, the order menu is still up, and main.ts takes Esc\'s press out of the frame and never backs out on it',
        `order menu up ${up0} → after the card ${up1}, ticks holding 'Paused' ${stA.seen} · Space list open ${L.open}, still open under the card ${L.under0} → shut on the first tick back ${L.shut}, anything done ${L.did}, ticks holding 'Paused' ${stL.seen} · the same keys tick by tick: shut ${T.shut}, anything done ${T.did} · arc held ${R.held} → ${R.after} on 'Paused', rounds gone ${R.flew} · main.ts: no back-out on Esc ${never}, the press leaves the frame ${takes}, Tab's trial waits its turn ${trial} · the hint rows name ${backName()}`); }

    // ---- the words: Options ▸ Game's 'Tab key' row must not say Tab does nothing while Tab is the back key (ui/tabkey.ts tabChoices)
    { const { tabChoices, TAB_CHOICES, TAB_BACK_LINE } = await import(`${ROOT}/src/ui/tabkey.ts`); const on = tabChoices(!BRK), off = tabChoices(false);
      const first = on[0].v === 'off' && on[0].label === 'Nothing more' && on[0].line.startsWith(TAB_BACK_LINE) && !/does nothing/.test(on[0].line), rest = on.slice(1).every((c: any, i: number) => c.label === TAB_CHOICES[i + 1].label && c.line === `${TAB_CHOICES[i + 1].line} Backing out comes first.`);
      const asWas = off.length === TAB_CHOICES.length && off.every((c: any, i: number) => c.v === TAB_CHOICES[i].v && c.label === TAB_CHOICES[i].label && c.line === TAB_CHOICES[i].line) && off[0].line === 'Tab does nothing.';
      verdict(first && rest && asWas, 'the Tab key row on Options says what Tab does: with the rule on the first choice is \'Nothing more\' and says Tab backs out, every other choice says backing out comes first; with it off the row is as it was',
        `rule on: '${on[0].label}' · '${on[0].line}' · the others end 'Backing out comes first.' ${rest} · rule off: as it was ${asWas}`); }

    // ---- the switch: a recording from before the key, the frozen stand's row
    { const { g } = await door(true); BACKKEY.tab = true; const snap: any = JSON.parse(JSON.stringify(knobsSnapshot(g))), has = typeof snap.tables?.BACKKEY?.tab === 'boolean'; const old = JSON.parse(JSON.stringify(snap)); delete old.tables.BACKKEY;
      const offOld = await quiet(() => { applyKnobs(g, old); const off = BACKKEY.tab === false; applyKnobs(g, snap); return off && BACKKEY.tab === true; });
      verdict(has && offOld && FROZEN_HOLDS['BACKKEY.tab'] === 'TPS_TABBACK=1', 'a recording carries the switch, one from before the key replays with it off, and the frozen stand holds it off by name', `in the file ${has} · off for an old file ${offOld} · FROZEN_HOLDS ${FROZEN_HOLDS['BACKKEY.tab']}`); }
  } finally { BACKKEY.tab = was; console.log = log; console.error = err; console.warn = warn; }
  console.log(`=== tabback: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
