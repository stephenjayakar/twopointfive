// THE DOOR WALK TAKEN OUT OF A PROCESS — preloaded in front of a playthrough by doorpath-probes.ts `doorpath-off` (bun run --preload), never imported.
// What "off" promises is that nothing of src/game/doorpath.ts is in the run. Here that is made so as far as a preload can: EVERY method of the walk's
// class (its statics too) throws but the three the game calls whatever the switch says (tick, after, reset — emptied; a method added later throws
// until it is named here), and every number and switch of its knob table but `on` is set to nonsense — once here, before the game is stood up, and
// again on every frame. A run that ends and digests the same with this in front of it read nothing of the walk; one that differs, or dies here, read
// something with the switch off. NOT TAKEN OUT: a field of the walk read from outside (its `stats`, its lists) and a method of a class it might one
// day extend. A function the module exports outside the class cannot be replaced from here, so one stops this file at load until it is weighed.
// This makes doorpath.ts the first game module the process evaluates. That is safe only while it imports nothing but types (src/game is one import
// cycle): a value import added there can throw at load in the preloaded run alone. doorpath-off checks the file's imports and says so first.
// THE CHECK'S OWN RED PATHS (DOORPATH_INERT, set by doorpath-off under DOORPATH_OFF_BREAK=2 / 3 — nothing is taken out in either):
//   leak      the walk is switched ON behind the harness's pin, in this process alone: the pair of runs must differ (the comparison has teeth)
//   scramble  the knobs alone are set to nonsense under a walk that is on: the run must differ from the plain one (the nonsense is read)
import * as WALK from '../../src/game/doorpath';

const { DOORPATH, DoorPath } = WALK;
const loose = Object.keys(WALK).filter(k => k !== 'DoorPath' && typeof (WALK as Record<string, unknown>)[k] === 'function');
if (loose.length) throw new Error(`doorpath-inert: doorpath.ts exports ${loose.join(', ')} outside its class — nothing here takes that out: say what calls it with the switch off`);
const K = DOORPATH as unknown as Record<string, unknown>, shipped = { ...K };
const P = DoorPath.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
const mode = process.env.DOORPATH_INERT ?? '', tick = P.tick;
const used = (what: string): never => { throw new Error(`doorpath-inert: ${what} with the switch off`); };
const scramble = () => { for (const k in shipped) { const v = shipped[k]; if (k !== 'on') K[k] = typeof v === 'number' ? 97.31 : typeof v === 'boolean' ? !v : v; } };
/** what the game calls on every frame, or at a reset, whatever the switch says */
const EVERY_FRAME = ['tick', 'after', 'reset'];
for (const k of EVERY_FRAME) if (typeof P[k] !== 'function') throw new Error(`doorpath-inert: DoorPath has no ${k}() — the list here is out of date`);

if (mode === 'leak') P.tick = function (this: unknown, ...a) { K.on = true; return tick.apply(this, a); };
else if (mode === 'scramble') { scramble(); P.tick = function (this: unknown, ...a) { scramble(); return tick.apply(this, a); }; }
else if (mode) throw new Error(`doorpath-inert: DOORPATH_INERT='${mode}' not understood: leak | scramble`);
else {
  scramble();
  // (by descriptor: a getter is not run here, on a prototype that has no fields)
  for (const o of [P, DoorPath as unknown as typeof P]) for (const k of Object.getOwnPropertyNames(o))
    if (k !== 'constructor' && typeof Object.getOwnPropertyDescriptor(o, k)?.value === 'function') o[k] = o === P && EVERY_FRAME.includes(k) ? () => {} : () => used(`${k}() was called`);
  P.tick = () => { if (K.on) used('DOORPATH.on was set'); scramble(); };
}
