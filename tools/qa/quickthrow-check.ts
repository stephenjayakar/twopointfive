// THE G QUICK THROW IS GONE FROM THE PAGE — the check behind src/game/quickthrow.ts (QUICKTHROW.on: off in the page, ?quickthrow; ON on the frozen stand, TPS_QUICKTHROW=0).
//   bun run tools/qa/quickthrow-check.ts        (also `probes.ts quickthrow`)
// One stood-up game (Sam alone in the corridor, the rifle up: fn2000-probes.ts stage), the switch thrown by hand, every key a real key:
//   (1) off, the rifle up: G held a third of a second and let go throws nothing — no can leaves the kit, no arc is shown, the rifle stays in his hands;
//   (2) off, a can already in the fist: G is nothing there either (the arc is the slot's own, the can stays);
//   (3) off: a can is still thrown its one way — 3 and a click (smoke), 4 and a click (stun);
//   (4) on (the frozen stand, ?quickthrow): G held and let go slings the rifle and throws the can chosen last — the build as it was;
//   (5) the words: no controls row names G or a quick throw, and Training 4's level file has no step that asks for one.
// QUICKTHROW_BREAK=1 = the switch left on for the 'off' lines: (1) and (2) must fail.   exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = resolve(import.meta.dir, '../..');

export async function quickthrowCheck(): Promise<boolean> {
  const { stage } = await import('./fn2000-probes.ts');
  const { QUICKTHROW } = await import(`${ROOT}/src/game/quickthrow.ts`);
  const { CONTROLS } = await import(`${ROOT}/src/ui/menu.ts`) as { CONTROLS: [string, string][] };
  const DT = 1 / 60; let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  console.log('\n=== quickthrow: G throws nothing in the page; a can goes from its slot with a click ===');
  const W: any = await stage(4102); const { game, input } = W; const pl = game.player;
  const was = { ...QUICKTHROW };
  const AIM = [27.5, 0.1, 11.5];
  const idle = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt(AIM); W.step(DT); } };
  const thrown = (kind: string) => game.items.items.filter((it: any) => it.kind === kind).length;
  /** G down for `n` frames, then up for a second: did an arc show, was the gesture ever armed */
  const holdG = (n: number) => { let arc = false, armed = false; input.keys.add('KeyG'); input.pressed.add('KeyG');
    for (let i = 0; i < n; i++) { W.cursorAt(AIM); W.step(DT); arc ||= !!pl.throwPreview; armed ||= pl.throwHeld; }
    input.keys.delete('KeyG'); idle(60); return { arc, armed }; };
  const kitOf = () => `smoke ${pl.canisters} stun ${pl.flashbangs} frag ${pl.frags}`;
  const rifleUp = () => { if (!pl.rifleUp) { input.pressed.add('Digit2'); W.step(DT); if (!pl.rifleUp) { input.pressed.add('KeyE'); W.step(DT); } idle(60); } };
  const off = process.env.QUICKTHROW_BREAK === '1';
  try {
    // (1) off, the rifle up
    { QUICKTHROW.on = off; pl.canisters = 2; pl.flashbangs = 2; pl.rifle.attIdx = -1; game.items.items.length = 0; rifleUp(); const up0 = pl.rifleUp, k0 = kitOf();
      const r = holdG(20);
      line(up0 && pl.rifleUp && !r.arc && !r.armed && kitOf() === k0 && game.items.items.length === 0, 'the switch off, the rifle up: G held and let go throws nothing, shows no arc, and the rifle stays in his hands',
        `rifle up ${up0} → ${pl.rifleUp} · arc ${r.arc} · armed ${r.armed} · ${k0} → ${kitOf()} · ${game.items.items.length} items in the air or on the floor`); }
    // (2) off, a can in the fist: G does not throw it
    { QUICKTHROW.on = off; pl.canisters = 2; pl.flashbangs = 2; game.items.items.length = 0; input.pressed.add('Digit3'); W.step(DT); idle(40); const sel = pl.canisterSel, k0 = kitOf();
      const r = holdG(20);
      line(sel === 'smoke' && !r.armed && kitOf() === k0 && game.items.items.length === 0, 'the switch off, the smoke can in his fist: G held and let go leaves it there (the arc shown is the slot\'s own)', `in the fist ${sel} · armed ${r.armed} · ${k0} → ${kitOf()}`); }
    // (3) off: the slot and a click
    { QUICKTHROW.on = off; pl.canisters = 2; pl.flashbangs = 2; game.items.items.length = 0; pl.fireCd = 0;
      input.pressed.add('Digit3'); W.step(DT); idle(40); W.cursorAt(AIM); input.clicked |= 1; W.step(DT); idle(60); const s = thrown('smoke'), c1 = pl.canisters;
      input.pressed.add('Digit4'); W.step(DT); idle(40); pl.fireCd = 0; W.cursorAt(AIM); input.clicked |= 1; W.step(DT); idle(60); const f = thrown('flash') + (2 - pl.flashbangs);
      line(s === 1 && c1 === 1 && pl.flashbangs === 1 && f >= 1, 'a can is still thrown its one way: 3 and a click throws a smoke can, 4 and a click a stun can', `smoke cans thrown ${s} (kit ${c1}) · stun left ${pl.flashbangs}`); }
    // (4) on = as it was
    { QUICKTHROW.on = true; pl.canisters = 2; pl.flashbangs = 2; pl.throwKind = 'smoke'; game.items.items.length = 0; rifleUp(); const up0 = pl.rifleUp;
      const r = holdG(20);
      line(up0 && !pl.rifleUp && r.arc && r.armed && pl.canisters === 1 && thrown('smoke') === 1, 'the switch on (the frozen stand, ?quickthrow): G held and let go slings the rifle and throws the smoke can — the build as it was',
        `rifle up ${up0} → ${pl.rifleUp} · arc ${r.arc} · armed ${r.armed} · ${kitOf()} · ${thrown('smoke')} smoke can out`); }
    // (5) the words
    { const rows = CONTROLS.filter(r => /quick/i.test(r[1]) || /(^|[ ·])G([ ·]|$)/.test(r[0]) && !/X · B · T · F/.test(r[0]));
      const lvl = JSON.parse(readFileSync(resolve(ROOT, 'levels/train-kit.json'), 'utf8')); const steps: any[] = lvl.scenarios?.lesson?.steps ?? [];
      const asks = steps.filter(s => /\bG\b/.test(s.line) || JSON.stringify(s.done).includes('"quick"'));
      line(rows.length === 0 && steps.length > 5 && asks.length === 0, 'no controls row names G or a quick throw, and no step of Training 4 asks for one', `controls rows ${JSON.stringify(rows)} · Training 4: ${steps.length} steps, asking for G: ${JSON.stringify(asks.map(s => s.id))}`); }
  } finally { Object.assign(QUICKTHROW, was); input.keys.delete('KeyG'); }
  console.log(`=== quickthrow: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await quickthrowCheck()) ? 0 : 1);
