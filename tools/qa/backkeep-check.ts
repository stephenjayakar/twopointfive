// A man walking backwards on his opening does not change his mind every frame (cover.ts COVER.backKeep).
//   bun run tools/qa/backkeep-check.ts [--off] [--seeds 5,11]      exit 0 = holds, 1 = a line failed; --off = the rule off, which must fail
// One walk, twice, on each seed (the quiet walk rolls no dice that matter: it comes out the same on every seed; the loud one moves a little): Sam into the office's break room by its north door with one teammate behind him — quiet (silent, the partner in Sam's steps, both low)
// and loud (fall in only, both upright). Counted for the teammate: frames his feet moved AWAY from the next point of his path, and frames he changed between
// 'walk forward, gun over the shoulder' and 'walk backwards facing it' on the frame straight after the last change (a man who decides once changes once).
import { Run, squadUp } from './pairsneak.ts';

const OFF = process.argv.includes('--off');
const SEEDS = (() => { const i = process.argv.indexOf('--seeds'); return (i > 0 ? process.argv[i + 1] : '5,11').split(',').map(Number); })();
const gaze = new WeakMap<object, number[]>();
/** a defender's gaze pinned on a point (as sneak-probes.ts: the men's idle glancing is dice, and nobody here is to be seen) */
const stare = (h: any, to: number[]) => { const c = h.char;
  if (!gaze.has(c)) { const dir = () => { const t = gaze.get(c)!, dx = t[0] - c.pos[0], dz = t[2] - c.pos[2], l = Math.hypot(dx, dz) || 1; return [dx / l, 0, dz / l]; };
    Object.defineProperty(c, 'chestDir', { get: dir, set: () => {}, configurable: true }); c.headDir = dir; }
  gaze.set(c, [to[0], 0, to[2]]); };

async function walk(quiet: boolean, keep: boolean, seed: number) {
  const R = await Run.start('roomclear=10&squad=1', seed, { sneak: quiet, set: { COVER: { backKeep: keep } } }); R.stopOnNotice = false;
  if (quiet) squadUp(R);
  else { if (!R.order(R.onSelf(), ['Digit3'], 'fallIn')) { const why = R.g.orders.give('fallIn', { kind: 'none', at: [R.pos[0], 0, R.pos[2]] }); if (why) throw new Error(`fall in refused — ${why}`); } R.wait(0.8); }
  for (const h of R.hostiles) stare(h, [h.char.pos[0] - 6, 0, h.char.pos[2] + 1]);
  const m = R.mate; let away = 0, flips = 0, changes = 0, was: boolean | null = null, last = -9, n = 0, backFrames = 0;
  const step0 = R.step.bind(R);
  (R as any).step = (k = 1) => { for (let i = 0; i < k; i++) { step0(1); n++;
    const v = m.char.vel, sp = Math.hypot(v[0], v[2]), wp = m.path[m.pathI], back = !!m.script?.strafe;
    if (wp && sp > 0.3 && v[0] * (wp[0] - m.char.pos[0]) + v[2] * (wp[2] - m.char.pos[2]) < 0) away++;
    if (back && sp > 0.3) backFrames++;
    if (was !== null && back !== was) { changes++; if (n - last === 1) flips++; last = n; }
    was = back; } };
  try {
    R.crouch(quiet); R.go(R.free([24.6, 0, 11.2]), 60); R.gather(); R.toDoor('breakroom_n'); if (quiet) R.ocp('panel_corridor_20'); R.gather(); R.ease('breakroom_n'); R.holster(true); R.through('breakroom_n', 1.0);
    for (const p of [[34.3, 0, 13.6], [34.3, 0, 17.0], [34.3, 0, 21.6]]) R.go(R.free(p), 30);
  } finally { (R as any).step = step0; }
  return { away, flips, changes, backFrames, n };
}

let ok = true;
const line = (pass: boolean, label: string, detail: string) => { ok &&= pass; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}\n        ${detail}`); };
const words = (s: Awaited<ReturnType<typeof walk>>) => `${s.away} frames walking away from his next step, ${s.flips} back-to-back changes of mind (${s.changes} changes in all, ${s.backFrames} frames walking backwards, ${s.n} frames)`;
for (const seed of SEEDS) for (const quiet of [true, false]) {
  const name = `seed ${seed}, ${quiet ? 'quiet (in Sam\'s steps)' : 'loud (fall in)'}`;
  const on = await walk(quiet, !OFF, seed), old = OFF ? on : await walk(quiet, false, seed);
  console.log(`${name}\n    rule ${OFF ? 'off' : 'on'}: ${words(on)}${OFF ? '' : `\n    rule off: ${words(old)}`}`);
  // (a few back-to-back changes are left on the quiet walk, each with his body already turned toward his way: he walks on through them)
  line(on.flips <= (quiet ? 20 : 4), `${name}: he does not change his mind frame after frame`, `${on.flips} back-to-back changes`);
  line(on.away <= 20, `${name}: he does not walk away from his next step`, `${on.away} frames`);
}
// ---- a recording or a replay's tape from before the keys plays as it was made: journal.ts applyKnobs writes the rule off and the partner's side step's old reach
// for a file that does not carry them (and leaves a file's own word alone — a tape that has the key writes it back right after: rerun.ts / engineplay.ts tables())
if (!OFF) { const J = await import('../../src/game/journal.ts'), { COVER } = await import('../../src/game/cover.ts'), { SNEAK } = await import('../../src/game/sneak.ts');
  const R = await Run.start('roomclear=10&squad=1', SEEDS[0], {}), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.g))), was = [COVER.backKeep, SNEAK.sideStop] as const, now = (): [boolean, number] => [COVER.backKeep, SNEAK.sideStop];
  COVER.backKeep = true; SNEAK.sideStop = 0.25; const old = snap(); delete old.tables.COVER; delete old.tables.SNEAK; J.applyKnobs(R.g, old);
  line(now()[0] === false && now()[1] === 0, 'a recording from before the keys replays with the rule off', `COVER.backKeep ${COVER.backKeep}, SNEAK.sideStop ${SNEAK.sideStop}`);
  COVER.backKeep = true; SNEAK.sideStop = 0.25; const own = snap(); own.tables.COVER = { backKeep: true }; own.tables.SNEAK = { sideStop: 0.25 }; J.applyKnobs(R.g, own);
  line(now()[0] === true && now()[1] === 0.25, 'a file that carries the keys keeps its own word', `COVER.backKeep ${COVER.backKeep}, SNEAK.sideStop ${SNEAK.sideStop}`);
  COVER.backKeep = was[0]; SNEAK.sideStop = was[1]; }
console.log(ok ? '=== backkeep-check: ALL PASS ===' : '=== backkeep-check: FAILURES above ===');
process.exit(ok ? 0 : 1);
