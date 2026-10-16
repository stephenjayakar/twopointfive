// A HELD MAN'S LIGHT METER IS THIS HOLD'S — the check behind guards.ts heldVisibility / HELD_METER (the code review's fault: the probe keeps a key's last answer for
// ever, ids are dealt again, and nothing forgot `heldC<id>` / `heldH<id>` when a hold ended — so the next hold read the LAST hold's light as its own until the probe
// answered afresh, and the damp carried it on for a third of a second: a pair in the dark read as lit).
//   bun run tools/qa/held-meter-check.ts            (HELDMETER_BREAK=1 = a probe that will not forget: must fail)
// The headless world has no GPU meter, so nothing a frozen probe plays can show this: here the game's three light hooks (lightQuery / lightAt / lightForget) are
// swapped for a probe that answers NOTHING new (the readback's first frames) and keeps whatever it last had — a stale-answer model. A real hold is staged in the
// dark (standoff-probes.ts stageHold), a colleague looks at the pair, and the held man's meter is read on the first frame he is looked at:
//   (a) a new hold with the last hold's bright answer still under his keys · (b) the same man taken again after a lit hold · (c) nobody looking for a second while
//   the pair moves a room on · (d) nobody looking for a second, the pair where it stood: the answer is still right and is KEPT.
// exit 0 = all hold · 1 = one does not
import { ROOT } from './headless.ts';
import { stageHold, bringIn, park } from './standoff-probes.ts';
const { lightEstimateAt, HELD_METER } = await import(`${ROOT}/src/game/guards.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
type Vec3 = [number, number, number];
const DT = 1 / 60, BREAK = process.env.HELDMETER_BREAK === '1';
let failed = false; const line = (ok: boolean, s: string) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

const { W, game, victim, others } = await quiet(() => stageHold(11, 0, [20, 0, 11.25], Math.PI / 2));
const c = victim.char, kc = `heldC${c.id}`, kh = `heldH${c.id}`;
const store = new Map<string, number>(); let forgets = 0;
game.lightQuery = () => {}; game.lightAt = (k: string) => store.get(k); game.lightForget = (k: string) => { if (!BREAK && store.delete(k)) forgets++; };
const STALE = 80, stale = () => { store.set(kc, STALE); store.set(kh, STALE); forgets = 0; };
const place = () => game.visibilityOf(Math.max(lightEstimateAt(game, c.bones.chest ?? v3.add(c.pos, [0, 1.2, 0])), lightEstimateAt(game, c.bones.head ?? v3.add(c.pos, [0, 1.6, 0]))));
const obs = others[0];
const look = () => { const sp = game.player.char.pos; bringIn(game, obs, [sp[0] + 5, 0, sp[2]] as Vec3, sp); obs.hold = false; obs.pinned = false; W.step(DT); };
const away = (frames: number) => { park(obs, 1); obs.standoff = null; for (let i = 0; i < frames; i++) W.step(DT); };
const held = () => game.player.holding?.phase === 'held' && game.player.holding.g === victim;
const lit = game.visibilityOf(STALE), f = (x: number) => x.toFixed(3);
const gapFrames = Math.ceil((HELD_METER.gapSecs + 0.5) / DT);

stale(); look();
line(Math.abs(victim.visibility - place()) < 0.02 && forgets === 2, `(a) a new hold, the last hold's ${STALE} W/m² (visibility ${f(lit)}) still under his keys: his meter reads ${f(victim.visibility)} on the first look, the place's own light ${f(place())}; ${forgets} keys forgotten`);

for (let i = 0; i < 40; i++) { stale(); W.step(DT); } const wasLit = victim.visibility;   // the hold stands lit a while, the probe answering
game.player.holding = { ...game.player.holding }; stale(); W.step(DT);   // the same man, a new hold
line(wasLit > 0.9 && Math.abs(victim.visibility - place()) < 0.02 && forgets === 2, `(b) the same man taken again after a lit hold (meter ${f(wasLit)}): first frame ${f(victim.visibility)}, place ${f(place())}; ${forgets} keys forgotten`);

for (let i = 0; i < 40; i++) { stale(); W.step(DT); } const before = victim.visibility; const p0 = v3.copy(c.pos);
away(2); { const sp = game.player.char.pos, goal: Vec3 = [sp[0] - 3, 0, sp[2]]; const pup = game.puppet; if (pup) pup.goal = goal;   // (Sam walks the man in his arm down the corridor)
  for (let i = 0; i < 900 && Math.hypot(c.pos[0] - p0[0], c.pos[2] - p0[2]) < 2; i++) W.step(DT); if (pup) pup.goal = null; }
away(gapFrames);
const moved = Math.hypot(c.pos[0] - p0[0], c.pos[2] - p0[2]);
stale(); look();
line(held() && before > 0.9 && moved > HELD_METER.movedM && Math.abs(victim.visibility - place()) < 0.02 && forgets === 2, `(c) nobody looking for ${f(gapFrames * DT)} s while the pair moves ${moved.toFixed(1)} m (meter was ${f(before)}): first look ${f(victim.visibility)}, place ${f(place())}; ${forgets} keys forgotten`);

for (let i = 0; i < 40; i++) { stale(); W.step(DT); } const before2 = victim.visibility;
away(gapFrames); stale(); look();
line(BREAK || (held() && before2 > 0.9 && victim.visibility > 0.9 && forgets === 0), `(d) nobody looking for ${f(gapFrames * DT)} s, the pair where it stood (meter was ${f(before2)}): the answer is kept — first look ${f(victim.visibility)}; ${forgets} keys forgotten`);

console.log(failed ? '=== held-meter-check: FAIL ===' : '=== held-meter-check: ALL PASS ===');
process.exit(failed ? 1 : 0);
