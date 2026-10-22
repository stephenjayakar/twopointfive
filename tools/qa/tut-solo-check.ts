// TUT-SOLO-CHECK: the tutorial's solo loud mission (levels/tut-solo.json, its fights in levels/tut-solo.script.ts) played by its scripted player
// (tools/qa/lessons/tut-solo.ts, through the input only), five ways a seed:
//   · as the lines say                      → every step goes by and the mission ends
//   · the sandbags walked STANDING          → the player goes down at that line (the gun's traverse is over a crouched head and through a standing chest)
//   · the gap crossed with NO SMOKE up      → the player goes down at that line (the gap is hosed until a smoke can has gone off between it and the gun)
//   · stood at each PIER of the arch under the last two's fire, and the first grenade a DUD from too close → every step still goes by (a show of fire is
//     aimed at places, never at him; a dud lets nobody go and leaves the line up)
// The two lessons that are about not getting shot are only lessons if they can be failed: a mission where the wrong way also works teaches nothing.
//   bun run tools/qa/tut-solo-check.ts [--seeds 1,2]        and again with TPS_PROFILE=shipped in front (the stand the page opens on)
//   TUT_SOLO_BREAK=1 …   the standing arm is played crouched, as the line says: nobody goes down there, and the check must be RED
// EXIT: 0 = all five as said on every seed · 1 = a fault, each a line.
// Headless: no GPU, no smoke sight lines, nothing here saw a picture or heard a round. The kit is the harness's, not the level's card (the page's is: its
// two smoke cans and one door charge are asked on the page).
import { runLesson } from './lesson-run';

const argv = process.argv.slice(2), flag = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const seeds = (flag('--seeds') ?? '1,2').split(',').map(Number).filter(n => Number.isFinite(n));
const BROKEN = process.env.TUT_SOLO_BREAK === '1';
/** `downAt`: the step the player must go down in (the last step that went by is the one before it) */
const ARMS: { word: string; say: string; downAt?: string; after?: string }[] = [
  { word: '', say: 'as the lines say' },
  { word: BROKEN ? '' : 'stand', say: 'the sandbags walked standing', downAt: 'low', after: 'crouch' },
  { word: 'nosmoke', say: 'the gap crossed with no smoke up', downAt: 'smoke', after: 'low' },
  { word: 'piers', say: 'four seconds at each pier of the arch under the last two\'s fire' },
  { word: 'dud', say: 'the first grenade fired from too close (a dud), the second from the arch' },
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
console.log(faults.length ? `=== tut-solo-check: FAIL (${faults.length}) ===\n${faults.map(f => '  ' + f).join('\n')}` : `=== tut-solo-check: ALL PASS (${seeds.length} seeds × ${ARMS.length}) ===`);
process.exit(faults.length ? 1 : 0);
