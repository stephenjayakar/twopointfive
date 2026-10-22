// TUT-SOLO-CHECK: the tutorial's solo loud mission (levels/tut-solo.json, its fights in levels/tut-solo.script.ts) played by its scripted player
// (tools/qa/lessons/tut-solo.ts, through the input only) on the tutorial's frame (game/rails.ts: raised here on the frozen stand), eight ways a seed:
//   · as the lines say                      → every step goes by and the mission ends
//   · the sandbags walked STANDING          → the player goes down at that line (the gun's traverse is over a crouched head and through a standing chest)
//   · the gap crossed with NO SMOKE up      → the player goes down at that line (the gap is hosed until a smoke can has gone off between it and the gun)
//   · six seconds on the road EAST OF THE VAN, in the sentry's line, before anything else → every step still goes by (he holds his fire for a man there)
//   · stood at each PIER of the arch under the last two's fire, and the first grenade a DUD from too close → every step still goes by (a show of fire is
//     aimed at places, never at him; a dud lets nobody go and leaves the line up)
//   · the four CHECKPOINTS                  → down at the sandbags and again at the gap, Enter puts him back at the gate each time; the other three are put
//     back by the harness a step after each is kept; every beat played again from its first line, the last two men spawned once → every step goes by
// The two lessons that are about not getting shot are only lessons if they can be failed: a mission where the wrong way also works teaches nothing.
//   bun run tools/qa/tut-solo-check.ts [--seeds 1,2]        and again with TPS_PROFILE=shipped in front (the stand the page opens on)
//   TUT_SOLO_BREAK=1 …   the standing arm is played crouched, as the line says: nobody goes down there, and the check must be RED
// EXIT: 0 = all eight as said on every seed · 1 = a fault, each a line.
// Then THE SHOP'S LAMP: the ground beside the door is lit by that lamp and dark without it (the line that has him shoot it out says the dark is cover).
// Last, THE PAGE'S KIT: on a lesson's page (kit.ts kitIssuedPage) he carries this level's own card, not the plain issue every other lesson is played with.
// Headless: no GPU, no smoke sight lines, nothing here saw a picture or heard a round.
import { runLesson } from './lesson-run';

process.env.TPS_RAILS ??= '1';   // (the level has a lesson only on the frame: off on the frozen stand unless raised)
process.env.TPS_OWNCHARGE ??= '1';   // (and its door offers the charge alone, `rails.rows`: his own charges are off on the frozen stand unless raised)

