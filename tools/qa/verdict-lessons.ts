// Every Training level ends on a verdict: the scripted player of tools/qa/lesson-run.ts plays a lesson to its end (input only), and the run it ends must be
// one `Game.verdict` names — a result, won, with the end card due (the stealth mission's own card for a quiet lesson, `takeDue()` for a room clear).
//   bun run tools/qa/verdict-lessons.ts [name …]      (default: all seven, ~1.5 min)        exit 0 = every lesson ends on a verdict · 1 = one does not
//   VERDICT_BREAK=1 must fail (the switch off: no run is named).
// Both stands: plain = FROZEN, `TPS_PROFILE=shipped` in front = the page's. The card itself is the page's to raise: `verdict-look.cjs <dir> lesson` sees it there.
import { resolve } from 'node:path';
import { runLesson } from './lesson-run';

const ROOT = resolve(import.meta.dir, '../..');
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const { TRAINING_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { VERDICT } = await import(`${ROOT}/src/game/verdict.ts`);

// the game the runner builds (it hands none back): the last one stepped
let G: any = null;
const step0 = Game.prototype.step;
Game.prototype.step = function (this: unknown, ...a: unknown[]) { G = this; return step0.apply(this, a); };

if (process.env.VERDICT_BREAK === '1') VERDICT.on = false;   // the break: no verdict at a run's end — every line must fail
const names = process.argv.slice(2).length ? process.argv.slice(2) : (TRAINING_MISSIONS as { id: string }[]).map(m => m.id);
let bad = 0;
for (const name of names) {
  G = null;
  const r = await runLesson(name, { seed: 1 });
  const V = G?.verdict, R = V?.result, due = R ? (V.cardAt as number) - G.time : NaN;
  const own = !!G?.mission?.debrief;   // the stealth mission's own card (a quiet lesson): the page opens it itself
  const card = !!R && (own || ((V.cardAt as number) >= 0 && due <= VERDICT.winSecs + 1e-6));   // (due < 0: the room fell before the scripted player's last step — the page raised the card then)
  const ok = r.code === 0 && !!R && R.won && card;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${r.code === 0 ? `played to its end in ${r.secs} s` : `the scripted run did not end — ${r.why}`} · ${R ? `verdict ${R.won ? 'WON' : 'LOST'} '${R.word}' (${V.summary()})` : 'NO VERDICT'} · ${own ? 'the mission\'s own card' : Number.isFinite(due) ? due >= 0 ? `card due in ${due.toFixed(2)} s` : `card due ${(-due).toFixed(1)} s before the script's end` : 'no card due'}`);
}
console.log(bad ? `\n=== verdict-lessons: ${bad} FAIL ===` : `\n=== verdict-lessons: all ${names.length} hold ===`);
process.exit(bad ? 1 : 0);