const argv = process.argv.slice(2), flag = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const seeds = (flag('--seeds') ?? '1,2').split(',').map(Number).filter(n => Number.isFinite(n));
const BROKEN = process.env.TUT_SOLO_BREAK === '1';
/** `downAt`: the step the player must go down in (the last step that went by is the one before it) */
const ARMS: { word: string; say: string; downAt?: string; after?: string }[] = [
  { word: '', say: 'as the lines say' },
  { word: BROKEN ? '' : 'stand', say: 'the sandbags walked standing', downAt: 'low', after: 'crouch' },
  { word: 'nosmoke', say: 'the gap crossed with no smoke up', downAt: 'smoke', after: 'low' },
  { word: 'east', say: 'six seconds on the road east of the van, in the sentry\'s line' },
  { word: 'piers', say: 'four seconds at each pier of the arch under the last two\'s fire' },
  { word: 'dud', say: 'the first grenade fired from too close (a dud), the second from the arch' },
  { word: 'loaded', say: 'the grenade already on the launcher before its line: the line goes by and the last two still come' },
  { word: 'again', say: 'down twice and back by Enter, the other checkpoints put back by hand, each beat played again' },
];
const faults: string[] = [];
for (const seed of seeds) for (const A of ARMS) {
  process.env.TUT_SOLO_ARM = A.word;
  const r = await runLesson('tut-solo', { seed });
  const last = r.steps[r.steps.length - 1]?.id ?? '(none)', went = /the player went down/.test(r.why) && last === A.after;
  const ok = A.downAt ? r.code === 1 && went : r.code === 0;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  seed ${seed} · ${A.say}: ${A.downAt ? (went ? `he went down at '${A.downAt}'` : `he did NOT go down at '${A.downAt}' (after '${last}': ${r.why || 'the run went through'})`) : r.code === 0 ? `all ${r.steps.length} steps, ${r.secs.toFixed(0)} s` : r.why}`);
  if (!ok) faults.push(`seed ${seed}, ${A.say}: ${A.downAt ? `the player was not put down at '${A.downAt}'` : r.why}`);
}
delete process.env.TUT_SOLO_ARM;

// THE PAGE'S KIT: a lesson's page plays the plain issue (kit.ts kitIssuedPage, raised here as main.ts raises it for a row of the tutorial) — but this level
// carries its own card (two smoke, two stun, two frags, three rounds, one door charge: what its lines have him use, and one spare can), and that is what
// he must have on him there. The door charge is his card's only where his own charges are switched on (the page's stand).
{ const { readFileSync } = await import('node:fs'), { resolve } = await import('node:path'), ROOT = resolve(import.meta.dir, '../..');
  const { standUp } = await import('./headless');
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`), K = await import(`${ROOT}/src/game/kit.ts`), { OWNCHARGE } = await import(`${ROOT}/src/game/owncharge.ts`);
  const log = console.log, warn = console.warn, err = console.error; console.log = console.warn = console.error = () => { };
  let held = '', charges = -1, why = '', lampLit = -1, lampOut = -1;
  try { K.kitIssuedPage(true); const W: any = await standUp({ level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels/tut-solo.json'), 'utf8'))), seed: 1 }), g = W.game;
    const r = startFromQuery(g, '?levelFile=tut-solo.json&quiet'); why = r.why ?? ''; K.kitSoloIf(g, false);   // (main.ts, straight after the page's start: a quiet mission alone wears a card)
    for (let i = 0; i < 5; i++) W.step(1 / 60);
    held = `${g.player.canisters}/${g.player.flashbangs}/${g.player.frags}/${g.player.rifle.shells}`; charges = g.doorTools.charges;
    // the shop's lamp, by the CPU's estimate (no moon, no bounce: the page's meter reads higher both times)
    const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`), { BACK } = await import(`${ROOT}/tools/levels/tut-solo.ts`);
    const meter = () => Math.round(g.visibilityOf(Math.max(lightEstimateAt(g, [BACK[0], 1.2, BACK[2]]), lightEstimateAt(g, [BACK[0], 1.6, BACK[2]]))) * 100);
    const lamp = g.engine.lights.lights.find((l: any) => l.name === 'lamp_shop'); lampLit = meter(); if (lamp) { const was = lamp.intensity; lamp.intensity = 0; lampOut = meter(); lamp.intensity = was; }
  } catch (x) { why = String((x as Error).message); } finally { K.kitIssuedPage(false); console.log = log; console.warn = warn; console.error = err; }
  const ok = !why && held === '2/2/2/3' && (!OWNCHARGE.on || charges === 1);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  on its page he carries the level's own card: smoke/stun/frags/40 mm ${held}${OWNCHARGE.on ? `, door charges ${charges}` : ' (his own charges are off on this stand: the door charge is not asked)'}${why ? ` — ${why}` : ''}`);
  if (!ok) faults.push(`the page's kit is not the level's card (${held}, door charges ${charges}${why ? `, ${why}` : ''})`);
  const lampOk = lampLit >= 50 && lampOut >= 0 && lampOut <= 20;
  console.log(`  ${lampOk ? 'PASS' : 'FAIL'}  the ground beside the shop's door is lit by the shop's lamp and dark without it: ${lampLit} with it, ${lampOut} with it out`);
  if (!lampOk) faults.push(`the shop's lamp is not what lights the ground beside the door (${lampLit} lit, ${lampOut} out)`);
}
console.log(faults.length ? `=== tut-solo-check: FAIL (${faults.length}) ===\n${faults.map(f => '  ' + f).join('\n')}` : `=== tut-solo-check: ALL PASS (${seeds.length} seeds × ${ARMS.length}, the shop's lamp, and the page's kit) ===`);
process.exit(faults.length ? 1 : 0);
